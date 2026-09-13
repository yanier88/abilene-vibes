# Fase 49 — preparación de captura Sandbox física

**Actualización mientras Apple está Pending:** la membresía fue pagada según confirmación del usuario; no repetir inscripción ni pago. El siguiente acceso manual a App Store Connect queda suspendido hasta la activación. La continuación vigente, build guard, auditoría y checklist están en [phase49-local-hardening-pending.md](phase49-local-hardening-pending.md). Los resultados de 81 tests más abajo son el registro de la primera parte, no el total actualizado.

## Resultado

**C — LOCAL_CODE_READY_APPLE_CONFIGURATION_REQUIRED.** Código preparado y validado localmente; sin build instalable, instalación, lanzamiento nuevo, autenticación Apple o compra. No equivale a ruta física validada. Fases 41–47 permanecen cerradas: `EXTERNAL_OCSP_BOUNDARY_PENDING_REAL_EVIDENCE` / `WAIT_FOR_MATCHED_REAL_APPLE_EVIDENCE`.

Base comprobada: main, HEAD y origin/main local `305855a2799e87629442a08bb42b9fe6f04ca021`, árbol limpio y nada staged. Sin fetch.

## Frontera nativa

El servicio, plugin, wrapper JS, catálogo, scheme y gates del laboratorio Xcode quedan intactos. Sus `getProducts`, `purchase` y `syncPurchases` siguen exigiendo `verifiedXcode()`. El verificador de delivery no configurado sigue devolviendo false y la única llamada existente a `transaction.finish()` permanece en el método explícito original.

La nueva ruta es nativa e independiente. `SandboxPhysicalCapture.swift` solo compila bajo `DEBUG && os(iOS) && !targetEnvironment(simulator)`. Requiere:

- Scheme nuevo `AbileneSandboxCapture`, Run Debug, sin archivo StoreKit Configuration.
- Argumento `--abilene-sandbox-capture`.
- Variable de lanzamiento `ABILENE_SANDBOX_CAPTURE=CAPTURE_ONLY_SANDBOX`.
- Ausencia del argumento y marcador web del laboratorio Xcode.
- Bundle exacto `com.abilenevibes.app`.
- AppTransaction verificada por StoreKit, del mismo bundle y environment exactamente Sandbox.
- Producto mensual auto-renovable del slot01 permitido y devuelto por StoreKit. Los productos encontrados deben compartir un grupo.
- Confirmación manual en pantalla y una sola tentativa de compra por proceso.

No se usa el nombre del receipt ni un decode de JSON como prueba de entorno. Si AppTransaction no está disponible, no es verificable o no es Sandbox, se bloquea la compra. No hay fallback; ese caso necesita evaluación con la evidencia real, no relajar el gate.

La AppTransaction se comprueba nuevamente y se guarda antes de llamar a Product.purchase. El resultado de compra debe estar verificado, pertenecer al mismo producto/bundle/entorno y conservar el token de correlación de esa tentativa. Ese UUID no es identidad ni autorización de un listing.

La pantalla normal no se carga en esta ruta: el override de `viewDidLoad` retorna antes de `CAPBridgeViewController.viewDidLoad`, que carga el contenido web. Capacitor puede inicializar su contenedor, pero no se navega al frontend; la captura no importa ni invoca Supabase, backend Apple o promociones. La ruta normal sigue llamando al método original.

Botones: verificar Sandbox/cargar productos, compra manual, currentEntitlements/unfinished, Restore/AppStore.sync, iniciar Transaction.updates y detener listener/mostrar ubicación. No hay botón ni API de finish en el capturador. No hay compra o sync al arrancar. No se exponen JWS mediante JS, logs, portapapeles o UI.

## Archivos

- Modificado `ios/App/App/AbileneBridgeViewController.swift`: selección nativa del capturador en Debug físico; funcionamiento normal conservado.
- Modificado `ios/App/App.xcodeproj/project.pbxproj`: ocho líneas aditivas para registrar los dos archivos Swift; sin cambios de signing, assets, capabilities o configuración Fase 48.
- Nuevo `ios/App/App/SandboxCaptureGate.swift`: política nativa y empaquetado de evidencia.
- Nuevo `ios/App/App/SandboxPhysicalCapture.swift`: sesión StoreKit y pantalla nativa.
- Nuevo `ios/App/App.xcodeproj/xcshareddata/xcschemes/AbileneSandboxCapture.xcscheme`.
- Nuevos `tests/apple-iap/SandboxCaptureGateTests.swift` y `tests/apple-iap/phase49-boundary.test.mjs`.
- Este documento.

## Captura y límites

