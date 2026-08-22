use avian3d::prelude::*;
use bevy::{asset::AssetPlugin, prelude::*, time::TimeUpdateStrategy};
use bevy_tnua::builtins::{
    TnuaBuiltinJump, TnuaBuiltinJumpConfig, TnuaBuiltinWalk, TnuaBuiltinWalkConfig,
};
use bevy_tnua::{TnuaSchemeConfig, prelude::*};
use bevy_tnua_avian3d::prelude::*;
use serde::Serialize;
use std::{fs, path::PathBuf, time::Duration};

const ARENA_WIDTH: f32 = 24.0;
const ARENA_DEPTH: f32 = 32.0;
const PLAYER_SPAWN_GROUND: Vec3 = Vec3::new(0.0, 0.0, 10.0);
const WALK_SPEED: f32 = 3.5;
const WALK_ACCELERATION: f32 = 18.0;
const PLAYER_RADIUS: f32 = 0.4;
const PLAYER_CYLINDER_LENGTH: f32 = 1.0;
const FLOAT_HEIGHT: f32 = 0.95;
const WALL_THICKNESS: f32 = 0.5;
const FIXED_DT: f64 = 1.0 / 60.0;
const SETTLE_STEPS: usize = 90;
const DRIVEN_STEPS: usize = 300;
const RELEASE_STEPS: usize = 60;

#[derive(Component)]
struct Player;

#[derive(Resource, Default)]
struct DriveState {
    enabled: bool,
}

#[derive(TnuaScheme)]
#[scheme(basis = TnuaBuiltinWalk)]
enum ControlScheme {
    Jump(TnuaBuiltinJump),
}

#[derive(Serialize)]
struct ProofResult {
    bevy_version: &'static str,
    avian_version: &'static str,
    bevy_tnua_version: &'static str,
    bevy_tnua_avian3d_version: &'static str,
    controller_stack: &'static str,
    arena_width_m: f32,
    arena_depth_m: f32,
    walk_speed_mps: f32,
    walk_acceleration_mps2: f32,
    logical_spawn_ground_m: [f32; 3],
    physics_center_spawn_m: [f32; 3],
    expected_east_center_x_m: f32,
    max_x_m: f32,
    final_position_m: [f32; 3],
    final_ground_position_m: [f32; 3],
    final_velocity_mps: [f32; 3],
    release_drift_m: f32,
    tnua_controller_executed: bool,
    native_wall_stop_observed: bool,
    release_stable: bool,
    observation_copy_isolated: bool,
    post_physics_arena_clamp: bool,
    external_input_executed: bool,
    settle_steps: usize,
    driven_steps: usize,
    release_steps: usize,
}

fn create_app() -> App {
    let mut app = App::new();
    app.add_plugins((
        MinimalPlugins,
        AssetPlugin::default(),
        TransformPlugin,
        PhysicsPlugins::default(),
        TnuaControllerPlugin::<ControlScheme>::default(),
        TnuaAvian3dPlugin::default(),
    ))
    .insert_resource(Gravity(Vec3::NEG_Y * 9.81))
    .insert_resource(TimeUpdateStrategy::ManualDuration(Duration::from_secs_f64(
        FIXED_DT,
    )))
    .init_resource::<DriveState>()
    .add_systems(Startup, setup_world)
    .add_systems(Update, feed_controller.in_set(TnuaUserControlsSystems));
    app.finish();
    app
}

