@echo off
setlocal EnableDelayedExpansion

echo =========================================
echo  FreeCell Web - Single-File Release Build
echo =========================================
echo.

cd /d "%~dp0"

set RELEASE_DIR=release
set TMP_BUNDLE=%TEMP%\freecell_bundle_%RANDOM%.js

:: esbuild command. Default downloads esbuild through npx on first use (needs
:: network once; cached afterwards). Set ESBUILD before running to override,
:: e.g.  set ESBUILD=npx --no-install esbuild
if not defined ESBUILD set ESBUILD=npx --yes esbuild

:: Step 1: TypeScript compile (type-check + emit dist\*.js)
echo [1/4] Compiling TypeScript...
call tsc
if errorlevel 1 goto :error
echo        Done.

:: Step 2: Bundle all modules into one IIFE.
::         esbuild follows the imports from dist\main.js, so module order and
::         import/export removal need no manual list.
echo [2/4] Bundling JS (esbuild)...
call %ESBUILD% dist\main.js --bundle --format=iife --target=es2020 --charset=utf8 --log-level=warning --outfile="%TMP_BUNDLE%"
if errorlevel 1 goto :error
echo        Done.

:: Step 3: Clean release folder
echo [3/4] Cleaning release folder...
if exist "%RELEASE_DIR%" rmdir /S /Q "%RELEASE_DIR%"
mkdir "%RELEASE_DIR%"
echo        Done.

:: Step 4: Inline everything into a single self-contained index.html
::         - CSS  -> inlined ^<style^>
::         - JS   -> the IIFE bundle in one ^<script^>
::         - IMG  -> every img\*.png embedded as base64 data URI
::         (sounds are generated at runtime via Web Audio API, no files needed)
echo [4/4] Inlining into single index.html...
call node bundle.js "%TMP_BUNDLE%"
if errorlevel 1 goto :error
del "%TMP_BUNDLE%" >nul 2>nul
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
if exist "%TMP_BUNDLE%" del "%TMP_BUNDLE%" >nul 2>nul
echo.
echo BUILD FAILED.
echo.
pause
endlocal
exit /b 1
