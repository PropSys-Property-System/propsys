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
- **Email Real:** No esperar correos automáticos (usar links manuales).
- **MFA:** No disponible.
- **Suspensión de Sesión:** La suspensión de clientes no cierra sesiones activas inmediatamente.
- **Gestión de Invitaciones:** No hay UI para listar/revocar invitaciones pendientes (se requiere apoyo de soporte vía DB si se pierde un link).
- **Mi Cuenta:** No hay edición de perfil de usuario.

## 8. Checklist de Evidencia
- [ ] Usuario creado y logueado con éxito.
- [ ] Comprobante visualizado correctamente en el panel de administración.
- [ ] Archivo persiste en Supabase tras 24 horas.
- [ ] El rate limit no bloquea uso legítimo pero sí ráfagas (verificar en logs de Render).
- [ ] El Origin Guard no bloquea navegación legítima.

## 9. Plan de Soporte y Rollback
- **Canal de Soporte:** Grupo de WhatsApp directo con el equipo técnico.
- **Incidencias:** Reportar errores con captura de pantalla y hora exacta para revisar logs en Render/Vercel.
- **Rollback:** En caso de corrupción de datos críticos, se procederá a un `point-in-time recovery` de Supabase (máximo 24h de pérdida).
- **Hard-Reset:** Si la beta falla catastróficamente, se suspende el acceso al cliente desde el panel ROOT_ADMIN.

## 10. Pendientes Post-Beta
- Integración de Resend/SendGrid para correos reales.
- UI de gestión de invitaciones pendientes (re-enviar/revocar).
- Job de limpieza para `rate_limit_buckets`.
- Implementación de MFA para roles administrativos.
- Lockdown completo de sesiones para clientes suspendidos.
