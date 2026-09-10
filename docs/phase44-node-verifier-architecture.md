# Fase 44 — Servicio Node privado Apple, laboratorio local

**C — NO APTO TODAVÍA.** El contrato autenticado y la separación Edge→Node funcionan en local, pero se reprodujo un defecto relevante de frescura OCSP en `@apple/app-store-server-library@3.1.0`: dos respuestas públicas Apple firmadas se aceptan cuando, según un reloj controlado, ya expiraron o todavía son futuras. No se falsificaron firmas ni respuestas. La suite conserva dos FAIL de seguridad; no se convirtieron en PASS.

El prototipo bloquea configuración online con `OCSP_FRESHNESS_UNVERIFIED`. La verificación offline sigue habilitada exclusivamente como laboratorio, con `trust: public_test_lab` y `ocsp: not_checked`. Esto no es autorización para conceder derechos, omitir OCSP en producción o desplegar el servicio.

## Estado y propósito

Repo `/Users/yanier/Documents/abilene-vibes`, main, HEAD `1607ff2dad6a23cfcb56b4b769fbde3e365dd437`, mensaje `Validate Apple IAP backend on local PostgreSQL`. Precheck: solo documentos Fases 41/42/43 untracked; nada staged. No se reabrieron StoreKit, Deno ni Supabase Edge. Fase 43 ya mostró 42/51 en Edge v1.76.2; Node 22.23.2 conservaba 51/51.

Objetivo: Node verifica/normaliza; el caller autentica/orquesta. El backend decidiría ledger/entitlements posteriormente. No hay lógica comercial, persistencia ni backend real conectado.

Workspace creado mediante tempfile.mkdtemp bajo /private/tmp:
`/private/tmp/abilene-phase44-node-verifier-i8nosobz/`.
macOS 26.6.2, arm64, Node v22.23.2, npm 10.9.8. Única dependencia directa: Apple 3.1.0. 48 paquetes instalados, incluyendo transitivas. Sin frameworks. npm install generó lock real y npm ci lo reprodujo offline desde caché pública copiada. Sin lifecycle scripts, auditoría remota o modificación de manifiestos del proyecto. Advertencia npm: jsrsasign 11.1.5 no mantenido; no se cambió su versión silenciosamente.

Dependencias relevantes: jsonwebtoken 9.0.3, jsrsasign 11.1.5, node-fetch 2.7.0, base64url 3.0.1; árbol completo en dependency-tree.json.

## Fronteras de confianza

1. Cliente/iOS no es autoridad de bundle, entorno, producto, comprador o transacción.
2. Caller lab único `edge-lab` autentica el transporte con key id `ephemeral-1`.
3. Node configura bundle/environment/roots; no los toma del body.
4. SignedDataVerifier oficial valida evidencia. Transport-auth exitoso no implica Apple-auth exitoso.
5. Caller verifica MAC de respuesta, correlación, status, estructura y verified estrictamente true antes de devolver trusted:true.
6. trusted:true es únicamente resultado criptográfico del laboratorio. No activa promociones, escribe verified en DB ni permite compras.

La raíz testCA y bundle com.example son configuración sintética explícita `lab:true`, nunca trust store productivo. No existe default de arranque que adopte esas roots sin configuración del laboratorio. Caller solo importa el schema de normalización: no carga SignedDataVerifier para hacer crypto Apple.

## Servicio local y request contract

Node HTTP nativo, puerto dinámico, bind exclusivo 127.0.0.1. Endpoints:
- POST /verify/transaction
- POST /verify/app-transaction
- POST /verify/notification
- POST /verify/renewal-info
- GET /health autenticado, body {} (solo laboratorio)

Body de verificación: exactamente `{ "signed_data": "..." }`.
UTF-8 estricto; único campo literal signed_data y valor string; se rechazan JSON inválido, claves duplicadas, campos extra, null, content-type distinto de application/json y rutas/métodos ajenos. Máximo 65,536 bytes en solicitud y respuesta.

Cabeceras del protocolo: x-protocol-version, x-caller-id, x-key-id, x-request-id, x-timestamp, x-nonce, x-evidence-type, x-body-hash, x-signature. x-request-id es UUID v4 hexadecimal; nonce 32 bytes aleatorios representados por 64 caracteres hex minúsculos; timestamp epoch UTC en milisegundos, exactamente 13 dígitos. Se aceptan 30 s de antigüedad y como máximo 5 s en futuro. No se normaliza silenciosamente la ruta; se firma y enruta el path exacto, sin query strings permitidos por las rutas.

### Canonicalization y autenticación

Secreto de laboratorio: randomBytes(32), sin literal fijo ni escritura en archivos. El launcher lo pasa exclusivamente por environment al proceso hijo; start lo consume y borra la variable. El caller conserva su copia solo en memoria. Las pruebas también ejercen configuración de secreto en memoria. Nunca se registra la clave.

HKDF-SHA256 deriva dos claves de 32 bytes, salt UTF-8 `abilene-lab-v1`, info `request` y `response`. No se reutiliza el mismo dominio de MAC para ambas direcciones.

Request canonical = bytes UTF-8 de JSON.stringify del array ordenado:
`["abilene-request", protocol_version, method, path, caller_id, key_id, request_id, timestamp, nonce, evidence_type, body_hash]`.

