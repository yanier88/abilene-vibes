# Fase 43 — Supabase Edge Runtime oficial, validación local

**C — NO RECOMENDADO para SignedDataVerifier 3.1.0 en la imagen probada.** Supabase Edge Runtime v1.76.2 ejecutó los 51 casos dentro de un user worker real: 42 PASS / 9 FAIL. Los tres fixtures positivos fallan; X509Certificate.verify e infoAccess lanzan ERR_NOT_IMPLEMENTED y la comprobación ECDSA directa devuelve false para una firma pública válida. Importar el paquete y producir rechazos no demuestra compatibilidad criptográfica.

Recomendación: opción 3, verificador Apple en un servicio Node separado; Edge conservaría únicamente la orquestación. No se implementó esa alternativa. El resultado no afirma que todas las versiones futuras de Edge fallen ni identifica el runtime desplegado en producción.

## Auditoría y fuentes oficiales

Estado inicial: main, HEAD `1607ff2dad6a23cfcb56b4b769fbde3e365dd437`, mensaje `Validate Apple IAP backend on local PostgreSQL`; origin/main coincide según referencias locales. Solo documentos Fase 41 y 42 untracked, nada staged. Sin fetch. Migración SHA-256 `9e2e48561f0551b32361dae72e9c04da83e2a1f739b7755516a3e77108b8065d`.

Inventario inicial: 373 archivos versionados más ambos documentos, 375 hashes. Conservados al cierre. Endpoints reales leídos, no ejecutados directamente ni modificados; su composición sigue sin backend inyectado, POST 503 APPLE_BACKEND_NOT_CONFIGURED.

