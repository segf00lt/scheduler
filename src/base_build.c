
#define BASE_EXPORT_STATIC
#define PLATFORM_CORE_EXPORT_STATIC

#include "base/base_include.h"
#include "platform/platform.h"

#include "base/base_include.c"
#include "platform/platform.c"

#if PLATFORM_WINDOWS
#include "platform/platform_core_win32.c"
#elif PLATFORM_MAC
#include "platform/platform_core_mac.c"
#elif PLATFORM_LINUX
#include "platform/platform_core_linux.c"
#endif
