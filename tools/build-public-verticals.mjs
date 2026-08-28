import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function readJson(file) { return JSON.parse(await fs.readFile(file, 'utf8')); }

export function buildVerticalIndex(publications, vertical) {
  return publications
    .filter((publication) => publication.status === 'published' && publication.verticals.includes(vertical.id))
    .map((publication) => ({
      id: publication.id,
      title: publication.title,
      description: publication.description ?? '',
      type: publication.type,
      canonicalUrl: publication.canonicalUrl,
      publishedAt: publication.publishedAt,
      updatedAt: publication.updatedAt,
      topics: publication.topics,
    }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = await readJson(path.join(root, 'config', 'public-verticals.json'));
  const dir = path.join(root, 'content', 'research');
  const entries = await fs.readdir(dir).catch(() => []);
  const publications = [];
  for (const entry of entries.filter((name) => name.endsWith('.json'))) {
    publications.push(await readJson(path.join(dir, entry)));
  }
  for (const vertical of config.verticals) {
    const index = buildVerticalIndex(publications, vertical);
    const destination = path.join(root, 'content', 'verticals', `${vertical.id}.json`);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, JSON.stringify({ schemaVersion: '0.1', vertical: vertical.id, generatedAt: new Date().toISOString(), items: index }, null, 2) + '\n');
  }
}
