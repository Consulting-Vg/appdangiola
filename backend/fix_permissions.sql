-- ============================================================
-- FIX PERMISOS: dangiola_user en el schema public
-- Ejecutar UNA SOLA VEZ como superusuario (postgres)
-- Necesario en PostgreSQL 15+ donde public ya no tiene permisos por defecto
-- ============================================================

-- 1. Permisos sobre el schema public
GRANT ALL ON SCHEMA public TO dangiola_user;

-- 2. Permisos sobre todas las tablas existentes
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO dangiola_user;

-- 3. Permisos sobre todas las secuencias existentes (necesario para SERIAL/autoincrement)
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO dangiola_user;

-- 4. Permisos por defecto para tablas y secuencias FUTURAS
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO dangiola_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO dangiola_user;

-- Verificar
SELECT grantee, privilege_type FROM information_schema.role_usage_grants WHERE object_schema = 'public';
