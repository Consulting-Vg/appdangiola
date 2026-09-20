@echo off
title Instalador Todo-en-Uno - App Dangiola (Windows)
color 0A

echo =====================================================================
echo          INSTALADOR AUTOMATICO TODO-EN-UNO - APP DANGIOLA
echo          Preparacion Completa de la Estacion de Campo (Windows)
echo =====================================================================
echo.
echo Este script instalara automaticamente Node.js y todas las librerias
echo necesarias para que App Dangiola funcione sin descargas manuales.
echo.

cd /d "%~dp0"

:: 1. Limpieza de rastros incompatibles de Mac
if exist ".DS_Store" del /f /q ".DS_Store" >nul 2>&1
if exist "backend\.DS_Store" del /f /q "backend\.DS_Store" >nul 2>&1
if exist "frontend\.DS_Store" del /f /q "frontend\.DS_Store" >nul 2>&1

:: 2. Deteccion de arquitectura (64-bit o 32-bit)
set NODE_ARCH=x64
if "%PROCESSOR_ARCHITECTURE%"=="x86" (
    if "%PROCESSOR_ARCHITEW6432%"=="" set NODE_ARCH=x86
)

:: 3. Verificar si Node.js ya esta instalado
echo [Paso 1/4] Verificando instalacion de Node.js...
set "PATH=%PATH%;C:\Program Files\nodejs;%LOCALAPPDATA%\Programs\nodejs;%APPDATA%\npm;%~dp0tools\node"

where node >nul 2>&1
if %errorlevel% equ 0 (
    echo    Node.js ya se encuentra instalado en este equipo:
    node -v
    goto :NODE_INSTALLED
)

if exist "%~dp0tools\node\node.exe" (
    echo    Node.js portatil detectado en tools\node:
    "%~dp0tools\node\node.exe" -v
    goto :NODE_INSTALLED
)

:: 4. Si no esta instalado, iniciar instalacion automatica
echo.
echo =====================================================================
echo  [INFO] Node.js no fue detectado en Windows.
echo  Iniciando instalacion 100%% automatica en segundo plano...
echo =====================================================================
echo.

:: Intento 1: winget (Windows Package Manager nativo en Windows 10 y 11)
where winget >nul 2>&1
if %errorlevel% equ 0 (
    echo    [Metodo 1] Instalando Node.js LTS mediante Windows Package Manager (winget)...
    winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements >nul 2>&1
    set "PATH=%PATH%;C:\Program Files\nodejs;%LOCALAPPDATA%\Programs\nodejs;%APPDATA%\npm"
    where node >nul 2>&1
    if %errorlevel% equ 0 (
        echo    Instalacion con winget exitosa!
        goto :NODE_INSTALLED
    )
)

:: Intento 2: Descarga e instalacion desatendida del instalador oficial MSI de Node.js LTS
echo    [Metodo 2] Descargando e instalando paquete oficial Node.js LTS (msi)...
set NODE_MSI_URL=https://nodejs.org/dist/v20.18.0/node-v20.18.0-%NODE_ARCH%.msi
set NODE_MSI_TEMP=%TEMP%\node_setup_%NODE_ARCH%.msi

powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Write-Host '    Descargando Node.js LTS...'; (New-Object Net.WebClient).DownloadFile('%NODE_MSI_URL%', '%NODE_MSI_TEMP%')"
if exist "%NODE_MSI_TEMP%" (
    echo    Ejecutando instalador silencioso de Node.js...
    msiexec /i "%NODE_MSI_TEMP%" /qn /norestart
    del /f /q "%NODE_MSI_TEMP%" >nul 2>&1
    
    :: Actualizar variables de entorno en la sesion actual
    set "PATH=%PATH%;C:\Program Files\nodejs;%LOCALAPPDATA%\Programs\nodejs;%APPDATA%\npm"
    timeout /t 2 /nobreak >nul
    where node >nul 2>&1
    if %errorlevel% equ 0 (
        echo    Node.js instalado y configurado correctamente!
        goto :NODE_INSTALLED
    )
)

