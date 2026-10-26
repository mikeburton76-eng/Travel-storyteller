/* Play complete WAV sections as they arrive, with one audio clock for continuity. */
class NarrationPlayer {
  constructor({ onState = () => {}, makeContext, fetchAudio = (...args) => fetch(...args) } = {}) {
    this.onState = onState;
    this.makeContext = makeContext || (() => new (globalThis.AudioContext || globalThis.webkitAudioContext)());
    this.fetchAudio = fetchAudio;
    this.sources = new Set();
    this.epoch = 0;
  }
  static get supported() {
    return !!(globalThis.AudioContext || globalThis.webkitAudioContext) && typeof ReadableStream !== 'undefined';
  }
  // Called directly inside the user's tap, before story lookup or any await.
  prime() {
    try {
      // On iPhone this is narration playback, rather than ambient Web Audio.
      try { if (globalThis.navigator?.audioSession) globalThis.navigator.audioSession.type = 'playback'; } catch (_) {}
      if (!this.context) {
        this.context = this.makeContext();
        this.context.onstatechange = () => { if (this.active) this.refresh(); };
      }
      this.context.resume().catch(() => { if (this.active) this.refresh(); });
      return true;
    } catch (_) { return false; }
  }
  stop() {
    this.epoch++;
    this.active = false;
    this.controller?.abort();
    clearTimeout(this.timer);
    for (const source of this.sources) { source.onended = null; source.stop(); source.disconnect(); }
    this.sources.clear();
    this.nextStart = 0;
    this.done = false;
    this.userPaused = false;
  }
  refresh() {
    if (!this.active) return;
    if (this.sources.size) {
      const paused = this.userPaused || this.context.state !== 'running';
      this.onState(paused ? 'paused' : 'speaking', paused ? 'Narration is ready. Tap Resume to listen.' : 'Reading the story aloud…');
    } else if (this.done) {
      this.active = false;
      this.onState('idle', 'Finished.');
    } else {
      this.onState(this.userPaused ? 'paused' : 'loading', 'Preparing the next part of the narration…');
    }
  }
  pause() {
    this.userPaused = true;
    this.context?.suspend().then(() => this.refresh()).catch(() => this.refresh());
  }
  resume() {
    this.userPaused = false;
    this.context?.resume().then(() => this.refresh()).catch(() => this.refresh());
  }
  async start(text, voice) {
    this.stop();
    if (!this.prime()) throw Error('Audio playback is unavailable in this browser.');
    const epoch = this.epoch;
    this.active = true;
    const controller = this.controller = new AbortController();
    this.timer = setTimeout(() => controller.abort(), 190000);
    this.onState('loading', 'Preparing the opening sentence…');
    let count = 0, receivedDone = false, reader;
    try {
      const response = await this.fetchAudio('/speech-stream', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice }), signal: controller.signal
      });
      if (epoch !== this.epoch) return;
      if (!response.ok) { const data = await response.json(); throw Error(data.error || 'Narration failed.'); }
      if (!response.body) throw Error('The audio connection did not open.');
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = '', bytes = 0;
      const handle = async line => {
        const data = JSON.parse(line);
        if (data.error) throw Error(data.error);
        if (receivedDone) throw Error('Unexpected data after narration completed.');
        if (data.done === true) { receivedDone = true; return; }
        if (typeof data.wav !== 'string') throw Error('Invalid narration audio.');
        const raw = atob(data.wav);
        const wav = Uint8Array.from(raw, c => c.charCodeAt(0));
        const buffer = await this.context.decodeAudioData(wav.buffer);
        if (epoch !== this.epoch) return;
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.connect(this.context.destination);
        const when = Math.max(this.context.currentTime + 0.04, this.nextStart || 0);
        this.nextStart = when + buffer.duration;
        this.sources.add(source);
        source.onended = () => {
          source.disconnect(); this.sources.delete(source);
          if (epoch === this.epoch) this.refresh();
        };
        source.start(when);
        count++;
        this.refresh();
      };
      while (true) {
        const { value, done } = await reader.read();
        if (epoch !== this.epoch) return;
        if (done) { pending += decoder.decode(); break; }
        bytes += value.byteLength;
        if (bytes > 24 * 1024 * 1024) throw Error('Narration audio was too large.');
        pending += decoder.decode(value, { stream: true });
        let end;
        while ((end = pending.indexOf('\n')) >= 0) {
          const line = pending.slice(0, end); pending = pending.slice(end + 1);
          if (line.trim()) await handle(line);
          if (epoch !== this.epoch) return;
        }
      }
      if (pending.trim()) await handle(pending);
      if (epoch !== this.epoch) return;
      if (!receivedDone || !count) throw Error('The narration connection ended early. Please try again.');
      this.done = true;
      this.refresh();
    } catch (error) {
      if (epoch !== this.epoch) return;
      this.stop();
      this.onState('idle', error.name === 'AbortError' ? 'Narration took too long. Please try again.' : error.message);
    } finally {
      // An older request must never clear a newer story's timeout.
      if (epoch === this.epoch) clearTimeout(this.timer);
      if (reader) { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    }
  }
}
if (typeof module !== 'undefined') module.exports = { NarrationPlayer };
else globalThis.NarrationPlayer = NarrationPlayer;
