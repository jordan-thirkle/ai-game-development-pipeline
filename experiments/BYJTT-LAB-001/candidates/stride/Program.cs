using System.Numerics;
using System.Runtime.CompilerServices;
using System.Text.Json;
using BepuPhysics;
using BepuPhysics.Collidables;
using BepuPhysics.CollisionDetection;
using BepuPhysics.Constraints;
using BepuUtilities;
using BepuUtilities.Memory;
using Stride.BepuPhysics;
using StrideCharacterComponent = Stride.BepuPhysics.CharacterComponent;
using BepuSimulation = BepuPhysics.Simulation;

const float ArenaWidth = 24f;
const float ArenaDepth = 32f;
const float WalkSpeed = 3.5f;
const float PlayerRadius = 0.6f;
const float PlayerCylinderLength = 1.2f;
const float FixedStep = 1f / 60f;
const int Steps = 300;
const float EastInnerFace = ArenaWidth / 2f;
const float ExpectedCenterCeiling = EastInnerFace - PlayerRadius;
const float Tolerance = 0.035f;

var outputPath = args.Length > 0 ? args[0] : "artifacts/physics-gate/result.json";
Directory.CreateDirectory(Path.GetDirectoryName(outputPath) ?? ".");

using var bufferPool = new BufferPool();
using var threadDispatcher = new ThreadDispatcher(Math.Max(1, Environment.ProcessorCount));
using var simulation = BepuSimulation.Create(
    bufferPool,
    new NarrowPhaseCallbacks(),
    new PoseIntegratorCallbacks(new Vector3(0f, -9.81f, 0f)),
    new SolveDescription(8, 1));

var floorShape = simulation.Shapes.Add(new Box(ArenaWidth, 0.5f, ArenaDepth));
simulation.Statics.Add(new StaticDescription(new Vector3(0f, -0.25f, 0f), floorShape));

AddWall(simulation, new Vector3(12.25f, 2f, 0f), new Vector3(0.5f, 4f, ArenaDepth + 0.5f));
AddWall(simulation, new Vector3(-12.25f, 2f, 0f), new Vector3(0.5f, 4f, ArenaDepth + 0.5f));
AddWall(simulation, new Vector3(0f, 2f, 16.25f), new Vector3(ArenaWidth + 0.5f, 4f, 0.5f));
AddWall(simulation, new Vector3(0f, 2f, -16.25f), new Vector3(ArenaWidth + 0.5f, 4f, 0.5f));

var capsule = new Capsule(PlayerRadius, PlayerCylinderLength);
var capsuleShape = simulation.Shapes.Add(capsule);
var inertia = capsule.ComputeInertia(1f);
var bodyHandle = simulation.Bodies.Add(BodyDescription.CreateDynamic(
    new Vector3(0f, PlayerRadius + PlayerCylinderLength / 2f, 10f),
    inertia,
    capsuleShape,
    0.01f));

var body = simulation.Bodies[bodyHandle];
float maxX = body.Pose.Position.X;
for (var step = 0; step < Steps; step++)
{
    body.Velocity.Linear.X = WalkSpeed;
    simulation.Timestep(FixedStep, threadDispatcher);
    maxX = MathF.Max(maxX, body.Pose.Position.X);
}

var finalPosition = body.Pose.Position;
var finalVelocity = body.Velocity.Linear;
var nativeWallStopObserved =
    finalPosition.X >= ExpectedCenterCeiling - 0.12f &&
    maxX <= ExpectedCenterCeiling + Tolerance &&
    MathF.Abs(finalVelocity.X) <= 0.1f;

var authoritativeX = finalPosition.X;
var observation = new Dictionary<string, object>
{
    ["player_x"] = authoritativeX,
    ["player_z"] = finalPosition.Z,
    ["walk_speed"] = WalkSpeed,
};
observation["player_x"] = -999f;
var observationCopyIsolated = MathF.Abs(body.Pose.Position.X - authoritativeX) < 0.0001f;

var strideAssembly = typeof(StrideCharacterComponent).Assembly.GetName();
var backendAssembly = typeof(BepuSimulation).Assembly.GetName();
var passed = nativeWallStopObserved && observationCopyIsolated;

