package com.byjtt.lab;

import com.jme3.app.SimpleApplication;
import com.jme3.bullet.PhysicsSpace;
import com.jme3.bullet.collision.shapes.BoxCollisionShape;
import com.jme3.bullet.collision.shapes.CapsuleCollisionShape;
import com.jme3.bullet.objects.PhysicsCharacter;
import com.jme3.bullet.objects.PhysicsRigidBody;
import com.jme3.input.KeyInput;
import com.jme3.input.controls.ActionListener;
import com.jme3.input.controls.KeyTrigger;
import com.jme3.material.Material;
import com.jme3.math.ColorRGBA;
import com.jme3.math.Vector3f;
import com.jme3.renderer.RenderManager;
import com.jme3.scene.Geometry;
import com.jme3.scene.shape.Box;
import com.jme3.system.AppSettings;
import com.jme3.system.NativeLibraryLoader;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;

public final class MinieRenderedInputGate extends SimpleApplication implements ActionListener {
    private static final float ARENA_WIDTH = 24.0f;
    private static final float ARENA_DEPTH = 32.0f;
    private static final float WALK_SPEED = 3.5f;
    private static final Vector3f PLAYER_SPAWN = new Vector3f(0.0f, 0.0f, 10.0f);
    private static final float PLAYER_RADIUS = 0.4f;
    private static final float PLAYER_CYLINDER_HEIGHT = 1.2f;
    private static final float WALL_HALF_THICKNESS = 0.1f;
    private static final float WALL_HALF_HEIGHT = 2.0f;
    private static final float FIXED_DT = 1.0f / 60.0f;
    private static final float WALK_INCREMENT = WALK_SPEED * FIXED_DT;
    private static final float MAX_RUNTIME_SECONDS = 12.0f;
    private static final float RELEASE_OBSERVATION_SECONDS = 0.75f;
    private static final String MOVE_RIGHT = "benchmark-move-right";
    private static final String WINDOW_TITLE = "BYJTT-LAB-001 jMonkeyEngine Minie";

    private final Path resultPath;
    private PhysicsSpace physicsSpace;
    private PhysicsCharacter player;
    private Geometry playerGeometry;
    private boolean rightPressed;
    private boolean releaseSeen;
    private boolean resultWritten;
    private int pressCallbacks;
    private int releaseCallbacks;
    private long renderedFrames;
    private float elapsedSeconds;
    private float releaseElapsedSeconds;
    private float accumulator;
    private float maxX;
    private float releaseStartX;

    private MinieRenderedInputGate(Path resultPath) {
        this.resultPath = resultPath;
    }

    public static void main(String[] args) {
        Locale.setDefault(Locale.ROOT);
        Path output = args.length == 1 ? Path.of(args[0]) : Path.of("target", "render-input-result.json");
        MinieRenderedInputGate app = new MinieRenderedInputGate(output);
        AppSettings settings = new AppSettings(true);
        settings.setTitle(WINDOW_TITLE);
        settings.setResolution(960, 540);
        settings.setVSync(false);
        settings.setFrameRate(60);
        settings.setAudioRenderer(null);
        app.setSettings(settings);
        app.setShowSettings(false);
        app.setDisplayFps(false);
        app.setDisplayStatView(false);
        app.start();
    }

    @Override
    public void simpleInitApp() {
        flyCam.setEnabled(false);
        inputManager.setCursorVisible(true);
        inputManager.addMapping(MOVE_RIGHT, new KeyTrigger(KeyInput.KEY_D));
        inputManager.addListener(this, MOVE_RIGHT);

        NativeLibraryLoader.loadNativeLibrary("bulletjme", true);
        physicsSpace = new PhysicsSpace(PhysicsSpace.BroadphaseType.DBVT);
        physicsSpace.setGravity(Vector3f.ZERO);
        physicsSpace.setAccuracy(FIXED_DT);
        physicsSpace.setMaxSubSteps(1);
        addArena();

        player = new PhysicsCharacter(
                new CapsuleCollisionShape(PLAYER_RADIUS, PLAYER_CYLINDER_HEIGHT), 0.05f);
        player.setPhysicsLocation(PLAYER_SPAWN.clone());
        player.setGravity(0.0f);
        player.setFallSpeed(0.0f);
        physicsSpace.add(player);
        maxX = PLAYER_SPAWN.x;

        playerGeometry = visualBox("player", new Vector3f(PLAYER_RADIUS, 0.9f, PLAYER_RADIUS), ColorRGBA.Cyan);
        rootNode.attachChild(playerGeometry);
        syncVisualPlayer();

        cam.setLocation(new Vector3f(0.0f, 18.0f, 29.0f));
        cam.lookAt(new Vector3f(0.0f, 0.0f, 0.0f), Vector3f.UNIT_Y);
        viewPort.setBackgroundColor(new ColorRGBA(0.06f, 0.07f, 0.09f, 1.0f));
    }

