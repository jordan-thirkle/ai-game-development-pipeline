import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);

const claimSchema = JSON.parse(await fs.readFile(path.join(root, 'schemas/publication-claim.schema.json'), 'utf8'));
const publicationSchema = JSON.parse(await fs.readFile(path.join(root, 'schemas/publication.schema.json'), 'utf8'));
ajv.addSchema(claimSchema, claimSchema.$id);
const validate = ajv.compile(publicationSchema);
const fixtures = JSON.parse(await fs.readFile(path.join(root, 'tests/publication/publication-fixtures.json'), 'utf8'));

for (const fixture of fixtures) {
  test(`publication fixture: ${fixture.name}`, () => {
    const valid = validate(fixture.record);
    assert.equal(valid, fixture.valid, validate.errors ? JSON.stringify(validate.errors) : undefined);
  });
}
