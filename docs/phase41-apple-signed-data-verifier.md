# Fase 41 — SignedDataVerifier oficial: B / PARCIAL

## Resultado y límites

Se ejecutó **@apple/app-store-server-library 3.1.0 real en Node v22.23.2**, exclusivamente en un workspace temporal. **60 comprobaciones PASS, 0 FAIL, 8 pendientes explícitos**. No se acepta esto como validación end-to-end de compras Apple ni preparación para Sandbox.

Firmas de tres fixtures públicos del repositorio Apple fueron aceptadas bajo su **CA de pruebas**; los mismos JWS fueron rechazados bajo raíces Apple reales. Se validó además una cadena pública Apple con su raíz G3, offline y en la fecha efectiva del test oficial. Esto demuestra ejecución de criptografía y separación de confianza, **no** una Transaction/AppTransaction/Notification/RenewalInfo de App Store verificada end-to-end.

No se modificó el adaptador. Su API coincide con los cuatro métodos oficiales; falta una pareja firmada completa compatible con Abilene para comprobar el camino positivo completo. No se instalaron paquetes en el proyecto, ni se ejecutaron SQL o Docker.

## Auditoría inicial

HEAD y origin/main local: `1607ff2dad6a23cfcb56b4b769fbde3e365dd437`, mensaje `Validate Apple IAP backend on local PostgreSQL`. Rama main, working tree clean, sin staged, git diff --check sin errores. No hubo fetch.

SHA-256 de migración antes/después: `9e2e48561f0551b32361dae72e9c04da83e2a1f739b7755516a3e77108b8065d`. Los tres entry points siguen componiendo handler sin backend. Inventario inicial de archivos tracked en `repo-initial-sha256.json` dentro del workspace temporal.

## Fuentes oficiales y procedencia

