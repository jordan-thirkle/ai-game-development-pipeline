package com.byjtt.lab;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Input;
import com.badlogic.gdx.InputAdapter;
import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.graphics.GL20;
import com.badlogic.gdx.graphics.OrthographicCamera;
import com.badlogic.gdx.graphics.glutils.ShapeRenderer;
import com.badlogic.gdx.backends.lwjgl3.Lwjgl3Application;
import com.badlogic.gdx.backends.lwjgl3.Lwjgl3ApplicationConfiguration;
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
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Rendered desktop + normal-input feasibility gate for BYJTT-LAB-001. */
public final class LibgdxRenderedInputGate extends ApplicationAdapter {
  private static final float ARENA_WIDTH = 24.0f;
  private static final float ARENA_DEPTH = 32.0f;
  private static final float SPAWN_X = 0.0f;
  private static final float SPAWN_Y = 0.0f;
  private static final float SPAWN_Z = 10.0f;
  private static final float WALK_SPEED = 3.5f;
  private static final float FIXED_DT = 1.0f / 60.0f;
  private static final int RELEASE_STEPS_REQUIRED = 60;
  private static final float CAPSULE_RADIUS = 0.60f;
  private static final float CAPSULE_CYLINDER_HEIGHT = 1.20f;
  private static final float CAPSULE_CENTER_HEIGHT =
      (CAPSULE_CYLINDER_HEIGHT + 2.0f * CAPSULE_RADIUS) * 0.5f;
  private static final float WALL_THICKNESS = 0.50f;
  private static final float EXPECTED_CENTER_CEILING_X = ARENA_WIDTH * 0.5f - CAPSULE_RADIUS;
  private static final float POSITION_TOLERANCE = 0.04f;
  private static final float RELEASE_DRIFT_TOLERANCE = 0.01f;
  private static final long TIMEOUT_NANOS = 25_000_000_000L;

  private static Path resultPath;

  private final List<Disposable> disposables = new ArrayList<>();
  private btDiscreteDynamicsWorld world;
  private btRigidBody player;
  private ShapeRenderer renderer;
  private OrthographicCamera camera;
  private final Matrix4 playerTransform = new Matrix4();
  private final Vector3 playerPosition = new Vector3();
  private boolean moveRight;
  private boolean releaseStarted;
  private int releaseSteps;
  private int inputPressCallbacks;
  private int inputReleaseCallbacks;
  private int renderedFrames;
  private float maximumX = Float.NEGATIVE_INFINITY;
  private float releaseStartX;
  private long startedAt;
  private boolean finished;

  public static void main(String[] args) {
    Locale.setDefault(Locale.ROOT);
    resultPath = args.length > 0 ? Path.of(args[0]) : Path.of("artifacts/render-input/result.json");
    Lwjgl3ApplicationConfiguration config = new Lwjgl3ApplicationConfiguration();
    config.setTitle("BYJTT-LAB-001 libGDX Bullet");
    config.setWindowedMode(960, 540);
    config.setForegroundFPS(60);
    config.setIdleFPS(60);
    config.useVsync(false);
    new Lwjgl3Application(new LibgdxRenderedInputGate(), config);
  }