- [Repositorio oficial Edge Runtime](https://github.com/supabase/edge-runtime): distingue main runtime y user runtime; se ejecutaron ambos, no solo un programa Deno genérico.
- [Release oficial v1.76.2](https://github.com/supabase/edge-runtime/releases/tag/v1.76.2), publicada 2026-09-02T11:53:31Z. La API pública de GitHub la devolvió como release latest durante la consulta; se fijó el tag explícito.
- [Docker Compose oficial Supabase](https://github.com/supabase/supabase/blob/master/docker/docker-compose.yml): la copia consultada fija `supabase/edge-runtime:v1.76.2`. Justifica representatividad para self-host local, no equivalencia con un proyecto hospedado. La copia y su hash se conservan como evidencia de una fuente mutable.
- [Ejemplo main fijado al tag](https://github.com/supabase/edge-runtime/blob/v1.76.2/examples/main/index.ts): Deno.serve, EdgeRuntime.userWorkers.create y worker.fetch con Request original. Solo se reutilizó el patrón mínimo, sin autenticación, telemetry ni clientes Supabase.
- [Cargo.toml del tag](https://github.com/supabase/edge-runtime/blob/v1.76.2/Cargo.toml): dependencias del runtime y parche rusty_v8 v130.0.7.
- [Supabase: dependencias](https://supabase.com/docs/guides/functions/dependencies): npm: y configuración por función; no equivale a certificar X509/crypto. [Entorno local oficial](https://supabase.com/docs/guides/functions/development-environment): contexto de herramientas locales, sin instalar CLI aquí.

La procedencia de certificados y fixtures Apple permanece documentada en Fase 41/42; se reutilizaron copias públicas verificadas por SHA-256. No se investigó ni ejecutó Deno genérico nuevamente.

## Runtime fijo y aislamiento

Imagen: `supabase/edge-runtime:v1.76.2`.
Digest: `sha256:edd22bef4477b900d5c300e287ce9b18bff9b81a0291bee14ee0b7c7b71a2899`.
Arquitectura observada: arm64.
Todos los arranques funcionales quedaron fijados por digest.

Salida del binario `--version`: edge-runtime 0.1.0; deno 2.1.4 (release, aarch64-unknown-linux-gnu). 0.1.0 es la versión informada por el binario, no reemplaza el tag de distribución v1.76.2.

Deno.version dentro del user worker:
- deno: supabase-edge-runtime-1.76.2 (compatible with Deno v2.1.4)
- v8: 11.6.189.12
- typescript: 5.1.6

Se registran literalmente los metadatos del worker. Cargo.toml fija rusty_v8 mediante tag v130.0.7, que no coincide nominalmente con el campo v8 mostrado por Deno.version. No se presenta este último como una medición independiente del motor enlazado; esa discrepancia no se resolvió. La ejecución y el digest delimitan la prueba, no una equivalencia inferida por números de versión.

Workspace exclusivo: `/private/tmp/abilene-phase43-edge-runtime/`. Sin instalación CLI/global, cambios PATH/perfiles o dependencias del repo. Configuración Docker temporal vacía para pulls públicos; socket de Docker usado solo por CLI del host, nunca montado en contenedores.

Contenedores efímeros, sin puertos publicados, sin repo, secretos, project link ni credenciales. Solo montaje del workspace. DENO_DIR=/work/edge-cache. Main escucha 127.0.0.1:9000 dentro del contenedor; un fetch loopback entra en main y este conserva la Request original al invocar el user worker. envVars=[]; memoria 256 MiB, timeout worker 20 s, CPU soft/hard 1500/2000 ms. Son parámetros locales explícitos, no certificación de límites de producción.

La primera solicitud con red fue rechazada; no se ejecutó. Se autorizó una alternativa offline y después el usuario confirmó autorización para continuar. La caché pública de Fase 42 no incluía @types/node 22.5.4 exigido por Edge; el intento offline falló por esa ausencia. Se preparó la caché con red en una ejecución separada autorizada, únicamente para paquetes públicos npm. Prueba mínima definitiva, matriz, diagnóstico, bundle y missing import: red Docker desactivada. Sin consultas OCSP reales.

El primer arnés creó una Request directamente y Edge rechazó el envío por ausencia de su etiqueta interna. Se corrigió solo el arnés siguiendo el enrutamiento HTTP oficial, sin parchear runtime o librería. Los avisos posteriores de wall-clock corresponden al worker de prueba que permanece sirviendo hasta su límite; los resultados se obtuvieron antes. Todos los contenedores Fase 43 quedaron cerrados.

## Importación, constructor y roots

Prueba mínima definitiva: PASS. Import npm:@apple/app-store-server-library@3.1.0, SignedDataVerifier disponible, constructor real, lectura de AppleRootCA-G3.cer (583 bytes), malformed rechazado como VerificationException / VERIFICATION_FAILURE. Deno.serve del user worker respondió a una solicitud HTTP interna real.

Se leyeron archivos públicos incluidos mediante staticPatterns y context.useReadSyncFileAPI=true, conforme al ejemplo oficial. La matriz también ejecuta node:fs.readFileSync. Estrategia futura candidata: archivos DER públicos versionados con la función, hashes auditados e inclusión explícita como assets estáticos. La prueba local de lectura no certifica un deploy administrado. Embebido sería alternativa que requeriría su propia revisión; no se introdujeron roots en el repo.

Todos los verificadores usan enableOnlineChecks=false. Solo el caso de scope incorrecto configura Production con appAppleId de prueba; no realiza llamadas Apple. testCA solo sirve a fixtures sintéticos oficiales, nunca como raíz de confianza productiva.

## Matriz completa y comparación

Node 22.23.2 y Deno 2.9.6 son resultados guardados de Fase 42, verificados por hash, no ejecuciones nuevas. Edge usa las mismas 51 operaciones, nombres y expectativas. Solo se adaptó el transporte del arnés: imports npm literales enumerados para el grafo Edge, export de resultados a HTTP en lugar de escribir archivo desde el user worker. No se alteraron assertions para convertir fallos en éxitos.

| # | Caso | Node 22.23.2 | Deno 2.9.6 | Edge v1.76.2 |
|---|---|---|---|---|
| 1 | import | PASS | PASS | PASS |
| 2 | A node:crypto | PASS | PASS | PASS |
| 3 | B X509Certificate | PASS | PASS | PASS |
| 4 | C Buffer | PASS | PASS | PASS |
| 5 | D process | PASS | PASS | PASS |
| 6 | E fs | PASS | PASS | PASS |
| 7 | F path | PASS | PASS | PASS |
| 8 | G jsonwebtoken | PASS | PASS | FAIL |
| 9 | H jsrsasign | PASS | PASS | PASS |
| 10 | I node-fetch Headers Response | PASS | PASS | PASS |
| 11 | J base64url | PASS | PASS | PASS |
| 12 | M SHA-256 | PASS | PASS | PASS |
| 13 | transactionInfo valid testCA / ECDSA / async | PASS | PASS | FAIL |
| 14 | transactionInfo payload tampered | PASS | PASS | PASS |
| 15 | transactionInfo signature tampered | PASS | PASS | PASS |
| 16 | transactionInfo wrong roots | PASS | PASS | PASS |
| 17 | transactionInfo invalid chain | PASS | PASS | PASS |
| 18 | transactionInfo alg none | PASS | PASS | PASS |
| 19 | renewalInfo valid testCA / ECDSA / async | PASS | PASS | FAIL |
| 20 | renewalInfo payload tampered | PASS | PASS | PASS |
| 21 | renewalInfo signature tampered | PASS | PASS | PASS |
| 22 | renewalInfo wrong roots | PASS | PASS | PASS |
| 23 | renewalInfo invalid chain | PASS | PASS | PASS |
| 24 | renewalInfo alg none | PASS | PASS | PASS |
| 25 | testNotification valid testCA / ECDSA / async | PASS | PASS | FAIL |
| 26 | testNotification payload tampered | PASS | PASS | PASS |
| 27 | testNotification signature tampered | PASS | PASS | PASS |
| 28 | testNotification wrong roots | PASS | PASS | PASS |
| 29 | testNotification invalid chain | PASS | PASS | PASS |
| 30 | testNotification alg none | PASS | PASS | PASS |
| 31 | verifyAndDecodeTransaction empty | PASS | PASS | PASS |
| 32 | verifyAndDecodeTransaction null | PASS | PASS | PASS |
| 33 | verifyAndDecodeTransaction malformed | PASS | PASS | PASS |
| 34 | verifyAndDecodeRenewalInfo empty | PASS | PASS | PASS |
| 35 | verifyAndDecodeRenewalInfo null | PASS | PASS | PASS |
| 36 | verifyAndDecodeRenewalInfo malformed | PASS | PASS | PASS |
| 37 | verifyAndDecodeNotification empty | PASS | PASS | PASS |
| 38 | verifyAndDecodeNotification null | PASS | PASS | PASS |
| 39 | verifyAndDecodeNotification malformed | PASS | PASS | PASS |
| 40 | verifyAndDecodeAppTransaction empty | PASS | PASS | PASS |
| 41 | verifyAndDecodeAppTransaction null | PASS | PASS | PASS |
| 42 | verifyAndDecodeAppTransaction malformed | PASS | PASS | PASS |
| 43 | bundle mismatch | PASS | PASS | FAIL |
| 44 | environment mismatch | PASS | PASS | FAIL |
| 45 | missing roots | PASS | PASS | PASS |
| 46 | malformed root | PASS | PASS | PASS |
| 47 | missing x5c | PASS | PASS | PASS |
| 48 | AppTransaction unsigned model | PASS | PASS | PASS |
| 49 | K ASN1 real Apple chain | PASS | PASS | FAIL |
| 50 | P certificate dates | PASS | PASS | FAIL |
| 51 | Q wrong OID | PASS | PASS | FAIL |

Totales: Node 51/51; Deno 2.9.6 51/51; Edge 42/51, 9 fallos. Los 9 nombres que fallan coinciden con el patrón de Deno 2.5.0 de Fase 42. No son nueve defectos independientes: cuatro assertions de bundle/entorno/fecha/OID fallan porque la verificación de cadena se interrumpe antes de alcanzar esos controles.

Fallos y códigos observados:

- G jsonwebtoken: Error; sin código
- transactionInfo valid testCA / ECDSA / async: VerificationException; VERIFICATION_FAILURE
- renewalInfo valid testCA / ECDSA / async: VerificationException; VERIFICATION_FAILURE
- testNotification valid testCA / ECDSA / async: VerificationException; VERIFICATION_FAILURE
- bundle mismatch: AssertionError; ERR_ASSERTION
- environment mismatch: AssertionError; ERR_ASSERTION
- K ASN1 real Apple chain: ERR_NOT_IMPLEMENTED; ERR_NOT_IMPLEMENTED
- P certificate dates: AssertionError; ERR_ASSERTION
- Q wrong OID: AssertionError; ERR_ASSERTION

## Diagnóstico suplementario, fuera del denominador 51

| Operación | Resultado | Evidencia |
|---|---|---|
| X509 intermediate.verify | FAIL | ERR_NOT_IMPLEMENTED |
| X509 leaf.verify | FAIL | ERR_NOT_IMPLEMENTED |
| X509 intermediate.ca | PASS | retorno True |
| X509 publicKey.asymmetricKeyDetails | PASS | sin excepción |
| X509 infoAccess | FAIL | ERR_NOT_IMPLEMENTED |
| async rejection is Promise | PASS | retorno True |
| checkDates valid direct | PASS | sin excepción |
| checkDates expired direct expected rejection | PASS | retorno True |
| ECDSA direct verify P1363 | FAIL | retorno False |
| jsonwebtoken valid | FAIL | Error |
| OCSP immediate code path | FAIL | ERR_NOT_IMPLEMENTED |
| transactionInfo truncated rejects | PASS | retorno True |
| renewalInfo truncated rejects | PASS | retorno True |
| testNotification truncated rejects | PASS | retorno True |
| HTTP actual crypto failure closed | PASS | retorno True |
| HTTP synthetic runtime failure closed | PASS | retorno True |

Diagnóstico: 10 PASS / 6 FAIL. X509Certificate parsea certificados y expone publicKey/ca, pero verify no está implementado. infoAccess tampoco. ECDSA P1363 retorna false para la misma firma aceptada por los controles Node/Deno 2.9.6. jsonwebtoken no la verifica. checkDates directo sí funciona, aunque la validación completa no llega hasta él. No se atribuye el fallo a formato de fixture ni a una dependencia ejecutable distinta.

Transaction, RenewalInfo y Notification positivos bajo testCA: VERIFICATION_FAILURE. Modificaciones de payload/firma, alg none, wrong roots, wrong chain y entradas truncadas/malformed/empty/null se rechazan; esos rechazos no acreditan una verificación correcta si los positivos también fallan. OID incorrecto y scope incorrecto quedan bloqueados prematuramente por crypto. AppTransaction firmado positivo continúa pendiente; el modelo sin firma se rechaza y no se fabricó ningún vector.

## Entrypoint y fail closed

Main y user runtime reales, usando el patrón oficial de proxy. Importación mínima y HTTP funcionales; la prueba de crypto real devuelve rechazo HTTP 400 sin éxito. Un fallo de runtime sintético inyectado en el wrapper temporal también devuelve 400: es prueba del catch, no una caída real del motor.

Prueba separada de import ausente: el grafo del user worker no arranca y el main responde HTTP 503 con error sanitizado classErr. Fuentes montadas read-only en esa prueba, caché con permiso de escritura en submontaje del mismo workspace. No hay decode-only, legacy fallback, escritura de derechos ni confianza en verified=true del cliente. Las solicitudes son controladas por el arnés; el backend Abilene no se importó.

## Empaquetado y reproducibilidad

El comando oficial `edge-runtime bundle` produjo un ESZip offline con la matriz y assets públicos, checksum SHA-256. Empaquetar funciona; no elimina la incompatibilidad criptográfica. No se ejecutó ese archivo ESZip como una segunda validación de los 51 casos; los resultados proceden del arranque por servicePath del user worker oficial.

Archivo: `/private/tmp/abilene-phase43-edge-runtime/matrix.eszip`.
SHA-256: `bf80533fbdcccfc44c415ad996abbf037eb759ac683e3dc9bcfeedcff5751ec9`.

Paquete Apple fijo 3.1.0; jsonwebtoken 9.0.3; jsrsasign 11.1.5; node-fetch 2.7.0; base64url 3.0.1. La caché conserva las 48 versiones del baseline Node y tipos adicionales de Deno/Edge: @types/node 24.2.0 y 22.5.4, undici-types 7.10.0 y 6.19.8. Inventario de caché no significa que todas esas versiones de tipos se cargaran en ejecución. No se observó una diferencia de versión en las dependencias ejecutables relevantes.

Reutilización pública inicial validada por hash; caché npm final con 1323 archivos inventariados por SHA-256. Se conservan resultados, fuentes oficiales seleccionadas, entradas, imagen fija y ESZip identificado. No se generó lockfile ni se demostró build determinista de dos bundles independientes.

Futuro mecanismo seguro: npm specifier exacto y configuración por función (deno.json/imports), lockfile revisado con transitivas fijas y enforcement verificado mediante herramienta oficial compatible; checksum del bundle y roots explícitas. `bundle --help` de esta imagen no expone flag --lock/--frozen: no se inventó tal garantía. Si se adopta Node, usar package-lock y npm ci en su servicio aislado. Ninguna dependencia del proyecto fue modificada.

## OCSP

Solo se comprobó compatibilidad inmediata. Se alcanzó el método oficial checkOCSPStatus con certificados públicos: falla en infoAccess con ERR_NOT_IMPLEMENTED antes de construir/enviar la consulta. Docker --network none refuerza el aislamiento. No se activó enableOnlineChecks ni se consultaron responders OCSP.

Estado: camino inmediato FAIL en esta imagen; validación de revocación, respuesta firmada, caché, timeout y reintentos NOT EXECUTED. No se declara OCSP validado, ni se amplió esta fase a validación completa de revocación.

## Adaptador, endpoints e integridad

apple-verifier.mjs auditado por lectura: verificador oficial inyectado, awaits y validación de scope/correlación; sin imports crypto propios ni fallback. No se demostró un defecto en su contrato; sin cambios. No se ocultaron fallos del runtime mediante monkey patches, forks o polyfills.

Los entrypoints reales solo se leyeron. Continúan componiendo handler sin backend, por lo que POST sigue cerrado con 503 APPLE_BACKEND_NOT_CONFIGURED. No hubo invocación de esos endpoints, deploy ni conexión a proyecto Supabase.

Tests del proyecto: `node --test tests/apple-backend/backend.test.mjs`, 51 PASS / 0 FAIL. No PostgreSQL, Swift, StoreKit, Android, Xcode, build web o cap sync.

Integridad por SHA-256: 375/375 iniciales conservados, incluidos ambos documentos previos. Cubre todos los archivos versionados de android, ios, src, dist-admin (62 archivos), manifiestos, vite.config.js, migraciones, Stripe, Admin y StoreKit bridge. No se inventaría una garantía para archivos generados/ignorados: los adicionales de ios no estaban en la captura inicial por git ls-files y no se tocaron mediante las acciones de esta fase.

Único archivo nuevo en repo: docs/phase43-supabase-edge-runtime-validation.md. Git final: tres documentos Fase 41/42/43 untracked; nada staged, diff --stat/name-only/check vacíos. Sin fetch, commit ni push.

## Clasificación, arquitectura y Fase 44

C — NO RECOMENDADO, alcance exacto imagen oficial v1.76.2 por digest. La importación y el empaquetado pasan, pero los positivos criptográficos fallan y hay APIs ausentes. B de Deno genérico en Fase 42 no se transfiere a este Edge real.

Opción 3 recomendada, no implementada: servicio Node privado ejecutaría SignedDataVerifier y devolvería únicamente evidencia verificada o error sanitizado. Edge autenticaría/orquestaría y usaría el resultado solo si el servicio responde de forma válida; fallos o indisponibilidad nunca concederían derechos. Correlación, ledger e idempotencia deben mantener sus controles. Este diseño necesita revisión y pruebas de frontera antes de implementarse.

Fase 44 exacta recomendada: preparar un prototipo local aislado del verificador Node con versión y lock fijos, reutilizar la matriz, diseñar el contrato Edge→Node y probar fail closed ante indisponibilidad. En ese runtime Node, diseñar/ejecutar por separado la validación reproducible OCSP (revocación, respuestas inválidas, timeout y retry). Mantener pendientes los JWS positivos Apple/AppTransaction cuando no exista evidencia pública adecuada. Sin deploy, credenciales, Sandbox ni habilitación de endpoints hasta resolver esos puntos.

Limitaciones: no equivalencia certificada con producción hospedada; no AppTransaction firmado positivo; no OCSP completo; no garantía del dato V8 fuera de la metadata reportada; no prueba independiente de determinismo del bundle o enforcement de lock. No se ensayó otra versión Edge ni Deno genérico para cambiar la clasificación.

CERO conexiones/escrituras a Supabase producción. Sin login, link, Dashboard, credenciales, SQL, deploy, Apple Sandbox, Apple Developer, App Store Connect, App Attest, TestFlight, claves .p8, pagos, Stripe, commit o push. La única red de preparación del contenedor fue para paquetes públicos npm; las otras conexiones fueron fuentes oficiales y descarga de imagen pública.

## Comandos de reproducción local

Requieren Docker autorizado y el workspace público/caché preparados; no instalan herramientas globales. El workspace conserva user/index.ts con la matriz. No ejecutar en un directorio que contenga secretos.

```sh
/Applications/Docker.app/Contents/Resources/bin/docker --context desktop-linux run --rm --network none --mount type=bind,src=/private/tmp/abilene-phase43-edge-runtime,dst=/work -w /work -e DENO_DIR=/work/edge-cache supabase/edge-runtime@sha256:edd22bef4477b900d5c300e287ce9b18bff9b81a0291bee14ee0b7c7b71a2899 start --ip 127.0.0.1 --main-service /work/main
```

El main dispara una solicitud loopback y escribe PHASE43_RESULT con los 51 resultados; el servidor permanece activo hasta detenerlo. Los experimentos usaron --rm -d con nombre de fase, docker logs para capturar y docker stop --timeout 1 para cerrar. Se leen las filas JSON; exit code del servidor no define aceptación.

```sh
/Applications/Docker.app/Contents/Resources/bin/docker --context desktop-linux run --rm --network none --mount type=bind,src=/private/tmp/abilene-phase43-edge-runtime,dst=/work -w /work -e DENO_DIR=/work/edge-cache supabase/edge-runtime@sha256:edd22bef4477b900d5c300e287ce9b18bff9b81a0291bee14ee0b7c7b71a2899 bundle --entrypoint /work/user/matrix-index.ts --output /work/matrix.eszip --static '/work/user/downloads/*' --static /work/user/official-jws-tests.ts --checksum sha256 --timeout 20
```

## Hashes y evidencia

Material público reutilizado (comprobado contra Fase 42 antes de adaptar el arnés):

| Archivo | SHA-256 |
|---|---|
| deno-results.json | ec0cce643c6b5ddf65c38be0b26e3ec2bc23429d3cdf3f8f8678a764de77794d |
| dependency-comparison.json | ef4c011b661194b69fdc42a18d560d30d0c3e7ed2a7746d840e1e433641e3ab1 |
| downloads/AppleIncRootCertificate.cer | b0b1730ecbc7ff4505142c49f1295e6eda6bcaed7e2c68c5be91b5a11001f024 |
| downloads/AppleRootCA-G2.cer | c2b9b042dd57830e7d117dac55ac8ae19407d38e41d88f3215bc3a890444a050 |
| downloads/AppleRootCA-G3.cer | 63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179 |
| downloads/appTransaction.json | 970a96a5b49873265e7bac3ee72c12a82bf2faf02750fdff08336ee52197aad0 |
| downloads/legacyTransaction | c89576769b0c418d867eb9bbb6e16316ded4b9177c2e5e857917fab3665d837b |
| downloads/missingX5CHeaderClaim | 8fb8c5b52328adc06c3938268d3d7cca5fd1c27b2f590ddbb364a588dc43f5b2 |
| downloads/official-real-apple-intermediate.der | bdd4ed6e74691f0c2bfd01be0296197af1379e0418e2d300efa9c3bef642ca30 |
| downloads/official-real-apple-leaf.der | 4c381556c16121e605d1fc2eef6d0de4e072ed65964fe72f575f19711e84c417 |
| downloads/renewalInfo | d9b9f1e70277de27e73b1d0dd42558b62e29631c0dc094ebb65067991e66c71d |
| downloads/testCA.der | 48aa70550eab2cd71d51dced44e88f9143b6bc0e1a6f430c19ba9a7cf36654e6 |
| downloads/testNotification | e1fc5e5795383a5d672a3f355b86407c95a0eb01eb35397dee7e6d76270ef579 |
| downloads/transactionInfo | 6f3027507d63abc7736c14642c7aa2ccc978510cba6f0d09244e657293ea7ce6 |
| downloads/wrongBundleId | 5c79fcc46ce9bcc6f5b701ab83a63a17f7e1eb7d77fbf45cfb11aec637b4ef19 |
| node-results.json | a47e0dfd7fe5737d53335393606f503ecf245507cbc600f1b7862d7d3acb91c2 |
| official-jws-tests.ts | ea6862ff1a95e1558a3b4927ef45dcbd10780fc2f22de6d967f55f71a73da932 |
| probe.mjs | b4e16d4783843d4788e2885e207b5462e4692fc4a6343432be98d1223c0b6f4e |
| run.mjs | 627e8b72c9098b863a3e512a175bc1f02df40f18d84611055280bb2579c59468 |

Evidencia final, exclusivamente temporal:

| Archivo | SHA-256 |
|---|---|
| release.json | d00cb7bb9b97363e8d13654e9d00254b874bdf43faa11e7d2e0a468c5f137a24 |
| official-compose-source.yml | f6724c97f1ca555b700f5ecf630e8a2e5114682b64ca94158061326187139183 |
| official-main.ts | 78653593ac846a89b61d220f42e5a25c0b62b793ebdcfefd49e0bffc84f608cf |
| Cargo.toml | d250abccf971d92187347f1253b697cfa1f3aefc796c81b1dcb785c0fbf9bf52 |
| main/index.ts | 9356ba7eb7b095a296c1a74be6378afc2ffc5f8d40c2f4b52c7936535c542b41 |
| user/index.ts | 3538de3dac98f67b0a1a4e54536994bafed6dab78cefeeb331ff30426f44c8b3 |
| user/matrix.mjs | 3ed0de3d330b6a8a829d4ff63ab4a7923eca4ae9089b93f7f6469a6c88bbb0ba |
| user/diagnostic.mjs | edfec05c967092f1fa92a427f40398eaa8a306c91504d55083d792d21d3216c0 |
| minimal-final.log | f223bc60888c7f78387a35d5d0a7948c702a3236282052dba31205c17f7a541f |
| edge-results.json | 6340bef225f1fd3345430bd6a5ca98840c315279e31c765833246e45860c6da0 |
| edge-diagnostic.json | 182afd88054186b040a93d3a8ff5a8bf0ddda385dc2997228da4064d56828de7 |
| missing-import.log | 4f051fe058cf77467c45ca9d6d7c83c1a500a53a7980e7b2f9421635b6b3d778 |
| edge-dependencies.json | 569b77b26d160ca4066495e26c7f0c94cdb7644b23ae2eef8f804cc6ff665d69 |
| npm-cache-hashes.json | 4a0b0b76504fbba4632cb92bb3018de0d4a575186a7c03682ff303cfd34642c0 |
| matrix.eszip | bf80533fbdcccfc44c415ad996abbf037eb759ac683e3dc9bcfeedcff5751ec9 |
| project-tests.tap | 0d5857e93aa67694afebed070af33c934ce48eef1e35c1548b077fd1096a54ba |
