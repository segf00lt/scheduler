#define BASE_IMPORT_STATIC
#define PLATFORM_CORE_IMPORT_STATIC

#include "base/base_include.h"
#include "platform/platform.h"

#include "base/base_include.c"

#if PLATFORM_WINDOWS
#include "platform/platform_core_win32.c"
#elif PLATFORM_MAC
#include "platform/platform_core_mac.c"
#elif PLATFORM_LINUX
#include "platform/platform_core_linux.c"
#endif

#include "third_party/raylib/raylib.h"
#include "third_party/raylib/raymath.h"

#define CLAY_IMPLEMENTATION
#include "third_party/clay-0.14/clay.h"
#include "third_party/clay-0.14/renderers/raylib/clay_renderer_raylib.c"

#include "app/clay_test.c"
