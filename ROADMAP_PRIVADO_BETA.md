# Roadmap Privado Beta - PropSys

Fecha: 2026-05-15
Estado: Actualizado tras cierre de bloque de hardening de seguridad (Origin Guard y Rate Limiting Durable).

## 1) Objetivo
Alinear alcance beta, decisiones operativas y priorizar los bloques restantes antes de abrir el producto a clientes reales. **Nota de expectativas:** No se promete producción completa; faltan configuraciones de infraestructura cloud y pasarelas de pago.

## 2) Bloques Cerrados (Estado actual real)
**Financiero:**
- Flujo de comprobantes de pago manuales cerrado (entidad, backend, rules, UI).
- Subida de comprobantes por resident/owner y revisión por admin.
- Recepción de estados: al aprobar comprobante, el recibo pasa a `PAID`.
- Polish UX de recibos (filtros, ordenamiento y acciones).
- Validación en Render (Storage): Flujo `beta-storage-validation` completado. Supabase Storage funciona end-to-end para comprobantes (subida, persistencia, lectura y flujos de aprobación/rechazo).

**Core & UX (Post-Demo Comercial):**
- `ui-copy-polish`: Corrección ortográfica, tildes y revisión de UI copy en toda la app cerrado. Mejora directa a la percepción profesional (Commit `3f15006`).
- `users-list-filters`: Filtros en lista de usuarios (por Rol, Estado, Edificio y Unidad) implementados 100% en frontend sobre data segura. Validado en Render con root admin (Commit `a08e52e`).

**Auth & Onboarding:**
- Invitaciones por link (UI de creación, backend y flujo de aceptación).
- Deprecación completa de contraseñas temporales (`tempPassword`) en `users`, `staff` y `unit-assignments`.
- Reset password (Backend y UI) implementado.
  - `account-settings-v1` validado en Render (Commit `9edec9a`): `/account` funciona, muestra nombre, correo, rol y area/clientId. Cambio de contrasena validado: la contrasena anterior deja de funcionar y la nueva permite login.
  - `admin-invitations-management-v1` validado en Render (Commit `231598a`): ROOT_ADMIN puede crear invitacion, verla en Invitaciones, usar `REISSUE` para generar nuevo link, aceptar invitacion con ese link y usar `REVOKE` para limpiar invitaciones viejas.
  - `admin-invitations-form-polish` validado en Render (Commit `c366b32`): ROOT_ADMIN ve Clientes; CLIENT_MANAGER no ve Clientes pero si ve Invitaciones; el formulario usa cascada Cliente -> Edificio -> Unidad; CLIENT_MANAGER opera solo dentro de su cliente.
  - Gestión de Clientes (admin-clients-management-v1): Bloque administrativo cerrado (Commit `270e1da`).
  - `/admin/clients` funcional para ROOT_ADMIN (lista, crea, suspende/reactiva).
  - Validación en Render (Onboarding): Flujo completo de invitación validado con éxito (Commit `c20903b`). El fallback de link manual copiable se activa correctamente cuando el proveedor de email no está disponible, permitiendo al administrador dar de alta usuarios, quienes pueden definir su contraseña y quedar activos inmediatamente.
  - Integridad: `/admin/users` operativo y desacoplado de la creación de clientes.
  - Nota: No afecta sesiones/login actuales (aislado de middleware).
> **Aclaración:** El flujo de reset y las invitaciones operan mostrando un link seguro copiable cuando falla el envío de correo (modo dev/beta/fallback). Aún no se conectó a un proveedor de correo real persistente.
> **Regla operativa REVOKE:** `REVOKE` es terminal para la invitacion y mantiene el usuario asociado como `INACTIVE`. Si se perdio el link pero aun se quiere usar el mismo email/invitacion, debe usarse `REISSUE` antes de revocar.

**Seguridad (Hardening Beta):**
- `security-origin-guard`: Completado y validado en Render. Protección contra CSRF en métodos mutables activada.
- `durable-rate-limiting-core`: Completado y validado en Render. Tabla `rate_limit_buckets` operativa en Supabase.
- `durable-rate-limiting-authenticated-abuse`: Completado y validado en Render. Límites estrictos configurados por IP e Identidad en rutas sensibles de autenticación (login, reset), invitaciones y uploads (comprobantes/evidencias).

