local ARENA_WIDTH = 24
local ARENA_DEPTH = 32
local WALK_SPEED = 3.5
local PLAYER_HALF_WIDTH = 0.4
local PLAYER_HALF_HEIGHT = 0.9
local WALL_THICKNESS = 0.5
local EAST_INNER_FACE = ARENA_WIDTH / 2
local EXPECTED_CENTER_CEILING = EAST_INNER_FACE - PLAYER_HALF_WIDTH
local TIMEOUT_SECONDS = 20
local RELEASE_SETTLE_SECONDS = 1

local world
local player
local camera
local started_at
local key_pressed = false
local key_released = false
local release_started_at
local release_started_x
local max_x = -math.huge
local render_frames = 0
local max_draws = 0
local emitted = false

local function bool(value)
  return value and 'true' or 'false'
end

local function number(value)
  return string.format('%.9f', value)
end

local function observe()
  local x, y, z = player:getPosition()
  return { player = { x = x, y = y, z = z } }
end

local function add_static_box(x, y, z, sx, sy, sz)
  local collider = world:newBoxCollider(x, y, z, sx, sy, sz)
  collider:setTag('arena')
  collider:setFriction(1.0)
  collider:setRestitution(0.0)
end

local function emit(passed, reason)
  if emitted then
    return
  end
  emitted = true

  local major, minor, patch = lovr.getVersion()
  local version = string.format('%d.%d.%d', major, minor, patch)
  local final_x, final_y, final_z = player:getPosition()
  local final_vx = player:getLinearVelocity()
  local release_drift = release_started_x and math.abs(final_x - release_started_x) or -1

  local copy = observe()
  copy.player.x = -9999
  copy.player.y = -9999
  copy.player.z = -9999
  local authoritative = observe()
  local observation_copy_isolated = authoritative.player.x == final_x
    and authoritative.player.y == final_y
    and authoritative.player.z == final_z

  local native_wall_stop_observed = max_x <= EXPECTED_CENTER_CEILING + 0.03
    and final_x >= EXPECTED_CENTER_CEILING - 0.06
  local release_stable = release_drift >= 0 and release_drift <= 0.02 and math.abs(final_vx) <= 0.05
  local rendered = render_frames >= 10 and max_draws >= 6
  local external_input_executed = key_pressed and key_released
  local window_open = lovr.system.isWindowOpen()
  local window_visible = lovr.system.isWindowVisible()
  local window_focused = lovr.system.isWindowFocused()
  local window_width, window_height = lovr.system.getWindowDimensions()

  local result = '{'
    .. '"passed":' .. bool(passed) .. ','
    .. '"reason":"' .. reason .. '",'
    .. '"lovr_version":"' .. version .. '",'
    .. '"physics_backend":"jolt",'
    .. '"arena_width_m":24,'
    .. '"arena_depth_m":32,'
    .. '"walk_speed_mps":3.5,'
    .. '"spawn_ground_space":[0,0,10],'
    .. '"expected_center_ceiling_x":' .. number(EXPECTED_CENTER_CEILING) .. ','
    .. '"max_x":' .. number(max_x) .. ','
    .. '"final_x":' .. number(final_x) .. ','
    .. '"final_y":' .. number(final_y) .. ','
    .. '"final_z":' .. number(final_z) .. ','
    .. '"final_vx":' .. number(final_vx) .. ','
    .. '"release_drift_m":' .. number(release_drift) .. ','
    .. '"render_frames":' .. render_frames .. ','
    .. '"max_draws_per_frame":' .. max_draws .. ','
    .. '"window_open":' .. bool(window_open) .. ','
    .. '"window_visible":' .. bool(window_visible) .. ','
    .. '"window_focused":' .. bool(window_focused) .. ','
    .. '"window_dimensions":[' .. window_width .. ',' .. window_height .. '],'
    .. '"rendered_window_path_executed":' .. bool(rendered) .. ','
    .. '"external_input_executed":' .. bool(external_input_executed) .. ','
    .. '"native_wall_stop_observed":' .. bool(native_wall_stop_observed) .. ','
    .. '"release_stable":' .. bool(release_stable) .. ','
    .. '"observation_copy_isolated":' .. bool(observation_copy_isolated) .. ','
    .. '"post_physics_arena_clamp":false'
    .. '}'

  print('BYJTT_RESULT=' .. result)
  lovr.event.quit(passed and 0 or 1)
end

