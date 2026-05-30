# Dataset Demo Comercial (BETA)

Este documento detalla la estructura y el uso del dataset de demostración comercial de PropSys. El objetivo de este dataset es tener un entorno predecible y seguro para mostrar las funcionalidades clave a clientes potenciales.

## Advertencias de Seguridad ⚠️
1. **NO USAR EN PRODUCCIÓN REAL**: Estos scripts están diseñados exclusivamente para entornos de demostración o beta.
2. **USUARIOS ACTIVOS**: Los usuarios demo se crean en estado `ACTIVE` con una contraseña conocida y hasheada en DB. No manejan información real ni personal.
3. **NO SE TOCA AL `ROOT_ADMIN`**: Los scripts operan estrictamente limitados al cliente demo. El superadministrador está protegido.
4. **COMPROBANTES (STORAGE)**: El script de semilla (seed) NO sube archivos a Supabase Storage. Durante la demo, el comprobante se debe subir de manera manual desde la interfaz de usuario para mostrar la experiencia de subida en tiempo real.
   - El script de limpieza no automatiza el borrado en Storage por defecto. Incluso si se detecta `--include-storage`, el script requerirá limpieza manual en Supabase Dashboard de los archivos subidos bajo el prefijo del cliente demo para evitar riesgos.

---

## Contenido del Dataset

**Cliente:** Residencial Demo Los Álamos (`client_demo`)

**Edificios y Unidades:**
- **Torre A** (Unidades: 101, 102, 201)
- **Torre B** (Unidades: 101, 102)

**Usuarios y Credenciales:**
Todos los usuarios comparten la misma contraseña:
> **Contraseña:** `DemoBeta2026`

- **Manager:** `manager.demo@propsys.local`
- **Administrador de Edificio (Torre A):** `admin.edificio.demo@propsys.local`
- **Staff (Ambas Torres):** `staff.demo@propsys.local`
- **Propietario (Torre A 101, Torre B 101):** `owner.demo@propsys.local`
- **Inquilino (Torre A 102):** `tenant.demo@propsys.local`

**Datos Operativos Pre-Cargados:**
- 3 Recibos (2 Pendientes, 1 Pagado) en Soles (PEN).
- 2 Avisos publicados.
- 3 Áreas comunes (2 en Torre A, 1 en Torre B).
- 6 Reservas de Área Común para validar calendario y privacidad.
- 1 Tarea operativa (Pendiente).
- 1 Incidencia (Reportada).

---

## Reservas Demo para Calendario

Las reservas se generan siempre para la semana siguiente a la ejecución del seed. El punto de referencia es el próximo lunes a las `00:00`, por lo que no quedan obsoletas si el dataset se recrea semanas después.

| ID | Usuario | Unidad | Edificio | Área | Horario relativo | Estado | Propósito |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `resv_demo_1` | `owner.demo@propsys.local` | A101 | Torre A | Terraza / Parrilla | Lunes 10:00-12:00 | `APPROVED` | Reserva propia con detalle para owner |
| `resv_demo_2` | `tenant.demo@propsys.local` | A102 | Torre A | Terraza / Parrilla | Martes 18:00-20:00 | `APPROVED` | Reserva ajena visible como `Ocupado` para owner |
| `resv_demo_3` | `tenant.demo@propsys.local` | A102 | Torre A | Terraza / Parrilla | Miércoles 10:00-12:00 | `CANCELLED` | No debe aparecer en disponibilidad |
| `resv_demo_4` | `tenant.demo@propsys.local` | A102 | Torre A | Terraza / Parrilla | Jueves 10:00-12:00 | `REJECTED` | No debe aparecer en disponibilidad |
| `resv_demo_5` | `owner.demo@propsys.local` | B101 | Torre B | Salón social | Viernes 16:00-18:00 | `APPROVED` | Validar filtro por edificio |
| `resv_demo_6` | `tenant.demo@propsys.local` | A102 | Torre A | Sala de reuniones | Sábado 11:00-13:00 | `REQUESTED` | Validar filtro por área |

### Validación Manual como Owner

1. Iniciar sesión con `owner.demo@propsys.local`.
2. Abrir `Reservas` y cambiar a la vista `Calendario`.
3. Avanzar a la semana siguiente.
4. Confirmar que `resv_demo_1` muestra detalle propio y que `resv_demo_2` y `resv_demo_6` aparecen como `Ocupado`.
5. Confirmar que `resv_demo_3` y `resv_demo_4` no aparecen.
6. Usar los filtros Torre A, Torre B, Terraza / Parrilla, Sala de reuniones y Salón social.

### Validación Manual como Manager

1. Iniciar sesión con `manager.demo@propsys.local`.
2. Abrir `Reservas` y cambiar a la vista `Calendario`.
3. Avanzar a la semana siguiente.
4. Confirmar que las reservas activas muestran detalle de gestión y que los filtros separan Torre A, Torre B y sus áreas comunes.

### Validación de Privacidad en Network

1. Con sesión owner, abrir DevTools y filtrar por `/api/v1/reservations?scope=availability`.
2. Confirmar que la reserva propia mantiene detalle suficiente.
3. Confirmar que las reservas ajenas activas tienen forma mínima: `id`, `buildingId`, `commonAreaId`, `startAt`, `endAt`, `busy: true`.
4. Confirmar que los bloques ajenos no exponen `unitId`, `createdByUserId`, `status`, nombres ni el ID real de reserva.
5. Confirmar que las reservas `CANCELLED` y `REJECTED` no aparecen en la respuesta.

---

## Ejecución de Scripts

Los scripts utilizan `tsx` (TypeScript Execute) y cargan automáticamente las variables de entorno de `.env` y `.env.local`.

### 1. Inyectar Dataset (Seed)
Para crear la estructura demo en la base de datos:

```bash
npx tsx scripts/seed-demo-beta.ts
```

*Nota: Por seguridad, si el cliente demo ya existe, el script fallará y te pedirá que primero limpies la base ejecutando el script de cleanup.*

### 2. Limpiar Dataset (Cleanup)
Para eliminar todo el rastro del cliente demo de la base de datos de manera segura (respetando las Foreign Keys):

```bash
npx tsx scripts/cleanup-demo-beta.ts
```

*Nota sobre Storage:* El script de limpieza NO borra archivos de Supabase Storage por defecto, e incluso si se indica explícitamente `--include-storage`, emitirá una advertencia y requerirá que borres manualmente la carpeta `client_demo` en el panel de Supabase Storage. Esto se diseñó intencionalmente para evitar accidentes irreversibles.
