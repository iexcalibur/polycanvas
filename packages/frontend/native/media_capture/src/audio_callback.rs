use std::sync::{
  Arc,
  atomic::{AtomicU64, Ordering},
};

use crossbeam_channel::{Sender, TrySendError};
use napi::{
  bindgen_prelude::Float32Array,
  threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode},
};

/// Internal callback abstraction so audio taps can target JS or native
/// pipelines.
///
/// `Channel` is single-stream — a single Vec<f32> per IO callback
/// invocation. Used for mic-only or pre-mixed capture.
///
/// `DualChannel` carries separate senders for the mic and system
/// streams. The IO callback splits the 2-buffer aggregate-device
/// callback into mic samples and system samples (via
/// `InputAndOutputAudioBufferList::extract_separated`) and pushes
/// each to its own worker thread. This is what makes per-stream
/// transcription with proper "You" / "Speaker" attribution
/// possible — if the streams are mixed before the encoder, the
/// discriminator is gone.
///
/// `TripleChannel` extends `DualChannel` with a third sender for
/// the mixed (mic + system) stream. Lets callers consume all three
/// outputs simultaneously: per-stream transcription via
/// `mic_sender`/`sys_sender`, and a single playback-friendly mixed
/// file via `mixed_sender`. The IO callback computes the mix once
/// (using the same SIMD-accelerated `mix_audio_samples` path that
/// `mix_input_and_output` uses) and fans out to all three channels.
#[derive(Clone)]
pub enum AudioCallback {
  Js(Arc<ThreadsafeFunction<Float32Array, ()>>),
  Channel {
    sender: Sender<Vec<f32>>,
    overflow_count: Arc<AtomicU64>,
  },
  DualChannel {
    mic_sender: Sender<Vec<f32>>,
    sys_sender: Sender<Vec<f32>>,
    overflow_count: Arc<AtomicU64>,
  },
  TripleChannel {
    mic_sender: Sender<Vec<f32>>,
    sys_sender: Sender<Vec<f32>>,
    mixed_sender: Sender<Vec<f32>>,
    overflow_count: Arc<AtomicU64>,
  },
}

impl AudioCallback {
  /// True when this callback expects mic + system as separate streams
  /// (i.e. the IO callback should call `call_dual` instead of `call`).
  pub fn is_dual_stream(&self) -> bool {
    matches!(self, Self::DualChannel { .. })
  }

  /// True when this callback expects mic + system + mixed as three
  /// separate streams (IO callback should call `call_triple`).
  pub fn is_triple_stream(&self) -> bool {
    matches!(self, Self::TripleChannel { .. })
  }

  pub fn call(&self, samples: Vec<f32>) {
    match self {
      Self::Js(func) => {
        // Non-blocking call into JS; errors are ignored to avoid blocking the
        // audio thread.
        let _ = func.call(Ok(samples.into()), ThreadsafeFunctionCallMode::NonBlocking);
      }
      Self::Channel { sender, overflow_count } => match sender.try_send(samples) {
        Ok(()) => {}
        Err(TrySendError::Full(_)) => {
          overflow_count.fetch_add(1, Ordering::Relaxed);
        }
        Err(TrySendError::Disconnected(_)) => {}
      },
      Self::DualChannel { .. } => {
        // Programmer error — `DualChannel` requires `call_dual`. We
        // log via overflow_count and drop the sample rather than
        // panic on the audio thread.
        if let Self::DualChannel { overflow_count, .. } = self {
          overflow_count.fetch_add(1, Ordering::Relaxed);
        }
      }
      Self::TripleChannel { .. } => {
        // Programmer error — `TripleChannel` requires `call_triple`.
        if let Self::TripleChannel { overflow_count, .. } = self {
          overflow_count.fetch_add(1, Ordering::Relaxed);
        }
      }
    }
  }

  /// Push mic and system samples into their respective workers in
  /// one IO-callback tick. Use only with `DualChannel`. For `Channel`
  /// or `Js` this falls back to merging both streams into the single
  /// channel — keeps backwards compatibility for the legacy single-
  /// stream call sites that don't know about dual-stream yet.
  pub fn call_dual(&self, mic: Vec<f32>, sys: Vec<f32>) {
    match self {
      Self::DualChannel {
        mic_sender,
        sys_sender,
        overflow_count,
      } => {
        match mic_sender.try_send(mic) {
          Ok(()) => {}
          Err(TrySendError::Full(_)) => {
            overflow_count.fetch_add(1, Ordering::Relaxed);
          }
          Err(TrySendError::Disconnected(_)) => {}
        }
        match sys_sender.try_send(sys) {
          Ok(()) => {}
          Err(TrySendError::Full(_)) => {
            overflow_count.fetch_add(1, Ordering::Relaxed);
          }
          Err(TrySendError::Disconnected(_)) => {}
        }
      }
      _ => {
        // Single-channel fallback — only the mic samples are
        // forwarded since that's the more meaningful stream. This
        // path is only reached if a caller passes a non-DualChannel
        // callback into a dual-stream IO loop, which is a config
        // bug; we log nothing and drop the system samples to keep
        // the audio thread non-blocking.
        let _ = sys;
        self.call(mic);
      }
    }
  }

  /// Push mic, system, and pre-computed mix samples into their three
  /// respective workers in one IO-callback tick. Use only with
  /// `TripleChannel`. The caller is expected to have already mixed
  /// `mic` and `sys` into `mixed` (the IO callback in `tap_audio.rs`
  /// uses `mix_audio_samples` for this — same path that
  /// `mix_input_and_output` uses internally) so the audio thread
  /// stays non-blocking and the mix is bit-identical to what the
  /// legacy single-stream mixed path would have written.
  pub fn call_triple(&self, mic: Vec<f32>, sys: Vec<f32>, mixed: Vec<f32>) {
    match self {
      Self::TripleChannel {
        mic_sender,
        sys_sender,
        mixed_sender,
        overflow_count,
      } => {
        for (sender, payload) in [
          (mic_sender, mic),
          (sys_sender, sys),
          (mixed_sender, mixed),
        ] {
          match sender.try_send(payload) {
            Ok(()) => {}
            Err(TrySendError::Full(_)) => {
              overflow_count.fetch_add(1, Ordering::Relaxed);
            }
            Err(TrySendError::Disconnected(_)) => {}
          }
        }
      }
      _ => {
        // Config bug — caller wired a non-triple callback into the
        // triple-stream path. Drop sys + mixed; forward mic via the
        // single-channel path so we don't lose primary signal.
        let _ = sys;
        let _ = mixed;
        self.call(mic);
      }
    }
  }
}

#[cfg(test)]
mod tests {
  use std::sync::atomic::Ordering;

  use crossbeam_channel::bounded;

  use super::AudioCallback;

  #[test]
  fn channel_overflow_only_increments_the_counter() {
    let (sender, _rx) = bounded(1);
    let overflow_count = std::sync::Arc::new(std::sync::atomic::AtomicU64::new(0));
    let callback = AudioCallback::Channel {
      sender: sender.clone(),
      overflow_count: overflow_count.clone(),
    };

    sender.send(vec![0.0]).unwrap();
    callback.call(vec![1.0]);
    callback.call(vec![2.0]);

    assert_eq!(overflow_count.load(Ordering::Relaxed), 2);
  }
}
