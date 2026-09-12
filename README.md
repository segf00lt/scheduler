# scheduler

This is a project for my OS class. The idea is to learn about process scheduling.

## Build and run

To build first run:

```
# windows (developer command prompt)

setup.bat

# linux or mac

./setup.sh
```

Then once the `nob` build program is build run `./nob.exe` and the project will build.

Once built, run `./scheduler.exe` or `./scheduler`.

## Contributing

O código principal está em `src/app/scheduler.cpp` e `src/app/scheduler.hpp`.

Escalonamento pode ser feito ordenando a fila de processos. No nosso caso isso basicamente quer
dizer escrever uma função de comparação para o `qsort()`. Essa função deve ter a seguinte interface:

```
int compare(const void *a, const void *b);
```

No laço do escalonador tem um `switch(scheduler_mode) {...}` que decide qual função de comparação usar
baseado no valor do `scheduler_mode` que é do tipo `enum Scheduler_mode`.

Então para adicionar um novo algoritmo de escalonamento, basta implementar uma função de comparação,
adicionar um valor ao `enum Scheduler_mode` e um caso para ele no `switch` do escalonador, e uma opção
de argumento CLI para ativar aquele modo do escalonador (isso seria na função `main`).

Como não estamos preocupados com multithreading, podem usar qualquer variável global dentro da função
de comparação. Veja `compare_processes_by_instruction_count()` ou qualquer uma das outras para uma ideia de como
escrever uma dessas funções.


