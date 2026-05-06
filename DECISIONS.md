# Decisiones de Arquitectura - PropSys

Este documento fija el canon de ejecución y las decisiones que habilitan QA real sobre PostgreSQL sin ambigüedad.

## 1. Canon de Ejecución (QA)
- **Modo canónico:** DB.
- **Variable canónica:** `NEXT_PUBLIC_DATA_MODE=db` (cliente). Ver [.env.example](file:///c:/Users/angel/OneDrive/Escritorio/Empresa/propsys-frontend/.env.example).
- **Requisitos QA:** `DATABASE_URL` configurado + migraciones + seed.
  - `npm run db:migrate`
  - Configurar `PROPSYS_QA_SEED_PASSWORD` en `.env.local`.
  - `npm run db:seed`

## 2. Autenticación Real (cookie/sesión)
- **Cookie:** `ps_session` (HttpOnly).
- **Tabla:** `auth_sessions` con `expires_at` y `revoked_at`.
- **Regla de estado:** solo usuarios con `status = 'ACTIVE'` pueden iniciar sesión o mantener una sesión válida.
- **Protección server-side de rutas privadas:** middleware por paths `/admin`, `/staff`, `/resident`.
- **Limitación (Edge):** el middleware no valida DB (Postgres no es edge-compatible). Se valida forma de cookie y se confía la validación real al backend (API routes).
- **Mitigación login (V1):** retraso fijo en fallos de login. Rate limiting real por IP requiere store compartido y queda como riesgo.

## 3. Multi-tenant y Permisos
- **Aislamiento:** por `client_id` a nivel DB (todas las queries tenant-scoped cuando `scope !== 'platform'`).
- **Fuente de verdad de permisos:** `user_building_assignments` y `user_unit_assignments`.
- **Prohibición:** no basar permisos en `user.buildingId` cuando ya existe asignación real; ese campo solo es un "primer building" derivado para compatibilidad UI.

## 4. Acceso a Datos (Repos + API)
- **Repos (`lib/repos/**`):** switch por `NEXT_PUBLIC_DATA_MODE`.
- **DB-mode:** repos consultan `app/api/v1/**` con `credentials: 'include'`.
- **Mock-mode:** repos usan `lib/mocks/**` solo para desarrollo sin DB.

## 5. Auditoría (audit_logs)
- **Tabla:** `audit_logs` para trazabilidad por tenant.
- **Regla actual en escrituras de dominio:** si una mutación DB debe auditar y el insert en `audit_logs` falla, la request falla. La auditoría es bloqueante en operación/comunicación.
- **Excepción actual:** `login/logout` son best-effort; no bloquean autenticación. Si la auditoría falla, la respuesta expone `x-propsys-audit=failed`.

### 5.1 Matriz mínima de acciones críticas (estado real 2026-04-27)

| Acción crítica | Estado actual | Auditoría | Nota |
|---|---|---|---|
| Login / logout | Implementado | Sí, best-effort | Hoy solo tenant-scoped; `ROOT_ADMIN` con `client_id = NULL` queda diferido. |
| Crear incidencia / actualizar incidencia | Implementado | Sí | `CREATE` / `UPDATE` en rutas DB. |
| Crear tarea / reasignar / cambiar estado / aprobar tarea | Implementado | Sí | Incluye sync desde checklist cuando corresponde. |
| Crear checklist template / editar / eliminar | Implementado | Sí | Soft delete del template con auditoría. |
| Crear checklist execution / guardar / completar / aprobar / devolver | Implementado | Sí | Devuelve feedback de revisión y lo limpia al recompletar. |
| Subir evidencia / eliminar evidencia | Implementado | Sí | Acepta imagen/PDF; storage en filesystem local del servidor en DB-mode. |
| Crear reserva / aprobar o rechazar / cancelar | Implementado | Sí | Flujo V1 cubierto en rutas DB. |
| Crear y publicar aviso | Implementado | Sí | Publicación queda tenant-scoped o client-scoped explícita para root. |
| Listar / suspender / reactivar usuario | Implementado (mínimo) | Sí | `ROOT_ADMIN` y `CLIENT_MANAGER` con reglas conservadoras; suspender revoca sesiones activas. |
| Crear / editar usuario genérico | Implementado | Sí | (Ver 14.1/15) Flujo de alta/edición implementado; invitaciones por token para beta. |
| Crear edificio | Implementado | Sí | `POST /api/v1/physical/buildings`; solo `ROOT_ADMIN` / `CLIENT_MANAGER`. |
| Archivar / restaurar edificio | Implementado | Sí | `DELETE` / `PATCH /api/v1/physical/buildings/[id]`; bloquea si hay datos activos. |
| Crear unidad | Implementado | Sí | `POST /api/v1/physical/units`; solo `ROOT_ADMIN` / `CLIENT_MANAGER`. |
| Asignar owner / occupant a unidad | Implementado | Sí | `POST /api/v1/physical/unit-assignments`; soporta `ownerAsResident`; crea el usuario si no existe. |
| Liberar residencia (unassign occupant) | Implementado | Sí | `DELETE /api/v1/physical/unit-assignments`; archiva asignación activa. |
| Dar de alta staff por edificio | Implementado | No | `POST /api/v1/physical/staff`; crea usuario + asignación en transacción; **sin audit log**. |
| Crear / editar / anular recibo | Implementado | Sí | (Ver 14.1/15) Emisión y edición listas. Pendiente revisión de comprobantes para beta. |

## 6. Cobertura DB vs Mock (estado actual)
- **DB (canónico):**
  - Físico + asignaciones (incluye staff), usuarios, avisos, reservas, operación (incidents/tasks/checklists/evidence), financiero (receipts lectura).
- **Mock (solo fallback en `NEXT_PUBLIC_DATA_MODE=mock`):**
  - Mock-mode mantiene data falsa para desarrollo local; DB-mode es el modo canónico.

## 7. Cierre Técnico V1 (DB-mode) - 2026-04-10
- **Objetivo V1:** asegurar operación DB-mode real (PostgreSQL + Drizzle + auth real + seeds QA + middleware) sin abrir nuevas capacidades del roadmap.
- **Regla:** no tocar Planes, Root Admin ni abrir nuevas capacidades funcionales.

### 7.1 Tabla de estado por módulo (DB-ready)

| Módulo | UI (privado) | API DB (`/api/v1`) | DB schema | Seeds QA | Estado V1 | Observación |
|---|---|---:|---:|---:|---|---|
| Físico | Admin: Buildings/Common Areas/Staff + Resident: Units | Sí | Sí | Sí | Cerrado | Listado + creación de edificios/unidades + archivo/restauración de edificios + asignación owner/occupant + ownerAsResident + liberación de residencia + alta de staff; todo tenant-scoped. |
| Usuarios | Admin: Users | Sí | Sí | Sí | Cerrado (mínimo) | Listado + suspensión/reactivación con revocación de sesiones; sin creación/edición genérica ni papelera. (Nota: Ver 14.1/15 para estado actualizado) |
| Avisos | Admin: Notices + Resident: Notices | Sí | Sí | Sí | Cerrado | Lectura para todos (scoped por edificio/audience) + publicación para `CLIENT_MANAGER`/`BUILDING_ADMIN`. |
| Reservas | Admin: Reservations + Resident: Reservations | Sí | Sí | Sí | Cerrado | Crear (owner/occupant), aprobar/rechazar (building admin), cancelar (owner/occupant o building admin). |
| Operación | Staff: Tasks/Tickets + Admin/Resident: Tickets | Sí (Incidents/Tasks/Checklists/Evidence) | Sí | Sí | Cerrado (mínimo) | Templates + ejecuciones (guardar/completar/aprobar/devolver) + evidencias como imagen/PDF en filesystem local. |
| Financiero | Admin/Resident: Receipts | Sí (Receipts lectura) | Sí (Receipts) | Sí | Parcial | Solo lectura/listado por building o unit. Sin emisión/cobranza/pagos/reconciliación en V1. (Nota: Ver 14.1/15 para estado actualizado) |

### 7.2 Checklist/Evidence (decisión explícita V1)
- **Decisión V1:** implementar soporte DB mínimo para checklist/evidence con permisos por assignments y audit_logs.
- **Alcance mínimo actual:** templates + ejecuciones (guardar/completar/aprobar/devolver) + evidencias adjuntas como imagen/PDF.
- **Storage actual:** filesystem local del servidor en DB-mode. No hay storage externo, CDN, versionado ni política de retención avanzada.
- **Estado técnico:** DB-mode usa endpoints `app/api/v1/operation/*` y repos `lib/repos/operation/*`. Mock-mode queda como fallback solo para desarrollo.

### 7.3 Qué queda explícitamente cerrado/parcial/fuera de alcance
- **Cerrado V1 (DB-mode):** Físico (incluyendo creación, archivo/restauración de edificios, creación de unidades, asignación/liberación de residentes, alta de staff), Usuarios, Avisos, Reservas, Operación (Incidents/Tasks/Checklists/Evidence mínimo).
- **Parcial V1:** Financiero (solo lectura de receipts). (Nota: Ver 14.1 para estado actualizado)
- **Fuera de alcance V1:** storage productivo de evidencias (hoy filesystem local del servidor), Planes y límites comerciales, Root Admin canonical seed, financiero completo (emisión/pagos/reconciliación), creación/edición genérica de usuarios, audit log en alta de staff, y cualquier capacidad nueva. (Nota: Ver 14.1 y 15 para estado actualizado)

## 8. Flujo QA real (DB-mode con seeds)
1) Configurar `.env.local` (o variables) con `DATABASE_URL`, `NEXT_PUBLIC_DATA_MODE=db` y `PROPSYS_QA_SEED_PASSWORD` (ver [.env.example](file:///c:/Users/angel/OneDrive/Escritorio/Empresa/propsys-frontend/.env.example)).
   - `npm run db:seed`
3) Levantar la app:
   - `npm run dev`
4) Ingresar por `/` y usar el router `/router` post-login para aterrizar por rol.

