@echo off
title Actualizar App Dangiola - Parche desde Mac
color 0B

echo =====================================================================
echo          ACTUALIZADOR DE APPDANGIOLA (ESTACION DE CAMPO)
echo   Incorporacion de Parches y Actualizaciones desde Mac (Cerebro)
echo =====================================================================
echo.

cd /d "%~dp0"

:: 1. Buscar archivo ZIP de actualizacion
set ZIP_FILE=
if exist "actualizacion_appdangiola.zip" set ZIP_FILE=actualizacion_appdangiola.zip
if exist "actualizacion.zip" set ZIP_FILE=actualizacion.zip
if exist "appdangiola_patch.zip" set ZIP_FILE=appdangiola_patch.zip

if "%ZIP_FILE%"=="" (
    for %%f in (*actualizacion*.zip) do set ZIP_FILE=%%f
)
if "%ZIP_FILE%"=="" (
    for %%f in (*appdangiola*.zip) do set ZIP_FILE=%%f
)

if "%ZIP_FILE%"=="" (
    echo [INFO] No se encontro un archivo ZIP de actualizacion en la carpeta raiz.
    echo.
    echo Para actualizar:
    echo 1. En la Mac (Cerebro), ejecuta: ./empaquetar_para_windows.sh
    echo 2. Copia el archivo 'actualizacion_appdangiola.zip' generado a esta carpeta en Windows.
    echo 3. Vuelve a hacer doble clic en este archivo ACTUALIZAR_APPDANGIOLA.bat.
    echo.
    echo =====================================================================
    pause
    exit /b 0
)

echo [1/4] Archivo de actualizacion detectado: %ZIP_FILE%
echo [2/4] Descomprimiendo y aplicando cambios sobre la instalacion local...

:: Descomprimir ZIP sobreescribiendo archivos usando PowerShell
powershell -NoProfile -Command "Expand-Archive -Path '%ZIP_FILE%' -DestinationPath '.' -Force"
if errorlevel 1 (
    echo [ERROR] Hubo un problema al descomprimir el archivo %ZIP_FILE%.
    pause
    exit /b 1
)

:: 2. Actualizar dependencias de Backend si es necesario
echo.
echo [3/4] Verificando dependencias actualizadas de Node.js...
where npm >nul 2>&1
if %errorlevel% equ 0 (
    cd backend
    call npm install --no-audit --no-fund
    cd ..
)

:: 3. Mover ZIP a historial de actualizaciones
if not exist "actualizaciones_aplicadas" mkdir "actualizaciones_aplicadas"
move /y "%ZIP_FILE%" "actualizaciones_aplicadas\" >nul 2>&1

echo.
echo [4/4] Limpieza de temporales finalizada.
echo.
echo =====================================================================
echo   ACTUALIZACION DE APPDANGIOLA APLICADA EXITOSAMENTE!
echo =====================================================================
echo   Todos los cambios y soluciones desarrollados en la Mac (Cerebro)
echo   han sido incorporados a esta estacion de produccion.
echo.
echo   El archivo comprimido fue archivado en la carpeta 'actualizaciones_aplicadas\'.
echo.
echo   Para iniciar la aplicacion actualizada, ejecuta:
echo   👉 EJECUTAR_APPDANGIOLA.bat
echo =====================================================================
echo.
pause
