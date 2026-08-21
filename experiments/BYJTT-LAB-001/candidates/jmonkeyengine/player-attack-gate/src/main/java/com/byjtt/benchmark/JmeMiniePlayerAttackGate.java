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
import java.util.Locale;

public final class JmeMiniePlayerAttackGate {
    private static final float ARENA_WIDTH = 24.0f;
    private static final float ARENA_DEPTH = 32.0f;
    private static final Vector3f PLAYER_SPAWN = new Vector3f(0.0f, 0.0f, 10.0f);
    private static final Vector3f ENEMY_SPAWN = new Vector3f(0.0f, 0.0f, -6.0f);
    private static final float PLAYER_WALK_SPEED = 3.5f;
    private static final float ENEMY_MOVE_SPEED = 2.7f;
    private static final float ENEMY_ACQUIRE_RANGE = 12.0f;
    private static final float PLAYER_ATTACK_RANGE = 1.8f;
    private static final int PLAYER_ATTACK_DAMAGE = 34;
    private static final float PLAYER_ATTACK_COOLDOWN = 0.55f;
    private static final int PLAYER_MAX_HEALTH = 100;
    private static final float ENEMY_ATTACK_RANGE = 1.6f;
    private static final int ENEMY_ATTACK_DAMAGE = 20;
    private static final float ENEMY_ATTACK_COOLDOWN = 1.1f;
    private static final int ENEMY_MAX_HEALTH = 100;
    private static final float CHARACTER_RADIUS = 0.4f;
    private static final float CHARACTER_CYLINDER_HEIGHT = 1.2f;
    private static final float FIXED_DT = 1.0f / 60.0f;
    private static final int MAX_APPROACH_STEPS = 120;
    private static final int MAX_CHASE_STEPS = 360;
    private static final float WALL_HALF_THICKNESS = 0.1f;
    private static final float WALL_HALF_HEIGHT = 2.0f;

    private JmeMiniePlayerAttackGate() {
    }

    public static void main(String[] args) throws Exception {
        Locale.setDefault(Locale.ROOT);
        ResultSnapshot result = execute();
        Path output = Path.of("evidence", "runtime-result.json");
        Files.createDirectories(output.getParent());
        Files.writeString(output, result.toJson());
        System.out.println(result.toJson());
        if (!result.passed()) {
            throw new IllegalStateException("jMonkeyEngine player-attack gate failed: " + result.failureReason());
        }
    }

