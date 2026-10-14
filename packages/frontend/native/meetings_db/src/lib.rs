// Meetings storage backed by a per-user SQLite database. Replaces
// the previous JSON-file blob (`globalStateStorage` →
// `meetingHistory:v1` key) with a relational store, so we can:
//
// - List all meetings without rewriting a megabyte JSON every time
// - Filter / order by time, doc, duration
// - Add full-text search (FTS5) over transcripts as a follow-up
// - Avoid the read-write-rewrite race that JSON-file storage has
//   when two windows save concurrently
//
// Schema is intentionally simple — single `meetings` table with
// the same fields the React side already uses (mirrors
// `MeetingHistoryRecord` in the Electron `feature.ts`). Transcript
// segments are stored as a JSON blob inside one column rather than
// normalised into a `segments` table because:
//
// 1. Segments are always read/written as a unit (full transcript)
// 2. Per-segment indexed access isn't needed by the UI
// 3. Keeping it as JSON makes it trivial to add new segment fields
//    (speaker, confidence, etc.) without a schema migration
//
// When transcript-level search becomes a real need we'll add a
// virtual FTS5 table that mirrors the segments JSON; for now the
// table stays at v1.

use std::sync::Mutex;

use chrono::Utc;
use napi::bindgen_prelude::Result as NapiResult;
use napi_derive::napi;
use serde::{Deserialize, Serialize};
use sqlx::{
  Pool, Row,
  migrate::MigrateDatabase,
  sqlite::{Sqlite, SqliteConnectOptions, SqlitePoolOptions, SqliteRow},
};