### 8.1 Cuentas QA (seed)
- Contraseña QA: definir `PROPSYS_QA_SEED_PASSWORD` localmente antes de ejecutar `npm run db:seed`; el valor no se versiona ni se imprime.
- **Manager client_001:** `manager@propsys.com`
- **Manager client_002:** `manager.sur@propsys.com`
- **Building Admin asignado:** `building.admin@propsys.com` (asignado a `b1` y `b2`)
- **Building Admin sin asignación:** `building.admin.qa@propsys.com` (debe ver empty-states)
- **Owner:** `owner@propsys.com`
- **Occupant:** `tenant@propsys.com`

### 8.2 Checklist de verificación por rol (DB-mode)
- **Manager (client_001 / client_002):** Admin dashboard carga, listados físicos scoping por client, usuarios visibles por tenant, avisos se listan y se pueden publicar.
- **Building Admin asignado:** Admin dashboard carga, avisos por edificio (solo buildings asignados), reservas: aprobar/rechazar solicitudes del building, operación: incidencias/tareas + aprobación de checklists completados desde el dashboard.
- **Building Admin sin asignación:** Admin dashboard carga pero listados deben mostrar empty-state (no buildings/unidades); acciones protegidas por asignación deben fallar con "No autorizado" o quedar deshabilitadas.
- **Owner:** Resident receipts listados por unidad OWNER; reservas: crear/cancelar en unidad OWNER; avisos: lectura scoped por building.
- **Occupant:** Resident receipts listados por unidad OCCUPANT; reservas: crear/cancelar en unidad OCCUPANT; avisos: lectura scoped por building; operación: reportar incidencia (si UI lo permite por rol) debe respetar scoping.

