#[cfg(target_os = "macos")]
pub mod macos;
#[cfg(target_os = "macos")]
pub(crate) use macos::*;

#[cfg(target_os = "windows")]
pub mod windows;
#[cfg(target_os = "windows")]
pub use windows::*;

// Phase-8p revert: re-expose the recording.rs napi surface.
// Phase 7.6 moved audio capture to Swift; the spawned-child-process
// context broke CoreAudio process-tap IO callbacks (raw IO callbacks=0
// across 11 different aggregate configurations). Reverting to the
// 0.26.9x architecture where Rust (in-process with Electron) owns
// audio capture is the proven working path.
pub mod audio_callback;
pub mod audio_permission;
pub mod recording;
