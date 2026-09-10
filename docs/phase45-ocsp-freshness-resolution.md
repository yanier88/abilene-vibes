# Fase 45 — Resolución de frescura OCSP

## Dictamen

**C — NO APTO TODAVÍA. Tipo: NO_SAFE_FIX_AVAILABLE.** Evaluación realizada el 9 de septiembre de 2026 en America/Chicago (10 de septiembre UTC). Se reprodujeron ambos defectos antes de investigar soluciones. No hay versión posterior publicada; la propuesta upstream de parser sigue abierta y no resuelve la caché. No se ha demostrado un guard externo utilizable que preserve la asociación con la misma respuesta autenticada por Apple mediante la API disponible. Esto describe las opciones comprobadas y las restricciones de esta fase, no una imposibilidad teórica universal.

La arquitectura Edge/orchestrator → Node privado → SignedDataVerifier → backend sigue recomendada. Su modo online sigue bloqueado. No checkpoint, App Attest, Sandbox, dispositivo ni despliegue.

## 1. Precheck y alcance

Repositorio `/Users/yanier/Documents/abilene-vibes`, branch `main`, HEAD y referencia local origin/main `1607ff2dad6a23cfcb56b4b769fbde3e365dd437`, mensaje `Validate Apple IAP backend on local PostgreSQL`. Sin fetch. Al inicio únicamente los cuatro documentos 41–44 untracked, nada staged ni cambios tracked. Se preservaron todos los cambios existentes.

Entorno: macOS 26.6.2 arm64, Node `/usr/local/bin/node` 22.23.2, npm 10.9.8. Nuevo laboratorio `/private/tmp/abilene-phase45-ocsp-qviwkgak`. La evidencia original permanece en `/private/tmp/abilene-phase44-node-verifier-i8nosobz`. Se copiaron fixtures públicos, scripts y lockfile; `npm ci --offline --ignore-scripts --no-audit --no-fund --cache ./npm-cache` instaló 48 paquetes. Sin dependencia nueva, actualización global ni cambio de nombre del paquete Apple. Se conservó el nombre del laboratorio heredado en package.json para preservar el lockfile.

Los 340 archivos instalados del paquete Apple coinciden byte a byte con Fase 44. La integridad del lockfile coincide con la publicada por npm. Los 377 archivos del snapshot inicial del repo permanecen idénticos, incluidos los documentos 41–44. La migración Apple conserva SHA-256 `9e2e48561f0551b32361dae72e9c04da83e2a1f739b7755516a3e77108b8065d`.

## 2. Reproducción previa a investigación

`baseline-reproduction.tap`: 3 tests, 1 PASS, 2 FAIL. La misma respuesta DER pública auténtica, sin modificar firma, issuer, serial ni responder, se entrega al verificador oficial mediante transporte interceptado exclusivamente en el proceso de test. Solo cambia el reloj controlado con node:test:

| Reloj UTC | Esperado | 3.1.0 | Invariante |
|---|---|---|---|
| 2026-09-10 01:59:00 | aceptar GOOD fresco | acepta | PASS |
| 2026-09-08 00:00:00 | rechazar futuro | acepta | FAIL |
| 2026-09-20 00:00:00 | rechazar expirado | acepta | FAIL |

Los hooks de transporte de estos tests NO son una solución ni forman parte del servicio. El replay histórico no afirma que el DER siga fresco hoy.

## 3. Causa exacta

Paquete `@apple/app-store-server-library@3.1.0`, `dist/jws_verification.js`: `checkOCSPStatus` desde línea 284, asociación CertID y fechas alrededor de 370–384; `parseX509Date` en 395–396. Los tipos declaran el parser privado y `checkOCSPStatus` protegido, con retorno `Promise<void>`.

Flujo observado: autenticación OCSP y asociación CertID → estado GOOD → parseo thisUpdate/nextUpdate → comparaciones → retorno exitoso. El regex del parser espera exactamente catorce dígitos y fin de cadena. El sufijo Z real impide el reemplazo. Por ejemplo:

`20260909170030Z → cadena sin transformar → new Date(...) → Invalid Date → getTime() = NaN`.

En el fixture leaf, nextUpdate `20260910050029Z` sigue el mismo camino. Tanto `now + 60000 < NaN` como `NaN < now - 60000` son false. Con estado GOOD ninguna condición provoca rechazo y se retorna éxito. `root-cause-evidence.json` registra entrada, transformación, finite=false, epoch=null (representación JSON de valor no finito), comparaciones falsas y certificado. Quitar Z no es solución: el formato alternativo resultante omite UTC y depende del huso local.

