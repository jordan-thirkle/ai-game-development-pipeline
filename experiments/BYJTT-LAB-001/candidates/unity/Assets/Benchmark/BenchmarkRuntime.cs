using UnityEngine;

namespace ByJtt.Benchmark.Unity
{
    public readonly struct BenchmarkObservation
    {
        public BenchmarkObservation(bool runtimeReady, bool gameplayActive, Vector3 playerPosition, CollisionFlags collisionFlags)
        {
            RuntimeReady = runtimeReady;
            GameplayActive = gameplayActive;
            PlayerPosition = playerPosition;
            CollisionFlags = collisionFlags;
        }

        public bool RuntimeReady { get; }
        public bool GameplayActive { get; }
        public Vector3 PlayerPosition { get; }
        public CollisionFlags CollisionFlags { get; }
    }

    public sealed class BenchmarkRuntime : MonoBehaviour
    {
        public static BenchmarkRuntime? Instance { get; private set; }

        private PlayerMotor _playerMotor = null!;

        public static BenchmarkRuntime Create()
        {
            if (Instance != null)
            {
                return Instance;
            }

            Application.targetFrameRate = BenchmarkConstants.TargetFps;
            var root = new GameObject("BYJTT-LAB-001 Unity Runtime");
            return root.AddComponent<BenchmarkRuntime>();
        }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void AutoCreate()
        {
            Create();
        }

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }

            Instance = this;
            BuildArena();
            BuildPlayer();
            BuildCamera();
        }

        private void OnDestroy()
        {
            if (Instance == this)
            {
                Instance = null;
            }
        }

        public BenchmarkObservation CaptureObservation()
        {
            return new BenchmarkObservation(
                runtimeReady: _playerMotor != null,
                gameplayActive: isActiveAndEnabled,
                playerPosition: _playerMotor != null ? _playerMotor.transform.position : Vector3.zero,
                collisionFlags: _playerMotor != null ? _playerMotor.LastCollisionFlags : CollisionFlags.None);
        }

        private void BuildPlayer()
        {
            var player = GameObject.CreatePrimitive(PrimitiveType.Capsule);
            player.name = "Player";
            player.transform.SetParent(transform, false);
            player.transform.position = BenchmarkConstants.PlayerSpawn;

            var primitiveCollider = player.GetComponent<CapsuleCollider>();
            Destroy(primitiveCollider);

            var controller = player.AddComponent<CharacterController>();
            controller.center = new Vector3(0f, 1f, 0f);
            controller.height = 2f;
            controller.radius = 0.5f;
            controller.skinWidth = 0.08f;
            controller.minMoveDistance = 0f;

            _playerMotor = player.AddComponent<PlayerMotor>();
        }

        private void BuildArena()
        {
            CreateBox("Floor", new Vector3(0f, -0.05f, 0f), new Vector3(BenchmarkConstants.ArenaWidth, 0.1f, BenchmarkConstants.ArenaDepth));

            var halfWidth = BenchmarkConstants.ArenaWidth * 0.5f;
            var halfDepth = BenchmarkConstants.ArenaDepth * 0.5f;
            const float wallThickness = 0.2f;
            var wallHeight = 3f;

            CreateBox("Wall East", new Vector3(halfWidth + wallThickness * 0.5f, wallHeight * 0.5f, 0f), new Vector3(wallThickness, wallHeight, BenchmarkConstants.ArenaDepth));
            CreateBox("Wall West", new Vector3(-halfWidth - wallThickness * 0.5f, wallHeight * 0.5f, 0f), new Vector3(wallThickness, wallHeight, BenchmarkConstants.ArenaDepth));
            CreateBox("Wall North", new Vector3(0f, wallHeight * 0.5f, halfDepth + wallThickness * 0.5f), new Vector3(BenchmarkConstants.ArenaWidth, wallHeight, wallThickness));
            CreateBox("Wall South", new Vector3(0f, wallHeight * 0.5f, -halfDepth - wallThickness * 0.5f), new Vector3(BenchmarkConstants.ArenaWidth, wallHeight, wallThickness));
        }

        private void BuildCamera()
        {
            var cameraObject = new GameObject("Camera");
            cameraObject.transform.SetParent(transform, false);
            cameraObject.transform.position = new Vector3(0f, 11f, 17f);
            cameraObject.transform.rotation = Quaternion.Euler(35f, 180f, 0f);
            var camera = cameraObject.AddComponent<Camera>();
            camera.fieldOfView = 60f;
        }

        private void CreateBox(string name, Vector3 position, Vector3 scale)
        {
            var box = GameObject.CreatePrimitive(PrimitiveType.Cube);
            box.name = name;
            box.transform.SetParent(transform, false);
            box.transform.position = position;
            box.transform.localScale = scale;
        }
    }
}