    @Override
    public void onAction(String name, boolean isPressed, float tpf) {
        if (!MOVE_RIGHT.equals(name)) {
            return;
        }
        rightPressed = isPressed;
        if (isPressed) {
            pressCallbacks += 1;
        } else {
            releaseCallbacks += 1;
            releaseSeen = true;
            releaseElapsedSeconds = 0.0f;
            releaseStartX = player.getPhysicsLocation(new Vector3f()).x;
        }
    }

    @Override
    public void simpleUpdate(float tpf) {
        elapsedSeconds += tpf;
        if (releaseSeen) {
            releaseElapsedSeconds += tpf;
        }

        accumulator += Math.min(tpf, 0.25f);
        while (accumulator >= FIXED_DT) {
            player.setWalkDirection(rightPressed
                    ? new Vector3f(WALK_INCREMENT, 0.0f, 0.0f)
                    : Vector3f.ZERO);
            physicsSpace.update(FIXED_DT);
            float x = player.getPhysicsLocation(new Vector3f()).x;
            maxX = Math.max(maxX, x);
            accumulator -= FIXED_DT;
        }
        syncVisualPlayer();

        if (!resultWritten && releaseSeen && releaseElapsedSeconds >= RELEASE_OBSERVATION_SECONDS) {
            finishAndStop(false);
        } else if (!resultWritten && elapsedSeconds >= MAX_RUNTIME_SECONDS) {
            finishAndStop(true);
        }
    }

    @Override
    public void simpleRender(RenderManager renderManager) {
        renderedFrames += 1;
    }

    private void finishAndStop(boolean timedOut) {
        resultWritten = true;
        Vector3f finalPosition = player.getPhysicsLocation(new Vector3f());
        float collisionCeiling = ARENA_WIDTH / 2.0f - PLAYER_RADIUS;
        float releaseDrift = releaseSeen ? Math.abs(finalPosition.x - releaseStartX) : Float.NaN;
        boolean wallStopObserved = maxX <= collisionCeiling + 0.02f
                && finalPosition.x >= collisionCeiling - 0.10f
                && finalPosition.x <= collisionCeiling + 0.02f;
        boolean releaseStable = releaseSeen && releaseDrift <= 0.005f;

        Vector3f observationCopy = player.getPhysicsLocation(new Vector3f());
        float authoritativeX = observationCopy.x;
        observationCopy.x = -999.0f;
        boolean observationIsolation = Math.abs(
                player.getPhysicsLocation(new Vector3f()).x - authoritativeX) < 0.0001f;
        boolean externalInput = pressCallbacks > 0 && releaseCallbacks > 0;
        boolean rendered = renderedFrames > 0;
        boolean passed = !timedOut
                && externalInput
                && rendered
                && wallStopObserved
                && releaseStable
                && observationIsolation;

        try {
            Files.createDirectories(resultPath.toAbsolutePath().getParent());
            String json = String.format(Locale.ROOT,
                    "{\n"
                            + "  \"candidate\": \"jmonkeyengine-minie-render-input\",\n"
                            + "  \"requested_jme_version\": \"3.9.0-stable\",\n"
                            + "  \"minie_version\": \"9.0.3\",\n"
                            + "  \"physics_backend\": \"Minie/Libbulletjme\",\n"
                            + "  \"controller\": \"PhysicsCharacter/native character controller\",\n"
                            + "  \"input_path\": \"OS keyboard -> jME InputManager KeyTrigger -> ActionListener\",\n"
                            + "  \"window_title\": \"%s\",\n"
                            + "  \"arena_width_m\": %.1f,\n"
                            + "  \"arena_depth_m\": %.1f,\n"
                            + "  \"walk_speed_mps\": %.1f,\n"
                            + "  \"walk_increment_per_tick_m\": %.9f,\n"
                            + "  \"spawn\": [%.1f, %.1f, %.1f],\n"
                            + "  \"fixed_dt_seconds\": %.9f,\n"
                            + "  \"collision_ceiling_x_m\": %.6f,\n"
                            + "  \"max_x_m\": %.6f,\n"
                            + "  \"final_x_m\": %.6f,\n"
                            + "  \"release_drift_m\": %.9f,\n"
                            + "  \"input_press_callbacks\": %d,\n"
                            + "  \"input_release_callbacks\": %d,\n"
                            + "  \"rendered_frames\": %d,\n"
                            + "  \"external_input_executed\": %s,\n"
                            + "  \"rendered_window_executed\": %s,\n"
                            + "  \"native_wall_stop_observed\": %s,\n"
                            + "  \"release_stable\": %s,\n"
                            + "  \"post_physics_arena_clamp\": false,\n"
                            + "  \"observation_copy_isolated\": %s,\n"
                            + "  \"timed_out\": %s,\n"
                            + "  \"passed\": %s\n"
                            + "}\n",
                    WINDOW_TITLE,
                    ARENA_WIDTH,
                    ARENA_DEPTH,
                    WALK_SPEED,
                    WALK_INCREMENT,
                    PLAYER_SPAWN.x,
                    PLAYER_SPAWN.y,
                    PLAYER_SPAWN.z,
                    FIXED_DT,
                    collisionCeiling,
                    maxX,
                    finalPosition.x,
                    releaseDrift,
                    pressCallbacks,
                    releaseCallbacks,
                    renderedFrames,
                    externalInput,
                    rendered,
                    wallStopObserved,
                    releaseStable,
                    observationIsolation,
                    timedOut,
                    passed);
            Files.writeString(resultPath, json, StandardCharsets.UTF_8);
            System.out.print(json);
        } catch (IOException exception) {
            throw new IllegalStateException("failed to write rendered-input evidence", exception);
        } finally {
            stop();
        }
    }

