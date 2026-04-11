@echo off
setlocal EnableDelayedExpansion

echo =========================================
echo  FreeCell Web - Release Build
echo =========================================
echo.

:: build.bat 위치를 기준으로 작업 디렉토리 설정
cd /d "%~dp0"

set RELEASE_DIR=release

:: ── 1단계: TypeScript 컴파일 ─────────────────────────────
echo [1/3] TypeScript 컴파일 중...
call npx tsc
if errorlevel 1 (
    echo.
    echo [ERROR] TypeScript 컴파일 실패. 빌드를 중단합니다.
    pause
    exit /b 1
)
echo       완료

:: ── 2단계: 릴리스 폴더 초기화 ───────────────────────────
echo [2/3] 릴리스 폴더 초기화 중...
if exist "%RELEASE_DIR%" (
    rmdir /S /Q "%RELEASE_DIR%"
)
mkdir "%RELEASE_DIR%"
mkdir "%RELEASE_DIR%\css"
mkdir "%RELEASE_DIR%\dist"
mkdir "%RELEASE_DIR%\img"
echo       완료

:: ── 3단계: 파일 복사 ────────────────────────────────────
echo [3/3] 파일 복사 중...

:: HTML
copy "index.html" "%RELEASE_DIR%\" >nul

:: CSS
copy "css\style.css" "%RELEASE_DIR%\css\" >nul

:: JS (소스맵 .js.map 제외, .js 파일만)
for %%F in ("dist\*.js") do (
    copy "%%F" "%RELEASE_DIR%\dist\" >nul
)

:: 이미지 (아이콘 포함)
xcopy "img\*" "%RELEASE_DIR%\img\" /Q /Y >nul

echo       완료
echo.

:: ── 결과 요약 ────────────────────────────────────────────
echo =========================================
set JS_COUNT=0
for %%F in ("%RELEASE_DIR%\dist\*.js") do set /a JS_COUNT+=1
set IMG_COUNT=0
for %%F in ("%RELEASE_DIR%\img\*") do set /a IMG_COUNT+=1

echo  빌드 완료: %RELEASE_DIR%\
echo  - index.html
echo  - css\style.css
echo  - dist\*.js  (%JS_COUNT%개)
echo  - img\*      (%IMG_COUNT%개)
echo =========================================
echo.

:: 릴리스 폴더를 탐색기로 열기
explorer "%~dp0%RELEASE_DIR%"

endlocal
