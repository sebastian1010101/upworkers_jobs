# Upwork Job Radar

Backend de las Fases 1–12: NestJS, Prisma, PostgreSQL, ofertas simuladas, búsqueda manual mediante la API oficial de Upwork, filtros deterministas, análisis estructurado con OpenAI, scoring combinado, comunicación por WhatsApp, borradores personalizados y observabilidad operativa.

## Requisitos

- Node.js 20.19 o superior
- npm
- Docker con Docker Compose

## Inicio con Docker Compose

1. Copia el ejemplo de configuración: `cp .env.example .env`.
2. Ajusta las credenciales locales en `.env` si lo deseas.
3. Ejecuta `docker compose up --build -d`. La API aplica las migraciones al arrancar.
4. Comprueba `curl http://localhost:3000/health`. La respuesta esperada es `{"status":"ok","database":"up"}`.
5. Detén los contenedores con `docker compose down`. El volumen de PostgreSQL se conserva.

La API usa el host `db` dentro de Docker. Para ejecución fuera de Docker, `DATABASE_URL` debe apuntar a `localhost` y usar las mismas credenciales de `POSTGRES_USER`, `POSTGRES_PASSWORD` y `POSTGRES_DB`.

## Desarrollo local

1. Copia `.env.example` a `.env`.
2. Ejecuta `docker compose up -d db`.
3. Ejecuta `npm ci`, `npm run prisma:generate` y `npm run db:migrate`.
4. Ejecuta `npm run start:dev`.
5. Comprueba `curl http://localhost:3000/health`.

## API de ofertas simuladas

Crear una oferta:

```bash
curl -X POST http://localhost:3000/jobs \
  -H 'Content-Type: application/json' \
  -d '{"externalId":"simulated-001","title":"AI Automation Developer","description":"Build a Python API integration.","url":"https://example.com/jobs/simulated-001","budgetType":"FIXED","budgetMin":"300.00","budgetMax":"500.00","skills":["Python","APIs"]}'
```

Consultar: `curl http://localhost:3000/jobs` devuelve las últimas 50 ofertas; `curl http://localhost:3000/jobs/<id>` devuelve una oferta por UUID. Repetir un `externalId` devuelve HTTP 409. Los importes se envían como cadenas decimales y también se devuelven como cadenas para preservar la precisión. Los campos `status` y `discoveredAt` los asigna el servidor.

## API oficial de Upwork: búsqueda manual