    private void addArena() {
        float halfWidth = ARENA_WIDTH / 2.0f;
        float halfDepth = ARENA_DEPTH / 2.0f;
        addWall("east-wall",
                new Vector3f(WALL_HALF_THICKNESS, WALL_HALF_HEIGHT, halfDepth),
                new Vector3f(halfWidth + WALL_HALF_THICKNESS, 0.0f, 0.0f));
        addWall("west-wall",
                new Vector3f(WALL_HALF_THICKNESS, WALL_HALF_HEIGHT, halfDepth),
                new Vector3f(-halfWidth - WALL_HALF_THICKNESS, 0.0f, 0.0f));
        addWall("north-wall",
                new Vector3f(halfWidth, WALL_HALF_HEIGHT, WALL_HALF_THICKNESS),
                new Vector3f(0.0f, 0.0f, halfDepth + WALL_HALF_THICKNESS));
        addWall("south-wall",
                new Vector3f(halfWidth, WALL_HALF_HEIGHT, WALL_HALF_THICKNESS),
                new Vector3f(0.0f, 0.0f, -halfDepth - WALL_HALF_THICKNESS));
    }

    private void addWall(String name, Vector3f halfExtents, Vector3f location) {
        PhysicsRigidBody wall = new PhysicsRigidBody(new BoxCollisionShape(halfExtents), 0.0f);
        wall.setPhysicsLocation(location);
        wall.setFriction(0.0f);
        wall.setRestitution(0.0f);
        physicsSpace.add(wall);

        Geometry geometry = visualBox(name, halfExtents, new ColorRGBA(0.28f, 0.31f, 0.35f, 1.0f));
        geometry.setLocalTranslation(location);
        rootNode.attachChild(geometry);
    }

    private Geometry visualBox(String name, Vector3f halfExtents, ColorRGBA color) {
        Geometry geometry = new Geometry(name, new Box(halfExtents.x, halfExtents.y, halfExtents.z));
        Material material = new Material(assetManager, "Common/MatDefs/Misc/Unshaded.j3md");
        material.setColor("Color", color);
        geometry.setMaterial(material);
        return geometry;
    }

    private void syncVisualPlayer() {
        Vector3f physicsLocation = player.getPhysicsLocation(new Vector3f());
        playerGeometry.setLocalTranslation(physicsLocation.x, 0.9f, physicsLocation.z);
    }
}
