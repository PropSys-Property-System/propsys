# Bubble Front Audit — source project: Clara
## Target migrated frontend: PropSys

Este documento describe el front existente en Bubble del proyecto originalmente llamado Clara.
Para la migración a código, el nombre de producto objetivo pasa a ser PropSys.
La estructura funcional descrita aquí sigue siendo válida como fuente técnica.
Auditoría Front-End — Proyecto Clara
1. Mapa general del front
Lista exacta de páginas (web)
Página	Título	Tipo de contenido
index	Login/Signup	–
router	"Cargando..."	custom.building (dinámico, usado solo para routing)
admin_dashboard	Dashboard admin	custom.building
setup	Configuración inicial	–
admin_receipts	Recibos - Clara	–
admin_receipt_detail	Detalle recibo (admin)	custom.receipt
resident_receipts	Recibos	custom.receipt (lista, dinámico)
resident_receipt_detail	Detalle recibo (residente)	custom.receipt
reset_pw	Reset password	–
404	Error 404	–
Reusable Elements exactos detectados:
RE_NavPrivate — TopBar/nav horizontal con botones BtnInicio, BtnDashboard, BtnSetup, BtnRecibos, BtnLogout, con visibilidad condicional por rol.
No hay más reusable elements. La mayoría de headers inline en páginas de admin son copias no reutilizadas de ese mismo patrón.
Páginas públicas vs. privadas
Pública (no requiere auth)	Privada (requiere auth)
index	router
reset_pw	admin_dashboard
404	setup
–	admin_receipts
–	admin_receipt_detail
–	resident_receipts
–	resident_receipt_detail
Páginas con content type (reciben data al navegar)
Página	Content type	Recibe data al navegar
router	custom.building	Sí (search dinámico para routing)
admin_dashboard	custom.building	Sí (search de buildings)
resident_receipts	custom.receipt	Sí (search de receipts, no filtered por celda — ver bugs)
admin_receipt_detail	custom.receipt	Sí (current page item)
resident_receipt_detail	custom.receipt	Sí (current page item)
index, setup, admin_receipts, reset_pw, 404	—	No
2. Arquitectura visual actual
Layout general por página
index: Fondo con imagen de fondo inmobiliaria (paralax off). Una card centrada (Grp_Iniciar_sesión) con layout column, min-height 500px, box-shadow pronunciada. Popup Popup_crear_cuenta superpuesto para registro.
router: Página vacía de carga. Solo texto "Verificando su acceso..." centrado. Fondo blanco. Sin layout real.
admin_dashboard: Layout two-column fijo: Sidebar (260px, bgcolor #1A237E) + Contenedor_Principal (columna flexible). El sidebar tiene navegación por tabs via custom state custom.text_. El contenido principal cambia según tab activo.
setup: Layout de wizard de 3 pasos. Header con título centrado, Grp_StepNav_1/2/3 como steps numerados, y cards de contenido Card_Step1_Edificio, Card_Step2_Unidad, Card_Step3_Residente que se muestran/ocultan según custom.number_.
admin_receipts: Layout column simple. Header inline con título + botón logout. Lista RG_Receipts de cards clickeables.
admin_receipt_detail: Layout column. Header inline + detail de recibo con campo CurrentPageItem.
resident_receipts: Layout column centrado, max-width 800px (ContentWrapper). Header simple + card con ReceiptsList + EmptyState.
resident_receipt_detail: Layout column similar a admin_receipt_detail.
Patrones repetidos detectados
Headers: Tres variantes distintas coexisten en el proyecto:
RE_NavPrivate (reusable) — TopBar horizontal con logo-link "Inicio" y botones de nav por rol.
Header inline en admin_receipts y admin_receipt_detail — row con título + botón "Cerrar sesión" (duplicado no reutilizado).
Header inline en resident_receipts — row con título "Recibos" + botón "Cerrar sesión" (también duplicado).
El admin_dashboard usa un Sidebar vertical propio sin relación con RE_NavPrivate.
Cards KPI: Card_A, Card_B, Card_C, Card_D en admin_dashboard — todas con estructura idéntica: icono + valor numérico grande + label muted. Están construidas inline (no como reusable element).
Receipt rows: ReceiptCard en admin_receipts y ReceiptRow en resident_receipts son la misma idea (fecha / unidad / monto / estado badge) pero implementadas por separado con estructura diferente.
Botón de logout: Aparece inline en al menos 5 páginas distintas con estilos ligeramente distintos (color de icon, padding, variante del style). No hay consistencia total.
Empty state: Existe EmptyState implementado correctamente en resident_receipts (condicional según count del RG). No se detecta en admin_receipts ni en otras páginas.
Colores, tipografía y tokens
Color primario: #1A237E (azul oscuro índigo) usado en sidebar, botones CTA y títulos de sección.
Hover primario: rgba(9,30,124,1) — variante más oscura.
Fondo: var(--color_background_default) (blanco), #F5F7FA como fondo de sección gris claro.
Texto: var(--color_text_default) (aprox. rgba(15,23,41,1)), muted rgba(82,82,82,1).
Error/destructivo: var(--color_destructive_default) — rgba(239,67,67,1).
Éxito: rgba(33,196,93,1).
Warning: rgba(245,159,10,1).
Tipografía: Poppins como fuente heading (font-weight 700/600), var(--font_default) para cuerpo.
Border radius: 4px inputs, 8px botones, 12px cards, 15px cards del dashboard, 1000px para el círculo de logo en setup.
Separadores: border-bottom: 1px solid #E5E7EB (gris claro) en headers.
¿Existe un design system real?
Parcialmente. Hay tokens de color y estilos nombrados aplicados (Button_ghost_, Button_outline_, Text_heading_, Text_muted_, Text_body_, Text_error_, Text_subheading_, Group_card_, Group_container_, Group_empty_state_, Group_inline_, Group_stack_, Group_transparent_, RepeatingGroup_list_). Es un sistema de estilos funcional pero incompleto: los botones de logout y algunos CTAs evaden los tokens y usan valores hardcoded (rgba(26,35,126,1) en lugar de var(--color_primary_default)).
Duplicación visual
Alta. admin_receipts, admin_receipt_detail, resident_receipts y resident_receipt_detail tienen headers y estructuras de página casi idénticas construidas inline. Los KPI cards del dashboard son cuatro copias en lugar de un reusable con data inyectada.
3. Navegación y guards
Rutas de entrada
/ → index (login/signup)
/router → página de despacho post-login
Todas las demás rutas son destinos post-router
Lógica del router (router page)
El router actúa como middleware de navegación disparado en PageLoaded. Sus reglas, en orden de evaluación:
Condición	Destino
not_logged_in	→ index
logged_in + rol vacío	→ setup
admin/staff + edificio_custom_building vacío	→ setup
admin/staff + edificio_custom_building no vacío	→ admin_dashboard
resident/owner + unidad_custom_unit vacía	→ setup
resident/owner + unidad_custom_unit no vacía	→ resident_receipts
Páginas por rol
Rol	Páginas accesibles
admin	router, admin_dashboard, setup, admin_receipts, admin_receipt_detail
staff	router, admin_dashboard, setup (mismas que admin)
resident	router, resident_receipts, resident_receipt_detail
owner	router, resident_receipts, resident_receipt_detail
Guards por página
Página	Guard implementado
router	✅ not_logged_in → redirige a index
resident_receipts	✅ en PageLoaded: si no es resident/owner → redirige a router
admin_receipts	✅ en PageLoaded: guard parcial (redirige si no es admin/staff)
admin_dashboard	⚠️ no se detectó guard explícito en PageLoaded — depende de que el usuario llegue solo vía router
setup	❌ no se detectó guard
admin_receipt_detail	❌ no se detectó guard
resident_receipt_detail	❌ no se detectó guard
index	❌ no redirige si el usuario ya está logueado
Páginas que deberían tener guard y no lo tienen:
admin_dashboard — un residente podría navegar directamente a /admin_dashboard si conoce la URL.
admin_receipt_detail — accesible sin validación de rol.
resident_receipt_detail — accesible sin validación de rol.
setup — cualquier usuario logueado podría abrirlo manualmente.
index — no hay redirección automática si ya hay sesión activa (el usuario ve el login aunque ya esté autenticado).
4. Reusabilidad real
Reusable elements existentes
RE_NavPrivate — TopBar horizontal completo con nav por rol y logout.
Reusable elements potenciales que deberían existir
KPICard — Usado ×4 en dashboard (icono + valor + label). Hoy son cuatro grupos inline idénticos.
ReceiptRow / ReceiptCard — El mismo patrón de fila de recibo existe en admin_receipts y resident_receipts con implementaciones separadas.
PageHeader — Header de página con título + botón logout. Aparece inline en admin_receipts, admin_receipt_detail, resident_receipts, resident_receipt_detail.
StatusBadge — El campo estado_text del recibo se muestra en múltiples páginas. Existe un EstadoBadgeWrapper en admin_receipts pero no está factorizado.
EmptyState — Existe en resident_receipts; debería ser reusable y aplicarse en todo el sistema.
StepWizard — El patrón de 3 pasos de setup es genérico y reusable.
Headers/navs/cards/forms inline repetidos
Header con logout: admin_receipts, admin_receipt_detail, resident_receipts, resident_receipt_detail (4 instancias inline).
Formulario de campos con validación visual (border hover/focus/error): los mismos estilos de input están hardcoded en cada página — setup (×8 inputs), index (×2 inputs), popup de signup (×4 inputs).
5. Interacciones UI
Tabs
admin_dashboard: tabs de navegación en sidebar (Reservas, Recibos/Pagos, Resumen, Soporte) implementadas como Text clickeables que setean custom.text_. Los contenedores Group_Resumen, Group_Recibos, Group_Recibos/Pagos se muestran u ocultan según el valor del custom state. Group_Recibos (bTHGZ0) está vacío — la tab "Recibos/Pagos" no tiene contenido implementado.
Popups
Popup_crear_cuenta en index — formulario de registro con campos: Nombre Completo, Email, Contraseña, Confirmar Contraseña + botones Crear Cuenta / Cancelar.
Dropdowns
DD_Unit en setup — dropdown dinámico de unidades filtradas por edificio_custom_building del current user.
DD_Rol en setup — dropdown de option set option.role.
Formularios
Login (Grp_Iniciar_sesión): Email + Contraseña + botón Entrar + link "Olvidé mi contraseña" + botón "Crear cuenta".
Signup (popup): Nombre + Email + Contraseña + Confirmar contraseña.
Setup Step 1: Nombre edificio + Dirección + logo circular + gestión de cuentas bancarias (RG con edit/delete inline).
Setup Step 2: ID Unidad + Coeficiente de participación.
Setup Step 3: Nombre completo + Email + Unidad (dropdown) + Rol (dropdown).
Loaders
Página router actúa como loader visual ("Verificando su acceso..."). No hay spinners ni skeleton loaders explícitos detectados.
Empty states
EmptyState en resident_receipts — condicional cuando el RG tiene count = 0. Muestra texto "No hay recibos todavía." con estilo Group_empty_state_. No se detecta en admin_receipts.
Error states
GrpErrorLogin en index — mensaje de credenciales inválidas con icono de error, fondo rojo claro, inicialmente oculto (is_visible: false), se muestra en OnError del workflow de login.
Inputs con border_color: var(--color_destructive_default) cuando isnt_valid.
Badges
EstadoBadgeWrapper en admin_receipts — wraps el texto estado_text del recibo. El estilo dinámico del badge (color según estado Pagado/Pendiente/Vencido) no es visible desde el JSON — la lógica de color condicional no está explícitamente construida como reusable.
Charts
BarChartContainer (plugin chartjs): gráfico de barras "Morosidad del Edificio" — datos agrupados por mes de custom.receipt donde estado_text = "Pendiente", últimos 12 meses.
PieChartContainer (plugin chartjs): gráfico de pie "Ocupación de Áreas Comunes" — datos de custom.commonarea mostrando nombre y count de disponibilidad. La expresión y_value_expression usa count de disponibilidad_list_date_range, lo que puede no ser la métrica correcta para un gráfico de ocupación — potencial bug semántico.
Tablas / listas
RG_Receipts en admin_receipts: RG vertical, 8 rows, sort por mes_a_o_date desc, filtrado por edificio_custom_building del current user.
ReceiptsList en resident_receipts: RG vertical, 10 rows, sort por mes_a_o_date desc, filtrado por unidad_custom_unit del current user.
RG_BankAccounts en setup: RG vertical de cuentas bancarias con inline edit/delete.
Lista de BankReconciliationSection en admin_dashboard (recibos pendientes de verificación bancaria).
Acciones click importantes
Click en fila RG_Receipts → navega a admin_receipt_detail (con bug — ver sección 7).
Click en ReceiptRow → navega a resident_receipt_detail.
Click en BtnInicio (RE_NavPrivate) → navega a router.
Tabs del sidebar en admin_dashboard → cambian custom.text_.
Btn_SaveBankAccount / Btn_CancelEdit / Ico_EditBankAccount / Ico_DeleteBankAccount → manejo inline del CRUD de cuentas bancarias.
ExportarPagosButton en dashboard → sin workflow asignado visible (botón sin acción implementada).
6. Responsive y comportamiento visual
Páginas con nuevo responsive engine
Todas las páginas usan new_responsive: true y element_version: 5. El proyecto está completamente en el nuevo engine de Bubble.
Layouts relevantes
admin_dashboard: Layout row fijo de Sidebar (260px fixed) + Contenedor_Principal. No usa fit_width: true en el sidebar, lo que puede causar overflow en pantallas < ~900px.
resident_receipts: ContentWrapper con max-width: 800px centrado — funciona bien para pantallas medianas pero estrecho en desktop grande.
setup: Contenido centrado con max-width: 500px para el texto introductorio.
index: Fondo de imagen con card centrada, min-width: 450px en el popup — puede desbordar en móvil.
Breakpoints / condiciones visuales detectadas
font_size reducido a 14px cuando Current Page Width < 320px — aplicado en múltiples textos de admin_dashboard (KPI values, labels). Es el único breakpoint activo detectado; está ajustado a un breakpoint muy pequeño (320px) y no cubre tablets ni móviles estándar.
Popup_crear_cuenta: min-width: 480px — no colapsa en móvil.
Grp_Iniciar_sesión: min-width: 450px — no colapsa en móvil.
Limitaciones visibles del responsive
El sidebar de admin_dashboard es de ancho fijo sin comportamiento mobile (no colapsa, no hay hamburger menu, no tiene breakpoint). En pantallas < 768px la UI se rompe.
No hay ninguna lógica de diseño para tablet. Solo hay un micro-breakpoint en 320px.
El RE_NavPrivate tiene min-width: 400px en GroupLeft, lo que puede causar overflow en pantallas pequeñas.
Las KPI cards del dashboard son un row fijo de 4 items (space-between) sin wrap — en pantallas medianas se comprimen hasta quedar ilegibles.
7. Riesgos de migración del front
Bug confirmado (issue activo)
admin_receipts → admin_receipt_detail: La acción Go to admin_receipt_detail with current cell's Receipt está enviando get_list_data del RG completo en lugar de la celda actual. El tipo esperado es Receipt pero está enviando List of Receipts. Esto es un bug de navegación activo que hace que admin_receipt_detail reciba el tipo de dato incorrecto.
Pantallas complejas para migración
admin_dashboard: La más compleja. Combina: sidebar con tab state management via custom state, 4 KPI cards con búsquedas inline pesadas, 2 charts (Bar + Pie) con data aggregation, tabla de reconciliación bancaria, y tabs vacías (Group_Recibos sin contenido). En React habrá que implementar routing interno o un estado de tabs, y las queries de los charts necesitan replicarse en el backend.
setup: Wizard de 3 pasos con custom state numérico como step controller. Incluye gestión inline de cuentas bancarias con CRUD (add/edit/delete) todo manejado con custom states de texto. La lógica de creación de usuario + envío de email de reset en el mismo workflow es delicada de replicar.
Lógica visual acoplada a Bubble
Custom states como estado de UI: El sistema de tabs del dashboard y el wizard de setup dependen de custom.text_ y custom.number_ almacenados en la página. En React se traduce a useState local — es directo pero hay que mapear cada condición.
Visibilidad condicional por rol en RE_NavPrivate: Los botones del nav tienen states que los hacen visibles solo si el rol coincide. En React esto es simplemente renderizado condicional.
Router como página: El pattern de routing vía PageLoaded workflows es idiomático de Bubble. En Next.js se reemplaza completamente con middleware o getServerSideProps/useEffect con redirect según sesión y rol.
Workflows que en código habrá que traducir a navegación/estado
Workflow Bubble	Equivalente en código
router PageLoaded (6 condiciones)	Middleware de Next.js o hook useAuth con redirect
Tabs del sidebar via SetCustomState	useState o URL param (?tab=resumen)
Steps del wizard via SetCustomState	useState o URL param (?step=1)
ShowElement / HideElement para error states	Estado local hasError: boolean
ResetInputs tras guardar	Reset del form state (react-hook-form reset())
Popup Popup_crear_cuenta	Modal component con estado de visibilidad
Elementos que dependen demasiado de búsquedas inline
KPI "Tasa de Pago": hace dos Search(custom.receipt) inline con .count — una con filtro estado_text = "Pagado", otra sin filtro, y divide. Esto es una query costosa ejecutada en cliente. En código debe ir a una API route.
Bar chart: Search(custom.receipt) con group_by y aggregations por mes. Requiere un endpoint de analytics en backend.
Pie chart: Search(custom.commonarea) con count de disponibilidad_list_date_range — requiere revisión de qué dato expone realmente.
admin_receipts: RG_Receipts filtra por edificio_custom_building del current user — query directa traducible a API call con auth.
UI incompleta o inconsistente detectada
Group_Recibos en admin_dashboard: Tab "Recibos/Pagos" completamente vacía — el grupo existe pero sin elementos hijos.
ExportarPagosButton: Botón visible en el dashboard sin workflow de acción conectado.
admin_receipts y admin_receipt_detail: No usan RE_NavPrivate sino headers inline sin navegación completa — solo tienen botón de logout, sin acceso al resto del sistema desde esas páginas.
resident_receipt_detail: Misma situación que arriba — nav incompleta.
El admin_receipt_detail muestra monto_total_number dos veces en el mismo texto (round + round concatenados) — parece un bug de expresión de texto.
resident_receipts pasa un Search(custom.receipt) sin filtro como dynamic_page_name al navegar — esto es una issue activa (ver bug confirmado arriba).
setup: El botón de logout solo hace LogOut sin redirección explícita en ese workflow (el workflow de LogoutButton solo tiene LogOut como única acción).
8. Resultado final
Resumen ejecutivo de la migración del front
Clara es un portal de administración de edificios en etapa temprana de desarrollo con una base razonable pero con inconsistencias importantes. El front tiene 10 páginas web, 1 reusable element, y una arquitectura que distingue roles (admin/staff vs. resident/owner) mediante un router page pattern propio de Bubble. La UI core está construida pero hay secciones vacías (Group_Recibos), bugs activos de navegación (admin_receipts → detail), y duplicación alta de componentes que en React deben convertirse en componentes compartidos desde el día uno.
La migración a Next.js + React + Tailwind es viable y directa en la mayoría de las pantallas. Los riesgos principales no son de complejidad visual sino de lógica de routing, queries inline del dashboard, y la necesidad de reemplazar el router-page con middleware de autenticación real.
Componentes compartidos que conviene construir primero
<AppLayout> — Shell con sidebar (admin) o header simple (resident). Wrappea todas las páginas privadas.
<NavSidebar> — Nav vertical del admin (tabs Resumen / Recibos / Reservas / Soporte) con estado activo.
<TopBar> — Header horizontal equivalente al RE_NavPrivate con nav por rol y logout.
<KPICard> — Tarjeta de métrica (icono + valor + label). Usada ×4 en dashboard.
<ReceiptRow> — Fila de recibo reutilizable en listado admin y listado residente.
<StatusBadge> — Badge de estado (Pagado / Pendiente / Vencido) con color condicional.
<EmptyState> — Estado vacío genérico con icono + texto + acción opcional.
<StepWizard> — Wizard de pasos numerados para setup.
useAuth hook + middleware — Reemplaza toda la lógica del router page.
<AuthModal> — Equivalente del Popup_crear_cuenta como modal de registro.
Orden recomendado de migración de pantallas
Prioridad	Pantalla	Justificación
1	index (login + signup modal)	Entrada al sistema, relativamente simple
2	router → middleware	Infraestructura de auth/routing, todo lo demás depende de esto
3	setup (wizard 3 pasos)	Onboarding; necesario para crear datos de prueba
4	resident_receipts + resident_receipt_detail	Flujo más simple y completo del sistema
5	admin_receipts + admin_receipt_detail	Flujo admin simple, corregir bug de navegación al migrar
6	admin_dashboard (solo Resumen tab)	La más compleja — migrar primero los KPIs, luego charts
7	Tabs vacías del dashboard (Recibos/Pagos, Reservas, Soporte)	No existe contenido aún; diseñar desde cero en código
8	reset_pw + 404	Supporting pages



