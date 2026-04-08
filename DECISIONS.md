# Decisiones de Arquitectura - PropSys Frontend

Este documento resume las decisiones clave tomadas durante la construcción de la base del front-end.

## 1. Stack Tecnológico
- **Next.js (App Router):** Se utiliza la estructura de carpetas `app/` para aprovechar las ventajas de Server Components (aunque la mayoría de los componentes actuales son `client` por la naturaleza de los mocks y el estado interactivo).
- **TypeScript:** Tipado estricto para todo el dominio del negocio (Usuarios, Recibos, Unidades, Edificios).
- **Tailwind CSS:** Se utiliza para todo el diseño visual, siguiendo una paleta de colores profesional basada en el azul (`primary: 221.2 83.2% 53.3%`).
- **Lucide React:** Set de iconos estándar para una interfaz moderna y limpia.

## 2. Estructura de Carpetas
- `app/`: Contiene las rutas y layouts. Se utiliza una ruta de grupo `(private)` para envolver todas las páginas que requieren autenticación.
- `components/`: Componentes UI reutilizables y atómicos.
- `lib/`: Lógica de negocio, tipos, mocks y utilidades.
  - `lib/auth/`: Lógica de autenticación simulada y guards de ruta.
  - `lib/types/`: Definiciones de interfaces de TypeScript.
  - `lib/mocks/`: Datos estáticos para simular el backend.

## 3. Autenticación y Seguridad (Mock)
- Se implementó un `AuthProvider` que gestiona el estado del usuario en memoria y `localStorage`.
- El componente `RouteGuard` protege las rutas privadas, redirigiendo al login si no hay sesión, o al dashboard correspondiente según el rol del usuario (`ADMIN`/`STAFF` vs `RESIDENT`/`OWNER`).

## 4. Componentes Base
- **AppShell:** Provee la navegación lateral responsiva y el contenedor principal.
- **Estados Dinámicos:** Se crearon componentes para `Loading`, `Empty` y `Error` para asegurar una experiencia de usuario consistente.
- **ReceiptRow:** Componente unificado para mostrar filas de recibos tanto en la vista de administrador como de residente.

## 5. Escalabilidad
- La separación de rutas por grupos (`(private)`) y la lógica de guards basada en roles permite añadir nuevas funcionalidades sin comprometer la seguridad simulada.
- El uso de mocks centralizados en `lib/mocks/` facilita la transición a una API real en el futuro simplemente cambiando los hooks de datos.
