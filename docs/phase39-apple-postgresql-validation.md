# Fase 39 — validación PostgreSQL local con fixture sintético

Resultado: **VALIDADA LOCALMENTE en el alcance probado**, con limitaciones explícitas. No habilita Sandbox Apple ni producción. La migración final se instaló desde cero en PostgreSQL real y pasó la matriz de integración. RLS, grants, restricciones, CAS, concurrencia y rollback ya tienen evidencia SQL; esto sustituye el bloqueo de infraestructura de Fase 37 para esos casos, no sus pendientes de runtime/identidad/operación.

## 1. Auditoría inicial

Repositorio `/Users/yanier/Documents/abilene-vibes`. HEAD: `0e50e01ff9916345915678728f6ecbe131efb741`. main coincide con origin/main **local**, sin fetch. Se ejecutaron git status, git status -sb y git diff --check antes de escribir SQL. Exactamente 16 untracked de Fases 36–38, sin cambios tracked ni staged.

Contenedor comprobado: `abilene-phase38-postgres`, running, sin mounts del host; contexto Docker desktop-linux con socket Unix `/Users/yanier/.docker/run/docker.sock`. Puerto publicado únicamente `127.0.0.1:49447`. Base comprobada `abilene_apple_phase37_test`; public vacío antes de la primera aplicación. El runner fija contenedor, socket y DB, y rechaza un contexto/puerto/mount distinto. No acepta URLs de conexión configurables. La cadena local comprobada no contiene el project ref productivo ni supabase.co.

Inventario SHA-256 inicial de 370 archivos no ignorados: `/private/tmp/abilene-phase39/initial.json`. Copia exacta de la migración original: `/private/tmp/abilene-phase39/migration-before.sql`.

## 2. SHA-256 de migración

- Antes: `075cac1fb838ed935b6de4aed9825dad47b12ef3d1aaac0d47e3224796fdd67e`.
- Después: `9e2e48561f0551b32361dae72e9c04da83e2a1f739b7755516a3e77108b8065d`.

Archivo: `supabase/migrations/202609080001_apple_iap_ledger.sql`. Comparación contra inventario inicial: 91 líneas añadidas y 8 eliminadas. Como el archivo sigue untracked, el git diff habitual no muestra esta modificación.

## 3. Hallazgos

Antes de aplicar se revisó la migración completa. Defectos estáticos materiales: ALL sobre tablas para service_role, FK simples que no fijaban entorno/asociación, ausencia de protección DELETE/TRUNCATE, falta de inmutabilidad de algunas claves y de validación de entorno en facts de notificaciones.

Las pruebas reales encontraron además:

1. Replay legítimo fallaba con TRANSACTION_REPLAY_CONFLICT después del round trip PostgreSQL: to_jsonb(timestamptz) no conserva la representación ISO con milisegundos utilizada por el dominio.
2. La CAS aceptaba una transacción con un token válido de otro comprador. Una FK contra cualquier comprador válido no basta: debe ser el comprador de la suscripción.

Otros dos fallos durante desarrollo fueron del harness: interpretar `t` de psql como JSON y esperar CHECK/23514 cuando un nuevo trigger ya rechazaba Xcode con 23503. Se corrigieron las expectativas/transporte, no se suprimieron los ataques.

## 4. Correcciones

