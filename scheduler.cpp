#ifndef SCHEDULER_C
#define SCHEDULER_C


global u32 registers[64];
global u8 memory[KB(1)];

global u32 process_id_alloc = 0;
global u32 scheduler_quantum = 3;

global Scheduler_mode scheduler_mode = SCHED_MODE_FIFO;



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


internal force_inline f32
func exponential_moving_average(f32 avg, f32 sample, f32 coefficient) {
  f32 result = (1.0-coefficient)*avg + coefficient*sample;
  return result;
}

internal int
func compare_processes_by_avg_quantum_used(const void *a, const void *b) {
  Process_state *pa = *(Process_state**)a;
  Process_state *pb = *(Process_state**)b;

  if(pa->avg_quantum_used > pb->avg_quantum_used) {
    return 1;
  } else if(pa->avg_quantum_used < pb->avg_quantum_used) {
    return -1;
  } else {
    return 0;
  }

}

internal int
func compare_processes_by_priority(const void *a, const void *b) {
  Process_state *pa = *(Process_state**)a;
  Process_state *pb = *(Process_state**)b;

  if(pa->priority > pb->priority) {
    return 1;
  } else if(pa->priority < pb->priority) {
    return -1;
  } else {
    return 0;
  }

}

internal int
func compare_processes_by_instruction_count(const void *a, const void *b) {
  Process_state *pa = *(Process_state**)a;
  Process_state *pb = *(Process_state**)b;

  if(pa->max_pc_value > pb->max_pc_value) {
    return 1;
  } else if(pa->max_pc_value < pb->max_pc_value) {
    return -1;
  } else {
    return 0;
  }

}

internal void
func process_scheduler(Arena *a, Process_queue initial_process_queue) {

  Process_queue cur_queue = initial_process_queue;
  Process_queue next_queue = {0};
  Process_queue exit_queue = {0};


  for(; cur_queue.n > 0;) {

    /* NOTE jfd

     First-Come, First-Served (FCFS) — Processes run in the order they arrive.
     Shortest Job First (SJF) — Runs the process with the shortest estimated CPU burst first.
     Shortest Remaining Time First (SRTF) — Preemptive version of SJF; switches to a process with less remaining time.
     Round Robin (RR) — Each process gets a fixed time slice (quantum) in rotation.
     Priority Scheduling — Runs the process with the highest priority first; can be preemptive or non-preemptive.

     */

    bool ignore_quantum = false;

    arena_scope(a) {
      Process_state **proc_array = push_array_no_zero(a, Process_state*, cur_queue.n);
      s64 n = cur_queue.n;
      Process_state *p = cur_queue.first;
      for(int i = 0; p; p = p->next) {
        proc_array[i++] = p;
      }

      switch(scheduler_mode) {
        default:
        UNREACHABLE;
        break;
        case SCHED_MODE_FIFO:
        ignore_quantum = true;
        break;
        case SCHED_MODE_ROUND_ROBIN:
        break;
        case SCHED_MODE_SHORTEST_JOB_FIRST:
        ignore_quantum = true;
        qsort((void*)proc_array, n, sizeof(Process_state*), compare_processes_by_instruction_count);
        break;
        case SCHED_MODE_SHORTEST_TIME_REMAINING_FIRST:
        qsort((void*)proc_array, n, sizeof(Process_state*), compare_processes_by_avg_quantum_used);
        break;
        case SCHED_MODE_PRIORITY:
        qsort((void*)proc_array, n, sizeof(Process_state*), compare_processes_by_priority);
        break;
        case SCHED_MODE_CUSTOM:
        UNIMPLEMENTED;
        break;
      }

      Process_state *prev = 0;
      for(int i = 0; i < n - 1; i++) {
        proc_array[i]->prev = prev;
        prev = proc_array[i];
        proc_array[i]->next = proc_array[i+1];
      }
      proc_array[n - 1]->prev = prev;
      proc_array[n - 1]->next = 0;

      // NOTE jfd: I stupidly forgot to set the first and last members of the queue after the sort
      cur_queue.first = proc_array[0];
      cur_queue.last = proc_array[n - 1];

    }

    for(Process_state *p = cur_queue.first, *next_p = 0; p; p = next_p) {

      process_runner(p, ignore_quantum);

      p->avg_quantum_used = exponential_moving_average(p->avg_quantum_used, (f32)p->quantum_used, 0.125f);

      next_p = remove_process_from_queue_return_next(&cur_queue, p);

      switch(p->status) {
        case PROC_STAT_RUN:
        case PROC_STAT_BLOCK:
        p->status = PROC_STAT_RUN;
        push_process_to_queue(&next_queue, p);
        break;
        case PROC_STAT_EXIT:
        printf("process %u exited...\n", p->id);
        push_process_to_queue(&exit_queue, p);
        break;
      }

    }

    cur_queue = next_queue;
    memory_zero(&next_queue, sizeof(next_queue));

  }

  // TODO jfd 02/09/26: Make graphical visualisations!
  for(Process_state *p = exit_queue.first; p; p = p->next) {

    printf("process %u average quantum used: %f\n", p->id, p->avg_quantum_used);

  }


}


