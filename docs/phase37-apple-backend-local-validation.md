# Fase 37 — BLOQUEADA por falta de PostgreSQL local

Fecha local: 2026-09-08. Repositorio: `/Users/yanier/Documents/abilene-vibes`.
No se declara VALIDADA LOCALMENTE ni listo para Sandbox.

## 1. Estado inicial

HEAD y referencia local origin/main: `0e50e01ff9916345915678728f6ecbe131efb741` — Validate local StoreKit 2 bridge for iOS.
Rama main, sin diferencias tracked, sin staged y con exactamente los 14 archivos untracked de Fase 36. Se ejecutaron git status, git status -sb, git log -1 --oneline y git diff --check antes de editar. No hubo fetch: la igualdad con origin/main es respecto a la referencia local, no una comprobación del servidor.

Inventario SHA-256 inicial de 368 archivos tracked/untracked no ignorados: `/private/tmp/abilene-phase37-initial-sha256.json`.
SHA-256 del inventario: `ecca8e7ac4dc11cdc2ab87c614883e0eb71d979fdee481dcb7d1782b4b6cbd25`.
No se leyeron contenidos de archivos de secretos para configurar servicios.

## 2. Infraestructura

docker --version, docker compose version, psql --version, postgres --version, supabase --version y deno --version: command not found.
Node: `/usr/local/bin/node`, v22.23.2.
Tampoco se encontraron Docker.app, Postgres.app ni PostgreSQL/Supabase en las rutas habituales comprobadas bajo /Applications, /opt/homebrew, /usr/local y /Library/PostgreSQL. Esto no constituye un inventario exhaustivo de todos los discos.
No se encontró una vía local segura disponible. No se instaló software ni se arrancaron servicios. Parte SQL detenida conforme a la instrucción expresa.

## 3. Base temporal y prerrequisitos

No se creó DB. Método, versión PostgreSQL, host, puerto y credenciales: no aplican.
Revisión estática: se requiere schema public, roles anon/authenticated/service_role, PL/pgSQL y gen_random_uuid(). La RPC snapshot lee public.business_submissions, public.job_listings y public.rental_listings. No depende de auth.users ni advertiser_profiles.
Fixture mínimo propuesto, NO ejecutado: esas tres tablas con id UUID y status text; para representar conflictos, stripe_subscription_id, payment_status y placement_source text. Se accede a esos campos mediante to_jsonb. No reproduciría triggers, políticas, carreras Stripe ni todo el esquema existente; habría que declarar esa limitación al usarlo.

## 4. Migración

`supabase/migrations/202609080001_apple_iap_ledger.sql` no aplicada, ni local ni remotamente. Cero intentos de aplicación. BEGIN/COMMIT solo observados en el archivo; no hay evidencia de compilación, warnings ni objetos creados.
Sin correcciones. SHA-256 conservado: `075cac1fb838ed935b6de4aed9825dad47b12ef3d1aaac0d47e3224796fdd67e`.

## 5. Tablas, constraints, RLS, grants y RPC

Las 15 tablas están declaradas en el archivo, NO verificadas en PostgreSQL:
apple_buyers, apple_installations, apple_session_capabilities, apple_challenges, apple_product_catalog, apple_listing_authorizations, apple_purchase_intents, apple_slot_occupancies, apple_subscriptions, apple_subscription_assignments, apple_transactions, apple_notification_events, listing_promotion_entitlements, apple_deliveries y apple_ledger_revision.

Se revisaron la migración, los siete módulos compartidos y los tres entry points. Columnas/tipos/PK/FK/UNIQUE/CHECK/NOT NULL/índices/triggers, owners efectivos, RLS, policies y privilegios efectivos: PENDIENTES de introspección y pruebas SQL.
El texto habilita RLS, revoca privilegios a PUBLIC/anon/authenticated y define snapshot/CAS SECURITY DEFINER con search_path pg_catalog,public. Eso no prueba su seguridad efectiva.

Hallazgos estáticos que deben resolverse con PostgreSQL antes de Sandbox:
- GRANT ALL sobre las 15 tablas a service_role excede un contrato exclusivamente RPC. Con BYPASSRLS, como suele tener ese rol, permitiría escrituras directas y TRUNCATE fuera del CAS. No se ha probado con un rol real aquí.
- apple_transactions.subscription_id y apple_deliveries.assignment_id tienen FK simple; apple_challenges.installation_id tampoco vincula entorno. No todas las relaciones garantizan coherencia de entorno/comprador/cadena únicamente mediante FK.
- Los triggers son BEFORE UPDATE, no protegen DELETE/TRUNCATE. No prueban inmutabilidad frente a todas las operaciones concedidas.
- Deben inspeccionarse owner de las RPC y permisos CREATE del schema public para evaluar search_path y SECURITY DEFINER en el fixture real.
- Snapshot lee listings sin un protocolo compartido de exclusión con Stripe/moderación; la revisión del ledger no demuestra exclusión entre proveedores.

