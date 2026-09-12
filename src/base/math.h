#ifndef BASE_MATH_H
#define BASE_MATH_H

#define TYPEDEF_VEC2(T) typedef struct v2_##T { T x; T y; } v2_##T;
#define TYPEDEF_VEC3(T) typedef struct v3_##T { T x; T y; T z; } v3_##T;

#define PI 3.14159265358979323846f


// TODO jfd 12/09/26: This needs to be simpler
#if defined(BASE_EXPORT) || defined(BASE_IMPORT) || defined(BASE_EXPORT_STATIC) || defined(BASE_IMPORT_STATIC)
#undef force_inline
#define force_inline
#endif

TYPEDEF_VEC2(s8);
TYPEDEF_VEC2(s16);
TYPEDEF_VEC2(s32);
TYPEDEF_VEC2(s64);

TYPEDEF_VEC2(u8);
TYPEDEF_VEC2(u16);
TYPEDEF_VEC2(u32);
TYPEDEF_VEC2(u64);

TYPEDEF_VEC2(f32);
TYPEDEF_VEC2(f64);

typedef v2_f32 v2;

TYPEDEF_VEC3(s8);
TYPEDEF_VEC3(s16);
TYPEDEF_VEC3(s32);
TYPEDEF_VEC3(s64);

TYPEDEF_VEC3(u8);
TYPEDEF_VEC3(u16);
TYPEDEF_VEC3(u32);
TYPEDEF_VEC3(u64);

TYPEDEF_VEC3(f32);
TYPEDEF_VEC3(f64);

typedef v3_f32 v3;

typedef struct v4 v4;
struct v4 {
  f32 x;
  f32 y;
  f32 z;
  f32 w;
};

base_api force_inline f32 exponential_moving_average(f32 avg, f32 sample, f32 coefficient);

base_api force_inline f32 floor_f32(f32 f);

base_api force_inline f64 floor_f64(f64 f);
base_api force_inline f32 round_f32(f32 f);

base_api force_inline s32 round_f32_to_s32(f32 value);
base_api force_inline f32 max_f32(f32 a, f32 b);
base_api force_inline f32 abs_f32(f32 x);
base_api force_inline f32 lerp_f32(f32 t, f32 begin, f32 end);
base_api force_inline f32 wrap_f32(f32 value, f32 min, f32 max);
base_api force_inline f32 sqrt_f32(f32 f);

base_api force_inline v2 truncate_v2(v2 v);
base_api force_inline v2 wrap_v2(v2 v, v2 min, v2 max);
base_api force_inline v2 max_v2(v2 a, v2 b);
base_api force_inline v2 abs_v2(v2 v);

base_api force_inline v2  add_v2(v2 a, v2 b);
base_api force_inline v2  sub_v2(v2 a, v2 b);
base_api force_inline v2  mul_v2(v2 a, v2 b);
base_api force_inline f32 dot_v2(v2 a, v2 b);
base_api force_inline f32 len_sq_v2(v2 v);
base_api force_inline f32 len_v2(v2 v);
base_api force_inline v2  norm_v2(v2 v);
base_api force_inline v2  div_v2(v2 a, v2 b);
base_api force_inline v2  scale_v2(v2 v, f32 a);
base_api force_inline v2  lt_v2(v2 a, v2 b);
base_api force_inline v2  gte_v2(v2 a, v2 b);
base_api force_inline v2  lte_v2(v2 a, v2 b);
base_api force_inline v2  gt_v2(v2 a, v2 b);
base_api force_inline v2  add_value_v2(v2 v, f32 a);
base_api force_inline v2  round_v2(v2 v);

base_api force_inline v2_s16 add_v2_s16(v2_s16 a, v2_s16 b);
base_api force_inline v2_s16 sub_v2_s16(v2_s16 a, v2_s16 b);
base_api force_inline v2_s16 mul_v2_s16(v2_s16 a, v2_s16 b);
base_api force_inline s16    dot_v2_s16(v2_s16 a, v2_s16 b);
base_api force_inline v2_s16 div_v2_s16(v2_s16 a, v2_s16 b);
base_api force_inline v2_s16 scale_v2_s16(v2_s16 v, s16 a);
base_api force_inline v2_s16 lt_v2_s16(v2_s16 a, v2_s16 b);
base_api force_inline v2_s16 gte_v2_s16(v2_s16 a, v2_s16 b);
base_api force_inline v2_s16 lte_v2_s16(v2_s16 a, v2_s16 b);
base_api force_inline v2_s16 gt_v2_s16(v2_s16 a, v2_s16 b);
base_api force_inline v2_s16 add_value_v2_s16(v2_s16 v, s16 a);

base_api force_inline v2_s32 add_v2_s32(v2_s32 a, v2_s32 b);
base_api force_inline v2_s32 sub_v2_s32(v2_s32 a, v2_s32 b);
base_api force_inline v2_s32 mul_v2_s32(v2_s32 a, v2_s32 b);
base_api force_inline s32    dot_v2_s32(v2_s32 a, v2_s32 b);
base_api force_inline v2_s32 div_v2_s32(v2_s32 a, v2_s32 b);
base_api force_inline v2_s32 scale_v2_s32(v2_s32 v, s32 a);
base_api force_inline v2_s32 lt_v2_s32(v2_s32 a, v2_s32 b);
base_api force_inline v2_s32 gte_v2_s32(v2_s32 a, v2_s32 b);
base_api force_inline v2_s32 lte_v2_s32(v2_s32 a, v2_s32 b);
base_api force_inline v2_s32 gt_v2_s32(v2_s32 a, v2_s32 b);
base_api force_inline v2_s32 add_value_v2_s32(v2_s32 v, s32 a);

base_api force_inline v2_u32 add_v2_u32(v2_u32 a, v2_u32 b);
base_api force_inline v2_u32 sub_v2_u32(v2_u32 a, v2_u32 b);
base_api force_inline v2_u32 mul_v2_u32(v2_u32 a, v2_u32 b);
base_api force_inline u32    dot_v2_u32(v2_u32 a, v2_u32 b);
base_api force_inline v2_u32 div_v2_u32(v2_u32 a, v2_u32 b);
base_api force_inline v2_u32 scale_v2_u32(v2_u32 v, u32 a);
base_api force_inline v2_u32 lt_v2_u32(v2_u32 a, v2_u32 b);
base_api force_inline v2_u32 gte_v2_u32(v2_u32 a, v2_u32 b);
base_api force_inline v2_u32 lte_v2_u32(v2_u32 a, v2_u32 b);
base_api force_inline v2_u32 gt_v2_u32(v2_u32 a, v2_u32 b);
base_api force_inline v2_u32 add_value_v2_u32(v2_u32 v, u32 a);

base_api force_inline v2_s32 cast_v2_f32_to_s32(v2 v);
base_api force_inline v2_u32 cast_v2_f32_to_u32(v2 v);
base_api force_inline v2     cast_v2_u32_to_f32(v2_u32 v);
base_api force_inline v2     cast_v2_s32_to_f32(v2_s32 v);
base_api force_inline v2_s32 cast_v2_u32_to_s32(v2_u32 v);

#if defined(BASE_EXPORT) || defined(BASE_IMPORT) || defined(BASE_EXPORT_STATIC) || defined(BASE_IMPORT_STATIC)
#undef force_inline
#define force_inline _force_inline
#endif

#endif
