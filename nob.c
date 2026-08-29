#define NOB_IMPLEMENTATION
#include "nob.h"

#include "third_party/raylib/nob_raylib.c"

int win32_build(void) {
  Nob_Cmd cmd = {0};
  nob_cmd_append(&cmd,
    "cl",
    "/TP",
    "/nologo",
    "/W4",
    "/wd4100",
    "/wd4201",
    "/wd4459",
    "/wd4477",
    "/wd4063",
    "/wd4456",
    "/wd4244",
    "/wd4146",
    "/wd4267",
    "/Zi",
    "/Od",
    "/MDd",
    "/c",
    "/Fo:scheduler.obj",
    "/FS",
    "scheduler_build.cpp",
    ""
  );
  Nob_Proc nob_proc = nob_cmd_run_async_and_reset(&cmd);

  nob_cmd_append(&cmd,
    "cl",
    "/nologo",
    "/W4",
    "/wd4100",
    "/wd4201",
    "/wd4459",
    "/wd4477",
    "/wd4063",
    "/wd4456",
    "/wd4244",
    "/wd4146",
    "/wd4267",
    "/Zi",
    "/Od",
    "/MDd",
    "/c",
    "base_build.c",
    "/Fo:base.obj",
    "/FS",
    ""
  );

  if(!nob_cmd_run_sync_and_reset(&cmd)) return 0;

  if(!nob_proc_wait(nob_proc)) return 0;

  nob_cmd_append(&cmd,
    "cl",
    "/nologo",
    "/Fe:scheduler.exe",
    "scheduler.obj",
    "base_build.obj",
    "user32.lib",
    "dxguid.lib",
    "winmm.lib",
    "ole32.lib",
    "/link",
    "/DEBUG",
    "/INCREMENTAL:NO",
    ""
  );
  if(!nob_cmd_run_sync_and_reset(&cmd)) return 0;

  return 1;
}

int linux_build(void) {
    Nob_Cmd cmd = {0};

    nob_cmd_append(&cmd,
        "g++",
        "-std=c++11",
        "-Wall",
        "-Wextra",
        "-Wno-type-limits",
        "-Wno-unused-variable",
        "-Wno-write-strings",
        "-fpermissive",
        "-g",
        "-O0",
        "-c",
        "scheduler_build.cpp",
        "-o",
        "scheduler.o"
    );
    if(!nob_cmd_run_sync_and_reset(&cmd)) return 0;

    nob_cmd_append(&cmd,
        "gcc",
        "-std=c11",
        "-Wall",
        "-Wextra",
        "-Wno-unused-variable",
        "-g",
        "-O0",
        "-c",
        "base_build.c",
        "-o",
        "base.o"
    );
    if(!nob_cmd_run_sync_and_reset(&cmd)) return 0;

    nob_cmd_append(&cmd,
        "g++",
        "-g",
        "-O0",
        "scheduler.o",
        "base.o",
        "-o",
        "scheduler"
    );
    if(!nob_cmd_run_sync_and_reset(&cmd)) return 0;

    return 1;
}

int main(int argc, char **argv) {
  NOB_GO_REBUILD_URSELF(argc, argv);

  if(!linux_build()) return 1;

  return 0;
  if(!win32_build()) return 1;
  if(!build_raylib_win32()) return 1;


  return 0;
}

