# Fase 49 — hardening local mientras Apple Developer está Pending

## Estado y alcance

**C — LOCAL_CODE_READY_APPLE_CONFIGURATION_REQUIRED**, con hardening local preparado. El usuario confirma pago US$99, autenticación, “You're all set” y cuenta Pending con aviso de hasta 48 horas. No se verificó ni modificó la cuenta. No repetir inscripción o pago. Solo Apple puede activar la membresía; ningún cambio local resuelve Pending. No se declara Sandbox funcionando, IAP terminado ni App Review ready.

Antes de editar: status, branch, HEAD, origin/main, diff --check e inventario completo. Main y ambas referencias locales en `305855a2799e87629442a08bb42b9fe6f04ca021`; sin staged ni cambios inesperados. Ocho archivos Fase 49: dos tracked modificados (bridge controller y project.pbxproj) y seis nuevos (scheme, gate, capturador, dos tests y documento). Se conservaron.

## Auditoría de los ocho archivos

- `AbileneBridgeViewController.swift`: la selección requiere Debug/dispositivo; retorna antes del método Capacitor que carga la web. En lanzamiento normal conserva super.viewDidLoad. No carga promociones/frontend en modo captura. No changes de Fase 48.
- `project.pbxproj`: únicamente ocho líneas aditivas de registro Swift. Settings, signing, team, bundle, catálogo, recursos e icono permanecen como el checkpoint.
- `SandboxCaptureGate.swift`: opt-in, bundle y entorno exactos; Production/Xcode/no verificado rechazan. El empaquetado de header no se confunde con verificación criptográfica. Hashes DER y JWS original preservados.
- `SandboxPhysicalCapture.swift`: toda la implementación bajo DEBUG+iOS+dispositivo; no API de finish, backend ni JS. Operaciones StoreKit solo después de acción manual. Captura nativa de AppTransaction antes de purchase.
- `AbileneSandboxCapture.xcscheme`: Run Debug, opt-in explícito, sin StoreKitConfigurationFileReference, entrada buildForArchiving NO.
- `SandboxCaptureGateTests.swift`: ejecuta política Swift real con valores de prueba; no fabrica JWS positiva ni compra.
- `phase49-boundary.test.mjs`: verifica límites, composición cerrada y conservación byte a byte de servicio/plugin/gate/scheme Xcode/wrapper/entrada web.
- `phase49-physical-sandbox-preparation.md`: conserva la primera etapa histórica y remite a esta continuación mientras Pending.

Defecto corregido: `purchaseAttempted` se marcaba después de `await verifyApp`. MainActor puede reentrar durante ese await, permitiendo dos llamadas que pasaron la primera comprobación. Ahora una reserva síncrona `SandboxCaptureAttempt.reserve()` sucede ANTES del primer await de compra. No se libera automáticamente tras fallo, cancelación o preflight rechazado: una tentativa por sesión. No garantiza límite persistente entre relanzamientos; operativamente no relanzar para volver a comprar, recuperar unfinished primero.

También se comprueba cancelación al volver de AppTransaction.shared y antes de capturar/reportar una actualización. Un listener detenido no continúa ese resultado suspendido. Ninguna corrección relaja gates ni introduce delivery/finish.

## Build guard iOS

Nuevos comandos, sin alterar `npm run build`, build:github, build:admin, build:android, Vite config o workflows:

```sh
npm run build:ios
npm run prepare:ios
```

`build:ios` ejecuta preflight → Vite → postflight; no copia ni instala.
`prepare:ios` ejecuta el mismo flujo y SOLO al aprobar llama al CLI ya instalado con `copy ios`. No ejecuta sync, Android, Xcode, signing, instalación, Archive o Upload. No utiliza npx ni instala paquetes. No ejecutar un cap copy manual para saltarse el guard.

Implementación: `scripts/ios-build-guard.mjs`; tests: `tests/ios/build-guard.test.mjs`. No hay nuevas dependencias ni cambios de lockfile.

