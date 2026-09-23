@echo off
rem Launch the Vite dev server from this script's own directory,
rem so it works regardless of where the repo is cloned.
cd /d "%~dp0"
call npm.cmd run dev
