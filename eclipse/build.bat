@echo off
setlocal
cd /d "%~dp0\.."
set SRC=eclipse\src
set OUT=eclipse\out\classes
set JAR=eclipse\out\aetherscape-eclipse-glue.jar

where javac >nul 2>&1
if errorlevel 1 (
  echo ERROR: javac not on PATH. Install a JDK 11+ then re-run.
  exit /b 1
)

if exist eclipse\out rmdir /s /q eclipse\out
mkdir "%OUT%"

dir /s /b "%SRC%\*.java" > eclipse\out\sources.txt
javac -encoding UTF-8 --release 8 -d "%OUT%" @eclipse\out\sources.txt
if errorlevel 1 exit /b 1

jar cf "%JAR%" -C "%OUT%" .
if errorlevel 1 exit /b 1

java -cp "%OUT%" com.aetherhaven.eclipse.test.FakeBrowserHarness
if errorlevel 1 exit /b 1

echo.
echo Built: %JAR%
echo OK
endlocal
