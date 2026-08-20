using System;
using FlaxEngine;

public sealed class CharacterGatePlugin : GamePlugin
{
    private const float CentimetersPerMeter = 100.0f;
    private const float ArenaHalfWidthMeters = 12.0f;
    private const float ArenaHalfDepthMeters = 16.0f;
    private const float PlayerRadiusMeters = 0.4f;
    private const float PlayerHeightMeters = 1.0f;
    private const float WallThicknessMeters = 0.4f;
    private const float WallHeightMeters = 4.0f;
    private const float WalkSpeedMetersPerSecond = 3.5f;
    private const float FixedStepSeconds = 1.0f / 60.0f;
    private const int DrivenSteps = 300;
    private const int ReleasedSteps = 60;

    public override void Initialize()
    {
        base.Initialize();

        if (!string.Equals(Environment.GetEnvironmentVariable("BYJTT_FLAX_CHARACTER_GATE"), "1", StringComparison.Ordinal))
            return;

        try
        {
            RunGate();
        }
        catch (Exception ex)
        {
            Debug.LogError($"BYJTT_FLAX_CHARACTER_GATE_EXCEPTION type={ex.GetType().FullName} message={ex.Message}");
            throw;
        }
    }

    private static void RunGate()
    {
        var floor = SpawnBox(
            "BYJTT Floor",
            new Vector3(0.0f, -20.0f, 0.0f),
            new Vector3(2400.0f, 40.0f, 3200.0f));
        var eastWall = SpawnBox(
            "BYJTT East Wall",
            new Vector3((ArenaHalfWidthMeters + WallThicknessMeters / 2.0f) * CentimetersPerMeter, 200.0f, 0.0f),
            new Vector3(WallThicknessMeters * CentimetersPerMeter, WallHeightMeters * CentimetersPerMeter, 3200.0f));
        var westWall = SpawnBox(
            "BYJTT West Wall",
            new Vector3(-(ArenaHalfWidthMeters + WallThicknessMeters / 2.0f) * CentimetersPerMeter, 200.0f, 0.0f),
            new Vector3(WallThicknessMeters * CentimetersPerMeter, WallHeightMeters * CentimetersPerMeter, 3200.0f));
        var northWall = SpawnBox(
            "BYJTT North Wall",
            new Vector3(0.0f, 200.0f, (ArenaHalfDepthMeters + WallThicknessMeters / 2.0f) * CentimetersPerMeter),
            new Vector3(2400.0f, WallHeightMeters * CentimetersPerMeter, WallThicknessMeters * CentimetersPerMeter));
        var southWall = SpawnBox(
            "BYJTT South Wall",
            new Vector3(0.0f, 200.0f, -(ArenaHalfDepthMeters + WallThicknessMeters / 2.0f) * CentimetersPerMeter),
            new Vector3(2400.0f, WallHeightMeters * CentimetersPerMeter, WallThicknessMeters * CentimetersPerMeter));

        var player = new CharacterController
        {
            Name = "BYJTT Player",
            Position = new Vector3(0.0f, 0.0f, 10.0f * CentimetersPerMeter),
            Radius = PlayerRadiusMeters * CentimetersPerMeter,
            Height = PlayerHeightMeters * CentimetersPerMeter,
            OriginMode = CharacterController.OriginModes.Base,
            AutoGravity = false,
            StaticFlags = StaticFlags.None,
        };
        Level.SpawnActor(player);

        float maxX = player.Position.X;
        var sideCollisionCount = 0;
        var displacement = new Vector3(WalkSpeedMetersPerSecond * CentimetersPerMeter * FixedStepSeconds, 0.0f, 0.0f);

        for (var step = 0; step < DrivenSteps; step++)
        {
            var flags = player.Move(displacement);
            if ((flags & CharacterController.CollisionFlags.Sides) != 0)
                sideCollisionCount++;
            maxX = Math.Max(maxX, player.Position.X);
        }

        var releaseStartX = player.Position.X;
        for (var step = 0; step < ReleasedSteps; step++)
            player.Move(Vector3.Zero);

        var finalX = player.Position.X;
        var expectedStopX = (ArenaHalfWidthMeters - PlayerRadiusMeters) * CentimetersPerMeter;
        var releaseDrift = Math.Abs(finalX - releaseStartX);
        var stopError = Math.Abs(finalX - expectedStopX);
        var nativeWallStop = sideCollisionCount > 0 && maxX <= expectedStopX + 2.0f && stopError <= 2.0f;
        var releaseStable = releaseDrift <= 0.01f;

        var observedFinalX = finalX;
        observedFinalX += 99999.0f;
        var observationIsolation = Math.Abs(player.Position.X - finalX) <= 0.001f;
        var passed = nativeWallStop && releaseStable && observationIsolation;

        Debug.Log(
            "BYJTT_FLAX_CHARACTER_GATE_RESULT " +
            $"passed={passed.ToString().ToLowerInvariant()} " +
            "flax_character_controller_executed=true " +
            "post_physics_arena_clamp=false " +
            "external_input_executed=false " +
            $"driven_steps={DrivenSteps} released_steps={ReleasedSteps} " +
            $"expected_stop_x_cm={expectedStopX:F6} max_x_cm={maxX:F6} final_x_cm={finalX:F6} " +
            $"stop_error_cm={stopError:F6} release_drift_cm={releaseDrift:F6} side_collision_count={sideCollisionCount} " +
            $"observation_isolation={observationIsolation.ToString().ToLowerInvariant()}");

        DestroyActor(player);
        DestroyActor(floor);
        DestroyActor(eastWall);
        DestroyActor(westWall);
        DestroyActor(northWall);
        DestroyActor(southWall);

        if (!passed)
            throw new InvalidOperationException("Flax native CharacterController gate did not satisfy its collision contract.");
    }

    private static BoxCollider SpawnBox(string name, Vector3 position, Vector3 size)
    {
        var collider = new BoxCollider
        {
            Name = name,
            Position = position,
            Size = size,
            StaticFlags = StaticFlags.None,
        };
        Level.SpawnActor(collider);
        return collider;
    }

    private static void DestroyActor(Actor actor)
    {
        if (actor != null)
            actor.DeleteObject();
    }
}
