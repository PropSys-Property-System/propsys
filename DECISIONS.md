# Decisiones de Arquitectura - PropSys

Este documento fija el canon de ejecución y las decisiones que habilitan QA real sobre PostgreSQL sin ambigüedad.

## 1. Canon de Ejecución (QA)
- **Modo canónico:** DB.
- **Variable canónica:** `NEXT_PUBLIC_DATA_MODE=db` (cliente). Ver [.env.example](file:///c:/Users/angel/OneDrive/Escritorio/Empresa/propsys-frontend/.env.example).
- **Requisitos QA:** `DATABASE_URL` configurado + migraciones + seed.
  - `npm run db:migrate`
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
| Crear / editar usuario genérico | No implementado | N/A | Sin flujo de alta/edición general de usuarios; sigue diferido. |
| Crear edificio | Implementado | Sí | `POST /api/v1/physical/buildings`; solo `ROOT_ADMIN` / `CLIENT_MANAGER`. |
| Archivar / restaurar edificio | Implementado | Sí | `DELETE` / `PATCH /api/v1/physical/buildings/[id]`; bloquea si hay datos activos. |
| Crear unidad | Implementado | Sí | `POST /api/v1/physical/units`; solo `ROOT_ADMIN` / `CLIENT_MANAGER`. |
| Asignar owner / occupant a unidad | Implementado | Sí | `POST /api/v1/physical/unit-assignments`; soporta `ownerAsResident`; crea el usuario si no existe. |
| Liberar residencia (unassign occupant) | Implementado | Sí | `DELETE /api/v1/physical/unit-assignments`; archiva asignación activa. |
| Dar de alta staff por edificio | Implementado | No | `POST /api/v1/physical/staff`; crea usuario + asignación en transacción; **sin audit log**. |
| Crear / editar / anular recibo | No implementado | N/A | Financiero sigue en lectura. |

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
| Usuarios | Admin: Users | Sí | Sí | Sí | Cerrado (mínimo) | Listado + suspensión/reactivación con revocación de sesiones; sin creación/edición genérica ni papelera. |
| Avisos | Admin: Notices + Resident: Notices | Sí | Sí | Sí | Cerrado | Lectura para todos (scoped por edificio/audience) + publicación para `CLIENT_MANAGER`/`BUILDING_ADMIN`. |
| Reservas | Admin: Reservations + Resident: Reservations | Sí | Sí | Sí | Cerrado | Crear (owner/occupant), aprobar/rechazar (building admin), cancelar (owner/occupant o building admin). |
| Operación | Staff: Tasks/Tickets + Admin/Resident: Tickets | Sí (Incidents/Tasks/Checklists/Evidence) | Sí | Sí | Cerrado (mínimo) | Templates + ejecuciones (guardar/completar/aprobar/devolver) + evidencias como imagen/PDF en filesystem local. |
| Financiero | Admin/Resident: Receipts | Sí (Receipts lectura) | Sí (Receipts) | Sí | Parcial | Solo lectura/listado por building o unit. Sin emisión/cobranza/pagos/reconciliación en V1. |

### 7.2 Checklist/Evidence (decisión explícita V1)
- **Decisión V1:** implementar soporte DB mínimo para checklist/evidence con permisos por assignments y audit_logs.
- **Alcance mínimo actual:** templates + ejecuciones (guardar/completar/aprobar/devolver) + evidencias adjuntas como imagen/PDF.
- **Storage actual:** filesystem local del servidor en DB-mode. No hay storage externo, CDN, versionado ni política de retención avanzada.
- **Estado técnico:** DB-mode usa endpoints `app/api/v1/operation/*` y repos `lib/repos/operation/*`. Mock-mode queda como fallback solo para desarrollo.

### 7.3 Qué queda explícitamente cerrado/parcial/fuera de alcance
- **Cerrado V1 (DB-mode):** Físico (incluyendo creación, archivo/restauración de edificios, creación de unidades, asignación/liberación de residentes, alta de staff), Usuarios, Avisos, Reservas, Operación (Incidents/Tasks/Checklists/Evidence mínimo).
- **Parcial V1:** Financiero (solo lectura de receipts).
- **Fuera de alcance V1:** storage productivo de evidencias (hoy filesystem local del servidor), Planes y límites comerciales, Root Admin canonical seed, financiero completo (emisión/pagos/reconciliación), creación/edición genérica de usuarios, audit log en alta de staff, y cualquier capacidad nueva.

## 8. Flujo QA real (DB-mode con seeds)
1) Configurar `.env.local` (o variables) con `DATABASE_URL` y `NEXT_PUBLIC_DATA_MODE=db` (ver [.env.example](file:///c:/Users/angel/OneDrive/Escritorio/Empresa/propsys-frontend/.env.example)).
2) Ejecutar migraciones y seed:
   - `npm run db:migrate`
   - `npm run db:seed`
3) Levantar la app:
   - `npm run dev`
4) Ingresar por `/` y usar el router `/router` post-login para aterrizar por rol.

### 8.1 Cuentas QA (seed)
- Password QA: `PropsysQA#2026`
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
- Financiero solo lectura: no hay ciclo completo (emisión/pago/reconciliación) ni integraciones.

### 10.1 UI simulada o diferida visible hoy
- `/reset-password` sigue siendo una pantalla simulada de UX; no existe flujo real de token, email ni cambio de contraseña.
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
- **Gap actual:** no existe creación/edición server-side de usuarios, no existe `deleted_at` en `users`, no hay papelera de 30 días ni hard delete diferido.
- **Decisión actual:** la papelera/soft delete de usuarios queda diferida; no se cierra en este bloque.

## 12. Diferido explícito V1 (lista canónica)

Estos ítems están conscientemente fuera del alcance actual. No reabrir sin justificación nueva:

- Papelera / soft delete de usuarios (30 días).
- Creación y edición genérica server-side de usuarios.
- Financiero completo: emisión, pago, conciliación y anulación real de recibos.
- Planes, límites y enforcement comercial.
- Storage productivo de evidencias fuera de filesystem local (CDN, object storage, políticas de retención).
- Canonización del `ROOT_ADMIN` como parte estable del seed QA.
- Reset password real (token + email + cambio de contraseña en DB).
- Setup real (wizard que persista configuración y provisione tenants/usuarios).
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

