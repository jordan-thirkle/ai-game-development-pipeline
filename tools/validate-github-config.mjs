import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import process from 'node:process';
import { parseDocument } from 'yaml';

const failures = [];

async function listYamlFiles(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) files.push(...await listYamlFiles(path));
      else if (['.yml', '.yaml'].includes(extname(entry.name))) files.push(path);
    }
    return files;
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

async function parseYaml(path) {
  const source = await readFile(path, 'utf8');
  let document;
  try {
    document = parseDocument(source, { maxAliasCount: 0, prettyErrors: true });
  } catch (error) {
    failures.push(`${path}: YAML parser threw: ${error.message}`);
    return null;
  }
  if (document.errors.length) {
    for (const error of document.errors) failures.push(`${path}: ${error.message}`);
    return null;
  }
  return document.toJS({ maxAliasCount: 0 });
}

function requireString(value, path, field) {
  if (typeof value !== 'string' || !value.trim()) failures.push(`${path}: ${field} must be a non-empty string`);
}

function validateIssueForm(form, path) {
  if (!form || typeof form !== 'object' || Array.isArray(form)) {
    failures.push(`${path}: issue form must be a mapping`);
    return;
  }

  requireString(form.name, path, 'name');
  requireString(form.description, path, 'description');
  if (!Array.isArray(form.body) || form.body.length === 0) {
    failures.push(`${path}: body must be a non-empty array`);
    return;
  }

  const ids = new Set();
  const allowedTypes = new Set(['markdown', 'input', 'textarea', 'dropdown', 'checkboxes']);
  form.body.forEach((item, index) => {
    const prefix = `${path}: body[${index}]`;
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      failures.push(`${prefix} must be a mapping`);
      return;
    }
    if (!allowedTypes.has(item.type)) failures.push(`${prefix}.type is unsupported: ${item.type}`);
    if (!item.attributes || typeof item.attributes !== 'object' || Array.isArray(item.attributes)) {
      failures.push(`${prefix}.attributes must be a mapping`);
      return;
    }

    if (item.type === 'markdown') {
      requireString(item.attributes.value, prefix, 'attributes.value');
      return;
    }

    requireString(item.id, prefix, 'id');
    if (typeof item.id === 'string') {
      if (!/^[A-Za-z0-9_-]+$/.test(item.id)) failures.push(`${prefix}.id contains unsupported characters`);
      if (ids.has(item.id)) failures.push(`${prefix}.id duplicates ${item.id}`);
      ids.add(item.id);
    }
    requireString(item.attributes.label, prefix, 'attributes.label');

    if (item.type === 'dropdown') {
      if (!Array.isArray(item.attributes.options) || item.attributes.options.length === 0) failures.push(`${prefix}: dropdown options must be non-empty`);
      else if (item.attributes.options.some((option) => typeof option !== 'string' || !option.trim())) failures.push(`${prefix}: dropdown options must be non-empty strings`);
    }

    if (item.type === 'checkboxes') {
      if (!Array.isArray(item.attributes.options) || item.attributes.options.length === 0) failures.push(`${prefix}: checkbox options must be non-empty`);
      else item.attributes.options.forEach((option, optionIndex) => {
        if (!option || typeof option !== 'object' || typeof option.label !== 'string' || !option.label.trim()) failures.push(`${prefix}.attributes.options[${optionIndex}] must have a non-empty label`);
        if (option?.required !== undefined && typeof option.required !== 'boolean') failures.push(`${prefix}.attributes.options[${optionIndex}].required must be boolean`);
      });
    }

    if (item.validations !== undefined) {
      if (!item.validations || typeof item.validations !== 'object' || Array.isArray(item.validations)) failures.push(`${prefix}.validations must be a mapping`);
      else if (item.validations.required !== undefined && typeof item.validations.required !== 'boolean') failures.push(`${prefix}.validations.required must be boolean`);
    }
  });
}

function validateIssueTemplateConfig(config, path) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    failures.push(`${path}: issue-template config must be a mapping`);
    return;
  }
  if (config.blank_issues_enabled !== undefined && typeof config.blank_issues_enabled !== 'boolean') failures.push(`${path}: blank_issues_enabled must be boolean`);
  if (config.contact_links !== undefined && !Array.isArray(config.contact_links)) failures.push(`${path}: contact_links must be an array`);
}

function validateWorkflow(workflow, path) {
  if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow)) {
    failures.push(`${path}: workflow must be a mapping`);
    return;
  }
  requireString(workflow.name, path, 'name');
  if (workflow.on === undefined && workflow.true === undefined) failures.push(`${path}: workflow must define an on trigger`);
  if (!workflow.jobs || typeof workflow.jobs !== 'object' || Array.isArray(workflow.jobs) || Object.keys(workflow.jobs).length === 0) failures.push(`${path}: workflow jobs must be a non-empty mapping`);
}

const issueFiles = await listYamlFiles('.github/ISSUE_TEMPLATE');
for (const path of issueFiles) {
  const parsed = await parseYaml(path);
  if (!parsed) continue;
  if (/[/\\]config\.ya?ml$/i.test(path)) validateIssueTemplateConfig(parsed, path);
  else validateIssueForm(parsed, path);
}

const workflowFiles = await listYamlFiles('.github/workflows');
for (const path of workflowFiles) {
  const parsed = await parseYaml(path);
  if (parsed) validateWorkflow(parsed, path);
}

if (issueFiles.length === 0) failures.push('No GitHub issue-form YAML files found');
if (workflowFiles.length === 0) failures.push('No GitHub workflow YAML files found');

if (failures.length) {
  console.error('GitHub configuration validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`GitHub configuration validation passed (${issueFiles.length} issue-template files, ${workflowFiles.length} workflows).`);
