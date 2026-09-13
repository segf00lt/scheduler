#ifndef CLAY_TEST_C
#define CLAY_TEST_C


const uint32_t FONT_ID_BODY_24 = 0;
const uint32_t FONT_ID_BODY_16 = 1;
#define COLOR_ORANGE (Clay_Color) {225, 138, 50, 255}
#define COLOR_BLUE (Clay_Color) {111, 173, 162, 255}

Texture2D profilePicture;
#define RAYLIB_VECTOR2_TO_CLAY_VECTOR2(vector) (Clay_Vector2) { .x = vector.x, .y = vector.y }

typedef struct My_data {
  int i;
  float f;
} My_data;

global int color_index = 0;
global My_data my_data = { .i = 12, .f = 3.1415f };
global Arena *scratch = 0;

internal void
func handle_button_interaction(Clay_ElementId element_id, Clay_PointerData pointer_info, intptr_t data) {
  My_data my_data = *(My_data*)data;
  if(pointer_info.state == CLAY_POINTER_DATA_PRESSED_THIS_FRAME) {
    printf("data = { .i = %d, .f = %f }\n", my_data.i, my_data.f);
    color_index++;
  }

}

internal Clay_ElementDeclaration
func my_button_style(bool hovered) {
  Clay_ElementDeclaration style = {
    .layout = { .padding = { 16, 16, 8, 8 } },
    .backgroundColor = hovered ? COLOR_ORANGE : COLOR_BLUE,
    .cornerRadius = { 8, 8, 8, 8 },
    .border = { .width = CLAY_BORDER_OUTSIDE(0), .color = { 0, 0, 100, 255 } },
  };
  return style;
}

internal void
func handle_my_button_interaction(Clay_ElementId element_id, Clay_PointerData pointer_info, intptr_t data) {
  char *my_data = (char*)data;
  if(pointer_info.state == CLAY_POINTER_DATA_PRESSED_THIS_FRAME) {
    printf("button '%s' was pressed\n", my_data);
  }

}

internal void
func my_button(Clay_String text) {
  CLAY(my_button_style(Clay_Hovered())) {
    Clay_OnHover(&handle_my_button_interaction, (intptr_t)text.chars);
    CLAY_TEXT(text, CLAY_TEXT_CONFIG({ .fontId = 1, .fontSize = 16, .textColor = {0, 0, 0, 255}, .textAlignment = CLAY_TEXT_ALIGN_CENTER }));
  }
}

internal Clay_RenderCommandArray
func my_layout(void) {
  Clay_BeginLayout();


  Clay_Color box_background_color;
  if(color_index & 1) {
    box_background_color = (Clay_Color){ 255, 0, 0, 255 };
  } else {
    box_background_color = (Clay_Color){ 80, 0, 255, 255 };
  }


  CLAY({
    .id = CLAY_ID("outer_container"),
    .layout = {
      .sizing = { .width = CLAY_SIZING_GROW(0), .height = CLAY_SIZING_GROW(0) },
      .layoutDirection = CLAY_TOP_TO_BOTTOM,
      .padding = { 20, 20, 20, 20 },
      .childGap = 10
    },
    .backgroundColor = { 80, 80, 100, 255 },
  }) {

    Clay_TextElementConfig test_text_config = { .fontId = 0, .letterSpacing = 0, .fontSize = 24, .textColor = {0,0,0,255} };


    CLAY_TEXT(CLAY_STRING("Hello World I am Clay!"), &test_text_config);
    CLAY({ .id = CLAY_ID("child"),
      .layout = {
        .sizing = { .width = CLAY_SIZING_FIXED(250), .height = CLAY_SIZING_FIXED(120), },
      },
      .backgroundColor = box_background_color,
    }) {

      Clay_OnHover(&handle_button_interaction, (intptr_t)&my_data);

      bool hovered = Clay_Hovered();
      if(hovered) {
        CLAY_TEXT(CLAY_STRING("I am hovered"), CLAY_TEXT_CONFIG({ .fontId = 0, .letterSpacing = 0, .fontSize = 24, .textColor = {0,0,0,255} }));
      } else {
        CLAY_TEXT(CLAY_STRING("not hovered"), CLAY_TEXT_CONFIG({ .fontId = 0, .letterSpacing = 0, .fontSize = 24, .textColor = {0,0,0,255} }));
      }


    }

    for(int i = 0; i < 10; i++) {
      Str8 text = str8f(scratch, "I am button %d", i);
      Clay_String text_clay = { .length = text.len, .chars = (const char*)text.s };
      my_button(text_clay);
    }

  }

  return Clay_EndLayout();

}

typedef struct
{
    Clay_Vector2 clickOrigin;
    Clay_Vector2 positionOrigin;
    bool mouseDown;
} ScrollbarData;

ScrollbarData scrollbarData = {0};

bool debugEnabled = false;