- Se revocan todos los privilegios de tabla de service_role; conserva solo EXECUTE de snapshot/CAS. No se le concede escritura directa ni TRUNCATE.
- FK compuestas vinculan instalación/challenge, producto/plan/slot, intención/slot/listing, suscripción/asignación, transacción/cadena/bundle/entorno y delivery/transacción/asignación/comprador/intención.
- subscription_id y assignment_id de transacciones pasan a NOT NULL.
- Trigger financiero exige que el token/AppTransaction pertenezcan al comprador de esa suscripción. Otro valida que el entitlement Apple corresponda a una suscripción/asignación del mismo entorno/listing/plan.
- Facts de notificaciones deben corresponder a environment, bundle y UUID de su fila; facts y campos de identidad del evento son inmutables.
- Claves primarias, identidad de instalación/capability/challenge y campos históricos de assignment reciben protección de actualización.
- DELETE y TRUNCATE se rechazan en las 15 tablas del ledger, incluidas referencias/controles que no deben desaparecer silenciosamente. Las actualizaciones legítimas de estado continúan; no se afirma que toda fila sea completamente append-only. Un propietario/superusuario que puede modificar DDL sigue siendo autoridad administrativa.
- Funciones con search_path explícito `pg_catalog,public,pg_temp`. La migración falla si el ejecutor es uno de los roles de aplicación o esos roles tienen CREATE sobre public. El fixture satisface esa precondición; la migración no cambia indiscriminadamente permisos de objetos legacy.
- Snapshot normaliza columnas timestamptz a UTC ISO con milisegundos, contrato utilizado por el backend y las fechas Apple. No se modificó el backend ni se normalizaron fechas en el transporte de prueba para ocultar el error.

## 5. Fixture mínimo

`tests/apple-backend/phase39-fixture.sql`: roles sintéticos NOLOGIN anon/authenticated/service_role; service_role tiene BYPASSRLS para comprobar que la revocación de ACL sigue importando. public concede USAGE, no CREATE a esos roles.

Tres tablas legacy: business_submissions, job_listings y rental_listings, con id UUID PK, status text NOT NULL, stripe_subscription_id, payment_status y placement_source text. Todos los IDs y valores son sintéticos. Ninguna migración histórica, dato real, email o negocio productivo fue copiado.

No reproduce auth, PostgREST, extensiones/roles completos de Supabase, triggers/moderación reales ni operación Stripe. El propietario local de tablas y funciones es postgres. Los roles se ejercitan con SET ROLE en sesiones psql independientes; no se prueba autenticación de usuarios por PostgREST/JWT.

## 6. Aplicaciones

Ninguna aplicación SQL falló al compilar. Cada aplicación fue sobre DB recién creada o inicialmente vacía, con su fixture mínimo y BEGIN/COMMIT. No hubo parches manuales de una base parcialmente migrada.

El runner recrea la DB entre grupos para aislar escenarios. Hubo seis ejecuciones de desarrollo/validación: 2, 2, 22, 22, 20 y 27 instalaciones limpias respectivamente; después se hizo una recreación independiente final con captura separada de stdout/stderr (96 instalaciones locales en total, no sobre un mismo esquema existente).

Última aplicación independiente: exit 0, BEGIN/COMMIT capturados, stderr de 0 bytes, smoke aprobado con revisión 0. Evidencia en `/private/tmp/abilene-phase39/final-recreate.stdout` y `final-recreate.stderr`. Los fallos de tests anteriores están preservados en run-1.log hasta run-5.log; la matriz final está en run-6.log.

## 7. Objetos reales

Introspección final en pg_catalog/information_schema:

| Objeto Apple | Resultado |
| --- | --- |
| Tablas | 15 |
| PK | 15 |
| UNIQUE | 30 |
| FK | 31 |
| CHECK | 48 |
| Índices | 45 |
| Triggers de usuario | 73 |
| Constraints no validados | 0 |
| Tablas con RLS | 15 |
| Policies | 0 |

Las tres tablas legacy elevan el total a 18 tablas; no se cuentan como tablas Apple. Se capturaron columnas/tipos/nullability, definiciones de restricciones, índices, triggers, policies, ACL y owners. Archivos columns.txt, constraints.txt, indexes.txt, triggers.txt, functions.txt, policies.txt, grants.txt, schema.txt y final-audit.log en el directorio temporal de evidencia.

Las dos RPC son SECURITY DEFINER, owner postgres, search_path explícito. PUBLIC/anon/authenticated sin EXECUTE; service_role solo EXECUTE en esas dos RPC. Las tres funciones de triggers son invoker y no tienen EXECUTE público/de aplicación. En public, los roles de aplicación tienen USAGE sin CREATE.

## 8. Matriz de roles y RLS

