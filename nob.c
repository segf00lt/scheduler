#define NOB_IMPLEMENTATION
#include "nob.h"

#include "third_party/raylib/nob_raylib.c"


# if defined(_WIN32)
#  define PLATFORM_WINDOWS 1
# elif defined(__gnu_linux__) || defined(__linux__)
#  define PLATFORM_LINUX 1
# elif defined(__APPLE__) && defined(__MACH__)
#  define PLATFORM_MAC 1
# else
#  error This compiler/OS combo is not supported.
# endif

int win32_build(void) {
  nob_log(NOB_INFO, "windows build");

  nob_delete_file("scheduler.obj");
  nob_delete_file("scheduler.lib");
  nob_delete_file("scheduler.pdb");

  nob_delete_file("base.obj");

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
  nob_log(NOB_INFO, "linux build");

  Nob_Cmd cmd = {0};

  nob_cmd_append(&cmd,
    "g++",
    "-std=c++11",
    "-Wall",
    "-Wextra",
    "-Wno-type-limits",
    "-Wno-unused-variable",
    "-Wno-write-strings",
    "-Wno-missing-field-initializers",
    "-fpermissive",
    "-g",
    "-O0",
    "-c",
    "scheduler_build.cpp",
    "-o",
    "scheduler.o"
  );
  Nob_Proc nob_proc = nob_cmd_run_async_and_reset(&cmd);

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

  if(!nob_proc_wait(nob_proc)) return 0;

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

  if(argc == 1) {
    #if PLATFORM_LINUX
    if(!linux_build()) return 1;
    #elif PLATFORM_WINDOWS
    if(!win32_build()) return 1;
    #elif PLATFORM_MAC
    UNIMPLEMENTED;
    #endif
    return 0;
  }

  if(!strcmp("linux", argv[1])) {
    if(!linux_build()) return 1;
  } else if(!strcmp("windows", argv[1])) {
    if(!win32_build()) return 1;
  }

  return 0;

  if(!build_raylib_win32()) return 1;


  return 0;
}

