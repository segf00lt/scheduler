@echo off
cl.exe /nologo nob.c
if errorlevel 1 exit /b %errorlevel%

nob.exe raylib
nob.exe imgui

echo INFO: libraries finished compiling

nob.exe