internal void
func UpdateDrawFrame(Font* fonts) {

  Vector2 mouseWheelDelta = GetMouseWheelMoveV();
  float mouseWheelX = mouseWheelDelta.x;
  float mouseWheelY = mouseWheelDelta.y;

  if (IsKeyPressed(KEY_D)) {
    debugEnabled = !debugEnabled;
    Clay_SetDebugModeEnabled(debugEnabled);
  }

  //----------------------------------------------------------------------------------
  // Handle scroll containers
  Clay_Vector2 mousePosition = RAYLIB_VECTOR2_TO_CLAY_VECTOR2(GetMousePosition());
  Clay_SetPointerState(mousePosition, IsMouseButtonDown(0) && !scrollbarData.mouseDown);
  #if 1
  Clay_SetLayoutDimensions((Clay_Dimensions) { (float)GetScreenWidth(), (float)GetScreenHeight() });
  if (!IsMouseButtonDown(0)) {
    scrollbarData.mouseDown = false;
  }

  if (IsMouseButtonDown(0) && !scrollbarData.mouseDown && Clay_PointerOver(Clay_GetElementId(CLAY_STRING("ScrollBar")))) {
    Clay_ScrollContainerData scrollContainerData = Clay_GetScrollContainerData(Clay_GetElementId(CLAY_STRING("MainContent")));
    scrollbarData.clickOrigin = mousePosition;
    scrollbarData.positionOrigin = *scrollContainerData.scrollPosition;
    scrollbarData.mouseDown = true;
  } else if (scrollbarData.mouseDown) {
    Clay_ScrollContainerData scrollContainerData = Clay_GetScrollContainerData(Clay_GetElementId(CLAY_STRING("MainContent")));
    if (scrollContainerData.contentDimensions.height > 0) {
      Clay_Vector2 ratio = (Clay_Vector2) {
        scrollContainerData.contentDimensions.width / scrollContainerData.scrollContainerDimensions.width,
        scrollContainerData.contentDimensions.height / scrollContainerData.scrollContainerDimensions.height,
      };
      if (scrollContainerData.config.vertical) {
        scrollContainerData.scrollPosition->y = scrollbarData.positionOrigin.y + (scrollbarData.clickOrigin.y - mousePosition.y) * ratio.y;
      }
      if (scrollContainerData.config.horizontal) {
        scrollContainerData.scrollPosition->x = scrollbarData.positionOrigin.x + (scrollbarData.clickOrigin.x - mousePosition.x) * ratio.x;
      }
    }
  }

  Clay_UpdateScrollContainers(true, (Clay_Vector2) {mouseWheelX, mouseWheelY}, GetFrameTime());
  #endif

  // Generate the auto layout for rendering
  double currentTime = GetTime();

  // Clay_RenderCommandArray renderCommands = CreateLayout();
  Clay_RenderCommandArray renderCommands = my_layout();

  // printf("layout time: %f microseconds\n", (GetTime() - currentTime) * 1000 * 1000);

  // RENDERING ---------------------------------
  //    currentTime = GetTime();
  BeginDrawing();
  ClearBackground(BLACK);
  Clay_Raylib_Render(renderCommands, fonts);
  EndDrawing();
  //    printf("render time: %f ms\n", (GetTime() - currentTime) * 1000);

  arena_clear(scratch);

  //----------------------------------------------------------------------------------
}

bool reinitializeClay = false;

void HandleClayErrors(Clay_ErrorData errorData) {
  printf("%s", errorData.errorText.chars);
  if (errorData.errorType == CLAY_ERROR_TYPE_ELEMENTS_CAPACITY_EXCEEDED) {
    reinitializeClay = true;
    Clay_SetMaxElementCount(Clay_GetMaxElementCount() * 2);
  } else if (errorData.errorType == CLAY_ERROR_TYPE_TEXT_MEASUREMENT_CAPACITY_EXCEEDED) {
    reinitializeClay = true;
    Clay_SetMaxMeasureTextCacheWordCount(Clay_GetMaxMeasureTextCacheWordCount() * 2);
  }
}

int main(void) {
  scratch = arena_create(MB(1));
  uint64_t totalMemorySize = Clay_MinMemorySize();
  Clay_Arena clayMemory = Clay_CreateArenaWithCapacityAndMemory(totalMemorySize, platform_alloc(totalMemorySize));

  Clay_Raylib_Initialize(1024, 768, "Clay - Raylib Renderer Example", FLAG_VSYNC_HINT | FLAG_WINDOW_RESIZABLE | FLAG_MSAA_4X_HINT);
  Clay_Initialize(clayMemory, (Clay_Dimensions) { (float)GetScreenWidth(), (float)GetScreenHeight() }, (Clay_ErrorHandler) { HandleClayErrors, 0 });

  profilePicture = LoadTexture("resources/profile-picture.png");

  Font fonts[2];
  fonts[FONT_ID_BODY_24] = LoadFontEx("resources/Roboto-Regular.ttf", 48, 0, 400);
  SetTextureFilter(fonts[FONT_ID_BODY_24].texture, TEXTURE_FILTER_BILINEAR);
  fonts[FONT_ID_BODY_16] = LoadFontEx("resources/Roboto-Regular.ttf", 32, 0, 400);
  SetTextureFilter(fonts[FONT_ID_BODY_16].texture, TEXTURE_FILTER_BILINEAR);
  Clay_SetMeasureTextFunction(Raylib_MeasureText, fonts);

  while(!WindowShouldClose()) {
    if(reinitializeClay) {
      Clay_SetMaxElementCount(8192);
      totalMemorySize = Clay_MinMemorySize();
      clayMemory = Clay_CreateArenaWithCapacityAndMemory(totalMemorySize, platform_alloc(totalMemorySize));
      Clay_Initialize(clayMemory, (Clay_Dimensions) { (float)GetScreenWidth(), (float)GetScreenHeight() }, (Clay_ErrorHandler) { HandleClayErrors, 0 });
      reinitializeClay = false;
    }
    UpdateDrawFrame(fonts);
  }
  Clay_Raylib_Close();
  return 0;
}


#endif