- [Repositorio Apple](https://github.com/apple/app-store-server-library-node).
- [README oficial](https://github.com/apple/app-store-server-library-node/blob/bb0c0f874494321ea2d005329c3dc2188e893d41/README.md): mínimo anunciado Node 16+, raíces públicas externas y ejemplo del constructor. Node 16 no fue probado aquí.
- [API SignedDataVerifier](https://apple.github.io/app-store-server-library-node/classes/SignedDataVerifier.html).
- [Código oficial jws_verification.ts](https://github.com/apple/app-store-server-library-node/blob/bb0c0f874494321ea2d005329c3dc2188e893d41/jws_verification.ts).
- [Pruebas oficiales de verificación](https://github.com/apple/app-store-server-library-node/blob/bb0c0f874494321ea2d005329c3dc2188e893d41/tests/unit-tests/jws_verification.test.ts) y [utilidades de test](https://github.com/apple/app-store-server-library-node/blob/bb0c0f874494321ea2d005329c3dc2188e893d41/tests/util.ts).
- [Fixtures firmados de prueba](https://github.com/apple/app-store-server-library-node/tree/bb0c0f874494321ea2d005329c3dc2188e893d41/tests/resources/mock_signed_data) y [modelo AppTransaction](https://github.com/apple/app-store-server-library-node/blob/bb0c0f874494321ea2d005329c3dc2188e893d41/tests/resources/models/appTransaction.json).
- [Apple PKI](https://www.apple.com/certificateauthority/).
- [Dependencias de Supabase Edge](https://supabase.com/docs/guides/functions/dependencies) y [compatibilidad npm/Node del runtime](https://supabase.com/blog/edge-functions-node-npm).

La consulta npm del paquete oficial confirmó `latest=3.1.0`, coincidente con package.json del repositorio Apple. No se usaron blogs de terceros como autoridad. Los archivos públicos se fijaron al commit `bb0c0f874494321ea2d005329c3dc2188e893d41`; no se descargó el repositorio completo. Se excluyó expresamente el archivo testSigningKey.p8 presente en su inventario: no se leyó ni utilizó ninguna clave privada.

## Workspace y dependencias

Todo instalado en `/private/tmp/abilene-phase41-verifier/`, fuera de Abilene Vibes. Package.json mínimo private, una sola dependencia directa exacta. Sin .env.

Instalación: `npm install --save-exact --ignore-scripts --no-audit --no-fund @apple/app-store-server-library@3.1.0`, con caché dentro del mismo workspace y límites de reintento/red. No se ejecutaron scripts de lifecycle. Se requirió permiso de red tras ENOTFOUND del sandbox; la consulta/instalación autorizada terminó correctamente.

48 paquetes instalados: librería y 47 transitivos. Dependencias declaradas por la librería, versiones resueltas:

| Paquete | Versión |
| --- | --- |
| @apple/app-store-server-library | 3.1.0 |
| @types/jsonwebtoken | 9.0.10 |
| @types/jsrsasign | 10.5.15 |
| @types/node | 25.9.5 |
| @types/node-fetch | 2.6.13 |
| base64url | 3.0.1 |
| jsonwebtoken | 9.0.3 |
| jsrsasign | 11.1.5 |
| node-fetch | 2.7.0 |

El lock temporal conserva todo el árbol exacto. SHA-256: `3133cc57859645822e5f25221a7185cf4503b3c712e9217f96c89f8d90673514`.
Integridad npm de la librería: `sha512-d26SICRz8BwCV2qPR0BSXBMxmw0NEvJLwsdREcBmCrus8NmyHw2XgOOP0fiFjcctPn/JXtmSDuGVnaHe+dqO+A==`.

npm emitió aviso de deprecación de jsrsasign 11.1.5 por falta de mantenimiento. No se sustituyó esa dependencia ni se afirma una auditoría de vulnerabilidades. El main de Apple y el paquete publicado pueden tener rangos transitivos diferentes; se probó el **paquete publicado instalado**, con su lock, no una compilación de main.

## API y comportamiento auditados

Constructor: `new SignedDataVerifier(rootsDER, enableOnlineChecks, environment, bundleId, appAppleId?)`.

Métodos async reales:
- verifyAndDecodeTransaction.
- verifyAndDecodeAppTransaction.
- verifyAndDecodeNotification.
- verifyAndDecodeRenewalInfo.

Production exige appAppleId al construir. Transaction comprueba bundleId/environment; AppTransaction compara bundleId, receiptType y appAppleId en Production. Notifications compara los identificadores/entorno de su contenedor; verificar el JWS externo no sustituye verificar sus JWS internos. RenewalInfo comprueba environment; la vinculación de cadena pertenece además al adaptador/dominio. Los valores de configuración deben venir del servidor.

La implementación utiliza Node X509Certificate/KeyObject, firmas, extensiones OID y jsonwebtoken. Con checks online desactivados usa signedDate, o receiptCreationDate para AppTransaction, como fecha efectiva. Con checks online activados usa fecha actual y OCSP mediante node-fetch, con peticiones POST y caché de claves verificadas. **OCSP no se ejecutó**. No se usó AppStoreServerAPIClient.

Los modos Xcode/LocalTesting omiten verificación de firma en la librería: no se utilizaron como demostración criptográfica. Abilene solo admite Sandbox en su dominio y los endpoints siguen cerrados.

## Certificados públicos temporales

Raíces descargadas desde los enlaces de Apple PKI:
- [Apple Inc. Root](https://www.apple.com/appleca/AppleIncRootCertificate.cer).
- [Apple Root CA G2](https://www.apple.com/certificateauthority/AppleRootCA-G2.cer).
- [Apple Root CA G3](https://www.apple.com/certificateauthority/AppleRootCA-G3.cer).

`testCA.der` procede del repositorio oficial, pero es **CA sintética de test, no raíz Apple PKI**. Se mantuvo separada y se usó exclusivamente para los fixtures públicos. Los certificados real-apple-leaf/intermediate se extrajeron de constantes públicas de las pruebas oficiales; su raíz coincide por hash con G3 descargada de Apple. Ningún certificado se incorpora al repo.

| Archivo | Bytes | SHA-256 |
| --- | ---: | --- |
| AppleIncRootCertificate.cer | 1215 | `b0b1730ecbc7ff4505142c49f1295e6eda6bcaed7e2c68c5be91b5a11001f024` |
| AppleRootCA-G2.cer | 1430 | `c2b9b042dd57830e7d117dac55ac8ae19407d38e41d88f3215bc3a890444a050` |
| AppleRootCA-G3.cer | 583 | `63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179` |
| testCA.der | 390 | `48aa70550eab2cd71d51dced44e88f9143b6bc0e1a6f430c19ba9a7cf36654e6` |
| official-real-apple-leaf.der | 1077 | `4c381556c16121e605d1fc2eef6d0de4e072ed65964fe72f575f19711e84c417` |
| official-real-apple-intermediate.der | 794 | `bdd4ed6e74691f0c2bfd01be0296197af1379e0418e2d300efa9c3bef642ca30` |

También se usaron en memoria dos certificados públicos sintéticos de las constantes del test oficial para el rechazo por OID: INTERMEDIATE_CA_BASE64_ENCODED, 419 bytes, SHA-256 `f714e835a41768d3e7e0cc28cf29ad1835e56cb8e02dae6fd1ea16bdd699de2c`; LEAF_CERT_INVALID_OID_BASE64_ENCODED, 420 bytes, SHA-256 `88e8d34e3f2c828afe4e02979cb0559c52bf28c8d8dc452f57d4c813019324c5`. La constante ROOT_CA coincide por hash con testCA.der. No son certificados Apple PKI.

La cadena Apple se validó a la fecha efectiva oficial `1761962975000` mediante una subclase que expone el método protegido de cadena y llama a super sin alterar criptografía. Se rechazó al usar fecha 2050 o raíz G2 incorrecta. Es prueba de cadena, no de un JWS firmado con esa hoja.

## Vectores encontrados y alcance

| Archivo público | Bytes | SHA-256 |
| --- | ---: | --- |
| transactionInfo | 2357 | `6f3027507d63abc7736c14642c7aa2ccc978510cba6f0d09244e657293ea7ce6` |
| renewalInfo | 2404 | `d9b9f1e70277de27e73b1d0dd42558b62e29631c0dc094ebb65067991e66c71d` |
| testNotification | 2505 | `e1fc5e5795383a5d672a3f355b86407c95a0eb01eb35397dee7e6d76270ef579` |
| missingX5CHeaderClaim | 2499 | `8fb8c5b52328adc06c3938268d3d7cca5fd1c27b2f590ddbb364a588dc43f5b2` |
| wrongBundleId | 2501 | `5c79fcc46ce9bcc6f5b701ab83a63a17f7e1eb7d77fbf45cfb11aec637b4ef19` |
| legacyTransaction | 100 | `c89576769b0c418d867eb9bbb6e16316ded4b9177c2e5e857917fab3665d837b` |
| appTransaction.json | 494 | `970a96a5b49873265e7bac3ee72c12a82bf2faf02750fdff08336ee52197aad0` |

`transactionInfo` contiene solo environment, bundleId y signedDate; `renewalInfo` es también mínimo. `testNotification` es de tipo TEST y carece de la evidencia anidada necesaria para una entrega Abilene. Las firmas de estos fixtures sí se verificaron criptográficamente con testCA; no fueron generadas localmente.

`appTransaction.json` es un modelo sin firma, con receiptType LocalTesting. Solo se usó su estructura para crear entradas sin firma deliberadamente inválidas. No se firmó nada localmente ni se ejecutaron utilidades oficiales que generan claves.

No se encontraron entre los recursos inspeccionados vectores JWS con raíces Apple suficientes para los cuatro caminos completos ni una pareja Transaction/AppTransaction Abilene. Esto describe la búsqueda realizada; no afirma que sea imposible que Apple publique otros vectores.

## Matriz de pruebas

| Caso solicitado | Resultado real |
| --- | --- |
| Transaction válida | Aceptada bajo CA oficial de test; pendiente bajo raíz Apple |
| Transaction alterada | Payload/firma modificados rechazados |
| Firma/cadena inválida | Rechazadas |
| Bundle incorrecto | Rechazo INVALID_APP_IDENTIFIER con fixture firmado de test |
| Environment incorrecto | Rechazo INVALID_ENVIRONMENT con fixture firmado de test |
| appAppleId incorrecto | Constructor y comprobación interna de scope probados; pendiente signed E2E Production |
| AppTransaction válida | Pendiente: no se obtuvo vector firmado apropiado |
| AppTransaction alterada | Entrada derivada de JSON sin firma rechazada; no sustituye manipulación de un vector originalmente válido |
| Notification válida | Aceptada bajo CA de test; pendiente bajo raíz Apple con evidencia interna |
| Notification duplicada | Verifica dos veces con CA de test; idempotencia fuera de esta capa |
| Notification alterada | Rechazada |
| RenewalInfo válida | Aceptada bajo CA de test; pendiente bajo raíz Apple |
| RenewalInfo alterada | Rechazada |
| JWS truncado/formato inválido | Rechazados |
| Payload parseable sin firma válida | Rechazado |
| Algoritmo none | Rechazado |
| Cadena/raíz incorrecta | Rechazadas |
| Fecha inválida y OID incorrecto | Rechazados por la rutina real de cadena |
| Vacío/null | Rechazados por los cuatro métodos |
| Legacy | Rechazado por el adaptador real, sin fallback |

El runner registra **60 PASS / 0 FAIL / 8 pendientes**. Los pendientes son: Transaction Apple-rooted, AppTransaction válido y su tampering, Notification Apple-rooted con internos, RenewalInfo Apple-rooted, appAppleId Production E2E, pareja positiva completa Abilene, OCSP/red y ejecución Deno/Edge. No se disfrazan de tests exitosos.

## Adaptador Abilene y fail closed

`supabase/functions/_shared/apple/apple-verifier.mjs` permanece intacto. Nombres, argumentos y propiedades utilizadas coinciden con la API real instalada. El adaptador llama a verificación de Transaction y AppTransaction; para Notification verifica externo y después Transaction/RenewalInfo internos, con validaciones adicionales de correspondencia.

Se inyectó una instancia real con raíces Apple: rechazó los fixtures test firmados por otra CA. Con la instancia real de CA de test, el adaptador rechazó notification sin signedTransactionInfo y AppTransaction incompleto. No se añadió fallback, verified=true, aceptación por simple decode, degradación legacy ni logger de evidencia. No se relajó bundle/entorno para acomodar fixtures.

Camino positivo completo del adaptador: **pendiente por falta de evidencia apropiada**; coincidencia de interfaz y rechazos reales no equivalen a entrega end-to-end validada. El verifier por defecto sigue sin configurar. Tres handlers con flags falsos en petición devolvieron 503 APPLE_BACKEND_NOT_CONFIGURED.

## Runtime, red y sensibilidad

Node v22.23.2, importación, construcción, promesas, X.509, crypto y errores ejecutados realmente. Última ejecución: 25 ms aproximadamente, RSS final 80 MiB; no es benchmark ni medición de pico/carga.

El runner bloquea conexiones mediante guard de socket y registra intentos: **0**. Todos los verificadores usados para cadena/firma trabajaron offline. No se parchearon verificadores, firmas ni rutinas de cadena para lograr aceptación. Las descargas previas fueron lecturas públicas de fuentes oficiales/npm; no conexiones a servicios de compra.

Deno: command not found; no se instaló. Supabase documenta npm y APIs Node, pero eso no demuestra X.509, OCSP, caché y comportamiento de esta librería en el runtime exacto. Resultado Deno/Supabase Edge: **C / NO DEMOSTRADO para ese runtime**, sin desplegar ni ejecutar Supabase CLI. Clasificación global de esta fase con Node: **B / PARCIAL**.

Los logs del runner contienen nombres de test, PASS/FAIL/PENDING y métricas; no JWS, payloads completos, appAccountToken, bearer/capabilities ni claves. Los fixtures descargados contienen únicamente evidencia pública de test y permanecen temporales. No se descargaron .p8, certificados privados ni datos de Keychain. Se revisaron los archivos instalados para nombres de claves privadas y el log para patrones sensibles.

## Proyecto, integridad y Git

Tests relevantes existentes: `node --test tests/apple-backend/backend.test.mjs`, **51 PASS, 0 FAIL, 0 skipped**. No cambió contrato de persistencia: no se ejecutó PostgreSQL Fase 39.

Comparación SHA-256 final de todos los archivos tracked iniciales: sin cambios. Android/iOS/src/manifests/vite/dist-admin/migraciones/Stripe/Admin intactos. No se modifica package.json/package-lock.json del proyecto ni el adaptador.

Único archivo nuevo del repositorio: `docs/phase41-apple-signed-data-verifier.md`. Sin staged; git diff --stat/--name-only vacíos; git diff --check sin errores. El documento untracked no aparece en esos diffs. No git add, commit ni push.

## Reproducción y siguiente paso

El workspace temporal contiene package.json/package-lock.json, node_modules, download-manifest.json, fuentes públicas seleccionadas, certificados/vectores, run.mjs, runner.log, results.json y project-tests.tap. Para repetir sin red, desde ese directorio: `node run.mjs`. No trasladar la CA de pruebas a una configuración Apple real.

Siguiente paso exacto: mantener endpoints cerrados y obtener/publicar un conjunto oficial reutilizable con Transaction, AppTransaction y Notification con internos válidos bajo raíces Apple, o solicitar una fase separada expresamente autorizada para obtener evidencia de prueba. Hasta entonces conservar B. Después probar OCSP y el runtime elegido; si se elige Edge, se requiere primero autorización para disponer de Deno/runtime local. No habilitar Sandbox como consecuencia automática de este informe.

**CERO conexiones/escrituras a Supabase producción.** Cero Sandbox Apple real, App Store Connect, cambios Apple Developer, App Attest, TestFlight, pagos, deploy, SQL remoto, modificaciones Stripe, builds Android/iOS, Xcode/StoreKit, commit o push.
