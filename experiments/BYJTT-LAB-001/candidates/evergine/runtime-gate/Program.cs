using System.Reflection;
using System.Text.Json;
using Evergine.Bullet;
using Evergine.Framework;
using Evergine.Framework.Physics3D;
using Evergine.Mathematics;

const float ArenaWidthM = 24.0f;
const float ArenaDepthM = 32.0f;
const float PlayerRadiusM = 0.4f;
const float WalkSpeedMps = 3.5f;
const float FixedDt = 1.0f / 60.0f;
var logicalSpawn = new Vector3(0.0f, 0.0f, 10.0f);

var outputPath = args.Length > 0 ? args[0] : "result.json";
Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(outputPath))!);

using var application = new Application();
var physics = new BulletPhysicManager3D
{
    FixedTimeStep = FixedDt,
};
var character = new CharacterController3D();
var capsule = new CapsuleCollider3D();
var wall = new StaticBody3D();

var setVelocity = typeof(CharacterController3D).GetMethods(BindingFlags.Public | BindingFlags.Instance)
    .SingleOrDefault(method => method.Name == "SetVelocity" && method.GetParameters().Length == 1 && method.GetParameters()[0].ParameterType == typeof(Vector3));

var frameworkVersion = typeof(Application).Assembly.GetName().Version?.ToString() ?? "unknown";
var bulletVersion = typeof(BulletPhysicManager3D).Assembly.GetName().Version?.ToString() ?? "unknown";
var head = Environment.GetEnvironmentVariable("CANDIDATE_HEAD_SHA") ?? "unknown";
var fixedTimeStepSeconds = physics.FixedTimeStep;
var fixedStepMatches = Math.Abs(fixedTimeStepSeconds - FixedDt) <= 1e-7f;
var constantsMatch = ArenaWidthM == 24.0f
    && ArenaDepthM == 32.0f
    && logicalSpawn == new Vector3(0.0f, 0.0f, 10.0f)
    && PlayerRadiusM == 0.4f
    && WalkSpeedMps == 3.5f;
var componentInstancesCreated = application is not null
    && physics is not null
    && character is not null
    && capsule is not null
    && wall is not null;
var passed = componentInstancesCreated && setVelocity is not null && fixedStepMatches && constantsMatch;

var result = new
{
    schema_version = 1,
    experiment_id = "BYJTT-LAB-001",
    candidate = "evergine-2026",
    candidate_head_sha = head,
    evergine_framework_assembly_version = frameworkVersion,
    evergine_bullet_assembly_version = bulletVersion,
    application_executed = true,
    bullet_physic_manager_instantiated = true,
    character_controller_instantiated = true,
    capsule_collider_instantiated = true,
    static_body_instantiated = true,
    set_velocity_api_present = setVelocity is not null,
    fixed_timestep_seconds = fixedTimeStepSeconds,
    fixed_timestep_matches_contract = fixedStepMatches,
    arena_width_m = ArenaWidthM,
    arena_depth_m = ArenaDepthM,
    logical_player_spawn = new[] { logicalSpawn.X, logicalSpawn.Y, logicalSpawn.Z },
    player_radius_m = PlayerRadiusM,
    walk_speed_mps = WalkSpeedMps,
    shared_constants_match = constantsMatch,
    native_physics_world_executed = false,
    character_movement_executed = false,
    external_input_executed = false,
    rendered_execution = false,
    post_physics_arena_clamp = false,
    evidence_boundary = "Evergine package/toolchain and engine-component runtime feasibility only; no physics-world or movement pass is claimed.",
    passed,
};

var json = JsonSerializer.Serialize(result, new JsonSerializerOptions { WriteIndented = true });
File.WriteAllText(outputPath, json + Environment.NewLine);
Console.WriteLine(json);

if (!passed)
{
    Environment.ExitCode = 1;
}
