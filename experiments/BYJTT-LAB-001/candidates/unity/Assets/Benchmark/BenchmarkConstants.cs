using UnityEngine;

namespace ByJtt.Benchmark.Unity
{
    public static class BenchmarkConstants
    {
        public const float ArenaWidth = 24f;
        public const float ArenaDepth = 32f;
        public static readonly Vector3 PlayerSpawn = new(0f, 0f, 10f);

        public const float WalkSpeed = 3.5f;
        public const float RunSpeed = 5.5f;
        public const float Acceleration = 18f;
        public const float Deceleration = 22f;
        public const float TurnResponseSeconds = 0.12f;

        public const int ReferenceWidth = 390;
        public const int ReferenceHeight = 844;
        public const int TargetFps = 60;
    }
}
