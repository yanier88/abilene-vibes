# Fase 29 — laboratorio local de slots Apple

**No es código de pagos ni autenticación. No importar en `src/`, Edge Functions o plugins.**
No red, base remota, JWS real, credenciales, compras ni precios. Node ejecuta únicamente
fixtures `TEST/SYNTHETIC`. Los tokens y firmas son falsos deliberadamente. Nada queda
registrado en Capacitor. No se cambió la infraestructura de Fase 26/26B.

## Ejecutar

`node --test tests/apple-iap/model.test.mjs`

No necesita instalación, npm scripts, build, Xcode ni sincronización.

## Alcance

- `model.mjs`: comprador, listing, intención, slot derivado, cadena, episodio,
  transacciones, notificaciones, entrega y cola de reconciliación.
- `fixtures.mjs`: compradores X/Y, Business/Job/Rental y eventos sintéticos.
- `ports.mjs`: contador de cobros simulados, cola StoreKit, finish explícito,
  nonce/assertion falsos para probar contratos, nunca criptografía real.
- `model.test.mjs`: casos deterministas, fallos inyectados y contraejemplo.
- `bridge-contract.d.ts`: interfaz futura sin implementación ni conexión al producto.

## Dos contratos y una hipótesis que se intenta refutar

`mode: permanent` conserva cadena → episodio → listing. No reserva un slot histórico
para otro listing. Una reactivación conocida vuelve al mismo anuncio.

`mode: episodes` permite preparar un segundo episodio únicamente con
`experimentalReuse: true` y una reconciliación terminal simulada. Eso NO certifica
reutilización: `canReuseSlot()` continúa devolviendo false por historial.
El resolutor normal pone nuevas cadenas para otro anuncio y cadenas antiguas
ambiguas en `RECONCILIATION_REQUIRED`. Nunca adivina el listing.

`diagnosticUnsafeHypothesis: true` es un interruptor exclusivo del laboratorio,
desactivado por defecto. Permite examinar la hipótesis insegura “cadena desconocida
+ única intención abierta = anuncio de la intención”. No es una solución V1.

El test 36 construye dos mundos con los mismos datos observables: compra dentro de
la app para B y reactivación externa concurrente. Ambos reciben la misma asignación
bajo esa hipótesis. PASS significa que se reprodujo la debilidad. Los tests 42–43
comprueban que el comportamiento normal rechaza inferir B en esos mundos.

La existencia real de estas secuencias y los campos observables deben comprobarse
en Sandbox. El laboratorio **no demuestra** que Apple emita esos eventos exactos.
Sí demuestra que si los datos recibidos son indistinguibles, esa regla no puede
determinar su intención comercial correcta.

## Máquinas de estado

Intención: reserved → purchasing → pending/verifying → completed.
También canceled/failed con prueba simulada definitiva de no compra, o reconciliation.
El vencimiento de la reserva impide empezar, pero NO cancela una compra pendiente.

Suscripción: active, active_nonrenewing, grace, billing_retry, expired, revoked,
reconciliation. Cancelar auto-renew no elimina el período vigente. Retry bloquea
el slot aunque no conceda servicio. Gracia usa un fin específico.

Slot: available, reserved, occupied, reconciliation, candidate_for_reuse.
Nunca candidato = disponible automáticamente. No hay cooldown que pruebe ausencia
de una reactivación futura. Las reservas canceladas sin compra no consumen historial.

Episodio: prepared, active, closed, reconciliation. La identidad del anuncio y la
cadena no se reasignan. Las fechas de transacciones y cierres conservan historial;
status es una proyección mutable, no un borrado del historial.

## Resolver

1. Validar marca sintética, aplicación/entorno, comprador/token, producto/grupo.
2. Transacción conocida: su asociación exacta; comprobar hechos inmutables.
3. Cadena conocida: asociación histórica, salvo conflicto con otro episodio/intención.
4. Cadena desconocida: exigir una intención única ya iniciada y producto correcto.
5. Si existe historial de otro anuncio: reconciliación en modo normal.
6. Sin prueba suficiente: retener evidencia, no conceder ni mover derechos.

No recibe “último anuncio abierto”, listing de un evento ni reloj del dispositivo.
Las fechas en fixtures representan hechos firmados sintéticos y el reloj local es
un reloj de servidor determinista. La reducción de eventos es deliberadamente parcial:
en producción se necesita reconciliación con Server API; no basta ordenar signedDate.

## Entrega y recuperación

La escritura local usa copy-on-write: transacción + asociación + entitlement + recibo
se confirman juntos. Una excepción antes del commit revierte todo. Una pérdida de
respuesta después conserva el snapshot, que un nuevo objeto recupera sin recomprar.
`finishTransaction` requiere reconocimiento de DELIVERED con recibo coincidente en
el backend simulado. Los listeners no finalizan. El recibo es falso y verificable
solo dentro del laboratorio; no es un diseño criptográfico de recibos productivos.

No se prueba fsync, disco, PostgreSQL, bloqueo entre procesos ni persistencia tras
un apagado físico. Se prueba el orden lógico y la recuperación desde snapshot.
El contador de cobros prueba que nuestros escenarios no vuelven a llamar a compra;
no garantiza el comportamiento de cobros de Apple.

Una operación ambigua queda pendiente aunque pueda representar un cobro real.
No se puede prometer entrega automática eventual sin resolver el vínculo.
No se inventa otro derecho para “compensar” ni se ejecuta un refund.

## Decisión y alternativas

- Permanente: viable para vínculos y renovaciones; incompatible con garantizar
  infinitos anuncios históricos usando solo diez slots no reasignables.
- Episodios: solo con restricciones; no autorizar reutilización automática V1.
- Diez reutilizables indefinidamente: NO demostrado.
- Recomendación V1: vínculo permanente para prototipo/Sandbox. No publicar un límite
  histórico de diez como si cumpliera diez simultáneos reutilizables.

Ampliar grupos pospone el límite histórico; no lo elimina. También complica catálogo
y control de máximo diez ante reactivaciones desde App Store. Apple permite grupos
independientes para suscripciones simultáneas:
[Apple — Subscriptions](https://developer.apple.com/app-store/subscriptions/).

Advanced Commerce permitiría evaluar SKU dinámico ligado al anuncio, pero su acceso
requiere elegibilidad/aprobación; no se presume para Abilene Vibes:
[Apple — Advanced Commerce](https://developer.apple.com/in-app-purchase/advanced-commerce-api/).

Otra opción conceptual es una suscripción de capacidad con asignaciones futuras
explícitas, manteniendo renovación automática, pero cambia el contrato de pago por
anuncio y requiere decisión de producto. No está implementada ni recomendada por defecto.

## Pendientes reales

Sandbox debe examinar nuevas/cadenas conservadas, reactivación desde Ajustes,
concurrencia, cambios de nivel, compras pendientes, orden de notificaciones,
cuentas de descarga/compras distintas, AppTransaction/JWS, restauración en otro
dispositivo, App Attest y finish tras entrega. Sandbox tampoco garantiza todas las
secuencias posibles en producción: se necesitan reglas respaldadas por Apple y
reconciliación operativa.

El bridge futuro entrega JWS sin afirmar que un booleano JS autentique al usuario,
no termina en listeners, permite pending explícito y exige finish separado:
[Apple — finish](https://developer.apple.com/documentation/storekit/transaction/finish%28%29).

Limitaciones adicionales: no modela refund reversal, todos los matices de downgrade,
firmas, RLS, expiración criptográfica de sesiones, pagos Stripe ni proyección compartida.
La cola reconciliation se conserva; su resolución manual/automática no se implementó.
