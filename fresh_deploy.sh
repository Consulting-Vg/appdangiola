#!/bin/bash
# ============================================================
# Nueva App Dangiola – FRESH DEPLOY (borra todo y empieza de 0)
# Corre este script desde tu Terminal externa
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if command -v gcloud &> /dev/null; then
  GCLOUD="gcloud"
else
  GCLOUD="$HOME/Downloads/google-cloud-sdk/bin/gcloud"
fi

# ── Configuración ──────────────────────────────────────────
PROJECT="gobiernoia-500314"
REGION="us-central1"
SERVICE_NAME="dangiola-app"
SQL_INSTANCE="dangiola-db-v2"         # Nombre nuevo (GCP reserva el nombre viejo 7 días)
DB_NAME="dangiola"
DB_USER="postgres"           # Usamos postgres (superusuario) — evita problemas de permisos
DB_PASSWORD_HINT="(la que seteaste con set-password)"

echo "======================================================"
echo " 🔄 FRESH DEPLOY — Nueva App Dangiola"
echo "======================================================"
echo ""
echo "⚠️  ATENCIÓN: Esto va a BORRAR todo lo existente en GCP:"
echo "   • Cloud Run service: $SERVICE_NAME"
echo "   • Cloud SQL instance: $SQL_INSTANCE (con TODOS los datos)"
echo ""
echo "¿Estás seguro? Escribí 'SI' para continuar:"
read CONFIRM
if [ "$CONFIRM" != "SI" ]; then
  echo "Operación cancelada."
  exit 0
fi

echo ""
echo "Ingresá la contraseña del usuario postgres de Cloud SQL"
echo "(la que seteaste con gcloud sql users set-password):"
read -s POSTGRES_PASSWORD
if [ -z "$POSTGRES_PASSWORD" ]; then
  echo "ERROR: La contraseña no puede estar vacía."
  exit 1
fi

# URL-encode la contraseña (maneja símbolos especiales como @, !, #, etc.)
ENCODED_PASSWORD=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$POSTGRES_PASSWORD")
DATABASE_URL="postgresql://postgres:${ENCODED_PASSWORD}@/${DB_NAME}?host=/cloudsql/${PROJECT}:${REGION}:${SQL_INSTANCE}"

echo ""
"$GCLOUD" config set account paliviggiano@gmail.com
"$GCLOUD" config set project "$PROJECT"

# ── PASO 1: Borrar Cloud Run service ──────────────────────
echo ""
echo "[1/5] Eliminando Cloud Run service '$SERVICE_NAME'..."
"$GCLOUD" run services delete "$SERVICE_NAME" \
  --region "$REGION" \
  --project "$PROJECT" \
  --quiet 2>/dev/null || echo "  ℹ️  El servicio no existía, continuando..."

# ── PASO 2: Borrar Cloud SQL instance ─────────────────────
echo ""
echo "[2/5] Eliminando Cloud SQL instance '$SQL_INSTANCE'..."
echo "  Esto puede tardar 2-3 minutos..."
"$GCLOUD" sql instances delete "$SQL_INSTANCE" \
  --project "$PROJECT" \
  --quiet 2>/dev/null || echo "  ℹ️  La instancia no existía, continuando..."

# ── PASO 3: Crear nueva Cloud SQL instance ─────────────────
echo ""
echo "[3/5] Creando nueva instancia Cloud SQL '$SQL_INSTANCE'..."
echo "  Esto puede tardar 5-8 minutos..."
"$GCLOUD" sql instances create "$SQL_INSTANCE" \
  --database-version=POSTGRES_15 \
  --cpu=1 \
  --memory=3840MB \
  --region="$REGION" \
  --project="$PROJECT" \
  --root-password="$POSTGRES_PASSWORD" \
  --database-flags=cloudsql.iam_authentication=off \
  --no-backup \
  --quiet

echo "  ✅ Instancia creada."

# ── PASO 4: Crear la base de datos ─────────────────────────
echo ""
echo "[4/5] Creando base de datos '$DB_NAME'..."
"$GCLOUD" sql databases create "$DB_NAME" \
  --instance="$SQL_INSTANCE" \
  --project="$PROJECT" \
  --quiet

echo "  ✅ Base de datos '$DB_NAME' creada."

# ── PASO 5: Deploy de la aplicación ───────────────────────
echo ""
echo "[5/5] Desplegando '$SERVICE_NAME' en Cloud Run..."
echo "  Esto puede tardar 3-5 minutos (build del Docker image)..."
"$GCLOUD" run deploy "$SERVICE_NAME" \
  --source . \
  --region "$REGION" \
  --project "$PROJECT" \
  --allow-unauthenticated \
  --add-cloudsql-instances="${PROJECT}:${REGION}:${SQL_INSTANCE}" \
  --set-env-vars=DATABASE_URL="${DATABASE_URL}",NODE_ENV="production" \
  --quiet

echo ""
echo "[INFO] URL del servicio:"
APP_URL=$("$GCLOUD" run services describe "$SERVICE_NAME" \
  --region "$REGION" \
  --project "$PROJECT" \
  --format="value(status.url)")

echo "  $APP_URL"
echo ""
echo "======================================================"
echo " ✅ FRESH DEPLOY COMPLETADO"
echo "======================================================"
echo ""
echo " App:    $APP_URL"
echo " Health: ${APP_URL}/health"
echo ""
echo " Verificá que la DB esté OK visitando /health"
echo " Debería mostrar: {\"status\":\"OK\",\"db\":\"postgresql\",...}"
echo "======================================================"
