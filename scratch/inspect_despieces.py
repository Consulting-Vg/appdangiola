import pandas as pd

df_arc = pd.read_excel('arcos.xlsx', sheet_name='ARCOS')
df_mod = pd.read_excel('modulos.xlsx', sheet_name='MODULOS')
df_fij = pd.read_excel('fijos.xlsx', sheet_name='FIJOS')

print('=== MODELOS EN ARCOS.XLSX ===')
for m in df_arc['Modelo_Estructura'].unique():
    sub = df_arc[df_arc['Modelo_Estructura'] == m]
    sub_a1 = sub[sub['Arco'] == f'{m}_A1']
    print(f'Modelo: {m} (Total rows: {len(sub)}, unique arches: {sub["Arco"].nunique()})')
    for idx, r in sub_a1.iterrows():
        print(f'   {r["Sector"]} | {r["Qty_fija_arco"]} | {r["Producto"]}')

print('\n=== MODELOS EN MODULOS.XLSX ===')
for m in df_mod['Modulo'].unique()[:10]:
    sub = df_mod[df_mod['Modulo'] == m]
    print(f'Modulo: {m} (Total rows: {len(sub)})')
    for idx, r in sub.iterrows():
        print(f'   {r["Sector"]} | {r["Qty-fija-modulo"]} | {r["Producto"]}')

print('\n=== MODELOS EN FIJOS.XLSX ===')
for f in df_fij['Fijos'].unique():
    sub = df_fij[df_fij['Fijos'] == f]
    print(f'Fijo: {f} (Total rows: {len(sub)})')
    for idx, r in sub.iterrows():
        print(f'   {r["Sector"]} | {r["Qty_fija_carpa"]} | {r["Producto"]}')
