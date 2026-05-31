import os
import glob
import pandas as pd
import json

workspace_dir = "/Users/pabloviggiano/Desktop/Carpas/Nueva App Dangiola"
backend_dir = os.path.join(workspace_dir, "backend")
data_dir = os.path.join(backend_dir, "data")
os.makedirs(data_dir, exist_ok=True)

db_data = {
    "clientes": [],
    "estructuras_maestras": [],
    "base_arco": [],
    "base_modulo": [],
    "base_fijo": [],
    "inventario_accesorios": [],
    "ordenes_trabajo": [],
    "chat_mensajes": [],
    "usuarios": []
}

sql_statements = []

def clean_val(val, default=None):
    if pd.isna(val):
        return default
    if isinstance(val, float) and val.is_integer():
        return int(val)
    return val

def clean_sql_str(val):
    if val is None:
        return "NULL"
    s = str(val).replace("'", "''")
    return f"'{s}'"

def clean_sql_num(val):
    if val is None:
        return "NULL"
    return str(val)

# 1. Parse clientes.csv
clientes_path = os.path.join(workspace_dir, "clientes.csv")
if os.path.exists(clientes_path):
    print("Parsing Clientes...")
    df = pd.read_csv(clientes_path)
    for idx, row in df.iterrows():
        cuit = clean_val(row.get("CUIT"))
        cuenta = clean_val(row.get("Cuenta"))
        if not cuenta:
            cuenta = f"CL-{idx+1}"
        cliente = {
            "id": idx + 1,
            "cuenta": str(cuenta),
            "nombre": str(clean_val(row.get("Nombre"), "Cliente sin nombre")),
            "actividad": clean_val(row.get("Actividad")),
            "estado": clean_val(row.get("Estado")),
            "observacion": clean_val(row.get("Observación")),
            "domicilio": clean_val(row.get("Domicilio")),
            "localidad": clean_val(row.get("Localidad")),
            "provincia": clean_val(row.get("Provincia")),
            "pais": clean_val(row.get("País"), "ARGENTINA"),
            "telefono": clean_val(row.get("Teléfono")),
            "email": clean_val(row.get("Email_1")),
            "cuit": str(cuit) if cuit else None,
            "vendedores": clean_val(row.get("Vendedores")),
            "responsables": clean_val(row.get("Responsables")),
            "latitud": clean_val(row.get("Latitud")),
            "longitud": clean_val(row.get("Longitud"))
        }
        db_data["clientes"].append(cliente)
        
        sql = f"INSERT INTO clientes (id, cuenta, nombre, actividad, estado, observacion, domicilio, localidad, provincia, pais, telefono, email, cuit, vendedores, responsables, latitud, longitud) VALUES ({cliente['id']}, {clean_sql_str(cliente['cuenta'])}, {clean_sql_str(cliente['nombre'])}, {clean_sql_str(cliente['actividad'])}, {clean_sql_str(cliente['estado'])}, {clean_sql_str(cliente['observacion'])}, {clean_sql_str(cliente['domicilio'])}, {clean_sql_str(cliente['localidad'])}, {clean_sql_str(cliente['provincia'])}, {clean_sql_str(cliente['pais'])}, {clean_sql_str(cliente['telefono'])}, {clean_sql_str(cliente['email'])}, {clean_sql_str(cliente['cuit'])}, {clean_sql_str(cliente['vendedores'])}, {clean_sql_str(cliente['responsables'])}, {clean_sql_num(cliente['latitud'])}, {clean_sql_num(cliente['longitud'])});"
        sql_statements.append(sql)

# 2. Parse estructuras.xlsx
est_path = os.path.join(workspace_dir, "estructuras.xlsx")
if os.path.exists(est_path):
    print("Parsing Estructuras Maestras...")
    df = pd.read_excel(est_path, sheet_name="Hoja1")
    for idx, row in df.iterrows():
        modelo = clean_val(row.get("Modelo_Estructura"))
        if not modelo:
            continue
        est = {
            "id": idx + 1,
            "modelo_estructura": str(modelo),
            "arcos_totales": int(clean_val(row.get("Arcos totales"), 0)),
            "estructura_tipo": str(clean_val(row.get("Estructura"), "Aluminio")),
            "frente": float(clean_val(row.get("Frente"), 0.0)),
            "largo_maximo": float(clean_val(row.get("Largo_Maximo"), 0.0)),
            "arcos_disponibles": int(clean_val(row.get("Arcos_Disponibles_Seleccion"), 0))
        }
        db_data["estructuras_maestras"].append(est)
        
        sql = f"INSERT INTO estructuras_maestras (id, modelo_estructura, arcos_totales, estructura_tipo, frente, largo_maximo, arcos_disponibles) VALUES ({est['id']}, {clean_sql_str(est['modelo_estructura'])}, {est['arcos_totales']}, {clean_sql_str(est['estructura_tipo'])}, {est['frente']}, {est['largo_maximo']}, {est['arcos_disponibles']});"
        sql_statements.append(sql)

