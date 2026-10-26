const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');

function app({ enabled = true, throws = false } = {}) {
  const events = [];
  const server = new EventEmitter();
  server.listen = (_port, _host, ready) => ready();
  const root = path.resolve(__dirname, '..');
  const speech = { warm() {
    events.push('warm');
    if (throws) throw Error('Warmup unavailable');
    return new Promise(() => {}); // Story writing must not wait for model loading.
  } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'server.js'), 'utf8'), {
    __dirname: root, Buffer,
    process: { env: { APP_PASSWORD: 'fixture', ANTHROPIC_API_KEY: 'not-a-real-key' } },
    console: { log() {}, warn() {}, error() {} },
    require(name) {
      if (name === 'http') return { createServer(listener) { server.on('request', listener); return server; } };
      if (name === './speech-service') return { createSpeechService: () => speech };
      if (name === './speech-settings.json') return { prewarmDuringStory: enabled };
      return require(name);
    },
    fetch: async input => {
      const url = new URL(input);
      events.push(url.hostname === 'en.wikipedia.org' ? 'facts' : 'writing');
      let data;
      if (url.searchParams.get('list') === 'search') data = { query: { search: [{ title: 'Buxton' }] } };
      else if (url.hostname === 'en.wikipedia.org') data = { query: { pages: { 1: {
        title: 'Buxton', fullurl: 'https://en.wikipedia.org/wiki/Buxton', extract: 'Source-supported history of Buxton. '.repeat(20)
      } } } };
      else data = { content: [{ text: JSON.stringify({ story: 'Welcome to Buxton.', sources_used: [1] }) }] };
      return { ok: true, json: async () => data };
    }
  });
  async function request(authenticated = true) {
    const req = new EventEmitter();
    Object.assign(req, { method: 'POST', url: '/story', headers: authenticated ? {
      authorization: 'Basic ' + Buffer.from('traveller:fixture').toString('base64')
    } : {} });
    const res = { writeHead(status) { this.status = status; } };
    const finished = new Promise(resolve => { res.end = body => resolve({ status: res.status, body }); });
    server.emit('request', req, res);
    req.emit('data', JSON.stringify({ place: 'Buxton' })); req.emit('end');
    return finished;
  }
  return { request, events };
}

test('authenticated story starts warmup before fact lookup without waiting for it', async () => {
  const { request, events } = app();
  const result = await request();
  assert.equal(result.status, 200);
  assert.equal(JSON.parse(result.body).story, 'Welcome to Buxton.');
  assert.equal(events[0], 'warm');
  assert.ok(events.includes('writing'));
});

test('warmup failure, disabled warmup and unauthorized requests preserve normal behaviour', async () => {
  const failing = app({ throws: true });
  assert.equal((await failing.request()).status, 200);
  const disabled = app({ enabled: false });
  assert.equal((await disabled.request()).status, 200);
  assert.ok(!disabled.events.includes('warm'));
  const unauthorized = app();
  assert.equal((await unauthorized.request(false)).status, 401);
  assert.equal(unauthorized.events.length, 0);
});
