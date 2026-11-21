// Render the staged screenshot scenes from shots.json in headless Chromium
// and save them under screenshots/. Each shot waits for window.__shotReady,
// then captures a 1280x720 JPEG and retries at lower quality until it fits
// the 256 KiB cap.
//
//   node tools/shots.mjs

import { spawn } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import {
  launchChrome, makeClient, waitFor, screenshot, closeChrome,
} from './cdp.mjs';

const repo = fileURLToPath(new URL('..', import.meta.url));
const PORT = 8124;
const shots = JSON.parse(readFileSync(join(repo, 'shots.json'), 'utf8'));

const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: repo, stdio: 'ignore' });
// Wait until the server actually answers before Chrome navigates to it.
for (let i = 0; i < 40; i += 1) {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/`);
    if (res.ok) break;
  } catch {
    // Not up yet.
  }
  await new Promise((r) => setTimeout(r, 250));
}

let failed = false;
for (const shot of shots) {
  let session;
  try {
    session = await launchChrome(9224, `http://127.0.0.1:${PORT}/${shot.query}`);
    const client = session.client;
    await client.send('Runtime.enable');
    await client.send('Page.enable');
    await waitFor(client, `window.__shotReady === true`, 20000);
    const path = join(repo, 'screenshots', shot.name);
    let quality = 85;
    for (;;) {
      await screenshot(client, path, quality);
      const size = statSync(path).size;
      console.log(`${shot.name}: ${size} bytes at quality ${quality}`);
      if (size <= 262144 || quality <= 40) break;
      quality -= 15;
    }
    if (client.consoleErrors.length || client.pageErrors.length) {
      console.log(`  WARNING console/page errors on ${shot.name}: ${[...client.consoleErrors, ...client.pageErrors].join(' | ')}`);
      failed = true;
    }
  } catch (error) {
    console.log(`FAILED ${shot.name}: ${error.message}`);
    failed = true;
  } finally {
    if (session) await closeChrome(session);
  }
}
server.kill();
process.exit(failed ? 1 : 0);
