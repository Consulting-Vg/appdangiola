# Manual de Usuario - ERP Carpas D'Angiola S.A.

Este manual detalla las funcionalidades del sistema ERP unificado de **Carpas D'Angiola**, diseñado para centralizar la gestión comercial, operativa, logística y de gerencia.

---

## 1. Módulos por Roles de Usuario
El sistema adapta su interfaz dinámicamente según el rol asignado al usuario. Los roles disponibles y sus módulos asociados son:

*   **Gerencia / SuperAdmin**: Acceso total a todos los módulos (Comercial, Operaciones, Almacén, Chofer, Maestro de Datos y el Panel de Gerencia BI con Asistente de IA).
*   **Comercial**: Gestión de clientes, cotizaciones, creación de Órdenes de Trabajo (OT) y visualización del renderizado 3D interactivo.
*   **Operaciones**: Planificación y supervisión de OTs, asignación de personal y recursos, verificación temporal de disponibilidad de arcos y análisis climático preventivo.
*   **Almacén (Planta / Pañol / Lonas / Pisos / Telas)**: Preparación de carga mediante checklists segmentados en 6 áreas físicas independientes y generación de remitos oficiales agrupados.
*   **Chofer**: Seguimiento de rutas, registro de entregas por GPS, análisis climático para la obra de entrega y logística de retornos.
*   **Operario**: Visualización de tareas asignadas específicas según su área física.

---

## 2. Flujo y Estados de una Orden de Trabajo (OT)
La Orden de Trabajo es el núcleo operativo. Su ciclo de vida pasa por los siguientes estados:

1.  **Pendiente**: Creada por el área Comercial. Se especifican las medidas de la carpa, modulación, adicionales (lonas, pisos, cortinas, etc.) y georreferenciación. En este estado, los usuarios de **Gerencia** y **Operaciones** pueden ejecutar la **"VERIFICACIÓN TEMPORAL DE ARCOS"** para comprobar la viabilidad del stock según las fechas comprometidas.
2.  **Aprobada**: Confirmada para producción. El sistema realiza la explosión de materiales (BOM) y calcula las piezas exactas necesarias de arcos, fijos y módulos de extensión. Durante la modulación inicial en el asistente (Paso 1), se dispone del botón de **"VERIFICAR TEMPORAL DE ARCOS"** para realizar simulaciones en tiempo real antes de confirmar el diseño final.
3.  **Bulto Completo**: El almacén prepara el cargamento. Pañol y Planta confirman las piezas mediante checklists digitales.
4.  **En Planta**: Los materiales están consolidados en zona de despacho y listos para transporte.
5.  **Completada (Entregada / Armada)**: El chofer traslada la carga (registrando la llegada por GPS) y se inicia el armado en la ubicación del cliente.
6.  **Cancelada**: Cancelación de la OT antes de la salida de stock.

*Nota sobre Visualización 3D*: La sección "Plano y Renderizado 3D" está restringida a los roles autorizados (`Gerencia`, `Comercial`, `Operaciones`, `SuperAdmin`). Para optimizar el rendimiento de la aplicación, el motor de renderizado 3D cuenta con un botón de alternancia (**"Ver Render 3D" / "Ocultar Render 3D"**) que carga e inicializa la simulación tridimensional a demanda.*

---

## 3. Preparación de Carga y Remisión Automática
### Checklist de Almacén (6 Sectores Independientes)
Para evitar confusiones durante la carga y consolidar un flujo ágil, el panel de preparación para el rol de Administrador (`Gerencia`, `Operaciones`, `SuperAdmin`) organiza los materiales requeridos en una cuadrícula de 3 columnas que muestra **6 checklists independientes**, cada uno correspondiente a un sector físico del depósito:
1.  **Planta (Estructurales)**: Vigas de aluminio, columnas, riendas, etc. (Color naranja).
2.  **Pañol (Rígidos)**: Anclajes, tornillos, estacas, cables y tensores. (Color púrpura).
3.  **Lonas**: Techos, fondos y lonas laterales. (Color verde azulado).
4.  **Pisos**: Placas y vigas de madera para la base. (Color esmeralda).
5.  **Alfombras**: Rollo e insumos de alfombra de la OT. (Color verde lima).
6.  **Telas**: Cielorraso de tela decorativa y cortinería especial. (Color índigo).

El personal operario con roles específicos en el almacén visualizará únicamente el checklist de la categoría asociada a su sector asignado.

