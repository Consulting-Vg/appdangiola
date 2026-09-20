#!/bin/bash
# ============================================================
# Nueva App Dangiola – Deploy a Cloud Run
# Corre este script desde tu Terminal externa
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# ── Configuración ──────────────────────────────────────────
ACCOUNT="paliviggiano@gmail.com"
PROJECT="gobiernoia-500314"
REGION="us-central1"
SERVICE_NAME="dangiola-app"
SQL_INSTANCE="dangiola-db-v2"    # Instancia activa (v2)
DB_NAME="dangiola"

if command -v gcloud &> /dev/null; then
  GCLOUD="gcloud"
else
  GCLOUD="$HOME/Downloads/google-cloud-sdk/bin/gcloud"
fi

echo "======================================================"
echo " 🚀 Nueva App Dangiola → Google Cloud Run Deploy"
echo " Cuenta:    $ACCOUNT"
echo " Proyecto:  $PROJECT"
echo " Instancia: $SQL_INSTANCE"
echo "======================================================"

# Verify gcloud is available
if [ "$GCLOUD" != "gcloud" ] && [ ! -f "$GCLOUD" ]; then
  echo "ERROR: gcloud no encontrado. Instale desde: https://cloud.google.com/sdk/docs/install"
  exit 1
fi

echo "[1/5] Configurando cuenta y proyecto..."
if ! "$GCLOUD" auth list --filter="account=$ACCOUNT" --format="value(account)" | grep -q "$ACCOUNT"; then
  echo "⚠️  La cuenta $ACCOUNT no está autenticada en gcloud."
  echo "Iniciando inicio de sesión en el navegador..."
  "$GCLOUD" auth login "$ACCOUNT"
fi

"$GCLOUD" config set account "$ACCOUNT"
"$GCLOUD" config set project "$PROJECT"

echo ""
echo "[2/5] Verificando y habilitando APIs de GCP requeridas..."
"$GCLOUD" services enable run.googleapis.com sqladmin.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project "$PROJECT" --quiet || true

# Cargar automáticamente desde .env.secrets si existe
if [ -f ".env.secrets" ]; then
  source .env.secrets
fi

if [ -n "$POSTGRES_DB_PASSWORD" ]; then
  echo ""
  echo "[3/5] Contraseña de Cloud SQL detectada en .env.secrets."
  POSTGRES_PASSWORD="$POSTGRES_DB_PASSWORD"
else
  echo ""
  echo "[3/5] Ingresá la contraseña del usuario postgres de Cloud SQL:"
  read -s POSTGRES_PASSWORD
  if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "ERROR: La contraseña no puede estar vacía."
    exit 1
  fi
fi

# Leer GEMINI_API_KEY desde backend/.env si no está en .env.secrets
if [ -z "$GEMINI_API_KEY" ]; then
  if [ -f "backend/.env" ]; then
    GEMINI_API_KEY=$(grep -E "^GEMINI_API_KEY=" backend/.env | cut -d'=' -f2- | tr -d '"' | tr -d "'")
  fi
fi

# URL-encode la contraseña (maneja @, !, #, etc.)
ENCODED_PASSWORD=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$POSTGRES_PASSWORD")

DATABASE_URL="postgresql://postgres:${ENCODED_PASSWORD}@/${DB_NAME}?host=/cloudsql/${PROJECT}:${REGION}:${SQL_INSTANCE}"

ENV_VARS="DATABASE_URL=${DATABASE_URL},NODE_ENV=production"
if [ -n "$GEMINI_API_KEY" ]; then
  ENV_VARS="${ENV_VARS},GEMINI_API_KEY=${GEMINI_API_KEY}"
fi

echo ""
echo "[4/5] Desplegando $SERVICE_NAME en Cloud Run ($REGION)..."
"$GCLOUD" run deploy "$SERVICE_NAME" \
  --source . \
  --project "$PROJECT" \
  --region "$REGION" \
  --allow-unauthenticated \
  --add-cloudsql-instances="${PROJECT}:${REGION}:${SQL_INSTANCE}" \
  --set-env-vars="${ENV_VARS}" \
  --quiet

echo ""
echo "[5/5] URL del servicio:"
APP_URL=$("$GCLOUD" run services describe "$SERVICE_NAME" \
  --project "$PROJECT" \
  --region "$REGION" \
  --format="value(status.url)")
echo "  $APP_URL"

echo ""
echo "======================================================"
echo " ✅ Deploy completado!"
echo " Health: ${APP_URL}/health"
echo "======================================================"
