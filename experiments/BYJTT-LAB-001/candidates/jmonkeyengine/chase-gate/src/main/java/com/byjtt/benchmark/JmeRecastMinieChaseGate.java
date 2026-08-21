package com.byjtt.benchmark;

import com.jme3.bullet.PhysicsSpace;
import com.jme3.bullet.collision.shapes.BoxCollisionShape;
import com.jme3.bullet.collision.shapes.CapsuleCollisionShape;
import com.jme3.bullet.objects.PhysicsCharacter;
import com.jme3.bullet.objects.PhysicsRigidBody;
import com.jme3.math.Vector3f;
import com.jme3.scene.Geometry;
import com.jme3.scene.Mesh;
import com.jme3.scene.VertexBuffer.Type;
import com.jme3.system.NativeLibraryLoader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import org.recast4j.detour.DefaultQueryFilter;
import org.recast4j.detour.FindNearestPolyResult;
import org.recast4j.detour.MeshData;
import org.recast4j.detour.NavMesh;
import org.recast4j.detour.NavMeshBuilder;
import org.recast4j.detour.NavMeshDataCreateParams;
import org.recast4j.detour.NavMeshQuery;
import org.recast4j.detour.QueryFilter;
import org.recast4j.detour.Result;
import org.recast4j.detour.StraightPathItem;
import org.recast4j.recast.AreaModification;
import org.recast4j.recast.PolyMesh;
import org.recast4j.recast.PolyMeshDetail;
import org.recast4j.recast.RecastBuilder;
import org.recast4j.recast.RecastBuilder.RecastBuilderResult;
import org.recast4j.recast.RecastBuilderConfig;
import org.recast4j.recast.RecastConfig;
import org.recast4j.recast.RecastConstants.PartitionType;
import org.recast4j.recast.geom.SimpleInputGeomProvider;

public final class JmeRecastMinieChaseGate {
    private static final float ARENA_WIDTH = 24.0f;
    private static final float ARENA_DEPTH = 32.0f;
    private static final Vector3f PLAYER_SPAWN = new Vector3f(0.0f, 0.0f, 10.0f);
    private static final Vector3f ENEMY_SPAWN = new Vector3f(0.0f, 0.0f, -6.0f);
    private static final float PLAYER_WALK_SPEED = 3.5f;
    private static final float ENEMY_MOVE_SPEED = 2.7f;
    private static final float ENEMY_ACQUIRE_RANGE = 12.0f;
    private static final float CHARACTER_RADIUS = 0.4f;
    private static final float CHARACTER_CYLINDER_HEIGHT = 1.2f;
    private static final float FIXED_DT = 1.0f / 60.0f;
    private static final int MAX_APPROACH_STEPS = 120;
    private static final int CHASE_STEPS = 180;
    private static final int RELEASE_STEPS = 60;
    private static final float WALL_HALF_THICKNESS = 0.1f;
    private static final float WALL_HALF_HEIGHT = 2.0f;
    private static final float CELL_SIZE = 0.25f;
    private static final float CELL_HEIGHT = 0.25f;
    private static final float AGENT_HEIGHT = 1.8f;
    private static final float AGENT_RADIUS = 0.4f;
    private static final float AGENT_MAX_CLIMB = 0.4f;
    private static final float AGENT_MAX_SLOPE = 45.0f;
    private static final int VERTS_PER_POLY = 6;

    private JmeRecastMinieChaseGate() {
    }

