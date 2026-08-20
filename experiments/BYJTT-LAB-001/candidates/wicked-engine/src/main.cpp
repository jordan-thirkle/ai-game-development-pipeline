#include "wiECS.h"
#include "wiJobSystem.h"
#include "wiPhysics.h"
#include "wiScene.h"

#include <algorithm>
#include <cmath>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <string>
#include <vector>

namespace {
constexpr float kArenaWidth = 24.0f;
constexpr float kArenaDepth = 32.0f;
constexpr float kWalkSpeed = 3.5f;
constexpr float kFixedDt = 1.0f / 60.0f;
constexpr int kDrivenSteps = 300;
constexpr int kReleasedSteps = 60;
constexpr float kPlayerRadius = 0.4f;
constexpr float kPlayerCylinderHalfHeight = 0.5f;
constexpr float kExpectedEastCeiling = kArenaWidth * 0.5f - kPlayerRadius;
constexpr float kCharacterMass = 80.0f;
constexpr float kCharacterFriction = 0.2f;

struct Observation {
  float x;
  float y;
  float z;
};

struct TelemetrySample {
  const char* phase;
  int step;
  Observation position;
  XMFLOAT3 velocity;
  int ground_state;
  bool supported;
};

wi::ecs::Entity AddStaticBox(
    wi::scene::Scene& scene,
    const XMFLOAT3& position,
    const XMFLOAT3& half_extents) {
  const wi::ecs::Entity entity = wi::ecs::CreateEntity();
  auto& transform = scene.transforms.Create(entity);
  transform.Translate(position);
  transform.UpdateTransform();

  auto& body = scene.rigidbodies.Create(entity);
  body.shape = wi::scene::RigidBodyPhysicsComponent::BOX;
  body.mass = 0.0f;
  body.friction = 0.5f;
  body.restitution = 0.0f;
  body.box.halfextents = half_extents;
  return entity;
}

void Step(wi::scene::Scene& scene, float dt) {
  wi::jobsystem::context ctx;
  wi::physics::RunPhysicsUpdateSystem(ctx, scene, dt);
  wi::jobsystem::Wait(ctx);
}

Observation Observe(wi::scene::RigidBodyPhysicsComponent& player) {
  const XMFLOAT3 p = wi::physics::GetPosition(player);
  return Observation{p.x, p.y, p.z};
}

TelemetrySample Capture(
    wi::scene::RigidBodyPhysicsComponent& player,
    const char* phase,
    int step) {
  return TelemetrySample{
      phase,
      step,
      Observe(player),
      wi::physics::GetVelocity(player),
      static_cast<int>(wi::physics::GetCharacterGroundState(player)),
      wi::physics::IsCharacterGroundSupported(player)};
}
}  // namespace