# 3. Parse arcos.xlsx
arcos_path = os.path.join(workspace_dir, "arcos.xlsx")
if os.path.exists(arcos_path):
    print("Parsing Base Arco...")
    df = pd.read_excel(arcos_path, sheet_name="ARCOS")
    for idx, row in df.iterrows():
        prod = clean_val(row.get("Producto"))
        if not prod:
            continue
        arco = {
            "id": idx + 1,
            "producto": str(prod),
            "arco": str(clean_val(row.get("Arco"))),
            "modelo_estructura": str(clean_val(row.get("Modelo_Estructura"))),
            "sector": str(clean_val(row.get("Sector"), "Planta")),
            "qty_fija_arco": int(clean_val(row.get("Qty_fija_arco"), 0))
        }
        db_data["base_arco"].append(arco)
        
        sql = f"INSERT INTO base_arco (id, producto, arco, modelo_estructura, sector, qty_fija_arco) VALUES ({arco['id']}, {clean_sql_str(arco['producto'])}, {clean_sql_str(arco['arco'])}, {clean_sql_str(arco['modelo_estructura'])}, {clean_sql_str(arco['sector'])}, {arco['qty_fija_arco']});"
        sql_statements.append(sql)

# 4. Parse modulos.xlsx
mod_path = os.path.join(workspace_dir, "modulos.xlsx")
if os.path.exists(mod_path):
    print("Parsing Base Modulo...")
    df = pd.read_excel(mod_path, sheet_name="MODULOS")
    for idx, row in df.iterrows():
        prod = clean_val(row.get("Producto"))
        if not prod:
            continue
        # Map Modulo column to modelo_estructura
        modulo_val = str(clean_val(row.get("Modulo"), "")).strip()
        
        # Split by last '-' or '_' to separate the suffix (like M1, M2, F)
        if '_' in modulo_val:
            parts = modulo_val.rsplit('_', 1)
        else:
            parts = modulo_val.rsplit('-', 1)
            
        if len(parts) > 1 and (parts[1].startswith('M') or parts[1] == 'F'):
            base_model = parts[0]
        else:
            base_model = modulo_val
        
        if "2MTS" in base_model or "3MTS" in base_model:
            base_model = base_model.replace("-", "_")

        # Support both Qty_fija_modulo and Qty-fija-modulo
        qty_fija = clean_val(row.get("Qty_fija_modulo") if "Qty_fija_modulo" in df.columns else row.get("Qty-fija-modulo"), 10)

        mod = {
            "id": idx + 1,
            "producto": str(prod),
            "modelo_estructura": str(base_model),
            "sector": str(clean_val(row.get("Sector"), "Planta")),
            "modulacion": int(clean_val(row.get("Modulacion"), 5)),
            "stock_inicial": int(qty_fija),
            "modulo_val": str(modulo_val)
        }
        db_data["base_modulo"].append(mod)
        
        sql = f"INSERT INTO base_modulo (id, producto, modelo_estructura, sector, modulacion, stock_inicial, modulo_val) VALUES ({mod['id']}, {clean_sql_str(mod['producto'])}, {clean_sql_str(mod['modelo_estructura'])}, {clean_sql_str(mod['sector'])}, {mod['modulacion']}, {mod['stock_inicial']}, {clean_sql_str(mod['modulo_val'])});"
        sql_statements.append(sql)

# 5. Parse fijos.xlsx
fijos_path = os.path.join(workspace_dir, "fijos.xlsx")
if os.path.exists(fijos_path):
    print("Parsing Base Fijo...")
    df = pd.read_excel(fijos_path, sheet_name="FIJOS")
    for idx, row in df.iterrows():
        prod = clean_val(row.get("Producto"))
        if not prod:
            continue
        # Map Fijos column to modelo_estructura
        fijo_val = str(clean_val(row.get("Fijos"), "")).strip()
        if '_' in fijo_val:
            parts = fijo_val.rsplit('_', 1)
        else:
            parts = fijo_val.rsplit('-', 1)
            
        if len(parts) > 1 and parts[1] == 'F':
            base_model = parts[0]
        else:
            base_model = fijo_val

        if "2MTS" in base_model or "3MTS" in base_model:
            base_model = base_model.replace("-", "_")

        # Support both Qty_fija_carpa and Qty-fija-carpa
        qty_fija_carpa = clean_val(row.get("Qty_fija_carpa") if "Qty_fija_carpa" in df.columns else row.get("Qty-fija-carpa"), 0)

        fijo = {
            "id": idx + 1,
            "producto": str(prod),
            "modelo_estructura": str(base_model),
            "sector": str(clean_val(row.get("Sector"), "Planta")),
            "qty_fija_carpa": int(qty_fija_carpa)
        }
        db_data["base_fijo"].append(fijo)
        
        sql = f"INSERT INTO base_fijo (id, producto, modelo_estructura, sector, qty_fija_carpa) VALUES ({fijo['id']}, {clean_sql_str(fijo['producto'])}, {clean_sql_str(fijo['modelo_estructura'])}, {clean_sql_str(fijo['sector'])}, {fijo['qty_fija_carpa']});"
        sql_statements.append(sql)

