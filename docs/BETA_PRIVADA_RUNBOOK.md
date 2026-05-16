# Runbook: Beta Privada Controlada - PropSys

## 1. Objetivo de la Beta Privada
Validar la estabilidad técnica y operativa de los flujos críticos de PropSys con una empresa real en un entorno productivo (Render/Supabase) antes de la apertura masiva. El foco está en la **integridad de los datos financieros** y la **usabilidad del onboarding**.

## 2. Roles Involucrados
- **ROOT_ADMIN (Soporte PropSys):** Ejecuta el bootstrap del cliente y supervisa logs.
- **CLIENT_MANAGER (Administrador de la Empresa):** Crea edificios, unidades e invita a su equipo/residentes.
- **BUILDING_ADMIN (Gestor de Edificio):** Revisa comprobantes y gestiona el día a día.
- **RESIDENT (Propietario/Inquilino):** Sube comprobantes de pago y visualiza sus recibos.

## 3. Preparación Previa (Infraestructura)
1. **Base de Datos:** Verificar migración `0010` (rate limiting) aplicada en Supabase.
2. **Storage:** Buckets `propsys-payment-proofs` y `propsys-operation-evidence` creados y con RLS configurada.
3. **Seguridad:** Origin Guard activo y Rate Limiting configurado en Render.
4. **Email Fallback:** Confirmar que `PROPSYS_EXPOSE_AUTH_TOKENS` está en `0` (seguridad) y que el sistema está listo para mostrar links manuales ante la falta de proveedor de correo real.

## 3.1 Validaciones recientes en Render
- `account-settings-v1` (Commit `9edec9a`): `/account` funciona, muestra nombre, correo, rol y area/clientId. Cambio de contrasena validado: la anterior deja de funcionar y la nueva permite login.
- `admin-invitations-management-v1` (Commit `231598a`): ROOT_ADMIN crea invitacion, la ve en Invitaciones, `REISSUE` genera nuevo link, el link permite aceptar la invitacion, la invitacion desaparece de pendientes y `REVOKE` limpia invitaciones viejas.
- `admin-invitations-form-polish` (Commit `c366b32`): ROOT_ADMIN ve Clientes; CLIENT_MANAGER no ve Clientes; CLIENT_MANAGER si ve Invitaciones; la cascada Cliente -> Edificio -> Unidad funciona; CLIENT_MANAGER opera solo dentro de su cliente.
- Regla operativa: `REVOKE` es terminal y mantiene el usuario asociado como `INACTIVE`. Si se perdio el link y aun se quiere usar ese email/invitacion, usar `REISSUE` antes de revocar.

## 4. Flujo Bootstrap (Alta de Empresa)
1. **Crear Cliente:** El ROOT_ADMIN ingresa a `/admin/clients` y crea la empresa (e.g., "Inmobiliaria Real").
2. **Invitar Manager:** Dentro de la gestión de la empresa, invitar al primer `CLIENT_MANAGER`.
3. **Copia de Link:** Debido a la falta de email provider, copiar el link de invitación generado en la UI de administración.
4. **Aceptar Invitación:** Enviar el link al Manager por canal seguro (WhatsApp/Email personal). El Manager define su contraseña y activa su cuenta.

## 5. Setup Operativo (Configuración del Cliente)
El `CLIENT_MANAGER` debe:
1. **Crear Edificios:** Registrar al menos un edificio real.
2. **Crear Unidades:** Registrar departamentos/oficinas.
3. **Invitar Residentes:** Asociar `OWNER` u `OCCUPANT` a las unidades mediante el flujo de invitación (copiando y entregando links manualmente).
4. **Invitar Staff:** Crear `BUILDING_ADMIN` para el edificio.

## 6. Flujos a Probar (Prioridad 1)
- **Acceso:** Login y Logout en todos los roles.
- **Onboarding:** Aceptación de invitaciones y definición de contraseñas.
- **Finanzas:** 
  - Creación de recibos (vía DB/Seed controlado por ahora, o UI si está disponible).
  - Subida de comprobantes (JPG/PNG/PDF) por el Residente.
  - Verificación de almacenamiento en Supabase Storage.
- **Revisión:** Aprobación/Rechazo de comprobantes por parte del Admin/Manager y cambio de estado del recibo a `PAID`.

## 7. Limitaciones (NO Probar todavía)
- **Email Real:** No asumir correos automaticos hasta configurar y validar provider real.
- **Reset con Email Real:** Backend/UI funcionan, pero queda pendiente validar reset password usando email real end-to-end.
- **MFA:** No disponible.
- **Suspension de Sesion:** La suspension de clientes no cierra sesiones activas inmediatamente.
- **REVOKE de invitaciones:** Es terminal; no usar si solo se perdio el link. Primero usar `REISSUE` si se quiere conservar el flujo con ese email.

## 8. Checklist de Evidencia
- [ ] Usuario creado y logueado con exito.
- [ ] `/account` muestra nombre, correo, rol y area/clientId.
- [ ] Cambio de contrasena desde `/account` invalida la anterior y permite login con la nueva.
- [ ] ROOT_ADMIN puede crear, reemitir y revocar invitaciones desde Invitaciones.
- [ ] CLIENT_MANAGER ve Invitaciones, no ve Clientes y opera solo dentro de su cliente.
- [ ] Cascada Cliente -> Edificio -> Unidad funciona en invitaciones.
- [ ] Comprobante visualizado correctamente en el panel de administracion.
- [ ] Archivo persiste en Supabase tras 24 horas.
- [ ] El rate limit no bloquea uso legitimo pero si rafagas (verificar en logs de Render).
- [ ] El Origin Guard no bloquea navegacion legitima.

## 9. Plan de Soporte y Rollback
- **Canal de Soporte:** Grupo de WhatsApp directo con el equipo técnico.
- **Incidencias:** Reportar errores con captura de pantalla y hora exacta para revisar logs en Render/Vercel.
- **Rollback:** En caso de corrupción de datos críticos, se procederá a un `point-in-time recovery` de Supabase (máximo 24h de pérdida).
- **Hard-Reset:** Si la beta falla catastróficamente, se suspende el acceso al cliente desde el panel ROOT_ADMIN.

## 10. Pendientes Post-Beta
- Integracion de Resend/SendGrid para correos reales.
- Reset password validado con email real.
- `beta-final-readiness-review`.
- Job de limpieza para `rate_limit_buckets`.
- CSP enforcement.
- Implementacion de MFA para roles administrativos.
- SIEM / centralizacion de eventos de seguridad.
- Lockdown completo de sesiones para clientes suspendidos.
