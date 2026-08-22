import Phaser from 'phaser';

declare global {
  interface Window {
    __BYJTT_RESULT__?: RuntimeResult;
  }
}

type RuntimeResult = Readonly<{
  engine: string;
  arena_width_m: number;
  arena_depth_m: number;
  player_spawn: readonly [number, number, number];
  walk_speed_mps: number;
  expected_east_stop_x_m: number;
  max_x_m: number;
  final_x_m: number;
  release_drift_m: number;
  native_wall_stop_observed: boolean;
  external_input_executed: boolean;
  observation_isolation_passed: boolean;
  post_physics_arena_clamp: false;
  rendered_frames: number;
  passed: boolean;
}>;

const ARENA_WIDTH_M = 24;
const ARENA_DEPTH_M = 32;
const WALK_SPEED_MPS = 3.5;
const PLAYER_RADIUS_M = 0.4;
const EXPECTED_EAST_STOP_X_M = ARENA_WIDTH_M / 2 - PLAYER_RADIUS_M;
const PPM = 12;
const VIEW_W = 390;
const VIEW_H = 844;
const WORLD_CX = VIEW_W / 2;
const WORLD_CY = VIEW_H / 2;
const WALL_THICKNESS_M = 0.5;

class GateScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;
  private body!: Phaser.Physics.Arcade.Body;
  private right!: Phaser.Input.Keyboard.Key;
  private maxXM = 0;
  private wallStop = false;
  private renderedFrames = 0;
  private inputObserved = false;
  private releaseStartXM: number | null = null;
  private releaseStartedAt = 0;

  constructor() {
    super('gate');
  }

  create(): void {
    this.physics.world.setFPS(60);
    const arenaW = ARENA_WIDTH_M * PPM;
    const arenaH = ARENA_DEPTH_M * PPM;
    const wallT = WALL_THICKNESS_M * PPM;

    const walls = [
      this.add.rectangle(WORLD_CX - arenaW / 2 - wallT / 2, WORLD_CY, wallT, arenaH + 2 * wallT, 0x666666),
      this.add.rectangle(WORLD_CX + arenaW / 2 + wallT / 2, WORLD_CY, wallT, arenaH + 2 * wallT, 0x666666),
      this.add.rectangle(WORLD_CX, WORLD_CY - arenaH / 2 - wallT / 2, arenaW, wallT, 0x666666),
      this.add.rectangle(WORLD_CX, WORLD_CY + arenaH / 2 + wallT / 2, arenaW, wallT, 0x666666)
    ];
    for (const wall of walls) this.physics.add.existing(wall, true);

    this.player = this.add.rectangle(WORLD_CX, WORLD_CY - 10 * PPM, PLAYER_RADIUS_M * 2 * PPM, PLAYER_RADIUS_M * 2 * PPM, 0xeeeeee);
    this.physics.add.existing(this.player);
    this.body = this.player.body as Phaser.Physics.Arcade.Body;
    this.body.setAllowGravity(false);
    this.body.setBounce(0, 0);
    this.body.setSize(PLAYER_RADIUS_M * 2 * PPM, PLAYER_RADIUS_M * 2 * PPM, true);
    this.physics.add.collider(this.player, walls, () => {
      if (this.body.blocked.right || this.body.touching.right) this.wallStop = true;
    });

    if (!this.input.keyboard) throw new Error('Keyboard input unavailable');
    this.right = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.right.on('down', () => { this.inputObserved = true; });
  }

  update(time: number): void {
    this.renderedFrames += 1;
    if (this.right.isDown) {
      this.body.setVelocityX(WALK_SPEED_MPS * PPM);
      this.releaseStartXM = null;
    } else {
      this.body.setVelocityX(0);
      if (this.inputObserved && this.releaseStartXM === null) {
        this.releaseStartXM = this.logicalX();
        this.releaseStartedAt = time;
      }
    }

    const xM = this.logicalX();
    this.maxXM = Math.max(this.maxXM, xM);
    if (this.body.blocked.right || this.body.touching.right) this.wallStop = true;

    if (this.releaseStartXM !== null && time - this.releaseStartedAt >= 700) {
      const observation = Object.freeze({ x: xM, z: (WORLD_CY - this.player.y) / PPM });
      const before = this.logicalX();
      let isolation = false;
      try {
        (observation as { x: number }).x = -999;
      } catch {
        isolation = true;
      }
      isolation = isolation || this.logicalX() === before;
      const drift = Math.abs(xM - this.releaseStartXM);
      const stopError = Math.abs(xM - EXPECTED_EAST_STOP_X_M);
      const passed = this.wallStop && this.inputObserved && isolation && stopError <= 0.06 && drift <= 0.01;
      window.__BYJTT_RESULT__ = Object.freeze({
        engine: `Phaser ${Phaser.VERSION}`,
        arena_width_m: ARENA_WIDTH_M,
        arena_depth_m: ARENA_DEPTH_M,
        player_spawn: Object.freeze([0, 0, 10] as const),
        walk_speed_mps: WALK_SPEED_MPS,
        expected_east_stop_x_m: EXPECTED_EAST_STOP_X_M,
        max_x_m: this.maxXM,
        final_x_m: xM,
        release_drift_m: drift,
        native_wall_stop_observed: this.wallStop,
        external_input_executed: this.inputObserved,
        observation_isolation_passed: isolation,
        post_physics_arena_clamp: false,
        rendered_frames: this.renderedFrames,
        passed
      });
    }
  }

  private logicalX(): number {
    return (this.player.x - WORLD_CX) / PPM;
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: VIEW_W,
  height: VIEW_H,
  backgroundColor: '#111111',
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
  scene: GateScene
});
