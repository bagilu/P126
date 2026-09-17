CREATE OR REPLACE FUNCTION public."P126Action"(p_action text, p_data jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 u uuid := auth.uid(); g uuid; target uuid; tid uuid; owner_id uuid;
 role_name text; code text; rev integer; item jsonb; ids uuid[];
 result jsonb; stamp timestamptz := clock_timestamp();
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION '請先登入'; END IF;
 IF p_data IS NULL OR jsonb_typeof(p_data) <> 'object' OR octet_length(p_data::text)>60000 THEN
  RAISE EXCEPTION '資料格式不正確或過大'; END IF;
 IF p_action='bootstrap' THEN
  INSERT INTO public."TblP126Profile"("UserID","DisplayName") VALUES(u,'尚未設定姓名') ON CONFLICT DO NOTHING;
  INSERT INTO public."TblP126Timetable"("UserID") VALUES(u) ON CONFLICT DO NOTHING;
 ELSIF NOT EXISTS(SELECT 1 FROM public."TblP126Profile" WHERE "UserID"=u) THEN
  RAISE EXCEPTION '請先建立 P126 個人資料';
 END IF;
 IF p_action IN ('bootstrap','state') THEN
  RETURN jsonb_build_object(
   'profile',(SELECT to_jsonb(p) FROM public."TblP126Profile" p WHERE "UserID"=u),
   'timetable',(SELECT to_jsonb(t) FROM public."TblP126Timetable" t WHERE "UserID"=u),
   'periods',(SELECT jsonb_agg(to_jsonb(p) ORDER BY "Period") FROM public."TblP126Period" p),
   'slots',COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY "Day","Period") FROM public."TblP126BusySlot" s JOIN public."TblP126Timetable" t USING("TimetableID") WHERE t."UserID"=u),'[]'::jsonb),
   'groups',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x."Name") FROM (
    SELECT g.*,m."Role",m."ShareDetails" FROM public."TblP126Group" g JOIN public."TblP126GroupMember" m USING("GroupID") WHERE m."UserID"=u
   ) x),'[]'::jsonb)
  );
 ELSIF p_action='profile' THEN
  UPDATE public."TblP126Profile" SET "DisplayName"=btrim(p_data->>'name'),"Department"=btrim(COALESCE(p_data->>'department','')),"Identity"=p_data->>'identity' WHERE "UserID"=u;
 ELSIF p_action='save_timetable' THEN
  SELECT "TimetableID","Revision" INTO tid,rev FROM public."TblP126Timetable" WHERE "UserID"=u FOR UPDATE;
  IF (p_data->>'revision')::integer IS DISTINCT FROM rev THEN RAISE EXCEPTION '課表已在其他視窗更新，請重新載入後再編輯'; END IF;
  IF jsonb_typeof(p_data->'slots') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION '課表格式不正確'; END IF;
  IF jsonb_array_length(p_data->'slots')>72 THEN RAISE EXCEPTION '最多72格'; END IF;
  DELETE FROM public."TblP126BusySlot" WHERE "TimetableID"=tid;
  FOR item IN SELECT value FROM jsonb_array_elements(p_data->'slots') LOOP
   INSERT INTO public."TblP126BusySlot"("TimetableID","Day","Period","Kind","Title","Room")
   VALUES(tid,(item->>'Day')::smallint,(item->>'Period')::smallint,item->>'Kind',btrim(item->>'Title'),btrim(COALESCE(item->>'Room','')));
  END LOOP;
  UPDATE public."TblP126Timetable" SET "Revision"=rev+1,"UpdatedAt"=stamp,
   "ConfirmedAt"=CASE WHEN COALESCE((p_data->>'confirmed')::boolean,false) THEN stamp ELSE NULL END WHERE "TimetableID"=tid;
 ELSIF p_action='create_group' THEN
  INSERT INTO public."TblP126Group"("Name","Description","OwnerID") VALUES(btrim(p_data->>'name'),COALESCE(p_data->>'description',''),u) RETURNING "GroupID" INTO g;
  INSERT INTO public."TblP126GroupMember"("GroupID","UserID","Role") VALUES(g,u,'admin');
  RETURN jsonb_build_object('group_id',g);
 ELSIF p_action='join' THEN
  code:=lower(btrim(p_data->>'code'));
  IF code IS NULL OR code !~ '^[0-9a-f]{32}$' THEN RAISE EXCEPTION '邀請碼格式不正確'; END IF;
  SELECT "GroupID" INTO g FROM public."TblP126GroupInvite" WHERE "CodeHash"=encode(sha256(convert_to(code,'UTF8')),'hex') AND NOT "Revoked" AND "ExpiresAt">stamp FOR SHARE;
  IF g IS NULL THEN RAISE EXCEPTION '邀請碼無效、已停用或已到期'; END IF;
  INSERT INTO public."TblP126GroupMember"("GroupID","UserID") VALUES(g,u) ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('group_id',g);
 ELSIF p_action IN ('members','share','rename_group','invite','revoke_invites','remove_member','set_role','leave','delete_group') THEN
  g:=(p_data->>'group_id')::uuid;
  SELECT "OwnerID" INTO owner_id FROM public."TblP126Group" WHERE "GroupID"=g FOR UPDATE;
  SELECT "Role" INTO role_name FROM public."TblP126GroupMember" WHERE "GroupID"=g AND "UserID"=u;
  IF role_name IS NULL THEN RAISE EXCEPTION '無權存取此群組'; END IF;
  IF p_action='members' THEN
   RETURN COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x."DisplayName") FROM (
    SELECT p."UserID",p."DisplayName",p."Department",p."Identity",m."Role",m."ShareDetails",t."ConfirmedAt",t."UpdatedAt"
    FROM public."TblP126GroupMember" m JOIN public."TblP126Profile" p USING("UserID") JOIN public."TblP126Timetable" t USING("UserID") WHERE m."GroupID"=g
   ) x),'[]'::jsonb);
  ELSIF p_action='share' THEN
   UPDATE public."TblP126GroupMember" SET "ShareDetails"=COALESCE((p_data->>'share')::boolean,false) WHERE "GroupID"=g AND "UserID"=u;
  ELSIF p_action='leave' THEN
   IF owner_id=u THEN RAISE EXCEPTION '擁有者請使用刪除群組；無法直接退出'; END IF;
   DELETE FROM public."TblP126GroupMember" WHERE "GroupID"=g AND "UserID"=u;
  ELSE
   IF role_name<>'admin' THEN RAISE EXCEPTION '需要群組管理權限'; END IF;
   IF p_action='rename_group' THEN
    UPDATE public."TblP126Group" SET "Name"=btrim(p_data->>'name'),"Description"=COALESCE(p_data->>'description','') WHERE "GroupID"=g;
   ELSIF p_action='invite' THEN
    UPDATE public."TblP126GroupInvite" SET "Revoked"=true WHERE "GroupID"=g AND NOT "Revoked";
    code:=replace(gen_random_uuid()::text,'-','');
    INSERT INTO public."TblP126GroupInvite"("GroupID","CodeHash","ExpiresAt") VALUES(g,encode(sha256(convert_to(code,'UTF8')),'hex'),stamp+interval '7 days');
    RETURN jsonb_build_object('code',code,'expires_at',stamp+interval '7 days');
   ELSIF p_action='revoke_invites' THEN
    UPDATE public."TblP126GroupInvite" SET "Revoked"=true WHERE "GroupID"=g;
   ELSIF p_action IN ('remove_member','set_role') THEN
    target:=(p_data->>'user_id')::uuid;
    IF target IS NULL OR target=owner_id OR target=u THEN RAISE EXCEPTION '不能以此操作變更擁有者或自己'; END IF;
    IF p_action='set_role' THEN
     IF owner_id<>u THEN RAISE EXCEPTION '只有擁有者能調整管理者'; END IF;
     UPDATE public."TblP126GroupMember" SET "Role"=p_data->>'role' WHERE "GroupID"=g AND "UserID"=target;
    ELSE
     IF owner_id<>u AND EXISTS(SELECT 1 FROM public."TblP126GroupMember" WHERE "GroupID"=g AND "UserID"=target AND "Role"='admin') THEN RAISE EXCEPTION '管理者不能移除其他管理者'; END IF;
     DELETE FROM public."TblP126GroupMember" WHERE "GroupID"=g AND "UserID"=target;
    END IF;
   ELSIF p_action='delete_group' THEN
    IF owner_id<>u THEN RAISE EXCEPTION '只有擁有者能刪除群組'; END IF;
    DELETE FROM public."TblP126Group" WHERE "GroupID"=g;
   END IF;
  END IF;
 ELSIF p_action='people' THEN
  RETURN COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x."DisplayName") FROM (
   SELECT p."UserID",p."DisplayName",p."Department",t."ConfirmedAt",t."UpdatedAt",
    COALESCE((SELECT jsonb_agg(m."GroupID") FROM public."TblP126GroupMember" m JOIN public."TblP126GroupMember" mine ON mine."GroupID"=m."GroupID" AND mine."UserID"=u WHERE m."UserID"=p."UserID"),'[]'::jsonb) AS "GroupIDs"
   FROM public."TblP126Profile" p JOIN public."TblP126Timetable" t USING("UserID") WHERE p."UserID"=u OR EXISTS(
    SELECT 1 FROM public."TblP126GroupMember" m JOIN public."TblP126GroupMember" mine ON mine."GroupID"=m."GroupID" AND mine."UserID"=u WHERE m."UserID"=p."UserID"
   )
  ) x),'[]'::jsonb);
 ELSIF p_action='compare' THEN
  IF jsonb_typeof(p_data->'user_ids') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION '請選取人員'; END IF;
  IF jsonb_array_length(p_data->'user_ids') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION '請選取1至100人'; END IF;
  SELECT array_agg(DISTINCT value::uuid) INTO ids FROM jsonb_array_elements_text(p_data->'user_ids');
  IF EXISTS(SELECT 1 FROM unnest(ids) AS picked(id) WHERE id IS NULL OR NOT EXISTS(
   SELECT 1 FROM public."TblP126Profile" p WHERE p."UserID"=picked.id AND (p."UserID"=u OR EXISTS(
    SELECT 1 FROM public."TblP126GroupMember" m JOIN public."TblP126GroupMember" mine ON mine."GroupID"=m."GroupID" AND mine."UserID"=u WHERE m."UserID"=p."UserID"
   ))
  )) THEN RAISE EXCEPTION '部分人員不在您的群組內，請重新選取'; END IF;
  RETURN (SELECT jsonb_agg(to_jsonb(x) ORDER BY x."DisplayName") FROM (
   SELECT p."UserID",p."DisplayName",t."ConfirmedAt",t."UpdatedAt",
    COALESCE((SELECT jsonb_agg(jsonb_build_object('Day',s."Day",'Period',s."Period",
     'Title',CASE WHEN p."UserID"=u OR EXISTS(SELECT 1 FROM public."TblP126GroupMember" m JOIN public."TblP126GroupMember" mine ON mine."GroupID"=m."GroupID" AND mine."UserID"=u WHERE m."UserID"=p."UserID" AND m."ShareDetails") THEN s."Title" ELSE NULL END,
     'Room',CASE WHEN p."UserID"=u OR EXISTS(SELECT 1 FROM public."TblP126GroupMember" m JOIN public."TblP126GroupMember" mine ON mine."GroupID"=m."GroupID" AND mine."UserID"=u WHERE m."UserID"=p."UserID" AND m."ShareDetails") THEN s."Room" ELSE NULL END
    ) ORDER BY s."Day",s."Period") FROM public."TblP126BusySlot" s WHERE s."TimetableID"=t."TimetableID"),'[]'::jsonb) AS "Slots"
   FROM public."TblP126Profile" p JOIN public."TblP126Timetable" t USING("UserID") WHERE p."UserID"=ANY(ids)
  ) x);
 ELSE RAISE EXCEPTION '不支援的操作';
 END IF;
 RETURN jsonb_build_object('ok',true);
END;
$$;
REVOKE ALL ON FUNCTION public."P126Action"(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public."P126Action"(text,jsonb) TO authenticated;
