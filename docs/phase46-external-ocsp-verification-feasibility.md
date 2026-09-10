# Fase 46 — Viabilidad de una frontera OCSP externa verificable

## Dictamen y alcance

**D — BLOQUEADO POR EVIDENCIA/PLATAFORMA**, específicamente por falta de evidencia emparejada para composición, **no por un bloqueo de plataforma**. Decisión: **WAIT_FOR_UPSTREAM_APPLE_FIX**. No se concede GO.

Las primitivas públicas permitieron demostrar verificación externa de las dos respuestas OCSP Apple auténticas, asociación CertID, autorización delegada, firma, frescura y expiración de caché. No se demostró el positivo imprescindible JWS legítima + OCSP auténtica correspondiente a sus mismos certificados. Las JWS positivas disponibles usan testCA; los OCSP disponibles son de otros certificados públicos Apple. Esa diferencia no se ocultó mediante mocks, sustitución de cadena ni fixtures refirmados. Los resultados permiten continuar investigación específica con evidencia emparejada; no prueban imposibilidad técnica de una frontera externa.

No se reabrieron los resultados cerrados de Fases41–45 ni se consultó otra vez la existencia de versión posterior Apple. Se conserva Node22.23.2 y Apple3.1.0. No producción, deploy, App Attest, Sandbox ni checkpoint.

## 1. Precheck y conservación

Repositorio `/Users/yanier/Documents/abilene-vibes`, branch main, HEAD `1607ff2dad6a23cfcb56b4b769fbde3e365dd437`, mensaje `Validate Apple IAP backend on local PostgreSQL`. Estado inicial exacto: documentos41–45 untracked; nada staged, sin cambios tracked. Snapshot de 378 archivos conservado sin diferencias. Los 340 archivos Apple instalados coinciden byte a byte con Fase45; DER originales sin cambios. Ningún reset, clean, stash, checkout destructivo, git add, commit, push o fetch.

Única adición al repo: `docs/phase46-external-ocsp-verification-feasibility.md`. Todo el código experimental vive en el nuevo laboratorio `/private/tmp/abilene-phase46-ocsp-71sspch_`. Laboratorios anteriores preservados.

Entorno: macOS26.6.2 (build25G83), arm64, Node22.23.2, npm10.9.8; `/usr/bin/openssl` es **LibreSSL3.3.6**, no una instalación OpenSSL nueva. No cambio global.

## 2. Auditoría de primitivas previa a implementación

Se escribió primitive-audit.md antes del prototipo y dependency-evaluation.json antes de incorporar PKIjs. Node ofrece X509Certificate, checkIssued, verify, crypto y WebCrypto, pero no una API OCSP completa para solicitud, BasicOCSPResponse y autorización. checkIssued por sí solo no demuestra firma; el prototipo exige también verify.

jsrsasign heredado permite construir/inspeccionar ASN.1 y CertID; se usa como comparación independiente de request, no como una política OCSP completa asumida. El paquete heredado 11.1.5 emitió aviso npm de deprecación/mantenimiento durante la instalación: riesgo de dependencia transitiva Apple, sin cambiarla en esta fase.

PKIjs3.4.0, licencia BSD-3-Clause, publicado 2026-03-18, tiene APIs públicas utilizables de CertID, OCSPRequest, BasicOCSPResponse, CertificateChainValidationEngine y CryptoEngine. ASN1js3.0.10 resuelve ASN.1 estructurado. Dependencias fijadas por package-lock; PKIjs se agregó con versión exacta al laboratorio. 55 paquetes instalados en total. La integridad PKIjs coincide con npm. No se modificó el paquete ni se incorporó dependencia al repo.

La licencia permite uso/redistribución cumpliendo avisos y condiciones; no se distribuyó software en esta fase. La publicación reciente apoya mantenimiento razonable, pero no constituye auditoría de seguridad. Riesgos: parser ASN.1, cadena transitiva, cambios de API, algoritmos y necesidad de revisión independiente antes de adopción. Los imports de ASN1js proceden de la dependencia bloqueada en lockfile; una futura integración debe declararla directamente si conserva esos imports.

