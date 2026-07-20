# Lead Intelligence Engine - LUHO

## Arquitectura y Estrategia

Este módulo central está diseñado para convertir datos de prospectos e inventario en oportunidades comerciales accionables de forma automática para la agencia automotriz LUHO.

### Estrategia para Firebase Firestore
Para manejar eficientemente los datos y asegurar consultas rápidas:
1. **Colecciones Principales**: `clients`, `vehicles`, `tasks`, `deals`, `opportunities` (nueva).
2. **Subcolecciones**: Utilizar subcolecciones para el historial de interacciones (`interactionHistory`) dentro de cada cliente para evitar que el documento principal crezca demasiado y afecte la latencia.
3. **Índices Compuestos**: Crear índices en Firestore para búsquedas comunes, por ejemplo, `wantedVehicle.make` + `wantedVehicle.priceMax` + `status`.
4. **Desnormalización Controlada**: Guardar datos resumen (ej. `lastInteractionDate`, `leadScore`, `highestMatchScore`) directamente en el documento del cliente para poder ordenar y filtrar la tabla de prospectos rápidamente sin consultar subcolecciones.

### Estrategia de Escalabilidad (>100,000 prospectos)
1. **Paginación y Cursores**: Nunca cargar todos los prospectos en memoria. Utilizar `limit` y `startAfter` de Firestore al iterar.
2. **Procesamiento Basado en Eventos (Event-Driven)**: El `Matching Engine` y `Lead Scoring Engine` deben ejecutarse en procesos asíncronos (Cloud Functions o Background Workers en Node.js) desencadenados por eventos (ej. `onVehicleCreated`, `onClientUpdated`), no de forma síncrona en el request del usuario.
3. **Vistas Materializadas (Materialized Views)**: Mantener colecciones agregadas como `inventory_demand_stats` para el `Inventory Intelligence`. Cada vez que un lead busca un "Sedán 2020", se incrementa un contador, evitando tener que iterar sobre 100k prospectos para calcular la demanda.
4. **Offloading de Búsqueda**: Para cruces hiper-complejos en tiempo real (ej. buscar prospectos afines en milisegundos cuando entra un auto), considerar sincronizar Firestore con un motor como Algolia o Meilisearch.

### Buenas Prácticas de Rendimiento
1. **Ejecución de Lógica Pesada en el Servidor (API)**: Evitar hacer cálculos de matching de miles de vehículos en el navegador. Las rutinas de scoring corren en el servidor Express.
2. **Caché en Memoria**: Almacenar en caché el inventario disponible (que son menos registros y cambian con menos frecuencia) para cruzarlo rápidamente en memoria con los leads que se van actualizando.
3. **Agrupación de Escrituras (Batched Writes)**: Si el motor de oportunidades detecta 50 matches al ingresar un auto, insertarlas usando `db.batch()` para reducir peticiones de red y costos de Firebase.
4. **Proyección de campos (`select`)**: Al recuperar prospectos para calcular score, pedir solo los campos necesarios (precio, año, interacciones), omitiendo campos pesados como notas largas.
