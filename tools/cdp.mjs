// A minimal Chrome DevTools Protocol driver on Node's built-in WebSocket:
// launch headless Chromium, open a page, evaluate JavaScript in it, send
// keys and mouse events, collect console errors, and take screenshots.
// No dependencies beyond the Node standard library.

import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium-1255/chrome-linux/chrome`;

export async function launchChrome(port, url) {
  const args = [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--mute-audio',
    '--no-proxy-server',
    '--autoplay-policy=no-user-gesture-required',
    `--remote-debugging-port=${port}`,
    '--window-size=1280,720',
    '--hide-scrollbars',
    `--user-data-dir=/tmp/chrome-profile-${port}`,
    'about:blank',
  ];
  const chrome = spawn(CHROME, args, { stdio: 'ignore' });
  // Wait for the DevTools HTTP endpoint to answer with a page target.
  let target = null;
  for (let i = 0; i < 60; i += 1) {
    await new Promise((r) => setTimeout(r, 250));
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await res.json();
      target = list.find((t) => t.type === 'page');
      if (target) break;
    } catch {
      // Not up yet.
    }
  }
  if (!target) {
    chrome.kill();
    throw new Error('Chrome DevTools endpoint never came up');
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  // Navigate through the protocol, not the command line: a URL passed on
  // the command line races session restore in this sandbox and can land on
  // an error page even when the server is up.
  const client = makeClient(ws);
  await client.send('Page.enable');
  // Pin a true 1280x720 viewport: --window-size alone leaves this headless
  // build with a 1280x520 viewport, which would crop the game's HUD.
  await client.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await client.send('Page.navigate', { url });
  for (let i = 0; i < 60; i += 1) {
    await new Promise((r) => setTimeout(r, 250));
    try {
      const state = await evaluate(client, `document.readyState`);
      if (state === 'complete') break;
    } catch {
      // Not ready yet.
    }
  }
  return { chrome, ws, target, client };
}

export function makeClient(ws) {
  let nextId = 1;
  const pending = new Map();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    } else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      consoleErrors.push(message.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    } else if (message.method === 'Runtime.exceptionThrown') {
      pageErrors.push(message.params.exceptionDetails?.exception?.description ?? message.params.exceptionDetails?.text ?? 'exception');
    } else if (message.method === 'Network.loadingFailed') {
      failedRequests.push(message.params.errorText ?? 'loading failed');
    }
  };
  function send(method, params = {}) {
    const id = nextId;
    nextId += 1;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }
  return { send, consoleErrors, pageErrors, failedRequests };
}

export async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(`evaluate failed: ${result.exceptionDetails.exception?.description ?? result.exceptionDetails.text}`);
  }
  return result.result.value;
}

export async function waitFor(client, expression, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const value = await evaluate(client, expression);
      if (value) return value;
    } catch {
      // Page not ready yet.
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`timed out waiting for: ${expression}`);
}

export async function key(client, code, keyName, type) {
  await client.send('Input.dispatchKeyEvent', {
    type,
    code,
    key: keyName,
    windowsVirtualKeyCode: keyCodeFor(code),
  });
}

export async function tapKey(client, code, keyName, holdMs = 80) {
  await key(client, code, keyName, 'keyDown');
  await new Promise((r) => setTimeout(r, holdMs));
  await key(client, code, keyName, 'keyUp');
}

export async function holdKey(client, code, keyName, holdMs) {
  await key(client, code, keyName, 'keyDown');
  await new Promise((r) => setTimeout(r, holdMs));
  await key(client, code, keyName, 'keyUp');
}

function keyCodeFor(code) {
  const map = {
    KeyW: 87, KeyA: 65, KeyS: 83, KeyD: 68, KeyE: 69, KeyF: 70,
    KeyP: 80, KeyM: 77, KeyH: 72, Enter: 13, Space: 32, Escape: 27,
    ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, ShiftLeft: 16,
  };
  return map[code] ?? 0;
}

export async function screenshot(client, path, quality = 80) {
  const result = await client.send('Page.captureScreenshot', { format: 'jpeg', quality });
  writeFileSync(path, Buffer.from(result.data, 'base64'));
}

export async function closeChrome(session) {
  try {
    session.ws.close();
  } catch {
    // Already closed.
  }
  session.chrome.kill();
}
