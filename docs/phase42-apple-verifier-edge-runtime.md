# Fase 42 — SignedDataVerifier en Deno / candidato Supabase Edge

Resultado: **B — COMPATIBLE CON LIMITACIONES**. La librería oficial 3.1.0 pasa 51/51 casos en Deno 2.9.6, con resultados y códigos idénticos a Node 22.23.2. Deno 2.5.0 falla 9 de esos casos. No se certifica Supabase Edge real ni OCSP, y no se habilita ningún endpoint.

## Estado inicial y límites

Rama main; HEAD y origin/main locales en `1607ff2dad6a23cfcb56b4b769fbde3e365dd437` (`Validate Apple IAP backend on local PostgreSQL`). Estado inicial: únicamente `docs/phase41-apple-signed-data-verifier.md` untracked. `git diff --check` limpio. Sin fetch, stage, commit ni push. Migración SHA-256 `9e2e48561f0551b32361dae72e9c04da83e2a1f739b7755516a3e77108b8065d`.

No se instaló Deno global ni se modificaron PATH, perfiles, dependencias del proyecto o producción. No se ejecutaron PostgreSQL, Swift, Xcode, StoreKit, Android, build web ni cap sync. El contenedor PostgreSQL de fases anteriores no se tocó.

## Herramientas y aislamiento

- Node v22.23.2, npm/npx 10.9.8 disponibles.
- Deno y Supabase CLI ausentes en PATH; sin binario Supabase en node_modules ni caché `_npx` del usuario. La consulta `npx --offline --no` con caché temporal devolvió ENOTCACHED; no instaló ni ejecutó Supabase.
- Docker CLI 29.7.2, build a7dcaa6; daemon local Docker Desktop. No imagen Deno inicial: solo postgres:17-bookworm.
- Workspace: `/private/tmp/abilene-phase42-edge/`. Solo fixtures/certificados públicos, fuentes de tests públicas, runners, cachés npm y resultados sanitizados. No claves privadas, postgres.env, credenciales, compras o datos productivos.
- Descargas de imágenes con configuración Docker temporal vacía y socket local explícito; esto evita usar credenciales o cambiar PATH. El primer intento con contexto desktop-linux y esa configuración vacía falló por contexto ausente; se corrigió la selección del socket del host, sin montar ese socket en contenedores.
- Contenedores efímeros `--rm`; único montaje: workspace temporal → /work; sin repo, socket, secretos ni publicación de puertos. DENO_DIR=/work/deno-cache. Caché npm preparada en una ejecución separada con red; verificación con `--network none --cached-only`. Sin parches ni scripts npm de instalación.
- El entrypoint usa exclusivamente loopback interno 127.0.0.1 y puerto efímero, con red Docker desactivada. HTTPS separado permite en Deno únicamente docs.deno.com. Las respuestas públicas no se imprimieron.

## Imágenes y versiones observadas

| Imagen oficial | Digest de repositorio | Deno | V8 | TypeScript | Arquitectura |
|---|---|---|---|---|---|
| denoland/deno:2.5.0 | sha256:3373fa94f2a9295041f35ec617d13ef5a84eec944235729ec10b5c167a891688 | 2.5.0 | 14.0.365.4-rusty | 5.9.2 | arm64 |
| denoland/deno:latest, ejecutada después por digest | sha256:2014dc167ece617ef7e7ba40631ac2234c59e75ce693e7cc2dc2602b3c87859d | 2.9.6 | 15.0.245.2-rusty | 6.0.3 | arm64 |

2.5.0 fue el primer control fijo, no una afirmación de versión Supabase. Sus fallos motivaron contrastar la imagen estable actual. El digest y la versión observados, no la etiqueta mutable latest, delimitan el resultado favorable. No se determinó la primera versión de Deno que corrige los fallos.

## Fuentes oficiales y alcance documental

