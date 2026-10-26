const { PythonVoiceWorker } = require('./python-voice-worker');
const crypto = require('node:crypto');
const config = require('./voice-config.json');

function createSpeechService({ makeWorker = () => new PythonVoiceWorker(), timeoutMs = 180000 } = {}) {
  let worker, pending, idleTimer, nextId = 0;
  const cache = new Map();
  let cacheBytes = 0;
  function remember(key, entry) {
    if (entry.bytes > 16 * 1024 * 1024) return;
    while (cacheBytes + entry.bytes > 16 * 1024 * 1024 && cache.size) {
      const oldest = cache.keys().next().value;
      cacheBytes -= cache.get(oldest).bytes; cache.delete(oldest);
    }
    cache.set(key, entry); cacheBytes += entry.bytes;
  }
  function stop() {
    clearTimeout(idleTimer);
    const old = worker; worker = null;
    if (old) old.terminate();
  }
  function fail(error) {
    if (pending) { clearTimeout(pending.timer); pending.cleanup(); pending.reject(error); pending = null; }
    stop();
  }
  function ensureWorker() {
    if (worker) return;
    const current = worker = makeWorker();
    current.on('chunk', data => {
      if (current !== worker || !pending || data.id !== pending.id || !pending.onChunk) return;
      try {
        pending.bytes += data.wav.length;
        if (pending.bytes > 16 * 1024 * 1024) throw Error('The narration audio was too large.');
        pending.sections.push(data.wav);
        pending.onChunk(data.wav);
      } catch (error) { fail(error); }
    });
    current.on('message', data => {
      if (current !== worker || !pending || data.id !== pending.id) return;
      const task = pending; pending = null; clearTimeout(task.timer); task.cleanup();
      if (data.error) { task.reject(new Error(data.error)); stop(); return; }
      if (task.onChunk) {
        if (!task.sections.length) { stop(); task.reject(new Error('The narrator returned no audio.')); return; }
        remember(task.key, { sections: task.sections, bytes: task.bytes });
        stop(); task.resolve(); return;
      }
      const wav = Buffer.from(data.wav);
      remember(task.key, { wav, bytes: wav.length });
      stop(); // Each speech process exits after one story, releasing its model.
      task.resolve(wav);
    });
    current.on('error', error => { if (current === worker) fail(error); });
    current.on('exit', code => { if (current === worker) fail(new Error('The voice process stopped (exit ' + code + ').')); });
  }
  async function generate(text, voice = config.defaultVoice, { onChunk, signal } = {}) {
    if (typeof text !== 'string' || !text.trim() || text.length > 1800) throw new Error('Please provide up to 1,800 characters of narration.');
    if (!Object.hasOwn(config.voices, voice)) throw new Error('Please choose a supported narrator.');
    const key = crypto.createHash('sha256').update(JSON.stringify([voice, config.speed, text, !!onChunk])).digest('hex');
    if (signal?.aborted) throw new Error('Narration cancelled.');
    if (cache.has(key)) {
      const entry = cache.get(key);
      if (!onChunk) return entry.wav;
      for (const section of entry.sections) {
        if (signal?.aborted) throw new Error('Narration cancelled.');
        onChunk(section);
      }
      return;
    }
    if (pending) { const error = new Error('The narrator is finishing another request. Please try again shortly.'); error.status = 503; throw error; }
    clearTimeout(idleTimer); ensureWorker();
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      const abort = () => fail(new Error('Narration cancelled.'));
      const cleanup = () => signal?.removeEventListener('abort', abort);
      pending = { id, key, resolve, reject, onChunk, cleanup, sections: [], bytes: 0, timer: setTimeout(() => fail(new Error('Voice generation took too long on this server.')), timeoutMs) };
      signal?.addEventListener('abort', abort, { once: true });
      worker.postMessage({ id, text: text.trim(), voice, speed: config.speed, stream: !!onChunk });
    });
  }
  return { generate, close: () => fail(new Error('Voice service closed.')), config };
}
module.exports = { createSpeechService };
