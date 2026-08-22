using UnityEngine;
using UnityEngine.InputSystem;

namespace ByJtt.Benchmark.Unity
{
    [RequireComponent(typeof(CharacterController))]
    public sealed class PlayerMotor : MonoBehaviour
    {
        private CharacterController _controller = null!;
        private Vector2 _planarVelocity;

        public CollisionFlags LastCollisionFlags { get; private set; }

        private void Awake()
        {
            _controller = GetComponent<CharacterController>();
        }

        private void Update()
        {
            var keyboard = Keyboard.current;
            var input = Vector2.zero;
            var running = false;

            if (keyboard != null)
            {
                if (keyboard.aKey.isPressed) input.x -= 1f;
                if (keyboard.dKey.isPressed) input.x += 1f;
                if (keyboard.wKey.isPressed) input.y += 1f;
                if (keyboard.sKey.isPressed) input.y -= 1f;
                running = keyboard.leftShiftKey.isPressed || keyboard.rightShiftKey.isPressed;
            }

            input = Vector2.ClampMagnitude(input, 1f);
            var targetSpeed = running ? BenchmarkConstants.RunSpeed : BenchmarkConstants.WalkSpeed;
            var desiredVelocity = input * targetSpeed;
            var rate = input.sqrMagnitude > 0f ? BenchmarkConstants.Acceleration : BenchmarkConstants.Deceleration;
            _planarVelocity = Vector2.MoveTowards(_planarVelocity, desiredVelocity, rate * Time.deltaTime);

            // Shared contract forward points from the player spawn toward the encounter (-Z).
            var motion = new Vector3(_planarVelocity.x, 0f, -_planarVelocity.y) * Time.deltaTime;
            LastCollisionFlags = _controller.Move(motion);
        }
    }
}
