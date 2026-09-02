input r0
set r1, 0
set r2, 1
set r5, 1

begin:
sub r3, r0, r2
lt r4, r3, r2
ifgoto r4, end

mul r5, r0, r5
mov r0, r3

goto begin

end:
mov r0, r5
print r0
