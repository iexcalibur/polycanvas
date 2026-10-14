// SQLite-backed meeting history store. Replaces the previous
// JSON-file-on-disk approach (`globalStateStorage` →
// `meetingHistory:v1` key) with a real relational table so we can
// add cross-doc browsing, search, and analytics later without
// rewriting megabyte JSON every save.
//
// API surface deliberately mirrors the previous `feature.ts`
// helpers (saveMeetingToHistory / getMeetingHistoryFromStorage /
// deleteMeetingFromHistory / deleteMeetingsForDoc) so callers
// don't change. The first-run migration in `ensureStore()` walks
// any existing JSON-file history into SQLite once, then leaves
// the JSON in place as a backup until the user has confirmed
// nothing went wrong (we don't delete it; users can clean up by
// hand if they want).

import path from 'node:path';

import type { MeetingsStore as NativeMeetingsStore } from '@polycanvas/native';
import { app } from 'electron';

import { logger } from '../logger';
import { globalStateStorage } from '../shared-storage/storage';

const MEETING_HISTORY_KEY = 'meetingHistory:v1';
const MIGRATION_FLAG_KEY = 'meetingHistory:sqliteMigratedAt';
const DB_FILENAME = 'meetings.db';

/**
 * Public meeting record shape — kept in sync with the existing
 * `MeetingHistoryRecord` interface in `feature.ts`. Segments live
 * in the JSON column (`segments_json` in SQLite); we
 * serialise/deserialise at this boundary so callers see them as
 * normal arrays.
 */
export interface MeetingHistoryRecord {
  id: number;
  docId: string;
  name: string;
  date: string;
  durationMs: number;
  /** Phase-8q: pre-mixed mic+system playback file. */
  audioFilePath: string;
  /** Phase-8q: mic-only path for transcription "You" stream. */
  micAudioFilePath?: string;
  /** System-only path for transcription "Speaker" stream. */
  systemAudioFilePath?: string;
  segments: { time: string; text: string; speaker?: string }[];
  createdAt: number;
}

let storeSingleton: NativeMeetingsStore | null = null;
let connectPromise: Promise<NativeMeetingsStore> | null = null;

/**
 * Lazily open + connect the SQLite store. Memoised — subsequent
 * calls return the same instance. Called by every public helper
 * below so callers never have to think about lifecycle.
 */
async function ensureStore(): Promise<NativeMeetingsStore> {
  if (storeSingleton) return storeSingleton;
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    const { MeetingsStore } = await import('@polycanvas/native');
    const dbPath = path.join(app.getPath('userData'), DB_FILENAME);
    const store = new MeetingsStore(dbPath);
    await store.connect(dbPath);
    logger.info('Meetings SQLite store connected', { path: dbPath });

    await migrateFromJsonIfNeeded(store);

    storeSingleton = store;
    return store;
  })();

  return connectPromise;
}

/**
 * One-time migration from the old JSON-blob history into SQLite.
 * Idempotent — uses a flag in `globalStateStorage` to skip on
 * subsequent runs. The original JSON file is left in place so a
 * user who hits a migration bug can roll back manually.
 */
