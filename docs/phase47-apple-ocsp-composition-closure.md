# Fase 47 — Cierre de composición Apple/OCSP

## 1. Clasificación y decisión

**D — BLOCKED_BY_PLATFORM**. Arquitectura: **EXTERNAL_OCSP_BOUNDARY_PENDING_REAL_EVIDENCE**.

Se cierra la investigación local sin aprobar integración. El inventario disponible no contiene pareja legítima JWS↔OCSP. La búsqueda dirigida no devolvió resultados y la plataforma impidió abrir los cuatro inventarios oficiales solicitados. No se reintentó por otra vía ni se pidió acceso adicional. No se afirma haber demostrado la inexistencia global de evidencia pública: por eso no se otorga B como si se hubiese completado esa comprobación.

El bloqueo funcional sigue siendo **WAIT_FOR_MATCHED_REAL_APPLE_EVIDENCE**. Una corrección upstream es otra posible condición futura de revisión, no la única forma de resolverlo. Se precisa así la recomendación operativa de Fase46 sin modificar su documento histórico.

**¿Queda más investigación OCSP local? NO.** No se propone otra fase equivalente para buscar fixtures. Reapertura únicamente con evidencia legítima emparejada disponible o release oficial materialmente relevante, y autorización correspondiente.

## 2. Precheck y entorno

Repositorio `/Users/yanier/Documents/abilene-vibes`; branch main; HEAD `1607ff2dad6a23cfcb56b4b769fbde3e365dd437`, mensaje `Validate Apple IAP backend on local PostgreSQL`. Inicialmente documentos41–46 untracked, nada staged y sin cambios tracked. No reset, clean, stash, checkout destructivo, add, commit, push ni checkpoint.

Nuevo workspace `/private/tmp/abilene-phase47-matched-evidence-5ewre81t`, creado con tempfile.mkdtemp bajo /private/tmp. Copias controladas del laboratorio46: fixtures, respuestas públicas, package.json/lock, dependencias y candidato ya existente. Node22.23.2; Apple3.1.0; PKIjs3.4.0/ASN1js3.0.10 exclusivamente temporales. macOS26.6.2 arm64, npm10.9.8 según entorno verificado de esta ejecución. Sin actualización ni instalación nueva.

No se ejecutó el candidato OCSP ni se cambió su código. El script nuevo inventory.mjs solo lee representaciones JWS/certificados y calcula inventario/hashes; no verifica firmas, altera evidencia, abre sockets o ejecuta pruebas criptográficas. Node X509Certificate se utilizó para leer metadatos públicos.

## 3. Inventario previo a consultas nuevas

Se recorrieron los fixtures descargados de Fases41–46 disponibles en downloads y los tests distribuidos del paquete Apple3.1.0. Se identificaron cinco strings JWS distintos: tres positivos TEST ya validados y dos negativos oficiales. No se encontraron strings JWS adicionales en los tests distribuidos inspeccionados. Los scripts históricos no se ejecutaron otra vez.

