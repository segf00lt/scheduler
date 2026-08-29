
#define OPCODES \
X(GOTO) \
X(IFGOTO) \
X(ADD) \
X(SUB) \
X(MUL) \
X(DIV) \
X(LT) \
X(GTE) \
X(LOAD) \
X(STORE) \
X(REGMOV) \
X(REGSETIMM) \
X(PRINT) \

#define OPFLAGS \
X(SIGNED) \

typedef enum Opflags_index {
  OPFLAG_INDEX_NONE = -1,
  #define X(x) OPFLAG_INDEX_##x,
  OPFLAGS
  #undef X
  OPFLAG_INDEX_MAX,
} Opflags_index;

typedef u64 Opflags;
#define X(x) const Opflags OPFLAG_##x = ((u64)1 << OPFLAG_INDEX_##x);
OPFLAGS
#undef X

enum Opcode {
  OP_NONE = 0,
  #define X(x) OP_##x,
  OPCODES
  #undef X
};

struct Inst {
  Opcode opcode;
  Opflags opflags;
  u32 ra;
  u32 rb;
  u32 rc;
  u32 imm;
};

struct Process_state {
  Inst *instructions;
  u32 pc;
  u32 max_pc_value;
};

global u32 registers[64];
global u8  memory[KB(8)];



internal Inst *assemble(Arena *arena, char *source, u32 *inst_count_out);


internal void
func process_runner(Process_state process_state) {

  memory_zero(registers, sizeof(registers));

  Inst *instructions = process_state.instructions;
  u32 pc = process_state.pc;

  for(;pc <= process_state.max_pc_value;) {

    ASSERT(pc >= 0 && pc <= process_state.max_pc_value);

    Inst inst = instructions[pc];

    switch(inst.opcode) {
      default:
      UNREACHABLE;

      case OP_GOTO: {
        pc = inst.imm;
        continue;
      } break;

      case OP_IFGOTO: {
        if(registers[inst.ra] != 0) {
          pc = inst.imm;
          continue;
        }
      } break;

      case OP_ADD: {
        registers[inst.ra] = registers[inst.rb] + registers[inst.rc];
      } break;

      case OP_SUB: {
        registers[inst.ra] = registers[inst.rb] - registers[inst.rc];
      } break;

      case OP_MUL: {
        registers[inst.ra] = registers[inst.rb] * registers[inst.rc];
      } break;

      case OP_DIV: {
        registers[inst.ra] = registers[inst.rb] / registers[inst.rc];
      } break;

      case OP_LT: {
        if(inst.opflags & OPFLAG_SIGNED) {
          registers[inst.ra] = !!((s32)registers[inst.rb] < (s32)registers[inst.rc]);
        } else {
          registers[inst.ra] = !!(registers[inst.rb] < registers[inst.rc]);
        }
      } break;

      case OP_GTE: {
        if(inst.opflags & OPFLAG_SIGNED) {
          registers[inst.ra] = !!((s32)registers[inst.rb] >= (s32)registers[inst.rc]);
        } else {
          registers[inst.ra] = !!(registers[inst.rb] >= registers[inst.rc]);
        }
      } break;

      case OP_LOAD: {
        u32 address = registers[inst.rb];
        registers[inst.ra] = memory[address];
      } break;

      case OP_STORE: {
        u32 address = registers[inst.rb];
        memory[address] = registers[inst.ra];
      } break;

      case OP_REGMOV: {
        registers[inst.ra] = registers[inst.rb];
      } break;

      case OP_REGSETIMM: {
        registers[inst.ra] = inst.imm;
      } break;

      case OP_PRINT: {
        printf("%u\n", registers[inst.ra]);
      } break;
    }

    pc += 1;
  }
}


int main(void) {
  Arena *a = arena_create(MB(1));

  Str8 my_str = str8f(a, "hello %p", a);

  printf("my_str = \"%s\"\n", cstr_from_str8(a, my_str));

  Str8 asm_code = platform_read_entire_file(a, "test.asm");

  u32 program_len;
  Inst *program = assemble(a, (char*)asm_code.s, &program_len);

  Process_state process_1 = {0};
  process_1.instructions = program;
  process_1.max_pc_value = program_len - 1;
  process_runner(process_1);

  return 0;
}