function lovr.load()
  if not lovr.system.isWindowOpen() then
    lovr.system.openWindow({
      width = 960,
      height = 540,
      title = 'BYJTT LÖVR Render Input Gate',
      resizable = false,
      fullscreen = false
    })
  end

  local window_width, window_height = lovr.system.getWindowDimensions()
  print('BYJTT_WINDOW_OPEN=' .. bool(lovr.system.isWindowOpen()))
  print('BYJTT_WINDOW_VISIBLE=' .. bool(lovr.system.isWindowVisible()))
  print('BYJTT_WINDOW_FOCUSED=' .. bool(lovr.system.isWindowFocused()))
  print('BYJTT_WINDOW_DIMENSIONS=' .. window_width .. 'x' .. window_height)

  lovr.graphics.setBackgroundColor(.04, .05, .07)
  camera = lovr.math.newMat4():target({ 0, 18, 28 }, { 0, 0, 2 })

  world = lovr.physics.newWorld({
    tags = { 'arena' },
    staticTags = { 'arena' },
    allowSleep = false,
    stabilization = 0.5,
    maxOverlap = 0.01,
    velocitySteps = 12,
    positionSteps = 4
  })

  add_static_box(0, -WALL_THICKNESS / 2, 0, ARENA_WIDTH, WALL_THICKNESS, ARENA_DEPTH)
  add_static_box(-ARENA_WIDTH / 2 - WALL_THICKNESS / 2, 1.5, 0, WALL_THICKNESS, 3, ARENA_DEPTH)
  add_static_box(ARENA_WIDTH / 2 + WALL_THICKNESS / 2, 1.5, 0, WALL_THICKNESS, 3, ARENA_DEPTH)
  add_static_box(0, 1.5, -ARENA_DEPTH / 2 - WALL_THICKNESS / 2, ARENA_WIDTH, 3, WALL_THICKNESS)
  add_static_box(0, 1.5, ARENA_DEPTH / 2 + WALL_THICKNESS / 2, ARENA_WIDTH, 3, WALL_THICKNESS)

  player = world:newBoxCollider(
    0,
    PLAYER_HALF_HEIGHT,
    10,
    PLAYER_HALF_WIDTH * 2,
    PLAYER_HALF_HEIGHT * 2,
    PLAYER_HALF_WIDTH * 2
  )
  player:setFriction(0.0)
  player:setRestitution(0.0)
  player:setContinuous(true)
  player:setSleepingAllowed(false)
  player:setDegreesOfFreedom('xyz', '')

  started_at = lovr.timer.getTime()
  print('BYJTT_READY=1')
end

function lovr.keypressed(key)
  if key == 'd' then
    key_pressed = true
    print('BYJTT_KEY_PRESSED=d')
  end
end

function lovr.keyreleased(key)
  if key == 'd' then
    key_released = true
    release_started_at = lovr.timer.getTime()
    release_started_x = player:getPosition()
    print('BYJTT_KEY_RELEASED=d')
  end
end

function lovr.update(dt)
  if lovr.system.isKeyDown('d') then
    local vx = player:getLinearVelocity()
    local impulse_x = (WALK_SPEED - vx) * player:getMass()
    player:applyLinearImpulse(impulse_x, 0, 0)
  end

  world:update(dt)
  local x = player:getPosition()
  max_x = math.max(max_x, x)

  local now = lovr.timer.getTime()
  if key_released and release_started_at and now - release_started_at >= RELEASE_SETTLE_SECONDS then
    local final_x = player:getPosition()
    local final_vx = player:getLinearVelocity()
    local release_drift = math.abs(final_x - release_started_x)
    local wall_ok = max_x <= EXPECTED_CENTER_CEILING + 0.03 and final_x >= EXPECTED_CENTER_CEILING - 0.06
    local release_ok = release_drift <= 0.02 and math.abs(final_vx) <= 0.05
    local render_ok = render_frames >= 10 and max_draws >= 6
    emit(key_pressed and wall_ok and release_ok and render_ok, 'completed')
  elseif now - started_at >= TIMEOUT_SECONDS then
    emit(false, 'timeout')
  end
end

function lovr.draw(pass)
  render_frames = render_frames + 1
  pass:setViewPose(1, camera)
  pass:setProjection('perspective', math.rad(60), .05, 80)

  pass:setColor(.18, .2, .24)
  pass:box(0, -WALL_THICKNESS / 2, 0, ARENA_WIDTH, WALL_THICKNESS, ARENA_DEPTH)

  pass:setColor(.35, .38, .44)
  pass:box(-ARENA_WIDTH / 2 - WALL_THICKNESS / 2, 1.5, 0, WALL_THICKNESS, 3, ARENA_DEPTH)
  pass:box(ARENA_WIDTH / 2 + WALL_THICKNESS / 2, 1.5, 0, WALL_THICKNESS, 3, ARENA_DEPTH)
  pass:box(0, 1.5, -ARENA_DEPTH / 2 - WALL_THICKNESS / 2, ARENA_WIDTH, 3, WALL_THICKNESS)
  pass:box(0, 1.5, ARENA_DEPTH / 2 + WALL_THICKNESS / 2, ARENA_WIDTH, 3, WALL_THICKNESS)

  local x, y, z = player:getPosition()
  pass:setColor(.92, .47, .16)
  pass:box(x, y, z, PLAYER_HALF_WIDTH * 2, PLAYER_HALF_HEIGHT * 2, PLAYER_HALF_WIDTH * 2)

  local stats = pass:getStats()
  max_draws = math.max(max_draws, stats.draws)
end
