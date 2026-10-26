const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');

test('real HTTP voice stream sends playable opening audio before completion, retains auth and legacy playback',
  { skip: !process.env.VOICE_TEST_PYTHON, timeout: 120000 }, async t => {
  const socket = net.createServer();
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const app = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), APP_PASSWORD: 'local-integration-fixture', VOICE_PYTHON: process.env.VOICE_TEST_PYTHON },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  t.after(() => app.kill());
  await new Promise((resolve, reject) => {
    app.stdout.on('data', data => { if (data.toString().includes('Travel Storyteller is running')) resolve(); });
    app.on('error', reject); app.on('exit', code => reject(Error('Server exited: ' + code)));
  });
  const base = `http://127.0.0.1:${port}`;
  const headers = { Authorization: 'Basic ' + Buffer.from('traveller:local-integration-fixture').toString('base64'), 'Content-Type': 'application/json' };
  assert.equal((await fetch(base + '/speech-stream', { method: 'POST' })).status, 401);
  assert.equal((await fetch(base + '/narration-player.js')).status, 401);
  assert.equal((await fetch(base + '/narration-player.js', { headers })).status, 200);
  const bad = await fetch(base + '/speech-stream', { method: 'POST', headers, body: JSON.stringify({ text: 'x'.repeat(1801) }) });
  assert.equal(bad.status, 400);
  const text = 'Welcome to Buxton. The Crescent stands at the heart of this Derbyshire spa town. Its elegant Georgian buildings reflect a time when visitors came to take the waters. Today, the surrounding streets offer reminders of that history. Look up at the stone facades and imagine the carriages arriving, bringing travellers to the town for rest and conversation.';
  const started = performance.now();
  const response = await fetch(base + '/speech-stream', { method: 'POST', headers, body: JSON.stringify({ text }) });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /ndjson/);
  let pending = '', firstMs, count = 0, done = false;
  const decoder = new TextDecoder();
  for await (const chunk of response.body) {
    pending += decoder.decode(chunk, { stream: true });
    let end;
    while ((end = pending.indexOf('\n')) >= 0) {
      const data = JSON.parse(pending.slice(0, end)); pending = pending.slice(end + 1);
      assert.equal(data.error, undefined);
      if (data.done) { done = true; continue; }
      firstMs ??= performance.now() - started;
      const audio = Buffer.from(data.wav, 'base64');
      assert.equal(audio.toString('ascii', 0, 4), 'RIFF');
      assert.equal(audio.toString('ascii', 8, 12), 'WAVE');
      assert.equal(audio.readUInt32LE(4) + 8, audio.length);
      assert.ok(audio.length > 44);
      count++;
    }
  }
  const totalMs = performance.now() - started;
  assert.ok(done); assert.ok(count > 1); assert.ok(firstMs < totalMs);
  t.diagnostic(JSON.stringify({ first_audio_ms: Math.round(firstMs), full_audio_ms: Math.round(totalMs), sections: count }));
  const cached = performance.now();
  const repeated = await fetch(base + '/speech-stream', { method: 'POST', headers, body: JSON.stringify({ text }) });
  assert.match(await repeated.text(), /"done":true/);
  t.diagnostic('Cached complete stream: ' + Math.round(performance.now() - cached) + 'ms');
  const legacy = await fetch(base + '/speech', { method: 'POST', headers, body: JSON.stringify({ text: 'Hello Mike.' }) });
  assert.equal(legacy.status, 200);
  assert.equal(Buffer.from(await legacy.arrayBuffer()).toString('ascii', 0, 4), 'RIFF');
  const cancel = new AbortController();
  const interrupted = await fetch(base + '/speech-stream', { method: 'POST', headers,
    body: JSON.stringify({ text: 'A different opening. ' + text.repeat(3) }), signal: cancel.signal });
  const reader = interrupted.body.getReader();
  const first = await reader.read();
  assert.ok(first.value.length > 0);
  cancel.abort(); await reader.cancel().catch(() => {});
  let afterStop;
  for (let attempt = 0; attempt < 20; attempt++) {
    afterStop = await fetch(base + '/speech', { method: 'POST', headers, body: JSON.stringify({ text: 'A fresh request after Stop.' }) });
    if (afterStop.status !== 503) break;
    await afterStop.text();
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  assert.equal(afterStop.status, 200);
  assert.equal(Buffer.from(await afterStop.arrayBuffer()).toString('ascii', 0, 4), 'RIFF');
});
