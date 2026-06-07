# PropSys - PRD Base V1 (Beta Controlada)

## Resumen Ejecutivo
PropSys es un SaaS inmobiliario B2B2C diseñado para centralizar la gestión de condominios y edificios. Esta versión (Beta V1) establece la base arquitectónica y el "Core Operativo" del sistema: estructuración de edificios, comunicación de avisos, reporte de incidencias, reservas de áreas comunes y una gestión financiera inicial manual. El objetivo de la Beta V1 es estabilizar el uso con clientes iniciales asegurando un aislamiento total entre inquilinos (tenant-scoping).

## Problema
Las administradoras de edificios sufren de fragmentación en su comunicación y operación. Utilizan WhatsApp para incidencias, Excel para cuadrar cobros de mantenimiento y agendas de papel para reservas. Esto resulta en pérdida de contexto, deudas invisibles y fricciones constantes con los residentes.

## Usuarios Objetivo
Administradoras de múltiples condominios, juntas de propietarios, conserjería y los residentes (propietarios e inquilinos) que viven en las unidades gestionadas.

## Roles
1. **ROOT_ADMIN / CLIENT_MANAGER:** Superadministradores de la plataforma o de la franquicia administradora. Gestionan la cuenta cliente y la configuración global.
2. **BUILDING_ADMIN / STAFF:** Equipo operativo del edificio (conserjes, mantenimiento, administradores locales). Gestionan tickets, comprueban recibos y aprueban reservas.
3. **OWNER / OCCUPANT:** Residentes finales. Tienen una vista limitada exclusivamente a su edificio y unidad.

## Alcance Beta V1
- **Estructura multi-tenant:** Aislamiento total de datos por `client_id`.
- **Estructura física:** Gestión de edificios, unidades y asignaciones a usuarios.
- **Avisos:** Tablón de anuncios unidireccional segmentado por edificio y rol.
- **Incidencias (Tickets):** Creación de reportes de fallas por residentes y gestión de ciclo de vida (`REPORTED` -> `ASSIGNED` -> `IN_PROGRESS` -> `RESOLVED` -> `CLOSED`) por el staff.
- **Checklists Operativos:** Formularios de verificación para el staff.
- **Reservas:** Solicitud de reserva de áreas comunes y aprobación.
- **Finanzas Manuales:** Emisión de "Recibos" pendientes por la administradora y validación humana de "Comprobantes" (ej. transferencias bancarias o vouchers) subidos por los residentes.

## Fuera de Alcance (V1 / Beta)
- Procesamiento de pagos online (Stripe/MercadoPago).
- Facturación recurrente automatizada y control fiscal.
- Chat bi-direccional en tiempo real entre vecinos.
- Webhooks de integración y API pública.
- SLAs automáticos y escalamiento de tickets.
- Papelera de reciclaje avanzada / UI de recuperación (Soft Delete).

## Módulos
1. **Autenticación e Identidad:** Invitaciones vía link seguro y manejo de sesiones.
2. **Dashboard:** Vista rápida de KPIs por rol.
3. **Físico (Physical):** Edificios, áreas comunes, unidades y asignaciones.
4. **Operación (Operation):** Incidencias, evidencias en cloud, tareas y checklists.
5. **Comunicación (Notices):** Avisos y circulares.
6. **Financiero (Finance):** Recibos y validación de transferencias.

## Flujos por Rol
* **Residente:** Inicia sesión -> Ve sus recibos pendientes -> Sube foto de transferencia -> El recibo queda en revisión. O, reporta un foco fundido (incidencia) adjuntando foto -> Ve el progreso hasta la resolución.
* **Staff/Conserje:** Inicia sesión -> Revisa el dashboard de incidencias -> Asigna a mantenimiento -> Cambia estado a Resuelto.
* **Building Admin:** Sube el monto del mantenimiento mensual creando recibos -> Valida los comprobantes subidos por los residentes -> Marca recibo como Pagado.

## Reglas de Negocio
* **Aislamiento:** Un residente solo ve la información de los edificios donde tiene asignada una unidad con estado `ACTIVE`.
* **Reservas:** Requieren aprobación del Building Admin si el área común lo estipula, si no, se auto-aprueban dependiendo de la configuración futura (por ahora flujo básico).
* **Ciclo Financiero:** El pago no se acredita automáticamente. Un humano debe revisar el comprobante y transicionar el recibo de `PENDING` a `PAID`.

## Reglas de Seguridad
* **Origin Guard:** Mutaciones (POST, PUT, DELETE) requieren protección contra CSRF vía Next.js middleware / Origin Guard.
* **Cookies Seguras:** La sesión DB-Backed se almacena en `auth_sessions` y se pasa vía cookie `HttpOnly`.
* **Tenant Scoping en BD:** Salvo el `ROOT_ADMIN`, todas las consultas deben incluir validación explícita de `client_id` (o inferirse de forma segura del usuario en sesión).
* **Uploads:** Toda evidencia y comprobante es privado y se almacena bajo el prefix del `client_id/building_id/` y es servido a través de un proxy endpoint que valida permisos.

## Criterios de Aceptación
1. 100% de aislamiento entre inquilinos.
2. Todo input del usuario debe ser validado y estar fuertemente tipado.
3. El frontend de UI no debe filtrar valores internos (IDs, PENDING, etc).

## Riesgos Conocidos
1. **Edge Middleware Optimista:** La sesión se valida superficialmente en el middleware de edge (por latencia). La invalidación dura recae en la capa de endpoints privados.
2. **Volatilidad de Almacenamiento Local (Fallback):** Si no se configuran los buckets de Supabase, el sistema decae a guardar archivos en `.data`. En Render (serverless), esto significa pérdida de datos en cada reinicio.

## Roadmap Posterior
1. Pasarela de pagos automatizada.
2. Suscripciones y facturación masiva.
3. Suspensión automática por morosidad extrema.

## Definición de Beta Lista
Para calificar un entorno como "Beta Lista", se requiere:
1. **Demo Local:** El código compila, los tests pasan, el Storage local en `.data` funciona.
2. **Demo Render (Staging):** Despliegue exitoso con DB remota; validación funcional sin requerir correos transaccionales reales.
3. **Beta Controlada (Usuarios Internos/Friends & Family):** Envíos de e-mail reales conectados.
4. **Cliente Real / Producción Abierta:** Storage Cloud completamente implementado (Supabase env vars) y revocación estricta de sesiones de clientes suspendidos.
