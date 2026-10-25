import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const lock = JSON.parse(await readFile(resolve(root, 'piper-model-lock.json'), 'utf8'));
const hash = data => createHash('sha256').update(data).digest('hex');
await mkdir(resolve(root, '.piper-model'), { recursive: true });
for (const [name, expected] of Object.entries(lock.files)) {
  const target = resolve(root, '.piper-model', name);
  try { if (hash(await readFile(target)) === expected) continue; } catch {}
  const url = `https://huggingface.co/${lock.repository}/resolve/${lock.revision}/${lock.directory}/${name}`;
  console.log('Preparing fixed narrator:', name);
  const response = await fetch(url, { signal: AbortSignal.timeout(240000) });
  if (!response.ok) throw new Error(`Narrator download failed: ${name} (HTTP ${response.status})`);
  const data = Buffer.from(await response.arrayBuffer());
  if (hash(data) !== expected) throw new Error(`Narrator checksum mismatch: ${name}`);
  await writeFile(target + '.tmp', data);
  await rename(target + '.tmp', target);
}
console.log('Fixed Southern English Female voice verified. No paid speech API.');