Los valores de cabecera son strings; method/path son los bytes textuales aceptados por Node HTTP, no URLs reinterpretadas. body_hash es SHA-256 hexadecimal minúsculo de los bytes exactos recibidos. HMAC-SHA256 del canonical se representa hex minúsculo. Validación de formato/longitud antes de timingSafeEqual. JSON array con strings escapados evita ambigüedad por concatenación. No hace falta canonicalizar el JSON Apple: se autentica su representación exacta.

Cabeceras x-* duplicadas se rechazan. Firma incorrecta, body alterado o parámetros autenticados alterados no llaman al verificador Apple, demostrado por contador en tests.

### Replay

Dos mapas en memoria para nonce y request_id, dentro de una identidad/key id única. Se rechaza reutilizar cualquiera, no solo el par. Se reserva la entrada antes de await de verificación para impedir carrera concurrente. Se permite re-verificar la misma JWS con nueva solicitud autenticada.

Expiración: timestamp + 30 s + 1 s; se podan entradas al procesar solicitudes. Capacidad máxima 10,000, fail closed si se llena. No hay GC periódico cuando no hay tráfico, pero el tamaño está acotado. Test de TTL demuestra poda y rechazo del mensaje viejo incluso después. No se usa la JWS como clave de replay. Este cache no es distribuido: reinicios, rotación y múltiples instancias requieren diseño posterior.

## Response contract

Éxito: ok:true, protocol_version:1, request_id, evidence_type, verified:true, normalized y verification. verification especifica chain:verified, ocsp:not_checked y trust:public_test_lab. Modo online actualmente bloqueado por el defecto OCSP. La cadena verificada es respecto a las roots configuradas del lab, no una compra Apple productiva.

Response canonical = JSON.stringify UTF-8 de:
`["abilene-response", protocol_version, HTTP_status, caller_id, key_id, request_id, request_nonce, evidence_type, timestamp, response_body_hash]`.

Firma con clave response derivada. Autentica status HTTP, bytes exactos del body y correlación con nonce/request_id/tipo originales. Timestamp de respuesta debe estar a ±30 s. Caller verifica todo ello antes de parsear/confiar; requiere HTTP 200, ok:true, protocolo/tipo/request_id correctos, verified===true, metadata de verificación y normalización del tipo esperado.

No se devuelven JWS, signedTransactionInfo, signedRenewalInfo, signedPayload, roots, secretos ni stacks. Cache-Control:no-store. Errores retornan ok:false y catálogo sanitizado. HMAC de respuesta también se emite para rechazos cuando es posible; una respuesta incompleta o no autenticable sigue siendo fallo para caller.

### Normalización por tipo

Las claves permitidas están en schema.mjs; no se copia el payload completo. Valores presentes deben tener tipo correcto y números enteros seguros. Fechas se conservan epoch ms, sin conversión de zona horaria. Campos opcionales ausentes/null se omiten, no se inventan IDs o fechas.

| Tipo | Campos permitidos / límites |
|---|---|
| Transaction | bundleId, environment, transactionId, originalTransactionId, productId, subscriptionGroupIdentifier, appAccountToken, appTransactionId, purchaseDate, expiresDate, revocationDate, inAppOwnershipType, isUpgraded, signedDate |
| RenewalInfo | environment, originalTransactionId, productId, autoRenewProductId, autoRenewStatus, expirationIntent, gracePeriodExpiresDate, renewalDate, signedDate; no bundle inventado |
| Notification | notificationUUID, notificationType, subtype, signedDate, environment/bundleId cuando vienen en data; transaction/renewal_info anidadas solo después de verificar cada JWS y comprobar correlación cuando ambas existen |
| AppTransaction | bundleId, receiptType, appTransactionId, appAppleId, receiptCreationDate, originalPurchaseDate, applicationVersion, originalApplicationVersion |

Caller exige campos mínimos por tipo (bundle/environment en Transaction; environment en RenewalInfo; UUID/type en Notification; bundle/receiptType en AppTransaction). No exige falsos transaction IDs a los fixtures mínimos. Por eso este contrato no demuestra una prueba comercial completa: la integración de ledger debe exigir su evidencia y correlaciones completas.

Los fixtures testCA positivos de Transaction/RenewalInfo son modelos mínimos. La Notification TEST oficial no contiene JWS anidadas; su normalización exterior sí se probó. Camino anidado implementado con APIs oficiales, positivo anidado completo no demostrado. AppTransaction usa verifyAndDecodeAppTransaction y tiene negativos; falta vector firmado positivo legítimo.

## Errores y fail closed

