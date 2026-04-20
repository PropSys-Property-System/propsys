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

### 5.1 Matriz mínima de acciones críticas (estado real 2026-04-19)

| Acción crítica | Estado actual | Auditoría | Nota |
|---|---|---|---|
| Login / logout | Implementado | Sí, best-effort | Hoy solo tenant-scoped; `ROOT_ADMIN` con `client_id = NULL` queda diferido. |
| Crear incidencia / actualizar incidencia | Implementado | Sí | `CREATE` / `UPDATE` en rutas DB. |
| Crear tarea / reasignar / cambiar estado / aprobar tarea | Implementado | Sí | Incluye sync desde checklist cuando corresponde. |
| Crear checklist template / editar / eliminar | Implementado | Sí | Soft delete del template con auditoría. |
| Crear checklist execution / guardar / completar / aprobar / devolver | Implementado | Sí | Devuelve feedback de revisión y lo limpia al recompletar. |
| Subir evidencia / eliminar evidencia | Implementado | Sí | Auditoría existe hoy con helper SQL local a Evidence. |
| Crear reserva / aprobar o rechazar / cancelar | Implementado | Sí | Flujo V1 cubierto en rutas DB. |
| Crear y publicar aviso | Implementado | Sí | Publicación queda tenant-scoped o client-scoped explícita para root. |
| Listar / suspender / reactivar usuario | Implementado (mínimo) | Sí | `ROOT_ADMIN` y `CLIENT_MANAGER` con reglas conservadoras; suspender revoca sesiones activas. |
| Crear / editar usuario | No implementado | N/A | Sigue fuera de alcance en este bloque. |
| Crear / editar edificio o unidad | No implementado | N/A | Hoy físico expone lectura; `common_areas` sí tiene mutación parcial con auditoría. |
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
| Físico | Admin: Buildings/Common Areas/Staff + Resident: Units | Sí | Sí | Sí | Cerrado | Listados tenant-scoped + asignaciones por edificio/unidad (fuente de verdad). |
| Usuarios | Admin: Users | Sí | Sí | Sí | Cerrado (mínimo) | Listado + suspensión/reactivación con revocación de sesiones; sin creación/edición/papelera todavía. |
| Avisos | Admin: Notices + Resident: Notices | Sí | Sí | Sí | Cerrado | Lectura para todos (scoped por edificio/audience) + publicación para `CLIENT_MANAGER`/`BUILDING_ADMIN`. |
| Reservas | Admin: Reservations + Resident: Reservations | Sí | Sí | Sí | Cerrado | Crear (owner/occupant), aprobar/rechazar (building admin), cancelar (owner/occupant o building admin). |
| Operación | Staff: Tasks/Tickets + Admin/Resident: Tickets | Sí (Incidents/Tasks/Checklists/Evidence) | Sí | Sí | Cerrado (mínimo) | Checklist/Evidence DB mínimo: templates + ejecuciones + evidencias como enlaces. |
| Financiero | Admin/Resident: Receipts | Sí (Receipts lectura) | Sí (Receipts) | Sí | Parcial | Solo lectura/listado por building o unit. Sin emisión/cobranza/pagos/reconciliación en V1. |

### 7.2 Checklist/Evidence (decisión explícita V1)
- **Decisión V1:** implementar soporte DB mínimo para checklist/evidence con permisos por assignments y audit_logs.
- **Alcance mínimo actual:** templates + ejecuciones (guardar/completar/aprobar/devolver) + evidencias adjuntas como imagen/PDF.
- **Storage actual:** filesystem local del servidor en DB-mode. No hay storage externo, CDN, versionado ni política de retención avanzada.
- **Estado técnico:** DB-mode usa endpoints `app/api/v1/operation/*` y repos `lib/repos/operation/*`. Mock-mode queda como fallback solo para desarrollo.

### 7.3 Qué queda explícitamente cerrado/parcial/fuera de alcance
- **Cerrado V1 (DB-mode):** Físico, Usuarios, Avisos, Reservas, Operación (Incidents/Tasks/Checklists/Evidence mínimo).
- **Parcial V1:** Financiero (solo lectura de receipts).
- **Fuera de alcance V1:** storage/subida de evidencias (archivos), Planes, Root Admin, financiero completo (emisión/pagos/reconciliación) y cualquier capacidad nueva.

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

## 12. Recomendación de siguiente paso
- **Siguiente paso recomendado:** cerrar el cleanup estructural y dejar documentado lo diferido de V1.
- **Bloque recomendado ahora:** consolidar helpers/guards repetidos de API y bajar aún más el costo de mantenimiento.
- **Diferido explícito:** papelera de usuarios, creación/edición de usuarios, financiero completo, reservas avanzadas y planes/límites.

## 13. Cleanup estructural (estado 2026-04-20)
- `lib/data.ts` deja de existir como fachada de páginas privadas.
- `lib/repos/index.ts` deja de existir como barrel de consumo general.
- Las páginas privadas consumen fachadas de `lib/features/**`.
- Los repos se importan por ruta directa desde `lib/repos/**`.
- `lib/features/README.md` fija el patrón mínimo para nuevas pantallas y reduce el costo de agregar módulos sin reintroducir un barrel engañoso.