Primero necesitas una [clave aprobada por Upwork](https://www.upwork.com/developer/keys/apply) con los permisos **Common Entities - Read-Only Access** y **Read marketplace Job Postings**. La aprobación depende de los requisitos de Upwork. La aplicación usa OAuth 2.0 y la consulta documentada `marketplaceJobPostingsSearch`; no utiliza scraping ni la consulta antigua `marketplaceJobPostings`.

1. En `.env`, configura `UPWORK_CLIENT_ID`, `UPWORK_CLIENT_SECRET` y el `UPWORK_REDIRECT_URI` registrado en tu clave. El comando local admite `http://127.0.0.1:3001/callback`.
2. En tu máquina, ejecuta `npm run upwork:auth`, abre la URL que muestra el comando y autoriza tu cuenta. Los tokens se guardan en `.env` con permisos `600`; no se imprimen.
3. Si usas Docker, ejecuta `docker compose up -d --force-recreate api` para cargar las nuevas variables. Si usas `npm run start:dev`, reinicia ese proceso.
4. Para renovar los tokens manualmente, ejecuta `npm run upwork:refresh` y vuelve a cargar la API como en el paso anterior.

Una búsqueda dirigida por ti, sin guardar resultados:

```bash
curl -X POST http://localhost:3000/upwork/jobs/search \
  -H 'Content-Type: application/json' \
  -d '{"query":"AI automation","limit":5}'
```

Para guardar hasta 20 resultados de una búsqueda concreta, sustituye `/search` por `/import`. La búsqueda responde con `fetched`, `normalized`, `passed`, `filtered`, `failed`, `errors` y `jobs`. La importación añade `created`, `duplicates`, `analyzed`, `analysisFailed`, `notificationsSent` y `notificationFailed`. Cada error incluye el índice del resultado y la etapa (`normalize`, `persist`, `analyze` o `notify`); una oferta defectuosa no detiene el resto. Repetir la misma importación antes de la caducidad aumenta `duplicates` sin crear otra fila ni prolongar su vida. Puedes revisar las filas con `curl http://localhost:3000/jobs`.

## Filtros deterministas

Antes de persistir cada resultado normalizado, la aplicación evalúa reglas que no requieren IA. Descarta presupuestos fijos cuyo máximo sea inferior a `JOB_FILTER_MIN_FIXED_BUDGET_USD` (100 por defecto), tarifas horarias cuyo máximo sea inferior a `JOB_FILTER_MIN_HOURLY_RATE_USD` (10 por defecto), requisitos explícitos de inglés nativo/C1/C2, requisitos de siete años o más de experiencia y especialidades puramente ajenas al perfil, como WordPress o diseño gráfico. Un presupuesto desconocido no se descarta.

Las ofertas que pasan quedan con `status: "NEW"`. Las descartadas también se guardan para auditoría, con `status: "IGNORED"`, `filterReasons` y `filteredAt`; así no llegarán al futuro análisis con IA. Las búsquedas e importaciones incluyen ahora los contadores `passed` y `filtered`, y `/search` añade a cada oferta una decisión `filter` con motivos y palabras relevantes encontradas.

## Análisis con IA

Configura `OPENAI_API_KEY` en `.env` para habilitar el análisis. `OPENAI_MODEL` usa `gpt-5.6-terra` por defecto y `OPENAI_TIMEOUT_MS` vale 30000. La integración utiliza la Responses API con Structured Outputs y validación Zod estricta, siguiendo la [documentación oficial de OpenAI](https://developers.openai.com/api/docs/guides/structured-outputs). Las solicitudes usan `store: false`; consulta también los [controles de datos de la API](https://developers.openai.com/api/docs/guides/your-data).

Al importar, solamente las ofertas nuevas con filtro `PASSED` se envían automáticamente al modelo. Sin clave configurada, la importación continúa y deja `analyzed: 0`. Un fallo del proveedor tampoco revierte la oferta guardada: aparece en `analysisFailed` y en `errors` con etapa `analyze`. Las ofertas `IGNORED` nunca se envían al modelo.

Para analizar manualmente una oferta aceptada:

```bash
curl -X POST http://localhost:3000/jobs/<job-id>/analysis
```

La operación es idempotente: si ya existe un análisis para esa oferta, devuelve el existente sin otra llamada al modelo. Puedes consultarlo con `curl http://localhost:3000/jobs/<job-id>/analysis`. El resultado persiste los scores del modelo, el score combinado, fortalezas, debilidades, recomendación, `shouldNotify`, modelo y fechas.

## Scoring combinado

Cada análisis nuevo calcula un score final reproducible con estos pesos:

| Componente | Peso | Fuente |
| --- | ---: | --- |
| Compatibilidad global | 55% | Score estructurado del LLM |
| Reglas | 15% | Keywords relevantes y presupuesto |
| Cliente | 15% | Rating e inversión histórica |
| Competencia | 15% | Evaluación del LLM y número de propuestas |

Los datos de cliente, presupuesto o propuestas que no estén disponibles reciben un valor neutral. `llmScore` y `llmCompetitionScore` conservan las evaluaciones originales; `ruleScore`, `clientScore`, `competitionScore` y `score` muestran el desglose calculado. `shouldNotify` se determina con `JOB_NOTIFY_SCORE_THRESHOLD`, cuyo valor predeterminado es 8.

Puedes recalcular una oferta existente sin consumir otra llamada de IA:

```bash
curl -X POST http://localhost:3000/jobs/<job-id>/score
```

El recálculo usa los componentes originales del LLM almacenados en la base de datos y actualiza `scoredAt`.

## Alertas por WhatsApp

La integración usa la [WhatsApp Business Cloud API oficial](https://www.postman.com/meta/whatsapp-business-platform/folder/o48mro7/messages), el endpoint `/{phone-number-id}/messages` y un token con permiso `whatsapp_business_messaging`. Como las alertas son mensajes proactivos, deben usar una plantilla aprobada cuando estén fuera de la ventana de atención de 24 horas.

Configura estas variables:

```env
WHATSAPP_ACCESS_TOKEN=tu_token
WHATSAPP_PHONE_NUMBER_ID=tu_phone_number_id
WHATSAPP_RECIPIENT_PHONE_NUMBER=5511999999999
WHATSAPP_GRAPH_API_VERSION=v26.0
WHATSAPP_TEMPLATE_NAME=upwork_job_alert
WHATSAPP_TEMPLATE_LANGUAGE=en_US
WHATSAPP_TIMEOUT_MS=15000
```

Crea y aprueba en WhatsApp Manager una plantilla llamada `upwork_job_alert` con siete variables de cuerpo, en este orden:

```text
🚨 New Upwork Job

{{1}}
Match: {{2}}/10
Budget: {{3}}
Main technologies: {{4}}
Why it matches: {{5}}
Weakness: {{6}}
Job: {{7}}

Reply 1 to generate a proposal, 2 to ignore, 3 to save, or 4 for the full analysis.
```

Cuando una importación nueva produce `shouldNotify=true` y WhatsApp está configurado, la alerta se envía automáticamente. Solo existe una notificación de WhatsApp por oferta: repetir el envío devuelve la notificación `SENT` existente. Los fallos quedan en estado `FAILED`, guardan un código seguro y permiten reintento; un error de WhatsApp no revierte la oferta ni su análisis.

Envío y consulta manual:

```bash
curl -X POST http://localhost:3000/jobs/<job-id>/notifications/whatsapp
curl http://localhost:3000/jobs/<job-id>/notifications/whatsapp
```

## Webhook de WhatsApp

Configura dos secretos adicionales, distintos entre sí:

```env
WHATSAPP_APP_SECRET=app_secret_de_meta
WHATSAPP_WEBHOOK_VERIFY_TOKEN=un_token_aleatorio_elegido_por_ti
```

En Meta configura como callback `https://tu-dominio/webhooks/whatsapp`, usa el mismo verify token y suscribe el campo `messages` de la WABA. Meta requiere un endpoint HTTPS públicamente accesible. La aplicación responde al challenge `GET` y valida cada `POST` con `X-Hub-Signature-256` sobre los bytes exactos del cuerpo antes de procesarlo. El formato recibido sigue el [payload oficial de Cloud API](https://www.postman.com/meta/whatsapp-business-platform/folder/tduohwq/webhook-payload-reference).

Las respuestas ejecutan estas acciones:

| Respuesta | Acción |
| --- | --- |
| `1` | Genera o recupera el borrador personalizado y responde con él por WhatsApp |
| `2` | Cambia la oferta a `IGNORED` |
| `3` | Cambia la oferta a `SAVED` |
| `4` | Responde por WhatsApp con el análisis completo |

Cuando el mensaje es una respuesta directa, el sistema usa `context.id` para encontrar la alerta original. Si llega solamente el número, usa la alerta `SENT` más reciente de las últimas 24 horas. Solo acepta acciones desde `WHATSAPP_RECIPIENT_PHONE_NUMBER`. Cada `wamid` entrante se guarda una vez en `WhatsAppInboundMessage`, por lo que las entregas repetidas de Meta no repiten la acción. Los mensajes desconocidos reciben el menú de opciones y los eventos de estado sin mensajes se reconocen sin ejecutar acciones.

Los registros de Upwork caducan a las 23 horas; la API los borra al arrancar, antes de importar y cada `UPWORK_CACHE_SWEEP_MINUTES` minutos mientras está funcionando (15 por defecto; admite 1–60). Dos limpiezas simultáneas comparten la misma operación. Si necesitas una garantía de eliminación mientras la API está apagada, hará falta un mecanismo de mantenimiento independiente antes de usar esta opción de forma permanente.

## Borradores de propuestas

El generador usa la oferta, el análisis guardado, el perfil profesional y sus proyectos verificables. Produce en inglés claro un texto específico para la necesidad del cliente, conecta solamente experiencia real relevante y termina con una pregunta concreta. El prompt trata la descripción de la oferta como datos no confiables y prohíbe inventar experiencia, métricas, plazos, precios o nombres.

Generar o recuperar el único borrador de una oferta:

```bash
curl -X POST http://localhost:3000/jobs/<job-id>/proposal
curl http://localhost:3000/jobs/<job-id>/proposal
```

Si todavía no existe análisis, la generación lo crea primero. La operación es idempotente: una vez guardado el `ProposalDraft`, los reintentos devuelven el mismo texto sin nuevas llamadas al modelo. Las ofertas `IGNORED` no admiten borradores.

Después de revisar el contenido, puedes registrar la aprobación humana:

```bash
curl -X POST http://localhost:3000/jobs/<job-id>/proposal/approve
```

La aprobación solo actualiza `approved` y `approvedAt`. La aplicación no contiene ninguna operación que envíe propuestas a Upwork; el envío final siempre queda bajo control humano. Responder `1` a una alerta de WhatsApp ejecuta la misma generación idempotente y devuelve el borrador dentro de la conversación.

## Monitoring y fiabilidad

La aplicación escribe logs JSON de una línea. Cada petición HTTP genera un evento `request_completed` o `request_failed` con `requestId`, método, ruta, estado y duración. Puedes enviar un identificador válido en `X-Request-Id`; en caso contrario el servidor crea uno y siempre lo devuelve en la cabecera de respuesta. No se registran cuerpos, tokens ni secretos.

Las lecturas de Upwork reintentan errores transitorios de red, límites `429` y respuestas `5xx`. WhatsApp reintenta automáticamente solo un `429` explícito: un timeout o `5xx` se guarda como `FAILED` para revisión y reintento posterior, evitando duplicar una alerta si Meta aceptó el mensaje pero se perdió la respuesta. Los demás errores `4xx` son permanentes y tampoco se reintentan. El número de intentos y el backoff exponencial inicial se configuran así:

```env
UPWORK_TIMEOUT_MS=10000
EXTERNAL_RETRY_ATTEMPTS=3
EXTERNAL_RETRY_BASE_DELAY_MS=250
```

El retraso se duplica después de cada fallo y tiene un máximo interno de cinco segundos. Los clientes de OpenAI usan el mismo número total de intentos mediante el soporte de reintentos de su SDK. Las notificaciones conservan sus estados `PENDING`, `SENT` y `FAILED`; los webhooks conservan `RECEIVED`, `PROCESSED` y `FAILED`, junto con el número de intentos y un error truncado.

Las métricas básicas se calculan desde PostgreSQL y no incluyen títulos, descripciones, teléfonos ni contenido de propuestas:

```bash
curl -i -H 'X-Request-Id: manual-check-1' http://localhost:3000/monitoring/metrics
```

La respuesta contiene uptime, ofertas por estado, cantidad de análisis y propuestas, aprobaciones, notificaciones y webhooks por estado. Si PostgreSQL no está disponible, responde HTTP 503.

La documentación de búsqueda de Upwork no especifica una URL directa del anuncio en los campos consultados; por ello los registros importados dejan `url` en `null`. No se construye una URL a partir de `ciphertext` sin documentación oficial. Los importes solo se convierten cuando Upwork devuelve un valor USD interpretable; de lo contrario quedan vacíos y el valor mostrado se conserva en `rawData` hasta su caducidad.

Las [condiciones actuales de API y MCP](https://www.upwork.com/legal#apimcpterms) permiten búsquedas concretas iniciadas por el usuario y no autorizan la monitorización continua del catálogo con acceso API ordinario. Por eso la Fase 5 programa únicamente la limpieza local: no existe `UPWORK_POLL_INTERVAL_MINUTES` ni un cron de consultas a Upwork. Revisa los permisos concedidos a tu clave y estas condiciones antes de usar el servicio.

## Verificaciones

Ejecuta `npm run prisma:validate`, `npm run build` y `npm test`. El esquema y las migraciones están en `prisma/`. `DATABASE_URL` es obligatoria; `PORT` acepta 1–65535, `HOST` admite `127.0.0.1` y `0.0.0.0`, y `NODE_ENV` acepta `development`, `test` o `production`. El servidor local escucha solo en `127.0.0.1` de forma predeterminada. Nunca incluyas `.env` en el repositorio.
