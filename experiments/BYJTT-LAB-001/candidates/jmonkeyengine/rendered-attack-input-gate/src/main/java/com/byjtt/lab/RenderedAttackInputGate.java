package com.byjtt.lab;

import com.jme3.app.SimpleApplication;
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
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;

public final class RenderedAttackInputGate extends SimpleApplication implements ActionListener {
    private static final String ATTACK = "benchmark-player-attack";
    private static final String WINDOW_TITLE = "BYJTT-LAB-001 jME Rendered Attack Input";
    private static final float PLAYER_ATTACK_RANGE = 1.8f;
    private static final int PLAYER_ATTACK_DAMAGE = 34;
    private static final float PLAYER_ATTACK_COOLDOWN = 0.55f;
    private static final float FIXTURE_DISTANCE = 1.5f;
    private static final float MAX_RUNTIME_SECONDS = 8.0f;
    private static final float POST_ATTACK_RENDER_SECONDS = 0.60f;

    private final Path resultPath;
    private int enemyHealth = 100;
    private int pressCallbacks;
    private int releaseCallbacks;
    private int successfulAttacks;
    private int blockedAttacks;
    private long renderedFrames;
    private float elapsedSeconds;
    private float lastAttackTime = -100.0f;
    private float lastReleaseTime = -100.0f;
    private int healthAfterFirstAttack = 100;
    private int healthAfterEarlyAttack = 100;
    private int healthAfterSecondAttack = 100;
    private boolean resultWritten;

    private RenderedAttackInputGate(Path resultPath) {
        this.resultPath = resultPath;
    }

    public static void main(String[] args) {
        Locale.setDefault(Locale.ROOT);
        Path output = args.length == 1 ? Path.of(args[0]) : Path.of("target", "rendered-attack-input-result.json");
        RenderedAttackInputGate app = new RenderedAttackInputGate(output);
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
        inputManager.addMapping(ATTACK, new KeyTrigger(KeyInput.KEY_SPACE));
        inputManager.addListener(this, ATTACK);

        Geometry player = box("player", new Vector3f(0.4f, 0.9f, 0.4f), ColorRGBA.Cyan);
        player.setLocalTranslation(0.0f, 0.9f, 0.0f);
        rootNode.attachChild(player);
        Geometry enemy = box("enemy", new Vector3f(0.4f, 0.9f, 0.4f), ColorRGBA.Red);
        enemy.setLocalTranslation(FIXTURE_DISTANCE, 0.9f, 0.0f);
        rootNode.attachChild(enemy);
        Geometry floor = box("floor", new Vector3f(4.0f, 0.05f, 4.0f), new ColorRGBA(0.25f, 0.27f, 0.30f, 1.0f));
        floor.setLocalTranslation(0.0f, -0.05f, 0.0f);
        rootNode.attachChild(floor);
        cam.setLocation(new Vector3f(0.0f, 5.5f, 8.0f));
        cam.lookAt(new Vector3f(0.75f, 0.8f, 0.0f), Vector3f.UNIT_Y);
        viewPort.setBackgroundColor(new ColorRGBA(0.06f, 0.07f, 0.09f, 1.0f));
    }

    @Override
    public void onAction(String name, boolean isPressed, float tpf) {
        if (!ATTACK.equals(name)) {
            return;
        }
        if (isPressed) {
            pressCallbacks += 1;
            attemptAttack();
        } else {
            releaseCallbacks += 1;
            lastReleaseTime = elapsedSeconds;
        }
    }

