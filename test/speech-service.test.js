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
    assert.equal(worker.task.voice, 'bf_isabella');
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
