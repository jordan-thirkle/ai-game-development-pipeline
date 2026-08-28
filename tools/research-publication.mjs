import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));

export function generateMetadata(publication) {
  const canonical = publication.canonicalUrl;
  const description = publication.description ?? publication.title;
  const images = publication.imageManifest ?? [];
  const image = images.find((item) => ['social', 'hero'].includes(item.role));
  return {
    title: publication.title,
    description,
    canonical,
    openGraph: { type: 'article', title: publication.title, description, url: canonical, publishedTime: publication.publishedAt, modifiedTime: publication.updatedAt, ...(image?.pathOrUrl ? { images: [{ url: image.pathOrUrl, alt: image.alt }] } : {}) },
    twitter: { card: image ? 'summary_large_image' : 'summary', title: publication.title, description, ...(image?.pathOrUrl ? { image: image.pathOrUrl, imageAlt: image.alt } : {}) },
    jsonLd: { '@context': 'https://schema.org', '@type': publication.type === 'news' ? 'NewsArticle' : 'Article', headline: publication.title, description, datePublished: publication.publishedAt, dateModified: publication.updatedAt, url: canonical, keywords: publication.topics, ...(publication.author ? { author: { '@type': 'Person', name: publication.author.name ?? publication.author } } : {}) },
  };
}

export function generateShareCopy(publication) {
  const citation = `By JTT, “${publication.title}” — ${publication.canonicalUrl}`;
  const description = publication.description ?? '';
  return {
    x: `New from By JTT: ${publication.title}\n${publication.canonicalUrl}`,
    linkedin: `${publication.title}\n\n${description}\n\n${publication.canonicalUrl}`.trim(),
    reddit: `${publication.title}\n\n${description}\n\n${publication.canonicalUrl}`.trim(),
    facebook: `${publication.title} — ${publication.canonicalUrl}`,
    citation,
  };
}

export function renderArticle(publication) {
  const hero = (publication.imageManifest ?? []).find((image) => image.role === 'hero');
  const sourceList = (publication.sources ?? []).map((source) => `- [${source.title}](${source.url}) — accessed ${source.accessedAt}`).join('\n');
  const related = (publication.relatedContent ?? []).map((item) => `- ${item.id} (${item.relationship})`).join('\n');
  const tags = (publication.topics ?? []).map((topic) => `\`${topic}\``).join(', ');
  const image = hero ? `![${hero.alt}](${hero.pathOrUrl})${hero.caption ? `\n\n*${hero.caption}*` : ''}\n` : '';
  const claims = (publication.claims ?? []).map((claim) => `### ${claim.id}\n\n${claim.statement}\n\n**Status:** ${claim.status ?? claim.confidence ?? 'unclassified'}  \n**Evidence:** ${(claim.evidenceIds ?? []).join(', ') || 'None recorded'}  \n**Sources:** ${(claim.sourceIds ?? []).join(', ') || 'None recorded'}`).join('\n\n');
  return `# ${publication.title}\n\n${publication.description ?? ''}\n\n**Published:** ${publication.publishedAt ?? 'Draft'}  \n**Last updated:** ${publication.updatedAt ?? 'Not recorded'}  \n**Last verified:** ${publication.lastVerifiedAt ?? 'Not yet verified'}  \n**Next review:** ${publication.nextReviewAt ?? 'Not scheduled'}  \n**Topics:** ${tags}\n\n${image}\n## The answer\n\nThis article is generated from a validated By JTT publication record. Claims below are constrained by the attached evidence lineage.\n\n## Claims and evidence\n\n${claims}\n\n## Sources\n\n${sourceList || 'No sources recorded.'}\n\n## Related research\n\n${related || 'None recorded.'}\n\n---\n\n*By JTT Research & Intelligence Engine. This article may be updated when supporting evidence changes.*\n`;
}

export async function validatePublicationRecord(publication) {
  const schema = await readJson(path.join(root, 'schemas', 'publication.schema.json'));
  const claimSchema = await readJson(path.join(root, 'schemas', 'publication-claim.schema.json'));
  if (!ajv.getSchema('publication-claim.schema.json')) ajv.addSchema(claimSchema, 'publication-claim.schema.json');
  const validate = ajv.compile(schema);
  if (!validate(publication)) return { valid: false, errors: validate.errors };
  if (publication.status === 'published' && publication.claims.length === 0) return { valid: false, errors: [{ message: 'Published records require claims' }] };
  return { valid: true, errors: null };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const contentDir = path.join(root, 'content', 'research');
  const files = await fs.readdir(contentDir).catch(() => []);
  for (const name of files.filter((entry) => entry.endsWith('.json'))) {
    const result = await validatePublicationRecord(await readJson(path.join(contentDir, name)));
    if (!result.valid) { console.error(`Invalid publication: ${name}`); console.error(result.errors); process.exitCode = 1; }
  }
}
