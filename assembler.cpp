#ifndef ASSEMBLER_C
#define ASSEMBLER_C

/* ================================================================
   Parser helpers
   ================================================================ */

internal b32
func token_is_register(Str8 token) {
  return token.len >= 2 &&
         token.s[0] == 'r' &&
         token.s[1] >= '0' &&
         token.s[1] <= '9';
}


internal u32
func parse_register(Str8 token) {
  ASSERT(token_is_register(token));

  u32 result = 0;

  for(s64 i = 1; i < token.len; i++) {
    ASSERT(token.s[i] >= '0' &&
           token.s[i] <= '9');

    result = result * 10 +
             (u32)(token.s[i] - '0');
  }

  return result;
}


internal u32
func parse_immediate(Str8 token) {
  u32 result = 0;
  s64 at = 0;

  /*
     Base 0 semantics, like strtoul:

       123     -> decimal
       0123    -> octal
       0x123   -> hexadecimal
    */
  u32 base = 10;

  if(token.len >= 2 &&
     token.s[0] == '0' &&
     (token.s[1] == 'x' ||
      token.s[1] == 'X')) {

    base = 16;
    at = 2;
  }
  else if(token.len >= 2 &&
          token.s[0] == '0') {

    base = 8;
    at = 1;
  }

  for(; at < token.len; at++) {
    u8 c = token.s[at];
    u32 digit;

    if(c >= '0' && c <= '9') {
      digit = c - '0';
    }
    else if(c >= 'a' && c <= 'f') {
      digit = c - 'a' + 10;
    }
    else if(c >= 'A' && c <= 'F') {
      digit = c - 'A' + 10;
    }
    else {
      break;
    }

    ASSERT(digit < base);

    result = result * base + digit;
  }

  return result;
}


/*
   A Str8 cursor.

   `s` points at the current character.
   `len` is the number of characters remaining.
*/

internal void
func skip_whitespace(Str8 *at) {
  while(at->len > 0 &&
        (at->s[0] == ' ' ||
         at->s[0] == '\t' ||
         at->s[0] == '\r')) {

    at->s++;
    at->len--;
  }
}


internal void
func skip_line(Str8 *at) {
  while(at->len > 0 &&
        at->s[0] != '\n') {

    at->s++;
    at->len--;
  }

  if(at->len > 0 &&
     at->s[0] == '\n') {

    at->s++;
    at->len--;
  }
}


internal Str8
func parse_token(Str8 *at) {
  skip_whitespace(at);

  u8 *start = at->s;

  while(at->len > 0 &&
        at->s[0] != ' ' &&
        at->s[0] != '\t' &&
        at->s[0] != '\r' &&
        at->s[0] != '\n' &&
        at->s[0] != ',') {

    at->s++;
    at->len--;
  }

  Str8 result;
  result.s = start;
  result.len = (s64)(at->s - start);

  return result;
}


internal void
func skip_comma(Str8 *at) {
  skip_whitespace(at);

  if(at->len > 0 &&
     at->s[0] == ',') {

    at->s++;
    at->len--;
  }

  skip_whitespace(at);
}


internal Label *
func find_label(Label *labels, u32 label_count, Str8 name) {

  for(u32 i = 0; i < label_count; i++) {
    Label *label = &labels[i];

    if(label->name.len != name.len) {
      continue;
    }

    if(memcmp(label->name.s,
              name.s,
              name.len) == 0) {

      return label;
    }
  }

  return 0;
}


/* ================================================================
   First pass
   ================================================================ */

internal u32
func count_instructions(Str8 source) {
  Str8 at = source;

  u32 count = 0;

  while(at.len > 0) {
    skip_whitespace(&at);

    if(at.len == 0) {
      break;
    }

    if(at.s[0] == '\n') {
      at.s++;
      at.len--;
      continue;
    }

    if(at.s[0] == ';') {
      skip_line(&at);
      continue;
    }

    Str8 token = parse_token(&at);

    /*
       A label doesn't produce an instruction.

           loop:
    */
    if(token.len > 0 &&
       token.s[token.len - 1] == ':') {

      skip_line(&at);
      continue;
    }

    count++;

    skip_line(&at);
  }

  return count;
}


/* ================================================================
   Collect labels
   ================================================================ */

internal u32
func collect_labels(Arena *arena, Str8 source, Label *labels) {

  Str8 at = source;

  u32 label_count = 0;
  u32 pc = 0;

  while(at.len > 0) {
    skip_whitespace(&at);

    if(at.len == 0) {
      break;
    }

    if(at.s[0] == '\n') {
      at.s++;
      at.len--;
      continue;
    }

    if(at.s[0] == ';') {
      skip_line(&at);
      continue;
    }

    Str8 token = parse_token(&at);

    if(token.len > 0 &&
       token.s[token.len - 1] == ':') {

      /*
         Remove ':' from the label.
      */
      token.len--;

      /*
         Copy the label name into the arena.
      */
      Str8 name = {
        push_array(arena, u8, token.len),
        token.len
      };

      memcpy(name.s, token.s, token.len);

      labels[label_count].name = name;
      labels[label_count].pc = pc;

      label_count++;

      skip_line(&at);
      continue;
    }

    pc++;

    skip_line(&at);
  }

  return label_count;
}


/* ================================================================
   Assembler
   ================================================================ */