internal void
func process_runner(Process_state *process_state, bool ignore_quantum) {

  memory_zero(registers, sizeof(registers));
  memory_copy(registers, process_state->registers, sizeof(registers));

  Inst *instructions = process_state->instructions;
  u32 pc = process_state->pc;

  // NOTE jfd 02/09/26: allow a process to execute n instructions before preemption
  // An alternative would be to use a float value and time the executions, but I think
  // an instruction budget is probably enough.
  u32 quantum = scheduler_quantum;

  for(;pc <= process_state->max_pc_value && process_state->status == PROC_STAT_RUN && quantum > 0;) {
    if(!ignore_quantum) {
      quantum--;
    }

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
        u32 input_val = 0;
        printf("process %u requesting input for r%u = ", process_state->id, inst.ra);
        scanf("%d", &input_val);
        registers[inst.ra] = input_val;
        process_state->status = PROC_STAT_BLOCK;
      } break;

      case OP_PRINT: {
        printf("process %u print r%u = %u\n", process_state->id, inst.ra, registers[inst.ra]);
        process_state->status = PROC_STAT_BLOCK;
      } break;
    }

    pc += 1;
  }

  process_state->quantum_used = scheduler_quantum - quantum;

  memory_copy(process_state->registers, registers, sizeof(registers));
  memory_copy(process_state->memory, memory, sizeof(memory));
  process_state->pc = pc;

  if(pc > process_state->max_pc_value) {
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
  return create_process_with_priority(0, program, a);
}

internal Process_state*
func create_process_with_priority(u32 priority, Program program, Arena *a) {

  Process_state *process_state = push_struct(a, Process_state);
  process_state->id = process_id_alloc++;
  process_state->priority = priority;
  process_state->instructions = program.instructions;
  process_state->max_pc_value = program.instruction_count - 1;
  process_state->status = PROC_STAT_RUN;

  return process_state;
}


int main(int argc, char **argv) {
  Arena *a = arena_create(MB(1));

  if(argc > 1) {
    if(!strcmp("fifo", argv[1])) {
      scheduler_mode = SCHED_MODE_FIFO;
    } else if(!strcmp("round_robin", argv[1])) {
      scheduler_mode = SCHED_MODE_ROUND_ROBIN;
    } else if(!strcmp("sjf", argv[1])) {
      scheduler_mode = SCHED_MODE_SHORTEST_JOB_FIRST;
    } else if(!strcmp("strf", argv[1])) {
      scheduler_mode = SCHED_MODE_SHORTEST_TIME_REMAINING_FIRST;
    } else if(!strcmp("priority", argv[1])) {
      scheduler_mode = SCHED_MODE_PRIORITY;
    } else if(!strcmp("custom", argv[1])) {
      scheduler_mode = SCHED_MODE_CUSTOM;
    } else {
      printf("unknown option '%s'\n", argv[1]);
      return 1;
    }
  }

  Program fibonacci_program = load_program("fibonacci.asm", a);
  Program test_program = load_program("test2.asm", a);
  Program factorial_program = load_program("factorial.asm", a);

  arena_scope(a) {
    Process_queue process_queue = {0};

    Process_state *p0 = create_process_with_priority(10, factorial_program, a);

    push_process_to_queue(&process_queue, p0);

    process_scheduler(a, process_queue);
  }

  #if 0
  arena_scope (a) {
    Process_queue process_queue = {0};

    Process_state *p0 = create_process_with_priority(10, fibonacci_program, a);
    Process_state *p1 = create_process_with_priority(0, test_program, a);
    Process_state *p2 = create_process_with_priority(0, fibonacci_program, a);

    push_process_to_queue(&process_queue, p0);
    push_process_to_queue(&process_queue, p1);
    push_process_to_queue(&process_queue, p2);

    process_scheduler(a, process_queue);
  }
  #endif

  #if 0
  arena_scope(a) {
    printf("=== test priority scheduling ===\n");

    Process_queue process_queue = {0};

    // scheduler_mode = SCHED_MODE_PRIORITY;

    Process_state *p0 = create_process_with_priority(10, test_program, a);
    Process_state *p1 = create_process_with_priority(0, test_program, a);
    Process_state *p2 = create_process_with_priority(0, test_program, a);

    push_process_to_queue(&process_queue, p0);
    push_process_to_queue(&process_queue, p1);
    push_process_to_queue(&process_queue, p2);

    process_scheduler(a, process_queue);
  }
  #endif

  return 0;
}


#endif