async function migrateFromJsonIfNeeded(
  store: NativeMeetingsStore
): Promise<void> {
  const migratedAt = globalStateStorage.get<number>(MIGRATION_FLAG_KEY);
  const legacy = globalStateStorage.get<{ meetings: MeetingHistoryRecord[] }>(
    MEETING_HISTORY_KEY
  );
  const legacyCount = legacy?.meetings?.length ?? 0;

  if (migratedAt) {
    // Phase-8m recovery path. The original migration in builds <
    // 0.27.24 silently dropped every record because we passed
    // `null` for `systemAudioFilepath` / `summaryText`, but
    // napi-rs's auto-conversion rejects `null` for `Option<String>`
    // (only `undefined` maps to `None`). Every saveMeeting threw
    // "Failed to convert JavaScript value `Null` into rust type
    // `String`" and got swallowed by the per-record try/catch —
    // the migration loop logged "complete" with imported=0, the
    // flag flipped, and the user's history was permanently empty
    // until they noticed.
    //
    // Detect that exact corner: flag set, SQLite empty, but
    // legacy JSON still has rows. Force a re-migration in that
    // case (saveMeeting is INSERT-OR-REPLACE, so re-running on a
    // populated DB is a no-op).
    if (legacyCount === 0) return;
    let sqliteCount = 0;
    try {
      sqliteCount = await store.count();
    } catch {
      // count() shouldn't fail on a connected store; if it does,
      // err on the side of attempting migration.
    }
    if (sqliteCount > 0) return;
    logger.info(
      'Meetings migration flag set but SQLite is empty and legacy JSON has rows — retrying migration',
      { legacyCount }
    );
  }

  if (legacyCount === 0) {
    // Fresh install — nothing to migrate. Still flip the flag so we
    // don't keep checking.
    globalStateStorage.set(MIGRATION_FLAG_KEY, Date.now());
    return;
  }

  logger.info('Migrating meeting history JSON → SQLite', { count: legacyCount });
  let imported = 0;
  let failed = 0;
  for (const record of legacy!.meetings) {
    try {
      // Phase-8m: pass `undefined` (not `null`) for the optional
      // string columns. napi-rs maps undefined → Rust None, but
      // null trips the strict-conversion check on Option<String>.
      // Same fix in `saveMeetingToStore` below.
      await store.saveMeeting({
        id: record.id,
        docId: record.docId,
        name: record.name,
        date: record.date,
        durationMs: record.durationMs,
        audioFilepath: record.audioFilePath,
        micAudioFilepath: record.micAudioFilePath ?? undefined,
        systemAudioFilepath: record.systemAudioFilePath ?? undefined,
        segmentsJson: JSON.stringify(record.segments ?? []),
        summaryText: undefined,
      });
      imported += 1;
    } catch (err) {
      failed += 1;
      logger.warn('Failed to migrate meeting record', {
        id: record.id,
        err,
      });
    }
  }
  logger.info('Meeting history migration complete', { imported, failed });
  globalStateStorage.set(MIGRATION_FLAG_KEY, Date.now());
}

/**
 * Insert or update a meeting. Same upsert semantics as the old
 * `saveMeetingToHistory` — calling twice with the same id replaces
 * the existing row, matching the Transcribe-then-update flow where
 * we save an empty-segments record at End and re-save the populated
 * one after Transcribe.
 */
export async function saveMeetingToStore(
  record: MeetingHistoryRecord
): Promise<void> {
  const store = await ensureStore();
  // Phase-8m: optional fields use `undefined`, not `null`. napi-rs
  // rejects `null` when bridging into `Option<String>` — passing it
  // throws "Failed to convert JavaScript value `Null` into rust type
  // `String`", and the upstream `console.warn` swallow made every
  // save look successful while writing nothing to disk. See the
  // matching comment in `migrateFromJsonIfNeeded` above.
  await store.saveMeeting({
    id: record.id,
    docId: record.docId,
    name: record.name,
    date: record.date,
    durationMs: record.durationMs,
    audioFilepath: record.audioFilePath,
    micAudioFilepath: record.micAudioFilePath ?? undefined,
    systemAudioFilepath: record.systemAudioFilePath ?? undefined,
    segmentsJson: JSON.stringify(record.segments ?? []),
    summaryText: undefined,
  });
}

/**
 * List meetings, newest-first. With `docId`, filters to a single
 * doc (current behaviour). Without, returns every meeting across
 * docs (new capability — used by future "all meetings" view).
 */
export async function listMeetingsFromStore(
  docId?: string
): Promise<MeetingHistoryRecord[]> {
  const store = await ensureStore();
  const rows = docId ? await store.listForDoc(docId) : await store.listAll(500);
  return rows.map(rowToRecord);
}

export async function deleteMeetingFromStore(id: number): Promise<void> {
  const store = await ensureStore();
  await store.delete(id);
}

export async function deleteMeetingsForDocFromStore(
  docId: string
): Promise<number> {
  const store = await ensureStore();
  const count = await store.deleteForDoc(docId);
  return count;
}

function rowToRecord(row: {
  id: number;
  docId: string;
  name: string;
  date: string;
  durationMs: number;
  audioFilepath: string;
  micAudioFilepath?: string | null;
  systemAudioFilepath?: string | null;
  segmentsJson: string;
  createdAt: number;
}): MeetingHistoryRecord {
  let segments: MeetingHistoryRecord['segments'] = [];
  try {
    const parsed = JSON.parse(row.segmentsJson);
    if (Array.isArray(parsed)) {
      segments = parsed;
    }
  } catch {
    // Corrupted JSON in DB — log and return empty segments rather
    // than crashing the whole list. Caller still gets the row.
    logger.warn('Corrupted segments_json in meetings table', { id: row.id });
  }
  return {
    id: row.id,
    docId: row.docId,
    name: row.name,
    date: row.date,
    durationMs: row.durationMs,
    audioFilePath: row.audioFilepath,
    micAudioFilePath: row.micAudioFilepath ?? undefined,
    systemAudioFilePath: row.systemAudioFilepath ?? undefined,
    segments,
    createdAt: row.createdAt,
  };
}