- [Deno: Docker](https://docs.deno.com/runtime/reference/docker/): imágenes oficiales y separación de caché/ejecución; se fijaron digests para reproducibilidad.
- [Deno: Node y npm](https://docs.deno.com/runtime/fundamentals/node/): importación npm: y compatibilidad Node/CommonJS. Esto orienta el método, pero no sustituye ejecutar cada API.
- [Deno: node:crypto](https://docs.deno.com/api/node/crypto/): superficie X509Certificate/crypto; la documentación actual no demuestra implementación en versiones anteriores.
- [Supabase: dependencias](https://supabase.com/docs/guides/functions/dependencies): paquetes npm en funciones. Se usó `npm:@apple/app-store-server-library@3.1.0`.
- [Supabase: arquitectura](https://supabase.com/docs/guides/functions/architecture): empaquetado ESZip, gateway y aislamiento; nuestro Deno.serve no reproduce esa infraestructura.
- [Supabase: límites](https://supabase.com/docs/guides/functions/limits): restricciones de CPU, memoria, duración, archivos y bibliotecas multihilo. No se midieron ni certificaron esos límites aquí.
- [Apple: repositorio oficial](https://github.com/apple/app-store-server-library-node), [SignedDataVerifier](https://apple.github.io/app-store-server-library-node/classes/SignedDataVerifier.html), [fuente fijada](https://github.com/apple/app-store-server-library-node/blob/bb0c0f874494321ea2d005329c3dc2188e893d41/jws_verification.ts) y [Apple PKI](https://www.apple.com/certificateauthority/). Fixtures públicos reutilizados del mismo commit auditado en Fase 41.

La inspección del paquete instalado confirmó crypto/X509, jsonwebtoken, jsrsasign, node-fetch y comprobaciones OCSP. La compatibilidad concreta de esas dependencias procede de las pruebas siguientes, no de una promesa general de Deno/Supabase.

## Librería y dependencias

Exactamente `@apple/app-store-server-library@3.1.0`, sin fork, polyfill ni modificación de node_modules. Node carga la instalación temporal de Fase 41; Deno usa npm: con caché propia. jsonwebtoken 9.0.3; jsrsasign 11.1.5; node-fetch 2.7.0; base64url 3.0.1. Las 48 versiones de paquetes de Node están presentes en Deno; Deno agrega solo @types/node 24.2.0 y undici-types 7.10.0. No hay divergencia de dependencias ejecutables observada.

No se generó deno.lock automáticamente en este workspace sin configuración; la evidencia conservada es el inventario de versiones, caché, hashes y digest. Un futuro servicio necesita un lock explícito revisado. No se presenta el control temporal como configuración productiva.

Integridad npm de Apple: `sha512-d26SICRz8BwCV2qPR0BSXBMxmw0NEvJLwsdREcBmCrus8NmyHw2XgOOP0fiFjcctPn/JXtmSDuGVnaHe+dqO+A==` (registro de Fase 41).

## Matriz real de APIs

PASS se limita a la operación indicada. NOT EXECUTED significa que no se ejerció el camino completo. Un rechazo prematuro de Deno 2.5.0 no acredita la validación de OID, bundle o firma.

| ID / operación | Node 22.23.2 | Deno 2.5.0 | Deno 2.9.6 |
|---|---|---|---|
| A node:crypto import | PASS | PASS | PASS |
| B X509Certificate parsing/publicKey | PASS | PASS | PASS |
| B X509Certificate.verify | PASS | FAIL ERR_NOT_IMPLEMENTED | PASS |
| C Buffer codificación | PASS | PASS | PASS |
| D process.version | PASS | PASS | PASS |
| E fs lectura DER | PASS | PASS | PASS |
| F path.join | PASS | PASS | PASS |
| G jsonwebtoken verificación real | PASS | FAIL Error | PASS |
| H jsrsasign lectura X509 ASN.1 | PASS | PASS | PASS |
| I node-fetch Headers/Response | PASS | PASS | PASS |
| I node-fetch HTTPS público | PASS | NOT EXECUTED con política corregida | PASS |
| J base64url encode/decode | PASS | PASS | PASS |
| K cadena Apple pública hasta G3 | PASS | FAIL ERR_NOT_IMPLEMENTED | PASS |
| L ECDSA P1363, firma fixture público | PASS true | FAIL false | PASS true |
| M SHA-256 vector abc | PASS | PASS | PASS |
| N Promise/async rechazo | PASS | PASS | PASS |
| O clase VerificationException, inválidos | PASS | PASS | PASS |
| P checkDates directo válido/expirado | PASS | PASS | PASS |
| P fechas dentro de cadena completa | PASS | FAIL previo en verify | PASS |
| Q rechazo OID dentro de cadena | PASS | FAIL previo en verify | PASS |
| R infoAccess usado por OCSP | PASS | FAIL ERR_NOT_IMPLEMENTED | PASS |
| R consulta/validación OCSP completa | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED |
| S HTTPS nativo público | PASS | NOT EXECUTED con política corregida | PASS |

El primer diagnóstico suplementario registraba PASS si una API retornaba sin lanzar y mostraba `value:false` para ECDSA en 2.5.0. Se corrigió el runner para considerar false un FAIL; esta tabla conserva la semántica correcta del valor observado. No se oculta ese defecto inicial del arnés.

## Fixtures y comparación

Runner común: `run.mjs`, con único cambio de resolución de imports según runtime; no importa backend productivo. Todos los SignedDataVerifier se construyen con enableOnlineChecks=false y Sandbox, excepto el caso explícito de rechazo de Environment.PRODUCTION. Nunca se usa LocalTesting/Xcode para un positivo criptográfico.

| Grupo | Node | Deno 2.5.0 | Deno 2.9.6 |
|---|---|---|---|
| Transaction válido, testCA oficial | acepta | rechaza VERIFICATION_FAILURE | acepta |
| RenewalInfo válido, testCA oficial | acepta | rechaza VERIFICATION_FAILURE | acepta |
| Notification TEST válida, testCA oficial | acepta | rechaza VERIFICATION_FAILURE | acepta |
| Payload/firma alterados, alg none, cadena incorrecta | rechaza | rechaza antes de demostrar firma | rechaza |
| Fixtures testCA contra raíces Apple reales | rechaza | rechaza | rechaza |
| Empty/null/malformed, cuatro métodos | rechaza | rechaza | rechaza |
| Bundle incorrecto | INVALID_APP_IDENTIFIER | VERIFICATION_FAILURE prematuro | INVALID_APP_IDENTIFIER |
| Entorno incorrecto | INVALID_ENVIRONMENT | VERIFICATION_FAILURE prematuro | INVALID_ENVIRONMENT |
| Roots ausentes o malformadas; x5c ausente | rechaza | rechaza | rechaza |
| AppTransaction: modelo oficial sin firma | rechaza | rechaza | rechaza |
| Cadena Apple pública, fecha histórica | acepta | ERR_NOT_IMPLEMENTED | acepta |
| Cadena expirada / OID incorrecto | rechazos específicos | ERR_NOT_IMPLEMENTED previo | rechazos específicos |

Totales del runner principal: Node 51 PASS / 0 FAIL; Deno 2.5.0 42 PASS / 9 FAIL; Deno 2.9.6 51 PASS / 0 FAIL. Las 51 filas de resultados de Node y Deno 2.9.6 son idénticas, incluidos clase/código registrados. En el control antiguo, las assertions de bundle/entorno/fecha/OID fallan porque no se alcanza el rechazo esperado. Son fallos reales del experimento, no cuatro defectos independientes atribuidos sin prueba.

El diagnóstico directo identifica X509Certificate.verify e infoAccess no implementados en 2.5.0. Además, ECDSA directo retorna false para la firma pública válida y jsonwebtoken no la acepta. No se intentó corregir la biblioteca o el runtime.

Estos positivos son fixtures sintéticos oficiales firmados bajo testCA, no compras Apple. La cadena pública real llega a G3 pero no equivale a un JWS de compra. No existe aquí AppTransaction firmado positivo, par completo Abilene ni notificación Apple real con pruebas anidadas. Esas limitaciones de Fase 41 continúan.

## OCSP y HTTPS

Inspección: enableOnlineChecks=true usa fecha actual, comprueba OCSP de leaf e intermediate, y activa caché. false usa signedDate/receiptCreationDate y evita OCSP. La función checkOCSPStatus extrae infoAccess, construye solicitud ASN.1 con jsrsasign, realiza POST node-fetch con timeout 30000 ms y clasifica fallo de red como RETRYABLE_VERIFICATION_FAILURE. No se invocó ese método ni se activó online checks.

Prueba separada: HEAD público a https://docs.deno.com/, TLS normal sin desactivar validación, sin credenciales ni cuerpos registrados. Node y Deno 2.9.6: PASS con fetch nativo y node-fetch. La política inicial redirect:error provocó FAIL al recibir redirección; se cambió a manual, sin seguirla, aceptando HTTP 2xx/3xx como evidencia de transporte HTTPS. No se atribuye el fallo inicial a TLS. El control 2.5.0 no se repitió con la política corregida.

HTTPS PASS no demuestra OCSP, revocación, respuesta OCSP firmada, timeout real del verificador ni política de reintentos. Todo ello sigue NOT EXECUTED.

## Entrypoint temporal y fail closed

`/private/tmp/abilene-phase42-edge/edge.ts` importa el paquete real npm:, lee testCA pública, verifica una entrada controlada y responde sin payloads. Deno.serve real en loopback interno; fetch interno y cierre posterior del servidor. Deno 2.9.6: 5 PASS (fixture testCA aceptado, malformed rechazado, módulo ausente rechazado, error de red sintético y timeout sintético rechazados).

Los dos últimos casos inyectan una función que lanza: prueban el catch del arnés, no OCSP ni un timeout real. El módulo ausente es una prueba negativa de carga dinámica, no una caída observada del import oficial. No hay sistema de derechos ni escritura de ledger en ese arnés: verified:true significa únicamente firma testCA aceptada en este experimento. Nunca debe exponerse ese fixture verifier como backend de compras.

En Deno 2.5.0 el mismo patrón devolvió VERIFICATION_REJECTED tanto para fixture válido como para malformed; fail closed, pero inutilizable para aceptar evidencia válida. Certificado inválido, roots ausentes, bundle/entorno incorrectos y JWS malformed en 2.9.6 no devuelven objeto utilizable; no hay fallback decode-only/legacy.

Supabase CLI/local Edge no estaba disponible. No se instaló, no se ejecutó functions serve ni se vinculó proyecto. Deno.serve demuestra un patrón HTTP local, no gateway, bundling ESZip, distribución, almacenamiento de roots o límites exactos de Supabase Edge. No se certifica opción 1.

## Adaptador, tests y conservación

Auditado apple-verifier.mjs: espera verificador oficial inyectado, await de las pruebas requeridas y comprobaciones de bundle/entorno/correlación; sin imports Node propios ni fallback legacy. No se demostró defecto de portabilidad en su contrato. Sin modificaciones. No se importó el backend productivo en contenedores.

`node --test tests/apple-backend/backend.test.mjs`: 51 PASS, 0 FAIL. Únicos tests del proyecto ejecutados. Las tres composiciones HTTP reales siguen sin backend inyectado: POST devuelve 503 APPLE_BACKEND_NOT_CONFIGURED, otros métodos 405. No hay toggle para habilitarlas.

Comparación SHA-256 inicial/final: 373 archivos versionados y documento Fase 41 intactos (374/374). Manifiestos, migración, endpoints, adaptador y tests sin cambios. Logs contienen solo casos, resultados, clases/códigos y metadatos permitidos; no JWS, payloads completos, tokens ni secretos. Aviso deprecación punycode en Deno actual, sin efecto en los resultados; jsrsasign conserva la versión auditada en Fase 41.

## Decisión y siguiente paso

**Opción 2, candidata condicionada**: la ejecución oficial funciona en Deno 2.9.6 con raíces accesibles, npm resuelto y permisos apropiados; todavía no se autoriza colocarla en Supabase Edge. Opción 1 no certificada. No se impone opción 3 basándose en el fallo de 2.5.0, porque 2.9.6 elimina ese bloqueo en ejecución real. Servicio Node separado sigue siendo alternativa si el runtime exacto de Supabase no reproduce los resultados.

Clasificación final B. Siguiente fase: identificar y fijar una versión oficial de Supabase Edge Runtime local y repetir estos mismos 51 casos + entrypoint con esa versión, sin deploy ni credenciales; fijar dependencias con lock y validar empaquetado/lectura de roots. Si no reproduce positivos sin parches, evaluar opción 3. Diseñar aparte pruebas OCSP reproducibles y sus fallos antes de habilitar compras; mantener pendientes los JWS positivos Apple/AppTransaction señalados.

## Estado Git final y acciones excluidas

Único archivo creado en el repositorio por esta fase: `docs/phase42-apple-verifier-edge-runtime.md`. Se conserva untracked el documento Fase 41. Ningún archivo versionado modificado. `git diff --stat`, `git diff --name-only` y `git diff --check` vacíos. Sin stage, commit, push ni fetch.

CERO conexiones/escrituras a Supabase producción. Sin Sandbox Apple, deploy, login/link, App Store Connect, App Attest, TestFlight, service_role, SQL remoto, claves .p8, Stripe ni pagos. Las únicas conexiones nuevas fueron descargas públicas Docker/npm, consulta de documentación oficial y HEAD a docs.deno.com.

## Evidencia local y hashes

Resultados, runners, diagnóstico e inventario: `/private/tmp/abilene-phase42-edge/`. Artefactos temporales no versionados y no garantizados tras limpieza del sistema. No se copiarán al repositorio fixtures ni node_modules.

Certificados y fixtures reutilizados (SHA-256):

| Archivo público | SHA-256 |
|---|---|
| AppleIncRootCertificate.cer | b0b1730ecbc7ff4505142c49f1295e6eda6bcaed7e2c68c5be91b5a11001f024 |
| AppleRootCA-G2.cer | c2b9b042dd57830e7d117dac55ac8ae19407d38e41d88f3215bc3a890444a050 |
| AppleRootCA-G3.cer | 63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179 |
| appTransaction.json | 970a96a5b49873265e7bac3ee72c12a82bf2faf02750fdff08336ee52197aad0 |
| legacyTransaction | c89576769b0c418d867eb9bbb6e16316ded4b9177c2e5e857917fab3665d837b |
| missingX5CHeaderClaim | 8fb8c5b52328adc06c3938268d3d7cca5fd1c27b2f590ddbb364a588dc43f5b2 |
| official-real-apple-intermediate.der | bdd4ed6e74691f0c2bfd01be0296197af1379e0418e2d300efa9c3bef642ca30 |
| official-real-apple-leaf.der | 4c381556c16121e605d1fc2eef6d0de4e072ed65964fe72f575f19711e84c417 |
| renewalInfo | d9b9f1e70277de27e73b1d0dd42558b62e29631c0dc094ebb65067991e66c71d |
| testCA.der | 48aa70550eab2cd71d51dced44e88f9143b6bc0e1a6f430c19ba9a7cf36654e6 |
| testNotification | e1fc5e5795383a5d672a3f355b86407c95a0eb01eb35397dee7e6d76270ef579 |
| transactionInfo | 6f3027507d63abc7736c14642c7aa2ccc978510cba6f0d09244e657293ea7ce6 |
| wrongBundleId | 5c79fcc46ce9bcc6f5b701ab83a63a17f7e1eb7d77fbf45cfb11aec637b4ef19 |

Fuente pública de tests reutilizada official-jws-tests.ts: SHA-256 `ea6862ff1a95e1558a3b4927ef45dcbd10780fc2f22de6d967f55f71a73da932`.

Hashes de evidencia local al cierre:

| Archivo | SHA-256 |
|---|---|
| run.mjs | 627e8b72c9098b863a3e512a175bc1f02df40f18d84611055280bb2579c59468 |
| probe.mjs | b4e16d4783843d4788e2885e207b5462e4692fc4a6343432be98d1223c0b6f4e |
| edge.ts | 414ca774796479f3dbf25eb31c0ab6a86b1cccc5ecf17aeca881dc5286d370ba |
| https.mjs | c63bf1630fcc7b0888474ce31625aca067528253a0a108b7645295195142c565 |
| cache.ts | 479a249ccc58d7d7965f4de6fe82cc13888e915f4bf8ec9322cdd865f2c137d1 |
| node-results.json | a47e0dfd7fe5737d53335393606f503ecf245507cbc600f1b7862d7d3acb91c2 |
| deno-results.json | ec0cce643c6b5ddf65c38be0b26e3ec2bc23429d3cdf3f8f8678a764de77794d |
| deno250-deno-results.json | 5ee625fc09285c9bebb143549777d586b75e9612aec3ad9b291e38baccc356bf |
| deno-probe.json | 53348b47ce541f73cc48c7110cae94d279754714aca9876d4ed8e58351e8be44 |
| dependency-comparison.json | ef4c011b661194b69fdc42a18d560d30d0c3e7ed2a7746d840e1e433641e3ab1 |
| project-tests.tap | c89b8aa83c7d98c71ef4327776a5dc8f499abbc482982a3f6d4423877ecf00cc |

Comandos centrales reproducibles dentro del workspace temporal (la descarga/cache debe prepararse explícitamente antes; no usar esto como despliegue):

```sh
node /private/tmp/abilene-phase42-edge/run.mjs
/Applications/Docker.app/Contents/Resources/bin/docker --context desktop-linux run --rm --network none --mount type=bind,src=/private/tmp/abilene-phase42-edge,dst=/work -w /work -e DENO_DIR=/work/deno-cache denoland/deno@sha256:2014dc167ece617ef7e7ba40631ac2234c59e75ce693e7cc2dc2602b3c87859d run --cached-only --allow-read=/work --allow-write=/work --allow-env --no-prompt run.mjs
```

El runner registra FAIL por caso en JSON; su exit code no es un criterio suficiente de aceptación (el primer control 42/51 terminó normalmente). La evaluación se hizo sobre todas las filas, no sobre el éxito del comando shell.
