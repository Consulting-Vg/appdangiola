# Guía de Operación: App Dangiola en Windows (Estación de Campo)

Esta guía detalla el funcionamiento y sincronización de **App Dangiola** bajo el esquema:
- **Mac:** Cerebro / Laboratorio Central de Desarrollo, Corrección y Entrenamiento.
- **Windows:** Estación de Trabajo de Producción en Campo.

---

## 🚀 1. Puesta en Marcha Inicial en Windows (100% Automática - Sin descargas manuales)

**No necesitas descargar ni configurar nada a mano.** Todo el proceso de instalación de Node.js y dependencias está automatizado para ejecutarse en segundo plano.

### Opción A: Instalación y Arranque Inmediato (Recomendada)
1. Entra a la carpeta de **Nueva App Dangiola** en Windows.
2. Haz doble clic en:
   👉 **`EJECUTAR_APPDANGIOLA.bat`**
3. Si el sistema detecta que Node.js no está instalado en la máquina:
   - Descargará e instalará automáticamente la versión oficial de Node.js LTS en segundo plano (vía Windows Package Manager `winget`, instalador MSI silencioso, o versión portable sin necesidad de permisos de administrador).
   - Instalará las dependencias del backend y frontend de Windows.
   - Creará el acceso directo **App Dangiola** en tu Escritorio.
   - Abrirá automáticamente tu navegador en **`http://localhost:5001`**.

### Opción B: Pre-instalar todo antes del primer arranque
Si prefieres dejar todo instalado antes de iniciar el servidor:
1. Haz doble clic en:
   👉 **`INSTALAR_TODO_WINDOWS.bat`**
2. Espera a que la pantalla verde indique *"INSTALACION COMPLETA Y EXITOSA"*.
3. Luego haz doble clic en `EJECUTAR_APPDANGIOLA.bat` (o en el acceso directo de tu Escritorio).

---

## 🔄 2. Flujo de Corrección y Actualizaciones (Mac → Windows)

Cuando se detecte un error, se requiera una modificación o se incorporen nuevas bases de datos (como `modulos.csv`), el flujo de trabajo es el siguiente:

### Paso 1: Resolver en la Mac (Cerebro Central)
1. En esta Mac se realizan las correcciones de código, ajustes en la base de datos o lógica operativa.
2. Abre la Terminal en la Mac, colócate en la carpeta del proyecto y ejecuta:
   ```bash
   ./empaquetar_para_windows.sh
   ```
3. El script generará automáticamente un archivo limpio y optimizado llamado:
   📦 **`actualizacion_appdangiola.zip`** *(y una copia con fecha)*.
   *(Este ZIP incluye todo el código, frontend compilado y bases maestras, excluyendo los archivos pesados de Mac para evitar incompatibilidades)*.

### Paso 2: Transferir el ZIP a Windows
- Pasa el archivo `actualizacion_appdangiola.zip` a la máquina de Windows mediante:
  - Pendrive USB
  - Google Drive / OneDrive
  - Carpeta de red compartida
  - WhatsApp Web / Telegram

### Paso 3: Aplicar la Actualización en Windows (Campo)
1. Pega el archivo `actualizacion_appdangiola.zip` directamente dentro de la carpeta principal del sistema en Windows.
2. Haz doble clic en:
   👉 **`ACTUALIZAR_APPDANGIOLA.bat`**
3. El script:
   - Descomprimirá los archivos nuevos y modificados reemplazando las versiones anteriores.
   - Verificará dependencias si hubo cambios en librerías.
   - Archivará el zip aplicado en la carpeta `actualizaciones_aplicadas\`.
4. Cuando indique **"ACTUALIZACION APLICADA CON ÉXITO"**, inicia la app con:
   👉 **`EJECUTAR_APPDANGIOLA.bat`**

---

## 🛠️ 3. Funcionamiento de Archivos Clave

| Archivo | Función |
| :--- | :--- |
| **`EJECUTAR_APPDANGIOLA.bat`** | **Lanzador principal.** Inicia el servidor, auto-instala dependencias si faltan, abre el navegador y crea el acceso directo. |
| **`INSTALAR_TODO_WINDOWS.bat`** | **Instalador automático.** Descarga e instala Node.js y dependencias en segundo plano sin intervención manual. |
| **`ACTUALIZAR_APPDANGIOLA.bat`** | **Actualizador de campo.** Descomprime y aplica parches `.zip` provenientes de la Mac. |
| **`empaquetar_para_windows.sh`** | **Empaquetador de Mac.** Genera el archivo ZIP de actualización limpio para Windows. |
| **`backend/data/db.json`** | Base de datos local autónoma (permite trabajar 100% offline en el campo sin requerir internet). |
| **`modulos.csv`** | Base maestra de módulos de extensión estandarizada (202 registros). |

---

## ❓ 4. Preguntas Frecuentes y Solución de Problemas

### ¿Cómo apago el sistema cuando termino la jornada?
Simplemente cierra la ventana negra de la consola de comandos donde se ejecutó `EJECUTAR_APPDANGIOLA.bat`.

### ¿Funciona sin conexión a Internet?
**Sí.** El sistema en Windows opera con la base de datos local embebida en `backend/data/db.json` y los activos estáticos compilados en `frontend/dist`, por lo que no depende de conexión externa en campo.

### El puerto 5001 aparece ocupado
`EJECUTAR_APPDANGIOLA.bat` cuenta con un sistema de auto-recuperación que detecta si quedó un proceso zombie previo y lo libera antes de iniciar el nuevo servidor. Si persistiera, basta con reiniciar la máquina Windows.
