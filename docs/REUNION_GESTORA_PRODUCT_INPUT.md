# Discovery y Requerimientos - PropSys (Reunión con Gestora Inmobiliaria)

Este documento sintetiza la validación de necesidades del producto a partir de una reunión clave con una gestora inmobiliaria. El objetivo es alinear el roadmap de PropSys con dolores reales del mercado para el despliegue del primer cliente real.

## 1. Resumen Ejecutivo
PropSys fue evaluado frente a necesidades administrativas y operativas cotidianas de una gestora inmobiliaria. Se concluyó que el MVP no debe llenarse de features de bajo uso, sino resolver problemas críticos de comunicación, transparencia y reservas. Se detectaron requerimientos clave en cobros (recibos transparentes) y uso de áreas comunes (flujos estrictos y visuales), los cuales se incorporarán como prioridad principal del próximo ciclo de desarrollo.

## 2. Qué se validó con la gestora
* **Transparencia en cobros:** Los inquilinos llaman constantemente para preguntar por qué se les cobra cierto monto de agua o mantenimiento. Un recibo sin fórmulas es un generador de carga administrativa.
* **Fricción en reservas de áreas:** Los inputs libres de horarios generan choques. Se necesita un modelo visual por "bloques" idéntico a las citas médicas.
* **Gestión de vouchers:** El envío de comprobantes de pago por transferencia sigue siendo la norma. Se requiere agilizar la subida desde el móvil y la validación administrativa.
* **Mantenimiento opaco:** Falta visibilidad sobre cuándo se atienden averías y qué presupuestos se consumen.

## 3. Dolor principal por módulo
| Módulo | Dolor Identificado | Solución Propuesta |
|---|---|---|
| **Financiero (Recibos)** | Inquilinos no entienden cómo se calcula su cuota y saturan el canal de soporte. | Recibo explicable con fórmula de prorrata visible (m²), desglose de conceptos y estado de voucher. |
| **Reservas** | Cruces de horarios por textos libres y reglas poco claras sobre aforos. | Agenda visual por slots predefinidos (citas médicas) con aforos y estados de ocupación (rojo, gris, verde). |
| **Operación (Agua)** | El cálculo de metros cúbicos es manual y lento. | (Actual) Ingreso de lectura final e inicial para que el sistema calcule el consumo. |

## 4. Ideas Priorizadas (Clasificación Oficial)

A partir de la reunión, se clasificaron las ideas para estructurar el roadmap de forma realista:

### A. Inmediato (Fase 1 - Cliente Real)
* **Recibo explicable:** Desglose de fórmulas, áreas, conceptos y vista de estado.
* **Reservas por slots (visuales):** Cuadrículas de bloques, aforos, colores de estado.
* **Voucher desde móvil:** Subida directa (galería/screenshot) y vinculación al recibo para validación.
* **Configuración avanzada de áreas comunes:** Reglas de horario, días y aprobación en una misma interfaz.

### B. Próximo (Fase 2)
* **Mantenimiento visible:** Visión administrativa y para staff sobre estados de tickets, incidencias, presupuestos y evidencias.
* **Gráficas de consumo:** Dashboard visual para inquilinos para comparar gastos (mensual).

### C. Futuro / Post-Beta
* **Pasarela de pago instantánea:** Integración con DLocal, Kashio, Culqi o Stripe (comisión vs velocidad). Se mantendrá documentado como investigación.
* **IA para manual de convivencia:** Chatbot RAG para consultar normas del edificio sin molestar a administración.
* **Integración bancaria automática:** Para reconciliación masiva.

### D. Fuera de Alcance por ahora
* **Contómetros por OCR/IA:** La lectura de contadores de agua mediante fotos e IA queda descartada; la funcionalidad de consumo de agua será estrictamente manual (lectura final - lectura inicial).

## 5. Dependencias y Riesgos
* **Dependencia UI/UX:** El recibo explicable y la agenda de reservas requieren un diseño muy cuidado. Si la interfaz no es intuitiva, el objetivo de reducir llamadas a soporte no se cumplirá.
* **Riesgo Operativo (Vouchers):** Si el flujo de validación administrativa de vouchers es engorroso, la gestora retrasará las aprobaciones y los recibos no pasarán a `PAID` a tiempo.

## 6. Decisiones Pendientes (Para la Fase de Diseño)
* Definir si el bloque de "Voucher móvil" requerirá cambios en el `durable-rate-limiting-authenticated-abuse` en caso de errores comunes al subir imágenes desde el celular.
* Aclarar las reglas de solapamiento en reservas si un área tiene "días gratuitos" y "días de pago".

## 7. Traducción al Roadmap
Esta información establece la base del nuevo documento `POST_FREEZE_ROADMAP.md`, priorizando el bloque financiero y operativo para la inminente salida a producción con el primer cliente.
