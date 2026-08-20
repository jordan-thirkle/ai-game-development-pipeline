package com.byjtt.lab;

import com.jme3.bullet.PhysicsSpace;
import com.jme3.bullet.collision.shapes.BoxCollisionShape;
import com.jme3.bullet.collision.shapes.CapsuleCollisionShape;
import com.jme3.bullet.objects.PhysicsCharacter;
import com.jme3.bullet.objects.PhysicsRigidBody;
import com.jme3.math.Vector3f;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;

public final class MiniePhysicsGate {
    private static final float ARENA_WIDTH = 24.0f;
    private static final float ARENA_DEPTH = 32.0f;
    private static final float WALK_SPEED = 3.5f;
    private static final Vector3f PLAYER_SPAWN = new Vector3f(0.0f, 0.0f, 10.0f);
    private static final float PLAYER_RADIUS = 0.4f;
    private static final float PLAYER_CYLINDER_HEIGHT = 1.2f;
    private static final float WALL_HALF_THICKNESS = 0.1f;
    private static final float WALL_HALF_HEIGHT = 2.0f;
    private static final float DT = 1.0f / 60.0f;
    private static final int DRIVEN_STEPS = 300;
    private static final int RELEASE_STEPS = 60;

    private MiniePhysicsGate() {
    }

    public static void main(String[] args) throws IOException {
        Locale.setDefault(Locale.ROOT);
        Path output = args.length == 1 ? Path.of(args[0]) : Path.of("target", "minie-gate-result.json");

        PhysicsSpace space = new PhysicsSpace(PhysicsSpace.BroadphaseType.DBVT);
        space.setGravity(Vector3f.ZERO);
        space.setAccuracy(DT);
        space.setMaxSubSteps(1);
        addArenaWalls(space);

        PhysicsCharacter player = new PhysicsCharacter(
                new CapsuleCollisionShape(PLAYER_RADIUS, PLAYER_CYLINDER_HEIGHT), 0.05f);
        player.setPhysicsLocation(PLAYER_SPAWN.clone());
        player.setGravity(0.0f);
        player.setFallSpeed(0.0f);
        player.setWalkDirection(new Vector3f(WALK_SPEED * DT, 0.0f, 0.0f));
        space.add(player);

        Vector3f sample = new Vector3f();
        float maxX = player.getPhysicsLocation(sample).x;
        for (int i = 0; i < DRIVEN_STEPS; i++) {
            space.update(DT);
            maxX = Math.max(maxX, player.getPhysicsLocation(sample).x);
        }

        float releaseStartX = player.getPhysicsLocation(new Vector3f()).x;
        player.setWalkDirection(Vector3f.ZERO);
        for (int i = 0; i < RELEASE_STEPS; i++) {
            space.update(DT);
        }

        Vector3f finalPosition = player.getPhysicsLocation(new Vector3f());
        float releaseDrift = Math.abs(finalPosition.x - releaseStartX);
        float collisionCeiling = ARENA_WIDTH / 2.0f - PLAYER_RADIUS;
        boolean wallStopObserved = maxX <= collisionCeiling + 0.02f
                && finalPosition.x >= collisionCeiling - 0.10f
                && finalPosition.x <= collisionCeiling + 0.02f;
        boolean releaseStable = releaseDrift <= 0.005f;

        Vector3f observationCopy = player.getPhysicsLocation(new Vector3f());
        float authoritativeX = observationCopy.x;
        observationCopy.x = -999.0f;
        boolean observationIsolation = Math.abs(
                player.getPhysicsLocation(new Vector3f()).x - authoritativeX) < 0.0001f;

        boolean passed = wallStopObserved && releaseStable && observationIsolation;
        Files.createDirectories(output.toAbsolutePath().getParent());
        String json = String.format(Locale.ROOT,
                "{\n"
                        + "  \"candidate\": \"jmonkeyengine-minie\",\n"
                        + "  \"requested_jme_version\": \"3.9.0-stable\",\n"
                        + "  \"minie_version\": \"9.0.3\",\n"
                        + "  \"physics_backend\": \"Minie/Libbulletjme\",\n"
                        + "  \"controller\": \"PhysicsCharacter/native character controller\",\n"
                        + "  \"arena_width_m\": %.1f,\n"
                        + "  \"arena_depth_m\": %.1f,\n"
                        + "  \"walk_speed_mps\": %.1f,\n"
                        + "  \"walk_increment_per_tick_m\": %.9f,\n"
                        + "  \"spawn\": [%.1f, %.1f, %.1f],\n"
                        + "  \"driven_steps\": %d,\n"
                        + "  \"release_steps\": %d,\n"
                        + "  \"fixed_dt_seconds\": %.9f,\n"
                        + "  \"collision_ceiling_x_m\": %.6f,\n"
                        + "  \"max_x_m\": %.6f,\n"
                        + "  \"final_x_m\": %.6f,\n"
                        + "  \"release_drift_m\": %.9f,\n"
                        + "  \"native_wall_stop_observed\": %s,\n"
                        + "  \"release_stable\": %s,\n"
                        + "  \"post_physics_arena_clamp\": false,\n"
                        + "  \"external_input_executed\": false,\n"
                        + "  \"observation_copy_isolated\": %s,\n"
                        + "  \"passed\": %s\n"
                        + "}\n",
                ARENA_WIDTH,
                ARENA_DEPTH,
                WALK_SPEED,
                WALK_SPEED * DT,
                PLAYER_SPAWN.x,
                PLAYER_SPAWN.y,
                PLAYER_SPAWN.z,
                DRIVEN_STEPS,
                RELEASE_STEPS,
                DT,
                collisionCeiling,
                maxX,
                finalPosition.x,
                releaseDrift,
                wallStopObserved,
                releaseStable,
                observationIsolation,
                passed);
        Files.writeString(output, json, StandardCharsets.UTF_8);
        System.out.print(json);

        if (!passed) {
            throw new IllegalStateException("jMonkeyEngine Minie physics gate failed");
        }
    }

    private static void addArenaWalls(PhysicsSpace space) {
        float halfWidth = ARENA_WIDTH / 2.0f;
        float halfDepth = ARENA_DEPTH / 2.0f;

        addStaticBox(space,
                new Vector3f(WALL_HALF_THICKNESS, WALL_HALF_HEIGHT, halfDepth),
                new Vector3f(halfWidth + WALL_HALF_THICKNESS, 0.0f, 0.0f));
        addStaticBox(space,
                new Vector3f(WALL_HALF_THICKNESS, WALL_HALF_HEIGHT, halfDepth),
                new Vector3f(-halfWidth - WALL_HALF_THICKNESS, 0.0f, 0.0f));
        addStaticBox(space,
                new Vector3f(halfWidth, WALL_HALF_HEIGHT, WALL_HALF_THICKNESS),
                new Vector3f(0.0f, 0.0f, halfDepth + WALL_HALF_THICKNESS));
        addStaticBox(space,
                new Vector3f(halfWidth, WALL_HALF_HEIGHT, WALL_HALF_THICKNESS),
                new Vector3f(0.0f, 0.0f, -halfDepth - WALL_HALF_THICKNESS));
    }

    private static void addStaticBox(PhysicsSpace space, Vector3f halfExtents, Vector3f location) {
        PhysicsRigidBody wall = new PhysicsRigidBody(new BoxCollisionShape(halfExtents), 0.0f);
        wall.setPhysicsLocation(location);
        wall.setFriction(0.0f);
        wall.setRestitution(0.0f);
        space.add(wall);
    }
}
