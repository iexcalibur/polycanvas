#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

spawnSync('yarn', ['r', 'polycanvas.ts', ...process.argv.slice(2)], {
  stdio: 'inherit',
});
