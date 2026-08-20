use avian3d::prelude::*;
use bevy::{prelude::*, time::TimeUpdateStrategy};
use serde::Serialize;
use std::{fs, path::PathBuf, time::Duration};

const ARENA_WIDTH: f32 = 24.0;
const ARENA_DEPTH: f32 = 32.0;
const PLAYER_SPAWN: Vec3 = Vec3::new(8.0, 0.0, 10.0);
const WALK_SPEED: f32 = 3.5;
const PLAYER_WIDTH: f32 = 0.7;
const WALL_THICKNESS: f32 = 0.5;
const FIXED_DT: f64 = 1.0 / 60.0;
const STEPS: usize = 180;

#[derive(Component)]
struct Player;

#[derive(Serialize)]
struct ProofResult {
    bevy_version: &'static str,
    avian_version: &'static str,
    arena_width_m: f32,
    arena_depth_m: f32,
    walk_speed_mps: f32,
    initial_position: [f32; 3],
    final_position: [f32; 3],
    final_velocity: [f32; 3],
    expected_east_nonpenetration_x: f32,
    native_wall_stop_observed: bool,
    post_physics_arena_clamp: bool,
    fixed_steps: usize,
}

fn create_app() -> App {
    let mut app = App::new();
    app.add_plugins((MinimalPlugins, TransformPlugin, PhysicsPlugins::default()))
        .insert_resource(Gravity::ZERO)
        .insert_resource(TimeUpdateStrategy::ManualDuration(Duration::from_secs_f64(FIXED_DT)));
    app.finish();
    app
}

fn setup_world(mut commands: Commands) {
    let half_w = ARENA_WIDTH * 0.5;
    let half_d = ARENA_DEPTH * 0.5;

    // Static Avian bodies define the shared 24 x 32 m arena. No post-physics clamp exists.
    for (position, size) in [
        (Vec3::new(half_w, 0.0, 0.0), Vec3::new(WALL_THICKNESS, 4.0, ARENA_DEPTH + WALL_THICKNESS)),
        (Vec3::new(-half_w, 0.0, 0.0), Vec3::new(WALL_THICKNESS, 4.0, ARENA_DEPTH + WALL_THICKNESS)),
        (Vec3::new(0.0, 0.0, half_d), Vec3::new(ARENA_WIDTH + WALL_THICKNESS, 4.0, WALL_THICKNESS)),
        (Vec3::new(0.0, 0.0, -half_d), Vec3::new(ARENA_WIDTH + WALL_THICKNESS, 4.0, WALL_THICKNESS)),
    ] {
        commands.spawn((
            RigidBody::Static,
            Position(position),
            Collider::cuboid(size.x, size.y, size.z),
        ));
    }

    commands.spawn((
        Player,
        Transform::from_translation(PLAYER_SPAWN),
        RigidBody::Dynamic,
        Position(PLAYER_SPAWN),
        Collider::cuboid(PLAYER_WIDTH, 1.8, PLAYER_WIDTH),
        LinearVelocity(Vec3::X * WALK_SPEED),
        LockedAxes::ROTATION_LOCKED,
    ));
}

fn tick(app: &mut App) {
    app.insert_resource(TimeUpdateStrategy::ManualDuration(Duration::from_secs_f64(FIXED_DT)));
    app.update();
}

fn main() {
    let mut app = create_app();
    app.add_systems(Startup, setup_world);

    // Startup + deterministic fixed-duration engine stepping.
    app.update();
    for _ in 0..STEPS {
        tick(&mut app);
    }

    let world = app.world_mut();
    let mut query = world.query_filtered::<(&Position, &LinearVelocity), With<Player>>();
    let (position, velocity) = query.single(world).expect("exactly one benchmark player");

    let expected_max_x = ARENA_WIDTH * 0.5 - WALL_THICKNESS * 0.5 - PLAYER_WIDTH * 0.5;
    let stop_observed = position.x <= expected_max_x + 0.05
        && position.x >= expected_max_x - 0.20
        && velocity.x.abs() < 0.10;

    let result = ProofResult {
        bevy_version: "0.19.0",
        avian_version: "0.7.0",
        arena_width_m: ARENA_WIDTH,
        arena_depth_m: ARENA_DEPTH,
        walk_speed_mps: WALK_SPEED,
        initial_position: PLAYER_SPAWN.to_array(),
        final_position: position.0.to_array(),
        final_velocity: velocity.0.to_array(),
        expected_east_nonpenetration_x: expected_max_x,
        native_wall_stop_observed: stop_observed,
        post_physics_arena_clamp: false,
        fixed_steps: STEPS,
    };

    let json = serde_json::to_string_pretty(&result).expect("serialize proof result");
    let output = std::env::var_os("BYJTT_EVIDENCE_JSON")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("bevy-avian-proof.json"));
    fs::write(&output, format!("{json}\n")).expect("write proof result");
    println!("{json}");

    assert!(stop_observed, "native east-wall collision was not observed");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shared_contract_constants_are_not_weakened() {
        assert_eq!(ARENA_WIDTH, 24.0);
        assert_eq!(ARENA_DEPTH, 32.0);
        assert_eq!(WALK_SPEED, 3.5);
    }

    #[test]
    fn geometric_stop_ceiling_is_inside_shared_arena() {
        let expected = ARENA_WIDTH * 0.5 - WALL_THICKNESS * 0.5 - PLAYER_WIDTH * 0.5;
        assert!((expected - 11.4).abs() < f32::EPSILON);
    }
}