    static ResultSnapshot execute() {
        NativeLibraryLoader.loadNativeLibrary("bulletjme", true);
        PhysicsSpace space = new PhysicsSpace(PhysicsSpace.BroadphaseType.DBVT);
        space.setGravity(Vector3f.ZERO);
        space.setAccuracy(FIXED_DT);
        space.setMaxSubSteps(1);
        addArenaWalls(space);

        PhysicsCharacter player = createCharacter(PLAYER_SPAWN);
        PhysicsCharacter enemy = createCharacter(ENEMY_SPAWN);
        space.add(player);
        space.add(enemy);

        float initialSeparation = separation(player, enemy);
        float lastPreAcquisitionDistance = initialSeparation;
        float acquisitionDistance = -1.0f;
        int approachSteps = 0;
        boolean acquired = false;

        player.setWalkDirection(new Vector3f(0.0f, 0.0f, -PLAYER_WALK_SPEED * FIXED_DT));
        enemy.setWalkDirection(Vector3f.ZERO);
        for (int i = 0; i < MAX_APPROACH_STEPS && !acquired; i++) {
            float before = separation(player, enemy);
            if (before > ENEMY_ACQUIRE_RANGE) {
                lastPreAcquisitionDistance = before;
            }
            space.update(FIXED_DT);
            approachSteps += 1;
            float after = separation(player, enemy);
            if (after <= ENEMY_ACQUIRE_RANGE) {
                acquired = true;
                acquisitionDistance = after;
            }
        }
        player.setWalkDirection(Vector3f.ZERO);
        if (!acquired) {
            return ResultSnapshot.failed(initialSeparation, approachSteps, "enemy never legitimately acquired player");
        }

        int chaseSteps = 0;
        float attackEntryDistance = -1.0f;
        float maxEnemyIncrement = 0.0f;
        boolean stayedInsideArena = insideArena(player.getPhysicsLocation(new Vector3f()))
                && insideArena(enemy.getPhysicsLocation(new Vector3f()));

        for (int i = 0; i < MAX_CHASE_STEPS; i++) {
            Vector3f enemyPosition = enemy.getPhysicsLocation(new Vector3f());
            Vector3f playerPosition = player.getPhysicsLocation(new Vector3f());
            float distance = horizontalDistance(playerPosition, enemyPosition);
            if (distance <= ENEMY_ATTACK_RANGE) {
                attackEntryDistance = distance;
                break;
            }
            Vector3f delta = playerPosition.subtract(enemyPosition);
            delta.y = 0.0f;
            float length = delta.length();
            Vector3f increment = Vector3f.ZERO;
            if (length > 0.0001f) {
                increment = delta.mult((ENEMY_MOVE_SPEED * FIXED_DT) / length);
            }
            maxEnemyIncrement = Math.max(maxEnemyIncrement, increment.length());
            enemy.setWalkDirection(increment);
            space.update(FIXED_DT);
            chaseSteps += 1;
            stayedInsideArena &= insideArena(player.getPhysicsLocation(new Vector3f()));
            stayedInsideArena &= insideArena(enemy.getPhysicsLocation(new Vector3f()));
        }
        enemy.setWalkDirection(Vector3f.ZERO);
        if (attackEntryDistance < 0.0f) {
            return ResultSnapshot.failed(initialSeparation, approachSteps, "enemy never legitimately entered combat range");
        }

        CombatState combat = new CombatState();
        AttackAction playerAttack = new AttackAction();

        int enemyHealthBeforeFirstAttack = combat.enemyHealth();
        int playerHealthBeforeExchange = combat.playerHealth();
        playerAttack.onAction(true);
        combat.update(FIXED_DT, separation(player, enemy), playerAttack.consumePress());
        playerAttack.onAction(false);
        int enemyHealthAfterFirstAttack = combat.enemyHealth();
        int playerHealthAfterExchange = combat.playerHealth();
        int playerAttacksAfterFirst = combat.playerAttacks();
        int enemyAttacksAfterFirst = combat.enemyAttacks();

        while (combat.timeSeconds() + FIXED_DT < PLAYER_ATTACK_COOLDOWN - 0.000001f) {
            space.update(FIXED_DT);
            combat.update(FIXED_DT, separation(player, enemy), false);
        }

        int enemyHealthBeforeEarlyAttempt = combat.enemyHealth();
        playerAttack.onAction(true);
        combat.update(FIXED_DT, separation(player, enemy), playerAttack.consumePress());
        playerAttack.onAction(false);
        int enemyHealthAfterEarlyAttempt = combat.enemyHealth();
        boolean earlyAttackBlocked = enemyHealthAfterEarlyAttempt == enemyHealthBeforeEarlyAttempt
                && combat.playerAttacks() == playerAttacksAfterFirst;

        while (combat.timeSeconds() + 0.000001f < PLAYER_ATTACK_COOLDOWN) {
            space.update(FIXED_DT);
            combat.update(FIXED_DT, separation(player, enemy), false);
        }

        float secondAttackTime = combat.timeSeconds();
        int enemyHealthBeforeSecondAttack = combat.enemyHealth();
        playerAttack.onAction(true);
        combat.update(FIXED_DT, separation(player, enemy), playerAttack.consumePress());
        playerAttack.onAction(false);
        int enemyHealthAfterSecondAttack = combat.enemyHealth();
        int playerHealthAfterSecondAttack = combat.playerHealth();

        Vector3f observed = enemy.getPhysicsLocation(new Vector3f());
        float authoritativeX = observed.x;
        float authoritativeZ = observed.z;
        observed.set(999.0f, 999.0f, 999.0f);
        Vector3f observedAgain = enemy.getPhysicsLocation(new Vector3f());
        boolean observationIsolation = Math.abs(observedAgain.x - authoritativeX) < 0.0001f
                && Math.abs(observedAgain.z - authoritativeZ) < 0.0001f;

        boolean acquisitionValid = lastPreAcquisitionDistance > ENEMY_ACQUIRE_RANGE
                && acquisitionDistance <= ENEMY_ACQUIRE_RANGE
                && acquisitionDistance >= ENEMY_ACQUIRE_RANGE - 0.10f;
        boolean attackRangeValid = attackEntryDistance <= ENEMY_ATTACK_RANGE
                && attackEntryDistance <= PLAYER_ATTACK_RANGE
                && attackEntryDistance >= 0.75f;
        boolean firstPlayerAttackValid = enemyHealthBeforeFirstAttack == 100
                && enemyHealthAfterFirstAttack == 66
                && playerAttacksAfterFirst == 1;
        boolean enemyResponseValid = playerHealthBeforeExchange == 100
                && playerHealthAfterExchange == 80
                && enemyAttacksAfterFirst == 1;
        boolean secondPlayerAttackValid = secondAttackTime + 0.00001f >= PLAYER_ATTACK_COOLDOWN
                && enemyHealthBeforeSecondAttack == 66
                && enemyHealthAfterSecondAttack == 32
                && combat.playerAttacks() == 2;
        boolean enemyCooldownHeld = playerHealthAfterSecondAttack == 80 && combat.enemyAttacks() == 1;
        boolean speedValid = maxEnemyIncrement <= ENEMY_MOVE_SPEED * FIXED_DT + 0.00001f;
        boolean passed = initialSeparation >= 15.99f
                && initialSeparation <= 16.01f
                && acquisitionValid
                && attackRangeValid
                && firstPlayerAttackValid
                && enemyResponseValid
                && earlyAttackBlocked
                && secondPlayerAttackValid
                && enemyCooldownHeld
                && speedValid
                && stayedInsideArena
                && observationIsolation;

        return new ResultSnapshot(
                passed,
                true,
                initialSeparation,
                approachSteps,
                lastPreAcquisitionDistance,
                acquisitionDistance,
                chaseSteps,
                attackEntryDistance,
                enemyHealthBeforeFirstAttack,
                enemyHealthAfterFirstAttack,
                enemyHealthBeforeEarlyAttempt,
                enemyHealthAfterEarlyAttempt,
                enemyHealthBeforeSecondAttack,
                enemyHealthAfterSecondAttack,
                playerHealthBeforeExchange,
                playerHealthAfterExchange,
                playerHealthAfterSecondAttack,
                combat.playerAttacks(),
                combat.enemyAttacks(),
                secondAttackTime,
                maxEnemyIncrement,
                acquisitionValid,
                attackRangeValid,
                firstPlayerAttackValid,
                enemyResponseValid,
                earlyAttackBlocked,
                secondPlayerAttackValid,
                enemyCooldownHeld,
                speedValid,
                stayedInsideArena,
                observationIsolation,
                true,
                false,
                false,
                false,
                "");
    }

