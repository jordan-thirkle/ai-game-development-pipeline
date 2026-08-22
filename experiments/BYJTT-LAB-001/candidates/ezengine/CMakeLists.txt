ez_cmake_init()

ez_requires_desktop()
ez_requires(EZ_3RDPARTY_JOLT_SUPPORT)

set(PROJECT_NAME ByJttEzEngineJoltGate)
ez_create_target(APPLICATION ${PROJECT_NAME})

target_link_libraries(${PROJECT_NAME}
  PUBLIC
  Core
  JoltPlugin
)

if(MSVC)
  target_compile_options(${PROJECT_NAME} PRIVATE /W4 /WX)
else()
  target_compile_options(${PROJECT_NAME} PRIVATE -Wall -Wextra -Wpedantic -Werror)
endif()
