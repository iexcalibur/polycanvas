// M4A/AAC audio writer that mirrors OggOpusWriter's interface for the
// macOS capture path. Backed by Apple's AVAudioFile which handles both
// the AAC encode and the MP4/M4A muxing in one API — no hand-rolled
// container writing required.
//
// Kept local to macOS because AVFoundation is macOS-only. Windows
// continues to use OggOpusWriter (Opus/Ogg), selected via target_os
// gates in recording.rs.

use std::{
  ffi::c_void,
  fs,
  path::PathBuf,
  ptr,
};

use objc2::{
  AllocAnyThread, msg_send,
  runtime::{AnyClass, AnyObject},
};
use objc2_foundation::{NSDictionary, NSError, NSNumber, NSString, NSUInteger, NSURL};

use crate::macos::{
  audio_buffer::{AudioBuffer, AudioBufferList},
  error::CoreAudioError,
};

/// Target sample rate we encode at. Matches ENCODE_SAMPLE_RATE in
/// recording.rs (48kHz is AAC's sweet spot and also what the system
/// audio tap delivers natively — often no resample needed).
pub const AAC_ENCODE_SAMPLE_RATE: u32 = 48_000;

/// AAC output bitrate, in bits per second. 128 kbps is the conventional
/// default for speech + general meeting audio — noticeably transparent
/// at this rate on voice content, and keeps file sizes reasonable
/// (~1 MB per minute). Exposed via the AVEncoderBitRateKey setting.
const AAC_BITRATE: u32 = 128_000;

/// AVAudioCommonFormat enum — matches AVFoundation's enum values.
/// We always feed Float32 interleaved PCM, so commonFormat=1.
const AV_AUDIO_COMMON_FORMAT_FLOAT32: NSUInteger = 1;

/// Minimal writer: takes interleaved Float32 PCM at the target sample
/// rate and channel count, appends each chunk to an open `.m4a` file,
/// finalises on drop. Callers are expected to handle resampling and
/// channel conversion upstream (see `recording.rs::push_samples_m4a`).
pub struct M4aAacWriter {
  /// AVAudioFile instance. +1 retained on init; released in Drop.
  /// Writing to a null pointer is undefined behaviour — keep this
  /// non-null after construction.
  file: *mut AnyObject,

  /// AVAudioFormat describing the PCM we write (Float32, interleaved,
  /// at the target sample rate / channels). Referenced by every
  /// AVAudioPCMBuffer we construct. +1 retained, released in Drop.
  pcm_format: *mut AnyObject,

  filepath: PathBuf,
  channels: u32,
  samples_written: u64,
}

