using System.Text.Json;
using Evergine.Bullet;
using Evergine.Framework;
using Evergine.Framework.Graphics;
using Evergine.Framework.Physics3D;
using Evergine.Mathematics;

const float ArenaWidthM = 24.0f;
const float ArenaDepthM = 32.0f;
const float PlayerRadiusM = 0.4f;
const float PlayerHeightM = 1.8f;
const float WalkSpeedMps = 3.5f;
const float FixedDt = 1.0f / 60.0f;
const int DrivenSteps = 300;
const int ReleasedSteps = 60;
const float EastWallInnerFaceX = ArenaWidthM / 2.0f;
const float ExpectedEastStopX = EastWallInnerFaceX - PlayerRadiusM;

var outputPath = args.Length > 0 ? args[0] : "result.json";
Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(outputPath))!);

var logicalSpawn = new Vector3(0.0f, 0.0f, 10.0f);
var physicsSpawn = new Vector3(logicalSpawn.X, PlayerHeightM / 2.0f, logicalSpawn.Z);
var failures = new List<string>();

using var application = new Application();
using var scene = new PhysicsProbeScene(physicsSpawn);
scene.Initialize();

scene.PlayerController.SetVelocity(new Vector3(WalkSpeedMps, 0.0f, 0.0f));
float maxX = scene.PlayerTransform.Position.X;
for (var i = 0; i < DrivenSteps; i++)
{
    scene.Step(TimeSpan.FromSeconds(FixedDt));
    maxX = Math.Max(maxX, scene.PlayerTransform.Position.X);
}

var releaseStartX = scene.PlayerTransform.Position.X;
scene.PlayerController.SetVelocity(Vector3.Zero);
for (var i = 0; i < ReleasedSteps; i++)
{
    scene.Step(TimeSpan.FromSeconds(FixedDt));
    maxX = Math.Max(maxX, scene.PlayerTransform.Position.X);
}

var finalPosition = scene.PlayerTransform.Position;
var releaseDriftM = Math.Abs(finalPosition.X - releaseStartX);
var stopErrorM = Math.Abs(finalPosition.X - ExpectedEastStopX);

var observationCopy = new[] { finalPosition.X, finalPosition.Y, finalPosition.Z };
observationCopy[0] = -999.0f;
var observationIsolation = Math.Abs(scene.PlayerTransform.Position.X - finalPosition.X) <= 1e-6f;

var nativeWallStopObserved = finalPosition.X >= ExpectedEastStopX - 0.20f
    && finalPosition.X <= ExpectedEastStopX + 0.10f
    && maxX <= ExpectedEastStopX + 0.10f;
var releaseStable = releaseDriftM <= 0.01f;
var arenaContained = maxX <= EastWallInnerFaceX - PlayerRadiusM + 0.10f;

if (!nativeWallStopObserved) failures.Add("Native CharacterController did not stop at the east-wall capsule boundary.");
if (!releaseStable) failures.Add("CharacterController drifted after velocity release.");
if (!arenaContained) failures.Add("CharacterController exceeded the bounded east-wall tolerance.");
if (!observationIsolation) failures.Add("Observation copy mutation affected engine-owned transform state.");

