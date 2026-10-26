const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { PythonVoiceWorker } = require('../python-voice-worker');
const { createSpeechService } = require('../speech-service');

test('real warmed engine serves different stories without reloading and stays within memory budget',
  { skip: !process.env.VOICE_TEST_PYTHON, timeout: 120000 }, async t => {
  const previousPython = process.env.VOICE_PYTHON;
  process.env.VOICE_PYTHON = process.env.VOICE_TEST_PYTHON;
  const workers = [];
  const service = createSpeechService({ makeWorker: () => {
    const worker = new PythonVoiceWorker(); workers.push(worker); return worker;
  } });
  let nodePeakBytes = 0, pythonPeakBytes = 0;
  const sample = () => {
    nodePeakBytes = Math.max(nodePeakBytes, process.memoryUsage().rss);
    pythonPeakBytes = Math.max(pythonPeakBytes, workers.at(-1)?.peakRssBytes || 0);
  };
  const sampler = setInterval(sample, 20);
  t.after(() => {
    clearInterval(sampler); service.close();
    if (previousPython === undefined) delete process.env.VOICE_PYTHON;
    else process.env.VOICE_PYTHON = previousPython;
  });
  const loadStart = performance.now();
  service.warm();
  await once(workers[0], 'ready');
  const loadMs = performance.now() - loadStart;
  const openingTimes = [];
  const texts = [
    'Welcome to Buxton. The Crescent stands at the heart of this Derbyshire spa town.',
    ('Discover the history around you. The streets and buildings tell stories of visitors from long ago. ').repeat(17).slice(0, 1750),
    'Look towards the Crescent. Its stone facade is a familiar part of Buxton.'
  ];
  for (const text of texts) {
    const start = performance.now();
    let first;
    await service.generate(text, undefined, { onChunk(wav) {
      first ??= performance.now() - start;
      assert.equal(wav.toString('ascii', 0, 4), 'RIFF'); sample();
    } });
    openingTimes.push(Math.round(first));
    assert.equal(workers.length, 1, 'new stories must reuse the loaded model');
  }
  sample();
  assert.ok(nodePeakBytes > 0 && pythonPeakBytes > 0, 'both memory measurements must succeed');
  const conservativeBytes = nodePeakBytes + pythonPeakBytes;
  assert.ok(conservativeBytes / 1024 / 1024 < 450, 'leave memory headroom below 512 MiB');
  assert.match(workers[0].stderr, /Offline isolation verified/);
  t.diagnostic(JSON.stringify({ model_load_ms: Math.round(loadMs), warm_first_audio_ms: openingTimes,
    conservative_sum_of_separate_process_peaks_mib: Math.round(conservativeBytes / 1024 / 1024) }));
});