No se corrigieron esos puntos sin disponer del motor necesario para verificar la corrección. Son motivos adicionales para mantener el cierre, no resultados de ataques SQL ejecutados.

## 6. Roles

No hubo conexiones anon, authenticated ni backend/service. SELECT/INSERT/UPDATE del ledger y EXECUTE de RPC: NO PROBADOS. No se desactivó RLS. No se usaron service_role ni secrets reales.

## 7. Inmutabilidad

Rechazos SQL de cambios de buyer, token, entorno, cadena, assignment, delivery y slot: NO PROBADOS. La suite Node prueba algunos conflictos de identidad/replay; no prueba triggers ni restricciones SQL.

## 8. Idempotencia

Pruebas Node existentes aprobadas: misma clave/mismo request, clave con distinto request, replay de transacción, evento y delivery sin duplicar entitlement, sin extender fechas ni mover listing. Repositorio en memoria; persistencia/idempotencia SQL PENDIENTES.

## 9. Concurrencia real

NO EJECUTADA: cero conexiones PostgreSQL. Pendientes A–F: mismo slot, doble toque, último slot, doble delivery, CAS simultáneo y undécima promoción. Promise.all de los tests existentes no se cuenta como concurrencia PostgreSQL. Los diez slots del dominio son por buyer/entorno y compartidos entre tipos de listing; no son un límite global de diez para todos los compradores.

## 10. Rollback

NO EJECUTADO en SQL. La suite solo simula crash antes del commit en memoria, respuesta perdida después y fallo del firmante. No se verificaron fallos intermedios de RPC, medias escrituras ni recuperación PostgreSQL. No hubo DB parcialmente migrada.

## 11. Sandbox / Production / Xcode

Node aprueba rechazo de evidencia Production/Xcode y exclusión de Sandbox en proyección Production. El dominio solo acepta Sandbox y la CAS contiene un guard Sandbox.
Mismos transaction IDs entre entornos, FKs cruzadas, intención Production/transacción Sandbox y notificación Sandbox frente a filas Production reales: PENDIENTES SQL. No se declara aislamiento integral validado.

## 12. Listings y conflictos

Fixtures Node aprobados para listing inexistente, autorización ausente/caducada, Stripe incompatible, slots Business/Job/Rental, límite once y catálogo deshabilitado/campos falsificados. Cobertura adicional de todos los estados ocultos, pagos duplicados e intents incompatibles en PostgreSQL: pendiente. No se tocó lógica Stripe real ni tablas legacy.

## 13. Proyector

Fixtures aprobados para Premium sobre Featured, comp inferior, no sumar períodos, conflicto de pagos, moderación y filtro de entorno. Es función pura sin escritura legacy. Esto no certifica integración con las tablas reales ni coordinación entre proveedores.

## 14. Notifications

Suite Node aprobada con SUBSCRIBED, DID_RENEW, DID_CHANGE_RENEWAL_STATUS, DID_FAIL_TO_RENEW, GRACE_PERIOD_EXPIRED, EXPIRED, REFUND y REVOKE; duplicadas, fuera de orden, previas a verify y refund tardío.
Los payloads proceden de un registro sintético, no de firmas Apple. Cadena sin assignment queda retry en el caso probado; ciertos conflictos quedan quarantined/reconciliation. Cobertura exhaustiva de buyer ausente, transacción desconocida y entorno cruzado persistido: pendiente. No se adivina un listing para entregar una compra desconocida.

## 15. Verificador oficial / runtime / entry points

PENDIENTE / NO PROBADO con la librería oficial. Se respetó el orden requerido: no investigar/instalar/probar el paquete oficial antes de terminar PostgreSQL. La versión 3.1.0 citada en Fase 36 NO fue verificada en esta fase. No se certifica existencia ni ausencia de un vector oficial reutilizable.
Los tests del adaptador usan métodos inyectados; prueban delegación y correspondencia de identidad, no SignedDataVerifier real, certificados, firmas Apple ni OCSP. Compatibilidad oficial Node y Deno/Supabase Edge: NO PROBADA; Deno no está disponible.
Los tres entry points siguen llamando handler sin backend. El handler rechaza POST con 503 APPLE_BACKEND_NOT_CONFIGURED; otros métodos con 405. Prueba Node aprobada y código revisado. Sin bypass nuevo. node --check de los .ts pasó; no equivale a ejecución Deno.

## 16. Tests y controles

