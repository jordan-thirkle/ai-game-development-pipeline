using System.Numerics;
using System.Runtime.CompilerServices;
using System.Text.Json;
using BepuPhysics;
using BepuPhysics.Collidables;
using BepuPhysics.CollisionDetection;
using BepuPhysics.Constraints;
using BepuUtilities;
using BepuUtilities.Memory;
using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using Microsoft.Xna.Framework.Input;
using NumericsVector3 = System.Numerics.Vector3;
using XnaColor = Microsoft.Xna.Framework.Color;

const string defaultResultPath = "artifacts/runtime-gate/result.json";
var resultPath = args.Length > 0 ? args[0] : defaultResultPath;
using var game = new BenchmarkGame(resultPath);
game.Run();

sealed class BenchmarkGame : Game
{
    const float ArenaWidth = 24f;
    const float ArenaDepth = 32f;
    const float PlayerRadius = 0.4f;
    const float WalkSpeed = 3.5f;
    const float FixedDt = 1f / 60f;
    const float ExpectedEastWallCenter = ArenaWidth / 2f - PlayerRadius;
    const int ReleaseFramesRequired = 60;
    const int MaximumFrames = 1200;

    readonly GraphicsDeviceManager graphics;
    readonly string resultPath;
    readonly BufferPool bufferPool = new();
    readonly ThreadDispatcher threadDispatcher = new(Math.Max(1, Environment.ProcessorCount));
    readonly Simulation simulation;
    readonly BodyHandle playerHandle;

    bool priorD;
    bool sawPress;
    bool sawRelease;
    bool observationIsolationPassed;
    int pressCount;
    int releaseCount;
    int frames;
    int releaseFrames;
    float maximumX;
    float releaseStartX;
    float releaseDrift;
    bool resultWritten;

    public BenchmarkGame(string resultPath)
    {
        this.resultPath = resultPath;
        graphics = new GraphicsDeviceManager(this)
        {
            PreferredBackBufferWidth = 960,
            PreferredBackBufferHeight = 540,
            SynchronizeWithVerticalRetrace = true
        };
        IsFixedTimeStep = true;
        TargetElapsedTime = TimeSpan.FromSeconds(FixedDt);
        IsMouseVisible = true;
        Window.Title = "BYJTT MonoGame BEPU Gate";

        simulation = Simulation.Create(
            bufferPool,
            new NarrowPhaseCallbacks(),
            new PoseIntegratorCallbacks(new NumericsVector3(0, -9.81f, 0)),
            new SolveDescription(8, 1));

        var playerShape = new Sphere(PlayerRadius);
        var playerInertia = playerShape.ComputeInertia(1f);
        playerHandle = simulation.Bodies.Add(BodyDescription.CreateDynamic(
            new NumericsVector3(0, PlayerRadius, 10),
            playerInertia,
            simulation.Shapes.Add(playerShape),
            0.01f));

        var floorShape = simulation.Shapes.Add(new Box(ArenaWidth, 0.2f, ArenaDepth));
        simulation.Statics.Add(new StaticDescription(new NumericsVector3(0, -0.1f, 0), floorShape));

        var eastWestShape = simulation.Shapes.Add(new Box(0.4f, 2.4f, ArenaDepth + 0.8f));
        simulation.Statics.Add(new StaticDescription(new NumericsVector3(12.2f, 1.2f, 0), eastWestShape));
        simulation.Statics.Add(new StaticDescription(new NumericsVector3(-12.2f, 1.2f, 0), eastWestShape));

        var northSouthShape = simulation.Shapes.Add(new Box(ArenaWidth + 0.8f, 2.4f, 0.4f));
        simulation.Statics.Add(new StaticDescription(new NumericsVector3(0, 1.2f, 16.2f), northSouthShape));
        simulation.Statics.Add(new StaticDescription(new NumericsVector3(0, 1.2f, -16.2f), northSouthShape));
    }

    protected override void Initialize()
    {
        base.Initialize();
        var probe = Snapshot();
        probe.X = -999f;
        var authoritative = Snapshot();
        observationIsolationPassed = MathF.Abs(authoritative.X) < 0.001f;
    }

    protected override void Update(GameTime gameTime)
    {
        frames++;
        var dDown = Keyboard.GetState().IsKeyDown(Keys.D);
        if (dDown && !priorD)
        {
            pressCount++;
            sawPress = true;
            releaseFrames = 0;
        }
        else if (!dDown && priorD)
        {
            releaseCount++;
            sawRelease = true;
            releaseStartX = Snapshot().X;
            releaseFrames = 0;
        }
        priorD = dDown;

        ref var body = ref simulation.Bodies.GetBodyReference(playerHandle);
        var desiredX = dDown ? WalkSpeed : 0f;
        var deltaX = desiredX - body.Velocity.Linear.X;
        body.ApplyLinearImpulse(new NumericsVector3(deltaX, 0, 0));

        simulation.Timestep(FixedDt, threadDispatcher);

        var current = Snapshot();
        maximumX = MathF.Max(maximumX, current.X);
        if (sawRelease && !dDown)
        {
            releaseFrames++;
            releaseDrift = MathF.Max(releaseDrift, MathF.Abs(current.X - releaseStartX));
        }

        if (sawPress && sawRelease && releaseFrames >= ReleaseFramesRequired)
        {
            WriteResultAndExit(timedOut: false);
            return;
        }
        if (frames >= MaximumFrames)
        {
            WriteResultAndExit(timedOut: true);
            return;
        }

        base.Update(gameTime);
    }

