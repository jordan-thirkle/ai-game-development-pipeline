cmake_minimum_required(VERSION 3.19)
project(byjtt_wicked_engine_gate LANGUAGES C CXX)

if(NOT DEFINED WICKED_ENGINE_SOURCE)
  message(FATAL_ERROR "WICKED_ENGINE_SOURCE must point to the exact checked-out Wicked Engine source")
endif()

set(WICKED_EDITOR OFF CACHE BOOL "" FORCE)
set(WICKED_TESTS OFF CACHE BOOL "" FORCE)
set(WICKED_IMGUI_EXAMPLE OFF CACHE BOOL "" FORCE)
set(WICKED_LINUX_TEMPLATE OFF CACHE BOOL "" FORCE)
set(WICKED_ENABLE_IPO OFF CACHE BOOL "" FORCE)
set(WICKED_ENABLE_SYMLINKS OFF CACHE BOOL "" FORCE)

add_subdirectory("${WICKED_ENGINE_SOURCE}" wicked-engine-build EXCLUDE_FROM_ALL)

add_executable(byjtt_wicked_gate src/main.cpp)
target_link_libraries(byjtt_wicked_gate PRIVATE WickedEngine)
target_compile_features(byjtt_wicked_gate PRIVATE cxx_std_17)

if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
  target_compile_options(byjtt_wicked_gate PRIVATE -Wall -Wextra -Wpedantic -Werror)
elseif(MSVC)
  target_compile_options(byjtt_wicked_gate PRIVATE /W4 /WX)
endif()