## 3) Decisiones consolidadas
- **Financiero:** `Enviar recibo` y `Pagar todo` quedan post-beta. La exportación visible será "Imprimir / guardar PDF" nativa del navegador. 
- **Auth:** Todo usuario nuevo entra vía invitación por token. Las contraseñas manuales/inseguras quedan erradicadas del sistema de altas.
- **Storage:** Comprobantes de pago utilizan Supabase Storage en producción. La persistencia en disco local `.data` queda exclusivamente como fallback legacy/local.
## 4) Feedback y Backlog Post-Demo Comercial
Tras la reunión comercial y demo con una empresa real, se identificaron los siguientes puntos:

- **Ortografía y Copy (CERRADO):** Detalles ortográficos afectaban la percepción profesional. Resuelto en `ui-copy-polish`.
- **Filtros de Usuarios (CERRADO):** Faltaba capacidad de segmentación para clientes grandes. Resuelto en `users-list-filters`.
- **Incidencias (PENDIENTE):** Falta revisar mejor el flujo de `incidents-staff-workflow` (quién reporta, quién se hace cargo, estados, conexión con staff y tareas).
- **Reservas (PENDIENTE):** Falta revisar el calendario y disponibilidad por área común en `reservations-calendar-view`.
- **Panel Financiero (PENDIENTE ESTRATÉGICO):** El bloque financiero actual se limita a recibos y comprobantes. Se considera una carencia importante la falta de un panel financiero completo (`finance-dashboard-v1`: detalle de recibos, ingresos, egresos, morosidad, gastos, estados financieros y reportes). 

**Reglas de Finanzas (Post-Demo):** 
No se debe sobreprometer. El sistema actualmente emite recibos y gestiona comprobantes, pero *no sustituye aún a un módulo financiero completo*. El bloque `finance-dashboard-v1` es una épica estratégica grande y **no debe implementarse sin un discovery previo y un diseño de modelo de datos**.

**Próximos bloques recomendados:**
1. Auditar incidencias (`incidents-staff-workflow`).
2. Auditar reservas/calendario (`reservations-calendar-view`).
3. Discovery financiero (`finance-dashboard-v1`).

## 5) Pendientes Críticos (Antes de beta real)
- Provider de correo real (email provider).
- Reset password validado con email real.
- `beta-final-readiness-review` antes de abrir con empresa real.
- Limpieza periodica de buckets expirados del rate limiting.
- Auditoria general de secrets y env vars.
- Plantillas de cobro (diseno y asignacion por unidad/edificio).
- Emision masiva de recibos (desde plantillas).
- Polish UX: Edicion de usuarios en modalidad *modal* o inline.
- Bootstrap/script inicial controlado para dar de alta al primer cliente/manager en el entorno productivo.
- Limpieza de usuarios "fantasma": Gestion o purga de usuarios `INACTIVE` creados por invitaciones que nunca fueron aceptadas.
## 6) Pendientes Post-Beta (Nice-to-have / Futuro)
  - Pagos online (pasarela), conciliación bancaria y facturación electrónica siguen diferidos. Notificaciones financieras quedan post-beta.

## 17. Transición de Beta Freeze (2026-07-01)

El ciclo de estabilización (Beta Freeze) ha concluido y el estado de la aplicación ahora es apto para un entorno pre-productivo apuntando a su primer cliente real. 
A partir de este punto, la planificación estratégica y los próximos ciclos de producto se trasladan a los siguientes documentos:
- **`docs/REUNION_GESTORA_PRODUCT_INPUT.md`**: Discovery, dolores priorizados y decisiones de la reunión con la gestora inmobiliaria.
- **`docs/POST_FREEZE_ROADMAP.md`**: Nuevo roadmap unificado y orientado al cliente real.

Este documento (`ROADMAP_PRIVADO_BETA.md`) se mantiene estrictamente como registro histórico de las decisiones técnicas y operativas de la fase 0/Beta Privada. No añadir más evolutivos funcionales aquí.

- Planes comerciales y limites de uso con enforcement tecnico.
- CSP enforcement.
- MFA futuro.
- SIEM / centralizacion de eventos de seguridad.

### admin-clients-access-lockdown
- Usuarios de clientes SUSPENDED todavía no son bloqueados automáticamente en login/sesión.
- Esto queda fuera de `admin-clients-management-v1`.
- Pendiente decidir:
  1. Si se bloquea login.
  2. Si se invalidan sesiones activas.
  3. Qué mensaje verá el usuario.
  4. Si ROOT_ADMIN conserva acceso de soporte.
  5. Si las APIs deben validar `client.status`.
  6. Cómo se audita el bloqueo.
- **Prioridad:** Antes de beta pública o antes de permitir suspensión real de clientes en producción.

