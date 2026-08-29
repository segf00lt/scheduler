@echo off
cl.exe /nologo nob.c
if errorlevel 1 exit /b %errorlevel%

nob.exe
