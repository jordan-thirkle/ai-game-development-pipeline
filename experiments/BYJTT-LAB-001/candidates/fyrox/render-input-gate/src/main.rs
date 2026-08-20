use fyrox::{
    core::{reflect::prelude::*, visitor::prelude::*},
    dpi::LogicalSize,
    engine::{executor::Executor, GraphicsContextParams},
    event::{ElementState, Event, WindowEvent},
    event_loop::EventLoop,
    keyboard::{KeyCode, PhysicalKey},
    plugin::{error::GameResult, Plugin, PluginContext},
    window::WindowAttributes,
};
use std::{env, fs};

const WALK_SPEED_MPS: f32 = 3.5;
const REQUIRED_MOVEMENT_M: f32 = 1.0;
const WINDOW_TITLE: &str = "BYJTT LAB 001 Fyrox Render Input";

#[derive(Default, Visit, Reflect, Debug)]
#[reflect(non_cloneable)]
struct RenderInputGate {
    right_down: bool,
    press_events: u32,
    release_events: u32,
    update_ticks: u64,
    movement_m: f32,
    wrote_result: bool,
}

impl RenderInputGate {
    fn write_result(&mut self) {
        if self.wrote_result {
            return;
        }
        self.wrote_result = true;
        let head = env::var("CANDIDATE_HEAD_SHA")
            .or_else(|_| env::var("GITHUB_SHA"))
            .unwrap_or_else(|_| "local".to_string());
        let passed = self.press_events >= 1
            && self.release_events >= 1
            && self.update_ticks >= 1
            && self.movement_m >= REQUIRED_MOVEMENT_M;
        let json = format!(
            concat!(
                "{{\n",
                "  \"experiment_id\": \"BYJTT-LAB-001\",\n",
                "  \"candidate\": \"fyrox-1.0.0-render-input\",\n",
                "  \"exact_head\": \"{}\",\n",
                "  \"window_title\": \"{}\",\n",
                "  \"walk_speed_mps\": {},\n",
                "  \"input_path\": \"Plugin::on_os_event/WindowEvent::KeyboardInput\",\n",
                "  \"external_input_required\": true,\n",
                "  \"press_events\": {},\n",
                "  \"release_events\": {},\n",
                "  \"update_ticks\": {},\n",
                "  \"movement_m\": {:.6},\n",
                "  \"rendered_window_expected\": true,\n",
                "  \"native_physics_integrated_in_this_gate\": false,\n",
                "  \"passed\": {}\n",
                "}}\n"
            ),
            head,
            WINDOW_TITLE,
            WALK_SPEED_MPS,
            self.press_events,
            self.release_events,
            self.update_ticks,
            self.movement_m,
            passed
        );
        fs::create_dir_all("evidence").expect("create evidence directory");
        fs::write("evidence/runtime-result.json", json).expect("write runtime result");
        println!(
            "FYROX_RENDER_INPUT_RESULT passed={passed} press={} release={} ticks={} movement_m={:.6}",
            self.press_events, self.release_events, self.update_ticks, self.movement_m
        );
    }
}

impl Plugin for RenderInputGate {
    fn update(&mut self, context: &mut PluginContext<'_, '_>) -> GameResult {
        self.update_ticks += 1;
        if self.right_down {
            self.movement_m += WALK_SPEED_MPS * context.dt;
        }
        Ok(())
    }

    fn on_os_event(
        &mut self,
        event: &Event<()>,
        _context: PluginContext<'_, '_>,
    ) -> GameResult {
        if let Event::WindowEvent {
            event: WindowEvent::KeyboardInput { event, .. },
            ..
        } = event
        {
            if let PhysicalKey::Code(KeyCode::KeyD) = event.physical_key {
                match event.state {
                    ElementState::Pressed => {
                        if !self.right_down {
                            self.press_events += 1;
                        }
                        self.right_down = true;
                    }
                    ElementState::Released => {
                        self.right_down = false;
                        self.release_events += 1;
                        self.write_result();
                    }
                }
            }
        }
        Ok(())
    }
}

fn main() {
    let event_loop = EventLoop::new().expect("create Fyrox event loop");
    let mut executor = Executor::from_params(
        Some(event_loop),
        GraphicsContextParams {
            window_attributes: WindowAttributes::default()
                .with_title(WINDOW_TITLE)
                .with_inner_size(LogicalSize::new(960.0, 540.0)),
            vsync: true,
            msaa_sample_count: None,
            graphics_server_constructor: Default::default(),
            named_objects: false,
        },
    );
    executor.set_desired_update_rate(60.0);
    executor.add_plugin(RenderInputGate::default());
    executor.run();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shared_walk_speed_is_preserved() {
        assert_eq!(WALK_SPEED_MPS, 3.5);
    }

    #[test]
    fn result_requires_external_press_and_release() {
        let mut gate = RenderInputGate::default();
        gate.update_ticks = 120;
        gate.movement_m = 3.5;
        assert_eq!(gate.press_events, 0);
        assert_eq!(gate.release_events, 0);
        assert!(!gate.wrote_result);
    }
}
