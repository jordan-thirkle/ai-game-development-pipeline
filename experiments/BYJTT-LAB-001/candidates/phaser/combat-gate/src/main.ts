import Phaser from 'phaser';

const METRES_TO_PX = 12;
const ARENA_WIDTH_M = 24;
const ARENA_DEPTH_M = 32;
const PLAYER_SPEED_MPS = 3.5;
const ENEMY_SPEED_MPS = 2.7;
const ACQUIRE_RANGE_M = 12;
const ATTACK_RANGE_M = 1.6;
const ATTACK_DAMAGE = 20;
const ATTACK_COOLDOWN_S = 1.1;
const PLAYER_MAX_HEALTH = 100;
const PLAYER_RADIUS_M = 0.4;
const PLAYER_SPAWN = { x: 0, z: 10 };
const ENEMY_SPAWN = { x: 0, z: -6 };

interface CombatObservation {
  ready: boolean;
  phaserVersion: string;
  arenaWidthM: number;
  arenaDepthM: number;
  playerX: number;
  playerZ: number;
  enemyX: number;
  enemyZ: number;
  separationM: number;
  acquired: boolean;
  acquisitionDistanceM: number | null;
  lastDistanceBeforeAcquisitionM: number | null;
  enemyAttackCount: number;
  playerHealth: number;
  firstAttackDistanceM: number | null;
  firstAttackTimeS: number | null;
  secondAttackTimeS: number | null;
  cooldownBlockedSteps: number;
  moveKeyDowns: number;
  moveKeyUps: number;
  maxEnemyStepM: number;
  renderedFrames: number;
  directHealthSetterExposed: false;
  directPositionSetterExposed: false;
  postPhysicsArenaClamp: false;
  passed: boolean;
}

declare global {
  interface Window {
    __byjttCombatObservation?: () => Readonly<CombatObservation>;
  }
}

class CombatScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Arc;
  private enemy!: Phaser.GameObjects.Arc;
  private playerBody!: Phaser.Physics.Arcade.Body;
  private enemyBody!: Phaser.Physics.Arcade.Body;
  private moveKey!: Phaser.Input.Keyboard.Key;
  private acquired = false;
  private acquisitionDistanceM: number | null = null;
  private lastDistanceBeforeAcquisitionM: number | null = null;
  private enemyAttackCount = 0;
  private playerHealth = PLAYER_MAX_HEALTH;
  private firstAttackDistanceM: number | null = null;
  private firstAttackTimeS: number | null = null;
  private secondAttackTimeS: number | null = null;
  private nextAttackAtS = 0;
  private cooldownBlockedSteps = 0;
  private moveKeyDowns = 0;
  private moveKeyUps = 0;
  private maxEnemyStepM = 0;
  private previousEnemy = new Phaser.Math.Vector2();
  private renderedFrames = 0;

  constructor() {
    super('combat');
  }

  create(): void {
    const arenaWidthPx = ARENA_WIDTH_M * METRES_TO_PX;
    const arenaDepthPx = ARENA_DEPTH_M * METRES_TO_PX;
    const originX = (390 - arenaWidthPx) / 2;
    const originY = (844 - arenaDepthPx) / 2;
    const toScreen = (x: number, z: number) => ({
      x: originX + arenaWidthPx / 2 + x * METRES_TO_PX,
      y: originY + arenaDepthPx / 2 + z * METRES_TO_PX,
    });

    this.add.rectangle(195, 422, arenaWidthPx, arenaDepthPx, 0x1b2028).setStrokeStyle(2, 0x7f8c9b);
    this.physics.world.setBounds(originX, originY, arenaWidthPx, arenaDepthPx, true, true, true, true);

    const playerSpawn = toScreen(PLAYER_SPAWN.x, PLAYER_SPAWN.z);
    const enemySpawn = toScreen(ENEMY_SPAWN.x, ENEMY_SPAWN.z);
    const radiusPx = PLAYER_RADIUS_M * METRES_TO_PX;

    this.player = this.add.circle(playerSpawn.x, playerSpawn.y, radiusPx, 0x7ad7ff);
    this.enemy = this.add.circle(enemySpawn.x, enemySpawn.y, radiusPx, 0xff7f7f);
    this.physics.add.existing(this.player);
    this.physics.add.existing(this.enemy);
    this.playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    this.enemyBody = this.enemy.body as Phaser.Physics.Arcade.Body;
    this.playerBody.setCircle(radiusPx).setCollideWorldBounds(true);
    this.enemyBody.setCircle(radiusPx).setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.enemy);

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input unavailable');
    this.moveKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.moveKey.on('down', () => { this.moveKeyDowns += 1; });
    this.moveKey.on('up', () => { this.moveKeyUps += 1; });
    this.previousEnemy.set(this.enemy.x, this.enemy.y);

    window.__byjttCombatObservation = () => Object.freeze(this.snapshot(originX, originY, arenaWidthPx, arenaDepthPx));
  }

  update(timeMs: number): void {
    this.renderedFrames += 1;
    const separationM = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.enemy.x, this.enemy.y) / METRES_TO_PX;

    const playerVelocity = this.moveKey.isDown ? -PLAYER_SPEED_MPS * METRES_TO_PX : 0;
    this.playerBody.setVelocity(0, playerVelocity);

    if (!this.acquired) {
      if (separationM <= ACQUIRE_RANGE_M) {
        this.acquired = true;
        this.acquisitionDistanceM = separationM;
      } else {
        this.lastDistanceBeforeAcquisitionM = separationM;
        this.enemyBody.setVelocity(0, 0);
      }
    }

    if (this.acquired) {
      if (separationM > ATTACK_RANGE_M) {
        const direction = new Phaser.Math.Vector2(this.player.x - this.enemy.x, this.player.y - this.enemy.y).normalize();
        this.enemyBody.setVelocity(direction.x * ENEMY_SPEED_MPS * METRES_TO_PX, direction.y * ENEMY_SPEED_MPS * METRES_TO_PX);
      } else {
        this.enemyBody.setVelocity(0, 0);
        const nowS = timeMs / 1000;
        if (nowS + 1e-9 >= this.nextAttackAtS) {
          this.enemyAttackCount += 1;
          this.playerHealth -= ATTACK_DAMAGE;
          if (this.enemyAttackCount === 1) {
            this.firstAttackDistanceM = separationM;
            this.firstAttackTimeS = nowS;
          } else if (this.enemyAttackCount === 2) {
            this.secondAttackTimeS = nowS;
          }
          this.nextAttackAtS = nowS + ATTACK_COOLDOWN_S;
        } else {
          this.cooldownBlockedSteps += 1;
        }
      }
    }

    const enemyStepM = Phaser.Math.Distance.Between(this.previousEnemy.x, this.previousEnemy.y, this.enemy.x, this.enemy.y) / METRES_TO_PX;
    this.maxEnemyStepM = Math.max(this.maxEnemyStepM, enemyStepM);
    this.previousEnemy.set(this.enemy.x, this.enemy.y);
  }

  private snapshot(originX: number, originY: number, arenaWidthPx: number, arenaDepthPx: number): CombatObservation {
    const toLogical = (x: number, y: number) => ({
      x: (x - (originX + arenaWidthPx / 2)) / METRES_TO_PX,
      z: (y - (originY + arenaDepthPx / 2)) / METRES_TO_PX,
    });
    const player = toLogical(this.player.x, this.player.y);
    const enemy = toLogical(this.enemy.x, this.enemy.y);
    const separationM = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.enemy.x, this.enemy.y) / METRES_TO_PX;
    const secondCooldownValid = this.firstAttackTimeS !== null && this.secondAttackTimeS !== null
      ? this.secondAttackTimeS - this.firstAttackTimeS >= ATTACK_COOLDOWN_S - 0.02
      : false;
    const passed = this.enemyAttackCount >= 2
      && this.playerHealth === 60
      && this.acquisitionDistanceM !== null
      && this.acquisitionDistanceM <= ACQUIRE_RANGE_M
      && this.lastDistanceBeforeAcquisitionM !== null
      && this.lastDistanceBeforeAcquisitionM > ACQUIRE_RANGE_M
      && this.firstAttackDistanceM !== null
      && this.firstAttackDistanceM <= ATTACK_RANGE_M
      && secondCooldownValid
      && this.cooldownBlockedSteps > 0
      && this.moveKeyDowns >= 1
      && this.moveKeyUps >= 1
      && this.maxEnemyStepM <= ENEMY_SPEED_MPS / 60 + 0.02;

    return {
      ready: true,
      phaserVersion: Phaser.VERSION,
      arenaWidthM: ARENA_WIDTH_M,
      arenaDepthM: ARENA_DEPTH_M,
      playerX: player.x,
      playerZ: player.z,
      enemyX: enemy.x,
      enemyZ: enemy.z,
      separationM,
      acquired: this.acquired,
      acquisitionDistanceM: this.acquisitionDistanceM,
      lastDistanceBeforeAcquisitionM: this.lastDistanceBeforeAcquisitionM,
      enemyAttackCount: this.enemyAttackCount,
      playerHealth: this.playerHealth,
      firstAttackDistanceM: this.firstAttackDistanceM,
      firstAttackTimeS: this.firstAttackTimeS,
      secondAttackTimeS: this.secondAttackTimeS,
      cooldownBlockedSteps: this.cooldownBlockedSteps,
      moveKeyDowns: this.moveKeyDowns,
      moveKeyUps: this.moveKeyUps,
      maxEnemyStepM: this.maxEnemyStepM,
      renderedFrames: this.renderedFrames,
      directHealthSetterExposed: false,
      directPositionSetterExposed: false,
      postPhysicsArenaClamp: false,
      passed,
    };
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: 390,
  height: 844,
  parent: 'app',
  backgroundColor: '#101216',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      fps: 60,
      fixedStep: true,
      debug: false,
    },
  },
  scene: CombatScene,
  render: { antialias: false, pixelArt: true },
});
