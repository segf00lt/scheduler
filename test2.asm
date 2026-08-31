set r0, 10
set r1, 20
add r2, r0, r1
print r2

set r3, 0
loop:
add r3, r3, r0
set r4, 1
add r0, r0, r4
gte r5, r0, r1
ifgoto r5, done
goto loop

done:
print r3