Archivos JSON independientes bajo `tmp/abilene-sandbox-<UUID>/` en el contenedor privado del iPhone. Directorio 0700, archivos 0600, protección completa iOS, escrituras atómicas y exclusión de backup. El sistema puede purgar tmp: exportar inmediatamente después de la captura a un directorio privado temporal del Mac, fuera del repo. No habilitar File Sharing ni subir la evidencia.

Se conserva la JWS completa original, x5c exacta, SHA-256 de cada certificado DER y metadatos:

- Transaction: productID, transactionID, originalID, purchaseDate, signedDate, environment, bundle, appAccountToken y group si existen, fuente de observación.
- AppTransaction: bundleId, environment, appVersion, originalAppVersion, signedDate, appTransactionId disponible, versión iOS y build.

El empaquetado extrae el header; NO verifica cadena, certificados ni OCSP. La etiqueta de evidencia distingue StoreKit verified de aprobación server/OCSP. No se fabricó ninguna evidencia Apple positiva.

Tras una captura real y exportación, queda pendiente inspeccionar DER para subject/issuer/serial/AIA y aplicar exclusivamente la frontera OCSP externa ya diseñada a la misma cadena. No se consultó OCSP, no se reconstruyó el laboratorio y no se ejecutó la composición. Los antiguos workspaces 41/44/46/47 no aparecieron en el inventario de `/private/tmp` de esta sesión: no suponer que el candidato temporal sigue disponible; recuperar su artefacto preservado cuando sea necesario, sin iniciar otra investigación general.

Los cinco criterios permanecen **SKIP, sin evidencia emparejada**: GOOD positivo, expirado rechazado, futuro rechazado, firma OCSP alterada rechazada y timeout después de binding correcto rechazado.

## Signing, build y dispositivo

Signing automático, team `9M4D5738F9`, bundle `com.abilenevibes.app`, deployment target 15.0. La captura requiere iOS 16+ y se bloquea en versiones anteriores. No hay declaración local explícita de In-App Purchase capability ni archivo .entitlements; no se infiere de ello el estado remoto del App ID. No se añadió ninguna capability ni se alteraron profiles/certificados. StoreKit ya está utilizado por el proyecto y su importación resuelve en el SDK disponible.

La inspección de entorno devolvió **VITE_SUPABASE_URL: MISSING** y **VITE_SUPABASE_ANON_KEY: MISSING**. Solo se encontró `.env.example` como archivo de entorno del repo. No se imprimieron valores ni se buscaron secretos en otros lugares. Conforme a la orden: **sin npm build, build instalable iOS, sync ni instalación**. La comprobación `swiftc -typecheck` no enlaza ni firma una app; los ejecutables de tests son para macOS y se generan únicamente en `/private/tmp/abilene-phase49-checks/`.

Inventario CoreDevice de solo lectura, tras autorización para salir del sandbox de herramientas: iPhone 16 Pro Max, iOS 26.6.2 (23G90), físico/conectado por cable, Developer Mode ya enabled. App instalada: `com.abilenevibes.app`, versión 1.0, build 1. No se comprobó su configuración de compilación efectiva. No se abrió, borró ni reinstaló. CoreDevice activó sus servicios de developer disk image durante la consulta de apps; no hubo cambios de cuenta, profiles o certificados.

## App Store Connect: punto de parada manual

No se puede determinar localmente si existe el registro de app, los productos o un Sandbox tester. No se entró en ninguna cuenta.

**Acción inmediata única:** el usuario abre App Store Connect → Apps → Abilene Vibes → App Information y muestra una captura del Bundle ID y del estado del registro, ocultando información personal. Si no aparece la app, mostrar la lista antes de crearla. No enviar contraseñas, códigos ni claves. Esta es una inspección manual, no autorización para crear productos o guardar precios.

Secuencia posterior, condicionada a revisar esa pantalla y a la autorización del usuario:

1. Confirmar registro iOS y Bundle ID exacto; si no existe, preparar registro con nombre, idioma principal, bundle y SKU elegidos antes de guardarlo. Comprobar la alineación con el team y el App ID.
2. El titular comprueba membresía activa y Paid Applications Agreement. Cualquier aceptación legal, solicitud bancaria/fiscal o permiso se detiene para el usuario; no se realiza automáticamente.
3. Apps → Abilene Vibes → Monetization → Subscriptions: inspeccionar grupos existentes. Mínimo propuesto: un grupo de referencia `promotion_slot_01`, con Premium nivel 1 y Featured nivel 2. No copiar UUIDs del archivo .storekit: Apple asigna el identificador real del grupo.
4. Dentro de ese grupo, revisar o preparar dos productos auto-renovables de un mes:
   - `com.abilenevibes.app.promotion.slot01.featured.monthly`, referencia `Slot01 Featured Monthly`, nombre localizado `Featured`, objetivo USD 24.99/mes.
   - `com.abilenevibes.app.promotion.slot01.premium.monthly`, referencia `Slot01 Premium Monthly`, nombre localizado `Premium`, objetivo USD 67.99/mes.
