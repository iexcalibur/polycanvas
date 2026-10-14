//! Permission probe for the macOS System Audio Recording capability.
//!
//! Phase-7.6.x: extracted from the now-deleted `recording.rs` so the
//! permission flow keeps working after the audio-capture orchestrator
//! moved to Swift. This is the only audio-related napi export this
//! crate still hosts; everything else (capture, encoding, file
//! writing) is now handled by the Swift transcription server.

use napi::Result;
use napi_derive::napi;

/// Triggers the macOS "System Audio Recording" permission dialog by
/// creating (and immediately destroying) a temporary process tap.
/// Returns `true` if the permission was granted, `false` otherwise.
///
/// On non-macOS platforms returns `true` unconditionally — the
/// concept doesn't apply.
#[cfg(target_os = "macos")]
#[napi]
pub fn request_system_audio_permission() -> Result<bool> {
  use crate::macos::tap_audio::request_system_audio_permission_impl;
  request_system_audio_permission_impl()
}

#[cfg(not(target_os = "macos"))]
#[napi]
pub fn request_system_audio_permission() -> Result<bool> {
  Ok(true)
}
