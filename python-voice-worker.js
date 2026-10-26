const { EventEmitter } = require('node:events');
const { spawn } = require('node:child_process');
const path = require('node:path');

// Engine-specific protocol stays here; the app and player use the speech service.
class PythonVoiceWorker extends EventEmitter {
  constructor() {
    super();
    const python = process.env.VOICE_PYTHON || path.join(__dirname, '.piper-python/bin/python');
    this.child = spawn(python, [path.join(__dirname, 'scripts/offline-python.py'), path.join(__dirname, 'scripts/voice-piper.py'), '--worker'], {
      // The child gets no app password, API key or proxy configuration.
      env: { PATH: process.env.PATH, HOME: process.env.HOME, OPENBLAS_NUM_THREADS: '1', OMP_NUM_THREADS: '1', PYTHONUNBUFFERED: '1' },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    this.line = ''; this.stderr = ''; this.failed = false; this.task = null;
    this.child.stdout.on('data', chunk => {
      if (this.failed) return;
      this.line += chunk.toString('utf8');
      if (this.line.length > 24 * 1024 * 1024) return this.fail(Error('The narration audio was too large.'));
      let end;
      while ((end = this.line.indexOf('\n')) >= 0 && !this.failed) {
        const line = this.line.slice(0, end); this.line = this.line.slice(end + 1);
        try { this.handle(JSON.parse(line)); } catch (error) { this.fail(error); }
      }
    });
    this.child.stderr.on('data', chunk => { this.stderr = (this.stderr + chunk.toString()).slice(-8000); });
    this.child.on('error', error => this.fail(error));
    this.child.stdin.on('error', error => this.fail(error));
    this.child.on('close', code => {
      if (!this.failed) this.fail(Error(this.stderr || 'The local narrator stopped.'));
      this.emit('exit', code);
    });
  }
  handle(data) {
    if (Number.isSafeInteger(data.peak_rss_bytes) && data.peak_rss_bytes > 0) this.peakRssBytes = data.peak_rss_bytes;
    if (data.ready === true && !this.ready) {
      this.ready = true; this.emit('ready', { loadSeconds: data.load_seconds }); return;
    }
    const task = this.task;
    if (!task || data.id !== task.id) throw Error('Unexpected voice response.');
    if (data.error) throw Error(data.error);
    if (typeof data.wav === 'string') {
      const wav = Buffer.from(data.wav, 'base64');
      task.bytes += wav.length;
      if (task.bytes > 16 * 1024 * 1024) throw Error('The narration audio was too large.');
      if (wav.length < 44 || wav.toString('ascii', 0, 4) !== 'RIFF') throw Error('Invalid audio section.');
      if (task.stream) this.emit('chunk', { id: task.id, wav });
      else task.chunks.push(wav);
    } else if (data.done === true) {
      if (!task.bytes) throw Error('The narrator returned no audio.');
      this.task = null;
      this.emit('message', task.stream ? { id: task.id, done: true } : { id: task.id, wav: Buffer.concat(task.chunks) });
    } else throw Error('Invalid voice response.');
  }
  fail(error) {
    if (this.failed) return;
    this.failed = true;
    this.child.kill('SIGKILL');
    this.emit('error', error);
  }
  postMessage(task) {
    if (this.task || this.failed) throw Error('The narrator is not available.');
    this.task = { ...task, chunks: [], bytes: 0 };
    this.child.stdin.write(JSON.stringify(task) + '\n');
  }
  terminate() { this.failed = true; if (this.child.exitCode === null) this.child.kill('SIGKILL'); }
}
module.exports = { PythonVoiceWorker };