Comando: `node --test tests/*.test.mjs tests/apple-iap/*.test.mjs tests/apple-backend/*.test.mjs`.
Resultado: 138 tests, 138 pass, 0 fail, 0 skipped, 0 cancelled. Incluye 51 de backend y 87 previos.
Evidencia: `/private/tmp/abilene-phase37-node-tests.tap`.
ESLint de los módulos Apple y tests backend: exit 0. Sintaxis Node de los tres entry points: exit 0.
No se crearon pruebas SQL/concurrencia/rollback que no pudieran ejecutarse.

Incidencia: se intentó compilar la suite Swift pura mediante swiftc con caché y salida en /private/tmp. El lanzador invocó internamente xcodebuild, que emitió warnings de FSEvents/cache. La compilación terminó con exit 1 por LocalReceiptTransaction/LocalTestReceiptAuthority fuera de scope: la invocación omitía DEBUG/ABILENE_SECURITY_TESTS, requeridos por el guard de compilación del archivo. No se ejecutaron los 26 checks Swift. No se reintentó tras detectar la invocación interna de Xcode. No hubo build de app, simulador, StoreKit ni SKTestSession.
Por tanto: 138 checks aprobados, 1 intento de compilación fallido y 26 checks Swift no ejecutados. NO se afirma repetir las 164 comprobaciones de Fase 36 ni tener cero fallos globales.

## 17. Archivos

Único archivo nuevo en el repositorio durante Fase 37: este documento. Ningún archivo previo modificado ni eliminado. Los 14 archivos de Fase 36 siguen íntegros y untracked.
Artefactos temporales: inventario inicial, log TAP y caché Swift bajo /private/tmp. No se instalaron dependencias ni se modificaron manifests.

## 18. Integridad

Comparación SHA-256 de los 368 archivos iniciales: cero cambios y cero ausencias. Incluye android/ (54), ios/ (27), supabase/ (20), src/App.jsx, src/App.css, src/main.jsx, package.json, package-lock.json, fuentes/artefactos Admin, create-checkout-session, stripe-webhook, cancel-subscription, payment-return y migración advertiser_identity.
Cobertura: archivos tracked y untracked no ignorados; no certifica cachés ignoradas ni todo el sistema. No se ejecutaron npm build, cap sync ni Gradle.

## 19. Git status final

main...origin/main; sin cambios tracked, sin staged. Untracked completos (15):

    docs/phase36-apple-backend.md
    docs/phase37-apple-backend-local-validation.md
    supabase/functions/_shared/apple/apple-verifier.mjs
    supabase/functions/_shared/apple/backend.mjs
    supabase/functions/_shared/apple/domain.mjs
    supabase/functions/_shared/apple/http.mjs
    supabase/functions/_shared/apple/projection.mjs
    supabase/functions/_shared/apple/reconciliation.mjs
    supabase/functions/_shared/apple/repository.mjs
    supabase/functions/apple-notifications/index.ts
    supabase/functions/apple-prepare-purchase/index.ts
    supabase/functions/apple-verify-purchase/index.ts
    supabase/migrations/202609080001_apple_iap_ledger.sql
    tests/apple-backend/backend.test.mjs
    tests/apple-backend/fixtures.mjs

## 20. Git diff final

git diff --stat y git diff --name-only: vacíos; git diff --check: sin errores. Los untracked no aparecen en esos diffs. HEAD y origin/main local permanecen iguales al estado inicial.

## 21. Limitaciones

Bloqueador principal: PostgreSQL local no disponible. Pendientes todos los criterios reales SQL, privilegios, inmutabilidad, aislamiento, concurrencia, rollback y runtime oficial. No se sustituyen con mocks. El backend no está listo para Sandbox. También siguen pendientes identidad/attestation, autoridad de listings, firma/nonce/replay y protocolo de conflictos entre proveedores descritos en Fase 36.

## 22. Recomendación para Fase 38

Primero disponer de Docker con daemon operativo o PostgreSQL local instalado con autorización separada. Reanudar esta validación en DB temporal aislada con fixture mínimo, sin conexión a Supabase remoto. Probar/corregir privilegios y asociaciones, recreando desde cero tras cada corrección necesaria, y completar A–F y fallos intermedios antes de declarar éxito. Después verificar versión oficial, SignedDataVerifier y vectores públicos en workspace temporal; probar Deno solo si está disponible. Mantener endpoints cerrados y no pasar todavía a Sandbox Apple real.

## 23. Escrituras remotas

CERO escrituras remotas. No se configuró ni intentó conexión al project ref productivo. No se usaron SQL remoto, APIs remotas, secrets reales ni credenciales Apple.

## 24. Acciones excluidas

No hubo deploy, pagos, Apple Developer, App Store Connect, Sandbox Apple real, TestFlight, App Attest real, Git add, commit ni push. No hubo operaciones Android/Stripe ni StoreKit. La invocación interna de xcodebuild durante el intento Swift está documentada como desviación; no se afirma ausencia absoluta de herramientas Xcode.