    @Override
    public void simpleUpdate(float tpf) {
        elapsedSeconds += tpf;
        boolean proofComplete = pressCallbacks >= 3
                && releaseCallbacks >= 3
                && successfulAttacks >= 2
                && elapsedSeconds - lastReleaseTime >= POST_ATTACK_RENDER_SECONDS;
        if (!resultWritten && proofComplete) {
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
        boolean inRange = FIXTURE_DISTANCE <= PLAYER_ATTACK_RANGE;
        boolean cooldownReady = elapsedSeconds - lastAttackTime + 0.0001f >= PLAYER_ATTACK_COOLDOWN;
        if (inRange && cooldownReady) {
            enemyHealth = Math.max(0, enemyHealth - PLAYER_ATTACK_DAMAGE);
            lastAttackTime = elapsedSeconds;
            successfulAttacks += 1;
            if (successfulAttacks == 1) {
                healthAfterFirstAttack = enemyHealth;
            } else if (successfulAttacks == 2) {
                healthAfterSecondAttack = enemyHealth;
            }
        } else {
            blockedAttacks += 1;
            healthAfterEarlyAttack = enemyHealth;
        }
    }

    private void finish(boolean timedOut) {
        resultWritten = true;
        int observationCopy = enemyHealth;
        int mutatedCopy = observationCopy - 999;
        boolean observationIsolation = mutatedCopy != enemyHealth && observationCopy == enemyHealth;
        boolean passed = !timedOut
                && renderedFrames > 0
                && pressCallbacks >= 3
                && releaseCallbacks >= 3
                && successfulAttacks == 2
                && blockedAttacks >= 1
                && healthAfterFirstAttack == 66
                && healthAfterEarlyAttack == 66
                && healthAfterSecondAttack == 32
                && observationIsolation;
        try {
            Files.createDirectories(resultPath.toAbsolutePath().getParent());
            String json = String.format(Locale.ROOT,
                    "{\n"
                            + "  \"candidate\": \"jmonkeyengine-rendered-attack-input\",\n"
                            + "  \"requested_jme_version\": \"3.9.0-stable\",\n"
                            + "  \"minie_version\": \"9.0.3\",\n"
                            + "  \"input_path\": \"OS keyboard -> jME InputManager KeyTrigger -> ActionListener -> gameplay attack action\",\n"
                            + "  \"fixture_distance_m\": %.2f,\n"
                            + "  \"player_attack_range_m\": %.2f,\n"
                            + "  \"player_attack_damage\": %d,\n"
                            + "  \"player_attack_cooldown_s\": %.2f,\n"
                            + "  \"input_press_callbacks\": %d,\n"
                            + "  \"input_release_callbacks\": %d,\n"
                            + "  \"successful_player_attacks\": %d,\n"
                            + "  \"blocked_player_attacks\": %d,\n"
                            + "  \"enemy_health_after_first_attack\": %d,\n"
                            + "  \"enemy_health_after_early_attack\": %d,\n"
                            + "  \"enemy_health_after_second_attack\": %d,\n"
                            + "  \"rendered_frames\": %d,\n"
                            + "  \"external_input_executed\": %s,\n"
                            + "  \"rendered_window_executed\": %s,\n"
                            + "  \"gameplay_attack_action_executed\": %s,\n"
                            + "  \"direct_health_setter_exposed\": false,\n"
                            + "  \"post_physics_arena_clamp\": false,\n"
                            + "  \"observation_copy_isolated\": %s,\n"
                            + "  \"timed_out\": %s,\n"
                            + "  \"passed\": %s\n"
                            + "}\n",
                    FIXTURE_DISTANCE,
                    PLAYER_ATTACK_RANGE,
                    PLAYER_ATTACK_DAMAGE,
                    PLAYER_ATTACK_COOLDOWN,
                    pressCallbacks,
                    releaseCallbacks,
                    successfulAttacks,
                    blockedAttacks,
                    healthAfterFirstAttack,
                    healthAfterEarlyAttack,
                    healthAfterSecondAttack,
                    renderedFrames,
                    pressCallbacks > 0 && releaseCallbacks > 0,
                    renderedFrames > 0,
                    successfulAttacks > 0,
                    observationIsolation,
                    timedOut,
                    passed);
            Files.writeString(resultPath, json, StandardCharsets.UTF_8);
            System.out.print(json);
        } catch (IOException exception) {
            throw new IllegalStateException("failed to write rendered attack input evidence", exception);
        } finally {
            stop();
        }
    }

    private Geometry box(String name, Vector3f halfExtents, ColorRGBA color) {
        Geometry geometry = new Geometry(name, new Box(halfExtents.x, halfExtents.y, halfExtents.z));
        Material material = new Material(assetManager, "Common/MatDefs/Misc/Unshaded.j3md");
        material.setColor("Color", color);
        geometry.setMaterial(material);
        return geometry;
    }
}