5. Verificar nombre de referencia, Product ID, nombre localizado y precio (mínimo Sandbox documentado por Apple); duración mensual, localización del grupo/producto y disponibilidad correspondiente al storefront de prueba. Preparar descripciones veraces. No guardar precios ni cambiar disponibilidad existente sin autorización. La metadata de revisión/screenshot corresponde al envío y no debe confundirse con exigir un binario publicado para Sandbox.
6. Users and Access → Sandbox: inspeccionar testers. Si hace falta crear uno, el usuario completa los campos del formulario y las credenciales, usando un email no asociado previamente a una Apple Account. Se detiene ante cualquier autenticación o permiso. El inicio de sesión del dispositivo debe usar la opción Sandbox; no cerrar la cuenta personal principal.
7. Una vez resuelta Apple y presentes las dos variables de build, verificar signing/capability IAP con el usuario antes de cualquier cambio de perfil. Compilar e instalar únicamente iOS conservando datos; seleccionar `AbileneSandboxCapture`, Run Debug, StoreKit Configuration None. Si aparecen Keychain, Apple ID o cambios de perfiles, detenerse antes de aceptar.
8. El usuario inicia la verificación en la pantalla nativa. Solo si aparece Sandbox verificado y un producto visible se prepara la primera compra. El usuario confirma la pantalla Apple Sandbox manualmente. Si falta esa identificación, cancelar y detenerse.

No se requieren 20 productos para esta captura ni un segundo grupo. No hay un catálogo remoto separado creado por la app: Sandbox consulta los productos de App Store Connect. No publicar ni enviar a revisión en esta fase.

Fuentes oficiales consultadas el 13-09-2026, exclusivamente para preparación Sandbox:

- [Apple: preparación Sandbox](https://developer.apple.com/documentation/storekit/testing-in-app-purchases-with-sandbox): membresía, acuerdo, metadata mínima, tester, Developer Mode y desarrollo sin subir binario.
- [Apple: grupos y productos](https://developer.apple.com/help/app-store-connect/manage-subscriptions/offer-auto-renewable-subscriptions/): un grupo y niveles; creación, duración, precio y disponibilidad. Apple advierte que metadata puede tardar hasta una hora en reflejarse en Sandbox.
- [Apple: datos de suscripciones](https://developer.apple.com/help/app-store-connect/reference/in-app-purchases-and-subscriptions/auto-renewable-subscription-information): nombres, niveles y duraciones.
- [Apple: Sandbox Apple Accounts](https://developer.apple.com/help/app-store-connect/test-in-app-purchases/create-a-sandbox-apple-account): creación y separación de la cuenta personal.

## Validación

- Política Swift Sandbox y rechazo de sobres malformados: **27 PASS**. Se prueba la política usada por el código, no compras ni firmas Apple reales.
- Seguridad Swift original del laboratorio: **26 PASS**; sin StoreKit, SKTestSession ni investigación de finish.
- Node: phase49-boundary, phase35-hardening, native-bridge y local-screen: **28 PASS**, sin fail/skip. Incluye checks de código, preservación de archivos y modelos; no son 28 pruebas físicas.
- Total automatizado: **81 PASS, 0 FAIL, 0 SKIP**. Separadamente, los cinco criterios OCSP están SKIP/no ejecutados por falta de evidencia.
- Typecheck Swift con SDK iOS: capturador Debug físico aprobado. También aprobado el conjunto completo de bridge/plugin/servicio/gates/capturador con target iOS 15 y Swift 5, tanto con DEBUG como sin DEBUG (Release). Se utilizaron los frameworks Capacitor/Cordova locales existentes; no se compilaron, descargaron ni firmaron dependencias.
- `plutil -lint` del proyecto y `git diff --check`: aprobados.

No se afirma validación de UI física, permisos efectivos de los archivos en el iPhone, catálogo remoto, AppTransaction real, compra, firma server o OCSP. Son pendientes del siguiente paso autorizado.

## Riesgos de distribución futura

Esta pantalla es un instrumento de Debug, no checkout comercial. No proporciona delivery/finish ni el flujo final de términos/privacidad/gestión de suscripción. No debe exponerse en una distribución. El precio mostrado viene de StoreKit; los precios reales no están comprobados. El soporte del flujo final en iOS 15 también queda pendiente. No se evaluó ni modificó la UI Fase 48.

## Integridad y límites

Sin cambios Android, Stripe, backend Apple, SQL, migraciones, workflows, frontend Fase 48, icono o weather. Los tres handlers conservan POST 503 APPLE_BACKEND_NOT_CONFIGURED por inspección local. Cero Supabase/producción, compras, OCSP, App Attest, TestFlight, deploy, stage, commit o push.
