# Manual de Usuario - ERP Carpas D'Angiola S.A.

Este manual detalla las funcionalidades del sistema ERP unificado de **Carpas D'Angiola**, diseñado para centralizar la gestión comercial, operativa, logística y de gerencia.

---

## 1. Módulos por Roles de Usuario
El sistema adapta su interfaz dinámicamente según el rol asignado al usuario. Los roles disponibles y sus módulos asociados son:

*   **Gerencia / SuperAdmin**: Acceso total a todos los módulos (Comercial, Operaciones, Almacén, Chofer y el Panel de Gerencia BI).
*   **Comercial**: Gestión de clientes, cotizaciones y creación de Órdenes de Trabajo (OT).
*   **Operaciones**: Planificación y supervisión de OTs, asignación de personal y recursos.
*   **Almacén (Planta / Pañol / Lonas / Pisos / Telas)**: Preparación de carga, control de stock y listas de empaque.
*   **Chofer**: Seguimiento de rutas, registro de entregas por GPS y logística de retornos.
*   **Operario**: Visualización de tareas asignadas específicas según su área física.

---

## 2. Flujo y Estados de una Orden de Trabajo (OT)
La Orden de Trabajo es el núcleo operativo. Su ciclo de vida pasa por los siguientes estados:

1.  **Pendiente**: Creada por el área Comercial. Se especifican las medidas de la carpa, modulación, adicionales (lonas, pisos, cortinas, etc.) y georreferenciación.
2.  **Aprobada**: Confirmada para producción. El sistema realiza la explosión de materiales (BOM) y calcula las piezas exactas necesarias de arcos, fijos y módulos de extensión.
3.  **Bulto Completo**: El almacén prepara el cargamento. Pañol y Planta confirman las piezas mediante checklists digitales.
4.  **En Planta**: Los materiales están consolidados en zona de despacho y listos para transporte.
5.  **Completada (Entregada / Armada)**: El chofer traslada la carga (registrando la llegada por GPS) y se inicia el armado en la ubicación del cliente.
6.  **Cancelada**: Cancelación de la OT antes de la salida de stock.

---

## 3. Preparación de Carga y Remisión Automática
### Checklist de Almacén
El personal de almacén dispone de un panel con los items requeridos desglosados en:
*   **Pañol**: Piezas pequeñas de anclaje, tornillería, cables, tensores, etc.
*   **Planta**: Estructuras mayores de aluminio/acero, vigas, columnas y arcos.
*   **Lonas, Pisos y Telas**: Accesorios textiles o maderas según configuración de la OT.

Al completar el checklist, se habilita la **generación automática del Remito Oficial en PDF**, el cual cumple con la estructura formal de facturación y remisión (incluyendo el código de documento correspondiente, datos de emisor, receptor, desglose agrupado de materiales, distancia en kilómetros desde Burzaco HQ y campos de firma).

---

## 4. Logística Inversa y Control de Retorno (Desarme)
Cuando se cumple la fecha de fin de evento (`fecha_fin`), el sistema genera alertas de desarme y habilita el panel de **Control de Desarme**:
*   **Remito de Devolución**: Permite documentar si la carga retorna completa o si existen pérdidas/daños.
*   **Transferencia Directa de Obra a Obra**: Si una carpa se desmonta para ir directamente a otro evento, el sistema genera un remito de transferencia de obra a obra, evitando el retorno físico al almacén central en Burzaco y optimizando los costos de transporte.
*   **Registro de Devolución Defectuosa**: Clasificación de materiales dañados para mantenimiento.

---

## 5. Panel de Gerencia BI y Analítica Predictiva
El módulo de Gerencia consolida los datos históricos de facturación junto con la información operativa en tiempo real mediante cuatro tableros dinámicos:

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

---

## 6. Gestión de Datos Maestros (Maestro de Datos)
Para garantizar la integridad operativa, el sistema cuenta con un panel para administrar:
1.  **Personal y Recursos**: Altas/bajas de operarios, choferes, camiones y herramientas.
2.  **Estructuras, Arcos, Módulos y Fijos**: Catálogo técnico y BOM (Bill of Materials).
3.  **Clientes y Vendedores**: Base de contactos comerciales con georreferenciación obligatoria.
4.  **Importación Masiva**: Carga rápida de catálogos y datos desde plantillas de Excel (XLSX).

---

## 7. Próximas Mejoras y Funcionalidades Planificadas (Roadmap)

### A. Integración con WhatsApp
*   **Para Clientes**: Envío automático de remitos en PDF una vez despachados del almacén, y notificaciones de confirmación de armado/desarme.
*   **Para Choferes y Operaciones**: Alertas de OTs asignadas, detalles de la ruta con enlace de Google Maps y confirmaciones de entrega y arribo enviadas por mensaje directo (utilizando WhatsApp Business API o servicios integrados como Twilio).
*   **Para Almacén**: Alertas instantáneas en grupos de WhatsApp ante cambios urgentes en la modulación de OTs aprobadas.

### B. Módulo de Escucha Social e Inteligencia de Clientes (Social Media Feedback & Analysis)
*   **Lectura Automática de Redes**: Conexión vía API con Facebook, Instagram y LinkedIn para extraer comentarios de publicaciones de Carpas D'Angiola.
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

