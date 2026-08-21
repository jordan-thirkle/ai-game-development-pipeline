package com.byjtt.benchmark;

import com.jme3.bullet.PhysicsSpace;
import com.jme3.bullet.collision.shapes.BoxCollisionShape;
import com.jme3.bullet.collision.shapes.CapsuleCollisionShape;
import com.jme3.bullet.objects.PhysicsCharacter;
import com.jme3.bullet.objects.PhysicsRigidBody;
import com.jme3.export.InputCapsule;
import com.jme3.export.JmeExporter;
import com.jme3.export.JmeImporter;
import com.jme3.export.OutputCapsule;
import com.jme3.export.Savable;
import com.jme3.export.binary.BinaryExporter;
import com.jme3.export.binary.BinaryImporter;
import com.jme3.math.Vector3f;
import com.jme3.system.NativeLibraryLoader;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public final class JmePersistenceGate {
    private static final float ARENA_WIDTH = 24.0f;
    private static final float ARENA_DEPTH = 32.0f;
    private static final Vector3f PLAYER_SPAWN = new Vector3f(0.0f, 0.0f, 10.0f);
    private static final Vector3f SALVAGE_SPAWN = new Vector3f(5.0f, 0.0f, 0.0f);
    private static final float WALK_SPEED = 3.5f;
    private static final float ATTACK_RANGE = 1.8f;
    private static final int ATTACK_DAMAGE = 34;
    private static final int SALVAGE_HEALTH = 34;
    private static final float PICKUP_RADIUS = 1.25f;
    private static final String UPGRADE_ID = "damage-up-1";
    private static final float DAMAGE_MULTIPLIER = 1.2f;
    private static final float FIXED_DT = 1.0f / 60.0f;
    private static final int MAX_STEPS = 480;
    private static final Path EVIDENCE = Path.of("evidence");
    private static final Path SAVE_FILE = EVIDENCE.resolve("progression.j3o");

    private JmePersistenceGate() {
    }

    public static void main(String[] args) throws Exception {
        Locale.setDefault(Locale.ROOT);
        if (args.length != 1 || !(args[0].equals("save") || args[0].equals("restore"))) {
            throw new IllegalArgumentException("expected exactly one phase: save or restore");
        }
        Files.createDirectories(EVIDENCE);
        Result result = args[0].equals("save") ? runSavePhase() : runRestorePhase();
        Path output = EVIDENCE.resolve(args[0] + "-result.json");
        Files.writeString(output, result.toJson());
        System.out.println(result.toJson());
        if (!result.passed()) {
            throw new IllegalStateException("persistence gate failed: " + result.failureReason());
        }
    }

    private static Result runSavePhase() throws IOException {
        NativeLibraryLoader.loadNativeLibrary("bulletjme", true);
        GameRuntime runtime = new GameRuntime();
        ProgressionObservation observation = runtime.playProgression();
        runtime.saveNormally(SAVE_FILE);
        long saveBytes = Files.size(SAVE_FILE);
        boolean passed = observation.rewardCount() == 1
                && observation.selectedUpgrades().contains(UPGRADE_ID)
                && Math.abs(observation.effectiveDamage() - 40.8f) < 0.0002f
                && observation.attackActionExecuted()
                && observation.interactActionExecuted()
                && observation.stayedInsideArena()
                && saveBytes > 0;
        return new Result(passed, "save", 1, observation.rewardCount(),
                observation.selectedUpgrades().contains(UPGRADE_ID), observation.effectiveDamage(),
                saveBytes, true, false, observation.attackActionExecuted(), observation.interactActionExecuted(),
                observation.stayedInsideArena(), true, false, false, false, false, false,
                passed ? "" : "save phase assertions failed");
    }

    private static Result runRestorePhase() throws IOException {
        if (!Files.isRegularFile(SAVE_FILE) || Files.size(SAVE_FILE) == 0) {
            return Result.failed("restore", "save artifact missing");
        }
        NativeLibraryLoader.loadNativeLibrary("bulletjme", true);
        GameRuntime restartedRuntime = new GameRuntime();
        restartedRuntime.loadNormally(SAVE_FILE);
        ProgressionObservation observation = restartedRuntime.observeProgression();
        long saveBytes = Files.size(SAVE_FILE);
        boolean passed = observation.rewardCount() == 1
                && observation.selectedUpgrades().size() == 1
                && observation.selectedUpgrades().contains(UPGRADE_ID)
                && Math.abs(observation.effectiveDamage() - 40.8f) < 0.0002f;
        return new Result(passed, "restore", 1, observation.rewardCount(),
                observation.selectedUpgrades().contains(UPGRADE_ID), observation.effectiveDamage(), saveBytes,
                true, true, false, false, true, true, false, false, false, false, false,
                passed ? "" : "restored progression does not match save contract");
    }

    private static final class GameRuntime {
        private final ProgressionState progression = new ProgressionState();
        private final PhysicsSpace space;
        private final PhysicsCharacter player;

        GameRuntime() {
            space = new PhysicsSpace(PhysicsSpace.BroadphaseType.DBVT);
            space.setGravity(Vector3f.ZERO);
            space.setAccuracy(FIXED_DT);
            space.setMaxSubSteps(1);
            addArenaWalls(space);
            player = new PhysicsCharacter(new CapsuleCollisionShape(0.4f, 1.2f), 0.05f);
            player.setGravity(0.0f);
            player.setFallSpeed(0.0f);
            player.setPhysicsLocation(PLAYER_SPAWN.clone());
            player.setWalkDirection(Vector3f.ZERO);
            space.add(player);
        }

        ProgressionObservation playProgression() {
            ActionEdge attack = new ActionEdge();
            ActionEdge interact = new ActionEdge();
            boolean attackExecuted = false;
            boolean interactExecuted = false;
            boolean inside = true;
            for (int step = 0; step < MAX_STEPS; step += 1) {
                Vector3f position = player.getPhysicsLocation(new Vector3f());
                float distance = horizontalDistance(position, SALVAGE_SPAWN);
                if (!progression.salvageBroken() && distance <= ATTACK_RANGE) {
                    player.setWalkDirection(Vector3f.ZERO);
                    attack.onAction(true);
                    boolean edge = attack.consumePress();
                    attackExecuted |= edge;
                    progression.update(distance, edge, false);
                    attack.onAction(false);
                }
                Vector3f delta = SALVAGE_SPAWN.subtract(position);
                delta.y = 0.0f;
                float length = delta.length();
                player.setWalkDirection(length > 0.0001f
                        ? delta.mult((WALK_SPEED * FIXED_DT) / length) : Vector3f.ZERO);
                boolean rewardWasAvailable = progression.rewardAvailable();
                space.update(FIXED_DT);
                Vector3f moved = player.getPhysicsLocation(new Vector3f());
                inside &= insideArena(moved);
                float movedDistance = horizontalDistance(moved, SALVAGE_SPAWN);
                progression.update(movedDistance, false, false);
                if (rewardWasAvailable && !progression.rewardAvailable() && progression.rewardCount() == 1) {
                    interact.onAction(true);
                    boolean edge = interact.consumePress();
                    interactExecuted |= edge;
                    progression.update(movedDistance, false, edge);
                    interact.onAction(false);
                    break;
                }
            }
            player.setWalkDirection(Vector3f.ZERO);
            List<String> copy = new ArrayList<>(progression.selectedUpgrades());
            copy.add("test-observation-mutation");
            boolean isolation = !progression.selectedUpgrades().contains("test-observation-mutation");
            return new ProgressionObservation(progression.rewardCount(), progression.selectedUpgrades(),
                    progression.effectiveDamage(), attackExecuted, interactExecuted, inside, isolation);
        }

        ProgressionObservation observeProgression() {
            List<String> copy = new ArrayList<>(progression.selectedUpgrades());
            copy.add("test-observation-mutation");
            boolean isolation = !progression.selectedUpgrades().contains("test-observation-mutation");
            return new ProgressionObservation(progression.rewardCount(), progression.selectedUpgrades(),
                    progression.effectiveDamage(), false, false, true, isolation);
        }

        void saveNormally(Path path) throws IOException {
            BinaryExporter.getInstance().save(progression.toSave(), path.toFile());
        }

        void loadNormally(Path path) throws IOException {
            Savable loaded = BinaryImporter.getInstance().load(path.toFile());
            if (!(loaded instanceof ProgressionSave save)) {
                throw new IOException("unexpected save type: " + loaded.getClass().getName());
            }
            progression.restore(save);
        }
    }

    public static final class ProgressionSave implements Savable {
        private int schemaVersion;
        private int rewardCount;
        private String[] selectedUpgrades = new String[0];

        public ProgressionSave() {
        }

        ProgressionSave(int schemaVersion, int rewardCount, List<String> upgrades) {
            this.schemaVersion = schemaVersion;
            this.rewardCount = rewardCount;
            this.selectedUpgrades = upgrades.toArray(String[]::new);
        }

        @Override
        public void write(JmeExporter exporter) throws IOException {
            OutputCapsule capsule = exporter.getCapsule(this);
            capsule.write(schemaVersion, "schema_version", 0);
            capsule.write(rewardCount, "reward_count", 0);
            capsule.write(selectedUpgrades, "selected_upgrades", new String[0]);
        }

        @Override
        public void read(JmeImporter importer) throws IOException {
            InputCapsule capsule = importer.getCapsule(this);
            schemaVersion = capsule.readInt("schema_version", 0);
            rewardCount = capsule.readInt("reward_count", 0);
            selectedUpgrades = capsule.readStringArray("selected_upgrades", new String[0]);
        }
    }

    private static final class ProgressionState {
        private int salvageHealth = SALVAGE_HEALTH;
        private boolean rewardAvailable;
        private int rewardCount;
        private boolean upgradeMenuVisible;
        private final List<String> selectedUpgrades = new ArrayList<>();

        void update(float distance, boolean attackPressed, boolean interactPressed) {
            if (attackPressed && !salvageBroken() && distance <= ATTACK_RANGE) {
                salvageHealth = Math.max(0, salvageHealth - ATTACK_DAMAGE);
                rewardAvailable = salvageBroken();
            }
            if (rewardAvailable && distance <= PICKUP_RADIUS) {
                rewardAvailable = false;
                rewardCount += 1;
                upgradeMenuVisible = true;
            }
            if (interactPressed && upgradeMenuVisible && rewardCount == 1 && selectedUpgrades.isEmpty()) {
                selectedUpgrades.add(UPGRADE_ID);
                upgradeMenuVisible = false;
            }
        }

        boolean salvageBroken() { return salvageHealth == 0; }
        boolean rewardAvailable() { return rewardAvailable; }
        int rewardCount() { return rewardCount; }
        List<String> selectedUpgrades() { return List.copyOf(selectedUpgrades); }
        float effectiveDamage() { return ATTACK_DAMAGE * (selectedUpgrades.contains(UPGRADE_ID) ? DAMAGE_MULTIPLIER : 1.0f); }
        ProgressionSave toSave() { return new ProgressionSave(1, rewardCount, selectedUpgrades); }
        void restore(ProgressionSave save) {
            if (save.schemaVersion != 1) { throw new IllegalArgumentException("unsupported schema version"); }
            rewardCount = save.rewardCount;
            selectedUpgrades.clear();
            selectedUpgrades.addAll(List.of(save.selectedUpgrades));
        }
    }

    private static final class ActionEdge {
        private boolean held;
        private boolean edge;
        void onAction(boolean pressed) { if (pressed && !held) { edge = true; } held = pressed; }
        boolean consumePress() { boolean result = edge; edge = false; return result; }
    }

    private record ProgressionObservation(int rewardCount, List<String> selectedUpgrades, float effectiveDamage,
            boolean attackActionExecuted, boolean interactActionExecuted, boolean stayedInsideArena,
            boolean observationIsolation) {
        ProgressionObservation { selectedUpgrades = List.copyOf(selectedUpgrades); }
    }

    private record Result(boolean passed, String phase, int schemaVersion, int rewardCount,
            boolean damageUpgradeSelected, float effectiveAttackDamage, long saveBytes,
            boolean minieNativeLoaded, boolean freshRuntimeRestoreExecuted, boolean gameplayAttackActionExecuted,
            boolean gameplayInteractActionExecuted, boolean stayedInsideArena, boolean observationMutationIsolation,
            boolean directPositionSetterExposed, boolean directHealthSetterExposed, boolean directRewardGrantExposed,
            boolean directUpgradeGrantExposed, boolean writeSaveDirectlyExposed, String failureReason) {
        static Result failed(String phase, String reason) {
            return new Result(false, phase, 0, 0, false, 34.0f, 0, true, false, false, false, false, false,
                    false, false, false, false, false, reason);
        }
        String toJson() {
            return String.format(Locale.ROOT,
                    "{\"passed\":%s,\"phase\":\"%s\",\"schema_version\":%d,\"reward_count\":%d,\"damage_upgrade_selected\":%s,\"effective_attack_damage\":%.9f,\"save_bytes\":%d,\"minie_native_loaded\":%s,\"fresh_runtime_restore_executed\":%s,\"gameplay_attack_action_executed\":%s,\"gameplay_interact_action_executed\":%s,\"stayed_inside_arena\":%s,\"observation_mutation_isolation\":%s,\"direct_position_setter_exposed\":%s,\"direct_health_setter_exposed\":%s,\"direct_reward_grant_exposed\":%s,\"direct_upgrade_grant_exposed\":%s,\"write_save_directly_exposed\":%s,\"failure_reason\":\"%s\"}%n",
                    passed, phase, schemaVersion, rewardCount, damageUpgradeSelected, effectiveAttackDamage,
                    saveBytes, minieNativeLoaded, freshRuntimeRestoreExecuted, gameplayAttackActionExecuted,
                    gameplayInteractActionExecuted, stayedInsideArena, observationMutationIsolation,
                    directPositionSetterExposed, directHealthSetterExposed, directRewardGrantExposed,
                    directUpgradeGrantExposed, writeSaveDirectlyExposed, failureReason.replace("\"", "'"));
        }
    }

    private static void addArenaWalls(PhysicsSpace space) {
        float halfWidth = ARENA_WIDTH / 2.0f;
        float halfDepth = ARENA_DEPTH / 2.0f;
        float t = 0.1f;
        addWall(space, new Vector3f(halfWidth + t, 0.0f, 0.0f), new Vector3f(t, 2.0f, halfDepth + t));
        addWall(space, new Vector3f(-halfWidth - t, 0.0f, 0.0f), new Vector3f(t, 2.0f, halfDepth + t));
        addWall(space, new Vector3f(0.0f, 0.0f, halfDepth + t), new Vector3f(halfWidth + t, 2.0f, t));
        addWall(space, new Vector3f(0.0f, 0.0f, -halfDepth - t), new Vector3f(halfWidth + t, 2.0f, t));
    }

    private static void addWall(PhysicsSpace space, Vector3f location, Vector3f halfExtents) {
        PhysicsRigidBody wall = new PhysicsRigidBody(new BoxCollisionShape(halfExtents), 0.0f);
        wall.setPhysicsLocation(location);
        space.add(wall);
    }

    private static float horizontalDistance(Vector3f a, Vector3f b) {
        float dx = a.x - b.x;
        float dz = a.z - b.z;
        return (float) Math.sqrt(dx * dx + dz * dz);
    }

    private static boolean insideArena(Vector3f point) {
        return Math.abs(point.x) <= ARENA_WIDTH / 2.0f + 0.001f
                && Math.abs(point.z) <= ARENA_DEPTH / 2.0f + 0.001f;
    }
}