impl M4aAacWriter {
  pub fn new(filepath: PathBuf, channels: u32) -> Result<Self, CoreAudioError> {
    if channels == 0 || channels > 2 {
      // AVAudioFile supports more than 2 channels but our capture
      // path is always mono or stereo; reject the obvious mistake.
      return Err(CoreAudioError::InitAVAudioFileFailed);
    }

    if let Some(parent) = filepath.parent() {
      let _ = fs::create_dir_all(parent);
    }
    if filepath.exists() {
      let _ = fs::remove_file(&filepath);
    }

    // -------------------------------------------------------
    // 1. Build the PCM processing format (Float32 interleaved
    //    at the target sample rate / channel count). This
    //    is the format of every AVAudioPCMBuffer we hand to
    //    AVAudioFile.write.
    // -------------------------------------------------------
    let pcm_format = unsafe { build_pcm_format(AAC_ENCODE_SAMPLE_RATE, channels)? };

    // -------------------------------------------------------
    // 2. Build the settings dictionary that describes the
    //    FILE format — AAC at 48kHz / N channels, 128kbps.
    //    Different from the processing format: AVAudioFile
    //    transcodes from processing → file internally.
    // -------------------------------------------------------
    let settings = &*NSDictionary::from_retained_objects(
      &[
        &*NSString::from_str("AVFormatIDKey"),
        &*NSString::from_str("AVSampleRateKey"),
        &*NSString::from_str("AVNumberOfChannelsKey"),
        &*NSString::from_str("AVEncoderBitRateKey"),
      ],
      &[
        // kAudioFormatMPEG4AAC = 'aac ' = 0x61616320
        NSNumber::initWithUnsignedInt(NSNumber::alloc(), 0x6161_6320u32),
        NSNumber::initWithDouble(NSNumber::alloc(), f64::from(AAC_ENCODE_SAMPLE_RATE)),
        NSNumber::initWithUnsignedInt(NSNumber::alloc(), channels),
        NSNumber::initWithUnsignedInt(NSNumber::alloc(), AAC_BITRATE),
      ],
    );

    // -------------------------------------------------------
    // 3. Create the AVAudioFile for writing. The `.m4a`
    //    extension + AAC format ID tells AVFoundation to emit
    //    an MP4 container — no hand-rolled atoms needed.
    // -------------------------------------------------------
    let cls = AnyClass::get(c"AVAudioFile").ok_or(CoreAudioError::AVAudioFileClassNotFound)?;
    let obj: *mut AnyObject = unsafe { msg_send![cls, alloc] };
    if obj.is_null() {
      unsafe { release(pcm_format) };
      return Err(CoreAudioError::AllocAVAudioFileFailed);
    }

    let url_str = NSString::from_str(&filepath.to_string_lossy());
    let url = unsafe { NSURL::fileURLWithPath(&url_str) };
    let url_ptr: *mut AnyObject = &*url as *const NSURL as *mut AnyObject;

    let mut ns_error: *mut NSError = ptr::null_mut();
    let file_obj: *mut AnyObject = unsafe {
      msg_send![
        obj,
        initForWriting: url_ptr,
        settings: settings,
        commonFormat: AV_AUDIO_COMMON_FORMAT_FLOAT32,
        interleaved: true,
        error: &mut ns_error
      ]
    };
    if file_obj.is_null() {
      // alloc returned +1; if init fails the object is
      // already released per ObjC rules, so we only release
      // the PCM format and bail.
      unsafe { release(pcm_format) };
      return Err(CoreAudioError::InitAVAudioFileFailed);
    }

    Ok(Self {
      file: file_obj,
      pcm_format,
      filepath,
      channels,
      samples_written: 0,
    })
  }

  /// Append interleaved Float32 PCM samples to the file. Samples
  /// must be at `AAC_ENCODE_SAMPLE_RATE` and match the configured
  /// channel count exactly — callers resample + channel-convert
  /// upstream.
  pub fn write_samples(&mut self, samples: &[f32]) -> Result<(), CoreAudioError> {
    if samples.is_empty() {
      return Ok(());
    }
    let frames = samples.len() / self.channels as usize;
    if frames == 0 {
      return Ok(());
    }

    // Build an AudioBufferList pointing at `samples` (no copy —
    // AVAudioPCMBuffer reads directly from this memory, so
    // `samples` must outlive the PCM buffer). We use interleaved
    // PCM so there's one buffer holding all channels.
    let bytes = (frames * self.channels as usize * 4) as u32;
    let audio_buffer = AudioBuffer {
      mNumberChannels: self.channels,
      mDataByteSize: bytes,
      mData: samples.as_ptr() as *mut c_void,
    };
    // Second slot is unused but AudioBufferList has two per our
    // type definition; zero it.
    let buffer_list = AudioBufferList {
      mNumberBuffers: 1,
      mBuffers: [
        audio_buffer,
        AudioBuffer {
          mNumberChannels: 0,
          mDataByteSize: 0,
          mData: ptr::null_mut(),
        },
      ],
    };

    // Build the AVAudioPCMBuffer wrapping the buffer list.
    let pcm_buffer = unsafe { build_pcm_buffer(self.pcm_format, &buffer_list)? };

    // Write. The success path releases the buffer; so do the
    // error paths — we never leak it.
    let mut ns_error: *mut NSError = ptr::null_mut();
    let success: bool = unsafe {
      msg_send![self.file, writeFromBuffer: pcm_buffer, error: &mut ns_error]
    };
    unsafe { release(pcm_buffer) };

    if !success {
      return Err(CoreAudioError::WriteAVAudioFileFailed);
    }

    self.samples_written += frames as u64;
    Ok(())
  }

  pub fn samples_written(&self) -> u64 {
    self.samples_written
  }

  pub fn filepath(&self) -> &PathBuf {
    &self.filepath
  }