int main(int argc, char** argv) {
  const std::string output_path = argc > 1 ? argv[1] : "result.json";

  wi::jobsystem::Initialize();
  wi::physics::Initialize();
  wi::physics::SetFrameRate(60.0f);
  wi::physics::SetAccuracy(1);
  wi::physics::SetInterpolationEnabled(false);

  wi::scene::Scene scene;

  // Ground and four arena walls. The inside faces remain exactly at +/-12 m X
  // and +/-16 m Z, preserving the shared 24 x 32 m contract.
  AddStaticBox(scene, XMFLOAT3(0.0f, -0.5f, 0.0f), XMFLOAT3(12.0f, 0.5f, 16.0f));
  AddStaticBox(scene, XMFLOAT3(12.25f, 1.5f, 0.0f), XMFLOAT3(0.25f, 1.5f, 16.0f));
  AddStaticBox(scene, XMFLOAT3(-12.25f, 1.5f, 0.0f), XMFLOAT3(0.25f, 1.5f, 16.0f));
  AddStaticBox(scene, XMFLOAT3(0.0f, 1.5f, 16.25f), XMFLOAT3(12.0f, 1.5f, 0.25f));
  AddStaticBox(scene, XMFLOAT3(0.0f, 1.5f, -16.25f), XMFLOAT3(12.0f, 1.5f, 0.25f));

  const wi::ecs::Entity player_entity = wi::ecs::CreateEntity();
  auto& player_transform = scene.transforms.Create(player_entity);
  player_transform.Translate(XMFLOAT3(0.0f, 0.0f, 10.0f));
  player_transform.UpdateTransform();

  auto& player = scene.rigidbodies.Create(player_entity);
  player.shape = wi::scene::RigidBodyPhysicsComponent::CAPSULE;
  // Match Jolt CharacterSettings' production defaults rather than creating a
  // 1 kg frictionless character that is atypical for the solved controller.
  player.mass = kCharacterMass;
  player.friction = kCharacterFriction;
  player.restitution = 0.0f;
  player.capsule.radius = kPlayerRadius;
  player.capsule.height = kPlayerCylinderHalfHeight;
  player.SetCharacterPhysics(true);
  player.SetDisableDeactivation(true);

  // First engine step materializes the native Jolt bodies. No test teleport or
  // post-physics clamp is used at any point.
  Step(scene, kFixedDt);

  const Observation start = Observe(player);
  float max_x = start.x;
  std::vector<TelemetrySample> telemetry;
  telemetry.reserve(32);
  telemetry.push_back(Capture(player, "start", 0));

  for (int i = 0; i < kDrivenSteps; ++i) {
    wi::physics::MoveCharacter(
        player,
        XMFLOAT3(1.0f, 0.0f, 0.0f),
        kWalkSpeed,
        0.0f,
        true);
    Step(scene, kFixedDt);
    const Observation observation = Observe(player);
    max_x = std::max(max_x, observation.x);
    if ((i + 1) % 15 == 0 || (observation.x >= 11.0f && telemetry.back().position.x < 11.0f)) {
      telemetry.push_back(Capture(player, "driven", i + 1));
    }
  }

  const Observation driven = Observe(player);
  telemetry.push_back(Capture(player, "driven-final", kDrivenSteps));
  for (int i = 0; i < kReleasedSteps; ++i) {
    wi::physics::MoveCharacter(
        player,
        XMFLOAT3(0.0f, 0.0f, 0.0f),
        0.0f,
        0.0f,
        true);
    Step(scene, kFixedDt);
    max_x = std::max(max_x, Observe(player).x);
    if ((i + 1) % 10 == 0) {
      telemetry.push_back(Capture(player, "released", i + 1));
    }
  }
  const Observation final_observation = Observe(player);
  const XMFLOAT3 final_velocity = wi::physics::GetVelocity(player);
  telemetry.push_back(Capture(player, "final", kReleasedSteps));

  // Mutation-isolation probe: mutate only a copied observation, then re-read
  // engine-owned state. This is intentionally incapable of controlling play.
  Observation copy = final_observation;
  copy.x = -9999.0f;
  copy.y = -9999.0f;
  copy.z = -9999.0f;
  const bool copy_was_mutated =
      copy.x == -9999.0f && copy.y == -9999.0f && copy.z == -9999.0f;
  const Observation after_copy_mutation = Observe(player);
  const bool observation_isolated =
      copy_was_mutated &&
      std::abs(after_copy_mutation.x - final_observation.x) < 0.0001f &&
      std::abs(after_copy_mutation.y - final_observation.y) < 0.0001f &&
      std::abs(after_copy_mutation.z - final_observation.z) < 0.0001f;

  const float release_drift = std::abs(final_observation.x - driven.x);
  const bool reached_east_wall = max_x > 11.0f;
  const bool non_penetrating = max_x <= kExpectedEastCeiling + 0.06f;
  const bool stopped = std::abs(final_velocity.x) < 0.02f && release_drift < 0.02f;
  const bool native_wall_stop = reached_east_wall && non_penetrating && stopped;
  const bool pass = native_wall_stop && observation_isolated;

  std::ofstream out(output_path);
  out << std::fixed << std::setprecision(9);
  out << "{\n";
  out << "  \"candidate\": \"wicked-engine-0.72.106\",\n";
  out << "  \"backend\": \"engine-integrated-jolt\",\n";
  out << "  \"world_up\": \"+Y\",\n";
  out << "  \"arena_width_m\": " << kArenaWidth << ",\n";
  out << "  \"arena_depth_m\": " << kArenaDepth << ",\n";
  out << "  \"walk_speed_mps\": " << kWalkSpeed << ",\n";
  out << "  \"character_mass_kg\": " << kCharacterMass << ",\n";
  out << "  \"character_friction\": " << kCharacterFriction << ",\n";
  out << "  \"fixed_dt_s\": " << kFixedDt << ",\n";
  out << "  \"driven_steps\": " << kDrivenSteps << ",\n";
  out << "  \"released_steps\": " << kReleasedSteps << ",\n";
  out << "  \"spawn\": [" << start.x << ", " << start.y << ", " << start.z << "],\n";
  out << "  \"expected_east_ceiling_x_m\": " << kExpectedEastCeiling << ",\n";
  out << "  \"max_x_m\": " << max_x << ",\n";
  out << "  \"driven_final_x_m\": " << driven.x << ",\n";
  out << "  \"final_x_m\": " << final_observation.x << ",\n";
  out << "  \"final_velocity_x_mps\": " << final_velocity.x << ",\n";
  out << "  \"release_drift_m\": " << release_drift << ",\n";
  out << "  \"native_wall_stop_observed\": " << (native_wall_stop ? "true" : "false") << ",\n";
  out << "  \"observation_copy_isolated\": " << (observation_isolated ? "true" : "false") << ",\n";
  out << "  \"post_physics_arena_clamp\": false,\n";
  out << "  \"external_input_executed\": false,\n";
  out << "  \"telemetry\": [\n";
  for (size_t i = 0; i < telemetry.size(); ++i) {
    const TelemetrySample& sample = telemetry[i];
    out << "    {\"phase\": \"" << sample.phase << "\", \"step\": " << sample.step
        << ", \"position\": [" << sample.position.x << ", " << sample.position.y << ", "
        << sample.position.z << "], \"velocity\": [" << sample.velocity.x << ", "
        << sample.velocity.y << ", " << sample.velocity.z << "], \"ground_state\": "
        << sample.ground_state << ", \"supported\": " << (sample.supported ? "true" : "false")
        << "}" << (i + 1 == telemetry.size() ? "\n" : ",\n");
  }
  out << "  ],\n";
  out << "  \"pass\": " << (pass ? "true" : "false") << "\n";
  out << "}\n";
  out.close();

  std::cout << "BYJTT Wicked Engine native-character gate: " << (pass ? "PASS" : "FAIL") << '\n';
  std::cout << "start=(" << start.x << ',' << start.y << ',' << start.z << ") max_x=" << max_x
            << " driven_x=" << driven.x << " final=(" << final_observation.x << ','
            << final_observation.y << ',' << final_observation.z << ") vx=" << final_velocity.x
            << " release_drift=" << release_drift << '\n';

  wi::jobsystem::ShutDown();
  return pass ? 0 : 1;
}
