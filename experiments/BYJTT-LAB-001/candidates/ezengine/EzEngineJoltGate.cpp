#include <Foundation/Application/Application.h>
#include <Foundation/Configuration/Startup.h>
#include <Jolt/Core/TempAllocator.h>
#include <Jolt/Physics/Body/BodyCreationSettings.h>
#include <Jolt/Physics/Collision/BroadPhase/BroadPhaseLayer.h>
#include <Jolt/Physics/Collision/Shape/BoxShape.h>
#include <Jolt/Physics/Collision/Shape/CapsuleShape.h>
#include <Jolt/Physics/PhysicsSystem.h>
#include <JoltPlugin/System/JoltCore.h>

#include <algorithm>
#include <cmath>
#include <fstream>
#include <iomanip>

namespace
{
  constexpr float ArenaWidth = 24.0f;
  constexpr float ArenaDepth = 32.0f;
  constexpr float WalkSpeed = 3.5f;
  constexpr float PlayerRadius = 0.4f;
  constexpr float PlayerHalfCylinder = 0.5f;
  constexpr float PlayerCenterY = PlayerRadius + PlayerHalfCylinder;
  constexpr float WallHalfThickness = 0.25f;
  constexpr float EastWallInnerX = ArenaWidth * 0.5f;
  constexpr float ExpectedCenterCeilingX = EastWallInnerX - PlayerRadius;
  constexpr float FixedDt = 1.0f / 60.0f;
  constexpr int DrivenSteps = 300;
  constexpr int ReleaseSteps = 60;

  namespace Layers
  {
    static constexpr JPH::ObjectLayer NonMoving = 0;
    static constexpr JPH::ObjectLayer Moving = 1;
    static constexpr JPH::ObjectLayer Count = 2;
  }

  namespace BroadPhaseLayers
  {
    static constexpr JPH::BroadPhaseLayer NonMoving(0);
    static constexpr JPH::BroadPhaseLayer Moving(1);
    static constexpr unsigned Count = 2;
  }

  class BroadPhaseLayerInterface final : public JPH::BroadPhaseLayerInterface
  {
  public:
    BroadPhaseLayerInterface()
    {
      m_Map[Layers::NonMoving] = BroadPhaseLayers::NonMoving;
      m_Map[Layers::Moving] = BroadPhaseLayers::Moving;
    }

    unsigned GetNumBroadPhaseLayers() const override { return BroadPhaseLayers::Count; }

    JPH::BroadPhaseLayer GetBroadPhaseLayer(JPH::ObjectLayer layer) const override
    {
      return m_Map[layer];
    }

#if defined(JPH_EXTERNAL_PROFILE) || defined(JPH_PROFILE_ENABLED)
    const char* GetBroadPhaseLayerName(JPH::BroadPhaseLayer layer) const override
    {
      return layer == BroadPhaseLayers::NonMoving ? "NON_MOVING" : "MOVING";
    }
#endif

  private:
    JPH::BroadPhaseLayer m_Map[Layers::Count];
  };

  class ObjectVsBroadPhaseLayerFilter final : public JPH::ObjectVsBroadPhaseLayerFilter
  {
  public:
    bool ShouldCollide(JPH::ObjectLayer layer, JPH::BroadPhaseLayer broadPhaseLayer) const override
    {
      if (layer == Layers::NonMoving)
        return broadPhaseLayer == BroadPhaseLayers::Moving;
      return true;
    }
  };

  class ObjectLayerPairFilter final : public JPH::ObjectLayerPairFilter
  {
  public:
    bool ShouldCollide(JPH::ObjectLayer first, JPH::ObjectLayer second) const override
    {
      if (first == Layers::NonMoving)
        return second == Layers::Moving;
      return true;
    }
  };

  struct Observation
  {
    double x = 0.0;
    double y = 0.0;
    double z = 0.0;
    double velocityX = 0.0;
  };