internal Inst *
func assemble(Arena *arena, Str8 source, u32 *inst_count_out) {

  /*
     First pass.

     Count instructions so that we can allocate the exact
     amount of memory required for the final instruction array.
  */
  u32 instruction_count =
    count_instructions(source);

  /*
     Allocate the label table from the arena too.
  */
  u32 max_labels = instruction_count + 1;

  Label *labels = push_array(
    arena,
    Label,
    max_labels
  );

  u32 label_count = collect_labels(
    arena,
    source,
    labels
  );

  /*
     Allocate the final instruction array.
  */
  Inst *instructions = push_array(
    arena,
    Inst,
    instruction_count
  );

  /*
     Second pass.
  */
  Str8 at = source;

  u32 pc = 0;

  while(at.len > 0) {
    skip_whitespace(&at);

    if(at.len == 0) {
      break;
    }

    if(at.s[0] == '\n') {
      at.s++;
      at.len--;
      continue;
    }

    if(at.s[0] == ';') {
      skip_line(&at);
      continue;
    }

    Str8 op = parse_token(&at);

    /*
       Labels don't generate instructions.
    */
    if(op.len > 0 &&
       op.s[op.len - 1] == ':') {

      skip_line(&at);
      continue;
    }

    Inst inst = {};


    /* ============================================================
       goto label
       ============================================================ */

    if(str8_match_lit("goto", op)) {

      Str8 target = parse_token(&at);

      Label *label = find_label(
        labels,
        label_count,
        target
      );

      if(!label) {
        printf(
          "error: unknown label '%.*s'\n",
          (int)target.len,
          target.s
        );

        exit(1);
      }

      inst.opcode = OP_GOTO;
      inst.imm = label->pc;
    }


    /* ============================================================
       ifgoto r0, label
       ============================================================ */

    else if(str8_match_lit("ifgoto", op)) {

      Str8 condition = parse_token(&at);

      skip_comma(&at);

      Str8 target = parse_token(&at);

      Label *label = find_label(
        labels,
        label_count,
        target
      );

      if(!label) {
        printf(
          "error: unknown label '%.*s'\n",
          (int)target.len,
          target.s
        );

        exit(1);
      }

      inst.opcode = OP_IFGOTO;
      inst.ra = (u8)parse_register(condition);
      inst.imm = label->pc;
    }


    /* ============================================================
       add/sub/mul/div/lt/gte

       add r0, r1, r2
       ============================================================ */

    else if(str8_match_lit("add", op) ||
            str8_match_lit("sub", op) ||
            str8_match_lit("mul", op) ||
            str8_match_lit("div", op) ||
            str8_match_lit("lt", op)  ||
            str8_match_lit("gte", op)) {

      Str8 a = parse_token(&at);

      skip_comma(&at);

      Str8 b = parse_token(&at);

      skip_comma(&at);

      Str8 c = parse_token(&at);

      inst.ra = (u8)parse_register(a);
      inst.rb = (u8)parse_register(b);
      inst.rc = (u8)parse_register(c);

      if(str8_match_lit("add", op)) {
        inst.opcode = OP_ADD;
      }
      else if(str8_match_lit("sub", op)) {
        inst.opcode = OP_SUB;
      }
      else if(str8_match_lit("mul", op)) {
        inst.opcode = OP_MUL;
      }
      else if(str8_match_lit("div", op)) {
        inst.opcode = OP_DIV;
      }
      else if(str8_match_lit("lt", op)) {
        inst.opcode = OP_LT;
      }
      else if(str8_match_lit("gte", op)) {
        inst.opcode = OP_GTE;
      }
    }


    /* ============================================================
       load/store/mov

       load  r0, r1
       store r0, r1
       mov   r0, r1
       ============================================================ */

    else if(str8_match_lit("load", op) ||
            str8_match_lit("store", op) ||
            str8_match_lit("mov", op)) {

      Str8 a = parse_token(&at);

      skip_comma(&at);

      Str8 b = parse_token(&at);

      inst.ra = (u8)parse_register(a);
      inst.rb = (u8)parse_register(b);

      if(str8_match_lit("load", op)) {
        inst.opcode = OP_LOAD;
      }
      else if(str8_match_lit("store", op)) {
        inst.opcode = OP_STORE;
      }
      else {
        inst.opcode = OP_REGMOV;
      }
    }


    /* ============================================================
       set

       set r0, 123
       set r0, 0x100
       ============================================================ */

    else if(str8_match_lit("set", op)) {

      Str8 a = parse_token(&at);

      skip_comma(&at);

      Str8 b = parse_token(&at);

      inst.opcode = OP_REGSETIMM;
      inst.ra = (u8)parse_register(a);
      inst.imm = parse_immediate(b);
    }

    else if(str8_match_lit("input", op)) {

      Str8 a = parse_token(&at);

      inst.opcode = OP_INPUT;
      inst.ra = (u8)parse_register(a);
    }

    /* ============================================================
       print

       print r0
       ============================================================ */

    else if(str8_match_lit("print", op)) {

      Str8 a = parse_token(&at);

      inst.opcode = OP_PRINT;
      inst.ra = (u8)parse_register(a);
    }


    /* ============================================================
       Unknown instruction
       ============================================================ */

    else {
      printf(
        "error: unknown instruction '%.*s'\n",
        (int)op.len,
        op.s
      );

      exit(1);
    }

    instructions[pc++] = inst;

    skip_line(&at);
  }

  *inst_count_out = pc;

  return instructions;
}


#endif
