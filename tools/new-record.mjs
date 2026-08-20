import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import process from 'node:process';

const [recordType, outputPath, id = 'replace-me'] = process.argv.slice(2);
const supported = ['pipeline-run', 'game-graduation', 'game-status', 'reuse-candidate'];

if (!recordType || !outputPath || !supported.includes(recordType)) {
  console.error(`Usage: npm run new:record -- <${supported.join('|')}> <output.json> [id]`);
  process.exit(2);
}

const now = new Date();
const iso = now.toISOString();
const date = iso.slice(0, 10);

const templates = {
  'pipeline-run': {
    schemaVersion: '1.0.0',
    runId: id,
    experimentId: null,
    gameId: null,
    startedAt: iso,
    endedAt: null,
    scope: {
      taskType: 'other',
      objective: 'Replace with the bounded objective before execution.',
      candidate: null,
      targetPlatforms: []
    },
    inputs: {
      sourceCommit: 'unknown',
      technologyVersions: {},
      sharedAssetSet: null,
      specVersion: null
    },
    execution: {
      models: [],
      toolCalls: null,
      failedToolCalls: null,
      humanInterventions: null,
      humanMinutes: null,
      elapsedSeconds: null,
      iterations: null,
      bespokeLinesChanged: null,
      reusedComponents: [],
      estimatedReuseRatio: null,
      externalServiceCostUsd: null
    },
    evidence: {
      executionVerified: false,
      artifacts: [],
      screenshots: [],
      videos: [],
      logs: [],
      profiles: [],
      deviceResults: [],
      automatedTestsPassed: null,
      automatedTestsFailed: null
    },
    quality: {
      functionalScore: null,
      visualScore: null,
      gameplayScore: null,
      maintainabilityScore: null,
      performanceScore: null
    },
    outcome: {
      status: 'blocked',
      summary: 'Scaffold only; execution evidence and telemetry have not been collected.',
      failures: ['Record is not complete.'],
      nextAction: 'Replace scaffold values and collect fresh execution evidence and measured telemetry.',
      promotedComponentIds: []
    }
  },
  'game-graduation': {
    schemaVersion: '1.0.0', candidateId: id, sourceExperimentIds: ['replace-me'], decision: 'continue-research', decisionDate: date,
    evidence: { playableBuild: false, playerValue: 'Unknown; evidence required.', technicalViability: 'Unknown; evidence required.', references: [], playtestSummary: null, performanceSummary: null },
    product: { playerFantasy: 'Unknown', coreLoop: 'Unknown', differentiation: 'Unknown', targetPlatforms: ['unknown'], releaseScope: 'Unknown', returnReasons: [] },
    technical: { proposedRuntime: null, runtimeDecisionEvidence: null, reusableComponentIds: [], knownMigrationNeeds: [], performanceRisks: [] },
    commercial: { monetisationHypotheses: [], distributionHypotheses: [], costRisks: [], revenueHypotheses: [] },
    operations: { telemetryRequired: true, releaseAutomationRequired: true, supportRequired: false, maintenanceRisks: [], backendRequirements: [], complianceRequirements: [] },
    risks: [], killCriteria: [], nextActions: ['Collect evidence before requesting graduation.']
  },
  'game-status': {
    schemaVersion: '1.0.0', gameId: id, repository: null, lifecycleStage: 'production',
    runtime: { name: 'unknown', version: 'unknown', decisionEvidence: null }, releases: [],
    health: { telemetry: { status: 'unknown', evidence: null }, crashReporting: { status: 'unknown', evidence: null }, releasePipeline: { status: 'unknown', evidence: null }, commerce: { status: 'unknown', evidence: null }, support: { status: 'unknown', evidence: null } },
    monetisation: { model: [], state: 'none', activeExperiment: null, economicsEvidence: null },
    maintenance: { policy: 'Define maintenance and upgrade policy before public release.', lastDependencyReview: null, lastPlatformReview: null, risks: [] },
    evidence: { pipelineRuns: [], releaseEvidence: [], publicationSafe: [] },
    nextReview: { date: null, action: 'Replace unknown scaffold state with evidence-backed status.' }
  },
  'reuse-candidate': {
    id,
    name: 'Replace with candidate name',
    description: 'Discovery scaffold only; replace all placeholder evidence before qualification.',
    kind: 'other',
    state: 'discovered',
    source: { canonicalUrl: 'https://example.invalid/replace-with-upstream', provider: 'replace-me' },
    licence: {
      status: 'unknown', identifier: 'unknown', evidenceUrl: 'https://example.invalid/replace-with-licence-evidence', attributionRequired: false, checkedAt: iso,
      notice: 'Unknown until verified from a primary source.'
    },
    commercialUse: 'unknown',
    provenance: { confidence: 'unknown', notes: 'Unknown until source/rightsholder provenance is verified.' },
    maintenance: { status: 'unclear', evidence: 'No maintenance evidence collected yet.', checkedAt: iso, notes: 'Replace with current upstream evidence.' },
    compatibility: { notes: 'Not assessed yet.' },
    risk: { supplyChain: 'unknown', dependencyBurden: 'unknown', legalNotes: 'Not assessed yet.', securityNotes: 'Not assessed yet.' },
    assessment: { integrationEffort: 'unknown', lifecycleRisk: 'unknown', scores: {}, recommendation: 'defer', notes: 'Discovery scaffold cannot be promoted until evidence is collected.' },
    evidence: [{ type: 'discovery-placeholder', url: 'https://example.invalid/replace-with-evidence', checkedAt: iso, notes: 'Replace placeholder with primary-source evidence.' }],
    publication: { safe: false, notes: 'Never publish an unqualified scaffold.' },
    usedIn: [],
    lastVerified: iso
  }
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(templates[recordType], null, 2)}\n`, { flag: 'wx' });
console.log(`Created safe ${recordType} scaffold: ${outputPath}`);