  JPH::BodyID AddStaticBox(JPH::BodyInterface& bodies, const JPH::Vec3& halfExtents, const JPH::RVec3& center)
  {
    JPH::BodyCreationSettings settings(new JPH::BoxShape(halfExtents), center, JPH::Quat::sIdentity(), JPH::EMotionType::Static, Layers::NonMoving);
    return bodies.CreateAndAddBody(settings, JPH::EActivation::DontActivate);
  }

  class ByJttEzEngineJoltGate final : public ezApplication
  {
  public:
    ByJttEzEngineJoltGate()
      : ezApplication("ByJttEzEngineJoltGate")
    {
    }

    void Run() override
    {
      bool passed = false;
      bool observationCopyIsolated = false;
      bool nativeWallStopObserved = false;
      double maxX = 0.0;
      Observation finalObservation;

      BroadPhaseLayerInterface broadPhaseLayerInterface;
      ObjectVsBroadPhaseLayerFilter objectVsBroadPhaseLayerFilter;
      ObjectLayerPairFilter objectLayerPairFilter;

      JPH::PhysicsSystem physics;
      physics.Init(128, 0, 256, 128, broadPhaseLayerInterface, objectVsBroadPhaseLayerFilter, objectLayerPairFilter);
      physics.SetGravity(JPH::Vec3(0.0f, -9.81f, 0.0f));

      JPH::BodyInterface& bodies = physics.GetBodyInterface();

      const JPH::BodyID floor = AddStaticBox(bodies, JPH::Vec3(ArenaWidth * 0.5f + 0.5f, 0.25f, ArenaDepth * 0.5f + 0.5f), JPH::RVec3(0.0, -0.25, 0.0));
      const JPH::BodyID eastWall = AddStaticBox(bodies, JPH::Vec3(WallHalfThickness, 2.0f, ArenaDepth * 0.5f + 0.5f), JPH::RVec3(EastWallInnerX + WallHalfThickness, 2.0, 0.0));
      const JPH::BodyID westWall = AddStaticBox(bodies, JPH::Vec3(WallHalfThickness, 2.0f, ArenaDepth * 0.5f + 0.5f), JPH::RVec3(-EastWallInnerX - WallHalfThickness, 2.0, 0.0));
      const JPH::BodyID northWall = AddStaticBox(bodies, JPH::Vec3(ArenaWidth * 0.5f + 0.5f, 2.0f, WallHalfThickness), JPH::RVec3(0.0, 2.0, ArenaDepth * 0.5f + WallHalfThickness));
      const JPH::BodyID southWall = AddStaticBox(bodies, JPH::Vec3(ArenaWidth * 0.5f + 0.5f, 2.0f, WallHalfThickness), JPH::RVec3(0.0, 2.0, -ArenaDepth * 0.5f - WallHalfThickness));

      JPH::BodyCreationSettings playerSettings(new JPH::CapsuleShape(PlayerHalfCylinder, PlayerRadius), JPH::RVec3(0.0, PlayerCenterY, 10.0), JPH::Quat::sIdentity(), JPH::EMotionType::Dynamic, Layers::Moving);
      playerSettings.mFriction = 0.0f;
      playerSettings.mLinearDamping = 0.0f;
      playerSettings.mAngularDamping = 0.0f;
      playerSettings.mAllowedDOFs = JPH::EAllowedDOFs::TranslationX | JPH::EAllowedDOFs::TranslationY | JPH::EAllowedDOFs::TranslationZ;
      const JPH::BodyID player = bodies.CreateAndAddBody(playerSettings, JPH::EActivation::Activate);

      JPH::TempAllocatorImpl tempAllocator(8 * 1024 * 1024);
      JPH::JobSystem* jobSystem = ezJoltCore::GetJoltJobSystem();

      for (int step = 0; step < DrivenSteps; ++step)
      {
        const JPH::Vec3 currentVelocity = bodies.GetLinearVelocity(player);
        bodies.SetLinearVelocity(player, JPH::Vec3(WalkSpeed, currentVelocity.GetY(), 0.0f));
        physics.Update(FixedDt, 1, &tempAllocator, jobSystem);
        maxX = std::max(maxX, bodies.GetPosition(player).GetX());
      }

      for (int step = 0; step < ReleaseSteps; ++step)
      {
        physics.Update(FixedDt, 1, &tempAllocator, jobSystem);
        maxX = std::max(maxX, bodies.GetPosition(player).GetX());
      }

      const JPH::RVec3 finalPosition = bodies.GetPosition(player);
      const JPH::Vec3 finalVelocity = bodies.GetLinearVelocity(player);
      finalObservation = {finalPosition.GetX(), finalPosition.GetY(), finalPosition.GetZ(), finalVelocity.GetX()};

      Observation copiedObservation = finalObservation;
      copiedObservation.x = -9999.0;
      copiedObservation.velocityX = 9999.0;
      observationCopyIsolated = finalObservation.x != copiedObservation.x && finalObservation.velocityX != copiedObservation.velocityX;

      nativeWallStopObserved = maxX <= static_cast<double>(ExpectedCenterCeilingX + 0.01f) && finalObservation.x >= static_cast<double>(ExpectedCenterCeilingX - 0.10f) && std::abs(finalObservation.velocityX) < 0.05;
      passed = nativeWallStopObserved && observationCopyIsolated && std::abs(finalObservation.z - 10.0) < 0.02;

      bodies.RemoveBody(player);
      bodies.DestroyBody(player);
      for (const JPH::BodyID id : {floor, eastWall, westWall, northWall, southWall})
      {
        bodies.RemoveBody(id);
        bodies.DestroyBody(id);
      }

      std::ofstream result("byjtt-ezengine-result.json", std::ios::trunc);
      result << std::boolalpha << std::fixed << std::setprecision(9);
      result << "{\n";
      result << "  \"schema_version\": 1,\n";
      result << "  \"candidate_id\": \"ezengine\",\n";
      result << "  \"ezengine_release\": \"release-26.3\",\n";
      result << "  \"ezengine_revision\": \"9d6f053f1fa0637e420dc1d06a692b7bc5f27d1e\",\n";
      result << "  \"physics_backend\": \"ezEngine-bundled-Jolt\",\n";
      result << "  \"ezengine_jolt_plugin_linked\": true,\n";
      result << "  \"ezengine_character_component_executed\": false,\n";
      result << "  \"arena_width_m\": " << ArenaWidth << ",\n";
      result << "  \"arena_depth_m\": " << ArenaDepth << ",\n";
      result << "  \"contract_spawn_ground\": [0.000000000, 0.000000000, 10.000000000],\n";
      result << "  \"physics_body_spawn_center\": [0.000000000, " << PlayerCenterY << ", 10.000000000],\n";
      result << "  \"walk_speed_mps\": " << WalkSpeed << ",\n";
      result << "  \"fixed_timestep_seconds\": " << FixedDt << ",\n";
      result << "  \"driven_steps\": " << DrivenSteps << ",\n";
      result << "  \"release_steps\": " << ReleaseSteps << ",\n";
      result << "  \"expected_east_wall_center_ceiling_x\": " << ExpectedCenterCeilingX << ",\n";
      result << "  \"maximum_x\": " << maxX << ",\n";
      result << "  \"final_x\": " << finalObservation.x << ",\n";
      result << "  \"final_y\": " << finalObservation.y << ",\n";
      result << "  \"final_z\": " << finalObservation.z << ",\n";
      result << "  \"final_velocity_x\": " << finalObservation.velocityX << ",\n";
      result << "  \"native_wall_stop_observed\": " << nativeWallStopObserved << ",\n";
      result << "  \"observation_copy_isolated\": " << observationCopyIsolated << ",\n";
      result << "  \"post_physics_arena_clamp\": false,\n";
      result << "  \"external_input_executed\": false,\n";
      result << "  \"passed\": " << passed << "\n";
      result << "}\n";
      result.close();

      if (!passed)
        SetReturnCode(1);

      QuitApplication();
    }
  };
}

EZ_APPLICATION_ENTRY_POINT(ByJttEzEngineJoltGate);
