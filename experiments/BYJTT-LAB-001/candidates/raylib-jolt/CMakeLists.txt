cmake_minimum_required(VERSION 3.24)
project(byjtt_raylib_jolt_gate LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

include(FetchContent)

set(BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(BUILD_GAMES OFF CACHE BOOL "" FORCE)
FetchContent_Declare(
  raylib
  GIT_REPOSITORY https://github.com/raysan5/raylib.git
  GIT_TAG 6.0
  GIT_SHALLOW TRUE
)

set(JPH_BUILD_SAMPLES OFF CACHE BOOL "" FORCE)
set(JPH_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(JPH_BUILD_UNIT_TESTS OFF CACHE BOOL "" FORCE)
set(JPH_BUILD_HELLO_WORLD OFF CACHE BOOL "" FORCE)
set(JPH_BUILD_VIEWER OFF CACHE BOOL "" FORCE)
set(JPH_USE_AVX2 OFF CACHE BOOL "" FORCE)
set(JPH_USE_AVX OFF CACHE BOOL "" FORCE)
set(JPH_USE_SSE4_2 OFF CACHE BOOL "" FORCE)
set(JPH_USE_LZCNT OFF CACHE BOOL "" FORCE)
set(JPH_USE_TZCNT OFF CACHE BOOL "" FORCE)
set(JPH_USE_F16C OFF CACHE BOOL "" FORCE)
set(JPH_USE_FMADD OFF CACHE BOOL "" FORCE)
FetchContent_Declare(
  JoltPhysics
  GIT_REPOSITORY https://github.com/jrouwe/JoltPhysics.git
  GIT_TAG v5.5.0
  GIT_SHALLOW TRUE
  SOURCE_SUBDIR Build
)

FetchContent_MakeAvailable(raylib JoltPhysics)

add_executable(raylib_jolt_gate main.cpp)
target_link_libraries(raylib_jolt_gate PRIVATE raylib Jolt)
set_property(TARGET raylib_jolt_gate PROPERTY COMPILE_WARNING_AS_ERROR ON)
if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
  target_compile_options(raylib_jolt_gate PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion -Werror)
endif()