  /// Explicit close. AVAudioFile finalises the file in deinit so
  /// dropping also works, but an explicit close before inspecting
  /// the file (e.g. reading its size) is clearer.
  pub fn close(&mut self) {
    if !self.file.is_null() {
      unsafe { release(self.file) };
      self.file = ptr::null_mut();
    }
  }
}

impl Drop for M4aAacWriter {
  fn drop(&mut self) {
    unsafe {
      if !self.file.is_null() {
        release(self.file);
        self.file = ptr::null_mut();
      }
      if !self.pcm_format.is_null() {
        release(self.pcm_format);
        self.pcm_format = ptr::null_mut();
      }
    }
  }
}

// ================================================================
// Internal helpers — thin ObjC wrappers, kept `unsafe fn` so callers
// have to think about lifetimes and error paths.
// ================================================================

/// Construct an AVAudioFormat describing Float32 interleaved PCM at
/// the given sample rate and channel count. Returned pointer is +1
/// retained — caller must `release()` it.
unsafe fn build_pcm_format(
  sample_rate: u32,
  channels: u32,
) -> Result<*mut AnyObject, CoreAudioError> {
  let cls = AnyClass::get(c"AVAudioFormat").ok_or(CoreAudioError::AVAudioFormatClassNotFound)?;
  let obj: *mut AnyObject = unsafe { msg_send![cls, alloc] };
  if obj.is_null() {
    return Err(CoreAudioError::AllocAVAudioFormatFailed);
  }
  // initStandardFormatWithSampleRate:channels: creates a Float32
  // deinterleaved format by default — but we want interleaved
  // because our buffer list is interleaved. Use the
  // initWithCommonFormat:sampleRate:interleaved:channelLayout
  // overload which lets us pick interleaved explicitly.
  //
  // Simpler path: use initWithCommonFormat:sampleRate:channels:interleaved
  // — AVAudioFormat exposes this for 1-2 channel PCM without
  // needing an AVAudioChannelLayout.
  let sample_rate_f: f64 = f64::from(sample_rate);
  let obj: *mut AnyObject = unsafe {
    msg_send![
      obj,
      initWithCommonFormat: AV_AUDIO_COMMON_FORMAT_FLOAT32,
      sampleRate: sample_rate_f,
      channels: channels,
      interleaved: true
    ]
  };
  if obj.is_null() {
    return Err(CoreAudioError::InitAVAudioFormatFailed);
  }
  Ok(obj)
}

/// Construct an AVAudioPCMBuffer wrapping the given buffer list
/// (no-copy). Returned pointer is +1 retained — caller must
/// `release()` it after use.
unsafe fn build_pcm_buffer(
  format: *mut AnyObject,
  buffer_list: *const AudioBufferList,
) -> Result<*mut AnyObject, CoreAudioError> {
  let cls = AnyClass::get(c"AVAudioPCMBuffer")
    .ok_or(CoreAudioError::AVAudioPCMBufferClassNotFound)?;
  let obj: *mut AnyObject = unsafe { msg_send![cls, alloc] };
  if obj.is_null() {
    return Err(CoreAudioError::AllocAVAudioPCMBufferFailed);
  }

  // The deallocator closure runs when the PCM buffer is released.
  // We're not owning the memory `buffer_list` points to (it's on
  // the caller's stack), so the deallocator is a no-op. AVAudioPCMBuffer
  // still copies the AudioBufferList struct internally, so the
  // caller doesn't need to keep it alive after this call — but
  // `samples` (the pointer inside the buffer list) DOES need to
  // stay alive until the buffer is released. In our usage (see
  // M4aAacWriter::write_samples) the samples outlive the buffer.
  let deallocator = block2::RcBlock::new(
    |_bl: *const AudioBufferList| {},
  );

  let obj: *mut AnyObject = unsafe {
    msg_send![
      obj,
      initWithPCMFormat: format,
      bufferListNoCopy: buffer_list,
      deallocator: &*deallocator
    ]
  };
  if obj.is_null() {
    return Err(CoreAudioError::InitAVAudioPCMBufferFailed);
  }
  Ok(obj)
}

/// Call `-release` on an ObjC object. Decrements the retain count;
/// when it hits zero the object's deinit runs (for AVAudioFile, this
/// is where the file is finalised on disk).
unsafe fn release(obj: *mut AnyObject) {
  if !obj.is_null() {
    unsafe {
      let _: () = msg_send![obj, release];
    }
  }
}
