-- Habilita RLS para cerrar exposicion accidental via PostgREST/Supabase Data API
-- en tablas public de PropSys.
--
-- PropSys no usa Supabase Data API desde frontend para estas tablas: el acceso
-- pasa por API routes/server-side usando DATABASE_URL. Por eso esta migracion
-- no crea policies publicas/permisivas y no fuerza RLS sobre owners/bypass roles.

ALTER TABLE IF EXISTS public.auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.checklist_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.common_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.evidence_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.receipt_payment_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_building_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_unit_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.receipts ENABLE ROW LEVEL SECURITY;