    public static void main(String[] args) throws Exception {
        Locale.setDefault(Locale.ROOT);
        ResultSnapshot result = execute();
        Path output = Path.of("evidence", "runtime-result.json");
        Files.createDirectories(output.getParent());
        Files.writeString(output, result.toJson());
        System.out.println(result.toJson());
        if (!result.passed()) {
            throw new IllegalStateException("jMonkeyEngine Recast/Minie chase gate failed: " + result.failureReason());
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

        Vector3f playerPosition = player.getPhysicsLocation(new Vector3f());
        Vector3f enemyPosition = enemy.getPhysicsLocation(new Vector3f());
        float initialSeparation = horizontalDistance(playerPosition, enemyPosition);
        boolean acquired = false;
        boolean acquiredAboveThreshold = false;
        int approachSteps = 0;
        float acquisitionDistance = -1.0f;
        float lastPreAcquisitionDistance = initialSeparation;

        player.setWalkDirection(new Vector3f(0.0f, 0.0f, -PLAYER_WALK_SPEED * FIXED_DT));
        enemy.setWalkDirection(Vector3f.ZERO);
        for (int i = 0; i < MAX_APPROACH_STEPS && !acquired; i++) {
            float before = horizontalDistance(
                    player.getPhysicsLocation(new Vector3f()),
                    enemy.getPhysicsLocation(new Vector3f()));
            if (before > ENEMY_ACQUIRE_RANGE) {
                lastPreAcquisitionDistance = before;
            } else {
                acquired = true;
                acquisitionDistance = before;
                break;
            }

            space.update(FIXED_DT);
            approachSteps += 1;
            float after = horizontalDistance(
                    player.getPhysicsLocation(new Vector3f()),
                    enemy.getPhysicsLocation(new Vector3f()));
            if (after <= ENEMY_ACQUIRE_RANGE) {
                acquired = true;
                acquisitionDistance = after;
            }
            if (acquired && after > ENEMY_ACQUIRE_RANGE + 0.0001f) {
                acquiredAboveThreshold = true;
            }
        }
        player.setWalkDirection(Vector3f.ZERO);

        if (!acquired) {
            return ResultSnapshot.failed(initialSeparation, approachSteps, "enemy never legitimately crossed acquisition threshold");
        }

        playerPosition = player.getPhysicsLocation(new Vector3f());
        enemyPosition = enemy.getPhysicsLocation(new Vector3f());
        NavigationPath navigation = buildPath(enemyPosition, playerPosition);
        if (!navigation.valid()) {
            return ResultSnapshot.failed(initialSeparation, approachSteps, navigation.failureReason());
        }

        float chaseStartDistance = horizontalDistance(playerPosition, enemyPosition);
        int waypointIndex = navigation.points().size() > 1 ? 1 : 0;
        boolean stayedInsideArena = insideArena(playerPosition) && insideArena(enemyPosition);
        float maxCommandedEnemyIncrement = 0.0f;

        for (int i = 0; i < CHASE_STEPS; i++) {
            enemyPosition = enemy.getPhysicsLocation(new Vector3f());
            playerPosition = player.getPhysicsLocation(new Vector3f());
            while (waypointIndex < navigation.points().size() - 1
                    && horizontalDistance(enemyPosition, navigation.points().get(waypointIndex)) <= 0.20f) {
                waypointIndex += 1;
            }

            Vector3f target = navigation.points().get(waypointIndex);
            Vector3f delta = target.subtract(enemyPosition);
            delta.y = 0.0f;
            float length = delta.length();
            Vector3f increment = Vector3f.ZERO;
            if (length > 0.01f) {
                increment = delta.mult((ENEMY_MOVE_SPEED * FIXED_DT) / length);
            }
            maxCommandedEnemyIncrement = Math.max(maxCommandedEnemyIncrement, increment.length());
            enemy.setWalkDirection(increment);
            space.update(FIXED_DT);
            stayedInsideArena &= insideArena(player.getPhysicsLocation(new Vector3f()));
            stayedInsideArena &= insideArena(enemy.getPhysicsLocation(new Vector3f()));
        }

        enemy.setWalkDirection(Vector3f.ZERO);
        float releaseStartDistance = horizontalDistance(
                player.getPhysicsLocation(new Vector3f()),
                enemy.getPhysicsLocation(new Vector3f()));
        Vector3f releaseStartEnemy = enemy.getPhysicsLocation(new Vector3f());
        for (int i = 0; i < RELEASE_STEPS; i++) {
            space.update(FIXED_DT);
        }
        Vector3f finalPlayer = player.getPhysicsLocation(new Vector3f());
        Vector3f finalEnemy = enemy.getPhysicsLocation(new Vector3f());
        float finalDistance = horizontalDistance(finalPlayer, finalEnemy);
        float releaseDrift = horizontalDistance(releaseStartEnemy, finalEnemy);
        float distanceReduced = chaseStartDistance - finalDistance;

        Vector3f observationCopy = enemy.getPhysicsLocation(new Vector3f());
        float authoritativeX = observationCopy.x;
        float authoritativeZ = observationCopy.z;
        observationCopy.set(999.0f, 999.0f, 999.0f);
        Vector3f authoritativeAgain = enemy.getPhysicsLocation(new Vector3f());
        boolean observationIsolation = Math.abs(authoritativeAgain.x - authoritativeX) < 0.0001f
                && Math.abs(authoritativeAgain.z - authoritativeZ) < 0.0001f;

        boolean acquisitionValid = !acquiredAboveThreshold
                && lastPreAcquisitionDistance > ENEMY_ACQUIRE_RANGE
                && acquisitionDistance <= ENEMY_ACQUIRE_RANGE
                && acquisitionDistance >= ENEMY_ACQUIRE_RANGE - 0.10f;
        boolean commandedSpeedValid = maxCommandedEnemyIncrement <= ENEMY_MOVE_SPEED * FIXED_DT + 0.00001f;
        boolean chaseReducedDistance = distanceReduced >= 6.0f;
        boolean releaseStable = releaseDrift <= 0.005f
                && Math.abs(finalDistance - releaseStartDistance) <= 0.005f;
        boolean passed = initialSeparation >= 15.99f
                && initialSeparation <= 16.01f
                && acquisitionValid
                && navigation.pathInsideArena()
                && navigation.pathLengthMetres() > 10.0
                && navigation.pathLengthMetres() <= 12.5
                && commandedSpeedValid
                && chaseReducedDistance
                && stayedInsideArena
                && releaseStable
                && observationIsolation;

        return new ResultSnapshot(
                passed,
                true,
                true,
                initialSeparation,
                approachSteps,
                lastPreAcquisitionDistance,
                acquisitionDistance,
                navigation.points().size(),
                navigation.pathLengthMetres(),
                chaseStartDistance,
                finalDistance,
                distanceReduced,
                maxCommandedEnemyIncrement,
                releaseDrift,
                stayedInsideArena,
                navigation.pathInsideArena(),
                observationIsolation,
                acquisitionValid,
                commandedSpeedValid,
                chaseReducedDistance,
                releaseStable,
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

    private static NavigationPath buildPath(Vector3f from, Vector3f to) {
        float halfWidth = ARENA_WIDTH / 2.0f;
        float halfDepth = ARENA_DEPTH / 2.0f;
        float[] vertices = {
            -halfWidth, 0.0f, -halfDepth,
             halfWidth, 0.0f, -halfDepth,
             halfWidth, 0.0f,  halfDepth,
            -halfWidth, 0.0f,  halfDepth
        };
        int[] indices = {0, 2, 1, 0, 3, 2};

        Mesh jmeMesh = new Mesh();
        jmeMesh.setBuffer(Type.Position, 3, vertices);
        jmeMesh.setBuffer(Type.Index, 3, indices);
        jmeMesh.updateBound();
        Geometry arenaGeometry = new Geometry("BYJTT-ChaseArena", jmeMesh);
        if (arenaGeometry.getMesh().getVertexCount() != 4 || arenaGeometry.getMesh().getTriangleCount() != 2) {
            return NavigationPath.failed("jMonkeyEngine arena geometry did not execute as expected");
        }

        SimpleInputGeomProvider geometry = new SimpleInputGeomProvider(vertices.clone(), indices.clone());
        RecastConfig config = new RecastConfig(
                PartitionType.WATERSHED,
                CELL_SIZE,
                CELL_HEIGHT,
                AGENT_HEIGHT,
                AGENT_RADIUS,
                AGENT_MAX_CLIMB,
                AGENT_MAX_SLOPE,
                2,
                4,
                12.0f,
                1.3f,
                VERTS_PER_POLY,
                6.0f,
                1.0f,
                new AreaModification(1));
        RecastBuilderConfig builderConfig = new RecastBuilderConfig(
                config, geometry.getMeshBoundsMin(), geometry.getMeshBoundsMax());
        RecastBuilderResult built = new RecastBuilder().build(geometry, builderConfig);
        MeshData meshData = createMeshData(built);
        NavMeshQuery query = new NavMeshQuery(new NavMesh(meshData, VERTS_PER_POLY, 0));
        QueryFilter filter = new DefaultQueryFilter();
        float[] extents = {2.0f, 4.0f, 2.0f};
        float[] startRequested = {from.x, 0.0f, from.z};
        float[] endRequested = {to.x, 0.0f, to.z};

        Result<FindNearestPolyResult> startNearest = query.findNearestPoly(startRequested, extents, filter);
        Result<FindNearestPolyResult> endNearest = query.findNearestPoly(endRequested, extents, filter);
        if (!startNearest.succeeded() || !endNearest.succeeded()
                || startNearest.result.getNearestRef() == 0L || endNearest.result.getNearestRef() == 0L) {
            return NavigationPath.failed("nearest-poly lookup failed");
        }
        float[] start = startNearest.result.getNearestPos();
        float[] end = endNearest.result.getNearestPos();
        Result<List<Long>> corridor = query.findPath(
                startNearest.result.getNearestRef(), endNearest.result.getNearestRef(), start, end, filter);
        if (!corridor.succeeded() || corridor.result == null || corridor.result.isEmpty()) {
            return NavigationPath.failed("Detour corridor path failed");
        }
        Result<List<StraightPathItem>> straightResult = query.findStraightPath(
                start, end, corridor.result, 64, 0);
        if (!straightResult.succeeded() || straightResult.result == null || straightResult.result.size() < 2) {
            return NavigationPath.failed("Detour straight path failed");
        }

        List<Vector3f> points = straightResult.result.stream()
                .map(item -> item.getPos())
                .map(point -> new Vector3f(point[0], point[1], point[2]))
                .toList();
        double pathLength = 0.0;
        boolean inside = true;
        for (int i = 0; i < points.size(); i++) {
            inside &= insideArena(points.get(i));
            if (i > 0) {
                pathLength += horizontalDistance(points.get(i - 1), points.get(i));
            }
        }
        return new NavigationPath(true, points, pathLength, inside, "");
    }

    private static MeshData createMeshData(RecastBuilderResult built) {
        PolyMesh polyMesh = built.getMesh();
        for (int i = 0; i < polyMesh.npolys; i++) {
            polyMesh.flags[i] = 1;
        }
        PolyMeshDetail detail = built.getMeshDetail();
        NavMeshDataCreateParams params = new NavMeshDataCreateParams();
        params.verts = polyMesh.verts;
        params.vertCount = polyMesh.nverts;
        params.polys = polyMesh.polys;
        params.polyAreas = polyMesh.areas;
        params.polyFlags = polyMesh.flags;
        params.polyCount = polyMesh.npolys;
        params.nvp = polyMesh.nvp;
        params.detailMeshes = detail.meshes;
        params.detailVerts = detail.verts;
        params.detailVertsCount = detail.nverts;
        params.detailTris = detail.tris;
        params.detailTriCount = detail.ntris;
        params.walkableHeight = AGENT_HEIGHT;
        params.walkableRadius = AGENT_RADIUS;
        params.walkableClimb = AGENT_MAX_CLIMB;
        params.bmin = polyMesh.bmin;
        params.bmax = polyMesh.bmax;
        params.cs = CELL_SIZE;
        params.ch = CELL_HEIGHT;
        params.buildBvTree = true;
        MeshData meshData = NavMeshBuilder.createNavMeshData(params);
        if (meshData == null) {
            throw new IllegalStateException("Recast produced no Detour mesh data");
        }
        return meshData;
    }

    private static void addArenaWalls(PhysicsSpace space) {
        float halfWidth = ARENA_WIDTH / 2.0f;
        float halfDepth = ARENA_DEPTH / 2.0f;
        addStaticBox(space, new Vector3f(WALL_HALF_THICKNESS, WALL_HALF_HEIGHT, halfDepth),
                new Vector3f(halfWidth + WALL_HALF_THICKNESS, 0.0f, 0.0f));
        addStaticBox(space, new Vector3f(WALL_HALF_THICKNESS, WALL_HALF_HEIGHT, halfDepth),
                new Vector3f(-halfWidth - WALL_HALF_THICKNESS, 0.0f, 0.0f));
        addStaticBox(space, new Vector3f(halfWidth, WALL_HALF_HEIGHT, WALL_HALF_THICKNESS),
                new Vector3f(0.0f, 0.0f, halfDepth + WALL_HALF_THICKNESS));
        addStaticBox(space, new Vector3f(halfWidth, WALL_HALF_HEIGHT, WALL_HALF_THICKNESS),
                new Vector3f(0.0f, 0.0f, -halfDepth - WALL_HALF_THICKNESS));
    }

    private static void addStaticBox(PhysicsSpace space, Vector3f halfExtents, Vector3f location) {
        PhysicsRigidBody wall = new PhysicsRigidBody(new BoxCollisionShape(halfExtents), 0.0f);
        wall.setPhysicsLocation(location);
        wall.setFriction(0.0f);
        wall.setRestitution(0.0f);
        space.add(wall);
    }

    private static float horizontalDistance(Vector3f a, Vector3f b) {
        float dx = a.x - b.x;
        float dz = a.z - b.z;
        return (float) Math.sqrt(dx * dx + dz * dz);
    }

    private static boolean insideArena(Vector3f position) {
        return position.x >= -ARENA_WIDTH / 2.0f - 0.001f
                && position.x <= ARENA_WIDTH / 2.0f + 0.001f
                && position.z >= -ARENA_DEPTH / 2.0f - 0.001f
                && position.z <= ARENA_DEPTH / 2.0f + 0.001f;
    }

    private record NavigationPath(boolean valid, List<Vector3f> points, double pathLengthMetres,
                                  boolean pathInsideArena, String failureReason) {
        static NavigationPath failed(String reason) {
            return new NavigationPath(false, List.of(), 0.0, false, reason);
        }
    }

    private record ResultSnapshot(
            boolean passed,
            boolean minieNativeLoaded,
            boolean detourExecuted,
            float initialSeparationMetres,
            int approachSteps,
            float lastPreAcquisitionDistanceMetres,
            float acquisitionDistanceMetres,
            int straightPathPoints,
            double pathLengthMetres,
            float chaseStartDistanceMetres,
            float finalDistanceMetres,
            float distanceReducedMetres,
            float maxCommandedEnemyIncrementMetres,
            float releaseDriftMetres,
            boolean stayedInsideArena,
            boolean pathInsideArena,
            boolean observationMutationIsolation,
            boolean acquisitionValid,
            boolean commandedSpeedValid,
            boolean chaseReducedDistance,
            boolean releaseStable,
            boolean postNavigationClamp,
            boolean postPhysicsArenaClamp,
            boolean externalInputExecuted,
            String failureReason) {

        static ResultSnapshot failed(float initialSeparation, int approachSteps, String reason) {
            return new ResultSnapshot(false, true, false, initialSeparation, approachSteps,
                    -1.0f, -1.0f, 0, 0.0, -1.0f, -1.0f, 0.0f, 0.0f, -1.0f,
                    false, false, false, false, false, false, false,
                    false, false, false, reason);
        }

        String toJson() {
            return String.format(Locale.ROOT,
                    "{\n"
                            + "  \"passed\": %s,\n"
                            + "  \"jmonkeyengine_version\": \"3.9.0-stable\",\n"
                            + "  \"minie_version\": \"9.0.3\",\n"
                            + "  \"recast4j_version\": \"1.5.12\",\n"
                            + "  \"physics_backend\": \"Minie/Libbulletjme\",\n"
                            + "  \"arena_width_metres\": %.1f,\n"
                            + "  \"arena_depth_metres\": %.1f,\n"
                            + "  \"player_spawn\": [0.0, 0.0, 10.0],\n"
                            + "  \"enemy_spawn\": [0.0, 0.0, -6.0],\n"
                            + "  \"player_walk_speed_metres_per_second\": %.1f,\n"
                            + "  \"enemy_move_speed_metres_per_second\": %.1f,\n"
                            + "  \"enemy_acquire_range_metres\": %.1f,\n"
                            + "  \"fixed_dt_seconds\": %.9f,\n"
                            + "  \"initial_separation_metres\": %.6f,\n"
                            + "  \"approach_steps\": %d,\n"
                            + "  \"last_pre_acquisition_distance_metres\": %.6f,\n"
                            + "  \"acquisition_distance_metres\": %.6f,\n"
                            + "  \"straight_path_points\": %d,\n"
                            + "  \"path_length_metres\": %.9f,\n"
                            + "  \"chase_steps\": %d,\n"
                            + "  \"chase_start_distance_metres\": %.6f,\n"
                            + "  \"final_distance_metres\": %.6f,\n"
                            + "  \"distance_reduced_metres\": %.6f,\n"
                            + "  \"max_commanded_enemy_increment_metres\": %.9f,\n"
                            + "  \"release_steps\": %d,\n"
                            + "  \"release_drift_metres\": %.9f,\n"
                            + "  \"minie_native_loaded\": %s,\n"
                            + "  \"detour_executed\": %s,\n"
                            + "  \"acquisition_valid\": %s,\n"
                            + "  \"commanded_speed_valid\": %s,\n"
                            + "  \"chase_reduced_distance\": %s,\n"
                            + "  \"release_stable\": %s,\n"
                            + "  \"stayed_inside_arena\": %s,\n"
                            + "  \"path_inside_arena\": %s,\n"
                            + "  \"observation_mutation_isolation\": %s,\n"
                            + "  \"post_navigation_clamp\": %s,\n"
                            + "  \"post_physics_arena_clamp\": %s,\n"
                            + "  \"external_input_executed\": %s,\n"
                            + "  \"combat_executed\": false,\n"
                            + "  \"failure_reason\": \"%s\"\n"
                            + "}\n",
                    passed,
                    ARENA_WIDTH,
                    ARENA_DEPTH,
                    PLAYER_WALK_SPEED,
                    ENEMY_MOVE_SPEED,
                    ENEMY_ACQUIRE_RANGE,
                    FIXED_DT,
                    initialSeparationMetres,
                    approachSteps,
                    lastPreAcquisitionDistanceMetres,
                    acquisitionDistanceMetres,
                    straightPathPoints,
                    pathLengthMetres,
                    CHASE_STEPS,
                    chaseStartDistanceMetres,
                    finalDistanceMetres,
                    distanceReducedMetres,
                    maxCommandedEnemyIncrementMetres,
                    RELEASE_STEPS,
                    releaseDriftMetres,
                    minieNativeLoaded,
                    detourExecuted,
                    acquisitionValid,
                    commandedSpeedValid,
                    chaseReducedDistance,
                    releaseStable,
                    stayedInsideArena,
                    pathInsideArena,
                    observationMutationIsolation,
                    postNavigationClamp,
                    postPhysicsArenaClamp,
                    externalInputExecuted,
                    failureReason.replace("\\", "\\\\").replace("\"", "\\\""));
        }
    }
}
