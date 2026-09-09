#ifndef SCHEDULER_H
#define SCHEDULER_H

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
X(INPUT) \


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

enum Scheduler_mode {
  SCHED_MODE_FIFO = 0,
  SCHED_MODE_ROUND_ROBIN,
  SCHED_MODE_SHORTEST_JOB_FIRST,
  SCHED_MODE_SHORTEST_TIME_REMAINING_FIRST,
  SCHED_MODE_PRIORITY,
  SCHED_MODE_CUSTOM,
};

enum Process_status {
  PROC_STAT_RUN,
  PROC_STAT_EXIT = 1,
  PROC_STAT_BLOCK,
};

struct Inst {
  Opcode opcode;
  Opflags opflags;
  u32 ra;
  u32 rb;
  u32 rc;
  u32 imm;
};

struct Program {
  Inst *instructions;
  u32 instruction_count;
};

struct Process_state {
  u32 id;
  u32 priority;
  Process_status status;
  Process_state *next;
  Process_state *prev;

  u32 quantum_used;
  f32 avg_quantum_used;

  Inst *instructions;
  u32 pc;
  u32 max_pc_value;
  u64 registers[64];
  u8  memory[KB(1)];
};

struct Process_queue {
  Process_state *first;
  Process_state *last;
  s64 n;
};

internal void push_process_to_queue(Process_queue *process_queue, Process_state *process_state);

internal Process_state* remove_process_from_queue_return_next(Process_queue *process_queue, Process_state *process_state);

internal force_inline f32 exponential_moving_average(f32 avg, f32 sample, f32 coefficient);

internal int compare_processes_by_avg_quantum_used(const void *a, const void *b);

internal int compare_processes_by_priority(const void *a, const void *b);

internal int compare_processes_by_instruction_count(const void *a, const void *b);

internal void process_scheduler(Arena *a, Process_queue initial_process_queue);

internal void process_runner(Process_state *process_state, bool ignore_quantum);

internal Program load_program(char *code_path, Arena *a);

internal Process_state* create_process(Program program, Arena *a);

internal Process_state* create_process_with_priority(u32 priority, Program program, Arena *a);

#endif