| HTTP | Código | Retryable | Interpretación |
|---|---|---|---|
| 400 | INVALID_REQUEST, INVALID_EVIDENCE_TYPE, UNSUPPORTED_PROTOCOL_VERSION | false | Contrato rechazado |
| 401 | UNAUTHORIZED, INVALID_MAC, INVALID_BODY_HASH, STALE_REQUEST, FUTURE_REQUEST | false | Transporte no aceptable |
| 409 | REPLAY_DETECTED | false | Nuevo intento necesita nueva autenticación |
| 422 | APPLE_VERIFICATION_FAILED | false | Rechazo opaco de evidencia; no permite inferir revocación definitiva |
| 422 | APPLE_BUNDLE_MISMATCH, APPLE_ENVIRONMENT_MISMATCH | false | Scope oficial no coincide |
| 503 | APPLE_VERIFICATION_RETRYABLE | true | RETRYABLE_VERIFICATION_FAILURE oficial |
| 503 | VERIFIER_INTERNAL_ERROR, VERIFIER_UNAVAILABLE | true | Fallo interno/saturación |
| 503/configuración | OCSP_FRESHNESS_UNVERIFIED | true | Arranque con onlineChecks solicitado se bloquea |
| 504 | REQUEST_TIMEOUT | true | Deadline de verificación |
| 408/cierre | REQUEST_TIMEOUT | true | Body no recibido dentro del límite |

Safe message de errores normales: Verification request rejected. Algunos rechazos tempranos carecen de envelope completo; caller falla cerrado. No se inventan APPLE_OCSP_REVOKED/UNKNOWN cuando Apple no los expone diferenciados.

Timeout de body 2 s, request/headers de Node 3 s, keepalive 1 s, verificación 1.5 s, caller 2 s. Tests de timeout usan plazos locales menores. Como las APIs oficiales no exponen cancelación por AbortSignal, vencer el deadline no cancela automáticamente su operación; se cuenta como activa hasta que termine, con máximo 32 verificaciones simultáneas. Un despliegue futuro necesita presupuesto de concurrencia/timeout coherente con los 30 s de node-fetch OCSP. No se oculta este límite.

Caller ante fallo devuelve trusted:false y error_or_reconciliation; no guarda derechos, no hace fallback, no reintenta indefinidamente. Retryable:false no significa que el backend deba revocar permanentemente: los rechazos opacos pueden necesitar investigación/reconciliación. Los mecanismos de concesión no existen en el lab.

## Evidencia SignedDataVerifier y tests

153 tests de laboratorio: **148 PASS, 2 FAIL, 3 SKIP**; 0 cancelados. Desglose: matriz crypto directa 51/51, contrato/service/caller 88 PASS + 1 SKIP, OCSP 9 PASS + 2 FAIL + 2 SKIP.

Transaction, RenewalInfo y Notification positivos oficiales testCA pasan a través de HTTP/HMAC/normalización. Payload/firma alterados, truncated, alg none, malformed/empty, wrong roots/chain, bundle y environment rechazados. Matriz directa adicional cubre OID y fechas. Same-JWS/new-request aceptado; replay de nonce, ID o request completa rechazado. Caller rechaza Node caído, timeout, socket error, status 5xx/4xx inesperado, JSON inválido, respuesta truncada, MAC/body/status/correlación alterados y verified:false, incluso cuando algunos errores de schema se firman con la clave del lab.

SKIP individuales:
1. AppTransaction positivo: no existe vector legítimo firmado en el material auditado.
2. OCSP REVOKED: no hay respuesta firmada legítima de ese estado.
3. OCSP UNKNOWN: mismo límite; no se fabricó un estado como si procediera de Apple.

Los dos FAIL son invariantes requeridos de frescura OCSP. No se marcan expected-failure para esconderlos. La primera ejecución dentro del sandbox no pudo hacer bind (EPERM); tras autorización de loopback se ejecutaron realmente los tests. Eso fue una restricción del entorno, no fallo de código funcional.

## OCSP: auditoría oficial y prueba pública

