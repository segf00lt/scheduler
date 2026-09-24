
#ifndef NOB_IMPLEMENTATION

#define NOB_IMPLEMENTATION
#include "nob.h"

#endif

#define IMGUI_PATH "./src/third_party/imgui-1.92.7"


int build_imgui_linux(void) {
  Nob_Cmd cmd = {0};

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
    IMGUI_PATH"/imgui.o"
  );
  if(!nob_cmd_run_sync_and_reset(&cmd)) return 0;

  nob_cmd_append(&cmd,
    "ar",
    "rcs",
    IMGUI_PATH"/libimgui.a",
    IMGUI_PATH"/imgui.o"
  );
  if(!nob_cmd_run_sync_and_reset(&cmd)) return 0;

  return 1;
}
