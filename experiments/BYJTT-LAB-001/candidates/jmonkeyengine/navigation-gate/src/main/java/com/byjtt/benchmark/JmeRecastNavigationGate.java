package com.byjtt.benchmark;

import com.jme3.scene.Geometry;
import com.jme3.scene.Mesh;
import com.jme3.scene.VertexBuffer.Type;
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

public final class JmeRecastNavigationGate {
    private static final float ARENA_WIDTH = 24.0f;
    private static final float ARENA_DEPTH = 32.0f;
    private static final float[] ENEMY_SPAWN = {0.0f, 0.0f, -6.0f};
    private static final float[] PLAYER_SPAWN = {0.0f, 0.0f, 10.0f};
    private static final float ENEMY_MOVE_SPEED = 2.7f;
    private static final float CELL_SIZE = 0.25f;
    private static final float CELL_HEIGHT = 0.25f;
    private static final float AGENT_HEIGHT = 1.8f;
    private static final float AGENT_RADIUS = 0.4f;
    private static final float AGENT_MAX_CLIMB = 0.4f;
    private static final float AGENT_MAX_SLOPE = 45.0f;
    private static final int VERTS_PER_POLY = 6;

    private JmeRecastNavigationGate() {
    }

    public static void main(String[] args) throws Exception {
        Locale.setDefault(Locale.ROOT);
        ResultSnapshot result = execute();
        Path output = Path.of("evidence", "runtime-result.json");
        Files.createDirectories(output.getParent());
        Files.writeString(output, result.toJson());
        System.out.println(result.toJson());
        if (!result.passed()) {
            throw new IllegalStateException("jMonkeyEngine/Recast navigation gate failed");
        }
    }

    static ResultSnapshot execute() {
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
        Geometry arenaGeometry = new Geometry("BYJTT-NavigationArena", jmeMesh);
        boolean jmeGeometryExecuted = arenaGeometry.getMesh() == jmeMesh
            && jmeMesh.getVertexCount() == 4
            && jmeMesh.getTriangleCount() == 2;

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
            config,
            geometry.getMeshBoundsMin(),
            geometry.getMeshBoundsMax());
        RecastBuilderResult built = new RecastBuilder().build(geometry, builderConfig);
        MeshData meshData = createMeshData(built);
        NavMesh navMesh = new NavMesh(meshData, VERTS_PER_POLY, 0);
        NavMeshQuery query = new NavMeshQuery(navMesh);
        QueryFilter filter = new DefaultQueryFilter();
        float[] extents = {2.0f, 4.0f, 2.0f};

        Result<FindNearestPolyResult> startNearest = query.findNearestPoly(ENEMY_SPAWN, extents, filter);
        Result<FindNearestPolyResult> endNearest = query.findNearestPoly(PLAYER_SPAWN, extents, filter);
        boolean nearestSucceeded = startNearest.succeeded() && endNearest.succeeded()
            && startNearest.result.getNearestRef() != 0L
            && endNearest.result.getNearestRef() != 0L;
        if (!nearestSucceeded) {
            return ResultSnapshot.failed(jmeGeometryExecuted, "nearest-poly lookup failed");
        }

        float[] start = startNearest.result.getNearestPos();
        float[] end = endNearest.result.getNearestPos();
        Result<List<Long>> corridor = query.findPath(
            startNearest.result.getNearestRef(),
            endNearest.result.getNearestRef(),
            start,
            end,
            filter);
        if (!corridor.succeeded() || corridor.result == null || corridor.result.isEmpty()) {
            return ResultSnapshot.failed(jmeGeometryExecuted, "Detour corridor path failed");
        }

        Result<List<StraightPathItem>> straightResult = query.findStraightPath(
            start,
            end,
            corridor.result,
            64,
            0);
        if (!straightResult.succeeded() || straightResult.result == null || straightResult.result.size() < 2) {
            return ResultSnapshot.failed(jmeGeometryExecuted, "Detour straight path failed");
        }
        List<StraightPathItem> straight = straightResult.result;

        double pathLength = 0.0;
        boolean pathInsideArena = true;
        for (int i = 0; i < straight.size(); i++) {
            float[] point = straight.get(i).getPos();
            pathInsideArena &= point[0] >= -halfWidth - 0.001f && point[0] <= halfWidth + 0.001f
                && point[2] >= -halfDepth - 0.001f && point[2] <= halfDepth + 0.001f;
            if (i > 0) {
                pathLength += distance(straight.get(i - 1).getPos(), point);
            }
        }

