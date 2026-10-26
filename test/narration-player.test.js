const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NarrationPlayer } = require('../narration-player');
const tick = () => new Promise(resolve => setImmediate(resolve));
const encode = data => new TextEncoder().encode(JSON.stringify(data) + '\n');
const wav = Buffer.from('fake WAV for mocked decoding').toString('base64');

class Context {
  constructor() { this.state = 'running'; this.currentTime = 1; this.made = []; }
  async resume() { this.state = 'running'; }
  async suspend() { this.state = 'suspended'; }
  async decodeAudioData() { return { duration: 4 }; }
  createBufferSource() {
    const node = { connect() {}, disconnect() {}, start(when) { this.when = when; }, stop() { this.stopped = true; } };
    this.made.push(node); return node;
  }
}
function setup() {
  const context = new Context();
  const states = [];
  let output;
  const stream = new ReadableStream({ start(controller) { output = controller; } });
  const player = new NarrationPlayer({ makeContext: () => context,
    onState: (state, message) => states.push({ state, message }),
    fetchAudio: async () => new Response(stream) });
  return { player, context, states, output };
}

test('plays first section before stream completes, schedules the next without a playback gap', async () => {
  const { player, context, states, output } = setup();
  const pending = player.start('One. Two.', 'voice');
  const first = encode({ wav });
  output.enqueue(first.slice(0, 8)); await tick();
  assert.equal(context.made.length, 0);
  output.enqueue(first.slice(8)); await tick();
  assert.equal(context.made.length, 1);
  assert.equal(states.at(-1).state, 'speaking');
  output.enqueue(encode({ wav })); await tick();
  assert.equal(context.made[1].when, context.made[0].when + 4);
  output.enqueue(encode({ done: true })); output.close();
  await pending;
  assert.equal(states.at(-1).state, 'speaking');
  context.made.forEach(source => source.onended());
  assert.deepEqual(states.at(-1), { state: 'idle', message: 'Finished.' });
});

test('pause and resume apply to queued sections; stop cancels all scheduled audio', async () => {
  const { player, context, states, output } = setup();
  const pending = player.start('One. Two.', 'voice');
  output.enqueue(encode({ wav })); await tick();
  player.pause(); await tick();
  output.enqueue(encode({ wav })); await tick();
  assert.equal(states.at(-1).state, 'paused');
  player.resume(); await tick();
  assert.equal(states.at(-1).state, 'speaking');
  player.stop();
  assert.ok(context.made.every(source => source.stopped));
  output.enqueue(encode({ wav })); output.close();
  await pending;
  assert.equal(context.made.length, 2);
});

test('interrupted stream reports an error and stops already queued audio', async () => {
  const { player, context, states, output } = setup();
  const pending = player.start('One. Two.', 'voice');
  output.enqueue(encode({ wav })); await tick();
  output.close(); await pending;
  assert.equal(states.at(-1).state, 'idle');
  assert.match(states.at(-1).message, /ended early/);
  assert.equal(context.made[0].stopped, true);
});

test('stopping during audio decode prevents stale narration from starting', async () => {
  const { player, context, output } = setup();
  let decoded;
  context.decodeAudioData = () => new Promise(resolve => { decoded = resolve; });
  const pending = player.start('Old story.', 'voice');
  output.enqueue(encode({ wav })); await tick();
  player.stop();
  decoded({ duration: 4 }); output.close();
  await pending;
  assert.equal(context.made.length, 0);
});