La fuente de referencia y el reporte upstream corroboran el diagnóstico: [código oficial](https://github.com/apple/app-store-server-library-node/blob/f6df029e2cbaa3506156e6e650665925bee5fe9c/jws_verification.ts), [issue 447](https://github.com/apple/app-store-server-library-node/issues/447). Los resultados de este laboratorio son evidencia propia, no tests declarados por terceros.

## 4. Investigación oficial y matriz

Consulta fresca a [npm](https://registry.npmjs.org/@apple%2fapp-store-server-library): latest=3.1.0, publicada 2026-05-06T01:14:11.509Z. Versiones publicadas: 0.1.0, 0.1.1, 0.2.0, 1.0.0, 1.0.1, 1.1.0, 1.2.0, 1.3.0, 1.4.0, 1.5.0, 1.6.0, 2.0.0, 3.0.0 y 3.1.0. Las anteriores se inventariaron, no se ejecutaron: no son candidatas posteriores. No hay otra versión posterior que instalar ni otra exigencia de Node que evaluar.

[Releases oficiales](https://github.com/apple/app-store-server-library-node/releases): v3.1.0 publicada 2026-05-06T01:13:52Z. El [changelog oficial](https://github.com/apple/app-store-server-library-node/blob/main/CHANGELOG.md) no contiene una corrección de frescura posterior. Último commit devuelto para el archivo: `f6df029e2cbaa3506156e6e650665925bee5fe9c`, 2026-08-25, ajuste de nombre de parámetro; también se inspeccionó la referencia al cambio previo de skew `aa8fd3337dd7c6a712a2c3a5a387d63b80c1a52f`.

El [issue 447](https://github.com/apple/app-store-server-library-node/issues/447) está abierto. La [PR 451](https://github.com/apple/app-store-server-library-node/pull/451), head `edcd91a205eccafacfbd54576b736c1347ed0835`, creada 2026-09-05, figura abierta y no merged. Propone parseo UTC estricto de GeneralizedTime y rechazo de fechas inválidas; el diff no cambia la caché. Una PR en el repositorio oficial no equivale a versión publicada ni a corrección aprobada por Apple. No se ejecutó su suite declarada ni se fabricaron sus respuestas OCSP: se emuló únicamente su cambio de parser para diagnóstico. Se revisaron también las referencias abiertas 455/456 de timeout, sin adoptarlas.

| Apple library / experimento | Node | expired rejected | future rejected | fresh GOOD | Transaction | Renewal | Notification | Regresión | Recomendación |
|---|---|---|---|---|---|---|---|---|---|
| Oficial 3.1.0 | 22.23.2 | NO | NO | PASS | PASS TEST | PASS TEST | PASS TEST | 148/153 PASS, 2 FAIL, 3 SKIP | No apta online |
| Versión oficial posterior | — | — | — | — | — | — | — | No existe publicada | No upgrade |
| Emulación parser PR451, DIAGNOSTIC ONLY | 22.23.2 | SÍ directo | SÍ directo | PASS directo | No repetido con emulación | No repetido | No repetido | Caché sigue FAIL | No solución |

Los JWS positivos corresponden a testCA oficial de laboratorio: no son compras reales bajo Apple roots. El GOOD OCSP sí utiliza certificados públicos Apple y Apple Root CA G3. Se conserva esa separación de confianza.

La [documentación de SignedDataVerifier](https://apple.github.io/app-store-server-library-node/classes/SignedDataVerifier.html) y sus tipos instalados no ofrecen configuración de parser, TTL de caché ni recibo OCSP autenticado. `enableOnlineChecks=false` produce cero fetch; true valida OCSP y usa caché. Desactivar online no es un sustituto admitido de revocación.

## 5. Caché: segundo bloqueo independiente

Se cachea la clave pública verificada, indexada por `leaf.toString() + intermediate.toString()`. TTL 15 minutos; nominal MAXIMUM_CACHE_SIZE=32. La lectura devuelve la clave antes de repetir cadena/OCSP. No conserva ni limita la entrada por nextUpdate.

Experimento con ambas respuestas auténticas: validación inicial 2026-09-10T05:00:00Z, dos fetch simulados con DER real. nextUpdate leaf=05:00:29Z; cacheExpiry=05:15:00Z. Se avanza a 05:01:30Z, después de nextUpdate+60 s: acepta desde caché, sin nuevos fetch (2→2). `cache-reproduction.tap`: 1 FAIL.

Con el parser emulado corregido ocurre lo mismo: `diagnostic-cache-evidence.json` registra aceptación y fetch 14→14. Una instancia nueva con ese parser rechaza el expirado; la instancia cacheada no. El test conserva FAIL. No se afirma que exista una nueva versión oficial con este comportamiento: es aislamiento experimental del defecto de caché que ya existe en 3.1.0.

## 6. Guard externo: diseño y prueba de viabilidad

Orden requerido: HMAC request → esquema → SignedDataVerifier → evidencia OCSP autenticada y asociada al certificado por Apple → frescura → HMAC response verified=true. Cualquier rechazo previo debe preservarse.

Contrato mínimo necesario: resultado oficial que identifique exactamente el DER autenticado, CertID (issuer y serial), thisUpdate, nextUpdate y estado, ligado a la verificación en curso. Debe cubrir cada certificado consultado y también los cache hits. La capa externa solo aplicaría límites temporales; nunca comprobaría firmas por su cuenta ni confiaría en metadatos del caller.

La API examinada no suministra ese contrato. `checkOCSPStatus` devuelve undefined después de verificar y es protegido; el parser es privado; no existe inyección pública de transporte. Descargar otra respuesta y leer sus fechas no demuestra que sea la misma autenticada por Apple. Un hash aportado por el caller tampoco establece autenticidad.

`guard-feasibility.mjs` es un **DIAGNOSTIC ONLY — contract feasibility probe**: espera la operación oficial, preserva su fallo y permanece `trusted:false / OCSP_FRESHNESS_UNVERIFIED` ante éxito sin recibo. Cuatro tests prueban retorno oficial sin recibo, cierre ante éxito, preservación de rechazo y rechazo de DER/metadatos GOOD no vinculados. No contiene una ruta positiva utilizable, no se instala ni se presenta como TEMPORARY COMPENSATING CONTROL. Su PASS demuestra cierre de la prueba de contrato, no una solución B.

Alternativas descartadas: parser privado sobrescrito, interceptar node-fetch como solución, fork, patch-package, modificar node_modules, segunda respuesta no vinculada, asumir GOOD, desactivar online o usar instancia nueva como único remedio. Esta última evita reutilizar caché pero conserva el parser defectuoso. La subclase `diagnostic-pr451.mjs` sobrescribe explícitamente el parser privado SOLO para demostrar causa, conforme al permiso de diagnóstico de §41; no es un guard externo aprobado.

## 7. Política temporal requerida, no habilitada

- Fechas finitas y representación UTC válida; thisUpdate <= nextUpdate.
- Rechazar si thisUpdate > effectiveNow + 60000 ms.
- Rechazar si nextUpdate < effectiveNow - 60000 ms.
- Tolerancia máxima explícita 60 segundos, heredada de Apple; igualdad en el límite admitida para verificación directa.
- nextUpdate ausente: OCSP lo permite opcionalmente, pero no proporciona por sí solo duración confiable. Política local conservadora: OCSP_FRESHNESS_UNVERIFIED, sin concesión; no inventar TTL sustituto.
- CacheExpiry requerido = min(TTL interno, nextUpdate de todos los estados, máximo de política). Para caché, no ampliar nextUpdate con skew. El fixture usado para demostrar el fallo supera incluso la tolerancia directa.
- Reloj de sistema UTC sincronizado es requisito de seguridad. Monotonic sirve para duración/timeouts y detección de saltos, no sustituye epoch UTC firmado. Ante reloj inválido/desincronización/salto significativo, invalidar caché y fallar cerrado hasta recuperar reloj confiable. Un salto atrás puede extender artificialmente TTL; uno adelante puede invalidar pruebas. Contenedores y serverless heredan la calidad del reloj del host. No se configuró NTP ni infraestructura.

[OCSP RFC6960 §4.2.2.1](https://www.rfc-editor.org/rfc/rfc6960#section-4.2.2.1) prescribe GeneralizedTime con el perfil de [RFC5280 §4.1.2.5.2](https://www.rfc-editor.org/rfc/rfc5280#section-4.1.2.5.2): UTC Z, segundos, sin fracciones. UTCTime tiene reglas de siglo en certificados, pero no es el tipo permitido para estos campos OCSP. Por ello el diagnóstico rechaza UTCTime 500101000000Z (límite 1950) y 491231235959Z (2049), offsets +0000, ausencia de segundos, fracciones y calendario inválido. Acepta día bisiesto válido. Estas pruebas de strings no son respuestas firmadas inventadas. No se eligió un parser nuevo de producción ni una dependencia; el parser emulado únicamente evalúa la propuesta upstream.

Matriz con DER real y parser DIAGNOSTIC: thisUpdate−1 día REJECT; −61 s REJECT; −60 s ACCEPT; −1 s ACCEPT; exacto ACCEPT; fresco ACCEPT; nextUpdate−1 s ACCEPT; exacto ACCEPT; +1 s ACCEPT dentro de skew; +60 s ACCEPT; +61 s REJECT; +1 día REJECT. Los 12 casos directos PASS; el caso de caché sigue FAIL. No confundir aceptación dentro de tolerancia con ausencia de control temporal.

## 8. OCSP, errores y evidencia pública

GOOD fresco: aceptado por firma/cadena oficial en replay histórico. GOOD futuro/expirado: aceptado incorrectamente en 3.1.0. REVOKED y UNKNOWN: SKIP, sin fixtures firmados legítimos; el flujo oficial rechaza estados distintos de good, pero eso no reemplaza su prueba dinámica.

Timeout, connection refused, DNS failure controlada, HTTP 503, DER malformado y respuesta de certificado incorrecto: rechazo oficial comprobado y caller trusted:false en seis tests adicionales. DNS se inyecta como ENOTFOUND dentro del proceso; timeout/refused/HTTP/DER usan 127.0.0.1. No se provocan errores en infraestructura Apple. La API oficial distingue fallo reintentable para transporte; no inferimos REVOKED a partir de un fallo genérico. Códigos futuros OCSP_FUTURE/EXPIRED/REVOKED/UNKNOWN solo podrían emitirse con causa verificable. El código vigente conserva OCSP_FRESHNESS_UNVERIFIED al solicitar modo online.

Cero nuevas llamadas a OCSP Apple en Fase 45. Reutilización de una comprobación pública de Fase 44: dos POST HTTP a ocsp.apple.com, status 200, 95 y 152 ms; cadena ~159 ms. Reloj observado durante aquel análisis: 2026-09-10T01:59:59Z; no se afirma timestamp de captura más preciso que la evidencia conservada. Orígenes: `/ocsp03-wwdrg602` para leaf y `/ocsp03-applerootcag3` para intermedio. HTTP del responder está protegido por la firma OCSP; no se desactivó TLS. La investigación de npm/GitHub fue pública, sin credenciales privadas ni publicación de mensajes.

- Certificado `official-real-apple-leaf.der`, serial público `47C287CDD9F9E7867F528ADA74DC7DB7`, issuer `CN=Apple Worldwide Developer Relations Certification Authority, OU=G6, O=Apple Inc., C=US`. DER 1855 bytes, SHA-256 `3dd14ec10e2be9a6430e58484fff3118a181f3fa5f64eac2d9371baf9f0911d2`; thisUpdate `20260909170030Z`, nextUpdate `20260910050029Z`.
- Certificado `official-real-apple-intermediate.der`, serial público `22C1A1470A747369EF538612C9C69F3D38F36CD7`, issuer `CN=Apple Root CA - G3, OU=Apple Certification Authority, O=Apple Inc., C=US`. DER 937 bytes, SHA-256 `e4935183cd0bf5160334ae4bc32889d9cba432e105188b2766e9183a388d0ce1`; thisUpdate `20260910001835Z`, nextUpdate `20260910121834Z`.

## 9. Tests y regresión

Resultados finales completos: **241 ejecuciones, 232 PASS, 6 FAIL, 3 SKIP, 0 cancelled**. No son 241 invariantes independientes: incluyen reproducciones del mismo defecto y una emulación diagnóstica. Los FAIL se conservan como evidencia de incumplimiento; no se convierten en pruebas verdes de aceptación insegura.

| Grupo | Total | PASS | FAIL | SKIP |
|---|---:|---:|---:|---:|
| baseline-reproduction | 3 | 1 | 2 | 0 |
| cache-reproduction | 1 | 0 | 1 | 0 |
| diagnostic | 22 | 21 | 1 | 0 |
| guard-feasibility | 5 | 5 | 0 | 0 |
| failure-caller | 6 | 6 | 0 | 0 |
| regression-complete | 153 | 148 | 2 | 3 |
| backend-regression | 51 | 51 | 0 | 0 |

Regresión Fase44: exactamente 153/148/2/3. Dentro: crypto 51 PASS; transporte/lab 88 PASS + 1 SKIP; OCSP 9 PASS + 2 FAIL + 2 SKIP. Transaction, RenewalInfo y Notification TEST positivos; bundle/environment mismatch, firma/cadena alterada, HMAC request/response, body hash, nonce/request_id/timestamp, replay, nueva request con misma JWS, timeout, Node down, respuesta malformada y verified=false preservan resultados. AppTransaction positivo, REVOKED y UNKNOWN son los tres SKIP. Notification con nested positivo no se añade al conteo: sigue sin fixture suficiente, no ejecutado.

Además, backend local: 51 PASS, incluido cierre 503 de las tres composiciones sin dependencias. No se repitió PostgreSQL ni las Fases41–43 completas.

Primer intento de regresión bajo sandbox: `regression.tap`, 154 reportados, 51 PASS, 89 FAIL, 11 cancelled, 3 SKIP por `listen EPERM 127.0.0.1` y fallo de hooks. Se conserva como intento de infraestructura, fuera del total de ejecuciones completas. Repetición con permiso de bind exclusivamente loopback: `regression-complete.tap`, resultado anterior 153/148/2/3. No se oculta el primer intento ni se cuenta como regresión de producto.

## 10. Rendimiento y concurrencia

No existe solución seleccionada que añada guard utilizable: comparación baseline vs solución NO APLICA; no se presentan timings del diagnóstico como overhead de una solución. No se hizo nueva carga OCSP pública ni benchmark productivo. Duración global de la regresión ~362 ms es duración de tests locales, no SLA ni benchmark del servicio.

Transporte: 20/20 peticiones concurrentes autenticadas, request_id distintos, sin falso replay observado. Adicionalmente 20/20 cadenas públicas frescas en paralelo con verificadores/cachés separados, 40 respuestas DER locales, todas devolvieron la clave pública leaf esperada. Alcance acotado: no demuestra ausencia general de races, mezcla entre certificados arbitrarios ni seguridad de frescura bajo caché compartida; esta última ya falla secuencialmente y continúa bloqueante.

## 11. Seguridad, adaptador y producción

No cambios a apple-verifier.mjs ni al servicio/copias heredadas. No fallbacks, secretos persistidos, evidencia Apple fabricada, cambios de trust roots, TLS bypass, patch-package, fork ni modificaciones de node_modules. Hooks/subclase solo en tests temporales señalados DIAGNOSTIC ONLY. Las claves HMAC de tests son efímeras, no se imprimieron ni se hashearon. El runtime online de laboratorio sigue rechazando configuración con OCSP_FRESHNESS_UNVERIFIED.

No se tocó producción, Supabase, DB, Stripe, Android, precios, App Store Connect, Apple Developer, Sandbox, TestFlight, pagos, dispositivos, Notifications reales, App Attest o cloud. No se instaló software global, usó sudo, cambió firewall, leyó keychain ni abrió puerto público. Servidores de test ligados a 127.0.0.1 y cerrados por sus teardown.

Inspección local: las tres entradas Apple llaman a handler sin backend; `http.mjs` conserva POST → 503 APPLE_BACKEND_NOT_CONFIGURED, otros métodos → 405. El test de backend valida 503. No se invocaron endpoints desplegados.

Única adición al repo: este documento. Estado final esperado/verificado: HEAD sin cambiar, cuatro documentos41–44 más phase45 untracked; nada staged, ningún commit, push ni checkpoint.

## 12. Bloqueos, pendientes y siguiente experimento

Bloqueos: parser OCSP de 3.1.0; caché de 15 minutos no limitada por nextUpdate, incluso al emular parser corregido; ausencia de API soportada para recibo autenticado que permita guard mínimo. No hay defecto propio demostrado en el adaptador Abilene que autorice modificarlo.

Pendientes no causantes de este dictamen: positivos AppTransaction y Notification nested, fixtures legítimos REVOKED/UNKNOWN, integración real futura. Siguen siendo requisitos de fases posteriores según su alcance; no se califican como pruebas realizadas.

Siguiente experimento mínimo: evaluar una corrección oficial que incluya parser Y control de expiración de caché, o una API oficial que entregue recibos OCSP autenticados y permita acotar/evitar caché. La PR451 por sí sola es insuficiente según este diagnóstico. En cuanto exista candidata concreta, aislarla y exigir: expired rejected PASS, future rejected PASS, GOOD fresco PASS, cache posterior a nextUpdate rechazado y regresión completa sin FAIL críticos. Mantener Node22.23.2 salvo requisito oficial documentado. No habilitar online ni preparar checkpoint conjunto antes de esa evidencia. No se abrió issue ni se envió mensaje a Apple.

## 13. Reproducción y artefactos

Ejecutar desde el laboratorio con Node22.23.2:

- `node --test reproduce.test.mjs > baseline-reproduction.tap` (salida 1 esperada: 2 invariantes FAIL).
- `node --test cache-reproduction.test.mjs > cache-reproduction.tap` (salida 1 esperada).
- `node --test diagnostic.test.mjs > diagnostic.tap` (salida 1 esperada por caché).
- `node --test guard-feasibility.test.mjs > guard-feasibility.tap`.
- `node --test failure-caller.test.mjs > failure-caller.tap` (requiere bind local).
- `node --test tests/*.test.mjs > regression-complete.tap` (requiere bind local; salida 1 por defectos conservados).
- Desde repo: `node --test tests/apple-backend/backend.test.mjs > /private/tmp/abilene-phase45-ocsp-qviwkgak/backend-regression.tap`.
- `node collect-evidence.mjs` genera evidencia de parser y certificados.

Fuentes congeladas: registry.json, releases-fresh.json, commits-fresh.json, issues-fresh.json, issue447.json, pr451.json, pr451-files.json, official-main-verification.ts, official-changelog.md. Resultados: TAP anteriores, cache-evidence.json, diagnostic-cache-evidence.json, root-cause-evidence.json, integrity-audit.json, test-summary.json. Los timestamps de captura se distinguen de relojes simulados en tests.

### SHA-256

Los paths siguientes son relativos al laboratorio arriba identificado. No incluyen secretos. El hash de este documento se entrega fuera de su contenido en el reporte final para evitar autorreferencia.

| Archivo | SHA-256 |
|---|---|
| auth.mjs | 055a41cfe32ee7007115f7e1acc0ef1614d886e6d54bcfdf04efa74f749b819b |
| backend-regression.tap | dc52b55553c51f1c5f4ca5c2962248842ba4aba58b4096a4f37d2488e91665eb |
| baseline-reproduction.tap | e90d86ddfa008b4aac740f0e18b14b2b8428abe919a02b6217e92a6d2bd614d0 |
| benchmark.mjs | 24cc4fbef5dfc68ab7b5367fbbac5c42f5b2c8a5899f3de41d64833cb9c5c45c |
| cache-evidence.json | fd4956e75930daf97d1c52275733f4d28bc6230e45f07ca54118c7e76b4abbaa |
| cache-reproduction.tap | 180d1f626aacbebd589166fc941faa8c2c23384d523ad5d3bf35e1e1eb9f1e88 |
| cache-reproduction.test.mjs | 5ffe8f9b48e5cef9767392c6fef5aea4902606dd9d1b8086733113a8d2f7a68d |
| caller.mjs | 220d609bf8d05c279e6e60bc7ba21fb63ee55f75d761fa9814bcd07e3c75a4c0 |
| collect-evidence.mjs | ea1b7d22a09e63769c85c6390ae2247ad346d93c559485128e2bc1f20a3059b5 |
| commits-fresh.json | 89d8cc85d45a2eb9718b5e2f2beb2b39c7956dd01bae84df88bd98ad02b1b592 |
| diagnostic-cache-evidence.json | 1b308035fd2d4d5918f9d1b92e72691392576e366e039a5e2493b49f42eddbd4 |
| diagnostic-pr451.mjs | 2cff592c701b1c490137d8009e616a2a6274f0259eeb5e62fa16836de20c92ea |
| diagnostic.tap | 90b498e40b359e3af4414cc9c0877d9ed25eeacd5b527d7ad4c662ce890d7d68 |
| diagnostic.test.mjs | 2662f3d65096118624b511e3acf3b8d97028296de183e59b659e4fc34cf30eed |
| failure-caller.tap | 0f094c497fef45a793b126de040899efbbc95610235c7e7d02dbf55f78730c0c |
| failure-caller.test.mjs | ff5342ecc45292a9ab9daacff6385196772ed2db49314da48c53c392aee2e2e4 |
| guard-feasibility.mjs | 7f92c2ede2b58948db24454f211ee71417ad6262b7b02792d3b05b33f5fbc207 |
| guard-feasibility.tap | 43eb58808a62ac5b7aaf565b913955e538499c2fd18c7c338b7e5f740d22d6cc |
| guard-feasibility.test.mjs | ea43f7ac1bf2f96c9ae5ce61bafe344544e6d50c41d657df6b5c7f9faf39ba93 |
| integrity-audit.json | 2dfccbd590a3b2d7a7dbc0961b06ef11b289322631a7ae855dd0fa7225b67dd7 |
| isolation.mjs | 734e2f28a49238c685c9a319ec53bc8dad22c2a1982e09c8d7c240f66aac979f |
| issue447.json | 5f288a61c9138530a9b579f80ac409cd5cfaefd323ecc16e5b4de0777253325d |
| ocsp-fixtures.json | 5bee4eafb3270b9a1b1954c5881869bcbd006b567ecb63bc1a84b55a7b5ca22c |
| ocsp-public-3dd14ec10e2be9a6430e58484fff3118a181f3fa5f64eac2d9371baf9f0911d2.der | 3dd14ec10e2be9a6430e58484fff3118a181f3fa5f64eac2d9371baf9f0911d2 |
| ocsp-public-e4935183cd0bf5160334ae4bc32889d9cba432e105188b2766e9183a388d0ce1.der | e4935183cd0bf5160334ae4bc32889d9cba432e105188b2766e9183a388d0ce1 |
| ocsp-public.mjs | b9b0d300f4b1848c63bdb5afd1ab4730674e92ab3efd87f55dcc8452a6843528 |
| package-lock.json | ad66e28e75f9b72126647166fa8b38ef1e75f7b8d26817a60c7bc6cdb2cec720 |
| package.json | e88206f9f64fcdd3d5de0e7e59b74d3f2ad3d1bc1b3cb9d337ca60e40f051568 |
| pr451-files.json | bf642ae47f06366d0cf94f3348cf85c731b484141f18fb067ac9a2cd744d0e66 |
| pr451.json | ee296581a8493342e8b4abd3c684453c67fb96564920af879b5493c413152667 |
| registry.json | 2b2335dcaa83a8a26ba028a09a7e294bf338e58469b059bcdaee6cc1a3eb7776 |
| regression-complete.tap | 60284b196f82d165ababc225d73aa5f446e3ec689f5d465b98af4aa3bdf51e1a |
| regression.tap | 6b24ea4ba7c60a91ac0be5bcdec5964ec6e3ab55776924fb8f40e84ae3d98a1a |
| releases-fresh.json | 045c4d9cceecd5a60fa5d40e57ebcb45f015f28282145b9f3d34a4fa084c183e |
| reproduce.test.mjs | a33ed6460700ee1f49e9dbb09ceabac04a7a5200a4f709106d5efe8372d276e1 |
| root-cause-evidence.json | 1b268c32d096f0142608037d45feb35b44b5fd43d4fdb4eb3f6cc925f339cb71 |
| schema.mjs | aab22715b41bcc3cb35ace98cbf98d42ef83cf9a993b2e689e7676f3b68f95f2 |
| service.mjs | 055b3159ad1829dd4ecda79f8707abf0c5a75938b80431d2f785cb9feeffb14d |
| standalone.mjs | 2f93f35707ff3ca90015de0d94d56e5ca8bcdd1a7e45556a4b36448d341c23a0 |
| test-summary.json | 4b232a1a0eb4329070ebd32d5c84ad3c1c040bae4a3212a51d674ffb13b9d537 |
| verifier.mjs | e2c39bdd3846d2eb321e45f5c811c51304ae6fcefec2af1915976c56f6ddc93b |

## 14. Inventario completo de tests ejecutados


### baseline-reproduction

| Test | Resultado |
|---|---|
| 3.1.0 fresh must accept | PASS |
| 3.1.0 expired must reject | FAIL |
| 3.1.0 future must reject | FAIL |

### cache-reproduction

| Test | Resultado |
|---|---|
| 3.1.0 cached key must not outlive authentic OCSP nextUpdate | FAIL |

### diagnostic

| Test | Resultado |
|---|---|
| DIAGNOSTIC parser clearly future | PASS |
| DIAGNOSTIC parser thisUpdate minus 61s | PASS |
| DIAGNOSTIC parser thisUpdate minus 60s | PASS |
| DIAGNOSTIC parser thisUpdate minus 1s | PASS |
| DIAGNOSTIC parser thisUpdate exact | PASS |
| DIAGNOSTIC parser fresh | PASS |
| DIAGNOSTIC parser nextUpdate minus 1s | PASS |
| DIAGNOSTIC parser nextUpdate exact | PASS |
| DIAGNOSTIC parser nextUpdate plus 1s | PASS |
| DIAGNOSTIC parser nextUpdate plus 60s | PASS |
| DIAGNOSTIC parser nextUpdate plus 61s | PASS |
| DIAGNOSTIC parser clearly expired | PASS |
| DIAGNOSTIC parser rejects missing nextUpdate | PASS |
| DIAGNOSTIC parser rejects UTCTime 1950 boundary | PASS |
| DIAGNOSTIC parser rejects UTCTime 2049 boundary | PASS |
| DIAGNOSTIC parser rejects offset not allowed in OCSP DER profile | PASS |
| DIAGNOSTIC parser rejects missing seconds | PASS |
| DIAGNOSTIC parser rejects invalid calendar | PASS |
| DIAGNOSTIC parser rejects fraction excluded by profile | PASS |
| DIAGNOSTIC parser leap date UTC | PASS |
| DIAGNOSTIC fixed parser cache MUST reject after nextUpdate | FAIL |
| DIAGNOSTIC no-cache fresh instance rejects expired response | PASS |

### guard-feasibility

| Test | Resultado |
|---|---|
| official successful OCSP check exposes no authenticated receipt | PASS |
| guard feasibility: official success without receipt remains untrusted | PASS |
| guard feasibility: official rejection cannot become success | PASS |
| guard feasibility: unbound DER and claimed GOOD cannot authorize | PASS |
| 20 concurrent fresh real chains; separate verifier caches; no external traffic | PASS |

### failure-caller

| Test | Resultado |
|---|---|
| caller trusted:false for actual official OCSP timeout | PASS |
| caller trusted:false for actual official OCSP refused | PASS |
| caller trusted:false for actual official OCSP dns | PASS |
| caller trusted:false for actual official OCSP http | PASS |
| caller trusted:false for actual official OCSP malformed | PASS |
| caller trusted:false for actual official OCSP wrong responder | PASS |

### regression-complete

| Test | Resultado |
|---|---|
| crypto import | PASS |
| crypto A node:crypto | PASS |
| crypto B X509Certificate | PASS |
| crypto C Buffer | PASS |
| crypto D process | PASS |
| crypto E fs | PASS |
| crypto F path | PASS |
| crypto G jsonwebtoken | PASS |
| crypto H jsrsasign | PASS |
| crypto I node-fetch Headers Response | PASS |
| crypto J base64url | PASS |
| crypto M SHA-256 | PASS |
| crypto transactionInfo valid testCA / ECDSA / async | PASS |
| crypto transactionInfo payload tampered | PASS |
| crypto transactionInfo signature tampered | PASS |
| crypto transactionInfo wrong roots | PASS |
| crypto transactionInfo invalid chain | PASS |
| crypto transactionInfo alg none | PASS |
| crypto renewalInfo valid testCA / ECDSA / async | PASS |
| crypto renewalInfo payload tampered | PASS |
| crypto renewalInfo signature tampered | PASS |
| crypto renewalInfo wrong roots | PASS |
| crypto renewalInfo invalid chain | PASS |
| crypto renewalInfo alg none | PASS |
| crypto testNotification valid testCA / ECDSA / async | PASS |
| crypto testNotification payload tampered | PASS |
| crypto testNotification signature tampered | PASS |
| crypto testNotification wrong roots | PASS |
| crypto testNotification invalid chain | PASS |
| crypto testNotification alg none | PASS |
| crypto verifyAndDecodeTransaction empty | PASS |
| crypto verifyAndDecodeTransaction null | PASS |
| crypto verifyAndDecodeTransaction malformed | PASS |
| crypto verifyAndDecodeRenewalInfo empty | PASS |
| crypto verifyAndDecodeRenewalInfo null | PASS |
| crypto verifyAndDecodeRenewalInfo malformed | PASS |
| crypto verifyAndDecodeNotification empty | PASS |
| crypto verifyAndDecodeNotification null | PASS |
| crypto verifyAndDecodeNotification malformed | PASS |
| crypto verifyAndDecodeAppTransaction empty | PASS |
| crypto verifyAndDecodeAppTransaction null | PASS |
| crypto verifyAndDecodeAppTransaction malformed | PASS |
| crypto bundle mismatch | PASS |
| crypto environment mismatch | PASS |
| crypto missing roots | PASS |
| crypto malformed root | PASS |
| crypto missing x5c | PASS |
| crypto AppTransaction unsigned model | PASS |
| crypto K ASN1 real Apple chain | PASS |
| crypto P certificate dates | PASS |
| crypto Q wrong OID | PASS |
| transport-auth valid request and response | PASS |
| transport-auth tamper MAC false | PASS |
| transport-auth tamper body byte | PASS |
| transport-auth tamper body hash | PASS |
| transport-auth tamper path | PASS |
| transport-auth tamper method | PASS |
| transport-auth tamper request_id | PASS |
| transport-auth tamper nonce | PASS |
| transport-auth tamper timestamp | PASS |
| transport-auth tamper evidence type | PASS |
| transport-auth tamper caller | PASS |
| transport-auth tamper key id | PASS |
| transport-auth reject old | PASS |
| transport-auth reject future | PASS |
| transport-auth reject malformed timestamp | PASS |
| transport-auth reject protocol | PASS |
| transport-auth reject content type | PASS |
| transport-auth reject invalid evidence type | PASS |
| transport-auth JSON malformed | PASS |
| transport-auth JSON duplicate | PASS |
| transport-auth JSON unknown field | PASS |
| transport-auth oversized | PASS |
| transport-auth signed wrong method | PASS |
| transport-auth signed unknown path | PASS |
| transport-auth path traversal | PASS |
| replay same request rejected | PASS |
| replay reused x-request-id | PASS |
| replay reused x-nonce | PASS |
| replay legitimate same evidence new transport allowed | PASS |
| transaction positive public testCA | PASS |
| transaction rejects payload | PASS |
| transaction rejects signature | PASS |
| transaction rejects truncated | PASS |
| transaction rejects malformed | PASS |
| transaction rejects empty | PASS |
| transaction rejects alg none | PASS |
| transaction rejects wrong chain | PASS |
| renewal_info positive public testCA | PASS |
| renewal_info rejects payload | PASS |
| renewal_info rejects signature | PASS |
| renewal_info rejects truncated | PASS |
| renewal_info rejects malformed | PASS |
| renewal_info rejects empty | PASS |
| renewal_info rejects alg none | PASS |
| renewal_info rejects wrong chain | PASS |
| notification positive public testCA | PASS |
| notification rejects payload | PASS |
| notification rejects signature | PASS |
| notification rejects truncated | PASS |
| notification rejects malformed | PASS |
| notification rejects empty | PASS |
| notification rejects alg none | PASS |
| notification rejects wrong chain | PASS |
| app-transaction negative  | PASS |
| app-transaction negative null | PASS |
| app-transaction negative a.b.c | PASS |
| app-transaction official signed positive unavailable # SKIP No legitimate signed positive AppTransaction vector in audited public fixtures | SKIP |
| fail-closed wrong roots | PASS |
| fail-closed bundle mismatch | PASS |
| fail-closed environment mismatch | PASS |
| fail-closed invalid certificate config | PASS |
| fail-closed missing roots config | PASS |
| fail-closed no implicit lab trust | PASS |
| fail-closed internal | PASS |
| fail-closed verification timeout | PASS |
| fail-closed OCSP retryable error | PASS |
| fail-closed transport timeout | PASS |
| fail-closed transport socket error | PASS |
| fail-closed transport invalid JSON | PASS |
| fail-closed transport HTTP 500 | PASS |
| fail-closed transport unexpected HTTP 418 | PASS |
| fail-closed transport truncated response | PASS |
| fail-closed transport unauthed verified true | PASS |
| fail-closed Node down connection refused | PASS |
| response-auth body tamper | PASS |
| response-auth MAC | PASS |
| response-auth status | PASS |
| response-auth request id | PASS |
| response-auth nonce | PASS |
| response-auth signed invalid verified false | PASS |
| response-auth signed invalid request id mismatch | PASS |
| response-auth signed invalid kind mismatch | PASS |
| response-auth signed invalid unknown normalized field | PASS |
| response-auth signed invalid invalid field type | PASS |
| response-auth signed invalid JSON | PASS |
| concurrency 20 isolated authenticated requests | PASS |
| fail-closed online mode blocked after proven OCSP freshness defect | PASS |
| response-auth incomplete normalization rejected | PASS |
| replay TTL prunes expired entries and stale request stays rejected | PASS |
| ocsp disabled performs zero fetch calls | PASS |
| ocsp GOOD captured legitimate signed public responses and cache | PASS |
| ocsp controlled timeout maps retryable | PASS |
| ocsp controlled refused maps retryable | PASS |
| ocsp controlled dns maps retryable | PASS |
| ocsp controlled http maps retryable | PASS |
| ocsp malformed signed-response bytes reject | PASS |
| ocsp wrong responder/certificate response rejects | PASS |
| ocsp actual retryable library error reaches service and caller closed | PASS |
| ocsp REVOKED signed legitimate fixture # SKIP No legitimate signed revoked OCSP response in public audited material; no state fabricated | SKIP |
| ocsp UNKNOWN signed legitimate fixture # SKIP No legitimate signed unknown OCSP response in public audited material; no state fabricated | SKIP |
| ocsp freshness rejects expired authentic response (required safety invariant) | FAIL |
| ocsp freshness rejects future authentic response (required safety invariant) | FAIL |

### backend-regression

| Test | Resultado |
|---|---|
| 01 buyer idempotent under concurrent verified bootstrap | PASS |
| 02 appAccountToken stable; capability plaintext never persisted | PASS |
| 03 idempotency key binds listing and plan | PASS |
| 04 double tap produces one intent and slot | PASS |
| 05 two buyers isolated even with same idempotency key | PASS |
| 06 slots one through ten across business/job/rental | PASS |
| 07 eleventh intent rejected without deleting history | PASS |
| 08 missing listing rejected | PASS |
| 09 unauthorized listing rejected despite legacy ownership | PASS |
| 10 caller cannot choose product_id | PASS |
| 11 caller cannot choose buyer_id | PASS |
| 12 caller cannot choose environment | PASS |
| 13 replay cannot move transaction to another intent | PASS |
| 14 duplicate notification processed once | PASS |
| 15 old renewal-status event cannot overwrite newer facts | PASS |
| 16 REFUND maps verified state without adding days | PASS |
| 17 REVOKE maps verified state without adding days | PASS |
| 18 DID_FAIL_TO_RENEW maps verified state without adding days | PASS |
| 19 DID_FAIL_TO_RENEW maps verified state without adding days | PASS |
| 20 EXPIRED maps verified state without adding days | PASS |
| 21 known chain cannot be assigned another listing | PASS |
| 22 same transaction replay one delivery and entitlement | PASS |
| 23 Sandbox ledger never grants Production projection | PASS |
| 24 Xcode and Production evidence fail closed | PASS |
| 25 Stripe conflict does not start Apple flow | PASS |
| 26 inferior comp does not downgrade paid Premium | PASS |
| 27 Premium beats Featured without summing validity; paid conflict visible | PASS |
| 28 hidden/deleted listing never reactivated by notification | PASS |
| 29 delivery confirmation tampering rejected | PASS |
| 30 expired delivery confirmation rejected | PASS |
| 31 wrong transaction confirmation rejected | PASS |
| 32 wrong listing confirmation rejected; correct binding accepted | PASS |
| 33 ten concurrent reservations cannot double allocate slots | PASS |
| 34 notification before client verify waits for assignment | PASS |
| 35 crash before and lost response after commit are retry idempotent | PASS |
| 36 signer failure occurs after durable delivery and retries do not duplicate | PASS |
| 37 expired purchasing reserve is reconciliation, never free | PASS |
| 38 HTTP deployed composition rejects every operation without dependencies | PASS |
| 39 fixture handles/verified booleans are not accepted by default verifier | PASS |
| 40 expired/revoked capability and installation rejected | PASS |
| 41 DID_RENEW records exact signed period and transaction once | PASS |
| 42 GRACE_PERIOD_EXPIRED removes active grace without freeing slot | PASS |
| 43 forged verified transaction fields rejected by domain | PASS |
| 44 migrations RLS and RPC grants are explicitly closed (static, not SQL execution) | PASS |
| 45 Postgres port uses one atomic RPC and fails closed on database error | PASS |
| 46 production confirmation is never fabricated by fixture signer | PASS |
| 47 official adapter delegates both proofs, never trusts a decoded client boolean | PASS |
| 48 official adapter rejects mismatched AppTransaction identity | PASS |
| 49 expired listing grant and disabled catalog reject preparation | PASS |
| 50 late refund remains unresolved rather than silently accepted as stale | PASS |
| 51 HTTP rejects caller-supplied verified flag and never echoes opaque input | PASS |
