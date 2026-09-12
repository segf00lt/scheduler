; Sum from 1 to n

input r0

set r1, 0
set r2, 1
set r3, 1

begin:
lt r4, r0, r2
ifgoto r4, end

add r1, r1, r2
add r2, r2, r3

goto begin

end:
mov r0, r1
print r0
