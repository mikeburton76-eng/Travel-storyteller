const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createSpeechService } = require('../speech-service');

class FakeWorker extends EventEmitter {
  postMessage(task) { this.task = task; }
  terminate() { this.terminated = true; }
}

test('reject unsupported voices, cap concurrency, cache completed audio', async () => {
  const worker = new FakeWorker();
  const service = createSpeechService({ makeWorker: () => worker });
  try {
    await assert.rejects(service.generate('Hello', 'bm_daniel'), /supported/);
    await assert.rejects(service.generate('x'.repeat(1801)), /1,800/);
    const first = service.generate('Hello');
    await assert.rejects(service.generate('Another story'), /another request/);
    assert.equal(worker.task.voice, 'en_GB-southern_english_female-low');
    const wav = Buffer.from('RIFF test fixture');
    worker.emit('message', { id: worker.task.id, wav });
    assert.deepEqual(await first, wav);
    assert.deepEqual(await service.generate('Hello'), wav);
  } finally { service.close(); }
});

test('timeout terminates a stuck worker and allows a fresh request', async () => {
  const workers = [];
  const service = createSpeechService({ makeWorker: () => { const w = new FakeWorker(); workers.push(w); return w; }, timeoutMs: 20 });
  try {
    await assert.rejects(service.generate('Hello'), /too long/);
    assert.equal(workers[0].terminated, true);
    const fresh = service.generate('Hello');
    assert.equal(workers.length, 2);
    workers[1].emit('message', { id: workers[1].task.id, wav: Buffer.from('new audio') });
    assert.equal((await fresh).toString(), 'new audio');
  } finally { service.close(); }
});

test('worker errors reject the request and release resources', async () => {
  const worker = new FakeWorker();
  const service = createSpeechService({ makeWorker: () => worker });
  const pending = service.generate('Hello');
  worker.emit('error', new Error('not enough memory'));
  await assert.rejects(pending, /not enough memory/);
  assert.equal(worker.terminated, true);
  service.close();
});

test('stream delivers the opening section before completion and cancellation frees the worker', async () => {
  const workers = [];
  const service = createSpeechService({ makeWorker: () => { const w = new FakeWorker(); workers.push(w); return w; } });
  const controller = new AbortController();
  const sections = [];
  const pending = service.generate('First sentence. Second sentence.', undefined, {
    onChunk: wav => sections.push(wav.toString()), signal: controller.signal
  });
  assert.equal(workers[0].task.stream, true);
  workers[0].emit('chunk', { id: workers[0].task.id, wav: Buffer.from('first') });
  assert.deepEqual(sections, ['first']);
  await assert.rejects(service.generate('Another request'), /another request/);
  controller.abort();
  await assert.rejects(pending, /cancelled/);
  assert.equal(workers[0].terminated, true);
  const next = service.generate('Next', undefined, { onChunk: wav => sections.push(wav.toString()) });
  workers[0].emit('chunk', { id: workers[0].task.id, wav: Buffer.from('stale') });
  workers[1].emit('chunk', { id: workers[1].task.id, wav: Buffer.from('next') });
  workers[1].emit('message', { id: workers[1].task.id, done: true });
  await next;
  assert.deepEqual(sections, ['first', 'next']);
  assert.notEqual(workers[1].terminated, true);
  service.close();
});

test('preparation overlaps other work and sequential new stories reuse one engine', async () => {
  const workers = [];
  const service = createSpeechService({ makeWorker: () => { const w = new FakeWorker(); workers.push(w); return w; } });
  try {
    service.warm(); service.warm();
    assert.equal(workers.length, 1);
    assert.equal(workers[0].task, undefined, 'warmup must not invent narration');
    workers[0].emit('ready', { loadSeconds: 1 });
    const first = service.generate('First uncached story');
    const firstId = workers[0].task.id;
    workers[0].emit('message', { id: firstId, wav: Buffer.from('first') });
    await first;
    assert.notEqual(workers[0].terminated, true);
    const second = service.generate('Second uncached story');
    assert.equal(workers.length, 1);
    workers[0].emit('message', { id: firstId, wav: Buffer.from('stale') });
    workers[0].emit('message', { id: workers[0].task.id, wav: Buffer.from('second') });
    assert.equal((await second).toString(), 'second');
  } finally { service.close(); }
});

test('idle model is released and the next story gets a fresh engine', async () => {
  const workers = [];
  const service = createSpeechService({ makeWorker: () => { const w = new FakeWorker(); workers.push(w); return w; }, idleMs: 15 });
  try {
    service.warm(); workers[0].emit('ready');
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal(workers[0].terminated, true);
    const pending = service.generate('Fresh story');
    assert.equal(workers.length, 2);
    workers[1].emit('message', { id: workers[1].task.id, wav: Buffer.from('fresh') });
    await pending;
  } finally { service.close(); }
});

test('warmup errors and timeouts do not prevent a later narration retry', async () => {
  const workers = [];
  const service = createSpeechService({ makeWorker: () => { const w = new FakeWorker(); workers.push(w); return w; }, timeoutMs: 15 });
  try {
    service.warm(); workers[0].emit('error', Error('model loading failed'));
    service.warm();
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal(workers[1].terminated, true);
    const pending = service.generate('Retry after warmup failure');
    workers[2].emit('message', { id: workers[2].task.id, wav: Buffer.from('retry') });
    assert.equal((await pending).toString(), 'retry');
  } finally { service.close(); }
});

test('setting idle retention to zero restores per-story model release', async () => {
  const worker = new FakeWorker();
  const service = createSpeechService({ makeWorker: () => worker, idleMs: 0 });
  const pending = service.generate('No retention');
  worker.emit('message', { id: worker.task.id, wav: Buffer.from('audio') });
  await pending;
  assert.equal(worker.terminated, true);
  service.close();
});