### Remito Oficial y Hojas de Carga en PDF
Una vez completados los checklists, el sistema genera automáticamente el **Remito Oficial en PDF** y las hojas de control. El diseño del PDF ha sido optimizado para estructurar los materiales en **6 tablas separadas**, reflejando exactamente los 6 sectores de carga del almacén. Esta separación permite distribuir las hojas físicas de remisión entre los distintos sectores para una recolección paralela sin interferencias.

---

## 4. Logística Inversa y Control de Retorno (Desarme)
Cuando se cumple la fecha de fin de evento (`fecha_fin`), el sistema genera alertas de desarme y habilita el panel de **Control de Desarme**:
*   **Remito de Devolución**: Permite documentar si la carga retorna completa o si existen pérdidas/daños.
*   **Transferencia Directa de Obra a Obra**: Si una carpa se desmonta para ir directamente a otro evento, el sistema genera un remito de transferencia de obra a obra, evitando el retorno físico al almacén central en Burzaco y optimizando los costos de transporte.
*   **Registro de Devolución Defectuosa**: Clasificación de materiales dañados para mantenimiento.

---

## 5. Panel de Gerencia BI y Analítica Predictiva
El módulo de Gerencia consolida los datos históricos de facturación junto con la información operativa en tiempo real mediante cinco tableros dinámicos:

### A. Performance Comercial
*   **Métricas Clave**: m² traccionados, ticket promedio en m², cantidad total de eventos, y eventos georreferenciados.
*   **Top 10 Modelos**: Gráficos interactivos SVG con las carpas más alquiladas.
*   **Evolución Temporal**: Tendencia mensual de cierres y m² contratados.
*   **Mapa de Densidad**: Mapa interactivo basado en Leaflet para visualizar la concentración geográfica de los eventos y planificar rutas de distribución de forma eficiente.
*   **Auditoría IA de Vendedor**: Análisis pormenorizado del rendimiento de un vendedor específico, incluyendo alertas de inactividad de sus clientes bajo semáforo (Verde, Amarillo, Rojo).

### B. BI Predictivo de Cliente
*   **Buscador Inteligente**: Perfil completo de un cliente con solo escribir 3 caracteres.
*   **Ciclo de Recompra**: Cálculo automático de los días promedio transcurridos entre contratos de un mismo cliente.
*   **Predicción IA**: Fecha estimada del próximo evento comercial y fecha recomendada para iniciar el armado basada en el lead-time histórico.
*   **Semáforo de Retención**: Alertas visuales si un cliente excede su ciclo de recompra habitual (alerta de posible baja de cliente).

### C. Desglose Operativo
*   **Matriz de Adicionales**: Cuadro comparativo por cliente que evalúa el uso de pisos, tarimas, alfombras, cortinas, tribunas y sillas, detectando oportunidades de cross-selling.

### D. Demanda Predictiva IA (Motor de Planificación Logística)
*   **Horizonte de Planificación**: Permite predecir la demanda física a nivel de estructuras y accesorios para la próxima semana, mes, trimestre o meses específicos (p. ej., la temporada alta de diciembre o marzo).
*   **Justificación de Demanda**: Listado de clientes que se prevé que contraten en el periodo, con el modelo de carpa esperado y nivel de confianza estadística del modelo predictivo.

### E. Asistente VigIA (Chatbot Inteligente de Negocios)
*   **Agente de IA Integrado**: Un chatbot interactivo inteligente en la consola BI de Gerencia, alimentado en tiempo real con las bases de datos unificadas del sistema (Clientes, OTs activas, inventario de accesorios, estructuras y resumen de ventas).
*   **Procesamiento y Caché en Memoria**: Los datos se leen, condensan y almacenan en la memoria del servidor de forma instantánea (~10ms) para evitar procesamientos redundantes de archivos CSV o Excel. La caché se invalida y reconstruye automáticamente ante cualquier escritura.
*   **Consultas de Negocio Avanzadas**: El asistente está capacitado para responder y proyectar consultas como:
    *   *Proyecciones de Ventas*: Análisis del volumen y clientes probables para un mes de 2026 en comparación con las ventas reales del mismo mes de 2025.
    *   *Estacionalidad y Recurrencia*: Identificación de clientes con un comportamiento recurrente en meses clave (por ejemplo, aquellos que contratan todos los meses de Julio o Agosto).
    *   *Balance Real de Carpas y Arcos*: Cálculo de inventario físico real de arcos a partir de la tabla maestra de arcos (`arcos.xlsx`), descontando las reservas activas en OTs para proveer el stock libre neto en tiempo real.