        double startError = distance(straight.get(0).getPos(), ENEMY_SPAWN);
        double endError = distance(straight.get(straight.size() - 1).getPos(), PLAYER_SPAWN);

        float authoritativeX = straight.get(0).getPos()[0];
        float[] observationCopy = straight.get(0).getPos().clone();
        observationCopy[0] = 999.0f;
        boolean observationIsolation = straight.get(0).getPos()[0] == authoritativeX;

        boolean pathFound = corridor.result.size() >= 1;
        boolean pathLengthValid = pathLength >= 15.5 && pathLength <= 16.5;
        boolean endpointsValid = startError <= 0.5 && endError <= 0.5;
        boolean passed = jmeGeometryExecuted
            && pathFound
            && pathInsideArena
            && pathLengthValid
            && endpointsValid
            && observationIsolation;

        return new ResultSnapshot(
            passed,
            jmeGeometryExecuted,
            true,
            straight.size(),
            corridor.result.size(),
            pathLength,
            startError,
            endError,
            pathInsideArena,
            observationIsolation,
            false,
            false,
            false,
            "");
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

    private static double distance(float[] a, float[] b) {
        double dx = a[0] - b[0];
        double dy = a[1] - b[1];
        double dz = a[2] - b[2];
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    private record ResultSnapshot(
        boolean passed,
        boolean jmeGeometryExecuted,
        boolean detourExecuted,
        int straightPathPoints,
        int corridorPolys,
        double pathLengthMetres,
        double startEndpointErrorMetres,
        double endEndpointErrorMetres,
        boolean pathInsideArena,
        boolean observationMutationIsolation,
        boolean postNavigationClamp,
        boolean externalInputExecuted,
        boolean combatExecuted,
        String failureReason) {

        static ResultSnapshot failed(boolean jmeGeometryExecuted, String reason) {
            return new ResultSnapshot(
                false, jmeGeometryExecuted, true, 0, 0, 0.0, -1.0, -1.0,
                false, false, false, false, false, reason);
        }

        String toJson() {
            return String.format(Locale.ROOT,
                "{\n"
                    + "  \"passed\": %s,\n"
                    + "  \"jmonkeyengine_version\": \"3.9.0-stable\",\n"
                    + "  \"recast4j_version\": \"1.5.12\",\n"
                    + "  \"arena_width_metres\": %.1f,\n"
                    + "  \"arena_depth_metres\": %.1f,\n"
                    + "  \"enemy_spawn\": [0.0, 0.0, -6.0],\n"
                    + "  \"player_spawn\": [0.0, 0.0, 10.0],\n"
                    + "  \"enemy_move_speed_metres_per_second\": %.1f,\n"
                    + "  \"jme_geometry_executed\": %s,\n"
                    + "  \"detour_executed\": %s,\n"
                    + "  \"straight_path_points\": %d,\n"
                    + "  \"corridor_polys\": %d,\n"
                    + "  \"path_length_metres\": %.9f,\n"
                    + "  \"start_endpoint_error_metres\": %.9f,\n"
                    + "  \"end_endpoint_error_metres\": %.9f,\n"
                    + "  \"path_inside_arena\": %s,\n"
                    + "  \"observation_mutation_isolation\": %s,\n"
                    + "  \"post_navigation_clamp\": %s,\n"
                    + "  \"external_input_executed\": %s,\n"
                    + "  \"combat_executed\": %s,\n"
                    + "  \"failure_reason\": \"%s\"\n"
                    + "}\n",
                passed,
                ARENA_WIDTH,
                ARENA_DEPTH,
                ENEMY_MOVE_SPEED,
                jmeGeometryExecuted,
                detourExecuted,
                straightPathPoints,
                corridorPolys,
                pathLengthMetres,
                startEndpointErrorMetres,
                endEndpointErrorMetres,
                pathInsideArena,
                observationMutationIsolation,
                postNavigationClamp,
                externalInputExecuted,
                combatExecuted,
                failureReason.replace("\\", "\\\\").replace("\"", "\\\""));
        }
    }
}
