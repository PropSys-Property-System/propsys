Auditoría de Textos Front-End: Clara → PropSys

index — Login / Registro

Textos visibles:

Inicia Sesión — título del formulario

Entrar — botón de submit

Olvidé mi contraseña — enlace

Crear cuenta — botón (aparece dos veces: link de navegación y título del formulario)

Cancelar — botón dentro del formulario de registro

Credenciales inválidas. Por favor verifica tu correo y contraseña. — mensaje de error

Branding viejo: No aparece "Clara" directamente en textos, pero esta página no identifica el producto en ningún encabezado ni logo textual visible en el JSON. Riesgo: si hay un logo o imagen con el nombre Clara, no aparece en el texto estático capturado.

Ambiguos / mejorables:

Crear cuenta duplicado como botón de acceso y como título del formulario — confuso en código.

El mensaje de error usa formato con \[center] — artefacto de Bubble que debería limpiarse en migración a código propio.

No hay texto de placeholder capturado para los campos de email/contraseña — revisar en editor directamente.

Riesgo de naming: No hay distinción admin/residente en este login único — en PropSys conviene aclarar si el login es unificado o bifurcado.

router — Redirección de acceso

Textos visibles:

Cargando

Verificando su acceso...

Branding viejo: Ninguno detectado.

Ambiguos / mejorables:

Cargando es genérico. En migración a código, conviene un texto más descriptivo: e.g. Preparando PropSys... o al menos Cargando tu cuenta....

Consistencia: Cargando (sin puntos) vs. Verificando su acceso... (con puntos suspensivos) — inconsistencia tipográfica menor.

setup — Configuración inicial

Textos visibles:

Configuración inicial — título principal

Crea el edificio, agrega una unidad y registra a tu primer residente. Puedes volver a esta pantalla cuando lo necesites. — subtítulo/instrucción

Steps: 1 Edificio, 2 Unidad, 3 Residente

Crear edificio — título step 1

Datos básicos y cuentas bancarias para recibir pagos. — subtítulo step 1

Guardar edificio — botón

Coeficiente de participación (0 a 1). Ej: 0.023 — placeholder/label

Crear unidad — título step 2

Registra una unidad dentro del edificio seleccionado. — subtítulo step 2

Guardar unidad — botón

Crear residente — título step 3 (aparece dos veces: título y botón)

Crea el acceso y asígnalo a una unidad. — subtítulo step 3

Cuentas bancarias: — label de sección

Agregar cuenta — botón

Agrega una cuenta por registro. Luego podrás editarla o eliminarla. — texto de ayuda

Editar cuenta bancaria — título de form edición

Guardar / Cancelar — botones genéricos

Cerrar sesión — logout

Branding viejo: Ningún texto "Clara" detectado.

Ambiguos / mejorables:

Crear residente duplicado como título y como botón — mismo problema que Crear cuenta en index.

Coeficiente de participación es un término técnico inmobiliario correcto, pero en PropSys conviene decidir si el glosario será en español técnico o adaptado.

Agregar cuenta vs. Guardar vs. Guardar edificio / Guardar unidad — inconsistencia en el patrón de labels de botones de acción (a veces incluyen el objeto, a veces no).

Riesgo de naming: El término Residente está hardcodeado en esta pantalla de setup. Si PropSys va a usar Propietario, Inquilino o Owner/Tenant, esto debe actualizarse aquí.

admin\_dashboard — Panel de administración

Textos visibles:

Nav: Reservas, Recibos/Pagos, Resumen, Soporte

Visión general de pagos, ocupación y conciliación bancaria — subtítulo del dashboard

KPIs:

Tasa de Pago

Total Residentes

Reservas Activas

Incidencias Abiertas

Recibos pendientes de verificación bancaria — label de sección

Cerrar sesión — logout

Branding viejo: Ningún texto "Clara" detectado en labels estáticos. Riesgo: el término Incidencias y Reservas son módulos propios del producto — si el proyecto Clara tenía branding en esos módulos, revisar OptionSets y data types asociados.

Ambiguos / mejorables:

Recibos/Pagos en el nav usa barra diagonal — poco limpio en una migración a código; mejor Recibos y Pagos o simplemente Pagos.

Total Residentes como KPI — si en PropSys el rol se llama diferente, este label debe actualizarse.

Tasa de Pago — la fórmula subyacente es compleja (Search(receipt where estado equals...)) — en migración a código, asegurarse que la lógica esté correctamente reflejada en el label.

Soporte en nav — no hay página soporte listada. Posible link roto o módulo incompleto.

Riesgo de naming: Reservas como sección del nav admin implica un módulo de reservas. Si PropSys no lo incluye en v1, este elemento sobrante puede generar confusión.

admin\_receipts — Lista de recibos (admin)

Textos visibles (dinámicos):

Fecha: mes\_a\_o\_date formateado

Vence: \[fecha]

Unidad: \[id\_text]

$\[monto]

\[estado\_text] — el estado del recibo (valor del OptionSet o campo de texto)

Textos estáticos: Ningún título de página ni header estático capturado — la página puede carecer de encabezado visible.

Branding viejo: Ninguno detectado en estáticos.

Ambiguos / mejorables:

No hay título/header de página visible capturado. En PropSys, esta página debería tener al menos un H1 o nav breadcrumb.

Unidad: \[id\_text] — el identificador id\_text es un campo interno. Confirmar que el valor mostrado sea legible para el admin (ej. "Unidad 4B" y no un UUID).