Preflight:

1. Lee variables VITE de los archivos de modo production mediante Vite; el entorno de shell tiene prioridad, incluso cuando es explícitamente vacío. `.env`, `.env.*` y `.local` ya están ignorados por Git. No se creó un archivo con credenciales.
2. Rechaza ausencia, vacío y whitespace. Recorta espacios exteriores antes de compilar.
3. Exige HTTPS, host y URL raíz sin credenciales, query ni fragment; no fija un host Supabase concreto. Normaliza al origin que se compilará.
4. Acepta estructura `sb_publishable_…` o JWT HS256 con role anon y firma de longitud/formato compatible. Rechaza `sb_secret_…`, service_role, roles distintos, truncamientos y formatos arbitrarios. No verifica firmas JWT, pertenencia al proyecto ni vigencia/autorización remota.
5. Rechaza el flag del laboratorio Xcode en este flujo normal/Sandbox físico. El laboratorio anterior conserva su propio procedimiento; no se debilita.
6. Solo después inicia Vite con valores validados explícitos y flag local false. No sourcemaps. El build usa dist, igual que el webDir configurado.

Postflight:

- Parte del script entry de index.html y recorre imports/dynamicImports del resultado real del build.
- Exige que el módulo `src/App.jsx` sea alcanzable y que su chunk contenga ambas configuraciones esperadas.
- Compara el JS escrito en disco con el emitido por ese build. No basta una constante en un archivo huérfano, un marker o un bundle antiguo.
- Rechaza chunks ausentes/inconsistentes, paths inesperados y marker Xcode.
- Solo con éxito permite copy ios dentro de prepare:ios.

Salida del guard: únicamente `URL PRESENT/MISSING/INVALID` y `KEY PRESENT/MISSING/INVALID`. No valores, hashes obligatorios, errores Vite, stdout/stderr de Capacitor ni secretos. PRESENT significa validación estructural/incorporación; NO conexión exitosa a Supabase.

Códigos de salida: 0 aprobado; 2 preflight/lectura de configuración; 3 build fallido; 4 postflight; 5 copy fallido; 6 argumentos inválidos; 7 flag local Xcode incompatible. Un fallo de compilación puede imprimir PRESENT para las dos variables y aun así salir 3: los estados describen configuración, no reemplazan el exit code. Nunca continuar ante exit no cero.

Alcance: protege estos comandos iOS, no impide que una persona invoque directamente otro build/copy o Xcode. No es una prueba de disponibilidad de Supabase ni de concordancia URL↔key. No se usaron credenciales reales ni se compiló la app del repositorio en esta continuación. Solo se compiló un fixture mínimo y desconectado con datos ficticios bajo un temporal.

## Checklist cuando Apple active — sin ejecutar ahora

Esta checklist utiliza código y documentos locales ya existentes. No se consultaron nuevas páginas Apple. Las restricciones de edición que no están acreditadas localmente deben confirmarse en la UI antes de guardar; no se promete reversibilidad.

### A. Registro de app

- Confirmar que desapareció Pending. No volver a inscribirse ni pagar.
- Abrir manualmente App Store Connect → Apps. Buscar registro existente antes de crear otro.
- Nombre esperado: **Abilene Vibes**. Plataforma: **iOS**. Bundle ID: **com.abilenevibes.app**.
- SKU propuesto: **abilene-vibes-ios-001**; candidato, no existente ni creado.
- Idioma principal propuesto: English (U.S.), sujeto a revisión del usuario.
- Revisar nombre, plataforma, idioma, bundle, SKU y acceso de usuarios antes de pulsar Create.
- Tratar SKU y selección de identidad/bundle como definitivos para este proyecto; no proponer renombrar bundle ni reutilizar SKU sin revisar las restricciones de la interfaz. No subir un build para “probar” editabilidad.
- Nombre visible y metadatos/localizaciones pueden prepararse para cambios posteriores sujetos a las reglas/estado del registro; no usarlos para corregir una identidad errónea.
- El usuario verifica estado de membresía/acuerdos. Contratos, fiscalidad, banco, certificados o perfiles requieren su intervención; no aceptar automáticamente.

