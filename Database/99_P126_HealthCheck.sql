-- 唯讀。所有表：exists/rls/rpc_only 應 true；policy_count 應 0。
WITH expected(name) AS (VALUES ('TblP126Profile'),('TblP126Period'),('TblP126Timetable'),('TblP126BusySlot'),('TblP126Group'),('TblP126GroupMember'),('TblP126GroupInvite'))
SELECT e.name, c.oid IS NOT NULL AS exists, c.relrowsecurity AS rls,
 NOT (has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') OR has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE')) AS rpc_only,
 has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE') AS service_access,
 (SELECT count(*) FROM pg_policy WHERE polrelid=c.oid) AS policy_count
FROM expected e LEFT JOIN pg_class c ON c.relname=e.name AND c.relnamespace='public'::regnamespace;
SELECT p.proname,p.prosecdef,p.proconfig,pg_get_function_identity_arguments(p.oid) AS arguments,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
 NOT has_function_privilege('anon',p.oid,'EXECUTE') AS anon_blocked
FROM pg_proc p WHERE p.proname='P126Action' AND p.pronamespace='public'::regnamespace;
SELECT count(*)=12 AS twelve_periods FROM public."TblP126Period";
SELECT count(*) AS owner_membership_errors FROM public."TblP126Group" g WHERE NOT EXISTS(
 SELECT 1 FROM public."TblP126GroupMember" m WHERE m."GroupID"=g."GroupID" AND m."UserID"=g."OwnerID" AND m."Role"='admin');

-- 欄位檢查：missing_columns 應為0。
WITH expected(tbl,col) AS (VALUES ('TblP126Profile','UserID'),('TblP126Profile','DisplayName'),('TblP126Profile','Department'),('TblP126Profile','Identity'),('TblP126Profile','CreatedAt'),('TblP126Period','Period'),('TblP126Period','StartTime'),('TblP126Period','EndTime'),('TblP126Timetable','TimetableID'),('TblP126Timetable','UserID'),('TblP126Timetable','ConfirmedAt'),('TblP126Timetable','UpdatedAt'),('TblP126Timetable','Revision'),('TblP126BusySlot','TimetableID'),('TblP126BusySlot','Day'),('TblP126BusySlot','Period'),('TblP126BusySlot','Kind'),('TblP126BusySlot','Title'),('TblP126BusySlot','Room'),('TblP126Group','GroupID'),('TblP126Group','Name'),('TblP126Group','Description'),('TblP126Group','OwnerID'),('TblP126Group','CreatedAt'),('TblP126GroupMember','GroupID'),('TblP126GroupMember','UserID'),('TblP126GroupMember','Role'),('TblP126GroupMember','ShareDetails'),('TblP126GroupMember','JoinedAt'),('TblP126GroupInvite','InviteID'),('TblP126GroupInvite','GroupID'),('TblP126GroupInvite','CodeHash'),('TblP126GroupInvite','ExpiresAt'),('TblP126GroupInvite','Revoked'),('TblP126GroupInvite','CreatedAt'))
SELECT count(*) AS missing_columns FROM expected e WHERE NOT EXISTS(
 SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name=e.tbl AND c.column_name=e.col);
-- 函式應只有一個簽名。
SELECT count(*)=1 AS single_rpc_signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='P126Action';
