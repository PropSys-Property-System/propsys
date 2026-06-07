# Checklist de Congelamiento Beta (Beta Freeze)

## 1. Comandos de Validación Estricta
Antes de cualquier despliegue a entorno Demo o Producción, se debe asegurar que el codebase pase estas pruebas sin errores:

```bash
npm run lint
npm run check:types
npm run test
npm run build
```

## 2. Smoke Test por Rol
Una vez desplegado el entorno, ejecutar manualmente este ciclo básico para certificar operatividad:
- **ROOT_ADMIN:**
  - [ ] Crear un cliente.
  - [ ] Asignar un Building Admin.
- **BUILDING_ADMIN:**
  - [ ] Ingresar y crear un Edificio y una Unidad.
  - [ ] Invitar a un Residente a la Unidad.
  - [ ] Emitir un Recibo manual.
- **RESIDENT (OWNER/OCCUPANT):**
  - [ ] Iniciar sesión desde link de invitación.
  - [ ] Crear una incidencia y subir una imagen (Evidencia).
  - [ ] Subir un comprobante (transferencia) al recibo PENDIENTE.
- **BUILDING_ADMIN (Cierre):**
  - [ ] Aprobar el comprobante (Recibo -> PAID).
  - [ ] Cerrar la incidencia.

## 3. Checklist Render / Variables de Entorno
Para el correcto funcionamiento en la nube, asegurar la configuración de:
- [ ] `DATABASE_URL` (PostgreSQL productivo).
- [ ] `SESSION_SECRET` (Para firmado de cookies seguras).
- [ ] URL Base correcta para Origin Guard / CORS.

## 4. Checklist Storage (Archivos y Comprobantes)
El código de PropSys soporta Supabase Storage para persistencia segura en la nube.
- [ ] Configurar `SUPABASE_URL` en `.env`.
- [ ] Configurar `SUPABASE_STORAGE_EVIDENCE_BUCKET` en `.env`.
> **Advertencia:** Si estas variables se omiten, el sistema activará el fallback de disco local y escribirá los archivos en `.data/uploads`. En Render (entornos sin disco persistente adjunto), estos archivos **se borrarán** en cada reinicio. Esto es aceptable solo para Demo, pero bloqueante para Cliente Real.

## 5. Checklist Email / Fallback
- [ ] Configurar SMTP/Provider (ej. Resend) antes del cliente real.
> **Advertencia:** Actualmente las invitaciones y los correos de recuperación de contraseña **solo se imprimen en la consola del servidor** si no hay un proveedor conectado. Es válido para QA y Demo Local, pero no operable en producción.

## 6. Qué NO Prometer al Cliente Inicial
- [ ] No prometer pago con tarjeta o cobro automático (no está conectado Stripe/MercadoPago).
- [ ] No prometer notificaciones por SMS o Push a celulares (App nativa fuera de alcance).
- [ ] No prometer reportes automáticos contables al fisco (fuera de alcance de la V1).
- [ ] Recuperación de data borrada ("papelera de reciclaje") no está implementada aún.

## 7. Riesgos Aceptados
1. **Edge Middleware Optimista:** La comprobación `middleware.ts` en rutas protegidas valida únicamente la estructura de la cookie de sesión para no penalizar el SSR. Las apis mutables protegen la integridad final.
2. **Alta de Staff sin Auditoría Inicial:** La creación manual de STAFF actualmente no emite registro a `audit_logs`.

## 8. Pendientes Antes del "Cliente Real 1" (Producción Abierta)
1. Conectar Email Provider para correos salientes reales.
2. Conectar Buckets Supabase para comprobantes no-volátiles.
3. Asegurar que al "Suspender" a un cliente desde el panel Root, el sistema aplique un _lockdown_ borrando todas las sesiones de dicho cliente de la tabla `auth_sessions`.

## 9. Pendientes Post-Beta
- Módulo avanzado de finanzas y automatización de recargos.
- SLAs de tickets con alertas de tiempo.
- Soft Delete automatizado para recuperación de datos.
