# Process scheduler simulator

A small OS class project for experimenting with process scheduling using assembly-like programs.

## Run the web app

```sh
npm run web:install # first time only
npm run web:build
npm run frontend
```

Vite serves the React frontend and the API bridge. The bridge imports the scheduler directly into the Vite server process. When an assembly program requests input, the simulation waits for a value entered in that process's console in the left sidebar.

The controls above the workspace set the simulated duration of blocking syscalls (`input` and `print`) and preemption/context switches. Durations range from 0 to 20 ticks and default to 1. The Gantt chart includes these event ticks; during a blocking event, the process is blocked and the CPU is shown as free.

## Debug frontend and backend together

In VS Code, open **Run and Debug** and start **Frontend + backend: Vite and Chrome**. It launches Vite under the Node debugger, then opens Chrome when the server is ready. Set breakpoints in `back/scheduler.ts`, use the frontend to configure and run a process, and enter requested values in its console. The two `Backend CLI` profiles are available for debugging terminal runs.

## Run from the terminal

```sh
npm run scheduler -- round_robin tests/fibonacci.asm tests/test2.asm
```

Supported modes: `fifo`, `round_robin`, `sjf`, `strf`, `priority`, and `custom`. Set `SCHEDULER_QUANTUM` to change the default quantum of 6; set `SCHEDULER_TRACE=1` to print each executed instruction.

## Code layout

- `back/scheduler.ts` contains the assembler and reusable scheduler logic. It accepts an async input callback and output/tick callbacks, so it can run from both the CLI and the web server.
- `back/cli.ts` adapts terminal files, stdin, stdout, and command-line arguments to the scheduler API.
- `front/bridge/schedulerBridge.ts` exposes the API through Vite and pauses each run for browser input when needed.
- `front/src` contains the React UI. The process console shows that process's output and accepts input while it is blocked.
- `tests/*.asm` contains sample programs loaded by the frontend.
