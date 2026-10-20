-- Temp tables require VOLATILE; STABLE rejected CREATE TABLE at runtime.
ALTER FUNCTION public.get_work_items_hierarchy_page(
  integer, integer, text, uuid, uuid[], uuid, boolean, "WorkItemType", uuid, jsonb, text, uuid
) VOLATILE;
