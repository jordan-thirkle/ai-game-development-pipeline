#include <Jolt/Jolt.h>
#include <Jolt/RegisterTypes.h>
#include <Jolt/Core/Factory.h>
#include <Jolt/Core/TempAllocator.h>
#include <Jolt/Core/JobSystemThreadPool.h>
#include <Jolt/Physics/Body/BodyCreationSettings.h>
#include <Jolt/Physics/Collision/BroadPhase/BroadPhaseLayer.h>
#include <Jolt/Physics/Collision/Shape/BoxShape.h>
#include <Jolt/Physics/Collision/Shape/CapsuleShape.h>
#include <Jolt/Physics/PhysicsSystem.h>
#include <raylib.h>

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <thread>

using namespace JPH;

namespace Layers {
constexpr ObjectLayer NON_MOVING = 0;
constexpr ObjectLayer MOVING = 1;
constexpr uint NUM_LAYERS = 2;
}

namespace BroadPhaseLayers {
constexpr BroadPhaseLayer NON_MOVING(0);
constexpr BroadPhaseLayer MOVING(1);
constexpr uint NUM_LAYERS = 2;
}

class BroadPhaseLayerInterfaceImpl final : public BroadPhaseLayerInterface {
public:
    BroadPhaseLayerInterfaceImpl() {
        object_to_broad_phase_[Layers::NON_MOVING] = BroadPhaseLayers::NON_MOVING;
        object_to_broad_phase_[Layers::MOVING] = BroadPhaseLayers::MOVING;
    }

    uint GetNumBroadPhaseLayers() const override { return BroadPhaseLayers::NUM_LAYERS; }

    BroadPhaseLayer GetBroadPhaseLayer(ObjectLayer layer) const override {
        return object_to_broad_phase_[layer];
    }

private:
    BroadPhaseLayer object_to_broad_phase_[Layers::NUM_LAYERS];
};

class ObjectVsBroadPhaseLayerFilterImpl final : public ObjectVsBroadPhaseLayerFilter {
public:
    bool ShouldCollide(ObjectLayer layer1, BroadPhaseLayer layer2) const override {
        if (layer1 == Layers::NON_MOVING) {
            return layer2 == BroadPhaseLayers::MOVING;
        }
        return true;
    }
};

class ObjectLayerPairFilterImpl final : public ObjectLayerPairFilter {
public:
    bool ShouldCollide(ObjectLayer layer1, ObjectLayer layer2) const override {
        if (layer1 == Layers::NON_MOVING) {
            return layer2 == Layers::MOVING;
        }
        return true;
    }
};

static BodyID add_static_box(BodyInterface &bodies, Vec3 half_extents, RVec3 position) {
    BodyCreationSettings settings(new BoxShape(half_extents), position, Quat::sIdentity(), EMotionType::Static, Layers::NON_MOVING);
    return bodies.CreateAndAddBody(settings, EActivation::DontActivate);
}