var result = new
{
    passed,
    candidate = "stride-bepu",
    stride_bepu_assembly = strideAssembly.FullName,
    stride_bepu_version = strideAssembly.Version?.ToString(),
    bepu_backend_assembly = backendAssembly.FullName,
    bepu_backend_version = backendAssembly.Version?.ToString(),
    arena_width_m = ArenaWidth,
    arena_depth_m = ArenaDepth,
    player_spawn_contract = new[] { 0f, 0f, 10f },
    simulation_spawn = new[] { 0f, PlayerRadius + PlayerCylinderLength / 2f, 10f },
    walk_speed_mps = WalkSpeed,
    fixed_step_seconds = FixedStep,
    steps = Steps,
    player_radius_m = PlayerRadius,
    expected_east_wall_center_ceiling_m = ExpectedCenterCeiling,
    max_x_m = maxX,
    final_x_m = finalPosition.X,
    final_velocity_x_mps = finalVelocity.X,
    native_wall_stop_observed = nativeWallStopObserved,
    post_physics_arena_clamp = false,
    observation_copy_isolated = observationCopyIsolated,
    stride_character_component_executed = false,
    evidence_boundary = "Stride.BepuPhysics assembly load plus its resolved Bepu backend execution only; engine CharacterComponent/scene execution remains unproven."
};

File.WriteAllText(outputPath, JsonSerializer.Serialize(result, new JsonSerializerOptions { WriteIndented = true }));
Console.WriteLine(JsonSerializer.Serialize(result));
return passed ? 0 : 1;

static void AddWall(BepuSimulation simulation, Vector3 center, Vector3 size)
{
    var shape = simulation.Shapes.Add(new Box(size.X, size.Y, size.Z));
    simulation.Statics.Add(new StaticDescription(center, shape));
}

struct NarrowPhaseCallbacks : INarrowPhaseCallbacks
{
    public void Initialize(BepuSimulation simulation) { }

    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    public bool AllowContactGeneration(int workerIndex, CollidableReference a, CollidableReference b, ref float speculativeMargin) =>
        a.Mobility == CollidableMobility.Dynamic || b.Mobility == CollidableMobility.Dynamic;

    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    public bool AllowContactGeneration(int workerIndex, CollidablePair pair, int childIndexA, int childIndexB) => true;

    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    public bool ConfigureContactManifold<TManifold>(
        int workerIndex,
        CollidablePair pair,
        ref TManifold manifold,
        out PairMaterialProperties pairMaterial)
        where TManifold : unmanaged, IContactManifold<TManifold>
    {
        pairMaterial.FrictionCoefficient = 0.8f;
        pairMaterial.MaximumRecoveryVelocity = 2f;
        pairMaterial.SpringSettings = new SpringSettings(30f, 1f);
        return true;
    }

    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    public bool ConfigureContactManifold(
        int workerIndex,
        CollidablePair pair,
        int childIndexA,
        int childIndexB,
        ref ConvexContactManifold manifold) => true;

    public void Dispose() { }
}

struct PoseIntegratorCallbacks(Vector3 gravity) : IPoseIntegratorCallbacks
{
    private Vector3Wide gravityWideDt;
    public Vector3 Gravity = gravity;

    public readonly AngularIntegrationMode AngularIntegrationMode => AngularIntegrationMode.Nonconserving;
    public readonly bool AllowSubstepsForUnconstrainedBodies => false;
    public readonly bool IntegrateVelocityForKinematics => false;

    public void Initialize(BepuSimulation simulation) { }

    public void PrepareForIntegration(float dt)
    {
        gravityWideDt = Vector3Wide.Broadcast(Gravity * dt);
    }

    public void IntegrateVelocity(
        Vector<int> bodyIndices,
        Vector3Wide position,
        QuaternionWide orientation,
        BodyInertiaWide localInertia,
        Vector<int> integrationMask,
        int workerIndex,
        Vector<float> dt,
        ref BodyVelocityWide velocity)
    {
        velocity.Linear += gravityWideDt;
    }
}