Sesiones reales rechazan SELECT sensible, INSERT de intents/deliveries, UPDATE de entitlement/slot/subscription, DELETE, TRUNCATE y CREATE en public para anon/authenticated/service_role. Anon/authenticated también rechazan RPC. Service_role ejecuta snapshot/CAS y los flujos autorizados del backend.

Conocer buyer_id, app_account_token, appTransactionId, transactionId y originalTransactionId no evitó los rechazos. Concesiones SELECT/INSERT temporales dentro de transacciones revertidas demostraron RLS por separado: anon/authenticated ven cero buyers aun existiendo uno y reciben rechazo por row-level security al insertar. No se desactivó RLS. Las ACL temporales desaparecieron con rollback y recreación final.

## 9. Inmutabilidad

Ataques ejecutados: cambio de PK/identidad/token/AppTransaction/bundle/environment de buyer, originalTransactionId/comprador de suscripción, listing/intención de assignment, transactionId/asignación de transacción, slot y asociación de delivery. PostgreSQL rechazó con IMMUTABLE_APPLE_BINDING.

DELETE/TRUNCATE incluso como propietario operativo fueron rechazados en buyers, intents, subscriptions, assignments, transactions, deliveries, slots y entitlements; las 15 tablas tienen esos triggers en catálogo. No se ensayó eludirlos mediante ALTER/DROP de un superusuario: esa autoridad no está dentro del modelo de roles de aplicación.

## 10. Entornos

Fixtures Sandbox/Production con mismo transactionId, originalTransactionId, appTransactionId, listing y slot coexistieron sin colisiones entre namespaces. UUID internos/tokens de compradores son distintos. Snapshot retorna solo Sandbox.

Inserciones cruzadas de subscription/assignment, transaction/subscription, transaction/assignment, challenge/installation y delivery/assignment/intention fallaron con FK/23503. El caso subscription Sandbox→assignment Production usa una suscripción nueva para evitar que UNIQUE oculte la comprobación FK. Facts Sandbox en evento Production fallaron con CHECK. Xcode no pudo crear entitlement; Production/Xcode en CAS fueron rechazados por ENVIRONMENT_DISABLED.

Los fixtures Production se introdujeron exclusivamente como administrador local para atacar constraints, nunca a través de activación del backend. La DB final no conserva esos fixtures.

## 11. Idempotencia

Backend real + repositorio PostgreSQL: misma clave y payload retornan la misma intención; payload distinto falla; replay de transacción retorna already_delivered sin cambiar transacción, entitlement o fechas. Repetir directamente transaction/subscription/delivery falla por UNIQUE. Eventos duplicados no duplican entrega ni derechos; mismo UUID con evidencia distinta falla por NOTIFICATION_REPLAY_CONFLICT.

## 12. Concurrencia A–F

Cada RPC usa un proceso docker exec/psql y una conexión PostgreSQL real; no se utiliza MemoryRepository como sistema bajo prueba. Los fixtures iniciales se construyen sintéticamente y luego todas las operaciones comprobadas usan PostgresAppleRepository y SQL. En A/B una barrera fuerza que las primeras lecturas compitan con la misma revisión.

Resultados de run-6.log:

- A: petición índice 1 ganó; índice 0 rechazó APPLE_CONFLICT para el mismo listing/slot. Un solo ocupante lógico.
- B: dos respuestas con una sola intención, UUID `fa4638ed-67ac-44b9-b9f0-2f85689593ee` (sintético).
- C: con nueve slots ocupados, índice 0 ganó y el 1 recibió NO_SLOT_AVAILABLE; quedaron diez.
- D: resultados delivered y already_delivered para el mismo delivery_id; una transacción, un delivery y un entitlement.
- E: PID PostgreSQL 21102 ganó con true; PID 21110 devolvió false para la misma revisión. pg_stat_activity mostró explícitamente wait_event_type=Lock para la segunda sesión. La revisión avanzó una vez.
- F: intento once rechazado; comparación del estado demuestra que los diez slots existentes no cambiaron.