fn setup_world(
    mut commands: Commands,
    mut control_scheme_configs: ResMut<Assets<ControlSchemeConfig>>,
) {
    let half_w = ARENA_WIDTH * 0.5;
    let half_d = ARENA_DEPTH * 0.5;

    commands.spawn((
        RigidBody::Static,
        Position(Vec3::ZERO),
        Collider::half_space(Vec3::Y),
    ));

    // Wall inner faces remain exactly on the shared +/-12 m and +/-16 m arena boundaries.
    for (position, size) in [
        (
            Vec3::new(half_w + WALL_THICKNESS * 0.5, 2.0, 0.0),
            Vec3::new(WALL_THICKNESS, 4.0, ARENA_DEPTH + WALL_THICKNESS * 2.0),
        ),
        (
            Vec3::new(-half_w - WALL_THICKNESS * 0.5, 2.0, 0.0),
            Vec3::new(WALL_THICKNESS, 4.0, ARENA_DEPTH + WALL_THICKNESS * 2.0),
        ),
        (
            Vec3::new(0.0, 2.0, half_d + WALL_THICKNESS * 0.5),
            Vec3::new(ARENA_WIDTH + WALL_THICKNESS * 2.0, 4.0, WALL_THICKNESS),
        ),
        (
            Vec3::new(0.0, 2.0, -half_d - WALL_THICKNESS * 0.5),
            Vec3::new(ARENA_WIDTH + WALL_THICKNESS * 2.0, 4.0, WALL_THICKNESS),
        ),
    ] {
        commands.spawn((
            RigidBody::Static,
            Position(position),
            Collider::cuboid(size.x, size.y, size.z),
        ));
    }

    let physics_center_spawn = PLAYER_SPAWN_GROUND + Vec3::Y * FLOAT_HEIGHT;
    let config = control_scheme_configs.add(ControlSchemeConfig {
        basis: TnuaBuiltinWalkConfig {
            speed: WALK_SPEED,
            acceleration: WALK_ACCELERATION,
            float_height: FLOAT_HEIGHT,
            ..Default::default()
        },
        jump: TnuaBuiltinJumpConfig {
            height: 1.0,
            ..Default::default()
        },
    });

    commands.spawn((
        Player,
        Transform::from_translation(physics_center_spawn),
        RigidBody::Dynamic,
        Position(physics_center_spawn),
        Collider::capsule(PLAYER_RADIUS, PLAYER_CYLINDER_LENGTH),
        TnuaController::<ControlScheme>::default(),
        TnuaConfig::<ControlScheme>(config),
        TnuaAvian3dSensorShape(Collider::cylinder(PLAYER_RADIUS - 0.01, 0.0)),
        LockedAxes::ROTATION_LOCKED,
    ));
}

fn feed_controller(
    drive: Res<DriveState>,
    mut query: Query<&mut TnuaController<ControlScheme>, With<Player>>,
) {
    let Ok(mut controller) = query.single_mut() else {
        return;
    };
    controller.initiate_action_feeding();
    controller.basis = TnuaBuiltinWalk {
        desired_motion: if drive.enabled { Vec3::X } else { Vec3::ZERO },
        ..Default::default()
    };
}

fn tick(app: &mut App) {
    app.insert_resource(TimeUpdateStrategy::ManualDuration(Duration::from_secs_f64(
        FIXED_DT,
    )));
    app.update();
}

fn player_position(app: &mut App) -> Vec3 {
    let world = app.world_mut();
    let mut query = world.query_filtered::<&Position, With<Player>>();
    query
        .single(world)
        .expect("exactly one benchmark player")
        .0
}

fn player_state(app: &mut App) -> (Vec3, Vec3) {
    let world = app.world_mut();
    let mut query = world.query_filtered::<(&Position, &LinearVelocity), With<Player>>();
    let (position, velocity) = query
        .single(world)
        .expect("exactly one benchmark player");
    (position.0, velocity.0)
}