    private static PhysicsCharacter createCharacter(Vector3f spawn) {
        PhysicsCharacter character = new PhysicsCharacter(
                new CapsuleCollisionShape(CHARACTER_RADIUS, CHARACTER_CYLINDER_HEIGHT), 0.05f);
        character.setGravity(0.0f);
        character.setFallSpeed(0.0f);
        character.setPhysicsLocation(spawn.clone());
        character.setWalkDirection(Vector3f.ZERO);
        return character;
    }

    private static void addArenaWalls(PhysicsSpace space) {
        float halfWidth = ARENA_WIDTH / 2.0f;
        float halfDepth = ARENA_DEPTH / 2.0f;
        addStaticBox(space, new Vector3f(halfWidth + WALL_HALF_THICKNESS, 0.0f, 0.0f),
                new Vector3f(WALL_HALF_THICKNESS, WALL_HALF_HEIGHT, halfDepth + WALL_HALF_THICKNESS));
        addStaticBox(space, new Vector3f(-halfWidth - WALL_HALF_THICKNESS, 0.0f, 0.0f),
                new Vector3f(WALL_HALF_THICKNESS, WALL_HALF_HEIGHT, halfDepth + WALL_HALF_THICKNESS));
        addStaticBox(space, new Vector3f(0.0f, 0.0f, halfDepth + WALL_HALF_THICKNESS),
                new Vector3f(halfWidth + WALL_HALF_THICKNESS, WALL_HALF_HEIGHT, WALL_HALF_THICKNESS));
        addStaticBox(space, new Vector3f(0.0f, 0.0f, -halfDepth - WALL_HALF_THICKNESS),
                new Vector3f(halfWidth + WALL_HALF_THICKNESS, WALL_HALF_HEIGHT, WALL_HALF_THICKNESS));
    }

