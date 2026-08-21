#include <Urho3D/Engine/Application.h>
#include <Urho3D/Engine/Engine.h>
#include <Urho3D/Engine/EngineDefs.h>
#include <Urho3D/Physics/CollisionShape.h>
#include <Urho3D/Physics/KinematicCharacterController.h>
#include <Urho3D/Physics/PhysicsWorld.h>
#include <Urho3D/Physics/RigidBody.h>
#include <Urho3D/Scene/Scene.h>

#include <algorithm>
#include <cmath>
#include <cstdio>

using namespace Urho3D;

namespace
{
constexpr float ArenaWidth = 24.0f;
constexpr float ArenaDepth = 32.0f;
constexpr float SpawnZ = 10.0f;
constexpr float WalkSpeed = 3.5f;
constexpr float PlayerDiameter = 0.8f;
constexpr float PlayerHeight = 1.8f;
constexpr float FixedStep = 1.0f / 60.0f;
constexpr float EastWallInnerX = ArenaWidth * 0.5f;
constexpr float ExpectedStopX = EastWallInnerX - PlayerDiameter * 0.5f;

void AddStaticBox(Scene* scene, const char* name, const Vector3& position, const Vector3& size)
{
    Node* node = scene->CreateChild(name);
    node->SetPosition(position);
    auto* body = node->CreateComponent<RigidBody>();
    body->SetMass(0.0f);
    auto* shape = node->CreateComponent<CollisionShape>();
    shape->SetBox(size);
}
}

class RbfxCharacterGate final : public Application
{
    URHO3D_OBJECT(RbfxCharacterGate, Application);

public:
    explicit RbfxCharacterGate(Context* context) : Application(context) {}

    void Setup() override
    {
        engineParameters_[EP_HEADLESS] = true;
        engineParameters_[EP_APPLICATION_NAME] = "BYJTT rbfx character gate";
        engineParameters_[EP_LOG_NAME] = "rbfx-character-gate.log";
    }

    void Start() override
    {
        auto scene = MakeShared<Scene>(context_);
        auto* physics = scene->CreateComponent<PhysicsWorld>();
        physics->SetManualUpdate(true);
        physics->SetFps(60);
        physics->SetGravity(Vector3(0.0f, -14.0f, 0.0f));

        AddStaticBox(scene, "Floor", Vector3(0.0f, -0.5f, 0.0f), Vector3(ArenaWidth, 1.0f, ArenaDepth));
        AddStaticBox(scene, "EastWall", Vector3(12.25f, 1.5f, 0.0f), Vector3(0.5f, 3.0f, ArenaDepth));
        AddStaticBox(scene, "WestWall", Vector3(-12.25f, 1.5f, 0.0f), Vector3(0.5f, 3.0f, ArenaDepth));
        AddStaticBox(scene, "NorthWall", Vector3(0.0f, 1.5f, 16.25f), Vector3(ArenaWidth, 3.0f, 0.5f));
        AddStaticBox(scene, "SouthWall", Vector3(0.0f, 1.5f, -16.25f), Vector3(ArenaWidth, 3.0f, 0.5f));

        Node* player = scene->CreateChild("Player");
        player->SetPosition(Vector3(0.0f, 0.0f, SpawnZ));
        auto* controller = player->CreateComponent<KinematicCharacterController>();
        controller->SetDiameter(PlayerDiameter);
        controller->SetHeight(PlayerHeight);
        controller->SetOffset(Vector3(0.0f, PlayerHeight * 0.5f, 0.0f));
        controller->SetGravity(Vector3(0.0f, -14.0f, 0.0f));
        controller->SetWalkIncrement(Vector3::ZERO);

        for (unsigned i = 0; i < 120; ++i)
            physics->Update(FixedStep);

        float maximumX = controller->GetRawPosition().x_;
        const Vector3 walkIncrement(WalkSpeed * FixedStep, 0.0f, 0.0f);
        for (unsigned i = 0; i < 300; ++i)
        {
            controller->SetWalkIncrement(walkIncrement);
            physics->Update(FixedStep);
            maximumX = std::max(maximumX, controller->GetRawPosition().x_);
        }

        controller->SetWalkIncrement(Vector3::ZERO);
        const float releaseStartX = controller->GetRawPosition().x_;
        for (unsigned i = 0; i < 60; ++i)
            physics->Update(FixedStep);

        const Vector3 finalPosition = controller->GetRawPosition();
        const float releaseDrift = std::abs(finalPosition.x_ - releaseStartX);
        const float boundaryError = std::abs(finalPosition.x_ - ExpectedStopX);

        const Vector3 observationCopy = finalPosition;
        Vector3 mutatedCopy = observationCopy;
        mutatedCopy.x_ = -999.0f;
        const bool observationIsolated = std::abs(controller->GetRawPosition().x_ - observationCopy.x_) < 0.000001f;
        const bool arenaContained = maximumX <= ExpectedStopX + 0.08f;
        const bool nativeWallStop = boundaryError <= 0.08f && releaseDrift <= 0.002f;
        const bool passed = nativeWallStop && arenaContained && observationIsolated;

        std::printf(
            "BYJTT_RESULT {\"rbfx_revision\":\"5dd5df44886220be53a8eb1a0f1be5f84a3e9e21\","
            "\"arena_width_m\":%.1f,\"arena_depth_m\":%.1f,\"spawn\":[0.0,0.0,%.1f],"
            "\"walk_speed_mps\":%.1f,\"fixed_step_s\":%.9f,\"driven_steps\":300,\"release_steps\":60,"
            "\"expected_stop_x\":%.6f,\"maximum_x\":%.6f,\"final_x\":%.6f,"
            "\"boundary_error_m\":%.9f,\"release_drift_m\":%.9f,"
            "\"native_wall_stop\":%s,\"observation_copy_isolated\":%s,"
            "\"post_physics_arena_clamp\":false,\"external_input_executed\":false,\"passed\":%s}\n",
            ArenaWidth, ArenaDepth, SpawnZ, WalkSpeed, FixedStep, ExpectedStopX, maximumX, finalPosition.x_,
            boundaryError, releaseDrift, nativeWallStop ? "true" : "false",
            observationIsolated ? "true" : "false", passed ? "true" : "false");
        std::fflush(stdout);

        engine_->Exit();
        if (!passed)
            exitCode_ = 2;
    }

    void Stop() override {}

private:
    int exitCode_{};
};

URHO3D_DEFINE_APPLICATION_MAIN(RbfxCharacterGate);