  @Override
  public void create() {
    startedAt = System.nanoTime();
    Bullet.init();

    btDefaultCollisionConfiguration collisionConfig = track(new btDefaultCollisionConfiguration());
    btCollisionDispatcher dispatcher = track(new btCollisionDispatcher(collisionConfig));
    btDbvtBroadphase broadphase = track(new btDbvtBroadphase());
    btSequentialImpulseConstraintSolver solver = track(new btSequentialImpulseConstraintSolver());
    world = track(new btDiscreteDynamicsWorld(dispatcher, broadphase, solver, collisionConfig));
    world.setGravity(new Vector3(0.0f, -9.81f, 0.0f));

    addStaticBox(
        new Vector3(ARENA_WIDTH * 0.5f, 0.25f, ARENA_DEPTH * 0.5f),
        new Vector3(0.0f, -0.25f, 0.0f));
    addStaticBox(
        new Vector3(WALL_THICKNESS * 0.5f, 2.0f, ARENA_DEPTH * 0.5f),
        new Vector3(-(ARENA_WIDTH + WALL_THICKNESS) * 0.5f, 2.0f, 0.0f));
    addStaticBox(
        new Vector3(WALL_THICKNESS * 0.5f, 2.0f, ARENA_DEPTH * 0.5f),
        new Vector3((ARENA_WIDTH + WALL_THICKNESS) * 0.5f, 2.0f, 0.0f));
    addStaticBox(
        new Vector3(ARENA_WIDTH * 0.5f, 2.0f, WALL_THICKNESS * 0.5f),
        new Vector3(0.0f, 2.0f, -(ARENA_DEPTH + WALL_THICKNESS) * 0.5f));
    addStaticBox(
        new Vector3(ARENA_WIDTH * 0.5f, 2.0f, WALL_THICKNESS * 0.5f),
        new Vector3(0.0f, 2.0f, (ARENA_DEPTH + WALL_THICKNESS) * 0.5f));

    btCapsuleShape playerShape = track(new btCapsuleShape(CAPSULE_RADIUS, CAPSULE_CYLINDER_HEIGHT));
    Vector3 localInertia = new Vector3();
    playerShape.calculateLocalInertia(1.0f, localInertia);
    btDefaultMotionState playerMotion =
        track(
            new btDefaultMotionState(
                new Matrix4().setToTranslation(SPAWN_X, SPAWN_Y + CAPSULE_CENTER_HEIGHT, SPAWN_Z)));
    btRigidBody.btRigidBodyConstructionInfo playerInfo =
        track(new btRigidBody.btRigidBodyConstructionInfo(1.0f, playerMotion, playerShape, localInertia));
    player = track(new btRigidBody(playerInfo));
    player.setAngularFactor(Vector3.Zero);
    player.setFriction(0.0f);
    world.addRigidBody(player);

    camera = new OrthographicCamera(28.0f, 36.0f);
    camera.position.set(0.0f, 0.0f, 0.0f);
    camera.update();
    renderer = new ShapeRenderer();

    Gdx.input.setInputProcessor(
        new InputAdapter() {
          @Override
          public boolean keyDown(int keycode) {
            if (keycode == Input.Keys.D) {
              moveRight = true;
              inputPressCallbacks++;
              return true;
            }
            return false;
          }

          @Override
          public boolean keyUp(int keycode) {
            if (keycode == Input.Keys.D) {
              moveRight = false;
              inputReleaseCallbacks++;
              if (!releaseStarted) {
                player.getWorldTransform(playerTransform);
                playerTransform.getTranslation(playerPosition);
                releaseStartX = playerPosition.x;
                releaseStarted = true;
              }
              return true;
            }
            return false;
          }
        });
  }

  @Override
  public void render() {
    if (finished) {
      return;
    }
    renderedFrames++;
    stepPhysics();
    renderScene();

    if (releaseStarted && releaseSteps >= RELEASE_STEPS_REQUIRED) {
      finish(false);
    } else if (System.nanoTime() - startedAt > TIMEOUT_NANOS) {
      finish(true);
    }
  }

  private void stepPhysics() {
    Vector3 velocity = player.getLinearVelocity();
    float xVelocity = moveRight ? WALK_SPEED : 0.0f;
    player.setLinearVelocity(new Vector3(xVelocity, velocity.y, 0.0f));
    player.activate();
    world.stepSimulation(FIXED_DT, 1, FIXED_DT);
    player.getWorldTransform(playerTransform);
    playerTransform.getTranslation(playerPosition);
    maximumX = Math.max(maximumX, playerPosition.x);
    if (releaseStarted && !moveRight) {
      releaseSteps++;
    }
  }

  private void renderScene() {
    Gdx.gl.glClearColor(0.02f, 0.02f, 0.03f, 1.0f);
    Gdx.gl.glClear(GL20.GL_COLOR_BUFFER_BIT);
    renderer.setProjectionMatrix(camera.combined);
    renderer.begin(ShapeRenderer.ShapeType.Line);
    renderer.setColor(Color.LIGHT_GRAY);
    renderer.rect(-ARENA_WIDTH * 0.5f, -ARENA_DEPTH * 0.5f, ARENA_WIDTH, ARENA_DEPTH);
    renderer.setColor(Color.CYAN);
    renderer.circle(playerPosition.x, playerPosition.z, CAPSULE_RADIUS, 24);
    renderer.end();
  }

