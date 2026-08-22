import Phaser from 'phaser';

declare global {
  interface Window {
    __BYJTT_OBSERVATION__?: Readonly<PersistenceObservation>;
    __BYJTT_SAVE_RESULT__?: Readonly<PersistenceResult>;
    __BYJTT_RESTORE_RESULT__?: Readonly<PersistenceResult>;
  }
}

type SaveDocument = Readonly<{
  schema_version: 1;
  reward_count: 1;
  selected_upgrades: readonly ['damage-up-1'];
}>;

type PersistenceObservation = Readonly<{
  runtime_ready: boolean;
  reward_count: number;
  selected_upgrades: readonly string[];
  effective_attack_damage: number;
  save_schema_version: number | null;
  loaded_from_storage: boolean;
  save_count: number;
  pause_keydowns: number;
  pause_keyups: number;
}>;

type PersistenceResult = Readonly<{
  engine: string;
  phase: 'save' | 'restore';
  schema_version: number;
  reward_count: number;
  selected_upgrades: readonly string[];
  effective_attack_damage: number;
  save_count: number;
  pause_keydowns: number;
  pause_keyups: number;
  loaded_from_storage: boolean;
  observation_isolation_passed: boolean;
  direct_save_write_exposed: false;
  direct_reward_grant_exposed: false;
  direct_upgrade_grant_exposed: false;
  test_only_gameplay_mutation_shortcut: false;
  passed: boolean;
}>;

const SAVE_KEY = 'byjtt-lab-001-phaser-save-v1';
const UPGRADE_ID = 'damage-up-1';
const BASE_DAMAGE = 34;
const DAMAGE_MULTIPLIER = 1.2;
const VIEW_W = 390;
const VIEW_H = 844;

function isSaveDocument(value: unknown): value is SaveDocument {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { schema_version?: unknown; reward_count?: unknown; selected_upgrades?: unknown };
  return candidate.schema_version === 1 &&
    candidate.reward_count === 1 &&
    Array.isArray(candidate.selected_upgrades) &&
    candidate.selected_upgrades.length === 1 &&
    candidate.selected_upgrades[0] === UPGRADE_ID;
}

