;set r0, 10
;set r1, 20
;add r2, r0, r1
;print r2
;
;set r3, 0
;loop:
;add r3, r3, r0
;set r4, 1
;add r0, r0, r4
;gte r5, r0, r1
;ifgoto r5, done
;goto loop
;
;done:
;print r3


set r0, 0       ; a = 0
set r1, 1       ; b = 1
set r2, 9       ; n = 6
set r3, 0       ; i = 0

loop:
    gte r4, r3, r2
    ifgoto r4, done

    add r5, r0, r1
    mov r0, r1
    mov r1, r5

    set r6, 1
    add r3, r3, r6

    goto loop

done:
    print r0
