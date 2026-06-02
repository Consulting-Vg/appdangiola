-- Database Schema for Carpas D'Angiola ERP

-- Drop tables if they exist (for clean migration/reset)
DROP TABLE IF EXISTS chat_mensajes CASCADE;
DROP TABLE IF EXISTS ordenes_desarme CASCADE;
DROP TABLE IF EXISTS ordenes_trabajo CASCADE;
DROP TABLE IF EXISTS inventario_accesorios CASCADE;
DROP TABLE IF EXISTS base_fijo CASCADE;
DROP TABLE IF EXISTS base_modulo CASCADE;
DROP TABLE IF EXISTS base_arco CASCADE;
DROP TABLE IF EXISTS estructuras_maestras CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS personal CASCADE;
DROP TABLE IF EXISTS recursos CASCADE;
DROP TABLE IF EXISTS vendedores CASCADE;

-- 0. Usuarios
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    rol VARCHAR(50) NOT NULL, -- 'Comercial', 'Operaciones', 'Gerencia', 'Operario', 'Chofer', 'SuperAdmin'
    modulos VARCHAR(255) DEFAULT '[]',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 1. Clientes
CREATE TABLE clientes (
    id SERIAL PRIMARY KEY,
    cuenta VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    actividad VARCHAR(100),
    estado VARCHAR(50),
    observacion TEXT,
    domicilio VARCHAR(255),
    localidad VARCHAR(100),
    provincia VARCHAR(100),
    pais VARCHAR(100) DEFAULT 'ARGENTINA',
    telefono VARCHAR(100),
    email VARCHAR(255),
    cuit VARCHAR(50),
    vendedores VARCHAR(255),
    responsables VARCHAR(255),
    latitud DECIMAL(9, 6),
    longitud DECIMAL(9, 6),
    fecha_alta TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Estructuras Maestras
CREATE TABLE estructuras_maestras (
    id SERIAL PRIMARY KEY,
    modelo_estructura VARCHAR(100) UNIQUE NOT NULL,
    arcos_totales INT NOT NULL DEFAULT 0,
    estructura_tipo VARCHAR(100) NOT NULL, -- e.g. 'Aluminio', 'Acero'
    frente DECIMAL(10, 2) NOT NULL,
    largo_maximo DECIMAL(10, 2) NOT NULL,
    arcos_disponibles INT NOT NULL DEFAULT 0
);

-- 3. Base Arco (Componentes por pórtico/arco)
CREATE TABLE base_arco (
    id SERIAL PRIMARY KEY,
    producto VARCHAR(255) NOT NULL,
    arco VARCHAR(100) NOT NULL, -- e.g. 'C10-L1_A1'
    modelo_estructura VARCHAR(100) NOT NULL REFERENCES estructuras_maestras(modelo_estructura) ON DELETE CASCADE,
    sector VARCHAR(50) NOT NULL, -- 'Planta' or 'Pañol'
    qty_fija_arco INT NOT NULL DEFAULT 0
);

-- 4. Base Modulo (Componentes por módulo de extensión)
CREATE TABLE base_modulo (
    id SERIAL PRIMARY KEY,
    producto VARCHAR(255) NOT NULL,
    modelo_estructura VARCHAR(100) NOT NULL REFERENCES estructuras_maestras(modelo_estructura) ON DELETE CASCADE,
    sector VARCHAR(50) NOT NULL, -- 'Planta' or 'Pañol'
    modulacion INT NOT NULL, -- length of module, e.g. 5, 2
    stock_inicial INT NOT NULL DEFAULT 0,
    modulo_val VARCHAR(100)
);

-- 5. Base Fijo (Componentes fijos por carpa)
CREATE TABLE base_fijo (
    id SERIAL PRIMARY KEY,
    producto VARCHAR(255) NOT NULL,
    modelo_estructura VARCHAR(100) NOT NULL REFERENCES estructuras_maestras(modelo_estructura) ON DELETE CASCADE,
    sector VARCHAR(50) NOT NULL, -- 'Planta' or 'Pañol'
    qty_fija_carpa INT NOT NULL DEFAULT 0
);

-- 6. Inventario Accesorios (Pisos, Lonas, Telas, Alfombras, etc.)
CREATE TABLE inventario_accesorios (
    id SERIAL PRIMARY KEY,
    categoria VARCHAR(50) NOT NULL, -- 'piso', 'alfombra', 'tela', 'lona'
    nombre VARCHAR(255) NOT NULL,
    color VARCHAR(100),
    tipo VARCHAR(100), -- 'Paño', 'Lateral', 'Triangulo', 'Nuevo', 'Usado'
    medida VARCHAR(100), -- e.g. '10x5', '3'
    estado VARCHAR(100), -- 'Nueva', 'Usada', 'Regular'
    stock_total INT NOT NULL DEFAULT 0
);

-- 7. Ordenes de Trabajo (OTs)
CREATE TABLE ordenes_trabajo (
    id SERIAL PRIMARY KEY,
    ot_numero VARCHAR(50) UNIQUE NOT NULL,
    cliente_id INT NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    modelo_estructura VARCHAR(100) NOT NULL REFERENCES estructuras_maestras(modelo_estructura) ON DELETE RESTRICT,
    estructura_tipo VARCHAR(100) NOT NULL, -- 'Aluminio' or 'Acero'
    frente DECIMAL(10, 2) NOT NULL,
    largo DECIMAL(10, 2) NOT NULL,
    superficie DECIMAL(10, 2) NOT NULL,
    modulacion_config JSONB NOT NULL, -- e.g. {"tipo": "compuesta", "modulos": [{"largo": 5, "qty": 2}, {"largo": 2, "qty": 1}]}
    adicionales JSONB NOT NULL, -- e.g. {"lonas": {"si": true, "color": "Blanco"}, "pisos": {"si": true, "tipo": "Fenolico Estandar"}, ...}
    georef JSONB NOT NULL, -- e.g. {"direccion": "...", "lat": -34.6, "lng": -58.4}
    estado VARCHAR(50) NOT NULL DEFAULT 'Pendiente', -- 'Pendiente', 'Aprobada', 'Bulto Completo', 'En Planta', 'Completada', 'Cancelada'
    panol_status JSONB NOT NULL, -- Checklist for Pañol: { "items": [ { "producto": "...", "qty": 2, "checked": false } ] }
    planta_status JSONB NOT NULL, -- Checklist for Planta: { "items": [ { "producto": "...", "qty": 4, "checked": false } ] }
    creado_por VARCHAR(100),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_evento DATE,
    observaciones TEXT,
    fecha_traslado TIMESTAMP,
    fecha_comienzo_armado TIMESTAMP,
    fecha_comienzo_desarmado TIMESTAMP,
    fecha_retorno TIMESTAMP
);

-- 7b. Ordenes de Desarme (Logística Inversa)
CREATE TABLE ordenes_desarme (
    id SERIAL PRIMARY KEY,
    ot_origen_id INT NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
    retorno_completo BOOLEAN NOT NULL,
    destinos JSONB NOT NULL, -- list of destinations and items
    remitos JSONB NOT NULL, -- copy of the generated remitos
    creado_por VARCHAR(100),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indices para optimización de consultas de stock en el tiempo
CREATE INDEX idx_ot_fechas ON ordenes_trabajo(fecha_inicio, fecha_fin);
CREATE INDEX idx_ot_estado ON ordenes_trabajo(estado);

-- 8. Chat Mensajes
CREATE TABLE chat_mensajes (
    id SERIAL PRIMARY KEY,
    ot_id INT NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
    usuario VARCHAR(100) NOT NULL,
    rol VARCHAR(50) NOT NULL,
    mensaje TEXT NOT NULL,
    fecha_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chat_ot ON chat_mensajes(ot_id);

-- 9. Transacciones Log
CREATE TABLE log_transacciones (
    id SERIAL PRIMARY KEY,
    ot_id INT NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
    ot_numero VARCHAR(50) NOT NULL,
    usuario VARCHAR(100) NOT NULL,
    rol VARCHAR(50) NOT NULL,
    accion VARCHAR(100) NOT NULL,
    detalles TEXT,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_log_ot ON log_transacciones(ot_id);

-- 10. Ventas Históricas (Dashboard de Gerencia BI)
-- Esta tabla recibe los datos del sistema anterior (importación CSV)
-- y también se auto-nutre de las nuevas OTs generadas en este sistema.
CREATE TABLE IF NOT EXISTS ventas_historicas (
    id SERIAL PRIMARY KEY,
    fecha_alta DATE,
    fecha_armado DATE NOT NULL,
    fecha_desarme DATE NOT NULL,
    cliente_nombre VARCHAR(255) NOT NULL,
    cliente_cuenta VARCHAR(50),
    vendedor VARCHAR(255),
    carpa_raw TEXT,              -- Campo original con posibles | separadores
    superficie_m2 DECIMAL(10,2),
    localidad VARCHAR(100),
    provincia VARCHAR(100),
    latitud DECIMAL(9,6),
    longitud DECIMAL(9,6),
    piso BOOLEAN DEFAULT FALSE,
    tarima BOOLEAN DEFAULT FALSE,
    alfombra BOOLEAN DEFAULT FALSE,
    cortina BOOLEAN DEFAULT FALSE,
    tribuna BOOLEAN DEFAULT FALSE,
    sillas BOOLEAN DEFAULT FALSE,
    adicionales_raw TEXT,        -- texto libre original del sistema anterior
    condicion_fiscal VARCHAR(50),
    condicion_pago VARCHAR(50),
    origen VARCHAR(20) DEFAULT 'historico', -- 'historico' o 'sistema_actual'
    ot_id INT REFERENCES ordenes_trabajo(id) ON DELETE SET NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vh_fechas ON ventas_historicas(fecha_armado, fecha_desarme);
CREATE INDEX IF NOT EXISTS idx_vh_cliente ON ventas_historicas(cliente_nombre);
CREATE INDEX IF NOT EXISTS idx_vh_vendedor ON ventas_historicas(vendedor);

-- 11. Personal de la empresa
CREATE TABLE IF NOT EXISTS personal (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    cuit VARCHAR(20),
    telefono VARCHAR(50),
    rol_funcion VARCHAR(100) NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 12. Recursos de la empresa (Camiones, Maquinaria, etc.)
CREATE TABLE IF NOT EXISTS recursos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    tipo VARCHAR(100) NOT NULL, -- 'Vehículo / Camión', 'Maquinaria', 'Herramienta', 'Otro'
    patente_identificador VARCHAR(50),
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 13. Vendedores
CREATE TABLE IF NOT EXISTS vendedores (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) UNIQUE NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
