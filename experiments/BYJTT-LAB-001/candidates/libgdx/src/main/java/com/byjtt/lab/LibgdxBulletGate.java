package com.byjtt.lab;

import com.badlogic.gdx.math.Matrix4;
import com.badlogic.gdx.math.Vector3;
import com.badlogic.gdx.physics.bullet.Bullet;
import com.badlogic.gdx.physics.bullet.collision.btBoxShape;
import com.badlogic.gdx.physics.bullet.collision.btCapsuleShape;
import com.badlogic.gdx.physics.bullet.collision.btCollisionShape;
import com.badlogic.gdx.physics.bullet.collision.btDefaultCollisionConfiguration;
import com.badlogic.gdx.physics.bullet.collision.btCollisionDispatcher;
import com.badlogic.gdx.physics.bullet.collision.btDbvtBroadphase;
import com.badlogic.gdx.physics.bullet.dynamics.btDiscreteDynamicsWorld;
import com.badlogic.gdx.physics.bullet.dynamics.btRigidBody;
import com.badlogic.gdx.physics.bullet.dynamics.btSequentialImpulseConstraintSolver;
import com.badlogic.gdx.physics.bullet.linearmath.btDefaultMotionState;
import com.badlogic.gdx.utils.Disposable;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Bounded native-physics feasibility tracer for BYJTT-LAB-001.
 *
 * <p>The shared contract is consumed as constants only. The physics body uses a centre-height offset while
 * the contract position remains the capsule's ground-space position. There is deliberately no post-physics
 * arena clamp.</p>
 */
public final class LibgdxBulletGate {
  private static final float ARENA_WIDTH = 24.0f;
  private static final float ARENA_DEPTH = 32.0f;
  private static final float CONTRACT_SPAWN_X = 0.0f;
  private static final float CONTRACT_SPAWN_Y = 0.0f;
  private static final float CONTRACT_SPAWN_Z = 10.0f;
  private static final float WALK_SPEED = 3.5f;
  private static final float FIXED_DT = 1.0f / 60.0f;
  private static final int DRIVE_STEPS = 300;
  private static final int RELEASE_STEPS = 60;
  private static final float CAPSULE_RADIUS = 0.60f;
  private static final float CAPSULE_CYLINDER_HEIGHT = 1.20f;
  private static final float CAPSULE_CENTER_HEIGHT =
      (CAPSULE_CYLINDER_HEIGHT + 2.0f * CAPSULE_RADIUS) * 0.5f;
  private static final float WALL_THICKNESS = 0.50f;
  private static final float EAST_WALL_INNER_FACE_X = ARENA_WIDTH * 0.5f;
  private static final float EXPECTED_CENTER_CEILING_X = EAST_WALL_INNER_FACE_X - CAPSULE_RADIUS;
  private static final float POSITION_TOLERANCE = 0.04f;
  private static final float RELEASE_DRIFT_TOLERANCE = 0.01f;

  private LibgdxBulletGate() {}

  public static void main(String[] args) throws Exception {
    Locale.setDefault(Locale.ROOT);
    Path resultPath = args.length > 0 ? Path.of(args[0]) : Path.of("artifacts/physics-gate/result.json");
    Files.createDirectories(resultPath.getParent());
    GateResult result = execute();
    Files.writeString(resultPath, result.toJson(), StandardCharsets.UTF_8);
    System.out.println(result.toJson());
    if (!result.passed()) {
      throw new IllegalStateException("libGDX Bullet feasibility gate failed");
    }
  }

