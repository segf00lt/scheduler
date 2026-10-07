#!/bin/sh



cc nob.c -o nob.exe || exit 1
./nob.exe raylib &
./nob.exe imgui &
wait
echo INFO: libraries finished compiling
./nob.exe
