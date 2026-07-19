@echo off
setlocal EnableDelayedExpansion

echo =========================================
echo  FreeCell Web - Single-File Release Build
echo =========================================
echo.

cd /d "%~dp0"

set RELEASE_DIR=release

:: Step 1: TypeScript compile
echo [1/3] Compiling TypeScript...
call tsc
if errorlevel 1 goto :error
echo        Done.

:: Step 2: Clean release folder
echo [2/3] Cleaning release folder...
if exist "%RELEASE_DIR%" rmdir /S /Q "%RELEASE_DIR%"
mkdir "%RELEASE_DIR%"
echo        Done.

:: Step 3: Bundle everything into a single self-contained index.html
::         - CSS  -> inlined ^<style^>
::         - JS   -> all ES modules concatenated into one ^<script type="module"^>
::         - IMG  -> every img\*.png embedded as base64 data URI
::         (sounds are generated at runtime via Web Audio API, no files needed)
echo [3/3] Bundling into single index.html...
call node bundle.js
if errorlevel 1 goto :error
echo        Done.
echo.

echo =========================================
echo  Build complete: %CD%\%RELEASE_DIR%\index.html
echo  - Single self-contained file (open directly in a browser)
echo =========================================
echo.

pause
endlocal
exit /b 0

:error
echo.
echo BUILD FAILED.
echo.
pause
endlocal
exit /b 1