Origen exacto de los fixtures descargados, documentado en Fase41: [mock_signed_data oficial](https://github.com/apple/app-store-server-library-node/tree/bb0c0f874494321ea2d005329c3dc2188e893d41/tests/resources/mock_signed_data). Las referencias de origen se reutilizan; no representan una nueva descarga exitosa en Fase47. El test de cadena Apple pública está separado de los JWS positivos, según las [pruebas oficiales archivadas](https://github.com/apple/app-store-server-library-node/blob/bb0c0f874494321ea2d005329c3dc2188e893d41/tests/unit-tests/jws_verification.test.ts).

Inventario leído a fecha UTC 2026-09-10T03:01:07.422Z. “Actualmente válido” solo expresa notBefore/notAfter del certificado, no confianza Apple ni validez OCSP.

### missingX5CHeaderClaim

Tipo: Fixture negativo sin x5c. Origen: mock_signed_data/missingX5CHeaderClaim, commit oficial arriba indicado. SHA256 JWS `8fb8c5b52328adc06c3938268d3d7cca5fd1c27b2f590ddbb364a588dc43f5b2`. Resultado: No admisible como positivo; no se revalida firma ni se relaja configuración.

Sin x5c; no se puede identificar leaf/issuer para consulta OCSP.


Posibilidad de obtener OCSP público correspondiente con este material: no demostrada; no hay URL AIA ni respuesta legítima correspondiente disponible. No se fabrica endpoint ni se consulta Apple por certificados testCA.

### renewalInfo

Tipo: RenewalInfo positivo TEST. Origen: mock_signed_data/renewalInfo, commit oficial arriba indicado. SHA256 JWS `d9b9f1e70277de27e73b1d0dd42558b62e29631c0dc094ebb65067991e66c71d`. Resultado: PASS heredado de SignedDataVerifier en laboratorio con testCA; no repetido.

- leaf: SHA256 `e90a63af9d3f8b3c84bc096d3d7180c0b2d25a31d8189988a8193114b862bb10`; issuer `C=US, ST=CA, L=Cupertino, O=Intermediate`; serial `0C`; notBefore `Jan  5 21:31:34 2023 GMT`, notAfter `Jan  1 21:31:34 2033 GMT`; dentro de vigencia `True`; AIA/OCSP URL: ausente.
- intermediate: SHA256 `f714e835a41768d3e7e0cc28cf29ad1835e56cb8e02dae6fd1ea16bdd699de2c`; issuer `C=US, ST=California, L=Cupertino`; serial `0B`; notBefore `Jan  5 21:31:05 2023 GMT`, notAfter `Jan  1 21:31:05 2033 GMT`; dentro de vigencia `True`; AIA/OCSP URL: ausente.

Posibilidad de obtener OCSP público correspondiente con este material: no demostrada; no hay URL AIA ni respuesta legítima correspondiente disponible. No se fabrica endpoint ni se consulta Apple por certificados testCA.

### testNotification

Tipo: Notification TEST positivo. Origen: mock_signed_data/testNotification, commit oficial arriba indicado. SHA256 JWS `e1fc5e5795383a5d672a3f355b86407c95a0eb01eb35397dee7e6d76270ef579`. Resultado: PASS heredado de SignedDataVerifier en laboratorio con testCA; no repetido.

- leaf: SHA256 `3f8db10dd7fee72ddf3d5a9273cb034251359fefd24b70b2032b8678d02d7424`; issuer `C=US, ST=California, L=Cupertino, O=Intermediate`; serial `0B`; notBefore `Jan  4 16:37:31 2023 GMT`, notAfter `Dec 31 16:37:31 2032 GMT`; dentro de vigencia `True`; AIA/OCSP URL: ausente.
- intermediate: SHA256 `f367c00388523351e4135dbc4f38bdb6abcedbf8d5a80975acc02eb890a9cc50`; issuer `C=US, ST=California, L=Cupertino`; serial `06`; notBefore `Jan  4 16:26:01 2023 GMT`, notAfter `Dec 31 16:26:01 2032 GMT`; dentro de vigencia `True`; AIA/OCSP URL: ausente.

Posibilidad de obtener OCSP público correspondiente con este material: no demostrada; no hay URL AIA ni respuesta legítima correspondiente disponible. No se fabrica endpoint ni se consulta Apple por certificados testCA.

### transactionInfo

Tipo: Transaction positivo TEST. Origen: mock_signed_data/transactionInfo, commit oficial arriba indicado. SHA256 JWS `6f3027507d63abc7736c14642c7aa2ccc978510cba6f0d09244e657293ea7ce6`. Resultado: PASS heredado de SignedDataVerifier en laboratorio con testCA; no repetido.

- leaf: SHA256 `3f8db10dd7fee72ddf3d5a9273cb034251359fefd24b70b2032b8678d02d7424`; issuer `C=US, ST=California, L=Cupertino, O=Intermediate`; serial `0B`; notBefore `Jan  4 16:37:31 2023 GMT`, notAfter `Dec 31 16:37:31 2032 GMT`; dentro de vigencia `True`; AIA/OCSP URL: ausente.
- intermediate: SHA256 `f367c00388523351e4135dbc4f38bdb6abcedbf8d5a80975acc02eb890a9cc50`; issuer `C=US, ST=California, L=Cupertino`; serial `06`; notBefore `Jan  4 16:26:01 2023 GMT`, notAfter `Dec 31 16:26:01 2032 GMT`; dentro de vigencia `True`; AIA/OCSP URL: ausente.

Posibilidad de obtener OCSP público correspondiente con este material: no demostrada; no hay URL AIA ni respuesta legítima correspondiente disponible. No se fabrica endpoint ni se consulta Apple por certificados testCA.

### wrongBundleId

Tipo: Fixture negativo de bundle. Origen: mock_signed_data/wrongBundleId, commit oficial arriba indicado. SHA256 JWS `5c79fcc46ce9bcc6f5b701ab83a63a17f7e1eb7d77fbf45cfb11aec637b4ef19`. Resultado: No admisible como positivo; no se revalida firma ni se relaja configuración.

- leaf: SHA256 `e90a63af9d3f8b3c84bc096d3d7180c0b2d25a31d8189988a8193114b862bb10`; issuer `C=US, ST=CA, L=Cupertino, O=Intermediate`; serial `0C`; notBefore `Jan  5 21:31:34 2023 GMT`, notAfter `Jan  1 21:31:34 2033 GMT`; dentro de vigencia `True`; AIA/OCSP URL: ausente.
- intermediate: SHA256 `f714e835a41768d3e7e0cc28cf29ad1835e56cb8e02dae6fd1ea16bdd699de2c`; issuer `C=US, ST=California, L=Cupertino`; serial `0B`; notBefore `Jan  5 21:31:05 2023 GMT`, notAfter `Jan  1 21:31:05 2033 GMT`; dentro de vigencia `True`; AIA/OCSP URL: ausente.

Posibilidad de obtener OCSP público correspondiente con este material: no demostrada; no hay URL AIA ni respuesta legítima correspondiente disponible. No se fabrica endpoint ni se consulta Apple por certificados testCA.

Otros archivos: appTransaction.json es un modelo decodificado, no una JWS firmada; legacyTransaction no aporta la cadena x5c JWS necesaria. Los certificados Apple públicos sueltos no constituyen una JWS. No se mezclan esos materiales para simular una pareja.

## 4. Candidatos OCSP y matching

Se mantienen los dos DER públicos auténticos de Fases44–46. Son útiles para pruebas OCSP aisladas ya cerradas; no son evidencia correspondiente a los JWS TEST inventariados.

- OCSP `3dd14ec10e2be9a6430e58484fff3118a181f3fa5f64eac2d9371baf9f0911d2`; certificado `4c381556c16121e605d1fc2eef6d0de4e072ed65964fe72f575f19711e84c417`; CertID algoritmo `2.16.840.1.101.3.4.2.1`, issuerNameHash `0f1c74b7cc3bcb8428383973c1b0a446c81d2a7176f4c2113d3a6a66ae396261`, issuerKeyHash `189b89ec26a445e740a953ed101784480c05fa18e85979343f38fe4130e18cd5`, serial `47c287cdd9f9e7867f528ada74dc7db7`; thisUpdate `20260909170030Z`, nextUpdate `20260910050029Z`.
- OCSP `e4935183cd0bf5160334ae4bc32889d9cba432e105188b2766e9183a388d0ce1`; certificado `bdd4ed6e74691f0c2bfd01be0296197af1379e0418e2d300efa9c3bef642ca30`; CertID algoritmo `2.16.840.1.101.3.4.2.1`, issuerNameHash `b21fcb631d28ec6bfe2afc3cbcf8e12c5327f081b916630a55ceeb413aeda796`, issuerKeyHash `b43358ddc0aab4636345230f48a65d66dd79740216a2f2f784c53abd17b6611d`, serial `22c1a1470a747369ef538612c9c69f3d38f36cd7`; thisUpdate `20260910001835Z`, nextUpdate `20260910121834Z`.

El leaf Apple público SHA256 `4c381556c16121e605d1fc2eef6d0de4e072ed65964fe72f575f19711e84c417` no coincide con ninguno de los dos leaf TEST (`3f8d…7424` y `e90a…bb10`). Su issuer SHA256 `bdd4ed6e74691f0c2bfd01be0296197af1379e0418e2d300efa9c3bef642ca30` tampoco coincide con los intermediates TEST.

**Pareja JWS↔OCSP disponible: NO.** No se construyó otra request CertID ni se realizó ninguna consulta OCSP nueva: no había candidata realmente útil que la justificara. Tampoco se volvió a verificar firma OCSP.

## 5. Búsqueda pública limitada y restricción exacta

Una ronda dirigida de cuatro consultas de búsqueda, una por biblioteca oficial Node/Python/Java/Swift, sobre fixtures firmados/testCA: cero resultados. Esto no demuestra inexistencia de fixtures públicos.

Se intentó leer una vez el inventario público recursivo de cada repositorio oficial mediante la herramienta web:

- `https://api.github.com/repos/apple/app-store-server-library-node/git/trees/main?recursive=1` → **BLOCKED_BY_PLATFORM**: `not safe to open (non-retryable error)`.
- `https://api.github.com/repos/apple/app-store-server-library-python/git/trees/main?recursive=1` → **BLOCKED_BY_PLATFORM**: `not safe to open (non-retryable error)`.
- `https://api.github.com/repos/apple/app-store-server-library-java/git/trees/main?recursive=1` → **BLOCKED_BY_PLATFORM**: `not safe to open (non-retryable error)`.
- `https://api.github.com/repos/apple/app-store-server-library-swift/git/trees/main?recursive=1` → **BLOCKED_BY_PLATFORM**: `not safe to open (non-retryable error)`.

No se abrieron los árboles. No se conocen sus contenidos actuales a partir de esta ronda. No se intentó curl, navegador, URL alternativa o herramienta distinta para superar esos bloqueos. No se solicitó Daybreak ni permisos adicionales. No se revisaron otra vez versiones Apple, OCSP general o PR451.

Las cuatro operaciones bloqueadas son descubrimiento de evidencia, no tests de firma o composición fallidos. La plataforma impidió completar el alcance de búsqueda previsto; D refleja esa limitación de cierre. No hay evidencia de defecto nuevo.

## 6. SignedDataVerifier, OCSP externo y cinco criterios

Se conservan los resultados de Fase46: tres JWS TEST pasan los métodos públicos correspondientes; OCSP externo auténtico pasa aisladamente, con futuros/expirados rechazados y caché limitada. Consolidado histórico69 tests,61PASS,0FAIL,8SKIP; no ejecutado otra vez ni contado como Fase47.

No existe PASS conjunto sobre la misma cadena. Los cinco criterios esenciales quedan:

| Criterio | Estado | Motivo |
|---|---|---|
| GOOD correspondiente → trusted:true | SKIP | NO_MATCHING_SIGNED_JWS_AND_AUTHENTIC_OCSP_FIXTURE |
| OCSP correspondiente expirado → false | SKIP | NO_MATCHING_SIGNED_JWS_AND_AUTHENTIC_OCSP_FIXTURE |
| OCSP correspondiente futuro → false | SKIP | NO_MATCHING_SIGNED_JWS_AND_AUTHENTIC_OCSP_FIXTURE |
| Firma de OCSP correspondiente alterada → false | SKIP | NO_MATCHING_SIGNED_JWS_AND_AUTHENTIC_OCSP_FIXTURE |
| Timeout tras vinculación correcta → false | SKIP | NO_MATCHING_SIGNED_JWS_AND_AUTHENTIC_OCSP_FIXTURE |

No se convierte una composición negativa con certificado incorrecto en test de expiración, firma o timeout correspondiente. No se altera evidencia, no se relajan bundle/environment/fechas y no se sustituye SignedDataVerifier.

Contabilidad Fase47: **0 tests criptográficos/composición ejecutados**; matriz de5 criterios con0PASS/0FAIL/5SKIP (no ejecutados). Inventario de5 JWS y4 lecturas bloqueadas no son tests automatizados PASS/FAIL. No se creó TAP ficticio. closure-results.json conserva esa distinción.

## 7. Caché y modelo temporal

No se repitieron tests de caché sin pareja legítima. El rechazo de stale demostrado en Fase46 sigue siendo evidencia de componente aislado, no validación end-to-end nueva.

Modelo temporal pendiente: online=false hace que Apple evalúe certificados con signedDate; OCSP externo usa wall-clock UTC actual y la caché debe expirar como máximo en nextUpdate. online=true usa el tiempo actual en la ruta Apple pero conserva los problemas conocidos de OCSP/cache internos. No se elige ni habilita modelo productivo sin demostrar la composición y las comprobaciones temporales suplementarias. No se manipuló reloj ni se ejecutó otra prueba temporal en Fase47.

## 8. Fail closed y límites

Sin GO, integración, producción o entitlement. La ausencia de evidencia no autoriza trusted:true. El código del candidato y apple-verifier.mjs permanecen sin cambios; los documentos históricos se preservan. El alcance cerrado no demuestra que sea imposible construir la frontera, ni que solo una corrección upstream pueda desbloquearla.

La línea local queda congelada. El siguiente evento útil es evidencia legítima emparejada obtenida en una etapa Apple real posteriormente autorizada, probablemente Sandbox/dispositivo, o nueva evidencia oficial; una release materialmente relevante también puede justificar revisión. Eso es una condición futura, no autorización para iniciar Sandbox ni búsqueda adicional ahora. No se recomienda Fase48 OCSP local.

## 9. Producción, endpoints y Git

Cero producción, Supabase/DB, Stripe, Android, App Store Connect privado, Apple Developer privado, Sandbox, TestFlight, compras, pagos, App Attest, deploy, cloud o precios. No secretos, instalaciones globales, firewall, sudo ni acceso sensible.

Inspección local no destructiva: las tres entradas Apple siguen pasando handler sin backend. POST conserva503 APPLE_BACKEND_NOT_CONFIGURED; otros métodos405. No invocación remota ni habilitación.

Estado final: main/HEAD1607ff2dad6a23cfcb56b4b769fbde3e365dd437; documentos41–47 untracked, nada staged ni cambios tracked. Ningún add/commit/push/checkpoint. Único archivo nuevo en repo: este documento.

## 10. Artefactos y hashes

Workspace `/private/tmp/abilene-phase47-matched-evidence-5ewre81t`. inventory.mjs y local-jws-inventory.json preservan inventario; closure-results.json registra criterios y bloqueos. package.json/lockfile y candidato copiados no se actualizaron.

El SHA256 de este documento se entrega en el reporte final, fuera de su contenido, para evitar autorreferencia. No se hashearon secretos.

| Artefacto local | SHA256 |
|---|---|
| inventory.mjs | 5df06aaa8d0796d896e9735c0cf105f6ab4a282967501e3473b929b2368d02ce |
| local-jws-inventory.json | 25ea1b4d29801d67ee6222a0e082d9c47156f318e412ffcccf5816dea87d90e0 |
| closure-results.json | 7b40919d811a265b666060a00b7803d40d55102dd5d7933bc8a5ab850a3cd4ae |
| package.json | 6ca17ca398542963b6e127872ee94d89539d8ca9ba81517926e1a171299e6a94 |
| package-lock.json | 74c89386c0be9416a57242aedafce85d9acc64a592f1c8268e7a411e31301bee |
| ocsp-boundary.mjs | 6aeaf6fddd337a4ea90341ac6544a3108bab483c2097667214fdf975c72c7932 |
| composition.mjs | cecfca9ea501b7d22cc3ffbf536cad79f3e252a3c82f48ebb30ab71d7b62697d |