var head = Environment.GetEnvironmentVariable("CANDIDATE_HEAD_SHA") ?? "unknown";
var result = new
{
    schema_version = 1,
    experiment_id = "BYJTT-LAB-001",
    candidate = "evergine-2026",
    candidate_head_sha = head,
    evergine_framework_assembly_version = typeof(Application).Assembly.GetName().Version?.ToString() ?? "unknown",
    evergine_bullet_assembly_version = typeof(BulletPhysicManager3D).Assembly.GetName().Version?.ToString() ?? "unknown",
    native_physics_world_executed = true,
    character_controller_executed = true,
    set_velocity_executed = true,
    external_input_executed = false,
    rendered_execution = false,
    arena_width_m = ArenaWidthM,
    arena_depth_m = ArenaDepthM,
    logical_player_spawn = new[] { logicalSpawn.X, logicalSpawn.Y, logicalSpawn.Z },
    physics_player_spawn = new[] { physicsSpawn.X, physicsSpawn.Y, physicsSpawn.Z },
    player_radius_m = PlayerRadiusM,
    player_height_m = PlayerHeightM,
    walk_speed_mps = WalkSpeedMps,
    fixed_timestep_seconds = FixedDt,
    driven_steps = DrivenSteps,
    released_steps = ReleasedSteps,
    expected_east_stop_x_m = ExpectedEastStopX,
    maximum_x_m = maxX,
    release_start_x_m = releaseStartX,
    final_position_m = new[] { finalPosition.X, finalPosition.Y, finalPosition.Z },
    stop_error_m = stopErrorM,
    release_drift_m = releaseDriftM,
    native_wall_stop_observed = nativeWallStopObserved,
    release_stable = releaseStable,
    arena_contained = arenaContained,
    observation_copy_isolated = observationIsolation,
    post_physics_arena_clamp = false,
    direct_position_mutation_exposed_to_proof = false,
    failures,
    evidence_boundary = "Headless Evergine Bullet scene plus CharacterController3D SetVelocity movement/collision only; no external-input, rendering, navigation, combat, progression, persistence, device or human-playability claim.",
    passed = failures.Count == 0,
};

var json = JsonSerializer.Serialize(result, new JsonSerializerOptions { WriteIndented = true });
File.WriteAllText(outputPath, json + Environment.NewLine);
Console.WriteLine(json);
if (failures.Count != 0)
{
    Environment.ExitCode = 1;
}

sealed class PhysicsProbeScene : Scene
{
    private const float SceneArenaWidthM = 24.0f;
    private const float SceneArenaDepthM = 32.0f;
    private const float ScenePlayerRadiusM = 0.4f;
    private const float ScenePlayerHeightM = 1.8f;
    private const float SceneFixedDt = 1.0f / 60.0f;
    private readonly Vector3 playerSpawn;

    public PhysicsProbeScene(Vector3 playerSpawn)
    {
        this.playerSpawn = playerSpawn;
    }

    public Transform3D PlayerTransform { get; private set; } = null!;

    public CharacterController3D PlayerController { get; private set; } = null!;

    public override void RegisterManagers()
    {
        base.RegisterManagers();
        this.Managers.AddManager(new BulletPhysicManager3D
        {
            FixedTimeStep = SceneFixedDt,
        });
    }

    protected override void CreateScene()
    {
        base.CreateScene();

        this.AddStaticBox(new Vector3(0.0f, -0.10f, 0.0f), new Vector3(SceneArenaWidthM + 0.8f, 0.20f, SceneArenaDepthM + 0.8f));
        this.AddStaticBox(new Vector3(-(SceneArenaWidthM / 2.0f + 0.20f), 1.0f, 0.0f), new Vector3(0.40f, 2.0f, SceneArenaDepthM));
        this.AddStaticBox(new Vector3(SceneArenaWidthM / 2.0f + 0.20f, 1.0f, 0.0f), new Vector3(0.40f, 2.0f, SceneArenaDepthM));
        this.AddStaticBox(new Vector3(0.0f, 1.0f, -(SceneArenaDepthM / 2.0f + 0.20f)), new Vector3(SceneArenaWidthM, 2.0f, 0.40f));
        this.AddStaticBox(new Vector3(0.0f, 1.0f, SceneArenaDepthM / 2.0f + 0.20f), new Vector3(SceneArenaWidthM, 2.0f, 0.40f));

        this.PlayerTransform = new Transform3D { Position = this.playerSpawn };
        this.PlayerController = new CharacterController3D();
        var player = new Entity()
            .AddComponent(this.PlayerTransform)
            .AddComponent(this.PlayerController)
            .AddComponent(new CapsuleCollider3D
            {
                Radius = ScenePlayerRadiusM,
                Height = ScenePlayerHeightM,
            });
        this.Managers.EntityManager.Add(player);
    }

    public void Step(TimeSpan elapsed)
    {
        base.Update(elapsed);
    }

    private void AddStaticBox(Vector3 position, Vector3 size)
    {
        var wall = new Entity()
            .AddComponent(new Transform3D { Position = position })
            .AddComponent(new StaticBody3D())
            .AddComponent(new BoxCollider3D { Size = size });
        this.Managers.EntityManager.Add(wall);
    }
}