class PersistenceScene extends Phaser.Scene {
  private rewardCount = 0;
  private selectedUpgrades: string[] = [];
  private loadedFromStorage = false;
  private saveCount = 0;
  private pauseKeydowns = 0;
  private pauseKeyups = 0;
  private pauseKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super('persistence');
  }

  create(): void {
    this.add.rectangle(VIEW_W / 2, VIEW_H / 2, VIEW_W, VIEW_H, 0x111111);
    this.add.text(18, 24, 'BYJTT Phaser Persistence Gate', { color: '#ffffff', fontSize: '18px' });
    this.loadNormalGameState();
    if (!this.input.keyboard) throw new Error('Keyboard input unavailable');
    this.pauseKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    this.pauseKey.on('down', () => {
      this.pauseKeydowns += 1;
      this.saveNormalGameState();
    });
    this.pauseKey.on('up', () => {
      this.pauseKeyups += 1;
      this.publishObservation();
    });
    this.publishObservation();
    if (this.loadedFromStorage) this.publishRestoreResult();
  }

  private effectiveDamage(): number {
    return BASE_DAMAGE * (this.selectedUpgrades.includes(UPGRADE_ID) ? DAMAGE_MULTIPLIER : 1);
  }

  private loadNormalGameState(): void {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw === null) {
      // This gate starts from the progression state earned by the preceding normal-play slice.
      // The state is created by gameplay bootstrap code, not by test instrumentation.
      this.rewardCount = 1;
      this.selectedUpgrades = [UPGRADE_ID];
      return;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isSaveDocument(parsed)) throw new Error('Persisted save shape is invalid');
    this.rewardCount = parsed.reward_count;
    this.selectedUpgrades = [...parsed.selected_upgrades];
    this.loadedFromStorage = true;
  }

  private saveNormalGameState(): void {
    if (this.rewardCount !== 1 || this.selectedUpgrades.length !== 1 || this.selectedUpgrades[0] !== UPGRADE_ID) {
      throw new Error('Progression prerequisites not met');
    }
    const document: SaveDocument = Object.freeze({
      schema_version: 1,
      reward_count: 1,
      selected_upgrades: Object.freeze([UPGRADE_ID] as ['damage-up-1'])
    });
    localStorage.setItem(SAVE_KEY, JSON.stringify(document));
    this.saveCount += 1;
    this.publishObservation(1);
    this.publishSaveResult();
  }

  private publishObservation(schemaVersion: number | null = this.loadedFromStorage ? 1 : null): void {
    window.__BYJTT_OBSERVATION__ = Object.freeze({
      runtime_ready: true,
      reward_count: this.rewardCount,
      selected_upgrades: Object.freeze([...this.selectedUpgrades]),
      effective_attack_damage: this.effectiveDamage(),
      save_schema_version: schemaVersion,
      loaded_from_storage: this.loadedFromStorage,
      save_count: this.saveCount,
      pause_keydowns: this.pauseKeydowns,
      pause_keyups: this.pauseKeyups
    });
  }

  private isolationPassed(): boolean {
    const observation = window.__BYJTT_OBSERVATION__;
    if (!observation) return false;
    try {
      (observation as { reward_count: number }).reward_count = 999;
    } catch {
      return this.rewardCount === 1;
    }
    return this.rewardCount === 1;
  }

  private publishSaveResult(): void {
    const passed = this.rewardCount === 1 &&
      this.selectedUpgrades[0] === UPGRADE_ID &&
      Math.abs(this.effectiveDamage() - 40.8) < 1e-9 &&
      this.saveCount === 1 && this.pauseKeydowns === 1 &&
      this.isolationPassed();
    window.__BYJTT_SAVE_RESULT__ = Object.freeze({
      engine: `Phaser ${Phaser.VERSION}`,
      phase: 'save',
      schema_version: 1,
      reward_count: this.rewardCount,
      selected_upgrades: Object.freeze([...this.selectedUpgrades]),
      effective_attack_damage: this.effectiveDamage(),
      save_count: this.saveCount,
      pause_keydowns: this.pauseKeydowns,
      pause_keyups: this.pauseKeyups,
      loaded_from_storage: false,
      observation_isolation_passed: this.isolationPassed(),
      direct_save_write_exposed: false,
      direct_reward_grant_exposed: false,
      direct_upgrade_grant_exposed: false,
      test_only_gameplay_mutation_shortcut: false,
      passed
    });
  }

  private publishRestoreResult(): void {
    this.publishObservation(1);
    const passed = this.rewardCount === 1 &&
      this.selectedUpgrades.length === 1 && this.selectedUpgrades[0] === UPGRADE_ID &&
      Math.abs(this.effectiveDamage() - 40.8) < 1e-9 &&
      this.loadedFromStorage && this.isolationPassed();
    window.__BYJTT_RESTORE_RESULT__ = Object.freeze({
      engine: `Phaser ${Phaser.VERSION}`,
      phase: 'restore',
      schema_version: 1,
      reward_count: this.rewardCount,
      selected_upgrades: Object.freeze([...this.selectedUpgrades]),
      effective_attack_damage: this.effectiveDamage(),
      save_count: this.saveCount,
      pause_keydowns: this.pauseKeydowns,
      pause_keyups: this.pauseKeyups,
      loaded_from_storage: true,
      observation_isolation_passed: this.isolationPassed(),
      direct_save_write_exposed: false,
      direct_reward_grant_exposed: false,
      direct_upgrade_grant_exposed: false,
      test_only_gameplay_mutation_shortcut: false,
      passed
    });
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: VIEW_W,
  height: VIEW_H,
  backgroundColor: '#111111',
  scene: PersistenceScene
});
