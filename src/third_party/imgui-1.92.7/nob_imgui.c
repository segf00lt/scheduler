
#ifndef NOB_IMPLEMENTATION

#define NOB_IMPLEMENTATION
#include "nob.h"

#endif

#define IMGUI_PATH "./src/third_party/imgui-1.92.7"

#define IMGUI_BUILD_DIR             IMGUI_PATH"/build"

#define IMGUI_STATIC_BUILD_DIR      IMGUI_BUILD_DIR"/static"
#define IMGUI_SHARED_BUILD_DIR      IMGUI_BUILD_DIR"/shared"
#define IMGUI_DEBUG_BUILD_DIR       IMGUI_BUILD_DIR"/debug"
#define IMGUI_WEB_BUILD_DIR         IMGUI_BUILD_DIR"/web"

int build_imgui_linux(void) {
  Nob_Cmd cmd = {0};

  NOB_ASSERT(nob_mkdir_if_not_exists(IMGUI_BUILD_DIR));
  NOB_ASSERT(nob_mkdir_if_not_exists(IMGUI_STATIC_BUILD_DIR));
  NOB_ASSERT(nob_mkdir_if_not_exists(IMGUI_SHARED_BUILD_DIR));
  NOB_ASSERT(nob_mkdir_if_not_exists(IMGUI_DEBUG_BUILD_DIR));
  NOB_ASSERT(nob_mkdir_if_not_exists(IMGUI_WEB_BUILD_DIR));

  { // static
    nob_cmd_append(&cmd,
      "g++",
      "-std=c++11",
      "-Wall",
      "-Wextra",
      "-Wno-unused-variable",
      "-Wno-unused-parameter",
      "-Wno-sign-compare",
      "-Wno-missing-braces",
      "-Wno-missing-field-initializers",
      "-g",
      "-O0",
      IMGUI_PATH"/imgui_build.cpp",
      "-lm",
      "-I"IMGUI_PATH,
      "-c",
      "-o",
      IMGUI_STATIC_BUILD_DIR"/imgui.o"
    );
    if(!nob_cmd_run_sync_and_reset(&cmd)) return 0;

    nob_cmd_append(&cmd,
      "ar",
      "rcs",
      IMGUI_STATIC_BUILD_DIR"/libimgui.a",
      IMGUI_STATIC_BUILD_DIR"/imgui.o"
    );
    if(!nob_cmd_run_sync_and_reset(&cmd)) return 0;
  }

  // TODO shared and debug build

  return 1;
}

