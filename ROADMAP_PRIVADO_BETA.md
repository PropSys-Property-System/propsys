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

**Auth & Onboarding:**
- Invitaciones por link (UI de creación, backend y flujo de aceptación).
- Deprecación completa de contraseñas temporales (`tempPassword`) en `users`, `staff` y `unit-assignments`.
- Reset password (Backend y UI) implementado.
  - Gestión de Clientes (admin-clients-management-v1): Bloque administrativo cerrado (Commit `270e1da`).
  - `/admin/clients` funcional para ROOT_ADMIN (lista, crea, suspende/reactiva).
  - Validación en Render (Onboarding): Flujo completo de invitación validado con éxito (Commit `c20903b`). El fallback de link manual copiable se activa correctamente cuando el proveedor de email no está disponible, permitiendo al administrador dar de alta usuarios, quienes pueden definir su contraseña y quedar activos inmediatamente.
  - Integridad: `/admin/users` operativo y desacoplado de la creación de clientes.
  - Nota: No afecta sesiones/login actuales (aislado de middleware).
> **Aclaración:** El flujo de reset y las invitaciones operan mostrando un link seguro copiable cuando falla el envío de correo (modo dev/beta/fallback). Aún no se conectó a un proveedor de correo real persistente.

**Seguridad (Hardening Beta):**
- `security-origin-guard`: Completado y validado en Render. Protección contra CSRF en métodos mutables activada.
- `durable-rate-limiting-core`: Completado y validado en Render. Tabla `rate_limit_buckets` operativa en Supabase.
- `durable-rate-limiting-authenticated-abuse`: Completado y validado en Render. Límites estrictos configurados por IP e Identidad en rutas sensibles de autenticación (login, reset), invitaciones y uploads (comprobantes/evidencias).

## 3) Decisiones consolidadas
- **Financiero:** `Enviar recibo` y `Pagar todo` quedan post-beta. La exportación visible será "Imprimir / guardar PDF" nativa del navegador. 
- **Auth:** Todo usuario nuevo entra vía invitación por token. Las contraseñas manuales/inseguras quedan erradicadas del sistema de altas.
- **Storage:** Comprobantes de pago utilizan Supabase Storage en producción. La persistencia en disco local `.data` queda exclusivamente como fallback legacy/local.

## 4) Pendientes Críticos (Antes de beta real)
- Provider de correo real (email provider). El flujo completo de reset password queda pendiente de validación con email provider real o definiendo su fallback oficial para la beta.
- Limpieza periódica de buckets expirados del rate limiting.
- Revisión de headers de seguridad y CSP.
- Auditoría general de secrets y env vars.
- Capacidad para revocar/reemitir invitaciones caducadas.
- Plantillas de cobro (diseño y asignación por unidad/edificio).
- Emisión masiva de recibos (desde plantillas).
- Polish UX: Edición de usuarios en modalidad *modal* o inline.
- Bootstrap/script inicial controlado para dar de alta al primer cliente/manager en el entorno productivo.
- Gestión de invitaciones pendientes: UI para listar, reemitir (copiar link) o revocar invitaciones que no han sido aceptadas.
- Limpieza de usuarios "fantasma": Gestión o purga de usuarios `INACTIVE` creados por invitaciones que nunca fueron aceptadas.

## 5) Pendientes Post-Beta (Nice-to-have / Futuro)
- Pagos online (pasarela de pago).
- Conciliación bancaria.
- Facturación electrónica.
- Cobros automatizados por reservas.
- Notificaciones financieras activas (email/app/WhatsApp).
- Planes comerciales y límites de uso con enforcement técnico.
- MFA futuro.

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