    private static void addStaticBox(PhysicsSpace space, Vector3f location, Vector3f halfExtents) {
        PhysicsRigidBody wall = new PhysicsRigidBody(new BoxCollisionShape(halfExtents), 0.0f);
        wall.setPhysicsLocation(location);
        space.add(wall);
    }

    private static float separation(PhysicsCharacter player, PhysicsCharacter enemy) {
        return horizontalDistance(
                player.getPhysicsLocation(new Vector3f()), enemy.getPhysicsLocation(new Vector3f()));
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

    private static final class AttackAction {
        private boolean held;
        private boolean pressedEdge;

        void onAction(boolean pressed) {
            if (pressed && !held) {
                pressedEdge = true;
            }
            held = pressed;
        }

        boolean consumePress() {
            boolean result = pressedEdge;
            pressedEdge = false;
            return result;
        }
    }

    private static final class CombatState {
        private int playerHealth = PLAYER_MAX_HEALTH;
        private int enemyHealth = ENEMY_MAX_HEALTH;
        private int playerAttacks;
        private int enemyAttacks;
        private float timeSeconds;
        private float nextPlayerAttackTime;
        private float nextEnemyAttackTime;

        void update(float dt, float distance, boolean attackPressed) {
            if (attackPressed && distance <= PLAYER_ATTACK_RANGE
                    && timeSeconds + 0.000001f >= nextPlayerAttackTime) {
                enemyHealth = Math.max(0, enemyHealth - PLAYER_ATTACK_DAMAGE);
                playerAttacks += 1;
                nextPlayerAttackTime = timeSeconds + PLAYER_ATTACK_COOLDOWN;
            }
            if (distance <= ENEMY_ATTACK_RANGE
                    && timeSeconds + 0.000001f >= nextEnemyAttackTime) {
                playerHealth = Math.max(0, playerHealth - ENEMY_ATTACK_DAMAGE);
                enemyAttacks += 1;
                nextEnemyAttackTime = timeSeconds + ENEMY_ATTACK_COOLDOWN;
            }
            timeSeconds += dt;
        }

        int playerHealth() {
            return playerHealth;
        }

        int enemyHealth() {
            return enemyHealth;
        }

        int playerAttacks() {
            return playerAttacks;
        }

        int enemyAttacks() {
            return enemyAttacks;
        }

        float timeSeconds() {
            return timeSeconds;
        }
    }

    private record ResultSnapshot(
            boolean passed,
            boolean minieNativeLoaded,
            float initialSeparationMetres,
            int approachSteps,
            float lastPreAcquisitionDistanceMetres,
            float acquisitionDistanceMetres,
            int chaseSteps,
            float attackEntryDistanceMetres,
            int enemyHealthBeforeFirstAttack,
            int enemyHealthAfterFirstAttack,
            int enemyHealthBeforeEarlyAttempt,
            int enemyHealthAfterEarlyAttempt,
            int enemyHealthBeforeSecondAttack,
            int enemyHealthAfterSecondAttack,
            int playerHealthBeforeExchange,
            int playerHealthAfterExchange,
            int playerHealthAfterSecondAttack,
            int playerAttacksExecuted,
            int enemyAttacksExecuted,
            float secondAttackTimeSeconds,
            float maxCommandedEnemyIncrementMetres,
            boolean acquisitionValid,
            boolean attackRangeValid,
            boolean firstPlayerAttackValid,
            boolean enemyResponseValid,
            boolean earlyPlayerAttackBlocked,
            boolean secondPlayerAttackValid,
            boolean enemyCooldownHeld,
            boolean commandedSpeedValid,
            boolean stayedInsideArena,
            boolean observationMutationIsolation,
            boolean gameplayAttackActionExecuted,
            boolean directHealthSetterExposed,
            boolean postPhysicsArenaClamp,
            boolean externalInputExecuted,
            String failureReason) {

        static ResultSnapshot failed(float initialSeparation, int approachSteps, String reason) {
            return new ResultSnapshot(false, true, initialSeparation, approachSteps, -1.0f, -1.0f, 0, -1.0f,
                    100, 100, 100, 100, 100, 100, 100, 100, 100, 0, 0, 0.0f, 0.0f,
                    false, false, false, false, false, false, false, false, false, false,
                    false, false, false, false, reason);
        }

        String toJson() {
            return String.format(Locale.ROOT,
                    "{\n"
                            + "  \"passed\": %s,\n"
                            + "  \"minie_native_loaded\": %s,\n"
                            + "  \"initial_separation_metres\": %.9f,\n"
                            + "  \"approach_steps\": %d,\n"
                            + "  \"last_pre_acquisition_distance_metres\": %.9f,\n"
                            + "  \"acquisition_distance_metres\": %.9f,\n"
                            + "  \"chase_steps\": %d,\n"
                            + "  \"attack_entry_distance_metres\": %.9f,\n"
                            + "  \"enemy_health_before_first_attack\": %d,\n"
                            + "  \"enemy_health_after_first_attack\": %d,\n"
                            + "  \"enemy_health_before_early_attempt\": %d,\n"
                            + "  \"enemy_health_after_early_attempt\": %d,\n"
                            + "  \"enemy_health_before_second_attack\": %d,\n"
                            + "  \"enemy_health_after_second_attack\": %d,\n"
                            + "  \"player_health_before_exchange\": %d,\n"
                            + "  \"player_health_after_exchange\": %d,\n"
                            + "  \"player_health_after_second_attack\": %d,\n"
                            + "  \"player_attacks_executed\": %d,\n"
                            + "  \"enemy_attacks_executed\": %d,\n"
                            + "  \"second_attack_time_seconds\": %.9f,\n"
                            + "  \"max_commanded_enemy_increment_metres\": %.9f,\n"
                            + "  \"acquisition_valid\": %s,\n"
                            + "  \"attack_range_valid\": %s,\n"
                            + "  \"first_player_attack_valid\": %s,\n"
                            + "  \"enemy_response_valid\": %s,\n"
                            + "  \"early_player_attack_blocked\": %s,\n"
                            + "  \"second_player_attack_valid\": %s,\n"
                            + "  \"enemy_cooldown_held\": %s,\n"
                            + "  \"commanded_speed_valid\": %s,\n"
                            + "  \"stayed_inside_arena\": %s,\n"
                            + "  \"observation_mutation_isolation\": %s,\n"
                            + "  \"gameplay_attack_action_executed\": %s,\n"
                            + "  \"direct_health_setter_exposed\": %s,\n"
                            + "  \"post_physics_arena_clamp\": %s,\n"
                            + "  \"external_input_executed\": %s,\n"
                            + "  \"failure_reason\": \"%s\"\n"
                            + "}\n",
                    passed, minieNativeLoaded, initialSeparationMetres, approachSteps,
                    lastPreAcquisitionDistanceMetres, acquisitionDistanceMetres, chaseSteps,
                    attackEntryDistanceMetres, enemyHealthBeforeFirstAttack, enemyHealthAfterFirstAttack,
                    enemyHealthBeforeEarlyAttempt, enemyHealthAfterEarlyAttempt, enemyHealthBeforeSecondAttack,
                    enemyHealthAfterSecondAttack, playerHealthBeforeExchange, playerHealthAfterExchange,
                    playerHealthAfterSecondAttack, playerAttacksExecuted, enemyAttacksExecuted,
                    secondAttackTimeSeconds, maxCommandedEnemyIncrementMetres, acquisitionValid,
                    attackRangeValid, firstPlayerAttackValid, enemyResponseValid, earlyPlayerAttackBlocked,
                    secondPlayerAttackValid, enemyCooldownHeld, commandedSpeedValid, stayedInsideArena,
                    observationMutationIsolation, gameplayAttackActionExecuted, directHealthSetterExposed,
                    postPhysicsArenaClamp, externalInputExecuted, escape(failureReason));
        }

        private static String escape(String value) {
            return value.replace("\\", "\\\\").replace("\"", "\\\"");
        }
    }
}