int build_imgui_win32(void) {
  Nob_Cmd cmd = {0};

  NOB_ASSERT(nob_mkdir_if_not_exists(IMGUI_BUILD_DIR));
  NOB_ASSERT(nob_mkdir_if_not_exists(IMGUI_STATIC_BUILD_DIR));
  NOB_ASSERT(nob_mkdir_if_not_exists(IMGUI_SHARED_BUILD_DIR));
  NOB_ASSERT(nob_mkdir_if_not_exists(IMGUI_DEBUG_BUILD_DIR));
  NOB_ASSERT(nob_mkdir_if_not_exists(IMGUI_WEB_BUILD_DIR));

  { // static
    nob_cmd_append(&cmd,
      "cl.exe",
      "/W4",
      "/wd4100", // unreferenced formal parameter
      "/wd4101", // unreferenced local variable
      "/wd4018", // signed/unsigned mismatch
      "/wd4127", // conditional expression is constant
      "/Zi",
      "/Od",
      "/MT",
      IMGUI_PATH"/imgui_build.cpp",
      "/I"IMGUI_PATH,
      "/c",
      "/Fo"IMGUI_STATIC_BUILD_DIR"/imgui.obj"
    );
    if(!nob_cmd_run_sync_and_reset(&cmd)) return 0;

    nob_cmd_append(&cmd,
      "lib.exe",
      "/OUT:"IMGUI_STATIC_BUILD_DIR"/imgui.lib",
      IMGUI_STATIC_BUILD_DIR"/imgui.obj"
    );
    if(!nob_cmd_run_sync_and_reset(&cmd)) return 0;
  }

  { // dynamic
    nob_cmd_append(&cmd,
      "cl.exe",
      "/W4",
      "/wd4100", // unreferenced formal parameter
      "/wd4101", // unreferenced local variable
      "/wd4018", // signed/unsigned mismatch
      "/wd4127", // conditional expression is constant
      "/Zi",
      "/Od",
      "/MD",
      IMGUI_PATH"/imgui_build.cpp",
      "/I"IMGUI_PATH,
      "/c",
      "/Fo"IMGUI_SHARED_BUILD_DIR"/imgui.obj"
    );
    if(!nob_cmd_run_sync_and_reset(&cmd)) return 0;

    nob_cmd_append(&cmd,
      "lib.exe",
      "/OUT:"IMGUI_SHARED_BUILD_DIR"/imgui.lib",
      IMGUI_SHARED_BUILD_DIR"/imgui.obj"
    );
    if(!nob_cmd_run_sync_and_reset(&cmd)) return 0;
  }

  { // debug dynamic
    nob_cmd_append(&cmd,
      "cl.exe",
      "/W4",
      "/wd4100", // unreferenced formal parameter
      "/wd4101", // unreferenced local variable
      "/wd4018", // signed/unsigned mismatch
      "/wd4127", // conditional expression is constant
      "/Zi",
      "/Od",
      "/MDd",
      IMGUI_PATH"/imgui_build.cpp",
      "/I"IMGUI_PATH,
      "/c",
      "/Fo"IMGUI_DEBUG_BUILD_DIR"/imgui.obj"
    );
    if(!nob_cmd_run_sync_and_reset(&cmd)) return 0;

    nob_cmd_append(&cmd,
      "lib.exe",
      "/OUT:"IMGUI_DEBUG_BUILD_DIR"/imgui.lib",
      IMGUI_DEBUG_BUILD_DIR"/imgui.obj"
    );
    if(!nob_cmd_run_sync_and_reset(&cmd)) return 0;
  }

  return 1;
}

int build_imgui_mac(void) {
  Nob_Cmd cmd = {0};

  NOB_ASSERT(nob_mkdir_if_not_exists(IMGUI_BUILD_DIR));
  NOB_ASSERT(nob_mkdir_if_not_exists(IMGUI_STATIC_BUILD_DIR));
  NOB_ASSERT(nob_mkdir_if_not_exists(IMGUI_SHARED_BUILD_DIR));
  NOB_ASSERT(nob_mkdir_if_not_exists(IMGUI_DEBUG_BUILD_DIR));
  NOB_ASSERT(nob_mkdir_if_not_exists(IMGUI_WEB_BUILD_DIR));

  { // static
    nob_cmd_append(&cmd,
      "clang++",
      "-std=c++11",
      "-Wall",
      "-Wextra",
      "-Wno-unused-variable",
      "-Wno-unused-parameter",
      "-Wno-sign-compare",
      "-Wno-missing-braces",
      "-Wno-missing-field-initializers",
      "-g",
      "-O0",
      IMGUI_PATH"/imgui_build.cpp",
      "-lm",
      "-I"IMGUI_PATH,
      "-c",
      "-o",
      IMGUI_STATIC_BUILD_DIR"/imgui.o"
    );
    if(!nob_cmd_run_sync_and_reset(&cmd)) return 0;

    nob_cmd_append(&cmd,
      "ar",
      "rcs",
      IMGUI_STATIC_BUILD_DIR"/libimgui.a",
      IMGUI_STATIC_BUILD_DIR"/imgui.o"
    );
    if(!nob_cmd_run_sync_and_reset(&cmd)) return 0;
  }

  // TODO shared and debug build

  return 1;
}