  static GateResult execute() throws IOException {
    Bullet.init();

    List<Disposable> disposables = new ArrayList<>();
    btDefaultCollisionConfiguration collisionConfig = track(disposables, new btDefaultCollisionConfiguration());
    btCollisionDispatcher dispatcher = track(disposables, new btCollisionDispatcher(collisionConfig));
    btDbvtBroadphase broadphase = track(disposables, new btDbvtBroadphase());
    btSequentialImpulseConstraintSolver solver = track(disposables, new btSequentialImpulseConstraintSolver());
    btDiscreteDynamicsWorld world =
        track(disposables, new btDiscreteDynamicsWorld(dispatcher, broadphase, solver, collisionConfig));
    world.setGravity(new Vector3(0.0f, -9.81f, 0.0f));

    try {
      addStaticBox(
          disposables,
          world,
          new Vector3(ARENA_WIDTH * 0.5f, 0.25f, ARENA_DEPTH * 0.5f),
          new Vector3(0.0f, -0.25f, 0.0f));
      addStaticBox(
          disposables,
          world,
          new Vector3(WALL_THICKNESS * 0.5f, 2.0f, ARENA_DEPTH * 0.5f),
          new Vector3(-(ARENA_WIDTH + WALL_THICKNESS) * 0.5f, 2.0f, 0.0f));
      addStaticBox(
          disposables,
          world,
          new Vector3(WALL_THICKNESS * 0.5f, 2.0f, ARENA_DEPTH * 0.5f),
          new Vector3((ARENA_WIDTH + WALL_THICKNESS) * 0.5f, 2.0f, 0.0f));
      addStaticBox(
          disposables,
          world,
          new Vector3(ARENA_WIDTH * 0.5f, 2.0f, WALL_THICKNESS * 0.5f),
          new Vector3(0.0f, 2.0f, -(ARENA_DEPTH + WALL_THICKNESS) * 0.5f));
      addStaticBox(
          disposables,
          world,
          new Vector3(ARENA_WIDTH * 0.5f, 2.0f, WALL_THICKNESS * 0.5f),
          new Vector3(0.0f, 2.0f, (ARENA_DEPTH + WALL_THICKNESS) * 0.5f));

      btCapsuleShape playerShape =
          track(disposables, new btCapsuleShape(CAPSULE_RADIUS, CAPSULE_CYLINDER_HEIGHT));
      Vector3 localInertia = new Vector3();
      playerShape.calculateLocalInertia(1.0f, localInertia);
      btDefaultMotionState playerMotion =
          track(
              disposables,
              new btDefaultMotionState(
                  new Matrix4()
                      .setToTranslation(
                          CONTRACT_SPAWN_X,
                          CONTRACT_SPAWN_Y + CAPSULE_CENTER_HEIGHT,
                          CONTRACT_SPAWN_Z)));
      btRigidBody.btRigidBodyConstructionInfo playerInfo =
          track(
              disposables,
              new btRigidBody.btRigidBodyConstructionInfo(1.0f, playerMotion, playerShape, localInertia));
      btRigidBody player = track(disposables, new btRigidBody(playerInfo));
      player.setAngularFactor(Vector3.Zero);
      player.setFriction(0.0f);
      world.addRigidBody(player);

      Matrix4 transform = new Matrix4();
      Vector3 position = new Vector3();
      float maximumX = Float.NEGATIVE_INFINITY;

      for (int step = 0; step < DRIVE_STEPS; step++) {
        Vector3 velocity = player.getLinearVelocity();
        player.setLinearVelocity(new Vector3(WALK_SPEED, velocity.y, 0.0f));
        player.activate();
        world.stepSimulation(FIXED_DT, 1, FIXED_DT);
        player.getWorldTransform(transform);
        transform.getTranslation(position);
        maximumX = Math.max(maximumX, position.x);
      }

      player.getWorldTransform(transform);
      transform.getTranslation(position);
      float releaseStartX = position.x;

      for (int step = 0; step < RELEASE_STEPS; step++) {
        Vector3 velocity = player.getLinearVelocity();
        player.setLinearVelocity(new Vector3(0.0f, velocity.y, 0.0f));
        player.activate();
        world.stepSimulation(FIXED_DT, 1, FIXED_DT);
      }

      player.getWorldTransform(transform);
      transform.getTranslation(position);
      float finalCenterX = position.x;
      float finalGroundY = position.y - CAPSULE_CENTER_HEIGHT;
      float finalZ = position.z;
      float finalVelocityX = player.getLinearVelocity().x;
      float releaseDrift = Math.abs(finalCenterX - releaseStartX);

      Observation observation =
          new Observation(finalCenterX, finalGroundY, finalZ, finalVelocityX, maximumX);
      Observation copy = observation.copy();
      copy.x = -999.0f;
      copy.maximumX = 999.0f;
      boolean observationCopyIsolated =
          observation.x != copy.x && observation.maximumX != copy.maximumX;

      boolean nativeWallStopObserved =
          maximumX <= EXPECTED_CENTER_CEILING_X + POSITION_TOLERANCE
              && finalCenterX <= EXPECTED_CENTER_CEILING_X + POSITION_TOLERANCE
              && finalCenterX >= EXPECTED_CENTER_CEILING_X - 0.12f
              && DRIVE_STEPS * FIXED_DT * WALK_SPEED > EAST_WALL_INNER_FACE_X;
      boolean releaseStable = releaseDrift <= RELEASE_DRIFT_TOLERANCE;
      boolean passed = nativeWallStopObserved && releaseStable && observationCopyIsolated;

      return new GateResult(
          passed,
          "1.14.2",
          "gdx-bullet",
          ARENA_WIDTH,
          ARENA_DEPTH,
          CONTRACT_SPAWN_X,
          CONTRACT_SPAWN_Y,
          CONTRACT_SPAWN_Z,
          WALK_SPEED,
          DRIVE_STEPS,
          RELEASE_STEPS,
          EXPECTED_CENTER_CEILING_X,
          maximumX,
          finalCenterX,
          finalGroundY,
          finalZ,
          finalVelocityX,
          releaseDrift,
          nativeWallStopObserved,
          releaseStable,
          observationCopyIsolated,
          false,
          false);
    } finally {
      for (int index = disposables.size() - 1; index >= 0; index--) {
        disposables.get(index).dispose();
      }
    }
  }

