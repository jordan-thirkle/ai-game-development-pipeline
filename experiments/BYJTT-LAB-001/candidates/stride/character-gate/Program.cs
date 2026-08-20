using System.Text.Json;
using Stride.BepuPhysics;
using Stride.BepuPhysics.Definitions.Colliders;
using Stride.Core.Mathematics;
using Stride.Engine;
using Stride.Games;

const float ArenaWidth = 24f;
const float ArenaDepth = 32f;
const float WalkSpeed = 3.5f;
const float PlayerRadius = 0.4f;
const float PlayerCylinderLength = 1.0f;
const float WallThickness = 0.4f;
const int DrivenSteps = 300;
const int ReleasedSteps = 60;

var resultPath = args.Length > 0 ? args[0] : "result.json";
Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(resultPath))!);

try
{
    using var game = new CharacterGateGame(
        resultPath,
        ArenaWidth,
        ArenaDepth,
        WalkSpeed,
        PlayerRadius,
        PlayerCylinderLength,
        WallThickness,
        DrivenSteps,
        ReleasedSteps);
    var context = GameContextFactory.NewGameContext(AppContextType.DesktopSDL, 320, 180);
    game.Run(context);
    return game.ExitCode;
}
catch (Exception ex)
{
    var failed = new GateResult
    {
        Passed = false,
        Error = ex.ToString(),
        StrideCharacterComponentExecuted = false,
        PostPhysicsArenaClamp = false,
        ExternalInputExecuted = false,
    };
    await File.WriteAllTextAsync(resultPath, JsonSerializer.Serialize(failed, GateJson.Options));
    Console.Error.WriteLine(ex);
    return 1;
}

sealed class CharacterGateGame : Game
{
    private readonly string resultPath;
    private readonly float arenaWidth;
    private readonly float arenaDepth;
    private readonly float walkSpeed;
    private readonly float playerRadius;
    private readonly float playerCylinderLength;
    private readonly float wallThickness;
    private readonly int drivenSteps;
    private readonly int releasedSteps;

    public CharacterGateGame(
        string resultPath,
        float arenaWidth,
        float arenaDepth,
        float walkSpeed,
        float playerRadius,
        float playerCylinderLength,
        float wallThickness,
        int drivenSteps,
        int releasedSteps)
    {
        this.resultPath = resultPath;
        this.arenaWidth = arenaWidth;
        this.arenaDepth = arenaDepth;
        this.walkSpeed = walkSpeed;
        this.playerRadius = playerRadius;
        this.playerCylinderLength = playerCylinderLength;
        this.wallThickness = wallThickness;
        this.drivenSteps = drivenSteps;
        this.releasedSteps = releasedSteps;
        AutoLoadDefaultSettings = false;
    }

    public int ExitCode { get; private set; } = 1;