  private void finish(boolean timedOut) {
    finished = true;
    player.getWorldTransform(playerTransform);
    playerTransform.getTranslation(playerPosition);
    float finalX = playerPosition.x;
    float finalGroundY = playerPosition.y - CAPSULE_CENTER_HEIGHT;
    float finalVelocityX = player.getLinearVelocity().x;
    float releaseDrift = releaseStarted ? Math.abs(finalX - releaseStartX) : Float.POSITIVE_INFINITY;

    Observation observation = new Observation(finalX, maximumX);
    Observation copy = observation.copy();
    copy.x = -999.0f;
    copy.maximumX = 999.0f;
    boolean observationCopyIsolated =
        observation.x != copy.x && observation.maximumX != copy.maximumX;
    boolean nativeWallStopObserved =
        maximumX <= EXPECTED_CENTER_CEILING_X + POSITION_TOLERANCE
            && finalX <= EXPECTED_CENTER_CEILING_X + POSITION_TOLERANCE
            && finalX >= EXPECTED_CENTER_CEILING_X - 0.12f;
    boolean releaseStable = releaseDrift <= RELEASE_DRIFT_TOLERANCE;
    boolean passed =
        !timedOut
            && inputPressCallbacks > 0
            && inputReleaseCallbacks > 0
            && renderedFrames > 0
            && nativeWallStopObserved
            && releaseStable
            && observationCopyIsolated;

    String json =
        String.format(
            Locale.ROOT,
            "{\n"
                + "  \"passed\": %s,\n"
                + "  \"libgdx_version\": \"1.14.2\",\n"
                + "  \"physics_backend\": \"gdx-bullet\",\n"
                + "  \"desktop_backend\": \"gdx-backend-lwjgl3\",\n"
                + "  \"arena_width_m\": %.6f,\n"
                + "  \"arena_depth_m\": %.6f,\n"
                + "  \"contract_spawn\": [%.6f, %.6f, %.6f],\n"
                + "  \"walk_speed_mps\": %.6f,\n"
                + "  \"expected_center_ceiling_x_m\": %.6f,\n"
                + "  \"maximum_center_x_m\": %.6f,\n"
                + "  \"final_center_x_m\": %.6f,\n"
                + "  \"final_ground_y_m\": %.6f,\n"
                + "  \"final_z_m\": %.6f,\n"
                + "  \"final_velocity_x_mps\": %.9f,\n"
                + "  \"release_drift_m\": %.9f,\n"
                + "  \"input_press_callbacks\": %d,\n"
                + "  \"input_release_callbacks\": %d,\n"
                + "  \"rendered_frames\": %d,\n"
                + "  \"rendered_window_executed\": true,\n"
                + "  \"external_input_executed\": %s,\n"
                + "  \"native_wall_stop_observed\": %s,\n"
                + "  \"release_stable\": %s,\n"
                + "  \"observation_copy_isolated\": %s,\n"
                + "  \"post_physics_arena_clamp\": false,\n"
                + "  \"timed_out\": %s\n"
                + "}\n",
            passed,
            ARENA_WIDTH,
            ARENA_DEPTH,
            SPAWN_X,
            SPAWN_Y,
            SPAWN_Z,
            WALK_SPEED,
            EXPECTED_CENTER_CEILING_X,
            maximumX,
            finalX,
            finalGroundY,
            playerPosition.z,
            finalVelocityX,
            releaseDrift,
            inputPressCallbacks,
            inputReleaseCallbacks,
            renderedFrames,
            inputPressCallbacks > 0 && inputReleaseCallbacks > 0,
            nativeWallStopObserved,
            releaseStable,
            observationCopyIsolated,
            timedOut);

    try {
      Files.createDirectories(resultPath.getParent());
      Files.writeString(resultPath, json, StandardCharsets.UTF_8);
      System.out.println(json);
    } catch (Exception exception) {
      exception.printStackTrace(System.err);
      Gdx.app.exit();
      return;
    }
    Gdx.app.exit();
  }

  private void addStaticBox(Vector3 halfExtents, Vector3 center) {
    btCollisionShape shape = track(new btBoxShape(halfExtents));
    btDefaultMotionState motion =
        track(new btDefaultMotionState(new Matrix4().setToTranslation(center)));
    btRigidBody.btRigidBodyConstructionInfo info =
        track(new btRigidBody.btRigidBodyConstructionInfo(0.0f, motion, shape, Vector3.Zero));
    btRigidBody body = track(new btRigidBody(info));
    world.addRigidBody(body);
  }

  private <T extends Disposable> T track(T value) {
    disposables.add(value);
    return value;
  }

  @Override
  public void dispose() {
    if (renderer != null) {
      renderer.dispose();
    }
    for (int index = disposables.size() - 1; index >= 0; index--) {
      disposables.get(index).dispose();
    }
  }

  private static final class Observation {
    float x;
    float maximumX;

    Observation(float x, float maximumX) {
      this.x = x;
      this.maximumX = maximumX;
    }

    Observation copy() {
      return new Observation(x, maximumX);
    }
  }
}
