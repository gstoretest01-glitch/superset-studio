-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'viewer');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.can_edit(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','editor')
  )
$$;

CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_roles_admin_manage" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- new user bootstrap: profile + first user becomes admin, others viewer
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;

  SELECT count(*) INTO user_count FROM public.user_roles;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN user_count = 0 THEN 'admin'::public.app_role ELSE 'viewer'::public.app_role END)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- SUPERSET CONNECTIONS
CREATE TABLE public.superset_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  service_username TEXT NOT NULL DEFAULT '',
  auth_provider TEXT NOT NULL DEFAULT 'db',
  is_default BOOLEAN NOT NULL DEFAULT false,
  last_checked_at TIMESTAMPTZ,
  last_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.superset_connections TO authenticated;
GRANT ALL ON public.superset_connections TO service_role;
ALTER TABLE public.superset_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conn_select_auth" ON public.superset_connections FOR SELECT TO authenticated USING (true);
CREATE POLICY "conn_admin_manage" ON public.superset_connections FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER conn_updated_at BEFORE UPDATE ON public.superset_connections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- THEMES
CREATE TABLE public.report_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  palette TEXT[] NOT NULL DEFAULT ARRAY['#2dd4bf','#f59e0b','#60a5fa','#f472b6','#a3e635','#fb7185','#38bdf8','#facc15'],
  surface_color TEXT NOT NULL DEFAULT '#111820',
  page_color TEXT NOT NULL DEFAULT '#0b0f14',
  text_color TEXT NOT NULL DEFAULT '#e6edf3',
  muted_text_color TEXT NOT NULL DEFAULT '#8b98a5',
  border_color TEXT NOT NULL DEFAULT '#1f2a35',
  accent_color TEXT NOT NULL DEFAULT '#2dd4bf',
  font_family TEXT NOT NULL DEFAULT 'Inter',
  radius_px INT NOT NULL DEFAULT 14,
  gap_px INT NOT NULL DEFAULT 16,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_themes TO authenticated;
GRANT SELECT ON public.report_themes TO anon;
GRANT ALL ON public.report_themes TO service_role;
ALTER TABLE public.report_themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "themes_public_read" ON public.report_themes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "themes_editor_manage" ON public.report_themes FOR ALL TO authenticated USING (public.can_edit(auth.uid())) WITH CHECK (public.can_edit(auth.uid()));
CREATE TRIGGER themes_updated_at BEFORE UPDATE ON public.report_themes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- REPORTS
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  theme_id UUID REFERENCES public.report_themes(id) ON DELETE SET NULL,
  connection_id UUID REFERENCES public.superset_connections(id) ON DELETE SET NULL,
  is_published BOOLEAN NOT NULL DEFAULT false,
  grid_columns INT NOT NULL DEFAULT 12,
  max_width_px INT NOT NULL DEFAULT 1440,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT SELECT ON public.reports TO anon;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_public_published" ON public.reports FOR SELECT TO anon USING (is_published = true);
CREATE POLICY "reports_auth_read_all" ON public.reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "reports_editor_manage" ON public.reports FOR ALL TO authenticated USING (public.can_edit(auth.uid())) WITH CHECK (public.can_edit(auth.uid()));
CREATE TRIGGER reports_updated_at BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- BLOCKS
CREATE TABLE public.report_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  block_type TEXT NOT NULL DEFAULT 'superset_chart',
  render_mode TEXT NOT NULL DEFAULT 'iframe',
  chart_id INT,
  chart_name TEXT,
  title TEXT,
  body TEXT,
  position INT NOT NULL DEFAULT 0,
  span_lg INT NOT NULL DEFAULT 6,
  span_md INT NOT NULL DEFAULT 6,
  span_sm INT NOT NULL DEFAULT 12,
  height_px INT NOT NULL DEFAULT 340,
  height_sm_px INT NOT NULL DEFAULT 280,
  hide_on_mobile BOOLEAN NOT NULL DEFAULT false,
  show_title BOOLEAN NOT NULL DEFAULT true,
  background_color TEXT,
  border_color TEXT,
  radius_px INT,
  padding_px INT NOT NULL DEFAULT 12,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX report_blocks_report_idx ON public.report_blocks(report_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_blocks TO authenticated;
GRANT SELECT ON public.report_blocks TO anon;
GRANT ALL ON public.report_blocks TO service_role;
ALTER TABLE public.report_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocks_public_published" ON public.report_blocks FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND r.is_published = true));
CREATE POLICY "blocks_auth_read" ON public.report_blocks FOR SELECT TO authenticated USING (true);
CREATE POLICY "blocks_editor_manage" ON public.report_blocks FOR ALL TO authenticated USING (public.can_edit(auth.uid())) WITH CHECK (public.can_edit(auth.uid()));
CREATE TRIGGER blocks_updated_at BEFORE UPDATE ON public.report_blocks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SEED default theme
INSERT INTO public.report_themes (name, description, is_default)
VALUES ('Mặc định — Tối', 'Bộ màu tối tương phản cao dành cho màn hình lớn và điện thoại', true);