int main() {
    constexpr float arena_width = 24.0F;
    constexpr float arena_depth = 32.0F;
    constexpr float player_radius = 0.4F;
    constexpr float player_half_height = 0.5F;
    constexpr float walk_speed = 3.5F;
    constexpr float fixed_dt = 1.0F / 60.0F;
    constexpr float wall_thickness = 0.4F;
    constexpr float expected_stop_x = 11.6F;
    constexpr int release_steps_required = 60;

    RegisterDefaultAllocator();
    Factory::sInstance = new Factory();
    RegisterTypes();

    TempAllocatorImpl temp_allocator(32U * 1024U * 1024U);
    const unsigned int hardware_threads = std::thread::hardware_concurrency();
    const int worker_threads = static_cast<int>(hardware_threads > 1U ? hardware_threads - 1U : 1U);
    JobSystemThreadPool job_system(cMaxPhysicsJobs, cMaxPhysicsBarriers, worker_threads);

    BroadPhaseLayerInterfaceImpl broad_phase_interface;
    ObjectVsBroadPhaseLayerFilterImpl object_vs_broad_phase_filter;
    ObjectLayerPairFilterImpl object_layer_pair_filter;

    PhysicsSystem physics;
    physics.Init(1024, 0, 1024, 1024, broad_phase_interface, object_vs_broad_phase_filter, object_layer_pair_filter);
    physics.SetGravity(Vec3(0.0F, -9.81F, 0.0F));
    BodyInterface &bodies = physics.GetBodyInterface();

    const float half_width = arena_width * 0.5F;
    const float half_depth = arena_depth * 0.5F;
    const float wall_half = wall_thickness * 0.5F;
    const float wall_height = 2.0F;

    add_static_box(bodies, Vec3(half_width, 0.2F, half_depth), RVec3(0.0_r, -0.2_r, 0.0_r));
    add_static_box(bodies, Vec3(wall_half, wall_height, half_depth), RVec3(half_width + wall_half, wall_height, 0.0_r));
    add_static_box(bodies, Vec3(wall_half, wall_height, half_depth), RVec3(-half_width - wall_half, wall_height, 0.0_r));
    add_static_box(bodies, Vec3(half_width, wall_height, wall_half), RVec3(0.0_r, wall_height, half_depth + wall_half));
    add_static_box(bodies, Vec3(half_width, wall_height, wall_half), RVec3(0.0_r, wall_height, -half_depth - wall_half));

    BodyCreationSettings player_settings(
        new CapsuleShape(player_half_height, player_radius),
        RVec3(0.0_r, 0.9_r, 10.0_r),
        Quat::sIdentity(),
        EMotionType::Dynamic,
        Layers::MOVING);
    player_settings.mFriction = 0.0F;
    player_settings.mRestitution = 0.0F;
    player_settings.mLinearDamping = 0.0F;
    player_settings.mAllowedDOFs = EAllowedDOFs::TranslationX | EAllowedDOFs::TranslationY | EAllowedDOFs::TranslationZ;
    const BodyID player_id = bodies.CreateAndAddBody(player_settings, EActivation::Activate);

    physics.OptimizeBroadPhase();

    InitWindow(960, 540, "BYJTT raylib 6.0 + Jolt 5.5 gate");
    SetTargetFPS(60);

    Camera3D camera{};
    camera.position = Vector3{18.0F, 16.0F, 24.0F};
    camera.target = Vector3{0.0F, 0.0F, 0.0F};
    camera.up = Vector3{0.0F, 1.0F, 0.0F};
    camera.fovy = 50.0F;
    camera.projection = CAMERA_PERSPECTIVE;

    bool was_down = false;
    bool saw_press = false;
    bool saw_release = false;
    int press_transitions = 0;
    int release_transitions = 0;
    int driven_steps = 0;
    int release_steps = 0;
    int rendered_frames = 0;
    float max_x = 0.0F;
    float release_x = 0.0F;
    float final_x = 0.0F;
    float release_drift = 999.0F;
    bool finished = false;
    bool passed = false;

    while (!WindowShouldClose() && !finished) {
        const bool down = IsKeyDown(KEY_D);
        if (down && !was_down) {
            saw_press = true;
            ++press_transitions;
        }
        if (!down && was_down) {
            saw_release = true;
            ++release_transitions;
            release_x = static_cast<float>(bodies.GetPosition(player_id).GetX());
        }
        was_down = down;

        Vec3 velocity = bodies.GetLinearVelocity(player_id);
        velocity.SetX(down ? walk_speed : 0.0F);
        velocity.SetZ(0.0F);
        bodies.SetLinearVelocity(player_id, velocity);
        physics.Update(fixed_dt, 1, &temp_allocator, &job_system);

        const RVec3 position = bodies.GetPosition(player_id);
        final_x = static_cast<float>(position.GetX());
        max_x = std::max(max_x, final_x);
        if (down) {
            ++driven_steps;
        } else if (saw_release) {
            ++release_steps;
            release_drift = std::abs(final_x - release_x);
        }

        BeginDrawing();
        ClearBackground(RAYWHITE);
        BeginMode3D(camera);
        DrawPlane(Vector3{0.0F, 0.0F, 0.0F}, Vector2{arena_width, arena_depth}, LIGHTGRAY);
        DrawCube(Vector3{half_width + wall_half, wall_height, 0.0F}, wall_thickness, wall_height * 2.0F, arena_depth, GRAY);
        DrawCube(Vector3{-half_width - wall_half, wall_height, 0.0F}, wall_thickness, wall_height * 2.0F, arena_depth, GRAY);
        DrawCube(Vector3{0.0F, wall_height, half_depth + wall_half}, arena_width, wall_height * 2.0F, wall_thickness, GRAY);
        DrawCube(Vector3{0.0F, wall_height, -half_depth - wall_half}, arena_width, wall_height * 2.0F, wall_thickness, GRAY);
        DrawCapsule(
            Vector3{final_x, 0.4F, 10.0F},
            Vector3{final_x, 1.4F, 10.0F},
            player_radius,
            12,
            12,
            RED);
        EndMode3D();
        DrawText("Physical D key -> raylib IsKeyDown -> Jolt dynamic capsule", 20, 20, 20, DARKGRAY);
        DrawText(TextFormat("x %.4f | press %d | release %d", final_x, press_transitions, release_transitions), 20, 50, 20, DARKGRAY);
        EndDrawing();
        ++rendered_frames;

        if (saw_press && saw_release && release_steps >= release_steps_required) {
            const Vec3 final_velocity = bodies.GetLinearVelocity(player_id);
            const bool native_stop = max_x <= expected_stop_x + 0.03F && final_x >= expected_stop_x - 0.08F;
            const bool stable_release = release_drift <= 0.01F && std::abs(final_velocity.GetX()) <= 0.01F;
            passed = native_stop && stable_release && driven_steps > 0 && press_transitions == 1 && release_transitions == 1;
            finished = true;
        }
    }

    const Vec3 final_velocity = bodies.GetLinearVelocity(player_id);
    std::ofstream result("runtime-result.json", std::ios::trunc);
    result << std::fixed << std::setprecision(9);
    result << "{\n";
    result << "  \"passed\": " << (passed ? "true" : "false") << ",\n";
    result << "  \"raylib_version\": \"6.0\",\n";
    result << "  \"jolt_version\": \"5.5.0\",\n";
    result << "  \"arena_width\": " << arena_width << ",\n";
    result << "  \"arena_depth\": " << arena_depth << ",\n";
    result << "  \"walk_speed\": " << walk_speed << ",\n";
    result << "  \"expected_stop_x\": " << expected_stop_x << ",\n";
    result << "  \"max_x\": " << max_x << ",\n";
    result << "  \"final_x\": " << final_x << ",\n";
    result << "  \"final_velocity_x\": " << final_velocity.GetX() << ",\n";
    result << "  \"release_drift\": " << release_drift << ",\n";
    result << "  \"press_transitions\": " << press_transitions << ",\n";
    result << "  \"release_transitions\": " << release_transitions << ",\n";
    result << "  \"driven_steps\": " << driven_steps << ",\n";
    result << "  \"release_steps\": " << release_steps << ",\n";
    result << "  \"rendered_frames\": " << rendered_frames << ",\n";
    result << "  \"external_input_executed\": " << ((saw_press && saw_release) ? "true" : "false") << ",\n";
    result << "  \"native_jolt_collision\": " << ((max_x <= expected_stop_x + 0.03F) ? "true" : "false") << ",\n";
    result << "  \"post_physics_arena_clamp\": false\n";
    result << "}\n";
    result.close();

    CloseWindow();
    bodies.RemoveBody(player_id);
    bodies.DestroyBody(player_id);
    UnregisterTypes();
    delete Factory::sInstance;
    Factory::sInstance = nullptr;

    std::cout << "BYJTT_RESULT passed=" << (passed ? "true" : "false")
              << " max_x=" << max_x
              << " final_x=" << final_x
              << " release_drift=" << release_drift
              << " press=" << press_transitions
              << " release=" << release_transitions << '\n';
    return passed ? 0 : 2;
}
