#ifndef SCHEDULER_C
#define SCHEDULER_C


global u64 registers[64];
global u8 memory[KB(1)];

global u32 process_id_alloc = 0;


internal void
func push_process_to_queue(Process_queue *process_queue, Process_state *process_state) {
  dll_push_back(process_queue->first, process_queue->last, process_state);
  process_queue->n++;
}

internal Process_state*
func remove_process_from_queue_return_next(Process_queue *process_queue, Process_state *process_state) {
  Process_state *next = process_state->next;
  dll_remove(process_queue->first, process_queue->last, process_state);
  process_queue->n--;
  return next;
}

internal void
func process_scheduler(Process_queue initial_process_queue) {

  Process_queue ready_queue = initial_process_queue;
  Process_queue wait_queue = {0};

  for(; ready_queue.n > 0;) {

    for(Process_state *p = ready_queue.first, *next_p = 0; p; p = next_p) {

      process_runner(p);
      next_p = remove_process_from_queue_return_next(&ready_queue, p);

      switch(p->status) {
        case PROC_STAT_BLOCK:
        p->status = PROC_STAT_RUN;
        push_process_to_queue(&wait_queue, p);
        break;
        case PROC_STAT_EXIT:
        printf("process %d exited...\n", p->id);
        break;
      }

    }

    ready_queue = wait_queue;
    memory_zero(&wait_queue, sizeof(wait_queue));

  }

}


internal void
func process_runner(Process_state *process_state) {

  memory_zero(registers, sizeof(registers));
  memory_copy(registers, process_state->registers, sizeof(registers));

  Inst *instructions = process_state->instructions;
  u32 pc = process_state->pc;

  for(;pc <= process_state->max_pc_value && process_state->status == PROC_STAT_RUN;) {

    ASSERT(pc >= 0 && pc <= process_state->max_pc_value);

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

      // TODO jfd 31/08/26: Make these more like real system calls
      case OP_INPUT: {
        s64 input_val = 0;
        printf("process %d requesting input for r%d = ", process_state->id, inst.ra);
        scanf("%d", &input_val);
        registers[inst.ra] = input_val;
        process_state->status = PROC_STAT_BLOCK;
      } break;

      case OP_PRINT: {
        printf("process %d print r%d = %u\n", process_state->id, inst.ra, registers[inst.ra]);
        process_state->status = PROC_STAT_BLOCK;
      } break;
    }

    pc += 1;
  }

  memory_copy(process_state->registers, registers, sizeof(registers));
  memory_copy(process_state->memory, memory, sizeof(memory));
  process_state->pc = pc;

  if(pc >= process_state->max_pc_value && process_state->status != PROC_STAT_BLOCK) {
    process_state->status = PROC_STAT_EXIT;
  }

}


internal Program
func load_program(char *code_path, Arena *a) {
  Str8 asm_code = platform_read_entire_file(a, code_path);
  u32 program_len;
  Inst *program = assemble(a, asm_code, &program_len);
  Program result;
  result.instructions = program;
  result.instruction_count = program_len;
  return result;
}

internal Process_state*
func create_process(Program program, Arena *a) {

  Process_state *process_state = push_struct(a, Process_state);
  process_state->id = process_id_alloc++;
  process_state->instructions = program.instructions;
  process_state->max_pc_value = program.instruction_count - 1;
  process_state->status = PROC_STAT_RUN;

  return process_state;
}


int main(void) {
  Arena *a = arena_create(MB(1));

  Process_queue process_queue = {0};

  Program fibonacci_program = load_program("fibonacci.asm", a);
  Program test_program = load_program("test2.asm", a);

  Process_state *p1 = create_process(fibonacci_program, a);
  Process_state *p2 = create_process(test_program, a);
  Process_state *p3 = create_process(fibonacci_program, a);

  push_process_to_queue(&process_queue, p1);
  push_process_to_queue(&process_queue, p2);
  push_process_to_queue(&process_queue, p3);

  process_scheduler(process_queue);

  return 0;
}


#endif
