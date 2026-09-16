#ifndef STR_H
#define STR_H

typedef struct Str8 Str8;
struct Str8 {
  u8 *s;
  s64 len;
};

typedef struct Str16 Str16;
struct Str16 {
  u16 *s;
  s64 len;
};

typedef struct Str8_node Str8_node;
struct Str8_node {
  Str8 str;
  Str8_node *next;
};

typedef struct Str8_list Str8_list;
struct Str8_list {
  Str8_node *first;
  Str8_node *last;
  s64 count;
  s64 total_len;
};

typedef struct Str8_find_results Str8_find_results;
struct Str8_find_results {
  s64 *begin_indexes;
  s64 *end_indexes;
  s64 count;
};

typedef struct Str8_array Str8_array;
struct Str8_array {
  Str8 *d;
  s64 count;
  s64 cap;
  Arena *arena;
};

typedef struct Str8_slice Str8_slice;
struct Str8_slice {
  Str8 *d;
  s64 count;
};

#if LANG_CPP
internal force_inline Str8
func _str8_lit_helper(u8 *s, s64 len) {
  Str8 result = {0};
  result.s = s;
  result.len = len;
  return result;
}

#define str8_lit(strlit) _str8_lit_helper((u8*)strlit, CLAMP_BOT((s64)(sizeof(strlit) - (s64)1), (s64)0))

#else
#define str8_lit(strlit) ((Str8){ .s = (u8*)strlit, .len = CLAMP_BOT((s64)(sizeof(strlit) - (s64)1), (s64)0) })

#endif




#define str8_match_lit(a_lit, b) str8_match(str8_lit(a_lit), b)
base_api b32 str8_match(Str8 a_str, Str8 b_str);
base_api b32 str8_starts_with(Str8 str, Str8 start);
base_api b32 str8_ends_with(Str8 str, Str8 end);
base_api b32 str8_contains(Str8 str, Str8 substr);
base_api s64 str8_find(Str8 haystack, Str8 needle);
base_api s64 str8_find_char(Str8 haystack, u8 needle);
base_api s64 str8_find_first_whitespace(Str8 haystack);

base_api Str8_find_results str8_find_all_chars(Arena *scratch, Str8 haystack, u8 needle, Arena *output_arena);
base_api Str8_find_results str8_find_all(Arena *scratch, Str8 haystack, Str8 needle, Arena *output_arena);

base_api Str8 str8_cat(Arena *a, Str8 str1, Str8 str2);

base_api Str8 str8_escaped(Arena *a, Str8 str);

base_api b32 str8_is_cident(Str8 str);
base_api b32 str8_is_alpha(Str8 str);
base_api b32 str8_is_numeric(Str8 str, int base);
base_api b32 str8_is_decimal(Str8 str);

base_api Str8 str8_match_begin_int(Str8 str, int base);
base_api Str8 str8_match_begin_float(Str8 str);

base_api u64 str8_parse_int(Str8 str, int base);
base_api u64 str8_parse_int_decimal(Str8 str);
base_api u64 str8_parse_int_binary(Str8 str);
base_api u64 str8_parse_int_hex(Str8 str);

base_api f64 str8_parse_float(Str8 str);

base_api Str8 str8_to_upper(Arena *a, Str8 str);
base_api Str8 str8_to_lower(Arena *a, Str8 str);

base_api Str8 str8_slice(Str8 str, s64 begin, s64 end);

base_api Str8 str8_get_line(Str8 str, s64 start_pos);

base_api Str8 str8_get_line_no_strip(Str8 str, s64 start_pos);
base_api Str8 str8_strip_whitespace(Str8 str);

#define is_space(c) (!!('\0' < (c) && (c) <= ' '))
#define is_upper(c) (!!('A' <= (c) && (c) <= 'Z'))
#define is_lower(c) (!!('a' <= (c) && (c) <= 'z'))
#define to_lower(c) (is_upper(c) ? ((c) - 'A' + 'a') : (c))
#define to_upper(c) (is_lower(c) ? ((c) - 'a' + 'A') : (c))
#define is_alpha(c) ('a' <= to_lower(c) && to_lower(c) <= 'z')
#define is_decimal(c) (!!('0' <= (c) && (c) <= '9'))
#define is_hex(c) (!!(is_decimal(c) || ('a' <= to_lower(c) && to_lower(c) <= 'f') ))
#define is_binary(c) (!!((c) == '1' || (c) == '0'))
#define letter_index(c) ((s64)(to_lower(c) - 'a'))
#define hexdigit_to_int(c) ((s64)(is_alpha(c) ? (to_lower(c) - 'a' + 0xa) : (c - '0')))

#define str8_split_by_chars_lit(a, str, sep_chars_lit) str8_split_by_chars(a, str, (u8*)sep_chars_lit, (s64)sizeof(sep_chars_lit))
#define str8_split_by_string_lit(a, str, sep) str8_split_by_string(a, str, str8_lit(sep))
base_api Str8_list str8_split_by_string(Arena *a, Str8 str, Str8 sep);
base_api Str8_list str8_split_by_chars(Arena *a, Str8 str, u8 *sep_chars, s64 n_sep_chars);
base_api Str8_list str8_split_by_char(Arena *a, Str8 str, u8 sep_char);

base_api Str8 str8_cstr_capped(void *cstr, void *cap);

base_api Str8 str8_chop_last_slash(Str8 str);

#define str8_list_append_node(list, node) str8_list_append_node_(&(list), node)
base_api void str8_list_append_node_(Str8_list *list, Str8_node *node);

base_api void str8_list_append_str(Arena *a, Str8_list *list, Str8 str);

base_api Str8 str8_list_join(Arena *a, Str8_list list, Str8 sep);

base_api Str8_list str8_list_copy(Arena *a, Str8_list list);

base_api Str8  str8_copy(Arena *a, Str8 str);
base_api Str8  str8_from_cstr(Arena *a, char *cstr);
base_api Str8  str8fv(Arena *a, char *fmt, va_list args);
base_api Str8  str8f(Arena *a, char *fmt, ...);
base_api char* cstr_from_str8(Arena *a, Str8 str);
base_api char* cstrf(Arena *a, char *fmt, ...);

base_api void str8_list_insert_first_str(Arena *a, Str8_list *list, Str8 str);

#endif