# 6. Parse Accessories (Pisos, Lonas, Telas, Alfombras)
acc_id = 1

# Floors
floors_path = os.path.join(workspace_dir, "pisos.xlsx")
if os.path.exists(floors_path):
    print("Parsing Pisos...")
    df = pd.read_excel(floors_path, sheet_name="PISOS")
    for idx, row in df.iterrows():
        est = clean_val(row.get("Estructura"))
        if not est:
            continue
        acc = {
            "id": acc_id,
            "categoria": "piso",
            "nombre": str(est),
            "color": None,
            "tipo": None,
            "medida": str(clean_val(row.get("Medida"))),
            "estado": str(clean_val(row.get("Estado"), "Regular")),
            "stock_total": int(clean_val(row.get("Cantidad"), 0))
        }
        db_data["inventario_accesorios"].append(acc)
        sql = f"INSERT INTO inventario_accesorios (id, categoria, nombre, color, tipo, medida, estado, stock_total) VALUES ({acc['id']}, 'piso', {clean_sql_str(acc['nombre'])}, NULL, NULL, {clean_sql_str(acc['medida'])}, {clean_sql_str(acc['estado'])}, {acc['stock_total']});"
        sql_statements.append(sql)
        acc_id += 1

# Lonas
lonas_path = os.path.join(workspace_dir, "lonas.xlsx")
if os.path.exists(lonas_path):
    print("Parsing Lonas...")
    df = pd.read_excel(lonas_path, sheet_name="LONAS")
    for idx, row in df.iterrows():
        color = clean_val(row.get("Color"))
        tipo = clean_val(row.get("Tipo"))
        if not color or not tipo:
            continue
        medida = clean_val(row.get("Medida"))
        acc = {
            "id": acc_id,
            "categoria": "lona",
            "nombre": f"Lona {tipo} {color} {medida if medida else ''}".strip(),
            "color": str(color),
            "tipo": str(tipo),
            "medida": str(medida) if medida else None,
            "estado": "Regular",
            "stock_total": int(clean_val(row.get("Cantidad"), 0))
        }
        db_data["inventario_accesorios"].append(acc)
        sql = f"INSERT INTO inventario_accesorios (id, categoria, nombre, color, tipo, medida, estado, stock_total) VALUES ({acc['id']}, 'lona', {clean_sql_str(acc['nombre'])}, {clean_sql_str(acc['color'])}, {clean_sql_str(acc['tipo'])}, {clean_sql_str(acc['medida'])}, 'Regular', {acc['stock_total']});"
        sql_statements.append(sql)
        acc_id += 1

# Telas
telas_path = os.path.join(workspace_dir, "telas.xlsx")
if os.path.exists(telas_path):
    print("Parsing Telas...")
    df = pd.read_excel(telas_path, sheet_name="TELAS")
    for idx, row in df.iterrows():
        color = clean_val(row.get("Color"))
        tipo_cortina = clean_val(row.get("Cortina"))
        if not color or not tipo_cortina:
            continue
        acc = {
            "id": acc_id,
            "categoria": "tela",
            "nombre": f"Tela {tipo_cortina} {color}",
            "color": str(color),
            "tipo": str(tipo_cortina),
            "medida": None,
            "estado": str(clean_val(row.get("Tipo"), "Nuevo")),
            "stock_total": int(clean_val(row.get("Stock"), 0))
        }
        db_data["inventario_accesorios"].append(acc)
        sql = f"INSERT INTO inventario_accesorios (id, categoria, nombre, color, tipo, medida, estado, stock_total) VALUES ({acc['id']}, 'tela', {clean_sql_str(acc['nombre'])}, {clean_sql_str(acc['color'])}, {clean_sql_str(acc['tipo'])}, NULL, {clean_sql_str(acc['estado'])}, {acc['stock_total']});"
        sql_statements.append(sql)
        acc_id += 1

