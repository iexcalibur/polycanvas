import { type ChildProcess, spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';

import { app } from 'electron';

import { beforeAppQuit } from '../cleanup';
import { logger } from '../logger';

// Kill the server when the app quits
beforeAppQuit(() => {
  stopTranscriptionServer();
});

const SERVER_PORT = 9111;
const HEALTH_POLL_INTERVAL = 500;
const HEALTH_TIMEOUT = 120_000; // 2 min — first run downloads ~460MB small model

let serverProcess: ChildProcess | null = null;
let serverReady = false;

function getServerBinaryPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'transcription-server');
  }
  return path.join(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    '..',
    '..',
    '..',
    'packages',
    'frontend',
    'native',
    'transcription-server',
    '.build',
    'release',
    'transcription-server'
  );
}

export async function ensureTranscriptionServer(): Promise<void> {
  if (serverReady && serverProcess && !serverProcess.killed) {
    return;
  }

  if (serverProcess && !serverProcess.killed) {
    // Process running but not ready — wait for health
    await waitForHealth();
    return;
  }

  const binaryPath = getServerBinaryPath();
  logger.info('Starting transcription server', { binaryPath, port: SERVER_PORT });

  serverProcess = spawn(binaryPath, [String(SERVER_PORT)], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProcess.stdout?.on('data', (data: Buffer) => {
    logger.info('[transcription-server]', data.toString().trim());
  });

  serverProcess.stderr?.on('data', (data: Buffer) => {
    logger.info('[transcription-server]', data.toString().trim());
  });

  serverProcess.on('exit', (code, signal) => {
    logger.info('Transcription server exited', { code, signal });
    serverProcess = null;
    serverReady = false;
  });

  serverProcess.on('error', err => {
    logger.error('Transcription server spawn error', err);
    serverProcess = null;
    serverReady = false;
  });

  await waitForHealth();
}

async function waitForHealth(): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < HEALTH_TIMEOUT) {
    try {
      const res = await callServer('GET', '/health');
      if (res.status === 'ok') {
        serverReady = true;
        logger.info('Transcription server ready');
        return;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise(r => setTimeout(r, HEALTH_POLL_INTERVAL));
  }

  throw new Error(
    'Transcription server failed to start within timeout. ' +
      'First run may need to download the WhisperKit model (~460MB).'
  );
}

// Phase-8s: long-running calls (post-stop transcribe) regularly run
// 5–15 minutes for big meetings, and our Swift HTTP server only flushes
// the response (header + body together) AFTER transcription completes
// — there is nothing on the wire in the meantime. Node's `fetch`
// (undici) caps `headersTimeout` at 300_000 (5 min) and we cannot
// disable that without adding the `undici` package to ship the
// `Agent` dispatcher.
//
// Switching to `node:http` sidesteps the issue: it has no built-in
// idle/headers timeout, so the only deadline is the one the caller
// passes via `timeoutMs` (enforced via `req.destroy()`). On a 40-min
// meeting we previously saw `TypeError: fetch failed` even though
// server-side logs read `transcribeFile complete` — that's gone with
// http.request.
export async function callServer(
  method: string,
  endpoint: string,
  body?: Record<string, unknown>,
  timeoutMs = 5000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (payload) {
      headers['Content-Length'] = String(Buffer.byteLength(payload));
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: SERVER_PORT,
        path: endpoint,
        method,
        headers,
      },
      res => {
        const chunks: Buffer[] = [];
        res.on('data', chunk => chunks.push(chunk as Buffer));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          try {
            resolve(JSON.parse(text));
          } catch {
            resolve({ raw: text });
          }
        });
        res.on('error', err => reject(err));
      }
    );

    // Caller-provided upper bound. We don't set the agent's own
    // socket timeout — too many false positives when Swift is
    // mid-transcribe and just hasn't started writing yet — but a
    // single explicit deadline is honoured.
    const timer = setTimeout(() => {
      req.destroy(new Error(`callServer ${method} ${endpoint} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    req.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });
    req.on('close', () => {
      clearTimeout(timer);
    });

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

export function stopTranscriptionServer(): void {
  if (serverProcess && !serverProcess.killed) {
    logger.info('Stopping transcription server');
    serverProcess.kill('SIGTERM');
    serverProcess = null;
    serverReady = false;
  }
}

export function isServerRunning(): boolean {
  return serverReady && !!serverProcess && !serverProcess.killed;
}
