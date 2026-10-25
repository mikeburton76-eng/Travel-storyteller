import { parentPort } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { KokoroTTS } from 'kokoro-js';
import { env, StyleTextToSpeech2Model, AutoTokenizer } from '@huggingface/transformers';

// Only the downloaded, checksum-verified model is used at runtime.
env.allowRemoteModels = false;
const modelPath = fileURLToPath(new URL('./.voice-model/', import.meta.url));
let tts;

function splitText(text) {
  const parts = [];
  let part = '';
  for (const word of text.split(/\s+/)) {
    if (part.length + word.length > 70 && part) { parts.push(part); part = ''; }
    part += (part ? ' ' : '') + word;
    if (/[.!?]$/.test(word) && part.length > 60) { parts.push(part); part = ''; }
  }
  if (part) parts.push(part);
  return parts;
}

function pcmWav(samples) {
  const wav = Buffer.alloc(44 + samples.length * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(24000, 24); wav.writeUInt32LE(48000, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36);
  wav.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  return wav;
}

parentPort.on('message', async ({ id, text, voice, speed }) => {
  try {
    if (!tts) {
      const [model, tokenizer] = await Promise.all([
        StyleTextToSpeech2Model.from_pretrained(modelPath, {
          dtype: 'q8', device: 'cpu',
          session_options: { intraOpNumThreads: 1, interOpNumThreads: 1 }
        }),
        AutoTokenizer.from_pretrained(modelPath)
      ]);
      tts = new KokoroTTS(model, tokenizer);
    }
    const audio = [];
    for (const part of splitText(text)) {
      const result = await tts.generate(part, { voice, speed });
      audio.push(result.audio);
    }
    const samples = new Float32Array(audio.reduce((n, a) => n + a.length, 0));
    let offset = 0;
    for (const a of audio) { samples.set(a, offset); offset += a.length; }
    parentPort.postMessage({ id, wav: pcmWav(samples) });
  } catch (error) {
    parentPort.postMessage({ id, error: error.message });
  }
});
