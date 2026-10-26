const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('story button primes phone audio before lookup and starts narration when the story arrives', async () => {
  const calls = [];
  const nodes = new Map();
  function element() {
    return { style: {}, listeners: {}, options: [], selectedIndex: 0, value: '',
      addEventListener(name, callback) { this.listeners[name] = callback; },
      replaceChildren() { this.options = []; }, add(option) { this.options.push(option); },
      appendChild() {}, removeAttribute() {}, pause() {}, load() {} };
  }
  const document = { getElementById(id) {
    if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id);
  }, createElement: element };
  class Player {
    static supported = true;
    constructor({ onState }) { this.onState = onState; }
    prime() { calls.push('prime'); return true; }
    stop() { calls.push('stop'); }
    async start(text, voice) { calls.push({ text, voice }); this.onState('speaking', 'Reading the story aloud…'); }
  }
  const context = vm.createContext({ document, NarrationPlayer: Player,
    Option: function(text, value) { this.text = text; this.value = value; },
    localStorage: { getItem() { return null; } }, window: { addEventListener() {} },
    AbortController, setTimeout, clearTimeout, URL,
    fetch: async url => {
      if (url === '/voices') return { ok: true, json: async () => ({ defaultVoice: 'southern', voices: { southern: 'Southern English Female' } }) };
      calls.push('lookup');
      return { ok: true, json: async () => ({ story: 'Welcome to Buxton. Discover the Crescent.', sources: [] }) };
    }
  });
  const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
  vm.runInContext(html.match(/<script>\s*([\s\S]*?)<\/script>/)[1], context);
  await new Promise(resolve => setImmediate(resolve));
  document.getElementById('place').value = 'Buxton';
  await document.getElementById('go').listeners.click();
  assert.ok(calls.indexOf('prime') < calls.indexOf('lookup'));
  assert.equal(calls.at(-1).text, 'Welcome to Buxton. Discover the Crescent.');
  assert.equal(calls.at(-1).voice, 'southern');
  assert.equal(document.getElementById('pauseBtn').disabled, false);
  assert.equal(document.getElementById('narratorAudio').hidden, true);
});
