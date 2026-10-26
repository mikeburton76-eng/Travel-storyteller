const { EventEmitter } = require('node:events');
const { spawn } = require('node:child_process');
const path = require('node:path');

class PythonVoiceWorker extends EventEmitter {
  constructor() {
    super();
    const python = process.env.VOICE_PYTHON || path.join(__dirname, '.piper-python/bin/python');
    const wrapper = path.join(__dirname, 'scripts/offline-python.py');
    const script = path.join(__dirname, 'scripts/voice-piper.py');
    this.child = spawn(python, [wrapper, script], {
      // The child gets no app password, API key or proxy configuration.
      env: { PATH: process.env.PATH, HOME: process.env.HOME, OPENBLAS_NUM_THREADS: '1', OMP_NUM_THREADS: '1', PYTHONUNBUFFERED: '1' },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    this.chunks = []; this.bytes = 0; this.stderr = ''; this.failed = false; this.line = ''; this.done = false;
    this.child.stdout.on('data', chunk => {
      this.bytes += chunk.length;
      if (this.bytes > 16 * 1024 * 1024) { this.failed = true; this.child.kill('SIGKILL'); return; }
      if (!this.streaming) { this.chunks.push(chunk); return; }
      this.line += chunk.toString('utf8');
      let end;
      while ((end = this.line.indexOf('\n')) >= 0 && !this.failed) {
        const line = this.line.slice(0, end); this.line = this.line.slice(end + 1);
        try {
          const data = JSON.parse(line);
          if (data.done === true) this.done = true;
          else if (typeof data.wav === 'string' && !this.done) {
            const wav = Buffer.from(data.wav, 'base64');
            if (wav.length < 44 || wav.toString('ascii', 0, 4) !== 'RIFF') throw Error('Invalid audio section.');
            this.emit('chunk', { id: this.id, wav });
          } else throw Error('Invalid voice response.');
        } catch (error) { this.failed = true; this.child.kill('SIGKILL'); this.emit('error', error); }
      }
    });
    this.child.stderr.on('data', chunk => { this.stderr = (this.stderr + chunk.toString()).slice(-8000); });
    this.child.on('error', error => { this.failed = true; this.emit('error', error); });
    this.child.stdin.on('error', error => { if (!this.failed) { this.failed = true; this.emit('error', error); } });
    this.child.on('close', code => {
      if (code === 0 && !this.failed && this.streaming && this.done && !this.line.trim()) {
        this.emit('message', { id: this.id, done: true });
      } else if (code === 0 && !this.failed && !this.streaming && this.bytes >= 44) {
        const wav = Buffer.concat(this.chunks);
        if (wav.toString('ascii', 0, 4) === 'RIFF') this.emit('message', { id: this.id, wav });
        else this.emit('error', new Error('The local narrator returned invalid audio.'));
      } else if (!this.failed) this.emit('error', new Error(this.stderr || 'The local narrator stopped.'));
      else if (this.bytes > 16 * 1024 * 1024) this.emit('error', new Error('The narration audio was too large.'));
      this.emit('exit', code);
    });
  }
  postMessage(task) { this.id = task.id; this.streaming = !!task.stream; this.child.stdin.end(JSON.stringify(task)); }
  terminate() { if (this.child.exitCode === null) this.child.kill('SIGKILL'); }
}
module.exports = { PythonVoiceWorker };
