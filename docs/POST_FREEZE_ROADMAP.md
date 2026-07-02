# Roadmap Post-Freeze - PropSys (Cliente Real)

Este documento traza la ruta de evolución de PropSys posterior a la fase de estabilización inicial. El foco está puesto en características que generen impacto directo para la operatividad de gestoras inmobiliarias y en la transparencia para los residentes, basándose en el descubrimiento realizado en la fase inicial.

## 1. Estado Actual: Beta Freeze / Demo Funcional
- **Regla de Congelamiento Base:** Durante las estabilizaciones, el objetivo fue cerrar el código y prepararlo para producción. A partir de este nuevo ciclo, se permiten nuevas características estructuradas pero *ninguna funcionalidad fuera de este roadmap* puede entrar sin justificación de negocio.
- **Alcance Operativo:** No se debe hacer limpieza general de refactors que no estén atados a estas nuevas fases. Las excepciones aplican únicamente para corrección de bugs, incidentes de seguridad, configuraciones de despliegue y documentación.

## 2. Fases de Desarrollo

### Fase 1: Transparencia y Reservas (Inmediato)
Este bloque aborda los dos dolores principales de la gestora inmobiliaria para aliviar la carga del equipo de administración.

#### Sub-bloque 1A: Recibo Explicable y Voucher Móvil
- **Objetivo:** Que el propietario entienda cuánto debe, qué pagó y cómo se calculó su recibo sin contactar a administración.
- **Usuario Beneficiado:** Residente (propietario/inquilino) y Administrador.
- **Alcance:**
  - Desglose de conceptos (mantenimiento, agua, fondos).
  - Fórmula visible basada en metraje (prorrata).
  - Subida directa de voucher de transferencia (foto/screenshot) desde móvil.
  - Indicador de estado (Semáforo: Rojo/Pendiente, Ámbar/Validación en proceso, Verde/Pagado).
- **Criterios de Aceptación:**
  - Un propietario puede abrir su recibo, ver la fórmula de prorrata y entender el cálculo en menos de 2 minutos.
  - La subida de voucher desde móvil enlaza el documento al recibo y cambia el estado a `PENDING_REVIEW` visible para el admin.
- **Riesgo:** Limitaciones del storage para alta concurrencia o validaciones erradas de formato.
- **Prioridad:** Alta.

#### Sub-bloque 1B: Reservas por Slots y Áreas Comunes
- **Objetivo:** Erradicar conflictos por reservas manuales y cruces de horarios.
- **Usuario Beneficiado:** Residente y Administrador.
- **Alcance:**
  - Descartar inputs de texto libre para las horas. 
  - Cuadrículas de bloques predefinidos (estilo citas médicas).
  - Indicadores visuales de ocupación y control de aforo por hora.
  - Configuración avanzada de áreas comunes (horarios restringidos, límites de días).
- **Criterios de Aceptación:**
  - Un usuario solo puede hacer clic en un slot disponible; los slots ocupados o fuera del aforo no son interactivos.
  - El administrador puede definir "días gratis" y "días de pago" en el mismo espacio sin crear áreas duplicadas.
- **Riesgo:** Lógica de validación de zonas horarias en servidor vs cliente.
- **Prioridad:** Alta.

### Fase 2: Mantenimiento Visible y Gráficas (Próximo)
- **Objetivo:** Brindar control operativo a los procesos de mantenimiento (gestora y staff) y agregar valor visual (dashboard) para los residentes.
- **Usuario Beneficiado:** Administrador, Staff y Residente.
- **Alcance:**
  - Trazabilidad de tickets de mantenimiento preventivo y correctivo (Kanban o listas).
  - Adjunto de reportes y evidencias para justificar presupuestos.
  - Gráficas de consumo histórico en el dashboard del residente (mes actual vs anteriores).
  - Funcionalidad de agua estrictamente manual (ingreso de lecturas).
- **Criterios de Aceptación:**
  - Staff puede adjuntar evidencias (fotos) al resolver incidencias.
  - Residente visualiza gráfico comparativo de gastos en su dashboard.
- **Prioridad:** Media.

### Fase 3: Pasarela de Pagos e IA (Futuro Exploratorio)
- **Alcance Post-Beta:**
  - Integración de pasarelas (DLocal, Kashio, Stripe) para pagos instantáneos asumiendo comisión.
  - Reconciliación bancaria masiva.
  - Chatbot RAG (IA) entrenado con el manual de convivencia.
- **Nota:** Documentado únicamente para planificación estratégica a largo plazo.

## 3. Fuera de Alcance
Para prevenir el abultamiento del producto y desvíos (scope creep), las siguientes características quedan formal y explícitamente descartadas del ciclo actual y no deben incluirse en desarrollos inmediatos:
- Contómetros o validación de consumos automatizados mediante OCR o inteligencia artificial.
- Facturación electrónica nativa.
- App móvil nativa (todo el desarrollo se enfoca en PWA/Responsive).

## 4. Validaciones Requeridas por Despliegue
Cualquier entrega relacionada con las Fases debe cumplir:
- Smoke Test funcional manual sobre base de datos QA/Demo.
- Validación de subida de imágenes en Render / Supabase Storage (comprobantes de Fase 1A).
- Ejecución limpia de `npm run test` y validación de tipos `npm run check:types` previo a los merges a `master`.