Fuentes primarias: [Node22.23.2 crypto](https://nodejs.org/download/release/v22.23.2/docs/api/crypto.html), [PKIjs BasicOCSPResponse](https://pkijs.org/docs/api/classes/BasicOCSPResponse/), [repositorio PKIjs](https://github.com/PeculiarVentures/PKI.js), [registro npm PKIjs](https://registry.npmjs.org/pkijs). Se inspeccionó además el código instalado exacto y su LICENSE.

La verificación de alto nivel BasicOCSPResponse.verify no se trató como autorización OCSP completa: su código local selecciona signer y valida cadena/firma, sin aportar por sí solo todas las reglas específicas de autorización y política requeridas. El candidato utiliza operaciones públicas específicas y aplica explícitamente el perfil limitado descrito debajo. No se sobrescriben métodos ni se accede a internals de SignedDataVerifier.

## 3. Modelo de amenazas y fronteras de confianza

Adversario puede aportar JWS, x5c y DER arbitrarios, repetir respuestas auténticas antiguas, cambiar issuer/serial/status/fechas/firma, causar timeout, mezclar certificados o explotar caché. Ningún dato del caller constituye un recibo autenticado.

SignedDataVerifier sigue siendo obligatorio para firma JWS, cadena Apple, bundle, environment y decodificación. La frontera adicional se encarga de revocación/frescura, no sustituye Apple. El objeto decodificado solo sale de compose tras ambas comprobaciones OCSP. La función de bajo nivel verifyOCSP no es un validador Apple completo: presupone que su issuer pertenece a un contexto de confianza validado por la composición; su PASS aislado no concede entitlement.

En composición se extrae x5c como no confiable del mismo string inmutable JWS. Se usan los dos primeros certificados, igual que la ruta auditada Apple. Después de que el método público Apple pase, se selecciona el root del conjunto configurado mediante relación de emisor y firma; no se confía en el tercer x5c como trust anchor. Las copias DER se hashean y se pasan exactamente a OCSP. Solo se devuelve trusted:true tras comprobación del leaf y del intermediate.

## 4. Fuente y vinculación de certificados

Los tres positivos públicos transactionInfo, renewalInfo y testNotification pasan por sus métodos públicos oficiales en SANDBOX con testCA y online=false. Los tests verifican que los hashes de leaf/issuer recibidos por el loader son exactamente los del x5c de esa JWS. La respuesta OCSP Apple de otro certificado no permite trusted:true.

Esto demuestra la transferencia exacta del input validado, pero no aporta el positivo conjunto con OCSP correspondiente. No se usaron LOCAL_TESTING/XCODE para saltar firma ni se reemplazó SignedDataVerifier por un stub. No se descargaron fixtures nuevas tras la instrucción de continuar solo con lo permitido localmente.

Hashes de las cadenas disponibles:

- `transactionInfo`: leaf `3f8db10dd7fee72ddf3d5a9273cb034251359fefd24b70b2032b8678d02d7424`, intermediate `f367c00388523351e4135dbc4f38bdb6abcedbf8d5a80975acc02eb890a9cc50`; coincidencia con leaf OCSP público: **False**.
- `renewalInfo`: leaf `e90a63af9d3f8b3c84bc096d3d7180c0b2d25a31d8189988a8193114b862bb10`, intermediate `f714e835a41768d3e7e0cc28cf29ad1835e56cb8e02dae6fd1ea16bdd699de2c`; coincidencia con leaf OCSP público: **False**.
- `testNotification`: leaf `3f8db10dd7fee72ddf3d5a9273cb034251359fefd24b70b2032b8678d02d7424`, intermediate `f367c00388523351e4135dbc4f38bdb6abcedbf8d5a80975acc02eb890a9cc50`; coincidencia con leaf OCSP público: **False**.

## 5. OCSP request y CertID

Request por PKIjs CertID.createForCertificate con SHA-256, OCSPRequest/TBSRequest/Request. CertID incluye algoritmo, issuerNameHash, issuerKeyHash y serial. Se compararon los tres valores calculados con jsrsasign getParamByCerts, y LibreSSL parseó la solicitud DER mostrando esos valores. No se envió la request.

Para el leaf:
- hashAlgorithm: SHA-256, OID2.16.840.1.101.3.4.2.1.
- issuerNameHash: 0f1c74b7cc3bcb8428383973c1b0a446c81d2a7176f4c2113d3a6a66ae396261.
- issuerKeyHash: 189b89ec26a445e740a953ed101784480c05fa18e85979343f38fe4130e18cd5.
- serial: 47c287cdd9f9e7867f528ada74dc7db7.

La respuesta debe igualar el CertID completo. Algoritmo distinto del perfil SHA-256 se rechaza, sin negociar una degradación. Wrong certificate, wrong issuer y mutaciones de ambos hashes/serial se rechazan. Perfiles adicionales requerirían pruebas antes de ampliarse.

Referencia normativa: [RFC6960 §4.1.1 y §4.2.2.3](https://www.rfc-editor.org/rfc/rfc6960#section-4.1.1). Se separa hashing de identidad de la fortaleza del algoritmo de firma; SHA-1 en ResponderID byKey pertenece a su definición, no autoriza firmas SHA-1.

## 6. Parseo de respuesta y misma evidencia

Se usa el mismo buffer DER para ASN.1, CertID, firma y tiempos. Se registra SHA-256 de ese buffer en el recibo final. Se rechazan bytes sobrantes, DER malformado, tamaño >64KiB, responseStatus no exitoso, responseType distinto de BasicOCSPResponse, versión no soportada, más de una SingleResponse y extensiones críticas no soportadas. Son límites conservadores del candidato, no una afirmación de que RFC prohíba todos los perfiles excluidos.

PKIjs conserva tbsResponseData.tbsView, los bytes firmados originales. CryptoEngine.verifyWithPublicKey verifica esos bytes y la firma contra la clave del signer autorizado. No se serializa otra respuesta ni se autentica una segunda respuesta distinta. Algoritmos permitidos en el candidato: ECDSA SHA256/SHA384, RSA PKCS#1 SHA256/SHA384; los demás fail closed. Los dos fixtures reales usan ECDSA SHA384.

## 7. Firma y autorización del responder

Se identifica signer por ResponderID byName o byKey, rechazando ausencia/ambigüedad. Caso issuer directo admitido por política, pero no hay fixture real de ese caso aquí. Ambos fixtures observados utilizan delegado.

Para delegado se exige:
- emisión directa por el issuer exacto: metadatos y firma del certificado;
- certificado vigente al reloj de evaluación;
- EKU id-kp-OCSPSigning;
- KeyUsage digitalSignature;
- extensión id-pkix-ocsp-nocheck correctamente representada;
- validación de cadena del delegado mediante CertificateChainValidationEngine con issuer como ancla ya suministrada por contexto confiable.

El requisito nocheck limita el perfil: sin él se rechaza OCSP_RESPONDER_REVOCATION_UNVERIFIED porque no se implementó revocación recursiva del responder. No se confía en un certificado solo por estar incluido en la respuesta. La firma OCSP se verifica después de establecer signer autorizado.

GOOD auténtico verifica. Copia con un byte de firma alterado rechaza. Se rechazan mutaciones de certificado del responder y ResponderID, issuer incorrecto, serial, certStatus y fechas. Las mutaciones son negativos no auténticos, nunca evidencia Apple refirmada. Las pruebas de ausencia individual de cada extensión en un certificado delegado legítimamente firmado no existen; la política se inspeccionó y las mutaciones invalidan firmas. Esto limita la cobertura y requiere revisión de una candidata antes de aprobación.

Normativa: [RFC6960 §4.2.2.2 y §4.2.2.2.1](https://www.rfc-editor.org/rfc/rfc6960#section-4.2.2.2), [RFC5280 §4.2.1.12](https://www.rfc-editor.org/rfc/rfc5280#section-4.2.1.12).

## 8. Estado, frescura y producedAt

GOOD solo después de asociación/autorización/firma/frescura. REVOKED y UNKNOWN mapean a rechazo; pruebas de mapeo sintético NON-APPLE PASS, pruebas legítimas firmadas SKIP. No se asigna revoked a un error genérico.

Fechas OCSP en GeneralizedTime UTC Z con segundos y sin fracción conforme al perfil RFC5280. ASN1js parsea; un control de perfil comprueba representación canónica y finitud en ResponseData, sin rechazar UTCTime legítimo de certificados. No se escribió un parser PKI general.

Política: thisUpdate y nextUpdate finitos; nextUpdate obligatorio; thisUpdate <= nextUpdate; thisUpdate o producedAt posteriores a now+60s rechazan; nextUpdate anterior a now−60s rechaza. Exactamente ±60s en límites directos se permite. El acceso a caché/refresh es más estricto: no autoriza en o después de nextUpdate.

producedAt identifica cuándo se firmó la respuesta, no su vencimiento. Política adicional conservadora: producedAt >= thisUpdate−60s y producedAt <= nextUpdate. No es un reemplazo de nextUpdate ni se presenta la segunda desigualdad como mandato universal RFC. Ambos fixtures tienen producedAt=thisUpdate. Tests sintéticos separados verifican producedAt futuro y anterior al estado.

[RFC6960 §2.4 y §4.2.2.1](https://www.rfc-editor.org/rfc/rfc6960#section-2.4), [RFC5280 §4.1.2.5.2](https://www.rfc-editor.org/rfc/rfc5280#section-4.1.2.5.2).

Fresh GOOD: PASS; future rejected: PASS; expired rejected: PASS, con el mismo DER auténtico. Reloj fresco histórico 2026-09-10T01:59:00Z; futuro 2026-09-08T00:00:00Z; expirado 2026-09-20T00:00:00Z. También se ejecutaron límites thisUpdate−61/−60 y nextUpdate/exacto/+60/+61.

El reloj sincronizado sigue siendo requisito de seguridad. Date wall clock proporciona epoch; timeouts utilizan temporizadores. El prototipo detecta rollback y fechas no finitas, elimina caché ante rollback y falla cerrado. No demuestra defensa contra toda deriva gradual ni sustituye reloj seguro/NTP del host.

## 9. Nonce y red

No se envía nonce en la request candidata. Los fixtures conservados no tienen nonce; esto NO demuestra si Apple reflejaría uno solicitado. Esa capacidad queda NO DETERMINADA, sin nueva consulta. RFC6960 §4.4.1 define su enlace request/response; una política sin nonce admite replay únicamente mientras el estado firmado siga fresco, con CertID y caducidad comprobados. No se presupone soporte ni se exige un nonce inexistente a Apple.

network.mjs es un adaptador local experimental: destinos exactos permitidos para los dos responders públicos, POST OCSP, rechazo de redirect, timeout/abort, límite de64KiB. Tests inyectan la API fetch propia del adaptador, no alteran fetch de Apple ni global. DNS/connection refused son errores inyectados, no fallos reales de sockets. El timeout sí usa un temporizador real sin abrir socket. HTTP error y tamaño se prueban con Response local.

Fase46 hizo cero solicitudes a ocsp.apple.com. Las únicas consultas externas fueron investigación pública/instalación de dependencia antes de la última instrucción; no credenciales ni APIs privadas. El primer curl npm falló DNS bajo sandbox y se autorizó su repetición antes de esa instrucción. Después: ninguna solicitud de acceso adicional, ningún intento de evadir controles, Daybreak o cambio de seguridad.

BLOCKED_BY_PLATFORM: **0 tests en esta continuación**. No se inventa un bloqueo para pruebas no realizadas: la falta de evidencia emparejada se etiqueta explícitamente como tal. No se ejecutó wire regression por sockets ni consulta de nonce; no se necesitó acceso nuevo para las pruebas offline restantes.

## 10. Caché externa

Key: JSON de SHA256 DER del certificado, SHA256 DER issuer y environment. Incluye certificado completo, no solo serial. Cambio de certificado/issuer/rotación/environment produce key distinta; los hashes evitan colisiones prácticas, sin afirmar imposibilidad matemática. Los recibos están congelados y la estructura es privada al proceso.

Máximo32 entradas y32 refresh pendientes, política TTL15min, vencimiento=min(now+TTL,nextUpdate). Entradas vencidas se eliminan antes de refresh. En nextUpdate, deja de servir caché; respuesta ya vencida no vuelve a autorizar aunque esté dentro de skew de comprobación directa. Error de refresh no restaura GOOD antiguo. Refresh concurrente de una misma key se comparte; capacity rechaza nuevos pendientes excesivos.

Tests: cache hit antes de vencimiento; rechazo exacto nextUpdate; escenario Fase45 nextUpdate+61s; error de refresh; rollback; reloj inválido durante fetch; separación environment; memoria acotada; capacity pendiente; excepciones sin cache poisoning. Todos PASS.

Concurrencia:20 verificaciones de dos pares certificado/issuer alternados. Primera oleada20/20 positivas con2 cargas. Segunda oleada tras vencimiento leaf:10 rechazos leaf y10 positivos intermediate aún fresco. No cross-talk observado. Ambas entradas habían superado también TTL15min, de modo que hubo2 cargas adicionales,4 acumuladas. No prueba un sistema distribuido ni todos los interleavings posibles.

## 11. Composición SignedDataVerifier y modelos

Modelo A: online=false + OCSP externo obligatorio. Ventaja: no depende del parser/caché OCSP internos ni duplica red. Riesgo exacto: Apple valida fechas de certificados en signedDate, no necesariamente ahora. El candidato agrega comprobaciones actuales de los certificados en la ruta OCSP; no se declara equivalencia completa de seguridad hasta probar composición positiva y fechas adversarias. Firma JWS, cadena, bundle/environment siguen en Apple.

Modelo B: online=true + OCSP externo obligatorio. Mantendría el modo temporal online de Apple pero también su red duplicada/fallos y caché defectuosa. La frontera externa tendría que ser obligatoria incluso si Apple retorna desde caché. No se ejecutó una composición online positiva sin JWS emparejada ni se modificó transporte interno para forzarla. Se reutiliza la auditoría cerrada Fase45; no se da por segura su caché.

Ninguno aprobado. Modelo A es candidato de investigación únicamente si se valida la comprobación temporal suplementaria; no es un permiso para usar online=false en producción. El servicio anterior y apple-verifier.mjs no cambiaron.

Tres positivos oficiales TEST (Transaction/RenewalInfo/Notification) verifican por separado. Composición con OCSP de otros certificados: trusted:false. JWS con firma alterada + loader capaz de devolver GOOD: trusted:false y loader no llamado. Cinco escenarios emparejados (GOOD, expired, future, firma OCSP alterada, timeout tras vínculo correcto) están SKIP por ausencia de fixture correspondiente. Esos cinco SKIP son esenciales; los restantes tres (AppTransaction, REVOKED, UNKNOWN) son limitaciones conocidas no suficientes por sí solas para impedir una futura clasificación B.

## 12. Matriz y resultados automáticos

Consolidado final: **69 tests distintos,61 PASS,0 FAIL,8 SKIP**. No se presenta como una ejecución completa única del código final. Primera suite:64/53PASS/3FAIL/8SKIP. Se conservaron TAP y fuente inicial; se corrigieron únicamente las incidencias y se repitieron los3 fallidos:3PASS. Tests adicionales nuevos:5PASS. No se repitieron los tests que ya habían pasado después de la instrucción del usuario. Ejecuciones registradas totales72:61PASS,3FAIL iniciales,8SKIP; el consolidado sustituye esos3 resultados por su retest.

Incidencias iniciales conservadas:
1. Firma ECDSA malformada ya rechazaba, pero la excepción de biblioteca no tenía código estable; se normalizó a OCSP_INVALID_SIGNATURE.
2. Mutación certStatus generó ASN.1 de revoked inválido; se cambió el negativo a UNKNOWN estructuralmente parseable, sin refirmar, para exigir fallo de firma.
3. Test concurrente esperaba3 cargas, aunque ambos TTL habían vencido: expectativa correcta4, con idéntico rechazo de leaf caducado.

Smoke de desarrollo anterior: versión ASN.1 DEFAULT ausente se recibió undefined; se normalizó a0. Recorrido ASN.1 se restringió a nodos construidos para evitar entrar en componentes primitivos OID. Ambos rechazos iniciales y correcciones están en development-results.txt; no fueron problemas de plataforma.

| Escenario | Resultado |
|---|---|
| Fresh GOOD auténtico | PASS |
| Future auténtico rechazado | PASS |
| Expired auténtico rechazado | PASS |
| Firma alterada rechazada | PASS |
| Certificado incorrecto / issuer incorrecto | PASS |
| DER malformado | PASS |
| Timeout | PASS, temporizador local |
| Connection refused / DNS | PASS, inyección explícita |
| HTTP error | PASS, Response local |
| Stale cache | PASS: no autoriza |
| JWS válida + OCSP correspondiente válido | SKIP: evidencia esencial ausente |
| JWS inválida + GOOD disponible | PASS: false antes de cargar OCSP |
| JWS válida + OCSP correspondiente expirado | SKIP: evidencia esencial ausente |

Grupos A parse, B CertID, C firma, D autorización, E frescura, F caché, G errores, H composición, I transporte, J concurrencia figuran en el inventario al final. Transporte tiene2 checks offline mínimos sobre módulos heredados: HMAC request y vinculación de response con request_id/nonce al transportar trusted:false. No equivale a repetir la suite de transporte de Fase44; no hay servicio nuevo integrado que afirmar validado.

## 13. LibreSSL como oracle, rendimiento y límites

LibreSSL parseó request.der SHA256 y su CertID coincidió. Validó la firma/cadena de la respuesta con root.pem e issuer.pem: Response verify OK. El primer comando con -cert construyó consulta SHA1 por defecto y mostró No Status found; se conserva, no se presenta como éxito completo. Segundo comando usó -reqin request.der SHA256 y confirmó Response verify OK. Ese output no sustituye la comprobación de estado/frescura del candidato ni acredita una composición JWS. No se usó -noverify ni bypass de firma; -no_nonce solo omite un nonce no solicitado al usar evidencia guardada.

No subprocess en composition.mjs ni servicio. LibreSSL fue oracle diagnóstico local, no la única vía exitosa; por ello no se elige EVALUATE_OPENSSL_SERVICE_BOUNDARY.

Performance de solución viable: NO APLICA; falta aprobación de composición. Se conservan duraciones TAP, pero no se presentan como benchmark por etapa o SLA. No carga a Apple ni comparación productiva. No se declaró ausencia universal de races, cache poisoning o problemas de PKI por una suite pequeña.

## 14. Qué no se hizo y estado final

Sin modificación de Apple library, hooks de internals, monkey patches, fork, patch-package o verificador Apple alternativo. Sin claves privadas, firmas nuevas, falsa CA, evidencia Apple fabricada, TLS bypass o trust store productivo. Mutaciones solo negativos de copias temporales.

No Supabase/DB, Stripe, Android, App Store Connect/Developer, Sandbox, TestFlight, pagos, Notifications reales, App Attest, precios, login, cloud o deploy. Sin sudo, admin, firewall, keychain, instalación global, puerto público ni cambios globales Node/npm. No solicitudes adicionales de acceso tras la instrucción de continuación.

Inspección local: las tres entradas Apple siguen llamando handler sin backend; POST permanece503 APPLE_BACKEND_NOT_CONFIGURED (otros métodos405). No invocación remota. No se volvió a ejecutar la suite backend ya cerrada para comprobar algo inalterado.

Estado final: main, HEAD1607ff2dad6a23cfcb56b4b769fbde3e365dd437; documentos41–46 untracked, nada staged, sin cambios tracked, commit o push. Hashes iniciales preservados.

## 15. Bloqueantes y siguiente fase mínima

Bloqueante de aprobación: ausencia de evidencia legítima emparejada que atraviese SignedDataVerifier y OCSP externo sobre los mismos certificados, incluida validación del modelo temporal elegido. Los69 tests no suplen esa evidencia.

Pendientes no causantes por sí solos del dictamen: AppTransaction positivo, REVOKED/UNKNOWN legítimos, soporte Apple nonce no determinado, ampliación de perfiles de firma/responder si fuera necesaria. La autorización directa issuer solo está soportada por diseño, no demostrada con fixture auténtico en esta fase. Revisión independiente y pruebas de límites adicionales serían necesarias antes de convertir este candidato en control productivo.

Siguiente fase mínima propuesta: validación de composición con un fixture público oficial de JWS firmado cuyo x5c corresponda a respuestas OCSP auténticas disponibles. Sin compras, credenciales, APIs privadas o certificados fabricados. Con evidencia emparejada, ejecutar únicamente los escenarios de composición hoy SKIP y las comprobaciones temporales online=false/true requeridas. Si no se dispone de ese material bajo las restricciones, mantener la espera upstream; no reabrir parser/caché3.1.0 ni forzar GO.

Hasta entonces la recomendación operativa única es **WAIT_FOR_UPSTREAM_APPLE_FIX**. No checkpoint ni producción.

## 16. Artefactos y reproducción

Desde `/private/tmp/abilene-phase46-ocsp-71sspch_` con Node22.23.2:
- `node --test boundary.test.mjs` es la suite candidata para una reproducción futura autorizada; no se volvió a ejecutar completa tras la corrección.
- Retest realizado: `node --test --test-name-pattern='signature byte tamper|certStatus tamper|20 concurrent mixed' boundary.test.mjs`.
- `node --test additional.test.mjs`.
- `node evidence.mjs` genera inventario de CertID, tiempos y hashes x5c, sin secretos.
- Dependencias reproducibles por package.json/package-lock.json; una reinstalación necesitaría respetar permisos vigentes, no se solicita aquí.

No copiar este candidato al servicio ni interpretar el recibo de bajo nivel como decisión independiente de confianza Apple.

### Evidencia OCSP auténtica

- `ocsp-public-3dd14ec10e2be9a6430e58484fff3118a181f3fa5f64eac2d9371baf9f0911d2.der` SHA256 `3dd14ec10e2be9a6430e58484fff3118a181f3fa5f64eac2d9371baf9f0911d2`; certificado `4c381556c16121e605d1fc2eef6d0de4e072ed65964fe72f575f19711e84c417`; thisUpdate `20260909170030Z`, nextUpdate `20260910050029Z`, producedAt `2026-09-09T17:00:30.000Z`; nonce presente `False`.
- `ocsp-public-e4935183cd0bf5160334ae4bc32889d9cba432e105188b2766e9183a388d0ce1.der` SHA256 `e4935183cd0bf5160334ae4bc32889d9cba432e105188b2766e9183a388d0ce1`; certificado `bdd4ed6e74691f0c2bfd01be0296197af1379e0418e2d300efa9c3bef642ca30`; thisUpdate `20260910001835Z`, nextUpdate `20260910121834Z`, producedAt `2026-09-10T00:18:35.000Z`; nonce presente `False`.

### Hashes SHA-256 de artefactos

El hash del documento se comunica fuera de su contenido para evitar autorreferencia. No se hashearon secretos. Paths relativos al laboratorio.

| Archivo | SHA-256 |
|---|---|
| additional.tap | 522c3e630e1f9551cd05ec2d23a97b63f0bba49095ea0f0a018c4368ba035ab9 |
| additional.test.mjs | 2fa583acb7e58ba480015813250e0731ebbd2d3a92c57f6c63dc1bdc6de9c5f2 |
| auth.mjs | 055a41cfe32ee7007115f7e1acc0ef1614d886e6d54bcfdf04efa74f749b819b |
| boundary-first.tap | a82dc0506134763eab34c661d75d7d7a68fc461c35da74af7d633ed20282648d |
| boundary-retest.tap | ae8553c8f9ac0e88ece3ae26928d9ad1ef947562f0fe0a75663684391b0b36c3 |
| boundary.test.mjs | 3458ad3c19a0ae7d912e528a513514f1eaf1aa1f5c6bbd1d22be5f9dfc78fd60 |
| caller.mjs | 220d609bf8d05c279e6e60bc7ba21fb63ee55f75d761fa9814bcd07e3c75a4c0 |
| composition.mjs | cecfca9ea501b7d22cc3ffbf536cad79f3e252a3c82f48ebb30ab71d7b62697d |
| dependency-evaluation.json | b76f77eff371d0f631eb5e5698539348f55c0b3427075ced04953783cdde7b4b |
| development-results.txt | 03d3088377833daa3c503b4702573f5aaefd769fceb4ac4064b8b00ebaab44c9 |
| evidence.mjs | 85a7a104aa0cc412ff0f7922d90f749202152ccbd702bb480113b28fc6eb4be5 |
| fixture-inspection.json | e0e1e14b9eacae6b089af04a804ac61ed9b84888c42e88a1ebd1ccc08f2bf884 |
| initial-hashes.json | 303a9ff2694fb14f64957594ee77167933d5d5913427fc2229ff445006991f07 |
| inspect.mjs | 337f594afc0cc7136c47b075697645ee49af29e94a5cb7fbaffbd9e060d5ea4b |
| integrity-audit.json | d92aeffcf5f46d20c462e0aa86740dc4d778d23d8a5cf8fe363ad4bb24ad6b29 |
| network.mjs | 466d70cfaa46f37b3e2671300f47df7b9fdfd29fcf8017c186d3d9d29be7fc50 |
| ocsp-boundary-initial.mjs | 332fb5226bef3f8ed25eddddbebd997025dd319a9498249dd1caaba258fe7dd6 |
| ocsp-boundary.mjs | 6aeaf6fddd337a4ea90341ac6544a3108bab483c2097667214fdf975c72c7932 |
| ocsp-evidence.json | c17be3d46cf4eed80aae647401d501b67fc57196711e503990c72ce0cbc97184 |
| ocsp-fixtures.json | 5bee4eafb3270b9a1b1954c5881869bcbd006b567ecb63bc1a84b55a7b5ca22c |
| ocsp-public-3dd14ec10e2be9a6430e58484fff3118a181f3fa5f64eac2d9371baf9f0911d2.der | 3dd14ec10e2be9a6430e58484fff3118a181f3fa5f64eac2d9371baf9f0911d2 |
| ocsp-public-e4935183cd0bf5160334ae4bc32889d9cba432e105188b2766e9183a388d0ce1.der | e4935183cd0bf5160334ae4bc32889d9cba432e105188b2766e9183a388d0ce1 |
| ocsp-public-result.json | 750b9c3ac006090ee72c44b1e06e9baff24e4e74093024a0d7df5d545641bdb0 |
| openssl-request.txt | 1874e360812bf96325eb020990ca8c6cb1b5bac13b49e62819d12c7bcfa61fde |
| openssl-response-sha256.txt | b15170935e1cc535b43ce69cbb31c7eda9ca0ffa209ed8800dd95bde427f6f32 |
| openssl-response.txt | fabafca7002e0f06f685bd142c0f02c54c2e11bc5cb59dd67b2e6ea9aa515953 |
| package-lock.json | 74c89386c0be9416a57242aedafce85d9acc64a592f1c8268e7a411e31301bee |
| package.json | 6ca17ca398542963b6e127872ee94d89539d8ca9ba81517926e1a171299e6a94 |
| pkijs-registry.json | b775495aca5c710c41b84d3ecc9081f9677f5b79f7b7700a679233747c6edbf7 |
| primitive-audit.md | 8acb6f8267050620e9a9d84e5c1af29be6d42e3ac9ba75c426820eeb4d619ba6 |
| request-certid.json | 8338b657f146f77b046aa12d27301f9e54ccf41facaddeff84603d76446c95de |
| request.der | 2c471d0de3472cfc739ed63f403e0872cc955349c1101df36d6eea81aa09b47d |
| schema.mjs | aab22715b41bcc3cb35ace98cbf98d42ef83cf9a993b2e689e7676f3b68f95f2 |
| smoke.mjs | 5cd1ec5a7910d14fb1fb0559c6b314152e041886cc883b093ecd1053ca79eea1 |
| test-summary.json | a22c886a221384ac107a486b0132a31746b9ed53bbeea6fb58aedaae5f4d1abf |

### Inventario consolidado de tests

| Test | Resultado |
|---|---|
| A ocsp-parse authentic BasicOCSPResponse | PASS |
| A ocsp-parse rejects malformed | PASS |
| A ocsp-parse rejects trailing bytes | PASS |
| A ocsp-parse rejects oversize | PASS |
| B CertID matches real leaf and issuer; independent jsrsasign comparison | PASS |
| B wrong certificate response rejects | PASS |
| B wrong issuer rejects | PASS |
| C authentic GOOD signature verifies using authorized signer | PASS |
| C signature byte tamper rejects specifically | PASS |
| B altered serialNumber rejects | PASS |
| B altered issuerNameHash rejects | PASS |
| B altered issuerKeyHash rejects | PASS |
| C signed thisUpdate byte tamper rejects | PASS |
| C signed nextUpdate byte tamper rejects | PASS |
| C certStatus tamper rejects signature, not fabricated revocation evidence | PASS |
| D delegated responder issuer, EKU, KU and nocheck authorized | PASS |
| D responder certificate tamper rejects | PASS |
| D responder ID tamper rejects | PASS |
| D wrong authorization issuer rejects | PASS |
| E freshness fresh GOOD | PASS |
| E freshness future | PASS |
| E freshness expired | PASS |
| E freshness this minus61 | PASS |
| E freshness this minus60 | PASS |
| E freshness next exact | PASS |
| E freshness next plus60 | PASS |
| E freshness next plus61 | PASS |
| E both public certificates fresh GOOD | PASS |
| E policy-only NON-APPLE missing next | PASS |
| E policy-only NON-APPLE reverse interval | PASS |
| E policy-only NON-APPLE produced future | PASS |
| E policy-only NON-APPLE produced before status | PASS |
| E invalid clock rejects | PASS |
| A synthetic NON-APPLE status mapping REVOKED | PASS |
| E legitimate signed REVOKED | SKIP |
| A synthetic NON-APPLE status mapping UNKNOWN | PASS |
| E legitimate signed UNKNOWN | SKIP |
| F cache before expiry hit; at nextUpdate rejects stale refresh | PASS |
| F phase45 scenario nextUpdate+skew cannot reuse cache | PASS |
| F refresh error cannot reuse GOOD stale | PASS |
| F clock rollback invalidates entries | PASS |
| F environment separation and bounded entries | PASS |
| G injected fetch ENOTFOUND fails closed | PASS |
| G injected fetch ECONNREFUSED fails closed | PASS |
| G timeout using actual timer, no socket | PASS |
| G HTTP error | PASS |
| G URL SSRF rejected before fetch | PASS |
| G response bounded; oversized rejected | PASS |
| G same DER delivered byte-for-byte and authenticated | PASS |
| H transaction official valid TEST JWS and exact x5c hashed; wrong OCSP cannot compose | PASS |
| H transaction invalid JWS + GOOD never calls external OCSP | PASS |
| H renewal official valid TEST JWS and exact x5c hashed; wrong OCSP cannot compose | PASS |
| H renewal invalid JWS + GOOD never calls external OCSP | PASS |
| H notification official valid TEST JWS and exact x5c hashed; wrong OCSP cannot compose | PASS |
| H notification invalid JWS + GOOD never calls external OCSP | PASS |
| H valid JWS + corresponding authentic GOOD | SKIP |
| H valid JWS + corresponding expired OCSP | SKIP |
| H valid JWS + corresponding future OCSP | SKIP |
| H valid JWS + corresponding signature-tampered OCSP | SKIP |
| H valid JWS + OCSP timeout after matching certificate | SKIP |
| H positive AppTransaction | SKIP |
| I transport HMAC request unchanged | PASS |
| I response binds trusted:false result to request ID and nonce | PASS |
| J 20 concurrent mixed certificate checks do not cross-talk; coalesced cache; stale never reused | PASS |
| B unsupported CertID algorithm rejected; metadata-only NON-APPLE unit | PASS |
| C unsupported signature algorithm rejected; metadata-only NON-APPLE unit | PASS |
| F concurrent refresh capacity bounded | PASS |
| F clock becomes invalid during pending fetch rejects | PASS |
| G injected internal exception cannot populate cache | PASS |