*   **Diseño Interactivo**: Interfaz premium con glassmorphism, burbujas de chat, sugerencias de consultas rápidas, renderizado de Markdown enriquecido (negritas, viñetas, tablas) y simulación visual de escritura ("VigIA está escribiendo...").

---

## 6. Gestión de Datos Maestros (Maestro de Datos)
Para garantizar la integridad operativa, el sistema cuenta con un panel para administrar:
1.  **Personal y Recursos**: Altas/bajas de operarios, choferes, camiones y herramientas.
2.  **Estructuras y Fijos**: Catálogo técnico y BOM (Bill of Materials). *Nota: Para evitar confusiones visuales, la columna estática de "Arcos Disponibles" ha sido oculta en este catálogo, delegando este cálculo al balance dinámico y temporal integrado en el sistema.*
3.  **Clientes y Vendedores**: Base de contactos comerciales con georreferenciación obligatoria.
4.  **Importación Masiva**: Carga rápida de catálogos y datos desde plantillas de Excel (XLSX).

---

## 7. Análisis Climático y Seguridad en Obra
El sistema incorpora un módulo avanzado de monitoreo climático destinado a **Gerencia**, **Operaciones** y **Choferes** mediante el botón **"ANÁLISIS CLIMÁTICO"** integrado en las tarjetas de OTs (en estados de despacho pendiente, despachos completados, y desarmes):
*   **Geolocalización Automática**: El sistema extrae las coordenadas de entrega asignadas a la Orden de Trabajo.
*   **Integración con Weather API**: Conexión directa con Google Maps Platform / Open-Meteo Weather API para obtener las condiciones meteorológicas del día del evento y el pronóstico detallado para los próximos 7 días.
*   **Evaluación de Riesgo de Seguridad (IA Gemini)**: Un modelo de IA analiza variables de velocidad del viento, ráfagas, precipitaciones extremas y temperaturas críticas.
*   **Alertas Preventivas**: Genera recomendaciones automáticas (p. ej., suspender armado si los vientos superan los 35 km/h, asegurar anclajes adicionales en terrenos húmedos o reprogramar horarios por calor extremo) para proteger al personal y asegurar la estructura.

---

## 8. Próximas Mejoras y Funcionalidades Planificadas (Roadmap)

### A. Integración con WhatsApp
*   **Para Clientes**: Envío automático de remitos en PDF una vez despachados del almacén, y notificaciones de confirmación de armado/desarme.
*   **Para Choferes y Operaciones**: Alertas de OTs asignadas, detalles de la ruta con enlace de Google Maps y confirmaciones de entrega y arribo enviadas por mensaje directo (utilizando WhatsApp Business API o servicios integrados como Twilio).
*   **Para Almacén**: Alertas instantáneas en grupos de WhatsApp ante cambios urgentes en la modulación de OTs aprobadas.

### B. Módulo de Escucha Social e Inteligencia de Clientes (Social Media Feedback & Analysis)
*   **Lectura Automática de Redes**: Conexión vía API con Facebook, Instagram y LinkedIn para extraer comentarios de comentarios públicos sobre Carpas D'Angiola.
*   **Análisis de Sentimiento**: Clasificación automática de los comentarios en Positivo, Neutro o Negativo mediante Inteligencia Artificial (NLP/Gemini API), permitiendo evaluar la calidad percibida del servicio de armado y atención.
*   **KPIs de Opinión y Engagement**:
    *   **Índice de Satisfacción (Sentiment Score)**: Evolución del clima de opinión de la marca.
    *   **Monitoreo de Quejas/Incidentes**: Alertas automáticas enviadas al panel de Operaciones si se detecta un comentario crítico o reclamo de rotura o retraso en redes sociales.
    *   **Tasa de Interacción (Engagement Rate)**: Correlación entre posteos y volumen de consultas comerciales entrantes.

### C. Módulo de Control de GPS de Vehículos (GPS Tracking & Logistics)
*   **Integración con API de Servicio GPS**: Conexión con los dispositivos GPS integrados en los camiones para obtener coordenadas de geolocalización en tiempo real.
*   **Tiempo Estimado de Llegada (ETA)**: Visualización y cálculo dinámico del tiempo estimado de arribo a la obra de entrega o desarme.
*   **Detección de Desviaciones y Paradas**: Monitoreo de desvíos en la ruta establecida y alertas por paradas extendidas o no autorizadas del transporte.
*   **Corroboración de Llegada (Ubicación Propuesta vs. Real)**: Validación automatizada del arribo comparando las coordenadas GPS reales del camión contra la ubicación geográfica cargada en la Orden de Trabajo.

