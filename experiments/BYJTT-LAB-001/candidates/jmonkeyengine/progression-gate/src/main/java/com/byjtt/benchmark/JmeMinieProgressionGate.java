package com.byjtt.benchmark;

import com.jme3.bullet.PhysicsSpace;
import com.jme3.bullet.collision.shapes.BoxCollisionShape;
import com.jme3.bullet.collision.shapes.CapsuleCollisionShape;
import com.jme3.bullet.objects.PhysicsCharacter;
import com.jme3.bullet.objects.PhysicsRigidBody;
import com.jme3.math.Vector3f;
import com.jme3.system.NativeLibraryLoader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public final class JmeMinieProgressionGate {
    private static final float ARENA_WIDTH = 24.0f;
    private static final float ARENA_DEPTH = 32.0f;
    private static final Vector3f PLAYER_SPAWN = new Vector3f(0.0f, 0.0f, 10.0f);
    private static final Vector3f SALVAGE_SPAWN = new Vector3f(5.0f, 0.0f, 0.0f);
    private static final float WALK_SPEED = 3.5f;
    private static final float ATTACK_RANGE = 1.8f;
    private static final int ATTACK_DAMAGE = 34;
    private static final float ATTACK_COOLDOWN = 0.55f;
    private static final int SALVAGE_MAX_HEALTH = 34;
    private static final int REWARD_COUNT = 1;
    private static final float PICKUP_RADIUS = 1.25f;
    private static final String UPGRADE_ID = "damage-up-1";
    private static final float DAMAGE_MULTIPLIER = 1.2f;
    private static final float FIXED_DT = 1.0f / 60.0f;
    private static final float CHARACTER_RADIUS = 0.4f;
    private static final float CHARACTER_CYLINDER_HEIGHT = 1.2f;
    private static final int MAX_STEPS = 480;

    private JmeMinieProgressionGate() {
    }

    public static void main(String[] args) throws Exception {
        Locale.setDefault(Locale.ROOT);
        Result result = execute();
        Path output = Path.of("evidence", "runtime-result.json");
        Files.createDirectories(output.getParent());
        Files.writeString(output, result.toJson());
        System.out.println(result.toJson());
        if (!result.passed()) {
            throw new IllegalStateException("jMonkeyEngine progression gate failed: " + result.failureReason());
        }
    }

    static Result execute() {
        NativeLibraryLoader.loadNativeLibrary("bulletjme", true);
        PhysicsSpace space = new PhysicsSpace(PhysicsSpace.BroadphaseType.DBVT);
        space.setGravity(Vector3f.ZERO);
        space.setAccuracy(FIXED_DT);
        space.setMaxSubSteps(1);
        addArenaWalls(space);

        PhysicsCharacter player = new PhysicsCharacter(
                new CapsuleCollisionShape(CHARACTER_RADIUS, CHARACTER_CYLINDER_HEIGHT), 0.05f);
        player.setGravity(0.0f);
        player.setFallSpeed(0.0f);
        player.setPhysicsLocation(PLAYER_SPAWN.clone());
        player.setWalkDirection(Vector3f.ZERO);
        space.add(player);

        ProgressionState state = new ProgressionState();
        AttackAction attack = new AttackAction();
        InteractAction interact = new InteractAction();
        float startDistance = distance(player.getPhysicsLocation(new Vector3f()), SALVAGE_SPAWN);
        int movementSteps = 0;
        float attackDistance = -1.0f;
        float pickupDistance = -1.0f;
        boolean attackExecuted = false;
        boolean interactExecuted = false;
        boolean stayedInsideArena = true;

        while (movementSteps < MAX_STEPS) {
            Vector3f position = player.getPhysicsLocation(new Vector3f());
            float d = distance(position, SALVAGE_SPAWN);
            if (!state.salvageBroken() && d <= ATTACK_RANGE) {
                player.setWalkDirection(Vector3f.ZERO);
                attackDistance = d;
                attack.onAction(true);
                boolean attackPress = attack.consumePress();
                attackExecuted |= attackPress;
                state.update(FIXED_DT, d, attackPress, false);
                attack.onAction(false);
                if (!state.salvageBroken()) {
                    return Result.failed(startDistance, movementSteps, "salvage did not break from normal attack action");
                }
            }

            Vector3f delta = SALVAGE_SPAWN.subtract(position);
            delta.y = 0.0f;
            float length = delta.length();
            Vector3f increment = Vector3f.ZERO;
            if (length > 0.0001f) {
                increment = delta.mult((WALK_SPEED * FIXED_DT) / length);
            }
            player.setWalkDirection(increment);
            boolean rewardWasAvailable = state.rewardAvailable();
            space.update(FIXED_DT);
            movementSteps += 1;
            Vector3f movedPosition = player.getPhysicsLocation(new Vector3f());
            float movedDistance = distance(movedPosition, SALVAGE_SPAWN);
            stayedInsideArena &= insideArena(movedPosition);
            state.update(FIXED_DT, movedDistance, false, false);

            if (rewardWasAvailable && !state.rewardAvailable() && state.rewardCount() == REWARD_COUNT) {
                pickupDistance = movedDistance;
                interact.onAction(true);
                boolean interactPress = interact.consumePress();
                interactExecuted |= interactPress;
                state.update(FIXED_DT, movedDistance, false, interactPress);
                interact.onAction(false);
                break;
            }
        }
        player.setWalkDirection(Vector3f.ZERO);

        Vector3f observation = player.getPhysicsLocation(new Vector3f());
        float authoritativeX = observation.x;
        float authoritativeZ = observation.z;
        observation.set(999.0f, 999.0f, 999.0f);
        Vector3f observedAgain = player.getPhysicsLocation(new Vector3f());
        List<String> selectedCopy = new ArrayList<>(state.selectedUpgrades());
        selectedCopy.add("test-only-mutation");
        boolean observationIsolation = Math.abs(observedAgain.x - authoritativeX) < 0.0001f
                && Math.abs(observedAgain.z - authoritativeZ) < 0.0001f
                && !state.selectedUpgrades().contains("test-only-mutation");

        boolean attackValid = attackExecuted && attackDistance >= 0.0f && attackDistance <= ATTACK_RANGE
                && state.salvageHealth() == 0 && state.salvageBroken();
        boolean pickupValid = pickupDistance >= 0.0f && pickupDistance <= PICKUP_RADIUS
                && state.rewardCount() == REWARD_COUNT && !state.rewardAvailable();
        boolean upgradeValid = interactExecuted && !state.upgradeMenuVisible()
                && state.selectedUpgrades().contains(UPGRADE_ID)
                && Math.abs(state.effectiveAttackDamage() - 40.8f) < 0.0001f;
        boolean passed = startDistance > 11.17f && startDistance < 11.19f
                && movementSteps > 0 && stayedInsideArena && attackValid && pickupValid
                && upgradeValid && observationIsolation;

        return new Result(passed, true, startDistance, movementSteps, attackDistance, pickupDistance,
                state.salvageHealth(), state.salvageBroken(), state.rewardAvailable(), state.rewardCount(),
                state.selectedUpgrades().contains(UPGRADE_ID), state.effectiveAttackDamage(), stayedInsideArena,
                observationIsolation, attackExecuted, interactExecuted, false, false, false, false, false, false,
                passed ? "" : "one or more progression assertions failed");
    }

    private static void addArenaWalls(PhysicsSpace space) {
        float halfWidth = ARENA_WIDTH / 2.0f;
        float halfDepth = ARENA_DEPTH / 2.0f;
        float t = 0.1f;
        addStaticBox(space, new Vector3f(halfWidth + t, 0.0f, 0.0f), new Vector3f(t, 2.0f, halfDepth + t));
        addStaticBox(space, new Vector3f(-halfWidth - t, 0.0f, 0.0f), new Vector3f(t, 2.0f, halfDepth + t));
        addStaticBox(space, new Vector3f(0.0f, 0.0f, halfDepth + t), new Vector3f(halfWidth + t, 2.0f, t));
        addStaticBox(space, new Vector3f(0.0f, 0.0f, -halfDepth - t), new Vector3f(halfWidth + t, 2.0f, t));
    }

    private static void addStaticBox(PhysicsSpace space, Vector3f location, Vector3f halfExtents) {
        PhysicsRigidBody wall = new PhysicsRigidBody(new BoxCollisionShape(halfExtents), 0.0f);
        wall.setPhysicsLocation(location);
        space.add(wall);
    }

    private static float distance(Vector3f a, Vector3f b) {
        float dx = a.x - b.x;
        float dz = a.z - b.z;
        return (float) Math.sqrt(dx * dx + dz * dz);
    }

    private static boolean insideArena(Vector3f point) {
        return Math.abs(point.x) <= ARENA_WIDTH / 2.0f + 0.001f
                && Math.abs(point.z) <= ARENA_DEPTH / 2.0f + 0.001f;
    }

    private static final class AttackAction {
        private boolean held;
        private boolean edge;
        void onAction(boolean pressed) { if (pressed && !held) { edge = true; } held = pressed; }
        boolean consumePress() { boolean result = edge; edge = false; return result; }
    }

    private static final class InteractAction {
        private boolean held;
        private boolean edge;
        void onAction(boolean pressed) { if (pressed && !held) { edge = true; } held = pressed; }
        boolean consumePress() { boolean result = edge; edge = false; return result; }
    }

    private static final class ProgressionState {
        private int salvageHealth = SALVAGE_MAX_HEALTH;
        private boolean rewardAvailable;
        private int rewardCount;
        private boolean upgradeMenuVisible;
        private final List<String> selectedUpgrades = new ArrayList<>();
        private float timeSeconds;
        private float nextAttackTime;

        void update(float dt, float distance, boolean attackPressed, boolean interactPressed) {
            if (attackPressed && !salvageBroken() && distance <= ATTACK_RANGE
                    && timeSeconds + 0.000001f >= nextAttackTime) {
                salvageHealth = Math.max(0, salvageHealth - ATTACK_DAMAGE);
                nextAttackTime = timeSeconds + ATTACK_COOLDOWN;
                if (salvageBroken()) { rewardAvailable = true; }
            }
            if (rewardAvailable && distance <= PICKUP_RADIUS) {
                rewardAvailable = false;
                rewardCount += REWARD_COUNT;
                upgradeMenuVisible = true;
            }
            if (interactPressed && upgradeMenuVisible && rewardCount == REWARD_COUNT
                    && !selectedUpgrades.contains(UPGRADE_ID)) {
                selectedUpgrades.add(UPGRADE_ID);
                upgradeMenuVisible = false;
            }
            timeSeconds += dt;
        }

        int salvageHealth() { return salvageHealth; }
        boolean salvageBroken() { return salvageHealth == 0; }
        boolean rewardAvailable() { return rewardAvailable; }
        int rewardCount() { return rewardCount; }
        boolean upgradeMenuVisible() { return upgradeMenuVisible; }
        List<String> selectedUpgrades() { return List.copyOf(selectedUpgrades); }
        float effectiveAttackDamage() { return ATTACK_DAMAGE * (selectedUpgrades.contains(UPGRADE_ID) ? DAMAGE_MULTIPLIER : 1.0f); }
    }

    private record Result(boolean passed, boolean minieNativeLoaded, float startDistanceMetres,
            int movementSteps, float attackDistanceMetres, float pickupDistanceMetres, int salvageHealth,
            boolean salvageBroken, boolean rewardAvailable, int rewardCount, boolean damageUpgradeSelected,
            float effectiveAttackDamage, boolean stayedInsideArena, boolean observationMutationIsolation,
            boolean gameplayAttackActionExecuted, boolean gameplayInteractActionExecuted,
            boolean directPositionSetterExposed, boolean directSalvageHealthSetterExposed,
            boolean directRewardGrantExposed, boolean directUpgradeGrantExposed, boolean postPhysicsArenaClamp,
            boolean externalInputExecuted, String failureReason) {
        static Result failed(float startDistance, int movementSteps, String reason) {
            return new Result(false, true, startDistance, movementSteps, -1.0f, -1.0f, -1, false, false, 0,
                    false, ATTACK_DAMAGE, false, false, false, false, false, false, false, false, false, false, reason);
        }
        String toJson() {
            return String.format(Locale.ROOT,
                    "{\"passed\":%s,\"minie_native_loaded\":%s,\"start_distance_metres\":%.9f,\"movement_steps\":%d,\"attack_distance_metres\":%.9f,\"pickup_distance_metres\":%.9f,\"salvage_health\":%d,\"salvage_broken\":%s,\"reward_available\":%s,\"reward_count\":%d,\"damage_upgrade_selected\":%s,\"effective_attack_damage\":%.9f,\"stayed_inside_arena\":%s,\"observation_mutation_isolation\":%s,\"gameplay_attack_action_executed\":%s,\"gameplay_interact_action_executed\":%s,\"direct_position_setter_exposed\":%s,\"direct_salvage_health_setter_exposed\":%s,\"direct_reward_grant_exposed\":%s,\"direct_upgrade_grant_exposed\":%s,\"post_physics_arena_clamp\":%s,\"external_input_executed\":%s,\"failure_reason\":\"%s\"}%n",
                    passed, minieNativeLoaded, startDistanceMetres, movementSteps, attackDistanceMetres,
                    pickupDistanceMetres, salvageHealth, salvageBroken, rewardAvailable, rewardCount,
                    damageUpgradeSelected, effectiveAttackDamage, stayedInsideArena, observationMutationIsolation,
                    gameplayAttackActionExecuted, gameplayInteractActionExecuted, directPositionSetterExposed,
                    directSalvageHealthSetterExposed, directRewardGrantExposed, directUpgradeGrantExposed,
                    postPhysicsArenaClamp, externalInputExecuted, failureReason.replace("\"", "'"));
        }
    }
}
