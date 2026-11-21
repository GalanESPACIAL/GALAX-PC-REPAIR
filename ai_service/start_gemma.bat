@echo off
setlocal EnableExtensions DisableDelayedExpansion

REM Arranca el servicio desde cualquier directorio.
set "AI_DIR=%~dp0"
if "%AI_DIR:~-1%"=="\" set "AI_DIR=%AI_DIR:~0,-1%"

set "ROOT=%AI_DIR%\.."
for %%I in ("%ROOT%") do set "ROOT=%%~fI"

set "MODEL_DIR=%GEMMA_MODEL_PATH%"
if not defined MODEL_DIR set "MODEL_DIR=%ROOT%\gemma-4-E4B-it"

if not exist "%MODEL_DIR%\config.json" goto NO_MODEL

REM Prioriza un entorno virtual conocido; si no, usa python del PATH.
set "PY="
if exist "%AI_DIR%\.venv\Scripts\python.exe" set "PY=%AI_DIR%\.venv\Scripts\python.exe"
if exist "%AI_DIR%\venv\Scripts\python.exe" set "PY=%AI_DIR%\venv\Scripts\python.exe"
if exist "%ROOT%\.venv\Scripts\python.exe" set "PY=%ROOT%\.venv\Scripts\python.exe"
if not defined PY if exist "C:\GXA\Python313\python.exe" set "PY=C:\GXA\Python313\python.exe"

if defined PY goto HAVE_PY
where python >nul 2>nul
if errorlevel 1 goto NO_PY
set "PY=python"

:HAVE_PY
REM Descarta el alias de Microsoft Store / instalaciones rotas.
"%PY%" -c "import sys" >nul 2>nul
if errorlevel 1 goto NO_PY

cd /d "%AI_DIR%"
"%PY%" "%AI_DIR%\server.py" %*
set "RC=%ERRORLEVEL%"
endlocal & exit /b %RC%

:NO_MODEL
echo [ERROR] No se encontro el modelo. Se esperaba config.json en:
echo          %MODEL_DIR%
echo Defina GEMMA_MODEL_PATH con la ruta real de la carpeta del modelo.
endlocal & exit /b 1

:NO_PY
echo [ERROR] No hay un Python real disponible. Instale Python 3.10+ o cree un
echo          entorno virtual con requirements.txt antes de arrancar.
endlocal & exit /b 1
