typedef struct Label {
  char *name;
  u32 pc;
} Label;


internal char *skip_whitespace(char *at);
internal char *skip_line(char *at);
internal char *parse_token(char *at, char *out, u32 out_size);
internal char *skip_comma(char *at);

internal b32 token_equals(char *a, char *b);
internal b32 token_is_register(char *token);

internal u32 parse_register(char *token);
internal u32 parse_immediate(char *token);

internal Label *find_label(Label *labels, u32 label_count, char *name);

internal u32 count_instructions(char *source);
internal u32 collect_labels(
  Arena *arena,
  char *source,
  Label *labels
);

internal Inst *assemble(
  Arena *arena,
  char *source,
  u32 *inst_count_out
);


/* ================================================================
   Parser helpers
   ================================================================ */

internal char *
skip_whitespace(char *at) {
  while(*at == ' ' ||
        *at == '\t' ||
        *at == '\r') {
    at++;
  }

  return at;
}


internal char *
skip_line(char *at) {
  while(*at && *at != '\n') {
    at++;
  }

  if(*at == '\n') {
    at++;
  }

  return at;
}


internal char *
parse_token(char *at, char *out, u32 out_size) {
  at = skip_whitespace(at);

  u32 len = 0;

  while(*at &&
        *at != ' ' &&
        *at != '\t' &&
        *at != '\r' &&
        *at != '\n' &&
        *at != ',') {

    if(len + 1 < out_size) {
      out[len++] = *at;
    }

    at++;
  }

  out[len] = 0;

  return at;
}


internal char *
skip_comma(char *at) {
  at = skip_whitespace(at);

  if(*at == ',') {
    at++;
  }

  return skip_whitespace(at);
}


internal b32
token_equals(char *a, char *b) {
  return strcmp(a, b) == 0;
}


internal b32
token_is_register(char *token) {
  return token[0] == 'r' &&
         token[1] >= '0' &&
         token[1] <= '9';
}


internal u32
parse_register(char *token) {
  ASSERT(token_is_register(token));

  return (u32)strtoul(token + 1, 0, 10);
}


internal u32
parse_immediate(char *token) {
  return (u32)strtoul(token, 0, 0);
}


internal Label *
find_label(Label *labels, u32 label_count, char *name) {
  for(u32 i = 0; i < label_count; i++) {
    if(strcmp(labels[i].name, name) == 0) {
      return &labels[i];
    }
  }

  return 0;
}


/* ================================================================
   First pass
   ================================================================ */

internal u32
count_instructions(char *source) {
  char *at = source;
  u32 count = 0;

  while(*at) {
    at = skip_whitespace(at);

    if(*at == 0) {
      break;
    }

    if(*at == '\n') {
      at++;
      continue;
    }

    if(*at == ';') {
      at = skip_line(at);
      continue;
    }

    char token[64];
    at = parse_token(at, token, sizeof(token));

    u32 len = (u32)strlen(token);

    /*
       A label doesn't produce an instruction.

           loop:
    */
    if(len > 0 && token[len - 1] == ':') {
      at = skip_line(at);
      continue;
    }

    count++;

    at = skip_line(at);
  }

  return count;
}


/* ================================================================
   Collect labels
   ================================================================ */

internal u32
collect_labels(
  Arena *arena,
  char *source,
  Label *labels
) {
  char *at = source;

  u32 label_count = 0;
  u32 pc = 0;

  while(*at) {
    at = skip_whitespace(at);

    if(*at == 0) {
      break;
    }

    if(*at == '\n') {
      at++;
      continue;
    }

    if(*at == ';') {
      at = skip_line(at);
      continue;
    }

    char token[64];
    at = parse_token(at, token, sizeof(token));

    u32 len = (u32)strlen(token);

    if(len > 0 && token[len - 1] == ':') {

      token[len - 1] = 0;

      /*
         Allocate the label name from the arena.

         We copy the temporary token because `token` is
         a stack buffer that will disappear after this iteration.
      */
      u32 name_len = (u32)strlen(token);

      char *name = (char *)arena_push(
        arena,
        name_len + 1,
        1
      );

      memcpy(name, token, name_len + 1);

      labels[label_count].name = name;
      labels[label_count].pc = pc;

      label_count++;

      at = skip_line(at);
      continue;
    }

    pc++;

    at = skip_line(at);
  }

  return label_count;
}


/* ================================================================
   Assembler
   ================================================================ */

