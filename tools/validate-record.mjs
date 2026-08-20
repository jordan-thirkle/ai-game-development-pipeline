import { readFile } from 'node:fs/promises';
import process from 'node:process';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const schemaAliases = {
  'pipeline-run': 'schemas/pipeline-run.schema.json',
  'game-graduation': 'schemas/game-graduation.schema.json',
  'game-status': 'schemas/game-status.schema.json',
  'reuse-candidate': 'schemas/reuse-candidate.schema.json'
};

const [schemaName, recordPath] = process.argv.slice(2);

if (!schemaName || !recordPath || !schemaAliases[schemaName]) {
  console.error('Usage: npm run validate:record -- <pipeline-run|game-graduation|game-status|reuse-candidate> <record.json>');
  process.exit(2);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

try {
  const [schema, record] = await Promise.all([
    readJson(schemaAliases[schemaName]),
    readJson(recordPath)
  ]);

  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const valid = validate(record);

  if (!valid) {
    console.error(`Record is invalid for ${schemaName}:`);
    for (const error of validate.errors ?? []) {
      const location = error.instancePath || '/';
      console.error(`- ${location}: ${error.message}`);
    }
    process.exit(1);
  }

  console.log(`Record is valid for ${schemaName}: ${recordPath}`);
} catch (error) {
  console.error(`Unable to validate ${recordPath}: ${error.message}`);
  process.exit(1);
}
