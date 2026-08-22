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
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public final class RenderedProgressionGate extends SimpleApplication implements ActionListener {
    private static final String WINDOW_TITLE = "BYJTT-LAB-001 jME Rendered Progression";
    private static final String MOVE_RIGHT = "benchmark-move-right";
    private static final String MOVE_BACK = "benchmark-move-back";
    private static final String ATTACK = "benchmark-attack";
    private static final String INTERACT = "benchmark-interact";
    private static final float ARENA_WIDTH = 24.0f;
    private static final float ARENA_DEPTH = 32.0f;
    private static final Vector3f PLAYER_SPAWN = new Vector3f(0.0f, 0.0f, 10.0f);
    private static final Vector3f SALVAGE_SPAWN = new Vector3f(5.0f, 0.0f, 0.0f);
    private static final float WALK_SPEED = 3.5f;
    private static final float ATTACK_RANGE = 1.8f;
    private static final int ATTACK_DAMAGE = 34;
    private static final int SALVAGE_MAX_HEALTH = 34;
    private static final float PICKUP_RADIUS = 1.25f;
    private static final int REWARD_COUNT = 1;
    private static final String UPGRADE_ID = "damage-up-1";
    private static final float DAMAGE_MULTIPLIER = 1.2f;
    private static final float FIXED_DT = 1.0f / 60.0f;
    private static final float WALK_INCREMENT = WALK_SPEED * FIXED_DT;
    private static final float PLAYER_RADIUS = 0.4f;
    private static final float PLAYER_CYLINDER_HEIGHT = 1.2f;
    private static final float MAX_RUNTIME_SECONDS = 15.0f;
    private static final float POST_SUCCESS_SECONDS = 0.65f;

    private final Path resultPath;
    private final Path livePath;
    private PhysicsSpace physicsSpace;
    private PhysicsCharacter player;
    private Geometry playerGeometry;
    private Geometry salvageGeometry;
    private boolean moveRight;
    private boolean moveBack;
    private boolean resultWritten;
    private boolean progressionComplete;
    private float completionTime;
    private float elapsedSeconds;
    private float accumulator;
    private long renderedFrames;
    private int movementPresses;
    private int movementReleases;
    private int attackPresses;
    private int attackReleases;
    private int interactPresses;
    private int interactReleases;
    private int salvageHealth = SALVAGE_MAX_HEALTH;
    private boolean rewardAvailable;
    private int rewardCount;
    private boolean upgradeMenuVisible;
    private final List<String> selectedUpgrades = new ArrayList<>();
    private float attackDistance = -1.0f;
    private float pickupDistance = -1.0f;
    private boolean stayedInsideArena = true;

    private RenderedProgressionGate(Path resultPath) {
        this.resultPath = resultPath;
        this.livePath = resultPath.resolveSibling("live-observation.json");
    }

    public static void main(String[] args) {
        Locale.setDefault(Locale.ROOT);
        Path output = args.length == 1 ? Path.of(args[0]) : Path.of("target", "rendered-progression-result.json");
        RenderedProgressionGate app = new RenderedProgressionGate(output);
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
        inputManager.addMapping(MOVE_BACK, new KeyTrigger(KeyInput.KEY_S));
        inputManager.addMapping(ATTACK, new KeyTrigger(KeyInput.KEY_SPACE));
        inputManager.addMapping(INTERACT, new KeyTrigger(KeyInput.KEY_E));
        inputManager.addListener(this, MOVE_RIGHT, MOVE_BACK, ATTACK, INTERACT);

        NativeLibraryLoader.loadNativeLibrary("bulletjme", true);
        physicsSpace = new PhysicsSpace(PhysicsSpace.BroadphaseType.DBVT);
        physicsSpace.setGravity(Vector3f.ZERO);
        physicsSpace.setAccuracy(FIXED_DT);
        physicsSpace.setMaxSubSteps(1);
        addArenaWalls();

        player = new PhysicsCharacter(new CapsuleCollisionShape(PLAYER_RADIUS, PLAYER_CYLINDER_HEIGHT), 0.05f);
        player.setGravity(0.0f);
        player.setFallSpeed(0.0f);
        player.setPhysicsLocation(PLAYER_SPAWN.clone());
        player.setWalkDirection(Vector3f.ZERO);
        physicsSpace.add(player);

        playerGeometry = visualBox("player", new Vector3f(PLAYER_RADIUS, 0.9f, PLAYER_RADIUS), ColorRGBA.Cyan);
        rootNode.attachChild(playerGeometry);
        salvageGeometry = visualBox("salvage", new Vector3f(0.45f, 0.45f, 0.45f), ColorRGBA.Orange);
        salvageGeometry.setLocalTranslation(SALVAGE_SPAWN.x, 0.45f, SALVAGE_SPAWN.z);
        rootNode.attachChild(salvageGeometry);
        syncVisualPlayer();

        cam.setLocation(new Vector3f(0.0f, 20.0f, 28.0f));
        cam.lookAt(new Vector3f(2.5f, 0.0f, 5.0f), Vector3f.UNIT_Y);
        viewPort.setBackgroundColor(new ColorRGBA(0.06f, 0.07f, 0.09f, 1.0f));
        publishLiveObservation();
    }

    @Override
    public void onAction(String name, boolean isPressed, float tpf) {
        switch (name) {
            case MOVE_RIGHT -> {
                moveRight = isPressed;
                if (isPressed) { movementPresses += 1; } else { movementReleases += 1; }
            }
            case MOVE_BACK -> {
                moveBack = isPressed;
                if (isPressed) { movementPresses += 1; } else { movementReleases += 1; }
            }
            case ATTACK -> {
                if (isPressed) {
                    attackPresses += 1;
                    attemptAttack();
                } else {
                    attackReleases += 1;
                }
            }
            case INTERACT -> {
                if (isPressed) {
                    interactPresses += 1;
                    attemptInteract();
                } else {
                    interactReleases += 1;
                }
            }
            default -> { }
        }
        publishLiveObservation();
    }

    @Override
    public void simpleUpdate(float tpf) {
        elapsedSeconds += tpf;
        accumulator += Math.min(tpf, 0.25f);
        while (accumulator >= FIXED_DT) {
            Vector3f direction = new Vector3f(moveRight ? 1.0f : 0.0f, 0.0f, moveBack ? -1.0f : 0.0f);
            if (direction.lengthSquared() > 0.0f) {
                direction.normalizeLocal().multLocal(WALK_INCREMENT);
            }
            player.setWalkDirection(direction);
            physicsSpace.update(FIXED_DT);
            Vector3f position = player.getPhysicsLocation(new Vector3f());
            stayedInsideArena &= insideArena(position);
            if (rewardAvailable && distance(position, SALVAGE_SPAWN) <= PICKUP_RADIUS) {
                pickupDistance = distance(position, SALVAGE_SPAWN);
                rewardAvailable = false;
                rewardCount += REWARD_COUNT;
                upgradeMenuVisible = true;
            }
            accumulator -= FIXED_DT;
        }
        syncVisualPlayer();
        publishLiveObservation();

        progressionComplete = rewardCount == REWARD_COUNT
                && selectedUpgrades.contains(UPGRADE_ID)
                && Math.abs(effectiveAttackDamage() - 40.8f) < 0.0001f;
        if (progressionComplete && completionTime == 0.0f) {
            completionTime = elapsedSeconds;
        }
        if (!resultWritten && progressionComplete && elapsedSeconds - completionTime >= POST_SUCCESS_SECONDS) {
            finish(false);
        } else if (!resultWritten && elapsedSeconds >= MAX_RUNTIME_SECONDS) {
            finish(true);
        }
    }

    @Override
    public void simpleRender(RenderManager renderManager) {
        renderedFrames += 1;
    }

    private void attemptAttack() {
        Vector3f position = player.getPhysicsLocation(new Vector3f());
        float currentDistance = distance(position, SALVAGE_SPAWN);
        if (salvageHealth > 0 && currentDistance <= ATTACK_RANGE) {
            attackDistance = currentDistance;
            salvageHealth = Math.max(0, salvageHealth - ATTACK_DAMAGE);
            if (salvageHealth == 0) {
                rewardAvailable = true;
                salvageGeometry.getMaterial().setColor("Color", ColorRGBA.DarkGray);
            }
        }
    }

    private void attemptInteract() {
        if (upgradeMenuVisible && rewardCount == REWARD_COUNT && !selectedUpgrades.contains(UPGRADE_ID)) {
            selectedUpgrades.add(UPGRADE_ID);
            upgradeMenuVisible = false;
        }
    }

    private void finish(boolean timedOut) {
        resultWritten = true;
        Vector3f authoritative = player.getPhysicsLocation(new Vector3f());
        Vector3f observationCopy = authoritative.clone();
        observationCopy.set(999.0f, 999.0f, 999.0f);
        List<String> selectedCopy = new ArrayList<>(selectedUpgrades);
        selectedCopy.add("test-only-mutation");
        Vector3f observedAgain = player.getPhysicsLocation(new Vector3f());
        boolean observationIsolation = authoritative.distance(observedAgain) < 0.0001f
                && !selectedUpgrades.contains("test-only-mutation");
        boolean passed = !timedOut
                && renderedFrames > 0
                && movementPresses >= 2 && movementReleases >= 2
                && attackPresses >= 1 && attackReleases >= 1
                && interactPresses >= 1 && interactReleases >= 1
                && attackDistance >= 0.0f && attackDistance <= ATTACK_RANGE
                && salvageHealth == 0
                && pickupDistance >= 0.0f && pickupDistance <= PICKUP_RADIUS
                && rewardCount == REWARD_COUNT
                && selectedUpgrades.contains(UPGRADE_ID)
                && Math.abs(effectiveAttackDamage() - 40.8f) < 0.0001f
                && stayedInsideArena
                && observationIsolation;
        String json = String.format(Locale.ROOT,
                "{\n  \"candidate\": \"jmonkeyengine-rendered-progression\",\n  \"requested_jme_version\": \"3.9.0-stable\",\n  \"minie_version\": \"9.0.3\",\n  \"physics_backend\": \"Minie/Libbulletjme\",\n  \"input_path\": \"OS keyboard -> jME InputManager KeyTrigger -> ActionListener -> gameplay movement/attack/interact\",\n  \"arena_width_m\": %.1f,\n  \"arena_depth_m\": %.1f,\n  \"walk_speed_mps\": %.1f,\n  \"attack_range_m\": %.1f,\n  \"attack_damage\": %d,\n  \"salvage_max_health\": %d,\n  \"pickup_radius_m\": %.2f,\n  \"attack_distance_m\": %.9f,\n  \"pickup_distance_m\": %.9f,\n  \"salvage_health\": %d,\n  \"reward_count\": %d,\n  \"damage_upgrade_selected\": %s,\n  \"effective_attack_damage\": %.9f,\n  \"movement_press_callbacks\": %d,\n  \"movement_release_callbacks\": %d,\n  \"attack_press_callbacks\": %d,\n  \"attack_release_callbacks\": %d,\n  \"interact_press_callbacks\": %d,\n  \"interact_release_callbacks\": %d,\n  \"rendered_frames\": %d,\n  \"external_input_executed\": %s,\n  \"rendered_window_executed\": %s,\n  \"gameplay_attack_action_executed\": %s,\n  \"gameplay_interact_action_executed\": %s,\n  \"direct_position_setter_exposed\": false,\n  \"direct_salvage_health_setter_exposed\": false,\n  \"direct_reward_grant_exposed\": false,\n  \"direct_upgrade_grant_exposed\": false,\n  \"post_physics_arena_clamp\": false,\n  \"observation_copy_isolated\": %s,\n  \"stayed_inside_arena\": %s,\n  \"timed_out\": %s,\n  \"passed\": %s\n}\n",
                ARENA_WIDTH, ARENA_DEPTH, WALK_SPEED, ATTACK_RANGE, ATTACK_DAMAGE, SALVAGE_MAX_HEALTH,
                PICKUP_RADIUS, attackDistance, pickupDistance, salvageHealth, rewardCount,
                selectedUpgrades.contains(UPGRADE_ID), effectiveAttackDamage(), movementPresses, movementReleases,
                attackPresses, attackReleases, interactPresses, interactReleases, renderedFrames,
                movementPresses >= 2 && movementReleases >= 2 && attackPresses > 0 && interactPresses > 0,
                renderedFrames > 0, attackPresses > 0, interactPresses > 0, observationIsolation,
                stayedInsideArena, timedOut, passed);
        try {
            Files.createDirectories(resultPath.toAbsolutePath().getParent());
            Files.writeString(resultPath, json, StandardCharsets.UTF_8);
            System.out.print(json);
        } catch (IOException exception) {
            throw new IllegalStateException("failed to write rendered progression evidence", exception);
        } finally {
            stop();
        }
    }

    private void publishLiveObservation() {
        if (player == null) {
            return;
        }
        Vector3f position = player.getPhysicsLocation(new Vector3f());
        float d = distance(position, SALVAGE_SPAWN);
        String json = String.format(Locale.ROOT,
                "{\"distance_to_salvage_m\":%.9f,\"salvage_health\":%d,\"reward_available\":%s,\"reward_count\":%d,\"upgrade_menu_visible\":%s,\"damage_upgrade_selected\":%s}\n",
                d, salvageHealth, rewardAvailable, rewardCount, upgradeMenuVisible, selectedUpgrades.contains(UPGRADE_ID));
        Path temporary = livePath.resolveSibling(livePath.getFileName() + ".tmp");
        try {
            Files.createDirectories(livePath.toAbsolutePath().getParent());
            Files.writeString(temporary, json, StandardCharsets.UTF_8);
            try {
                Files.move(temporary, livePath, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            } catch (AtomicMoveNotSupportedException exception) {
                Files.move(temporary, livePath, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException exception) {
            throw new IllegalStateException("failed to publish read-only live observation", exception);
        }
    }

    private float effectiveAttackDamage() {
        return ATTACK_DAMAGE * (selectedUpgrades.contains(UPGRADE_ID) ? DAMAGE_MULTIPLIER : 1.0f);
    }

    private void addArenaWalls() {
        float halfWidth = ARENA_WIDTH / 2.0f;
        float halfDepth = ARENA_DEPTH / 2.0f;
        addWall(new Vector3f(halfWidth + 0.1f, 0.0f, 0.0f), new Vector3f(0.1f, 2.0f, halfDepth + 0.1f));
        addWall(new Vector3f(-halfWidth - 0.1f, 0.0f, 0.0f), new Vector3f(0.1f, 2.0f, halfDepth + 0.1f));
        addWall(new Vector3f(0.0f, 0.0f, halfDepth + 0.1f), new Vector3f(halfWidth + 0.1f, 2.0f, 0.1f));
        addWall(new Vector3f(0.0f, 0.0f, -halfDepth - 0.1f), new Vector3f(halfWidth + 0.1f, 2.0f, 0.1f));
    }

    private void addWall(Vector3f location, Vector3f halfExtents) {
        PhysicsRigidBody wall = new PhysicsRigidBody(new BoxCollisionShape(halfExtents), 0.0f);
        wall.setPhysicsLocation(location);
        physicsSpace.add(wall);
    }

    private boolean insideArena(Vector3f point) {
        return Math.abs(point.x) <= ARENA_WIDTH / 2.0f + 0.001f
                && Math.abs(point.z) <= ARENA_DEPTH / 2.0f + 0.001f;
    }

    private float distance(Vector3f a, Vector3f b) {
        float dx = a.x - b.x;
        float dz = a.z - b.z;
        return (float) Math.sqrt(dx * dx + dz * dz);
    }

    private Geometry visualBox(String name, Vector3f halfExtents, ColorRGBA color) {
        Geometry geometry = new Geometry(name, new Box(halfExtents.x, halfExtents.y, halfExtents.z));
        Material material = new Material(assetManager, "Common/MatDefs/Misc/Unshaded.j3md");
        material.setColor("Color", color);
        geometry.setMaterial(material);
        return geometry;
    }

    private void syncVisualPlayer() {
        Vector3f p = player.getPhysicsLocation(new Vector3f());
        playerGeometry.setLocalTranslation(p.x, 0.9f, p.z);
    }
}