### B. Suscripciones/IAP mínimos

Todo es CANDIDATO hasta comprobar App Store Connect:

| Campo | Featured | Premium |
|---|---|---|
| Product ID | com.abilenevibes.app.promotion.slot01.featured.monthly | com.abilenevibes.app.promotion.slot01.premium.monthly |
| Referencia | Slot01 Featured Monthly | Slot01 Premium Monthly |
| Tipo/duración | Auto-renovable / 1 mes | Auto-renovable / 1 mes |
| Nombre localizado en_US | Featured | Premium |
| Nivel propuesto | 2 | 1 |
| Objetivo USD | 24.99/mes | 67.99/mes |

Grupo único candidato: referencia `promotion_slot_01`, nombre visible propuesto `Business Promotion`. No crear segundo grupo ni veinte productos. Apple asignará el group ID real; jamás copiar el UUID del .storekit local.

Campos que revisar/preparar: nombre de referencia del grupo; localización/nombre visible del grupo y opción de nombre de app; referencia y Product ID de cada producto; duración; nivel; al menos localización de nombre/descripción; precio/base territory/moneda; disponibilidad para storefront de prueba; información/screenshot/notas de revisión cuando corresponda al estado del formulario. Propuestas de descripción: `Featured business promotion for one month` / `Premium business promotion for one month`. Revisión comercial pendiente; no prometer entrega en la prueba de captura.

Identidad irreversible o a congelar: Product IDs y grupo al que se asigna cada producto deben revisarse antes de crear; NO asumir que pueden renombrarse o moverse después. Tratar SKU como definitivo. No se acredita aquí toda restricción vigente de Apple sobre bundle, grupo, tipo y duración: confirmar UI y detenerse ante duda.

Editables como metadatos/operación, sujetos a estado y revisión: referencias, nombres/descripciones localizados, precios programados, disponibilidad y niveles. Que exista edición no autoriza a cambiar precios o condiciones de suscriptores. Duración/tipo y Family Sharing no se tratarán como toggles reversibles sin comprobar sus restricciones.

NO guardar sin revisión del usuario: Create app/group/product, IDs, duración/grupo/niveles, precios, disponibilidad, Family Sharing, acuerdos, submit/add for review o cualquier cambio de perfil. Preparar campos no significa autorización para guardarlos.

### C. Sandbox tester

- Users and Access → Sandbox: comprobar primero testers existentes.
- Si se necesita otro: nombre, apellido, email dedicado no asociado a Apple Account, contraseña/confirmación y cualquier dato adicional obligatorio del formulario, como territorio o fecha de nacimiento si aparece.
- El usuario elige e introduce datos/credenciales; no enviarlos al chat ni guardarlos en repo. Tratar nombre/email/contraseña elegidos como definitivos; confirmar opciones de edición/recuperación en la UI.
- Revisar storefront USA para cotejar los objetivos USD; no confundir moneda de otro storefront con precio incorrecto.
- Iniciar sesión únicamente en la opción Sandbox del dispositivo. No cerrar ni sustituir la cuenta personal principal.
- No borrar historial de compras ni recrear tester para forzar resultados.
- Detenerse ante autenticación, permiso, contrato o pantalla Apple inesperada.

### D. Recorrido físico exacto

Apple Active → registro App Store Connect verificado → grupo/productos con datos completos visibles en ASC → variables build presentes → `npm run prepare:ios` (preflight → build seguro → postflight → cap copy ios) → build Debug físico con AbileneSandboxCapture y StoreKit Configuration None → instalación conservando datos → pantalla de captura → AppTransaction verificada Sandbox → producto realmente visible mediante StoreKit → confirmación manual del usuario → máximo una tentativa → captura → detener listener y exportar inmediatamente al Mac fuera del repo.

