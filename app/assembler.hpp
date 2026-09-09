#ifndef ASSEMBLER_H
#define ASSEMBLER_H

typedef struct Label {
  Str8 name;
  u32 pc;
} Label;

internal b32 token_is_register(Str8 token);

internal u32 parse_register(Str8 token);

internal u32 parse_immediate(Str8 token);

internal void skip_whitespace(Str8 *at);

internal void skip_line(Str8 *at);

internal Str8 parse_token(Str8 *at);

internal void skip_comma(Str8 *at);

internal Label * find_label(Label *labels, u32 label_count, Str8 name);

internal u32 count_instructions(Str8 source);

internal u32 collect_labels(Arena *arena, Str8 source, Label *labels);

internal Inst * assemble(Arena *arena, Str8 source, u32 *inst_count_out);

#endif
