# Fase 38 — PostgreSQL local temporal preparado

Fecha: 2026-09-08, America/Chicago. Autorización recibida: «Docker listo; continúa Fase 38».

## Resultado

Docker Desktop instalado por el usuario. Se verificó Docker Engine y se creó PostgreSQL temporal. La migración Apple NO se aplicó. Esta fase no valida RLS, RPC, concurrencia ni rollback de Fase 37.

- Docker CLI y Engine: 29.7.2; Compose: v5.5.1.
- Contexto explícito: desktop-linux, socket Unix local `/Users/yanier/.docker/run/docker.sock`.
- Motor: Linux aarch64; Mac arm64.
- CLI: `/Applications/Docker.app/Contents/Resources/bin/docker`. No está en el PATH original de esta sesión; no se cambió configuración del shell.
- Contenedor: `abilene-phase38-postgres`.
- ID: `80f34b290049a64fb632bbbaaa51414514b097e1312e95a506b287b9f4d45b4d`.
- Estado comprobado: running / healthy.
- Imagen oficial descargada: `postgres:17-bookworm`, ejecutada por digest.
- Digest: `sha256:051f7b7b3abdd564d5d1bd1e8c4b9c1b6e77087d1dd22020ede611c096a272e0`.
- PostgreSQL real: `17.11 (Debian 17.11-1.pgdg12+2)`.
- Host publicado: `127.0.0.1`; puerto host: `49447`; puerto contenedor: `5432`.
- Base: `abilene_apple_phase37_test`; usuario administrativo exclusivamente local: `postgres`.

PostgreSQL 17 se eligió para probar las características PostgreSQL de la migración; no representa una certificación de equivalencia con el proyecto remoto ni una instalación completa de Supabase. Referencias públicas consultadas: [imagen oficial PostgreSQL](https://hub.docker.com/_/postgres) y [guía Supabase para PostgreSQL 17](https://supabase.com/docs/guides/self-hosting/postgres-upgrade-17). No se consultó ningún proyecto privado.

## Aislamiento y comprobaciones

- Docker asignó el puerto automáticamente, evitando una elección fija en conflicto.
- Inspect confirma únicamente `127.0.0.1:49447`, sin publicación en 0.0.0.0 ni IPv6.
- Se verificó desde la Mac una respuesta válida al saludo de protocolo PostgreSQL en ese puerto. No fue una autenticación desde el host.
- Dentro del contenedor, psql autenticó por TCP con contraseña temporal y `default_transaction_read_only=on`.
- Las consultas devolvieron la DB esperada, el usuario postgres, la versión 17.11 y `transaction_read_only=on`.
- Tablas en public: 0. Tablas Apple/entitlements: 0.
- Se comprobó que la cadena construida contiene solo el host local y no contiene `ymgiwjuhgvfexitynmtb` ni `supabase.co`.
- No se ejecutó SQL de la migración ni fixture. Únicamente inicialización estándar de la imagen y consultas de lectura.
- Mounts: vacío; no se montaron archivos personales ni el repositorio.
- PGDATA usa tmpfs de 512 MiB; límite de memoria del contenedor 768 MiB y 2 CPU; no-new-privileges activado.
- Red Docker bridge local; la publicación está restringida a loopback. No se configuró un bloqueo general de salida de red.

## Credenciales y ciclo de vida

Contraseña aleatoria nueva generada solo para esta prueba, nunca mostrada en el reporte ni pasada como valor literal en el comando. Archivo temporal mode 0600: `/private/tmp/abilene-phase38-local/postgres.env`, dentro de directorio creado mode 0700. Docker lo recibió mediante --env-file; no es un montaje. Quien controle Docker puede inspeccionar las variables del contenedor. No es un almacén de secretos productivo.

Autenticación local/host inicializada con SCRAM-SHA-256. No se usaron claves Supabase ni credenciales Apple.

El contenedor permanece ejecutándose para la siguiente subfase. Tiene `--rm`, restart=no y datos en memoria: al detenerlo se elimina y los datos se pierden. Una parada de Docker también puede perder el estado temporal. No detenerlo para conservar esta instancia. La imagen descargada y el archivo temporal de credenciales permanecen en la Mac; no se efectuó limpieza destructiva.

## Incidencias resueltas

1. `docker` no estaba en PATH: se usó la ruta absoluta instalada, sin reinstalar ni cambiar el shell.
2. El sandbox bloqueó acceso al socket Docker: se solicitó y obtuvo ejecución con permisos ampliados para el servicio local.
3. El primer pull no encontró docker-credential-desktop: se repitió con PATH temporal del comando apuntando al binario oficial. No se inició sesión ni se conectó una cuenta.
4. El sandbox bloqueó la comprobación TCP desde la Mac: se repitió con permiso ampliado y pasó.

No se ejecutaron Xcode, swiftc, builds, Supabase CLI, cap sync, Gradle, StoreKit ni pruebas Apple.

## Integridad y Git

HEAD esperado y conservado: `0e50e01ff9916345915678728f6ecbe131efb741`. main coincide con origin/main local, sin fetch. Inicialmente 15 untracked, sin cambios tracked/staged.

Inventario inicial de esta continuación: `/private/tmp/abilene-phase38-local/initial-sha256.json`, 369 archivos tracked/untracked no ignorados. Comparación final: cero archivos iniciales modificados o ausentes. Incluye los 14 de Fase 36, el reporte de Fase 37 y las áreas protegidas Android/iOS/src/Supabase/Stripe/Admin/manifests.

Único archivo nuevo en el repositorio: este reporte. Resultado final: 16 untracked; sin cambios tracked/staged; git diff --check sin errores. Los diffs normales no incluyen archivos untracked.

## Límite de esta fase

Objetivo de infraestructura cumplido. Mantener los endpoints Apple cerrados. La aplicación de la migración y las pruebas reales quedan para la continuación expresamente autorizada de Fase 37/siguiente subfase. No se afirma que sus hallazgos estáticos hayan sido corregidos.

Cero conexiones o escrituras a Supabase producción; cero escrituras remotas. La descarga de la imagen y las consultas de documentación fueron lecturas públicas. Cero deploy, pagos, Apple Developer/App Store Connect, Sandbox Apple real, TestFlight, git add, commit, push, restore, reset o clean.
