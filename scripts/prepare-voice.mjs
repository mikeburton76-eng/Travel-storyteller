import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const lock = JSON.parse(await readFile(resolve(root, 'voice-model-lock.json'), 'utf8'));
const hash = data => createHash('sha256').update(data).digest('hex');
for (const [name, expected] of Object.entries(lock.files)) {
  const target = resolve(root, '.voice-model', name);
  try { if (hash(await readFile(target)) === expected) continue; } catch {}
  console.log('Preparing voice model:', name);
  const url = `https://huggingface.co/${lock.model}/resolve/${lock.revision}/${name}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(240000) });
  if (!response.ok) throw new Error(`Voice download failed: ${name} (HTTP ${response.status})`);
  const data = Buffer.from(await response.arrayBuffer());
  if (hash(data) !== expected) throw new Error(`Voice file checksum mismatch: ${name}`);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target + '.tmp', data);
  await rename(target + '.tmp', target);
}
console.log('Fixed voice model verified. No paid speech API is used.');