“Productos visibles en ASC” y “producto visible en StoreKit” son comprobaciones distintas: la segunda sucede después de instalar. No exigir una lectura StoreKit desde una app todavía no construida.

Si falta variable o falla cualquier salida del guard: no copy ni instalación. Si aparece Keychain/Apple ID/certificado/profile: detenerse antes de aceptar. Si AppTransaction falta/no es Sandbox o el producto no aparece: no comprar. Si la hoja Apple no identifica prueba Sandbox: cancelar. Ninguna autorización de captura permite delivery/finish.

Exportación futura: botón Stop Updates / Show Capture Location → identificar exactamente `tmp/abilene-sandbox-<UUID>/` → preparar directorio temporal del Mac con permisos privados fuera del repo → transferir únicamente esa carpeta mediante herramientas de desarrollo ya autorizadas → verificar inventario/hashes localmente sin imprimir JWS/token → no eliminar originales antes de confirmar copia. No File Sharing, nube, Supabase, repositorio, portapapeles ni publicación. No se realizó ninguna transferencia en esta continuación.

## Evidencia y seguridad

Transaction conserva productID, transactionID, originalID, purchaseDate, signedDate, environment, bundleId, appAccountToken opcional y JWS original. AppTransaction conserva bundleId, environment, appVersion, originalAppVersion, signedDate, appTransactionId disponible y JWS original. x5c conserva strings originales y SHA-256 de los DER.

La sesión nativa guarda solo evidencia StoreKit verificada en su scope Sandbox, en tmp privado con 0700/0600, completeFileProtection, escritura atómica y exclusión de backup. UI/logs no imprimen JWS o tokens. No hay envío a JS, frontend, Supabase o backend. No hay derechos ni finish. Los archivos temporales se pueden purgar: exportación pronta obligatoria. No se acredita protección/transferencia en dispositivo hasta probarla físicamente.

No se generó JWS positiva, no se consultó OCSP, no se reconstruyó la investigación ni se introdujeron certificados/secretos reales al repo. Las claves del test de build son públicas ficticias con dominio .invalid; el JWT ficticio de test comprueba únicamente forma/role, no firma ni Apple.

## Auditoría estática para distribución futura

Es una auditoría del código actual, no una certificación legal o de reglas actuales de App Review.

| Aspecto | Estado | Evidencia y límite |
|---|---|---|
| Pantalla nativa Sandbox en Release | PASS | Compile guard y typecheck sin DEBUG; selección no existe en Release. |
| Laboratorio Xcode en frontend mal empaquetado | RISK | src/main.jsx:14 depende del flag web, no de la configuración nativa Release. Un build genérico marcado podría mostrar pantalla bloqueada de laboratorio. El nuevo flujo iOS rechaza ese flag; no se cambió el laboratorio. |
| Compra/Restore del capturador | PASS | Acciones manuales, gates y reserva previa al await; sin finish/delivery. No prueba física. |
| Checkout comercial externo en iOS | BLOCKER | src/App.jsx:52 y :3324, :8337, :8404, :9377 usan create-checkout-session/openCheckoutUrl sin exclusión iOS. Bloquea considerar terminado el flujo Apple previsto; no se ejecutó ni modificó Stripe. |
| Precios comerciales hardcodeados | RISK | src/App.jsx:879/:885, :7249, :8481/:8496, :10365 conservan $19/$59; capturador usa Product.displayPrice. Web/Android intactos. |
| Textos de suscripción | RISK | src/App.jsx:931/:936 describen precios anteriores y Stripe. No son los textos definitivos de Apple IAP. |
| Términos/privacidad internos | PASS | Rutas terms/privacy y renderer :12435 existen. Adecuación del contenido Apple pendiente; no se afirma revisión legal. |
| Enlaces externos rotos | RISK | No se comprobaron servicios externos; helpers Website/Directions pasan pruebas locales. No se halló href vacío/# en la búsqueda dirigida. |
| Placeholders | RISK | Formularios contienen ejemplos legítimos; src/App.jsx:417–506 incluye datos de muestra/fallback. Falta QA física final para determinar su exposición, sin modificar contenido. |
| Permisos declarados | RISK | No se añadieron permisos sensibles/capabilities; Info.plist conserva UIRequiredDeviceCapabilities armv7 heredado. Revisar necesidad antes de distribución, sin cambio aquí. |
| APIs privadas | PASS | No se identificaron en Swift propio inspeccionado; no certifica todas las dependencias. |
| Disponibilidad iOS 15 | PASS | Typecheck con target 15 en Debug y Release. Capturador exige iOS16 y muestra bloqueo en 15. Producto final con IAP funcional en 15 continúa pendiente. |
| Elusión deliberada mediante nueva captura | NOT_APPLICABLE | Captura no ofrece checkout externo ni entrega; el flujo comercial heredado se reporta aparte. |