El límite es diez slots **por comprador/entorno**, compartidos entre Business/Job/Rental. No es un límite global para todos los compradores.

## 13. Rollback

Se crearon triggers de fallo de prueba únicamente dentro de transacciones que se abortaron; no forman parte de la migración y se comprobó que desaparecían.

Errores deliberados después de INSERT de intención nueva y slot nuevo; después de persistir transaction; antes de entitlement, delivery y actualización de revision; también errores durante upsert de intents/slots. Snapshot/revisión completos se compararon antes/después: sin medias escrituras, slots fantasma ni entregas parciales. El retry posterior pudo persistir una sola entrega o reserva. CAS con revisión obsoleta devolvió false sin cambiar estado.

Esto prueba atomicidad de errores SQL/abortos transaccionales; no simula pérdida de host, apagado de Docker o recuperación WAL tras fallo físico.

## 14. Listings y conflictos

Pruebas reales del backend con datos persistidos: inexistente, hidden, autorización faltante/caducada, Stripe paid sintético, catálogo deshabilitado, plan/buyer/product/slot falsificado, conflicto Apple, slots entre los tres tipos y límite once. FK SQL también rechaza combinaciones falsas de producto/plan/slot/comprador.

La protección de elegibilidad/Stripe se ejecuta en el dominio antes de CAS. No hay protocolo de bloqueo común con Stripe/moderación. La RPC no bloquea ni revalida filas legacy entre snapshot y commit: no se declara resuelta una carrera de cambio externo de listing/pago. Esta limitación requiere otra fase y bloquea la activación real. No se modificó Stripe ni se escribieron tablas legacy desde la migración/backend; solo el administrador de fixtures creó/cambió valores sintéticos para las pruebas.

## 15. Proyector

Se usó un entitlement leído de PostgreSQL para probar Premium sobre Featured, comp inferior sin rebaja, períodos sin suma, doble paid con conflicto visible, moderación y exclusión Sandbox→Production. Comparación de filas legacy antes/después confirma ausencia de escritura del proyector. Sigue puro y desconectado del frontend.

## 16. Notifications persistidas

Pasaron SUBSCRIBED, DID_RENEW, DID_CHANGE_RENEWAL_STATUS, DID_FAIL_TO_RENEW con grace, GRACE_PERIOD_EXPIRED, EXPIRED, REFUND y REVOKE. Se verificó estado persistido, replay y cantidades de delivery/entitlement.

Antes de verify: retry; después de verify/reconciliation: processed. Cadena desconocida con token sin comprador: retry. Token de comprador no resuelto para cadena conocida: quarantined. Evento fuera de orden: quarantined; refund tardío: subscription en reconciliation. Production/Xcode: rechazo. Un buyer referenciado no puede borrarse para fabricar una subscription huérfana: FK/controles de historial lo impiden; el caso de buyer ausente se representa con identidad de evidencia no resuelta, no desactivando constraints.

Payloads totalmente sintéticos mediante FixtureAppleVerifier. No son firmas Apple ni prueba de SignedDataVerifier oficial.

## 17. Recreación limpia final

Después de todas las correcciones se recreó la DB desde cero, fixture, migración final y smoke, con exit 0 y stderr vacío. Estado final: 15 tablas Apple + 3 legacy, revisión 0, 40 productos candidatos (20 por entorno), todos deshabilitados; cero transactions y sin compradores/entitlements de prueba. Roles permanecen locales en el clúster. No hay triggers de inyección de fallos.

## 18. Tests

- Integración final: **28 grupos aprobados, 0 fallos**, sin grupos omitidos en run-6.log. Cada grupo contiene varias aserciones/operaciones; no se presenta cada sentencia SQL como un test adicional.
- Suite Node previa completa: **138 aprobados, 0 fallos, 0 skipped**, en node-tests-final.tap.
- Total de casos/grupos reportados: 166 (138 unitarios/previos + 28 grupos PostgreSQL), más smoke independiente final. No confundir con los 164 checks de Fase 36: aquellos incluían 26 Swift.
- ESLint de módulos Apple y todos los .mjs backend: aprobado; node --check del runner: aprobado.
- Los 26 checks Swift no se ejecutaron, conforme a la prohibición de Xcode/StoreKit. Sin builds ni instalación de dependencias.
- Cuatro ejecuciones de desarrollo tuvieron un grupo fallido; están descritas en hallazgos y preservadas en logs. No se ocultaron como skipped.