:: Intento 3: Node.js Portatil (No requiere permisos de Administrador)
echo    [Metodo 3] Descargando version portatil de Node.js (modo sin permisos de administrador)...
set NODE_ZIP_URL=https://nodejs.org/dist/v20.18.0/node-v20.18.0-win-%NODE_ARCH%.zip
set NODE_ZIP_TEMP=%TEMP%\node_portable.zip

powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Write-Host '    Descargando archivo portatil...'; (New-Object Net.WebClient).DownloadFile('%NODE_ZIP_URL%', '%NODE_ZIP_TEMP%'); Write-Host '    Descomprimiendo en carpeta local tools...'; Expand-Archive -Path '%NODE_ZIP_TEMP%' -DestinationPath '%TEMP%\node_extract' -Force; if (-not (Test-Path '%~dp0tools')) { New-Item -ItemType Directory -Path '%~dp0tools' | Out-Null }; Move-Item -Path '%TEMP%\node_extract\node-v20.18.0-win-%NODE_ARCH%' -Destination '%~dp0tools\node' -Force; Remove-Item -Recurse -Force '%TEMP%\node_extract' -ErrorAction SilentlyContinue"

del /f /q "%NODE_ZIP_TEMP%" >nul 2>&1

set "PATH=%PATH%;%~dp0tools\node"
if exist "%~dp0tools\node\node.exe" (
    echo    Node.js portatil instalado con exito en tools\node!
    goto :NODE_INSTALLED
)

:: Si todos los metodos fallaron
echo.
echo =====================================================================
echo [ERROR] No se pudo descargar automaticamente Node.js.
echo Por favor verifica tu conexion a internet e intenta nuevamente.
echo =====================================================================
pause
exit /b 1

:NODE_INSTALLED
echo.
echo [Paso 2/4] Instalando dependencias del Backend...
cd backend
call npm install --no-audit --no-fund
if errorlevel 1 (
    echo [ERROR] Fallo al instalar las dependencias del backend.
    cd ..
    pause
    exit /b 1
)
cd ..
echo    Dependencias del backend listas!

echo.
echo [Paso 3/4] Verificando Frontend...
if not exist "frontend\dist\index.html" (
    echo    Compilando interfaz web de produccion...
    cd frontend
    call npm install --no-audit --no-fund
    call npm run build
    cd ..
    echo    Frontend compilado correctamente!
) else (
    echo    Frontend compilado ya presente y listo.
)

echo.
echo [Paso 4/4] Creando Acceso Directo en el Escritorio...
set SCRIPT_TARGET=%~dp0EJECUTAR_APPDANGIOLA.bat
set LINK_TARGET=%USERPROFILE%\Desktop\App Dangiola.lnk
powershell -NoProfile -Command "try { $ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%LINK_TARGET%'); $s.TargetPath = '%SCRIPT_TARGET%'; $s.WorkingDirectory = '%~dp0'; $s.IconLocation = 'shell32.dll,23'; $s.Save(); } catch {}" >nul 2>&1
if exist "%LINK_TARGET%" (
    echo    Acceso directo creado en el Escritorio: App Dangiola.lnk
)

echo.
echo =====================================================================
echo   INSTALACION COMPLETA Y EXITOSA!
echo =====================================================================
echo   Tu estacion de trabajo en Windows quedo 100%% configurada.
echo.
echo   Para iniciar la aplicacion en cualquier momento:
echo   - Haz doble clic en el acceso directo 'App Dangiola' de tu Escritorio, o
echo   - Haz doble clic en: EJECUTAR_APPDANGIOLA.bat
echo.
echo   La aplicacion se abrira automaticamente en: http://localhost:5001
echo =====================================================================
echo.
pause