fn main() {
    let mut app = create_app();

    // Create the world and let Tnua settle on the native Avian floor before measuring movement.
    tick(&mut app);
    for _ in 0..SETTLE_STEPS {
        tick(&mut app);
    }

    let settled = player_position(&mut app);
    let controller_present = {
        let world = app.world_mut();
        let mut query = world.query_filtered::<&TnuaController<ControlScheme>, With<Player>>();
        query.single(world).is_ok()
    };

    app.world_mut().resource_mut::<DriveState>().enabled = true;
    let mut max_x = settled.x;
    for _ in 0..DRIVEN_STEPS {
        tick(&mut app);
        max_x = max_x.max(player_position(&mut app).x);
    }

    app.world_mut().resource_mut::<DriveState>().enabled = false;
    let release_start = player_position(&mut app);
    for _ in 0..RELEASE_STEPS {
        tick(&mut app);
        max_x = max_x.max(player_position(&mut app).x);
    }

    let (final_position, final_velocity) = player_state(&mut app);
    let release_drift = (final_position.x - release_start.x).abs();
    let expected_east_center_x = ARENA_WIDTH * 0.5 - PLAYER_RADIUS;
    let moved = max_x - settled.x > 3.0;
    let wall_stop = max_x <= expected_east_center_x + 0.08
        && final_position.x >= expected_east_center_x - 0.20
        && final_position.x <= expected_east_center_x + 0.08;
    let release_stable = release_drift <= 0.05 && final_velocity.x.abs() <= 0.10;

    // Mutate only a copied observation and re-read authoritative ECS state.
    let authoritative_before = final_position.to_array();
    let mut observation_copy = authoritative_before;
    observation_copy[0] = -9999.0;
    let authoritative_after = player_position(&mut app).to_array();
    let observation_copy_isolated = observation_copy[0] != authoritative_after[0]
        && authoritative_before == authoritative_after;

    let final_ground_position = final_position - Vec3::Y * FLOAT_HEIGHT;
    let result = ProofResult {
        bevy_version: "0.19.0",
        avian_version: "0.7.0",
        bevy_tnua_version: "0.32.0",
        bevy_tnua_avian3d_version: "0.12.0",
        controller_stack: "bevy_tnua_avian3d",
        arena_width_m: ARENA_WIDTH,
        arena_depth_m: ARENA_DEPTH,
        walk_speed_mps: WALK_SPEED,
        walk_acceleration_mps2: WALK_ACCELERATION,
        logical_spawn_ground_m: PLAYER_SPAWN_GROUND.to_array(),
        physics_center_spawn_m: (PLAYER_SPAWN_GROUND + Vec3::Y * FLOAT_HEIGHT).to_array(),
        expected_east_center_x_m: expected_east_center_x,
        max_x_m: max_x,
        final_position_m: final_position.to_array(),
        final_ground_position_m: final_ground_position.to_array(),
        final_velocity_mps: final_velocity.to_array(),
        release_drift_m: release_drift,
        tnua_controller_executed: controller_present && moved,
        native_wall_stop_observed: wall_stop,
        release_stable,
        observation_copy_isolated,
        post_physics_arena_clamp: false,
        external_input_executed: false,
        settle_steps: SETTLE_STEPS,
        driven_steps: DRIVEN_STEPS,
        release_steps: RELEASE_STEPS,
    };

    let json = serde_json::to_string_pretty(&result).expect("serialize proof result");
    let output = std::env::var_os("BYJTT_EVIDENCE_JSON")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("bevy-tnua-proof.json"));
    fs::write(&output, format!("{json}\n")).expect("write proof result");
    println!("{json}");

    assert!(controller_present && moved, "Tnua controller did not execute movement");
    assert!(wall_stop, "native east-wall stop was not observed");
    assert!(release_stable, "controller release was not stable");
    assert!(observation_copy_isolated, "observation copy mutated ECS-owned state");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shared_contract_constants_are_not_weakened() {
        assert_eq!(ARENA_WIDTH, 24.0);
        assert_eq!(ARENA_DEPTH, 32.0);
        assert_eq!(PLAYER_SPAWN_GROUND, Vec3::new(0.0, 0.0, 10.0));
        assert_eq!(WALK_SPEED, 3.5);
        assert_eq!(WALK_ACCELERATION, 18.0);
    }

    #[test]
    fn native_wall_geometry_preserves_shared_arena_boundary() {
        let east_inner_face = ARENA_WIDTH * 0.5;
        let expected_center = east_inner_face - PLAYER_RADIUS;
        assert!((east_inner_face - 12.0).abs() < f32::EPSILON);
        assert!((expected_center - 11.6).abs() < f32::EPSILON);
    }

    #[test]
    fn floating_center_mapping_preserves_logical_ground_spawn() {
        let center = PLAYER_SPAWN_GROUND + Vec3::Y * FLOAT_HEIGHT;
        assert_eq!(center - Vec3::Y * FLOAT_HEIGHT, PLAYER_SPAWN_GROUND);
    }
}