Reproducción explícita, destructiva **solo para la DB temporal fija**, con Docker local funcionando:

    node tests/apple-backend/phase39-local.mjs --fresh

No se integra automáticamente en node --test: requiere ejecución explícita. Sin --fresh el runner exige public vacío. No instala paquetes ni usa psql del host; utiliza el psql de la imagen ya instalada.

## 19. Archivos

Modificado de los iniciales: únicamente `supabase/migrations/202609080001_apple_iap_ledger.sql`.

Nuevos:
- `tests/apple-backend/phase39-fixture.sql`.
- `tests/apple-backend/phase39-local.mjs`.
- `docs/phase39-apple-postgresql-validation.md`.

Los demás archivos Fase 36–38 permanecen byte a byte intactos. Los reportes anteriores describen sus estados históricos; este documento actualiza el resultado de validación local.

## 20. Integridad

De 370 archivos iniciales, 369 sin cambios y únicamente la migración autorizada modificada. Cero ausencias. Incluye Android, iOS/bridge, frontend, Stripe, Admin, Supabase existente, migración advertiser_identity y package.json/package-lock.json. Cobertura: archivos tracked/untracked no ignorados; no caches ignoradas.

## 21. Docker/PostgreSQL

Contenedor `abilene-phase38-postgres` running/healthy, PostgreSQL 17.11 ARM64, DB `abilene_apple_phase37_test`, publicación `127.0.0.1:49447`. Sin nuevos contenedores, imágenes ni software. Contraseña temporal consumida dentro del contenedor, sin mostrarla. Sigue usando datos en memoria y --rm: detenerlo destruye este entorno temporal.

## 22. Git final

HEAD y main sin cambios. Sin staged, sin diferencias tracked. git diff --stat y --name-only vacíos; git diff --check sin errores. Esto no incluye el cambio de migración untracked. Hay 19 untracked: los 16 iniciales más los tres archivos nuevos enumerados arriba. No hubo git add/commit/push, restore/reset/clean ni cambios de rama.

## 23. Limitaciones restantes

- Pruebas sobre PostgreSQL real con fixture mínimo; no equivalencia total con Supabase desplegado, PostgREST/JWT ni permisos heredados de otro entorno.
- CAS es una API de confianza para backend: el servicio autorizado aporta estado normalizado. SQL no verifica firmas Apple ni vuelve a ejecutar todas las reglas de negocio del dominio por cada snapshot recibido. No debe exponerse a clientes ni usarse como API genérica de usuarios.
- Owner local postgres es superusuario; propietarios/administradores pueden cambiar DDL. No se declara protección contra un administrador del motor.
- No se resuelve concurrencia interproveedor Stripe/moderación ni escalabilidad del mutex global. La normalización temporal usa el contrato de precisión de milisegundos del dominio.
- Verificador oficial Apple/runtime, App Attest/identidad, autoridad de listings, signer/nonce/replay persistente, evidencia privada/Server API y recuperación operativa siguen pendientes.
- Backend Apple continúa cerrado y no está listo para Sandbox Apple real. Próxima fase: revisar protocolo de conflictos/autoridad y después validar el runtime oficial con vectores públicos y autorización específica, sin desplegar.

## 24. Confirmaciones

**CERO conexiones y CERO escrituras a Supabase producción. CERO escrituras remotas.** Todas las conexiones DB usaron 127.0.0.1 dentro del contenedor local autorizado; Docker se controló por socket Unix local. No se usaron claves reales, SQL remoto, Supabase CLI, deploy, pagos, Apple Developer/App Store Connect, App Attest, Sandbox Apple real, TestFlight, Xcode/StoreKit, npm build, cap sync, Android ni Git remoto.