estado\_text es un campo de tipo texto libre — en una migración a código, conviene migrar a un enum/OptionSet bien tipado con labels controlados.

No hay empty state capturado — si no hay recibos, ¿qué ve el admin? Revisar.

admin\_receipt\_detail — Detalle de recibo (admin)

Textos visibles:

Cerrar sesión

Dinámicos: estado\_text, mes\_a\_o\_date, monto\_total\_number, vencimiento\_date

Un elemento de tipo ElementParent con texto vacío "" — posible label sin texto o elemento huérfano.

Textos estáticos: No se capturan labels para los campos (Monto, Vencimiento, Estado) a diferencia de resident\_receipt\_detail que sí los tiene.

Branding viejo: Ninguno detectado.

Ambiguos / mejorables:

La vista admin no tiene labels estáticos para los campos (a diferencia de la vista residente que sí tiene Monto Total, Conceptos, etc.) — inconsistencia entre vistas admin y residente del mismo objeto.

El elemento con texto vacío "" junto a ElementParent es un riesgo: posible texto de sección sin label, o un artefacto que en migración a código generará un elemento vacío.

Issue activo detectado: este es el origen del bug reportado: "Go to admin\_receipt\_detail with current cell's Receipt: Data to send should be Receipt but right now it is a List of Receipts" — en migración a código, la navegación a esta pantalla debe recibir un ítem único, no una lista.

resident\_receipts — Lista de recibos (residente)

Textos visibles:

Recibos — título de página

Cerrar sesión — logout

Dinámicos por fila: fecha, $\[monto], \[estado\_text], Vence: \[fecha]

No hay recibos todavía. — empty state ✓

Branding viejo: Ninguno detectado.

Ambiguos / mejorables:

No hay recibos todavía. es el único empty state explícito en toda la app — las demás páginas con listas no tienen empty state. Patrón a estandarizar en PropSys.

Recibos como título es genérico. En PropSys podría mejorarse a Mis Recibos para contextualizar la vista de residente.

resident\_receipt\_detail — Detalle de recibo (residente)

Textos visibles:

Monto Total — label

Conceptos — label de sección

Cerrar sesión — logout

Dinámicos: mes\_a\_o\_date, $\[monto\_total\_number], estado\_text, vencimiento\_date

ElementParent sin label adicional — posible lista de conceptos sin encabezado de columna

Branding viejo: Ninguno detectado.

Ambiguos / mejorables:

Conceptos como label es correcto en contexto de recibos de administración, pero en PropSys conviene confirmar la terminología estándar del dominio (¿Cargos? ¿Desglose?).

No hay label para Vencimiento — el dato dinámico de fecha de vencimiento aparece sin label estático visible.

La vista residente tiene más labels estáticos que la vista admin del mismo objeto — inconsistencia entre roles que debe resolverse en PropSys.

reset\_pw — Recuperación de contraseña

Textos visibles:

Reset your password — título (⚠️ en inglés)

New password — label (⚠️ en inglés)

Confirm new password — label (⚠️ en inglés)

Confirm — botón (⚠️ en inglés)

Branding viejo: Ninguno detectado, pero esta página es la más crítica para branding: está completamente en inglés mientras el resto de la app está en español. Proviene del template por defecto de Bubble.

Ambiguos / mejorables:

Todos los textos deben traducirse al español para consistencia.

En PropSys: Restablecer contraseña, Nueva contraseña, Confirmar nueva contraseña, Confirmar.

No hay mensaje de éxito ni de error capturado — revisar si existen en el editor.

404 — Página no encontrada

Textos visibles:

Oops! 404 error — título

The page you're looking for does not exist. — mensaje principal (⚠️ en inglés)

This page has got everything you need to get started. If you're already a Bubble Pro you can delete this boilerplate and design your own 404. — ⚠️ texto de boilerplate de Bubble sin modificar, completamente en inglés

Branding viejo: Este es el mayor riesgo de branding de toda la app. El texto es el boilerplate por defecto de Bubble — menciona "Bubble Pro" y está en inglés. Debe reemplazarse completamente.

Propuesta para PropSys:

Título: Página no encontrada

Mensaje: La página que buscas no existe o fue movida.

CTA: Botón de regreso al dashboard o al inicio.

Resumen de Riesgos Globales

Riesgo	Páginas afectadas	Prioridad

Página 404 con boilerplate de Bubble en inglés	404	🔴 Alta

Página reset\_pw completamente en inglés	reset\_pw	🔴 Alta

estado\_text como campo texto libre sin enum controlado	admin\_receipts, admin\_receipt\_detail, resident\_receipts, resident\_receipt\_detail, admin\_dashboard	🔴 Alta

Issue activo: navegación a admin\_receipt\_detail recibe lista en vez de ítem	admin\_receipt\_detail	🔴 Alta

Inconsistencia de labels entre vista admin y residente del mismo recibo	admin\_receipt\_detail vs resident\_receipt\_detail	🟡 Media

Término Residente hardcodeado — decisión pendiente en PropSys	setup, admin\_dashboard	🟡 Media

Empty states ausentes en páginas admin	admin\_receipts, admin\_dashboard	🟡 Media

Cargando genérico sin branding	router	🟢 Baja

Soporte en nav sin página asociada	admin\_dashboard	🟡 Media

Textos duplicados como título y botón (Crear cuenta, Crear residente)	index, setup	🟢 Baja