# Alfombras
alf_path = os.path.join(workspace_dir, "alfombras.xlsx")
if os.path.exists(alf_path):
    print("Parsing Alfombras...")
    df = pd.read_excel(alf_path, sheet_name="ALFOMBRAS")
    for idx, row in df.iterrows():
        color = clean_val(row.get("Colores"))
        if not color:
            continue
        acc = {
            "id": acc_id,
            "categoria": "alfombra",
            "nombre": f"Alfombra {color}",
            "color": str(color),
            "tipo": None,
            "medida": None,
            "estado": str(clean_val(row.get("Estado"), "Nueva")),
            "stock_total": int(clean_val(row.get("Metros"), 0))
        }
        db_data["inventario_accesorios"].append(acc)
        sql = f"INSERT INTO inventario_accesorios (id, categoria, nombre, color, tipo, medida, estado, stock_total) VALUES ({acc['id']}, 'alfombra', {clean_sql_str(acc['nombre'])}, {clean_sql_str(acc['color'])}, NULL, NULL, {clean_sql_str(acc['estado'])}, {acc['stock_total']});"
        sql_statements.append(sql)
        acc_id += 1

# Additional default chairs and tribunes to make sure stock controls work
additional_accessories = [
    {"id": acc_id, "categoria": "silla", "nombre": "Sillas Plásticas Blancas", "color": "Blanco", "tipo": "Plástica", "medida": "Estándar", "estado": "Regular", "stock_total": 500},
    {"id": acc_id + 1, "categoria": "tribuna", "nombre": "Módulo de Tribuna 10 Escalones", "color": "Metal", "tipo": "Móvil", "medida": "10x3", "estado": "Regular", "stock_total": 5}
]
for acc in additional_accessories:
    db_data["inventario_accesorios"].append(acc)
    sql = f"INSERT INTO inventario_accesorios (id, categoria, nombre, color, tipo, medida, estado, stock_total) VALUES ({acc['id']}, '{acc['categoria']}', {clean_sql_str(acc['nombre'])}, {clean_sql_str(acc['color'])}, {clean_sql_str(acc['tipo'])}, {clean_sql_str(acc['medida'])}, {clean_sql_str(acc['estado'])}, {acc['stock_total']});"
    sql_statements.append(sql)
    acc_id += 1

# Seed default users
default_users = [
    {"id": 1, "username": "admin", "nombre": "Super Administrador", "password": "admin", "rol": "SuperAdmin", "modulos": '["Comercial", "Operaciones", "Almacen"]'},
    {"id": 2, "username": "mariana", "nombre": "Mariana D´Angiola", "password": "comercial", "rol": "Comercial", "modulos": '["Comercial"]'},
    {"id": 3, "username": "luis", "nombre": "Luis Navarro", "password": "operaciones", "rol": "Operaciones", "modulos": '["Operaciones"]'},
    {"id": 4, "username": "gomez", "nombre": "Gómez (Planta)", "password": "planta", "rol": "Planta", "modulos": '["Almacen"]'},
    {"id": 5, "username": "fabian", "nombre": "Fabián (Pañol)", "password": "panol", "rol": "Pañol", "modulos": '["Almacen"]'},
    {"id": 6, "username": "lonas", "nombre": "Lonas Staff", "password": "lonas", "rol": "Lonas", "modulos": '["Almacen"]'},
    {"id": 7, "username": "pisos", "nombre": "Pisos Staff", "password": "pisos", "rol": "Pisos", "modulos": '["Almacen"]'},
    {"id": 8, "username": "telas", "nombre": "Telas Staff", "password": "telas", "rol": "Telas", "modulos": '["Almacen"]'},
    {"id": 9, "username": "chofer", "nombre": "Chofer de Despacho", "password": "chofer", "rol": "Chofer", "modulos": '["Chofer"]'}
]
for user in default_users:
    db_data["usuarios"].append(user)
    sql = f"INSERT INTO usuarios (id, username, nombre, password, rol, modulos) VALUES ({user['id']}, {clean_sql_str(user['username'])}, {clean_sql_str(user['nombre'])}, {clean_sql_str(user['password'])}, {clean_sql_str(user['rol'])}, {clean_sql_str(user['modulos'])});"
    sql_statements.append(sql)

# Save JSON DB fallback
json_db_path = os.path.join(data_dir, "db.json")
with open(json_db_path, "w", encoding="utf-8") as f:
    json.dump(db_data, f, indent=2, ensure_ascii=False)
print(f"Local JSON DB written to {json_db_path}")

# Save SQL seed file
sql_seed_path = os.path.join(backend_dir, "seed.sql")
with open(sql_seed_path, "w", encoding="utf-8") as f:
    f.write("-- Seed script for Carpas D'Angiola ERP\n")
    f.write("-- Populates tables with parsed historical spreadsheet data\n\n")
    f.write("BEGIN;\n\n")
    f.write("\n".join(sql_statements))
    f.write("\n\nCOMMIT;\n")
print(f"SQL Seed script written to {sql_seed_path}")
