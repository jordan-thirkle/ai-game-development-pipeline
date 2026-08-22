use fyrox::{
    core::algebra::{Vector2, Vector3},
    scene::{
        base::BaseBuilder,
        collider::{ColliderBuilder, ColliderShape},
        graph::GraphUpdateSwitches,
        rigidbody::{RigidBodyBuilder, RigidBodyType},
        transform::TransformBuilder,
        Scene,
    },
};
use std::{env, fs};

const ARENA_WIDTH: f32 = 24.0;
const ARENA_DEPTH: f32 = 32.0;
const WALK_SPEED: f32 = 3.5;
const PLAYER_SPAWN: [f32; 3] = [0.0, 0.0, 10.0];
const PLAYER_HALF: f32 = 0.35;
const WALL_HALF_THICKNESS: f32 = 0.10;
const DT: f32 = 1.0 / 60.0;
const STEPS: usize = 360;

#[derive(Debug, Clone, Copy)]
struct RunResult {
    start_x: f32,
    final_x: f32,
    final_vx: f32,
    expected_ceiling: f32,
    native_wall_stop_observed: bool,
}

fn transform_at(x: f32, y: f32, z: f32) -> fyrox::scene::transform::Transform {
    TransformBuilder::new()
        .with_local_position(Vector3::new(x, y, z))
        .build()
}

fn add_static_wall(scene: &mut Scene, position: Vector3<f32>, half_extents: Vector3<f32>) {
    let collider = ColliderBuilder::new(BaseBuilder::new())
        .with_shape(ColliderShape::cuboid(
            half_extents.x,
            half_extents.y,
            half_extents.z,
        ))
        .build(&mut scene.graph);

    RigidBodyBuilder::new(
        BaseBuilder::new()
            .with_local_transform(transform_at(position.x, position.y, position.z))
            .with_child(collider),
    )
    .with_body_type(RigidBodyType::Static)
    .build(&mut scene.graph);
}

fn simulate() -> RunResult {
    let mut scene = Scene::new();

    let half_w = ARENA_WIDTH * 0.5;
    let half_d = ARENA_DEPTH * 0.5;
    add_static_wall(
        &mut scene,
        Vector3::new(half_w, 0.0, 0.0),
        Vector3::new(WALL_HALF_THICKNESS, 2.0, half_d),
    );
    add_static_wall(
        &mut scene,
        Vector3::new(-half_w, 0.0, 0.0),
        Vector3::new(WALL_HALF_THICKNESS, 2.0, half_d),
    );
    add_static_wall(
        &mut scene,
        Vector3::new(0.0, 0.0, half_d),
        Vector3::new(half_w, 2.0, WALL_HALF_THICKNESS),
    );
    add_static_wall(
        &mut scene,
        Vector3::new(0.0, 0.0, -half_d),
        Vector3::new(half_w, 2.0, WALL_HALF_THICKNESS),
    );

    let player_collider = ColliderBuilder::new(BaseBuilder::new())
        .with_shape(ColliderShape::cuboid(PLAYER_HALF, 0.9, PLAYER_HALF))
        .with_friction(0.0)
        .build(&mut scene.graph);
    let player = RigidBodyBuilder::new(
        BaseBuilder::new()
            .with_name("Player")
            .with_local_transform(transform_at(
                PLAYER_SPAWN[0],
                PLAYER_SPAWN[1],
                PLAYER_SPAWN[2],
            ))
            .with_child(player_collider),
    )
    .with_mass(1.0)
    .with_gravity_scale(0.0)
    .with_can_sleep(false)
    .with_rotation_locked(true)
    .with_lin_vel(Vector3::new(WALK_SPEED, 0.0, 0.0))
    .build(&mut scene.graph);

    let start_x = scene.graph[player].global_position().x;
    for _ in 0..STEPS {
        scene.update(
            Vector2::new(390.0, 844.0),
            DT,
            GraphUpdateSwitches::default(),
        );
    }

    let body = &scene.graph[player];
    let final_x = body.global_position().x;
    let final_vx = body.lin_vel().x;
    let expected_ceiling = half_w - WALL_HALF_THICKNESS - PLAYER_HALF;
    let native_wall_stop_observed = final_x <= expected_ceiling + 0.03
        && final_x >= expected_ceiling - 0.08
        && (final_x - start_x) > 1.0;

    RunResult {
        start_x,
        final_x,
        final_vx,
        expected_ceiling,
        native_wall_stop_observed,
    }
}

fn main() {
    let result = simulate();
    assert!(
        result.native_wall_stop_observed,
        "Fyrox native collision did not stop player at east wall: {result:?}"
    );

    let sha = env::var("GITHUB_SHA").unwrap_or_else(|_| "local".to_string());
    let json = format!(
        concat!(
            "{{\n",
            "  \"experiment_id\": \"BYJTT-LAB-001\",\n",
            "  \"candidate\": \"fyrox-1.0.0\",\n",
            "  \"exact_head\": \"{}\",\n",
            "  \"arena_width_m\": {},\n",
            "  \"arena_depth_m\": {},\n",
            "  \"walk_speed_mps\": {},\n",
            "  \"player_spawn\": [{}, {}, {}],\n",
            "  \"start_x_m\": {:.6},\n",
            "  \"final_x_m\": {:.6},\n",
            "  \"final_velocity_x_mps\": {:.9},\n",
            "  \"expected_non_penetration_ceiling_x_m\": {:.6},\n",
            "  \"physics_steps\": {},\n",
            "  \"fixed_dt_seconds\": {:.9},\n",
            "  \"native_wall_stop_observed\": {},\n",
            "  \"post_physics_arena_clamp\": false\n",
            "}}\n"
        ),
        sha,
        ARENA_WIDTH,
        ARENA_DEPTH,
        WALK_SPEED,
        PLAYER_SPAWN[0],
        PLAYER_SPAWN[1],
        PLAYER_SPAWN[2],
        result.start_x,
        result.final_x,
        result.final_vx,
        result.expected_ceiling,
        STEPS,
        DT,
        result.native_wall_stop_observed
    );
    fs::create_dir_all("evidence").expect("create evidence directory");
    fs::write("evidence/runtime-result.json", json).expect("write runtime evidence");
    println!("FYROX_NATIVE_PHYSICS_PASS {result:?}");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shared_constants_are_not_weakened() {
        assert_eq!(ARENA_WIDTH, 24.0);
        assert_eq!(ARENA_DEPTH, 32.0);
        assert_eq!(WALK_SPEED, 3.5);
        assert_eq!(PLAYER_SPAWN, [0.0, 0.0, 10.0]);
    }

    #[test]
    fn fyrox_native_wall_stops_dynamic_player() {
        let result = simulate();
        assert!(result.native_wall_stop_observed, "{result:?}");
    }
}
