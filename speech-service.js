const { Worker } = require('node:worker_threads');
const path = require('node:path');
const crypto = require('node:crypto');
const config = require('./voice-config.json');

function createSpeechService({ makeWorker = () => new Worker(path.join(__dirname, 'voice-worker.mjs')), timeoutMs = 180000 } = {}) {
  let worker, pending, idleTimer, nextId = 0;
  const cache = new Map();
  let cacheBytes = 0;
  function stop() {
    clearTimeout(idleTimer);
    const old = worker; worker = null;
    if (old) old.terminate();
  }
  function fail(error) {
    if (pending) { clearTimeout(pending.timer); pending.reject(error); pending = null; }
    stop();
  }
  function ensureWorker() {
    if (worker) return;
    const current = worker = makeWorker();
    current.on('message', data => {
      if (current !== worker || !pending || data.id !== pending.id) return;
      const task = pending; pending = null; clearTimeout(task.timer);
      if (data.error) { task.reject(new Error(data.error)); stop(); return; }
      const wav = Buffer.from(data.wav);
      if (wav.length <= 16 * 1024 * 1024) {
        while (cacheBytes + wav.length > 16 * 1024 * 1024 && cache.size) {
          const key = cache.keys().next().value; cacheBytes -= cache.get(key).length; cache.delete(key);
        }
        cache.set(task.key, wav); cacheBytes += wav.length;
      }
      task.resolve(wav);
      idleTimer = setTimeout(stop, 120000); idleTimer.unref();
    });
    current.on('error', error => { if (current === worker) fail(error); });
    current.on('exit', code => { if (current === worker) fail(new Error('The voice process stopped (exit ' + code + ').')); });
  }
  async function generate(text, voice = config.defaultVoice) {
    if (typeof text !== 'string' || !text.trim() || text.length > 1800) throw new Error('Please provide up to 1,800 characters of narration.');
    if (!Object.hasOwn(config.voices, voice)) throw new Error('Please choose a supported narrator.');
    const key = crypto.createHash('sha256').update(JSON.stringify([voice, config.speed, text])).digest('hex');
    if (cache.has(key)) return cache.get(key);
    if (pending) { const error = new Error('The narrator is finishing another request. Please try again shortly.'); error.status = 503; throw error; }
    clearTimeout(idleTimer); ensureWorker();
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      pending = { id, key, resolve, reject, timer: setTimeout(() => fail(new Error('Voice generation took too long on this server.')), timeoutMs) };
      worker.postMessage({ id, text: text.trim(), voice, speed: config.speed });
    });
  }
  return { generate, close: () => fail(new Error('Voice service closed.')), config };
}
module.exports = { createSpeechService };
