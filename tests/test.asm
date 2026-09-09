
set r0, 0       ; a = 0
set r1, 1       ; b = 1
set r2, 15      ; n = 6
set r3, 0       ; i = 0

loop:
    gte r4, r3, r2
    ifgoto r4, done

    add r5, r0, r1
    mov r0, r1
    mov r1, r5

    set r6, 1
    add r3, r3, r6
    print r0 ; show current iteration

    goto loop

done:
    print r0