const SCHEMA_V1: &str = r#"
CREATE TABLE IF NOT EXISTS meetings (
  id INTEGER PRIMARY KEY,
  doc_id TEXT NOT NULL,
  name TEXT NOT NULL,
  date TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  audio_filepath TEXT NOT NULL,
  system_audio_filepath TEXT,
  segments_json TEXT NOT NULL DEFAULT '[]',
  summary_text TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_meetings_doc_id ON meetings(doc_id);
CREATE INDEX IF NOT EXISTS idx_meetings_created_at ON meetings(created_at DESC);
"#;

/// Phase-8q migration: add `mic_audio_filepath` column for
/// triple-track recordings (mixed + mic-only + system-only). Older
/// single-track recordings get NULL, which is fine — the renderer
/// hides the per-stream playback buttons when the path is absent.
/// Idempotent — `ALTER TABLE ... ADD COLUMN` would fail on second
/// run, so we check `pragma_table_info` first.
const SCHEMA_V2_ADD_MIC_FILEPATH: &str =
  "ALTER TABLE meetings ADD COLUMN mic_audio_filepath TEXT";

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeetingSegment {
  pub time: String,
  pub text: String,
  pub speaker: Option<String>,
}

#[napi(object)]
#[derive(Debug, Clone)]
pub struct MeetingRow {
  pub id: i64,
  pub doc_id: String,
  pub name: String,
  pub date: String,
  pub duration_ms: i64,
  pub audio_filepath: String,
  /// Phase-8q: mic-only path for triple-track recordings.
  /// `None` for older single-track recordings.
  pub mic_audio_filepath: Option<String>,
  pub system_audio_filepath: Option<String>,
  /// Segments stored as a JSON-encoded array. Decoding is left to
  /// the caller — we keep it as a string at the NAPI boundary so
  /// large transcripts don't pay double serialisation across the
  /// JS/Rust bridge (Rust → string → JS → JSON.parse is faster than
  /// Rust → V8 array of objects for big lists).
  pub segments_json: String,
  pub summary_text: Option<String>,
  pub created_at: i64,
  pub updated_at: i64,
}

/// Insert/upsert payload from JS. Mirrors `MeetingRow` minus the
/// generated `created_at` / `updated_at` (we set those server-side
/// so JS can't accidentally backdate records).
#[napi(object)]
pub struct MeetingInput {
  pub id: i64,
  pub doc_id: String,
  pub name: String,
  pub date: String,
  pub duration_ms: i64,
  pub audio_filepath: String,
  /// Phase-8q: mic-only path. Optional — single-track recordings
  /// pass `None` and the column is stored NULL.
  pub mic_audio_filepath: Option<String>,
  pub system_audio_filepath: Option<String>,
  pub segments_json: String,
  pub summary_text: Option<String>,
}

/// SQLite-backed meeting history store.
///
/// **Why the pool is lazy.** We used to construct the
/// `Pool<Sqlite>` directly inside `#[napi(constructor)] new(path)`,
/// but napi-rs runs sync constructors on the V8 main thread, which
/// has no tokio runtime context. sqlx 0.8's
/// `SqlitePoolOptions::connect_lazy_with` spawns a background
/// pool-monitor task that requires `tokio::Handle::current()`, so
/// constructing the pool from the V8 thread aborted the process
/// with `panicked at sqlx-core/.../pool/inner.rs:529: this
/// functionality requires a Tokio context`.
///
/// The fix: defer pool creation to the async `connect()` method,
/// which napi-rs runs on its tokio worker thread pool. The
/// constructor becomes a no-op stash for the path; `connect()`
/// builds the real pool and stores it in the Mutex. All other
/// methods read the pool back via `pool()` and error out cleanly
/// if `connect()` was never called (rather than panicking).
///
/// `Pool<Sqlite>` is `Arc`-backed so cloning out of the Mutex is
/// cheap — each method gets its own `Pool` clone for the duration
/// of the call.
#[napi]
pub struct MeetingsStore {
  pool: Mutex<Option<Pool<Sqlite>>>,
}

#[napi]
impl MeetingsStore {
  /// No-op stash. The real pool is built inside `connect()`. The
  /// `path` argument is intentionally ignored at construction time
  /// (the connect() call carries the same path), kept on the
  /// signature for API compatibility with the JS wrapper.
  #[napi(constructor)]
  pub fn new(_path: String) -> Self {
    Self {
      pool: Mutex::new(None),
    }
  }

  /// Build the SQLite pool + run migrations. Must be called before
  /// any other method. Idempotent — safe to call multiple times;
  /// the previous pool gets replaced.
  #[napi]
  pub async fn connect(&self, path: String) -> NapiResult<()> {
    if !Sqlite::database_exists(&path).await.unwrap_or(false) {
      Sqlite::create_database(&path)
        .await
        .map_err(anyhow::Error::from)?;
    }

    let options = SqliteConnectOptions::new()
      .filename(&path)
      .foreign_keys(false)
      .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
      .create_if_missing(true);
    let pool = SqlitePoolOptions::new()
      .max_connections(4)
      .connect_lazy_with(options);

    let mut connection = pool.acquire().await.map_err(anyhow::Error::from)?;
    sqlx::query(SCHEMA_V1)
      .execute(connection.as_mut())
      .await
      .map_err(anyhow::Error::from)?;

    // Phase-8q migration: add mic_audio_filepath if absent.
    // pragma_table_info returns rows for each column; if our column
    // isn't there, run the ALTER. Idempotent on re-runs.
    let has_mic_column: bool = sqlx::query_scalar::<_, i64>(
      "SELECT COUNT(*) FROM pragma_table_info('meetings') WHERE name = 'mic_audio_filepath'",
    )
    .fetch_one(connection.as_mut())
    .await
    .map_err(anyhow::Error::from)?
      > 0;
    if !has_mic_column {
      sqlx::query(SCHEMA_V2_ADD_MIC_FILEPATH)
        .execute(connection.as_mut())
        .await
        .map_err(anyhow::Error::from)?;
    }
    drop(connection);

    *self
      .pool
      .lock()
      .map_err(|e| {
        napi::Error::new(
          napi::Status::GenericFailure,
          format!("MeetingsStore: pool mutex poisoned: {e}"),
        )
      })? = Some(pool);
    Ok(())
  }

  /// Get a Pool clone for use inside an async method. Errors if
  /// `connect()` hasn't been called — caller is responsible for
  /// calling connect() first.
  fn pool(&self) -> NapiResult<Pool<Sqlite>> {
    self
      .pool
      .lock()
      .map_err(|e| {
        napi::Error::new(
          napi::Status::GenericFailure,
          format!("MeetingsStore: pool mutex poisoned: {e}"),
        )
      })?
      .clone()
      .ok_or_else(|| {
        napi::Error::new(
          napi::Status::GenericFailure,
          "MeetingsStore: connect() must be called before any other method".to_string(),
        )
      })
  }

  /// Insert or replace a meeting row. The `id` is treated as the
  /// canonical primary key — calling `save_meeting` twice with the
  /// same id updates the existing row (typical flow: empty
  /// segments at End → re-save with full transcript after Transcribe).
  #[napi]
  pub async fn save_meeting(&self, input: MeetingInput) -> NapiResult<()> {
    let pool = self.pool()?;
    let now = Utc::now().timestamp_millis();
    sqlx::query(
      "INSERT INTO meetings (id, doc_id, name, date, duration_ms, audio_filepath, mic_audio_filepath, system_audio_filepath, segments_json, summary_text, created_at, updated_at) \
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) \
       ON CONFLICT(id) DO UPDATE SET \
         doc_id = excluded.doc_id, \
         name = excluded.name, \
         date = excluded.date, \
         duration_ms = excluded.duration_ms, \
         audio_filepath = excluded.audio_filepath, \
         mic_audio_filepath = excluded.mic_audio_filepath, \
         system_audio_filepath = excluded.system_audio_filepath, \
         segments_json = excluded.segments_json, \
         summary_text = excluded.summary_text, \
         updated_at = excluded.updated_at",
    )
    .bind(input.id)
    .bind(&input.doc_id)
    .bind(&input.name)
    .bind(&input.date)
    .bind(input.duration_ms)
    .bind(&input.audio_filepath)
    .bind(input.mic_audio_filepath.as_deref())
    .bind(input.system_audio_filepath.as_deref())
    .bind(&input.segments_json)
    .bind(input.summary_text.as_deref())
    .bind(now)
    .bind(now)
    .execute(&pool)
    .await
    .map_err(anyhow::Error::from)?;
    Ok(())
  }

  /// Return all meetings for a given doc, newest-first. Empty list
  /// if none — never errors on missing rows.
  #[napi]
  pub async fn list_for_doc(&self, doc_id: String) -> NapiResult<Vec<MeetingRow>> {
    let pool = self.pool()?;
    let rows = sqlx::query(
      "SELECT * FROM meetings WHERE doc_id = ? ORDER BY created_at DESC",
    )
    .bind(&doc_id)
    .fetch_all(&pool)
    .await
    .map_err(anyhow::Error::from)?;
    Ok(rows.into_iter().map(row_to_meeting).collect())
  }

  /// Return all meetings across all docs, newest-first. Used by a
  /// future "all meetings" view (search, calendar, cross-doc
  /// browsing). Already supported by the index on `created_at`.
  #[napi]
  pub async fn list_all(&self, limit: Option<i64>) -> NapiResult<Vec<MeetingRow>> {
    let pool = self.pool()?;
    let limit = limit.unwrap_or(500);
    let rows = sqlx::query("SELECT * FROM meetings ORDER BY created_at DESC LIMIT ?")
      .bind(limit)
      .fetch_all(&pool)
      .await
      .map_err(anyhow::Error::from)?;
    Ok(rows.into_iter().map(row_to_meeting).collect())
  }

  /// Return a single meeting by id, or None if not found.
  #[napi]
  pub async fn get(&self, id: i64) -> NapiResult<Option<MeetingRow>> {
    let pool = self.pool()?;
    let row = sqlx::query("SELECT * FROM meetings WHERE id = ?")
      .bind(id)
      .fetch_optional(&pool)
      .await
      .map_err(anyhow::Error::from)?;
    Ok(row.map(row_to_meeting))
  }

  /// Delete a single meeting by id. Idempotent — succeeds even if
  /// the row doesn't exist (returns 0 rows affected).
  #[napi]
  pub async fn delete(&self, id: i64) -> NapiResult<()> {
    let pool = self.pool()?;
    sqlx::query("DELETE FROM meetings WHERE id = ?")
      .bind(id)
      .execute(&pool)
      .await
      .map_err(anyhow::Error::from)?;
    Ok(())
  }

  /// Delete every meeting for a given doc. Used when the doc itself
  /// is deleted — no orphan meeting records left behind.
  #[napi]
  pub async fn delete_for_doc(&self, doc_id: String) -> NapiResult<u32> {
    let pool = self.pool()?;
    let result = sqlx::query("DELETE FROM meetings WHERE doc_id = ?")
      .bind(&doc_id)
      .execute(&pool)
      .await
      .map_err(anyhow::Error::from)?;
    Ok(result.rows_affected() as u32)
  }

  /// Total number of meetings stored. Cheap (uses the index).
  #[napi]
  pub async fn count(&self) -> NapiResult<i64> {
    let pool = self.pool()?;
    let row = sqlx::query("SELECT COUNT(*) AS c FROM meetings")
      .fetch_one(&pool)
      .await
      .map_err(anyhow::Error::from)?;
    let count: i64 = row.get("c");
    Ok(count)
  }
}

fn row_to_meeting(row: SqliteRow) -> MeetingRow {
  MeetingRow {
    id: row.get("id"),
    doc_id: row.get("doc_id"),
    name: row.get("name"),
    date: row.get("date"),
    duration_ms: row.get("duration_ms"),
    audio_filepath: row.get("audio_filepath"),
    // try_get tolerates NULL columns (older single-track recordings)
    // and absent columns (databases predating Phase-8q migration).
    mic_audio_filepath: row.try_get("mic_audio_filepath").ok(),
    system_audio_filepath: row.try_get("system_audio_filepath").ok(),
    segments_json: row.get("segments_json"),
    summary_text: row.try_get("summary_text").ok(),
    created_at: row.get("created_at"),
    updated_at: row.get("updated_at"),
  }
}
