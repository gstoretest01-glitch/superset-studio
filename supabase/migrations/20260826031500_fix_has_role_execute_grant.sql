-- FIX: migration 20260825093214 đã REVOKE EXECUTE trên has_role()/can_edit() từ role
-- `authenticated`, nhưng các RLS policy của user_roles, superset_connections,
-- report_themes, reports, report_blocks đều gọi 2 hàm này trong USING/WITH CHECK.
-- PostgREST chạy các câu lệnh dưới quyền `authenticated`; thiếu EXECUTE khiến MỌI
-- truy vấn chạm các policy đó trả về lỗi 42501 "permission denied for function has_role",
-- khiến tất cả user (kể cả admin) bị coi như không có quyền (mặc định viewer, không đọc
-- được report/block/connection nào). Khôi phục EXECUTE cho authenticated.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit(uuid) TO authenticated;
