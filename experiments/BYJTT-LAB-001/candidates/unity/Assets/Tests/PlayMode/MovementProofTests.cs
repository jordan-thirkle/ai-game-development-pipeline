using System.Collections;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.LowLevel;
using UnityEngine.TestTools;

namespace ByJtt.Benchmark.Unity.Tests
{
    public sealed class MovementProofTests
    {
        private Keyboard _keyboard;

        [UnitySetUp]
        public IEnumerator SetUp()
        {
            _keyboard = InputSystem.AddDevice<Keyboard>();
            BenchmarkRuntime.Create();
            yield return null;
        }

        [UnityTearDown]
        public IEnumerator TearDown()
        {
            if (_keyboard != null && _keyboard.added)
            {
                InputSystem.RemoveDevice(_keyboard);
            }

            if (BenchmarkRuntime.Instance != null)
            {
                Object.Destroy(BenchmarkRuntime.Instance.gameObject);
            }

            yield return null;
        }

        [UnityTest]
        public IEnumerator ForwardKeyboardInputMovesMoreThanOneMetreAndStaysInArena()
        {
            var runtime = BenchmarkRuntime.Instance;
            Assert.That(runtime, Is.Not.Null);
            var before = runtime.CaptureObservation();

            Press(Key.W);
            yield return WaitForSecondsByFrames(1.0f);
            ReleaseAll();
            yield return null;

            var after = runtime.CaptureObservation();
            var displacement = Vector3.Distance(before.PlayerPosition, after.PlayerPosition);

            Assert.That(displacement, Is.GreaterThan(1.0f));
            Assert.That(after.PlayerPosition.x, Is.InRange(-BenchmarkConstants.ArenaWidth * 0.5f, BenchmarkConstants.ArenaWidth * 0.5f));
            Assert.That(after.PlayerPosition.z, Is.InRange(-BenchmarkConstants.ArenaDepth * 0.5f, BenchmarkConstants.ArenaDepth * 0.5f));
            Assert.That(after.PlayerPosition.z, Is.LessThan(before.PlayerPosition.z));
        }

        [UnityTest]
        public IEnumerator NativeCharacterControllerStopsAtEastArenaWall()
        {
            var runtime = BenchmarkRuntime.Instance;
            Assert.That(runtime, Is.Not.Null);

            Press(Key.D);
            yield return WaitForSecondsByFrames(4.0f);
            var atWall = runtime.CaptureObservation();
            ReleaseAll();
            yield return null;

            Assert.That(atWall.PlayerPosition.x, Is.GreaterThan(10.5f));
            Assert.That(atWall.PlayerPosition.x, Is.LessThanOrEqualTo(BenchmarkConstants.ArenaWidth * 0.5f));
            Assert.That((atWall.CollisionFlags & CollisionFlags.Sides) != 0, Is.True,
                "Expected CharacterController.Move to report a native side collision at the arena wall.");
        }

        [UnityTest]
        public IEnumerator ObservationIsACopyAndCannotMutateRuntimeState()
        {
            var runtime = BenchmarkRuntime.Instance;
            Assert.That(runtime, Is.Not.Null);

            var snapshot = runtime.CaptureObservation();
            var detachedPosition = snapshot.PlayerPosition;
            detachedPosition.x = 999f;
            yield return null;

            var fresh = runtime.CaptureObservation();
            Assert.That(fresh.PlayerPosition.x, Is.Not.EqualTo(detachedPosition.x));
            Assert.That(fresh.RuntimeReady, Is.True);
            Assert.That(fresh.GameplayActive, Is.True);
        }

        private void Press(Key key)
        {
            InputSystem.QueueStateEvent(_keyboard, new KeyboardState(key));
            InputSystem.Update();
        }

        private void ReleaseAll()
        {
            InputSystem.QueueStateEvent(_keyboard, new KeyboardState());
            InputSystem.Update();
        }

        private static IEnumerator WaitForSecondsByFrames(float seconds)
        {
            var deadline = Time.realtimeSinceStartup + seconds;
            while (Time.realtimeSinceStartup < deadline)
            {
                yield return null;
            }
        }
    }
}
