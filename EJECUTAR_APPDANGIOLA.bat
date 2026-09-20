@echo off
title App Dangiola - Carpas D'Angiola ERP
color 0F

echo =====================================================================
echo              CARPAS D'ANGIOLA - SISTEMA ERP Y LOGISTICA
echo          Iniciador Automatico Todo-en-Uno (Estacion Windows)
echo =====================================================================
echo.

:: Cambiar al directorio raiz del proyecto
cd /d "%~dp0"

:: 1. Limpieza de rastros de Mac que puedan causar conflictos en Windows
if exist ".DS_Store" del /f /q ".DS_Store" >nul 2>&1
if exist "backend\.DS_Store" del /f /q "backend\.DS_Store" >nul 2>&1
if exist "frontend\.DS_Store" del /f /q "frontend\.DS_Store" >nul 2>&1

:: Si node_modules de Mac fue copiado por error (contiene binarios Mac), limpiarlo
if exist "backend\node_modules\.bin" (
    findstr /m "darwin" "backend\node_modules\.bin\*" >nul 2>&1
    if %errorlevel% equ 0 (
        echo [AVISO] Se detectaron modulos compilados para Mac en backend. Limpiando para Windows...
        rmdir /s /q "backend\node_modules" >nul 2>&1
    )
)

:: 2. Deteccion de Node.js en Windows
echo [1/4] Verificando instalacion de Node.js en Windows...
set "PATH=%PATH%;C:\Program Files\nodejs;%LOCALAPPDATA%\Programs\nodejs;%APPDATA%\npm;%~dp0tools\node"
set NODE_CMD=
set NPM_CMD=

where node >nul 2>&1
if %errorlevel% equ 0 (
    set NODE_CMD=node
    goto :CHECK_NPM
)

if exist "%~dp0tools\node\node.exe" (
    set NODE_CMD="%~dp0tools\node\node.exe"
    set NPM_CMD="%~dp0tools\node\npm.cmd"
    goto :NODE_OK
)

if exist "%PROGRAMFILES%\nodejs\node.exe" set NODE_CMD="%PROGRAMFILES%\nodejs\node.exe"
if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set NODE_CMD="%LOCALAPPDATA%\Programs\nodejs\node.exe"
if exist "C:\Program Files\nodejs\node.exe" set NODE_CMD="C:\Program Files\nodejs\node.exe"
if exist "C:\Program Files (x86)\nodejs\node.exe" set NODE_CMD="C:\Program Files (x86)\nodejs\node.exe"

if "%NODE_CMD%"=="" (
    echo.
    echo =====================================================================
    echo  [AVISO] Node.js no fue detectado en el equipo.
    echo  Iniciando instalacion automatica en segundo plano...
    echo  No necesitas descargar nada manualmente.
    echo =====================================================================
    echo.
    if exist "%~dp0INSTALAR_TODO_WINDOWS.bat" (
        call "%~dp0INSTALAR_TODO_WINDOWS.bat"
        set "PATH=%PATH%;C:\Program Files\nodejs;%LOCALAPPDATA%\Programs\nodejs;%APPDATA%\npm;%~dp0tools\node"
    )
    where node >nul 2>&1
    if %errorlevel% equ 0 (
        set NODE_CMD=node
        goto :CHECK_NPM
    )
    if exist "%~dp0tools\node\node.exe" (
        set NODE_CMD="%~dp0tools\node\node.exe"
        set NPM_CMD="%~dp0tools\node\npm.cmd"
        goto :NODE_OK
    )
)

:CHECK_NPM
where npm >nul 2>&1
if %errorlevel% equ 0 (
    set NPM_CMD=npm
    goto :NODE_OK
)

