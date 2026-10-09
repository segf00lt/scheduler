#ifndef SCHEDULER_H
#define SCHEDULER_H

#define MAX_REGISTERS 64
#define MAX_MEMORY KB(1)

#define OPCODES \
/* opcode    quantum_cost      */ \
X( GOTO,                1) \
X( IFGOTO,              4) \
X( ADD,                 1) \
X( SUB,                 1) \
X( MUL,                 2) \
X( DIV,                 3) \
X( LT,                  1) \
X( GTE,                 1) \
X( LOAD,                5) \
X( STORE,               5) \
X( REGMOV,              2) \
X( REGSETIMM,           2) \
X( PRINT,               8) \
X( INPUT,               8) \


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
  #define X(x, cost) OP_##x,
  OPCODES
  #undef X
};

global read_only char *opcode_strings[] = {
"NONE",
#define X(x, cost) #x,
OPCODES
#undef X
};


global read_only s32 opcode_quantum_cost[] = {
  0,
  #define X(x, cost) cost,
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

  s32 quantum_deadline; // this is used for EDF, it means the maximum quantum that may be used
  s32 total_quantum_used;
  s32 quantum_used_this_run;
  f32 avg_quantum_used;

  Inst *instructions;
  u32 pc;
  u32 max_pc_value;
  u64 registers[MAX_REGISTERS];
  u8  memory[MAX_MEMORY];
};

struct Process_queue {
  Process_state *first;
  Process_state *last;
  s64 n;
};


internal void push_process_to_queue(Process_queue *process_queue, Process_state *process_state);

internal Process_state* remove_process_from_queue_return_next(Process_queue *process_queue, Process_state *process_state);

internal int compare_processes_by_remaining_instructions(const void *a, const void *b);

internal int compare_processes_by_priority(const void *a, const void *b);

internal int compare_processes_by_instruction_count(const void *a, const void *b);

internal force_inline bool is_scheduler_mode_preemptive(Scheduler_mode mode);

internal void sort_process_queue(Arena *a, Process_queue *cur_queue);

internal void process_scheduler(Arena *a, Process_queue initial_process_queue);

internal void render_gantt(void);

internal s32 process_run_step(Process_state *process_state, bool ignore_quantum);

internal Program load_program(char *code_path, Arena *a);

internal Process_state* create_process(Program program, Arena *a);

internal Process_state* create_process_with_priority(u32 priority, Program program, Arena *a);

#endif
