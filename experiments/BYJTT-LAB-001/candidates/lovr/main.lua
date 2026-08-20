local FIXED_DT = 1 / 60
local DRIVE_STEPS = 300
local RELEASE_STEPS = 60
local ARENA_WIDTH = 24
local ARENA_DEPTH = 32
local WALK_SPEED = 3.5
local PLAYER_HALF_WIDTH = 0.4
local PLAYER_HALF_HEIGHT = 0.9
local WALL_THICKNESS = 0.5
local EAST_INNER_FACE = ARENA_WIDTH / 2
local EXPECTED_CENTER_CEILING = EAST_INNER_FACE - PLAYER_HALF_WIDTH

local function bool(value)
  return value and 'true' or 'false'
end

local function number(value)
  return string.format('%.9f', value)
end

local function emit(result)
  local json = '{'
    .. '"passed":' .. bool(result.passed) .. ','
    .. '"lovr_version":"' .. result.lovr_version .. '",'
    .. '"physics_backend":"jolt",'
    .. '"arena_width_m":24,'
    .. '"arena_depth_m":32,'
    .. '"walk_speed_mps":3.5,'
    .. '"spawn_ground_space":[0,0,10],'
    .. '"collider_start":[0,0.9,10],'
    .. '"fixed_dt":' .. number(FIXED_DT) .. ','
    .. '"drive_steps":300,'
    .. '"release_steps":60,'
    .. '"expected_center_ceiling_x":' .. number(EXPECTED_CENTER_CEILING) .. ','
    .. '"max_x":' .. number(result.max_x) .. ','
    .. '"final_x":' .. number(result.final_x) .. ','
    .. '"final_y":' .. number(result.final_y) .. ','
    .. '"final_z":' .. number(result.final_z) .. ','
    .. '"final_vx":' .. number(result.final_vx) .. ','
    .. '"release_drift_m":' .. number(result.release_drift) .. ','
    .. '"native_wall_stop_observed":' .. bool(result.native_wall_stop_observed) .. ','
    .. '"release_stable":' .. bool(result.release_stable) .. ','
    .. '"observation_copy_isolated":' .. bool(result.observation_copy_isolated) .. ','
    .. '"post_physics_arena_clamp":false,'
    .. '"external_input_executed":false'
    .. '}'
  print('BYJTT_RESULT=' .. json)
end

local function observation(player)
  local x, y, z = player:getPosition()
  return { player = { x = x, y = y, z = z } }
end

local function add_static_box(world, x, y, z, sx, sy, sz)
  local collider = world:newBoxCollider(x, y, z, sx, sy, sz)
  collider:setTag('arena')
  collider:setFriction(1.0)
  collider:setRestitution(0.0)
  return collider
end

function lovr.load()
  local major, minor, patch = lovr.getVersion()
  local version = string.format('%d.%d.%d', major, minor, patch)

  local world = lovr.physics.newWorld({
    staticTags = { 'arena' },
    allowSleep = false,
    stabilization = 0.5,
    maxOverlap = 0.01,
    velocitySteps = 12,
    positionSteps = 4
  })

  add_static_box(world, 0, -WALL_THICKNESS / 2, 0, ARENA_WIDTH, WALL_THICKNESS, ARENA_DEPTH)
  add_static_box(world, -ARENA_WIDTH / 2 - WALL_THICKNESS / 2, 1.5, 0, WALL_THICKNESS, 3, ARENA_DEPTH)
  add_static_box(world, ARENA_WIDTH / 2 + WALL_THICKNESS / 2, 1.5, 0, WALL_THICKNESS, 3, ARENA_DEPTH)
  add_static_box(world, 0, 1.5, -ARENA_DEPTH / 2 - WALL_THICKNESS / 2, ARENA_WIDTH, 3, WALL_THICKNESS)
  add_static_box(world, 0, 1.5, ARENA_DEPTH / 2 + WALL_THICKNESS / 2, ARENA_WIDTH, 3, WALL_THICKNESS)

  local player = world:newBoxCollider(0, PLAYER_HALF_HEIGHT, 10, PLAYER_HALF_WIDTH * 2, PLAYER_HALF_HEIGHT * 2, PLAYER_HALF_WIDTH * 2)
  player:setFriction(0.0)
  player:setRestitution(0.0)
  player:setContinuous(true)
  player:setSleepingAllowed(false)
  player:setDegreesOfFreedom(true, true, true, false, false, false)

  local mass = player:getMass()
  local max_x = -math.huge

  for _ = 1, DRIVE_STEPS do
    local vx = player:getLinearVelocity()
    local impulse_x = (WALK_SPEED - vx) * mass
    player:applyLinearImpulse(impulse_x, 0, 0)
    world:update(FIXED_DT)
    local x = player:getPosition()
    max_x = math.max(max_x, x)
  end

  local release_start_x = player:getPosition()
  for _ = 1, RELEASE_STEPS do
    world:update(FIXED_DT)
  end

  local final_x, final_y, final_z = player:getPosition()
  local final_vx = player:getLinearVelocity()
  local release_drift = math.abs(final_x - release_start_x)

  local observed = observation(player)
  observed.player.x = -9999
  observed.player.y = -9999
  observed.player.z = -9999
  local authoritative = observation(player)
  local observation_copy_isolated = authoritative.player.x == final_x
    and authoritative.player.y == final_y
    and authoritative.player.z == final_z

  local native_wall_stop_observed = max_x <= EXPECTED_CENTER_CEILING + 0.02
    and final_x >= EXPECTED_CENTER_CEILING - 0.05
  local release_stable = release_drift <= 0.02 and math.abs(final_vx) <= 0.05
  local passed = version == '0.19.0'
    and native_wall_stop_observed
    and release_stable
    and observation_copy_isolated
    and math.abs(final_z - 10) <= 0.02
    and math.abs(final_y - PLAYER_HALF_HEIGHT) <= 0.03

  emit({
    passed = passed,
    lovr_version = version,
    max_x = max_x,
    final_x = final_x,
    final_y = final_y,
    final_z = final_z,
    final_vx = final_vx,
    release_drift = release_drift,
    native_wall_stop_observed = native_wall_stop_observed,
    release_stable = release_stable,
    observation_copy_isolated = observation_copy_isolated
  })

  lovr.event.quit(passed and 0 or 1)
end
