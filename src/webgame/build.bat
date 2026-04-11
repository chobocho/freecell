@echo off
setlocal EnableDelayedExpansion

echo =========================================
echo  FreeCell Web - Release Build
echo =========================================
echo.

cd /d "%~dp0"

set RELEASE_DIR=release

:: Step 1: TypeScript compile
echo [1/3] Compiling TypeScript...
call npx tsc
if errorlevel 1 (
    echo.
    echo [ERROR] TypeScript compile failed. Aborting.
    pause
    exit /b 1
)
echo       Done.

:: Step 2: Clean release folder
echo [2/3] Cleaning release folder...
if exist "%RELEASE_DIR%" rmdir /S /Q "%RELEASE_DIR%"
mkdir "%RELEASE_DIR%"
mkdir "%RELEASE_DIR%\css"
mkdir "%RELEASE_DIR%\dist"
mkdir "%RELEASE_DIR%\img"
echo       Done.

:: Step 3: Copy files
echo [3/3] Copying files...

copy "index.html"    "%RELEASE_DIR%\"      >nul
copy "css\style.css" "%RELEASE_DIR%\css\"  >nul

for %%F in ("dist\*.js") do copy "%%F" "%RELEASE_DIR%\dist\" >nul

xcopy "img\*" "%RELEASE_DIR%\img\" /Q /Y >nul

echo       Done.
echo.

:: Summary
set JS_COUNT=0
for %%F in ("%RELEASE_DIR%\dist\*.js") do set /a JS_COUNT+=1
set IMG_COUNT=0
for %%F in ("%RELEASE_DIR%\img\*") do set /a IMG_COUNT+=1

echo =========================================
echo  Build complete: %CD%\%RELEASE_DIR%\
echo  - index.html
echo  - css\style.css
echo  - dist\*.js  (%JS_COUNT% files)
echo  - img\*      (%IMG_COUNT% files)
echo =========================================
echo.

explorer "%~dp0%RELEASE_DIR%"

endlocal