## Validación y resultados de esta continuación

- Swift Sandbox: **30 PASS** (incluye reserva de tentativa).
- Swift seguridad lab original: **26 PASS**.
- Node Fase 49/regresión del laboratorio: **29 PASS**.
- Build guard: **26 PASS**, incluido build Vite real de fixture temporal offline con configuración ficticia; copy es un doble de prueba, nunca cap copy real.
- Fase 48: **36 PASS** unitarios de enlaces/weather + **12 PASS** de layout con evidencia nueva del navegador local. Total **48 PASS**, sin tocar iPhone.
- Total automatizado: **159 PASS / 0 FAIL / 0 SKIP**. No sumar otra vez ejecuciones de desarrollo.
- Separadamente: **6 comprobaciones pendientes SKIP**: adquisición física Sandbox (grupo) y cinco criterios de composición OCSP. No se ejecutaron ni se fabricó TAP para ellos.
- Typecheck Swift de conjunto nativo con target iOS15, Debug y Release: PASS. Scoped ESLint scripts/tests: 0 errores/0 warnings. Sintaxis Node, plist/XML y diff/whitespace revisados.

Durante desarrollo, el primer build del fixture falló por la diferencia macOS entre /var y /private/var en el root de Vite. Se normalizó el root con realpath y el test real pasó. No era un fallo de credenciales ni se ocultó como SKIP.

Weather utilizó el harness existente en loopback 127.0.0.1:8768, con autorización tras EPERM del sandbox. El navegador mostró 12/12 PASS y guardó results.json con hashes de los fuentes actuales; el test existente verificó esos hashes. Se cerraron la pestaña temporal y el servidor. Sin cargar la app web ni consultar producción.

Artefactos de comprobación nativa: `/private/tmp/abilene-phase49-checks/`. Evidencia del harness: `/private/var/folders/cx/skg3d9d56y3951pzbm3f5v2w0000gn/T/abilene-weather-layout/results.json`. Ninguno contiene una compra Apple real.

## Git, checkpoint y siguiente paso

Sin stage, commit, push, deploy, Android, Stripe, Supabase, cuentas Apple, segundo pago, compras, sync StoreKit, finish, OCSP, Archive/Upload o TestFlight. No build/install del iPhone. Fase 48, frontend, assets, signing, capabilities y backend permanecen intactos.

**Listo para checkpoint local: SÍ**, limitado al código/preparación y validación local descritos; no implica aprobación física ni comercial. No se hizo commit.

Cuando desaparezca Pending, el siguiente paso exacto es abrir manualmente App Store Connect → Apps y comprobar el registro Abilene Vibes y su Bundle ID antes de crear o guardar nada. No programar otro pago ni intentar arreglar Pending con código.