  private static void addStaticBox(
      List<Disposable> disposables,
      btDiscreteDynamicsWorld world,
      Vector3 halfExtents,
      Vector3 center) {
    btCollisionShape shape = track(disposables, new btBoxShape(halfExtents));
    btDefaultMotionState motion =
        track(disposables, new btDefaultMotionState(new Matrix4().setToTranslation(center)));
    btRigidBody.btRigidBodyConstructionInfo info =
        track(
            disposables,
            new btRigidBody.btRigidBodyConstructionInfo(0.0f, motion, shape, Vector3.Zero));
    btRigidBody body = track(disposables, new btRigidBody(info));
    world.addRigidBody(body);
  }

  private static <T extends Disposable> T track(List<Disposable> disposables, T value) {
    disposables.add(value);
    return value;
  }

  static final class Observation {
    float x;
    float groundY;
    float z;
    float velocityX;
    float maximumX;

    Observation(float x, float groundY, float z, float velocityX, float maximumX) {
      this.x = x;
      this.groundY = groundY;
      this.z = z;
      this.velocityX = velocityX;
      this.maximumX = maximumX;
    }

    Observation copy() {
      return new Observation(x, groundY, z, velocityX, maximumX);
    }
  }

  record GateResult(
      boolean passed,
      String libgdxVersion,
      String physicsBackend,
      float arenaWidth,
      float arenaDepth,
      float contractSpawnX,
      float contractSpawnY,
      float contractSpawnZ,
      float walkSpeed,
      int driveSteps,
      int releaseSteps,
      float expectedCenterCeilingX,
      float maximumCenterX,
      float finalCenterX,
      float finalGroundY,
      float finalZ,
      float finalVelocityX,
      float releaseDrift,
      boolean nativeWallStopObserved,
      boolean releaseStable,
      boolean observationCopyIsolated,
      boolean postPhysicsArenaClamp,
      boolean externalInputExecuted) {

    String toJson() {
      return String.format(
          Locale.ROOT,
          "{\n"
              + "  \"passed\": %s,\n"
              + "  \"libgdx_version\": \"%s\",\n"
              + "  \"physics_backend\": \"%s\",\n"
              + "  \"arena_width_m\": %.6f,\n"
              + "  \"arena_depth_m\": %.6f,\n"
              + "  \"contract_spawn\": [%.6f, %.6f, %.6f],\n"
              + "  \"walk_speed_mps\": %.6f,\n"
              + "  \"drive_steps\": %d,\n"
              + "  \"release_steps\": %d,\n"
              + "  \"fixed_dt_seconds\": %.9f,\n"
              + "  \"expected_center_ceiling_x_m\": %.6f,\n"
              + "  \"maximum_center_x_m\": %.6f,\n"
              + "  \"final_center_x_m\": %.6f,\n"
              + "  \"final_ground_y_m\": %.6f,\n"
              + "  \"final_z_m\": %.6f,\n"
              + "  \"final_velocity_x_mps\": %.9f,\n"
              + "  \"release_drift_m\": %.9f,\n"
              + "  \"native_wall_stop_observed\": %s,\n"
              + "  \"release_stable\": %s,\n"
              + "  \"observation_copy_isolated\": %s,\n"
              + "  \"post_physics_arena_clamp\": %s,\n"
              + "  \"external_input_executed\": %s\n"
              + "}\n",
          passed,
          libgdxVersion,
          physicsBackend,
          arenaWidth,
          arenaDepth,
          contractSpawnX,
          contractSpawnY,
          contractSpawnZ,
          walkSpeed,
          driveSteps,
          releaseSteps,
          FIXED_DT,
          expectedCenterCeilingX,
          maximumCenterX,
          finalCenterX,
          finalGroundY,
          finalZ,
          finalVelocityX,
          releaseDrift,
          nativeWallStopObserved,
          releaseStable,
          observationCopyIsolated,
          postPhysicsArenaClamp,
          externalInputExecuted);
    }
  }
}