    protected override void Draw(GameTime gameTime)
    {
        GraphicsDevice.Clear(new XnaColor(24, 30, 39));
        base.Draw(gameTime);
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            if (!resultWritten)
                WriteResult(timedOut: true);
            simulation.Dispose();
            threadDispatcher.Dispose();
            bufferPool.Clear();
            graphics.Dispose();
        }
        base.Dispose(disposing);
    }

    Observation Snapshot()
    {
        ref var body = ref simulation.Bodies.GetBodyReference(playerHandle);
        var p = body.Pose.Position;
        return new Observation
        {
            X = p.X,
            GroundY = p.Y - PlayerRadius,
            Z = p.Z,
            VelocityX = body.Velocity.Linear.X
        };
    }

    void WriteResultAndExit(bool timedOut)
    {
        WriteResult(timedOut);
        Exit();
    }

    void WriteResult(bool timedOut)
    {
        if (resultWritten) return;
        resultWritten = true;
        var final = Snapshot();
        var wallStop = sawPress
            && sawRelease
            && maximumX >= ExpectedEastWallCenter - 0.15f
            && maximumX <= ExpectedEastWallCenter + 0.08f
            && final.X >= ExpectedEastWallCenter - 0.15f
            && final.X <= ExpectedEastWallCenter + 0.08f
            && MathF.Abs(final.VelocityX) <= 0.05f
            && releaseDrift <= 0.03f;
        var passed = !timedOut
            && pressCount >= 1
            && releaseCount >= 1
            && wallStop
            && observationIsolationPassed;

        var result = new
        {
            passed,
            timed_out = timedOut,
            monogame_runtime_executed = true,
            bepu_simulation_executed = true,
            external_input_executed = sawPress && sawRelease,
            post_physics_arena_clamp = false,
            observation_copy_isolated = observationIsolationPassed,
            arena_width = ArenaWidth,
            arena_depth = ArenaDepth,
            logical_spawn = new[] { 0f, 0f, 10f },
            player_radius = PlayerRadius,
            walk_speed = WalkSpeed,
            fixed_step_seconds = FixedDt,
            expected_east_wall_center_ceiling = ExpectedEastWallCenter,
            maximum_observed_x = maximumX,
            final_x = final.X,
            final_ground_y = final.GroundY,
            final_z = final.Z,
            final_x_velocity = final.VelocityX,
            release_drift = releaseDrift,
            key_d_press_count = pressCount,
            key_d_release_count = releaseCount,
            rendered_frames = frames,
            native_wall_stop_observed = wallStop
        };

        var parent = Path.GetDirectoryName(resultPath);
        if (!string.IsNullOrEmpty(parent)) Directory.CreateDirectory(parent);
        File.WriteAllText(resultPath, JsonSerializer.Serialize(result, new JsonSerializerOptions { WriteIndented = true }));
        Console.WriteLine(JsonSerializer.Serialize(result));
    }

    sealed class Observation
    {
        public float X { get; set; }
        public float GroundY { get; set; }
        public float Z { get; set; }
        public float VelocityX { get; set; }
    }

    unsafe struct NarrowPhaseCallbacks : INarrowPhaseCallbacks
    {
        public void Initialize(Simulation simulation) { }

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public bool AllowContactGeneration(int workerIndex, CollidableReference a, CollidableReference b, ref float speculativeMargin)
            => a.Mobility == CollidableMobility.Dynamic || b.Mobility == CollidableMobility.Dynamic;

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public bool AllowContactGeneration(int workerIndex, CollidablePair pair, int childIndexA, int childIndexB) => true;

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public bool ConfigureContactManifold<TManifold>(int workerIndex, CollidablePair pair, ref TManifold manifold, out PairMaterialProperties pairMaterial)
            where TManifold : unmanaged, IContactManifold<TManifold>
        {
            pairMaterial.FrictionCoefficient = 1f;
            pairMaterial.MaximumRecoveryVelocity = 2f;
            pairMaterial.SpringSettings = new SpringSettings(30, 1);
            return true;
        }

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public bool ConfigureContactManifold(int workerIndex, CollidablePair pair, int childIndexA, int childIndexB, ref ConvexContactManifold manifold) => true;

        public void Dispose() { }
    }

    struct PoseIntegratorCallbacks : IPoseIntegratorCallbacks
    {
        public AngularIntegrationMode AngularIntegrationMode => AngularIntegrationMode.Nonconserving;
        public bool AllowSubstepsForUnconstrainedBodies => false;
        public bool IntegrateVelocityForKinematics => false;
        public NumericsVector3 Gravity;
        Vector3Wide gravityWideDt;

        public PoseIntegratorCallbacks(NumericsVector3 gravity) : this() => Gravity = gravity;
        public void Initialize(Simulation simulation) { }
        public void PrepareForIntegration(float dt) => gravityWideDt = Vector3Wide.Broadcast(Gravity * dt);
        public void IntegrateVelocity(Vector<int> bodyIndices, Vector3Wide position, QuaternionWide orientation, BodyInertiaWide localInertia, Vector<int> integrationMask, int workerIndex, Vector<float> dt, ref BodyVelocityWide velocity)
            => velocity.Linear += gravityWideDt;
    }
}