if exist "%PROGRAMFILES%\nodejs\npm.cmd" set NPM_CMD="%PROGRAMFILES%\nodejs\npm.cmd"
if exist "%LOCALAPPDATA%\Programs\nodejs\npm.cmd" set NPM_CMD="%LOCALAPPDATA%\Programs\nodejs\npm.cmd"
if exist "C:\Program Files\nodejs\npm.cmd" set NPM_CMD="C:\Program Files\nodejs\npm.cmd"
if exist "C:\Program Files (x86)\nodejs\npm.cmd" set NPM_CMD="C:\Program Files (x86)\nodejs\npm.cmd"

if "%NPM_CMD%"=="" set NPM_CMD=call npm

:NODE_OK
echo    Node.js detectado correctamente!
%NODE_CMD% -v

:: 3. Verificacion e instalacion de dependencias de Backend
echo.
echo [2/4] Verificando dependencias del Backend...
if not exist "backend\node_modules" (
    echo    Instalando dependencias de Backend (primera ejecucion en Windows)...
    cd backend
    %NPM_CMD% install
    if errorlevel 1 (
        echo [ERROR] Fallo la instalacion de dependencias en backend.
        cd ..
        pause
        exit /b 1
    )
    cd ..
    echo    Dependencias de Backend instaladas con exito.
) else (
    echo    Dependencias de Backend listas.
)

:: 4. Verificacion de Frontend compilado
echo.
echo [3/4] Verificando interfaz de usuario (Frontend)...
if not exist "frontend\dist\index.html" (
    echo    Compilando Frontend por primera vez para produccion...
    if not exist "frontend\node_modules" (
        echo    Instalando librerias de Frontend...
        cd frontend
        %NPM_CMD% install
        cd ..
    )
    cd frontend
    %NPM_CMD% run build
    if errorlevel 1 (
        echo [ERROR] Hubo un problema al compilar el frontend.
        cd ..
        pause
        exit /b 1
    )
    cd ..
    echo    Frontend compilado exitosamente.
) else (
    echo    Frontend de produccion listo y optimizado.
)

:: 5. Creacion de Acceso Directo en el Escritorio
set SCRIPT_TARGET=%~dp0EJECUTAR_APPDANGIOLA.bat
set LINK_TARGET=%USERPROFILE%\Desktop\App Dangiola.lnk
powershell -NoProfile -Command "try { $ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%LINK_TARGET%'); $s.TargetPath = '%SCRIPT_TARGET%'; $s.WorkingDirectory = '%~dp0'; $s.IconLocation = 'shell32.dll,23'; $s.Save(); } catch {}" >nul 2>&1
if exist "%LINK_TARGET%" (
    echo    Acceso directo disponible en tu Escritorio: App Dangiola.lnk
)

:: 6. Verificacion de puerto y arranque del Servidor
echo.
echo [4/4] Iniciando Servidor de App Dangiola...
set APP_PORT=5001

:: Verificar si el puerto ya esta ocupado
netstat -ano | findstr :%APP_PORT% | findstr LISTENING >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] El puerto %APP_PORT% ya esta en uso. Intentando liberar proceso previo...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%APP_PORT% ^| findstr LISTENING') do (
        taskkill /F /PID %%a >nul 2>&1
    )
    timeout /t 1 /nobreak >nul
)

echo.
echo =====================================================================
echo   SISTEMA CARPAS D'ANGIOLA EN EJECUCION
echo =====================================================================
echo   URL Local:     http://localhost:%APP_PORT%
echo   Red Local:     Disponible para dispositivos en la misma red
echo   Base de Datos: Sincronizada con db.json / modulos.csv
echo.
echo   * Se abrira tu navegador web en 2 segundos...
echo   * Para apagar el sistema, simplemente cierra esta ventana.
echo =====================================================================
echo.

:: Abrir navegador automaticamente
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:%APP_PORT%"

:: Iniciar servidor
cd backend
%NODE_CMD% server.js

if errorlevel 1 (
    echo.
    echo [ERROR] El servidor de App Dangiola se detuvo inesperadamente.
    echo Consulta los mensajes anteriores para ver el error.
    pause
)