Fuente primaria: [SignedDataVerifier oficial](https://apple.github.io/app-store-server-library-node/classes/SignedDataVerifier.html) y [código Apple fijado](https://github.com/apple/app-store-server-library-node/blob/bb0c0f874494321ea2d005329c3dc2188e893d41/jws_verification.ts). La instalación local dist/jws_verification.js se inspeccionó directamente; sus 340 archivos de paquete coinciden byte a byte con la instalación auditada de Fase 41. No se modificó la librería.

Auditoría de la implementación instalada:
- enableOnlineChecks=false: fecha efectiva signedDate/receiptCreationDate para cadena, sin OCSP.
- true: fecha actual, OCSP para leaf e intermediate y cache de claves verificadas.
- URLs obtenidas de infoAccess. Se construye ASN.1 OCSP con jsrsasign, POST con node-fetch 2.7.0, timeout 30,000 ms. HTTP no exitoso y errores de red se convierten en RETRYABLE_VERIFICATION_FAILURE, conservando cause cuando procede.
- Verifica firmante de respuesta, firma, identificador de certificado y status good. Estados distintos de good se colapsan en FAILURE; no hay enum público separado revoked/unknown. En verifyJWT pueden quedar envueltos como VERIFICATION_FAILURE. Parser/otros fallos también pueden colapsarse según punto de entrada.
- Cache 15 minutos; umbral nominal 32 entradas con limpieza de expiradas cuando se supera, no debe afirmarse un LRU duro de 32. El segundo uso de la cadena válida se probó sin nuevas llamadas al transporte. No se esperaron 15 minutos para medir expiración real del cache.

Prueba pública: solo certificados públicos previamente auditados; ninguna JWS de compra, token o credencial. Dos POST a ocsp.apple.com, rutas derivadas de certificados:
`/ocsp03-wwdrg602` y `/ocsp03-applerootcag3`.
Las URLs son HTTP según infoAccess, no se presentaron como HTTPS. Las respuestas OCSP llevan firma criptográfica. El runner rechazó redirecciones y no desactivó TLS ni cambió trust. El primer intento falló DNS dentro del sandbox; la ejecución autorizada obtuvo HTTP 200/200.

Resultado oficial de cadena+OCSP: aceptada en aproximadamente 159 ms; transportes 95 y 152 ms en paralelo. Una única comprobación de cadena, dos solicitudes. Respuestas DER públicas guardadas por hash para reutilización offline. El estado GOOD fue observado, pero esta aceptación no acredita comprobación correcta de frescura.

| Certificado público | thisUpdate | nextUpdate | Respuesta SHA-256 |
|---|---|---|---|
| Leaf | 20260909170030Z | 20260910050029Z | e4935183cd0bf5160334ae4bc32889d9cba432e105188b2766e9183a388d0ce1 |
| Intermediate | 20260910001835Z | 20260910121834Z | 3dd14ec10e2be9a6430e58484fff3118a181f3fa5f64eac2d9371baf9f0911d2 |

Estas fechas son UTC. Reloj observado durante el análisis: 2026-09-10T01:59:59Z (9 de septiembre en America/Chicago). El replay offline GOOD fija el reloj de test en 2026-09-10T01:59:00Z para mantener una prueba histórica reproducible; no certifica que esas respuestas sigan frescas al volver a ejecutar el lab días después.

### Defecto reproducido de frescura

parseX509Date usa una expresión regular que espera 14 dígitos sin Z. Los valores reales parseados por jsrsasign terminan en Z. En Node 22.23.2, el resultado oficial es Invalid Date para los cuatro campos thisUpdate/nextUpdate observados. Las comparaciones con NaN no detectan antigüedad ni futuro.

Tests independientes, en proceso aislado y sin modificar DER/firmas:
- Reloj 2026-09-20T00:00:00Z: respuesta leaf ya expirada; checkOCSPStatus la acepta. Test que exige rechazo: FAIL.
- Reloj 2026-09-08T00:00:00Z: respuesta leaf todavía futura; checkOCSPStatus la acepta. Test que exige rechazo: FAIL.

Solo se usa mock.timers de node:test para Date y un hook de transporte limitado al runner. No se modifica el verificador, sus métodos de firma, la cadena o archivos de dependencia. Esta prueba demuestra un fallo real en esta combinación fijada. No se comunicó a terceros ni se realizó una divulgación externa en esta fase.

### Pruebas controladas OCSP

Hook de node-fetch exclusivo del proceso tests/ocsp.test.mjs; restaurado al terminar. No está en service.mjs, caller ni standalone. Proporciona respuestas públicas firmadas o redirige transporte a servidor HTTP local para fallos; no inventa firmas/status Apple.

- GOOD público capturado, firma/cadena aceptadas: PASS de ejecución; cache sin segundo fetch: PASS.
- Timeout real de node-fetch en loopback (40 ms en runner frente a 30 s solicitado por Apple): RETRYABLE_VERIFICATION_FAILURE, cause.type=request-timeout.
- Connection refused real en loopback: RETRYABLE_VERIFICATION_FAILURE, cause.code=ECONNREFUSED.
- DNS: error ENOTFOUND inyectado en runner, misma categoría retryable; aparte se observó ENOTFOUND real bajo sandbox.
- HTTP 503 local: retryable.
- DER malformado: rechazo, sin atribuirle un estado Apple específico.
- Respuesta auténtica para otro certificado/responder: rechazo.
- Error retryable real de la librería a través de service/caller: trusted:false.
- REVOKED/UNKNOWN: SKIP firmado; código agrupa estados no good, no se inventa granularidad.

### Política conservadora y egress futuro

GOOD solo podrá continuar a otras verificaciones cuando también se demuestre frescura. REVOKED/UNKNOWN/ERROR: nunca concesión automática. TIMEOUT/red/HTTP temporal: no concesión inmediata, retry con presupuesto y reconciliación. Usar los códigos reales agrupados; no inferir revocación definitiva de un FAILURE genérico.

Hoy el defecto de frescura impide habilitar online. No se compensa usando onlineChecks=false para compras reales. Resolver con una versión oficial corregida o estrategia aprobada, y repetir las dos pruebas negativas antes de integración. No se seleccionó otra versión ni se parcheó 3.1.0.

Egress observado: ocsp.apple.com:80 derivado de AIA. Roots se cargan localmente; no hay petición automática de credenciales Apple ni API de compras en esta prueba. El futuro despliegue necesita política de egress basada en destinos oficiales revisados y manejo de sus cambios/redirecciones, además de HTTPS normal para fuentes públicas si se distribuyen raíces fuera del bundle. No se abrió firewall.

## Performance y concurrencia

Localhost únicamente; no representa latencia cloud. Arranque medido desde creación del servidor, excluye imports/npm: 2.765 ms. Primera verificación HTTP autenticada aproximadamente 7.205 ms. Secretos y HMAC activos en medición.

| Operación | N | min ms | mediana ms | p95 ms | max ms |
|---|---|---|---|---|---|
| Primera HTTP+crypto | 1 | 7.205 | 7.205 | 7.205 | 7.205 |
| Health autenticado, sin crypto Apple | 20 | 0.253 | 0.397 | 1.065 | 1.156 |
| Crypto offline directa | 20 | 0.230 | 0.296 | 0.598 | 0.800 |
| HTTP+HMAC+crypto secuencial | 20 | 0.530 | 0.673 | 1.466 | 1.652 |
| 20 solicitudes simultáneas | 20 | 2.379 | 6.021 | 9.868 | 10.252 |

20/20 concurrentes exitosas, 20 request_id distintos, 0 errores; sin mezcla de respuestas ni falsos replay observados. No stress test ni optimización prematura. OCSP público: N=1 cadena / 2 POST, 159 ms; no se ofrece p95 de red a partir de una sola muestra.

## Aislamiento, secretos y auditoría de seguridad

Proceso separado bajo UID 501, no root, Node 22.23.2 con --experimental-permission y --allow-fs-read limitado al workspace; sin permiso de escritura ni creación de subprocesses desde ese proceso. Arrancó y verificó un fixture vía HTTP/HMAC. Env mínimo con secreto efímero, sin heredar configuración Supabase/Apple. El permiso Node es defensa adicional del laboratorio, no sandbox productivo certificado. No restringe red por sí solo; el servicio fija bind 127.0.0.1 y la ejecución normal es offline.

No acceso al repo desde el proceso verificador, DB, Supabase, Stripe ni credenciales Apple. Todos los servicios HTTP se cierran por tests/launchers. El material público temporal se conserva para reproducción, no es un servicio persistente.

Auditoría textual dirigida y revisión de ramas: sin secretos hardcoded, JWS logging, bind público, TLS deshabilitado, shell execution/injection, trust store test usado implícitamente como producción ni catch→allow. Path exacto no se utiliza para acceder a archivos. JSON y MAC estrictos, cache acotado/TTL, timestamps validados. Respuesta solo se marca verificada tras await exitoso; el caller rechaza metadata incompleta. Los hooks y respuestas artificialmente firmadas del lab están limitados a tests para probar rechazo, claramente separados del servicio.

Logging futuro: request_id, tipo, stable code, duración, entorno y hash/truncamiento de IDs si necesario. Nunca payload/JWS, appAccountToken, firmas HMAC, secretos o tokens. El prototipo no emite logs por solicitud; standalone solo puerto/bind/UID/versión. Tests conservan nombres y stacks de assertions sin payloads.

## Alojamiento e identidad futuros: solo requisitos

Sin proveedor escogido, cuentas, recursos o deploy. Comparación:

| Opción | Aspectos a resolver |
|---|---|
| Contenedor Node privado | Red restringida, TLS, disponibilidad/replicas, health, rollback, autoscaling y costo base |
| Serverless Node privado/autenticado | Cold starts, timeout, concurrencia, egress OCSP, límites y costo por invocación; verificar acceso desde Edge |
| Infraestructura Node controlada | Parches, operación/HA, capacidad y costo permanente; mismas fronteras de autenticación |

Requisitos comunes: runtime verificado, imagen/lock fijos, región cercana, deployment reproducible y rollback, TLS, secretos gestionados, métricas redacted, health, límites de tamaño/tiempo/concurrencia, presupuesto de retry/costos y separación dev/staging/prod y Sandbox/Production.

Identidad: en lab un caller/key id; en producción evaluar HMAC con secret manager, mTLS, workload identity o tokens de servicio firmados según conectividad. Private networking puede no estar disponible directamente desde Edge hospedado; hay que verificarlo, no asumirlo. Si endpoint debe ser alcanzable, restringirlo y autenticarlo fuertemente sin convertir IP en identidad.

Rotación: key id único, claves por entorno/caller, periodo de solapamiento acotado, expiración y revocación; nunca rotar el identificador de replay de forma que reutilizar una petición capturada sea aceptado. Cache distribuido/resistente a reinicio es diseño pendiente. Ninguna infraestructura de secretos implementada.

## Cambios, no regresión y salida

apple-verifier.mjs se conserva. Hoy recibe una instancia inyectada: no construye por sí mismo SignedDataVerifier dentro del entrypoint Edge. Una futura implementación remota tendría que mantener contrato de scope/correlación y evidencia completa, no solo sustituir un import. No se modificaron endpoints reales ni su composición.

Tests existentes backend Apple: 51 PASS / 0 FAIL. Inspección local confirma POST sigue 503 APPLE_BACKEND_NOT_CONFIGURED. No se invocó producción.

376/376 hashes iniciales conservados: 373 versionados + docs 41/42/43. Cobertura de archivos versionados incluye Android, iOS/StoreKit bridge, src, manifiestos, vite, dist-admin/Admin, migraciones y Stripe. No se atribuye baseline hash a archivos generados/ignorados fuera del inventario git; no se trabajó en esas áreas. Migración SHA `9e2e48561f0551b32361dae72e9c04da83e2a1f739b7755516a3e77108b8065d` intacto.

Único archivo nuevo dentro del repo: docs/phase44-node-verifier-architecture.md. HEAD sin cambios; nada staged; docs 41/42/43/44 untracked. diff --stat, --name-only, --check vacíos. Sin git add, commit, push ni checkpoint.

No Supabase/DB/SQL/migrations, Stripe, Android, StoreKit/Xcode, App Store Connect, Apple Developer, Sandbox, dispositivo, TestFlight, App Attest, pagos, cloud, túneles, firewall o deploy.

Bloqueante: frescura OCSP defectuosa en librería fija; 2 tests FAIL abiertos. No bloqueantes para el transporte pero pendientes para integración: AppTransaction firmado positivo; estados OCSP REVOKED/UNKNOWN firmados; notificación anidada positiva; replay distribuido, identidad/rotación/TLS, validación de ledger completa y cancelación/egress productivos. Aviso de mantenimiento de jsrsasign se mantiene como riesgo de dependencia.

Conclusión: Edge/orquestador→Node privado sigue siendo la arquitectura recomendada; el transporte local quedó demostrado. Fase 44 es C por el defecto OCSP, no D por falta de ejecución. No recomendar checkpoint 41–44 como validación aprobada ni iniciar App Attest/integración todavía. Fase 45 debe aislar/resolver el defecto de frescura con solución oficial o estrategia explícitamente aprobada y hacer pasar ambos negativos sin relajar controles. AppTransaction positivo seguirá pendiente si no existe vector. Después, reevaluar A/B y decidir manualmente si corresponde checkpoint. No se abrió issue externo ni se contactó a terceros.

## Comandos ejecutados y reproducción

En el workspace temporal:

```sh
npm install --offline --ignore-scripts --no-audit --no-fund --cache ./npm-cache
npm ci --offline --ignore-scripts --no-audit --no-fund --cache ./npm-cache
npm ls --all --json > dependency-tree.json
node --test tests/lab.test.mjs
node --test tests/crypto.test.mjs
node --test tests/ocsp.test.mjs
node --test tests/*.test.mjs > final-tests.tap 2>&1
node benchmark.mjs
node isolation.mjs
node ocsp-public.mjs
```

ocsp-public.mjs fue ejecutado primero bajo sandbox (DNS bloqueado) y una vez con permiso de red pública; no debe incluirse en reejecuciones automáticas de la suite offline. Los tests OCSP reutilizan respuestas DER firmadas guardadas. El clock del GOOD histórico y los dos negativos es explícito. Los hooks de node-fetch viven solo en runners separados. No se ejecutan por standalone.

Proceso de aislamiento: Node --experimental-permission --allow-fs-read=<workspace> standalone.mjs, secreto efímero transmitido en environment por isolation.mjs. No imprimir la variable. Los comandos localhost necesitan permiso de bind en este entorno. El script de shell que capturó pruebas y luego imprimió tail puede terminar en 0; la aceptación se deriva del TAP: dos FAIL reales pendientes.

En repo: git status, status -sb, log -1, diff --check, hashes e inspecciones locales; node --test tests/apple-backend/backend.test.mjs. No builds ni suites fuera de alcance.

## Archivos del laboratorio y SHA-256

Archivos fuente: auth.mjs, schema.mjs, verifier.mjs, service.mjs, caller.mjs, standalone.mjs, isolation.mjs, benchmark.mjs, ocsp-public.mjs; tests/lab.test.mjs, tests/crypto.test.mjs, tests/ocsp.test.mjs. write-report.py genera este documento. Datos/resultados se enumeran a continuación; node_modules/ y npm-cache/ contienen solo dependencia/caché npm pública y no se versionan. downloads/ contiene los certificados/fixtures públicos auditados. Ningún archivo contiene la clave efímera.

| Archivo principal | SHA-256 |
|---|---|
| package.json | e88206f9f64fcdd3d5de0e7e59b74d3f2ad3d1bc1b3cb9d337ca60e40f051568 |
| package-lock.json | ad66e28e75f9b72126647166fa8b38ef1e75f7b8d26817a60c7bc6cdb2cec720 |
| auth.mjs | 055a41cfe32ee7007115f7e1acc0ef1614d886e6d54bcfdf04efa74f749b819b |
| schema.mjs | aab22715b41bcc3cb35ace98cbf98d42ef83cf9a993b2e689e7676f3b68f95f2 |
| verifier.mjs | e2c39bdd3846d2eb321e45f5c811c51304ae6fcefec2af1915976c56f6ddc93b |
| service.mjs | 055b3159ad1829dd4ecda79f8707abf0c5a75938b80431d2f785cb9feeffb14d |
| caller.mjs | 220d609bf8d05c279e6e60bc7ba21fb63ee55f75d761fa9814bcd07e3c75a4c0 |
| standalone.mjs | 2f93f35707ff3ca90015de0d94d56e5ca8bcdd1a7e45556a4b36448d341c23a0 |
| isolation.mjs | 734e2f28a49238c685c9a319ec53bc8dad22c2a1982e09c8d7c240f66aac979f |
| benchmark.mjs | 24cc4fbef5dfc68ab7b5367fbbac5c42f5b2c8a5899f3de41d64833cb9c5c45c |
| ocsp-public.mjs | b9b0d300f4b1848c63bdb5afd1ab4730674e92ab3efd87f55dcc8452a6843528 |
| tests/lab.test.mjs | f8cf3530ab1c0004ddcb79ea072419441a7b478f7f72fb21126421c852bbf0fc |
| tests/crypto.test.mjs | b291e1f8d070016cf5f344fc1711aedd145403e6db8ec3ac069d0f15a064c53e |
| tests/ocsp.test.mjs | c162b7b8f613b6262a4dee417262e0a1af3446d68f983d59fea77b416750458b |
| dependency-tree.json | ba4d1e0d96e1d19d7aed15b6e0ecfdadbbbd53bc94bf42fff57d075d9ed79ce3 |
| final-tests.tap | 94a5cc97667e3be9b9bfc2cf924ef8553092077875552449eaa1e0a16a51cac8 |
| ocsp-public-result.json | 750b9c3ac006090ee72c44b1e06e9baff24e4e74093024a0d7df5d545641bdb0 |
| ocsp-fixtures.json | 5bee4eafb3270b9a1b1954c5881869bcbd006b567ecb63bc1a84b55a7b5ca22c |
| performance.json | 5e2a2e0cce62d8adc0610727bbdcc74fb68e998f068d29d01e4d2408eca7234d |
| isolation-result.json | ed527a9baf6766452b7ac741edc5a68d03890639fec11c62b71b895f11109614 |
| security-audit.json | 87aa1c9ecbbd65fe89320ef095cc3abc5e4e1c91420c490f86f2500533c2bd0a |
| test-results.json | 90f3cadc8491f068576f645d235b2e0637cb88372e769285e1be90d981931bea |

El hash del propio documento se calcula después de escribirlo y se entrega en el reporte final para evitar autorreferencia.

## Matriz completa final

| # | Test | Resultado |
|---|---|---|
| 1 | crypto import | PASS |
| 2 | crypto A node:crypto | PASS |
| 3 | crypto B X509Certificate | PASS |
| 4 | crypto C Buffer | PASS |
| 5 | crypto D process | PASS |
| 6 | crypto E fs | PASS |
| 7 | crypto F path | PASS |
| 8 | crypto G jsonwebtoken | PASS |
| 9 | crypto H jsrsasign | PASS |
| 10 | crypto I node-fetch Headers Response | PASS |
| 11 | crypto J base64url | PASS |
| 12 | crypto M SHA-256 | PASS |
| 13 | crypto transactionInfo valid testCA / ECDSA / async | PASS |
| 14 | crypto transactionInfo payload tampered | PASS |
| 15 | crypto transactionInfo signature tampered | PASS |
| 16 | crypto transactionInfo wrong roots | PASS |
| 17 | crypto transactionInfo invalid chain | PASS |
| 18 | crypto transactionInfo alg none | PASS |
| 19 | crypto renewalInfo valid testCA / ECDSA / async | PASS |
| 20 | crypto renewalInfo payload tampered | PASS |
| 21 | crypto renewalInfo signature tampered | PASS |
| 22 | crypto renewalInfo wrong roots | PASS |
| 23 | crypto renewalInfo invalid chain | PASS |
| 24 | crypto renewalInfo alg none | PASS |
| 25 | crypto testNotification valid testCA / ECDSA / async | PASS |
| 26 | crypto testNotification payload tampered | PASS |
| 27 | crypto testNotification signature tampered | PASS |
| 28 | crypto testNotification wrong roots | PASS |
| 29 | crypto testNotification invalid chain | PASS |
| 30 | crypto testNotification alg none | PASS |
| 31 | crypto verifyAndDecodeTransaction empty | PASS |
| 32 | crypto verifyAndDecodeTransaction null | PASS |
| 33 | crypto verifyAndDecodeTransaction malformed | PASS |
| 34 | crypto verifyAndDecodeRenewalInfo empty | PASS |
| 35 | crypto verifyAndDecodeRenewalInfo null | PASS |
| 36 | crypto verifyAndDecodeRenewalInfo malformed | PASS |
| 37 | crypto verifyAndDecodeNotification empty | PASS |
| 38 | crypto verifyAndDecodeNotification null | PASS |
| 39 | crypto verifyAndDecodeNotification malformed | PASS |
| 40 | crypto verifyAndDecodeAppTransaction empty | PASS |
| 41 | crypto verifyAndDecodeAppTransaction null | PASS |
| 42 | crypto verifyAndDecodeAppTransaction malformed | PASS |
| 43 | crypto bundle mismatch | PASS |
| 44 | crypto environment mismatch | PASS |
| 45 | crypto missing roots | PASS |
| 46 | crypto malformed root | PASS |
| 47 | crypto missing x5c | PASS |
| 48 | crypto AppTransaction unsigned model | PASS |
| 49 | crypto K ASN1 real Apple chain | PASS |
| 50 | crypto P certificate dates | PASS |
| 51 | crypto Q wrong OID | PASS |
| 52 | transport-auth valid request and response | PASS |
| 53 | transport-auth tamper MAC false | PASS |
| 54 | transport-auth tamper body byte | PASS |
| 55 | transport-auth tamper body hash | PASS |
| 56 | transport-auth tamper path | PASS |
| 57 | transport-auth tamper method | PASS |
| 58 | transport-auth tamper request_id | PASS |
| 59 | transport-auth tamper nonce | PASS |
| 60 | transport-auth tamper timestamp | PASS |
| 61 | transport-auth tamper evidence type | PASS |
| 62 | transport-auth tamper caller | PASS |
| 63 | transport-auth tamper key id | PASS |
| 64 | transport-auth reject old | PASS |
| 65 | transport-auth reject future | PASS |
| 66 | transport-auth reject malformed timestamp | PASS |
| 67 | transport-auth reject protocol | PASS |
| 68 | transport-auth reject content type | PASS |
| 69 | transport-auth reject invalid evidence type | PASS |
| 70 | transport-auth JSON malformed | PASS |
| 71 | transport-auth JSON duplicate | PASS |
| 72 | transport-auth JSON unknown field | PASS |
| 73 | transport-auth oversized | PASS |
| 74 | transport-auth signed wrong method | PASS |
| 75 | transport-auth signed unknown path | PASS |
| 76 | transport-auth path traversal | PASS |
| 77 | replay same request rejected | PASS |
| 78 | replay reused x-request-id | PASS |
| 79 | replay reused x-nonce | PASS |
| 80 | replay legitimate same evidence new transport allowed | PASS |
| 81 | transaction positive public testCA | PASS |
| 82 | transaction rejects payload | PASS |
| 83 | transaction rejects signature | PASS |
| 84 | transaction rejects truncated | PASS |
| 85 | transaction rejects malformed | PASS |
| 86 | transaction rejects empty | PASS |
| 87 | transaction rejects alg none | PASS |
| 88 | transaction rejects wrong chain | PASS |
| 89 | renewal_info positive public testCA | PASS |
| 90 | renewal_info rejects payload | PASS |
| 91 | renewal_info rejects signature | PASS |
| 92 | renewal_info rejects truncated | PASS |
| 93 | renewal_info rejects malformed | PASS |
| 94 | renewal_info rejects empty | PASS |
| 95 | renewal_info rejects alg none | PASS |
| 96 | renewal_info rejects wrong chain | PASS |
| 97 | notification positive public testCA | PASS |
| 98 | notification rejects payload | PASS |
| 99 | notification rejects signature | PASS |
| 100 | notification rejects truncated | PASS |
| 101 | notification rejects malformed | PASS |
| 102 | notification rejects empty | PASS |
| 103 | notification rejects alg none | PASS |
| 104 | notification rejects wrong chain | PASS |
| 105 | app-transaction negative  | PASS |
| 106 | app-transaction negative null | PASS |
| 107 | app-transaction negative a.b.c | PASS |
| 108 | app-transaction official signed positive unavailable | SKIP |
| 109 | fail-closed wrong roots | PASS |
| 110 | fail-closed bundle mismatch | PASS |
| 111 | fail-closed environment mismatch | PASS |
| 112 | fail-closed invalid certificate config | PASS |
| 113 | fail-closed missing roots config | PASS |
| 114 | fail-closed no implicit lab trust | PASS |
| 115 | fail-closed internal | PASS |
| 116 | fail-closed verification timeout | PASS |
| 117 | fail-closed OCSP retryable error | PASS |
| 118 | fail-closed transport timeout | PASS |
| 119 | fail-closed transport socket error | PASS |
| 120 | fail-closed transport invalid JSON | PASS |
| 121 | fail-closed transport HTTP 500 | PASS |
| 122 | fail-closed transport unexpected HTTP 418 | PASS |
| 123 | fail-closed transport truncated response | PASS |
| 124 | fail-closed transport unauthed verified true | PASS |
| 125 | fail-closed Node down connection refused | PASS |
| 126 | response-auth body tamper | PASS |
| 127 | response-auth MAC | PASS |
| 128 | response-auth status | PASS |
| 129 | response-auth request id | PASS |
| 130 | response-auth nonce | PASS |
| 131 | response-auth signed invalid verified false | PASS |
| 132 | response-auth signed invalid request id mismatch | PASS |
| 133 | response-auth signed invalid kind mismatch | PASS |
| 134 | response-auth signed invalid unknown normalized field | PASS |
| 135 | response-auth signed invalid invalid field type | PASS |
| 136 | response-auth signed invalid JSON | PASS |
| 137 | concurrency 20 isolated authenticated requests | PASS |
| 138 | fail-closed online mode blocked after proven OCSP freshness defect | PASS |
| 139 | response-auth incomplete normalization rejected | PASS |
| 140 | replay TTL prunes expired entries and stale request stays rejected | PASS |
| 141 | ocsp disabled performs zero fetch calls | PASS |
| 142 | ocsp GOOD captured legitimate signed public responses and cache | PASS |
| 143 | ocsp controlled timeout maps retryable | PASS |
| 144 | ocsp controlled refused maps retryable | PASS |
| 145 | ocsp controlled dns maps retryable | PASS |
| 146 | ocsp controlled http maps retryable | PASS |
| 147 | ocsp malformed signed-response bytes reject | PASS |
| 148 | ocsp wrong responder/certificate response rejects | PASS |
| 149 | ocsp actual retryable library error reaches service and caller closed | PASS |
| 150 | ocsp REVOKED signed legitimate fixture | SKIP |
| 151 | ocsp UNKNOWN signed legitimate fixture | SKIP |
| 152 | ocsp freshness rejects expired authentic response (required safety invariant) | FAIL |
| 153 | ocsp freshness rejects future authentic response (required safety invariant) | FAIL |
