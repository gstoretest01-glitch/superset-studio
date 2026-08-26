DELETE FROM public.user_roles
WHERE user_id = '0ef890ea-cf75-4027-9251-be07ad8627e4'
  AND role = 'viewer'::public.app_role;

INSERT INTO public.user_roles (user_id, role)
VALUES ('0ef890ea-cf75-4027-9251-be07ad8627e4', 'admin'::public.app_role)
ON CONFLICT (user_id, role) DO NOTHING;