    protected override async Task LoadContent()
    {
        await base.LoadContent();

        var root = SceneSystem.SceneInstance.RootScene;
        var character = new CharacterComponent
        {
            Speed = walkSpeed,
            Collider = new CompoundCollider
            {
                Colliders = { new CapsuleCollider { Radius = playerRadius, Length = playerCylinderLength } }
            }
        };
        var player = new Entity { character };
        player.Transform.Position = new Vector3(0f, playerRadius + playerCylinderLength * 0.5f, 10f);

        AddStaticBox(root, new Vector3(arenaWidth, 0.2f, arenaDepth), new Vector3(0f, -0.1f, 0f));
        AddStaticBox(root, new Vector3(wallThickness, 4f, arenaDepth), new Vector3(arenaWidth * 0.5f + wallThickness * 0.5f, 2f, 0f));
        AddStaticBox(root, new Vector3(wallThickness, 4f, arenaDepth), new Vector3(-arenaWidth * 0.5f - wallThickness * 0.5f, 2f, 0f));
        AddStaticBox(root, new Vector3(arenaWidth, 4f, wallThickness), new Vector3(0f, 2f, arenaDepth * 0.5f + wallThickness * 0.5f));
        AddStaticBox(root, new Vector3(arenaWidth, 4f, wallThickness), new Vector3(0f, 2f, -arenaDepth * 0.5f - wallThickness * 0.5f));
        root.Entities.Add(player);

        BepuSimulation? simulation = null;
        for (var i = 0; i < 120 && simulation is null; i++)
        {
            simulation = character.Simulation;
            if (simulation is null)
                await Script.NextFrame();
        }

        if (simulation is null)
            throw new InvalidOperationException("Stride Bepu CharacterComponent never attached to a BepuSimulation.");

        var start = character.Position;
        var maxX = start.X;
        var nativeContacts = 0;
        for (var i = 0; i < drivenSteps; i++)
        {
            character.Move(Vector3.UnitX);
            await simulation.AfterUpdate();
            maxX = MathF.Max(maxX, character.Position.X);
            nativeContacts = Math.Max(nativeContacts, character.Contacts.Count);
        }

        character.Move(Vector3.Zero);
        var releaseStartX = character.Position.X;
        for (var i = 0; i < releasedSteps; i++)
            await simulation.AfterUpdate();

        var finalPosition = character.Position;
        var releaseDrift = MathF.Abs(finalPosition.X - releaseStartX);
        var expectedCeiling = arenaWidth * 0.5f - playerRadius;
        var wallError = MathF.Abs(finalPosition.X - expectedCeiling);

        var observation = new Observation(finalPosition.X, finalPosition.Y, finalPosition.Z, character.IsGrounded, character.Contacts.Count);
        var mutatedCopy = observation with { X = -9999f };
        var observationCopyIsolated = MathF.Abs(character.Position.X - mutatedCopy.X) > 100f;

        var passed =
            maxX <= expectedCeiling + 0.08f &&
            finalPosition.X >= expectedCeiling - 0.12f &&
            releaseDrift <= 0.02f &&
            nativeContacts > 0 &&
            observationCopyIsolated;

        var result = new GateResult
        {
            Passed = passed,
            Engine = "Stride",
            EngineVersion = typeof(Game).Assembly.GetName().Version?.ToString(),
            PhysicsAssemblyVersion = typeof(CharacterComponent).Assembly.GetName().Version?.ToString(),
            CharacterType = typeof(CharacterComponent).FullName,
            ArenaWidth = arenaWidth,
            ArenaDepth = arenaDepth,
            WalkSpeed = walkSpeed,
            SpawnX = start.X,
            SpawnY = start.Y,
            SpawnZ = start.Z,
            ExpectedEastWallCenterCeiling = expectedCeiling,
            MaximumObservedX = maxX,
            FinalX = finalPosition.X,
            FinalY = finalPosition.Y,
            FinalZ = finalPosition.Z,
            WallStopError = wallError,
            ReleaseDrift = releaseDrift,
            NativeContactCountObserved = nativeContacts,
            GroundedAtEnd = character.IsGrounded,
            StrideCharacterComponentExecuted = true,
            PostPhysicsArenaClamp = false,
            ExternalInputExecuted = false,
            ObservationCopyIsolated = observationCopyIsolated,
            DrivenPhysicsSteps = drivenSteps,
            ReleasedPhysicsSteps = releasedSteps,
        };

        await File.WriteAllTextAsync(resultPath, JsonSerializer.Serialize(result, GateJson.Options));
        Console.WriteLine(JsonSerializer.Serialize(result, GateJson.Options));
        ExitCode = passed ? 0 : 2;
        Exit();
    }

    private static void AddStaticBox(Scene root, Vector3 size, Vector3 position)
    {
        var component = new StaticComponent
        {
            Collider = new CompoundCollider
            {
                Colliders = { new BoxCollider { Size = size } }
            }
        };
        var entity = new Entity { component };
        entity.Transform.Position = position;
        root.Entities.Add(entity);
    }
}

sealed record Observation(float X, float Y, float Z, bool IsGrounded, int ContactCount);

sealed class GateResult
{
    public bool Passed { get; init; }
    public string? Error { get; init; }
    public string? Engine { get; init; }
    public string? EngineVersion { get; init; }
    public string? PhysicsAssemblyVersion { get; init; }
    public string? CharacterType { get; init; }
    public float ArenaWidth { get; init; }
    public float ArenaDepth { get; init; }
    public float WalkSpeed { get; init; }
    public float SpawnX { get; init; }
    public float SpawnY { get; init; }
    public float SpawnZ { get; init; }
    public float ExpectedEastWallCenterCeiling { get; init; }
    public float MaximumObservedX { get; init; }
    public float FinalX { get; init; }
    public float FinalY { get; init; }
    public float FinalZ { get; init; }
    public float WallStopError { get; init; }
    public float ReleaseDrift { get; init; }
    public int NativeContactCountObserved { get; init; }
    public bool GroundedAtEnd { get; init; }
    public bool StrideCharacterComponentExecuted { get; init; }
    public bool PostPhysicsArenaClamp { get; init; }
    public bool ExternalInputExecuted { get; init; }
    public bool ObservationCopyIsolated { get; init; }
    public int DrivenPhysicsSteps { get; init; }
    public int ReleasedPhysicsSteps { get; init; }
}

static class GateJson
{
    public static JsonSerializerOptions Options { get; } = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
    };
}
