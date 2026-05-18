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
- 2 Áreas comunes (Torre A).
- 1 Reserva de Área Común (Aprobada).
- 1 Tarea operativa (Pendiente).
- 1 Incidencia (Reportada).

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
