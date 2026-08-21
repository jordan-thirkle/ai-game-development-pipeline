cmake_minimum_required(VERSION 3.20)
project(ByjttRbfxGate LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(NOT DEFINED RBFX_SOURCE_DIR)
    message(FATAL_ERROR "RBFX_SOURCE_DIR must point at the pinned rbfx checkout")
endif()

set(URHO3D_SAMPLES OFF CACHE BOOL "" FORCE)
set(URHO3D_TOOLS OFF CACHE BOOL "" FORCE)
set(URHO3D_TESTING OFF CACHE BOOL "" FORCE)
set(URHO3D_CSHARP OFF CACHE BOOL "" FORCE)
set(URHO3D_PROFILING OFF CACHE BOOL "" FORCE)

add_subdirectory("${RBFX_SOURCE_DIR}" "${CMAKE_BINARY_DIR}/rbfx" EXCLUDE_FROM_ALL)

add_executable(rbfx_character_gate Main.cpp)
target_link_libraries(rbfx_character_gate PRIVATE Urho3D)
if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
    target_compile_options(rbfx_character_gate PRIVATE -Wall -Wextra -Wpedantic -Werror)
endif()