internal Inst *
assemble(
  Arena *arena,
  char *source,
  u32 *inst_count_out
) {
  /*
     First pass.

     Count instructions so that we can allocate the exact
     amount of memory required for the final instruction array.
  */
  u32 instruction_count = count_instructions(source);

  /*
     Allocate the label table from the arena too.

     This is intentionally a generous limit for now. If you
     eventually want an unlimited assembler, this can become
     a growable arena array.
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
     Allocate the final instruction array from the arena.
  */
  Inst *instructions = push_array(
    arena,
    Inst,
    instruction_count
  );

  /*
     Second pass.
  */
  char *at = source;
  u32 pc = 0;

  while(*at) {
    at = skip_whitespace(at);

    if(*at == 0) {
      break;
    }

    if(*at == '\n') {
      at++;
      continue;
    }

    if(*at == ';') {
      at = skip_line(at);
      continue;
    }

    char op[64];
    at = parse_token(at, op, sizeof(op));

    u32 op_len = (u32)strlen(op);

    /*
       Labels don't generate instructions.
    */
    if(op_len > 0 && op[op_len - 1] == ':') {
      at = skip_line(at);
      continue;
    }

    Inst inst = {};


    /* ============================================================
       goto label
       ============================================================ */

    if(token_equals(op, "goto")) {

      char target[64];

      at = parse_token(
        at,
        target,
        sizeof(target)
      );

      Label *label = find_label(
        labels,
        label_count,
        target
      );

      if(!label) {
        printf(
          "error: unknown label '%s'\n",
          target
        );

        exit(1);
      }

      inst.opcode = OP_GOTO;
      inst.imm = label->pc;
    }


    /* ============================================================
       ifgoto r0, label
       ============================================================ */

    else if(token_equals(op, "ifgoto")) {

      char condition[64];
      char target[64];

      at = parse_token(
        at,
        condition,
        sizeof(condition)
      );

      at = skip_comma(at);

      at = parse_token(
        at,
        target,
        sizeof(target)
      );

      Label *label = find_label(
        labels,
        label_count,
        target
      );

      if(!label) {
        printf(
          "error: unknown label '%s'\n",
          target
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

    else if(token_equals(op, "add") ||
            token_equals(op, "sub") ||
            token_equals(op, "mul") ||
            token_equals(op, "div") ||
            token_equals(op, "lt")  ||
            token_equals(op, "gte")) {

      char a[64];
      char b[64];
      char c[64];

      at = parse_token(at, a, sizeof(a));
      at = skip_comma(at);

      at = parse_token(at, b, sizeof(b));
      at = skip_comma(at);

      at = parse_token(at, c, sizeof(c));

      inst.ra = (u8)parse_register(a);
      inst.rb = (u8)parse_register(b);
      inst.rc = (u8)parse_register(c);

      if(token_equals(op, "add")) {
        inst.opcode = OP_ADD;
      }
      else if(token_equals(op, "sub")) {
        inst.opcode = OP_SUB;
      }
      else if(token_equals(op, "mul")) {
        inst.opcode = OP_MUL;
      }
      else if(token_equals(op, "div")) {
        inst.opcode = OP_DIV;
      }
      else if(token_equals(op, "lt")) {
        inst.opcode = OP_LT;
      }
      else if(token_equals(op, "gte")) {
        inst.opcode = OP_GTE;
      }
    }


    /* ============================================================
       load/store/mov

       load  r0, r1
       store r0, r1
       mov   r0, r1
       ============================================================ */

    else if(token_equals(op, "load") ||
            token_equals(op, "store") ||
            token_equals(op, "mov")) {

      char a[64];
      char b[64];

      at = parse_token(at, a, sizeof(a));
      at = skip_comma(at);

      at = parse_token(at, b, sizeof(b));

      inst.ra = (u8)parse_register(a);
      inst.rb = (u8)parse_register(b);

      if(token_equals(op, "load")) {
        inst.opcode = OP_LOAD;
      }
      else if(token_equals(op, "store")) {
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

    else if(token_equals(op, "set")) {

      char a[64];
      char b[64];

      at = parse_token(at, a, sizeof(a));
      at = skip_comma(at);

      at = parse_token(at, b, sizeof(b));

      inst.opcode = OP_REGSETIMM;
      inst.ra = (u8)parse_register(a);
      inst.imm = parse_immediate(b);
    }


    /* ============================================================
       print

       print r0
       ============================================================ */

    else if(token_equals(op, "print")) {

      char a[64];

      at = parse_token(at, a, sizeof(a));

      inst.opcode = OP_PRINT;
      inst.ra = (u8)parse_register(a);
    }


    /* ============================================================
       Unknown instruction
       ============================================================ */

    else {
      printf(
        "error: unknown instruction '%s'\n",
        op
      );

      exit(1);
    }

    instructions[pc++] = inst;

    at = skip_line(at);
  }

  *inst_count_out = pc;

  return instructions;
}
