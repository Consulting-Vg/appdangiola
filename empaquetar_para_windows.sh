#!/usr/bin/env bash
# =============================================================================
# EMPAQUETADOR DE APPDANGIOLA PARA ESTACION WINDOWS
# Ejecuta este script en la Mac (Cerebro / Laboratorio de Desarrollo)
# para generar el archivo ZIP de actualizacion para la estacion de campo (Windows).
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "====================================================================="
echo "   EMPAQUETADOR APPDANGIOLA: MAC (CEREBRO) -> WINDOWS (CAMPO)"
echo "====================================================================="
echo ""

# 1. Compilar Frontend en Mac para que Windows reciba los assets listos
echo "[1/3] Compilando Frontend para produccion..."
if [ -d "frontend" ]; then
    cd frontend
    if [ -f "package.json" ]; then
        if command -v npm &> /dev/null; then
            if [ ! -d "node_modules" ]; then
                echo "      Instalando dependencias de frontend..."
                npm install --silent
            fi
            echo "      Generando build optimizado en frontend/dist..."
            npm run build --silent || echo "      (Aviso: Vite build fallo o ya estaba listo, continuando...)"
        else
            echo "      (Aviso: npm no encontrado en PATH global, usando build existente de dist si existe)"
        fi
    fi
    cd ..
fi

# 2. Generar el paquete ZIP usando zip nativo de macOS (rapido, limpio y sin node_modules)
echo ""
echo "[2/3] Empaquetando archivos del sistema (excluyendo node_modules pesados de Mac)..."

ZIP_NAME="actualizacion_appdangiola.zip"
DATE_STR=$(date +"%Y%m%d_%H%M%S")
DATED_ZIP="actualizacion_appdangiola_${DATE_STR}.zip"

# Limpiar ZIP anterior si existiera
rm -f "$ZIP_NAME"

if command -v zip &> /dev/null; then
    zip -r "$ZIP_NAME" \
        backend \
        frontend \
        EJECUTAR_APPDANGIOLA.bat \
        ACTUALIZAR_APPDANGIOLA.bat \
        INSTALAR_TODO_WINDOWS.bat \
        INSTRUCCIONES_WINDOWS.md \
        modulos.csv \
        clientes.csv \
        *.xlsx \
        -x "*/node_modules/*" "*node_modules*" "*/.git/*" "*.DS_Store" "*__pycache__*" "*.venv*" "*.zip" ".env.secrets" "dangiola.db" > /dev/null
    echo "      Empaquetado completado con utilidad nativa zip."
else
    python3 - <<EOF
import os, zipfile
zip_filename = "$ZIP_NAME"
EXCLUDE = {'node_modules', '.git', '.venv', '__pycache__', '.DS_Store', '.env.secrets', 'dangiola.db'}
with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in EXCLUDE and not d.startswith('.')]
        for f in files:
            if f in EXCLUDE or f.endswith(('.zip', '.pyc', '.tmp', '.DS_Store')) or f.startswith('.'):
                continue
            p = os.path.join(root, f)
            zf.write(p, os.path.relpath(p, '.'))
print("      Empaquetado completado con Python.")
EOF
fi

# Crear copia con fecha
cp "$ZIP_NAME" "$DATED_ZIP"

ZIP_SIZE=$(du -h "$ZIP_NAME" | cut -f1)

echo ""
echo "[3/3] Paquete de actualizacion generado con exito!"
echo ""
echo "====================================================================="
echo "   PAQUETE LISTO: $ZIP_NAME ($ZIP_SIZE)"
echo "   COPIA CON FECHA: $DATED_ZIP"
echo "====================================================================="
echo ""
echo "INSTRUCCIONES PARA PASAR A LA ESTACION WINDOWS:"
echo "1. Copia el archivo '$ZIP_NAME' a la maquina Windows"
echo "   (por pendrive, red compartida, Google Drive, WhatsApp o Telegram)."
echo "2. Pega el archivo en la carpeta principal de la aplicacion en Windows."
echo "3. En Windows, ejecuta: ACTUALIZAR_APPDANGIOLA.bat"
echo "   (descomprimira e incorporara todo automaticamente)."
echo "4. Luego inicia la app con: EJECUTAR_APPDANGIOLA.bat"
echo "====================================================================="
echo ""