## 9. Prueba de integración contra Postgres local (estrategia)
- Se agrega un smoke test real que se ejecuta solo si `VITEST_DB=1`.
- Archivo: [postgres.integration.test.ts](file:///c:/Users/angel/OneDrive/Escritorio/Empresa/propsys-frontend/lib/server/db/postgres.integration.test.ts)

### 9.1 Cómo correrla
- Requisitos: `DATABASE_URL` apunta a Postgres local con migraciones aplicadas.
- Opcional (para exigir seed): `VITEST_DB_EXPECT_SEEDS=1` + seed ejecutado.

En PowerShell (Windows):
- `setx VITEST_DB 1` (o en la misma sesión: `$env:VITEST_DB="1"`)
- `$env:VITEST_DB_EXPECT_SEEDS="1"` (si aplica)
- `npm test`

## 10. Riesgos remanentes (V1)
- Middleware edge solo valida forma de cookie; la validación real depende de API routes (riesgo asumido V1).
- No hay rate limiting real por IP (solo mitigación mínima en login).
- Evidencias en Operación ya aceptan imagen/PDF, pero el storage sigue siendo local al servidor. Falta resolver storage productivo y políticas de retención.
- Financiero solo lectura: no hay ciclo completo (emisión/pago/reconciliación) ni integraciones. (Nota: Ver actualización 14.1/15)

### 10.1 UI simulada o diferida visible hoy
- `/reset-password` sigue siendo una pantalla simulada de UX; no existe flujo real de token, email ni cambio de contraseña. (Nota: Confirmado para beta como flujo real, ver sección 15)
- `/setup` sigue siendo un wizard visual; no persiste configuración real ni provisiona tenants/usuarios.
- Los botones `Proximamente` visibles en admin/resident son placeholders internos de QA. No deben presentarse como funcionalidades cerradas en una beta externa o release pública.
- `ROOT_ADMIN` QA sigue siendo manual en DB local; todavía no forma parte canónica del seed.

### 10.2 Ajuste técnico de frontend
- Tailwind debe escanear también `./lib/**/*.{js,ts,jsx,tsx,mdx}` porque la UI reusable vive en `lib/features/**`. Si ese path no está en `tailwind.config.ts`, pueden aparecer layouts inconsistentes o clases faltantes aunque el código JSX sea correcto.

## 11. Lifecycle de usuarios y soft delete (estado real)
- **Regla implementada hoy:** solo `ACTIVE` puede iniciar sesión o mantener sesión válida.
- **Estados tipados hoy:** `ACTIVE`, `INACTIVE`, `SUSPENDED`, `ARCHIVED`.
- **Enforcement real hoy:** backend trata cualquier estado distinto de `ACTIVE` como bloqueado.
- **Cobertura actual:**
  - login bloquea `status !== 'ACTIVE'`
  - `getSessionUser()` revoca la sesión si el usuario deja de estar `ACTIVE`
  - `/api/v1/users/[id]` permite `SUSPENDED <-> ACTIVE`
  - suspender revoca sesiones activas del usuario afectado
- **Regla actual de gestión:**
  - `ROOT_ADMIN` puede suspender/reactivar usuarios client-scoped, excepto a sí mismo
  - `CLIENT_MANAGER` solo puede suspender/reactivar usuarios de su tenant y de rango inferior
  - no se permite tocar cuentas `scope='platform'` en este bloque
- **Gap actual:** no existe creación/edición server-side de usuarios, no existe `deleted_at` en `users`, no hay papelera de 30 días ni hard delete diferido. (Nota: Ver actualización 14.1)
- **Decisión actual:** la papelera/soft delete de usuarios queda diferida; no se cierra en este bloque.

## 12. Diferido explícito V1 (lista canónica)

Estos ítems están conscientemente fuera del alcance actual. No reabrir sin justificación nueva:

- Papelera / soft delete de usuarios (30 días).
- Creación y edición genérica server-side de usuarios. (Nota: Implementado, ver sección 14.1)
- Financiero completo: emisión, pago, conciliación y anulación real de recibos. (Nota: Ver sección 15 para alcance beta)
- Planes, límites y enforcement comercial.
- Storage productivo de evidencias fuera de filesystem local (CDN, object storage, políticas de retención).
- Canonización del `ROOT_ADMIN` como parte estable del seed QA.
- Reset password real (token + email + cambio de contraseña en DB).
- Setup real (wizard que persista configuración y provisione tenants/usuarios). (Nota: Ver sección 15)
- Audit log en alta de staff (`POST /api/v1/physical/staff`).
- Soporte interno avanzado / visor de audit logs en UI.

## 13. Cleanup estructural (estado 2026-04-20)
- `lib/data.ts` deja de existir como fachada de páginas privadas.
- `lib/repos/index.ts` deja de existir como barrel de consumo general.
- Las páginas privadas consumen fachadas de `lib/features/**`.
- Los repos se importan por ruta directa desde `lib/repos/**`.
- `lib/features/README.md` fija el patrón mínimo para nuevas pantallas y reduce el costo de agregar módulos sin reintroducir un barrel engañoso.

### 13.1 Módulo Tasks (estado 2026-04-21)
- `app/(private)/admin/tasks/page.tsx` y `app/(private)/staff/tasks/page.tsx` consumen loaders y acciones desde `lib/features/tasks/task-center.data.ts`.
- Las páginas privadas de tareas ya no importan repos de operación de forma directa.
- La orquestación de tareas, checklist, evidencia y review queda concentrada en la fachada de `lib/features/tasks/**`.
- `tasksRepo.updateForUser` y `tasksRepo.updateStatusForUser` comparten una sola ruta de validación/mock para reducir duplicación y drift.
- La presentación compartida de evidencias y labels de estado vive en `lib/features/tasks/task-center.ui.tsx`, evitando drift visual entre admin y staff.
- La revisión admin del checklist vive en `lib/features/tasks/task-review-dialog.tsx`; la página admin conserva estado, filtros y acciones, pero ya no mantiene el modal grande inline.
- La ejecución staff del checklist vive en `lib/features/tasks/task-checklist-dialog.tsx`; la página staff conserva estado y mutaciones, pero ya no mezcla la UI completa del checklist/evidencia dentro de la página.
- El módulo queda estructuralmente cerrado en este bloque: las páginas privadas de tareas quedaron reducidas a composición de pantalla, filtros, estado local y dispatch de acciones.
- `evidence` y `checklist-templates/[id]` ya usan los helpers compartidos de tenant scope, auditoría y transacciones; se cierra ese residuo de fase 0 dentro del módulo.

### 13.2 Diferido explícito tras este cleanup
Ver sección 12 para la lista canónica completa. En resumen: papelera de usuarios, creación/edición genérica de usuarios, financiero completo, planes/límites, storage productivo de evidencias, `ROOT_ADMIN` canonical seed, reset password real, setup real, audit log en alta de staff.

### 13.3 Módulos Admin Notices / Tickets / Receipts (estado 2026-04-21)
- `app/(private)/admin/notices/page.tsx` conserva estado y acciones, pero la presentación del listado y el modal de publicación se movieron a `lib/features/notices/notices-center.ui.tsx`.
- `app/(private)/admin/tickets/page.tsx` conserva filtros, estado y mutaciones, pero las cards y el modal de creación se movieron a `lib/features/tickets/ticket-center.ui.tsx`.
- `app/(private)/admin/receipts/page.tsx` conserva carga, búsqueda y navegación; la lista visual se movió a `lib/features/receipts/receipts-center.ui.tsx`.
- `app/(private)/admin/receipts/[id]/page.tsx` queda reducido a carga/errores y monta `AdminReceiptDetailView`, evitando que el detalle completo siga inline en la página.
- Criterio del bloque: las páginas privadas de admin quedan como shells de orquestación; la UI de dominio se mueve a `lib/features/**` cuando no agrega estado propio ni acceso directo a repos.

### 13.4 Módulos Admin Users / Buildings / Common Areas / Staff (estado 2026-04-21)
- `app/(private)/admin/users/page.tsx` conserva carga, búsqueda y mutación de lifecycle, pero la card de usuario se movió a `lib/features/users/users-center.ui.tsx`.
- `app/(private)/admin/buildings/page.tsx` queda reducido a shell de carga, búsqueda y render de `BuildingCard` desde `lib/features/physical/physical-center.ui.tsx`.
- `app/(private)/admin/common-areas/page.tsx` conserva estado de edificio, búsqueda y toggle de aprobación, pero la toolbar y las cards se movieron a `lib/features/physical/physical-center.ui.tsx`.
- `app/(private)/admin/staff/page.tsx` conserva carga/filtro por edificio, pero la toolbar y las cards de staff se movieron a `lib/features/physical/physical-center.ui.tsx`.
- Resultado: las páginas privadas admin de físico/usuarios quedan alineadas con el patrón shell + feature UI + feature data, igual que `tasks`, `notices`, `tickets` y `receipts`.

### 13.5 Módulos Resident Notices / Tickets / Receipts / Units (estado 2026-04-21)
- `app/(private)/resident/notices/page.tsx` mantiene carga y búsqueda, pero la card visual se mueve a `lib/features/notices/notices-center.ui.tsx` con `ResidentNoticeCard`.
- `app/(private)/resident/tickets/page.tsx` mantiene estado, carga y mutación de creación, pero el listado y el modal de alta se mueven a `lib/features/tickets/ticket-center.ui.tsx`.
- `app/(private)/resident/receipts/page.tsx` conserva carga, búsqueda y navegación, pero el resumen y el listado visual pasan a `lib/features/receipts/receipts-center.ui.tsx`.
- `app/(private)/resident/receipts/[id]/page.tsx` queda reducido a carga/errores y monta `ResidentReceiptDetailView`, eliminando el detalle inline con contenido fijo.
- `app/(private)/resident/units/page.tsx` conserva carga y empty states, pero la card de unidad se mueve a `lib/features/physical/physical-center.ui.tsx`.
- Resultado: el portal residente queda alineado con el mismo criterio de shells delgados + feature data + feature UI, sin tocar permisos ni comportamiento funcional.

### 13.6 Módulos Reservations Admin / Resident (estado 2026-04-21)
- `lib/features/reservations/reservations-center.ui.tsx` concentra ahora los chips de estado, las cards de reserva para admin/resident y el modal de creación residente.
- `app/(private)/admin/reservations/page.tsx` conserva carga, búsqueda y mutaciones (`approve/reject/cancel`), pero deja de mantener la card de reserva inline.
- `app/(private)/resident/reservations/page.tsx` conserva carga, búsqueda, cancelación y creación, pero delega el listado y el modal a la UI de feature.
- Criterio aplicado: `reservations-center.data.ts` sigue siendo la fachada de carga/acciones y las páginas privadas quedan reducidas a estado local, filtros y dispatch de acciones.

### 13.7 Dashboard + Router + Setup (estado 2026-04-21)
- `app/(private)/admin/dashboard/page.tsx` mantiene carga, errores y mutación de aprobación de checklist, pero delega KPI grid, panel de actividad, checklist panel y quick links a `lib/features/dashboard/admin-dashboard.ui.tsx`.
- `app/router/page.tsx` conserva la lógica de redirección y validación de `next`, pero reutiliza `RouterPageLoader` desde `lib/features/bootstrap/app-bootstrap.ui.tsx`.
- `app/setup/page.tsx` queda reducido a estado del wizard y navegación final; el frame, el loader y los pasos visuales se mueven a `lib/features/bootstrap/app-bootstrap.ui.tsx`.
- `lib/features/README.md` se actualiza para fijar el patrón real: `lib/features/**` ya concentra tanto fachadas de datos como UI reusable de dominio.

### 13.8 Residuales finales: Staff Tickets + Reset Password (estado 2026-04-21)
- `app/(private)/staff/tickets/page.tsx` conserva carga, búsqueda, alta y transición de estado, pero delega card y modal al feature `lib/features/tickets/ticket-center.ui.tsx`.
- `app/reset-password/page.tsx` queda reducido a estado local del formulario; la UI pública de recuperación se mueve a `lib/features/auth/reset-password.ui.tsx`.
- Criterio aplicado: incluso en páginas públicas o de staff, cuando la lógica es mínima y el peso real está en el markup, la pantalla queda como shell y la UI reusable vive en `lib/features/**`.

## 14. Actualizacion de estado (2026-05-04)

Esta seccion corrige desalineaciones entre el documento y el estado real del codigo a fecha 2026-05-04.

### 14.1 Correcciones de alcance ya implementado
- **Usuarios:** ya existe flujo server-side de creacion y edicion generica, ademas de suspension/reactivacion:
  - `POST /api/v1/users`
  - `PUT /api/v1/users/[id]`
  - `PATCH /api/v1/users/[id]`
- **Financiero (receipts):** ya no es solo lectura.
  - Implementado en DB: listar, crear, editar, cambiar estado (`PAID`/`CANCELLED`) y eliminar.
  - Rutas: `GET/POST /api/v1/finance/receipts`, `GET/PATCH/PUT/DELETE /api/v1/finance/receipts/[id]`.
- **Auditoria en usuarios y financiero:** estas mutaciones ya usan `insertAuditLog` dentro de transacciones.

### 14.2 Gaps que siguen abiertos y vigentes
- `POST /api/v1/physical/staff` sigue creando usuario + asignacion sin `insertAuditLog` explicito.
- `reset-password` sigue en modo simulado UX (sin token/email/cambio real en DB).
- `setup` sigue como wizard visual sin persistencia/provisionamiento real.
- Evidencias siguen en storage local de servidor (`.data/uploads/evidence`) sin object storage productivo.

### 14.3 Relectura de prioridades V1
- Donde el documento mencione "usuarios genericos no implementados" o "financiero solo lectura", considerar esa parte desactualizada y reemplazarla por 14.1.
- Se mantiene como **diferido**: papelera/soft-delete de usuarios, reconciliacion financiera e integraciones externas, planes/limites comerciales (enforcement tecnico).
- Pasa a **confirmado para beta**: modelo de comprobantes, invitaciones, reset password real, y decision de storage cloud (ver seccion 15).

## 15. Decisiones Confirmadas para Beta Privada (2026-05-04)

Esta sección consolida las definiciones arquitectónicas y funcionales para el siguiente bloque de desarrollo previo a la beta externa:

### 15.1 Flujo Financiero Beta
- No habrá pagos online, facturación electrónica ni conciliación bancaria automática en esta fase.
- Flujo: admin emite recibo -> resident/owner ve recibo -> paga por fuera -> sube comprobante -> building admin aprueba/rechaza.
- Al aprobar, el recibo pasa a estado `PAID`.
- Al rechazar, el recibo queda/sigue `PENDING` con un comentario/motivo de rechazo.

### 15.2 Modelo de Comprobantes de Pago
- Entidad dedicada: `receipt_payment_proofs`.
- El estado del comprobante (`PENDING_REVIEW`, `APPROVED`, `REJECTED`) se mantiene separado del `receipt.status`.
- No mezclar comprobantes con evidencias operativas (salvo justificación técnica). No usar `paymentProofUrl` directo en receipts (opción descartada).

### 15.3 Creación de Usuarios (Invitaciones) y Onboarding
- Login principal por email + contraseña.
- Nadie debe conocer la contraseña de otro usuario.
- Flujo: admin/manager invita email -> sistema genera token -> usuario recibe link y define su contraseña.
- Para la beta, el primer cliente/tenant y primer manager se crearán vía script/endpoint interno controlado. Luego, el manager invita al resto (building admin, owner, occupant, etc.).
- Portal Root Admin completo queda fuera de la beta.

### 15.4 Reset Password
- Flujo real basado en link/token enviado por correo electrónico.
- Evitar reseteos manuales por soporte donde el admin conozca la nueva contraseña (puede haber fallback manual temporal solo documentado como contingencia de beta cerrada).
- Desde ajustes, el usuario logueado podrá cambiar o iniciar el flujo de cambio de contraseña.

### 15.5 Storage
- Para desarrollo local se mantiene el uso de `.data`.
- Para beta externa, el storage local no es suficiente. Se requiere definir un proveedor cloud, pero la arquitectura debe prever compatibilidad con object storage privado.

### 15.6 Gaps y Diferidos Reafirmados
- **Planes y límites:** Se manejarán manualmente a nivel comercial para la beta. El enforcement técnico se difiere para post-beta.
- **Auditoría Staff:** Sigue pendiente el audit log explícito en `POST /api/v1/physical/staff`. Se mantiene como un bloque pequeño recomendado de implementación futura.


### 15.7 UX de Recibos (mini bloque de polish)
- El boton `Enviar recibo` queda fuera de beta y se elimina de la UI actual.
- El envio futuro (email/app/WhatsApp) se modelara dentro del bloque de notificaciones financieras, no como boton aislado.
- La descarga TXT deja de ser la accion principal visible.
- La accion visible en beta para exportar es `Imprimir / guardar PDF`, usando impresion del navegador.
- No se implementara PDF avanzado con librerias en esta fase.
- `Pagar todo` queda diferido para post-beta.
- En beta actual entran filtros y ordenamiento de recibos (admin y resident).
- Plantillas de cobro quedan registradas como siguiente bloque financiero grande.
- La generacion masiva de recibos queda despues del bloque de plantillas.
- Notificaciones financieras, cobros por reservas, pagos online, conciliacion bancaria y facturacion electronica se mantienen en roadmap futuro/post-beta.


## 16. Estado Final de Bloques Financiero y Auth (2026-05-05)

Esta sección actualiza el estado de las decisiones confirmadas en las secciones 14 y 15, tras la implementación exitosa de los bloques correspondientes.

### 16.1 Flujo Financiero y Comprobantes (Cerrado)
- Se completó el modelo de comprobantes (`receipt_payment_proofs`) y su flujo UI (subida por resident/owner, revisión por admin).
- Los recibos transicionan correctamente a estado `PAID` al aprobarse el comprobante.
- El polish UX de recibos (filtros, ordenamiento y acciones en tablas) ha sido completado.

### 16.2 Autenticación y Onboarding Seguro (Cerrado)
- **Invitaciones por link:** El flujo de invitaciones se cerró exitosamente tanto en UI como en backend.
- **Deprecación de contraseñas temporales:** Se eliminó por completo la generación y retorno de `tempPassword` en los endpoints de creación genérica (`POST /api/v1/users`), altas de staff (`POST /api/v1/physical/staff`), y asignaciones de unidades (`POST /api/v1/physical/unit-assignments`). Todo nuevo usuario entra por invitación.
- **Reset Password:** El flujo backend y UI para solicitar y confirmar reinicio de contraseña con token está cerrado.
- *Nota transaccional:* Ambos flujos (invitaciones y reset) funcionan de manera real pero, al carecer de proveedor de correo implementado, exponen los links generados en modo desarrollo/beta (ej. impresión en consola o en UI) temporalmente.

### 16.3 Ajustes de Alcance (Pendientes vs Futuro)
- **Pendientes Críticos antes de la Beta Externa:**
  - Implementar el proveedor de correo real.
  - Rate limiting estricto para rutas públicas de invitación y reset.
  - Interfaz/backend para revocar o reemitir invitaciones caducadas.
  - Plantillas de cobro y emisión masiva.
  - Cloud object storage (reemplazo imperativo de `.data` para archivos).
  - Polish en edición de usuarios (conversión a modal) y script de bootstrap para el primer tenant.
- **Post-Beta (Diferidos):**
  - Pagos online (pasarela), conciliación bancaria y facturación electrónica siguen diferidos. Notificaciones financieras quedan post-beta.
