CREATE INDEX IF NOT EXISTS "idx_TblP126GroupMember_User" ON public."TblP126GroupMember"("UserID");
CREATE INDEX IF NOT EXISTS "idx_TblP126Group_Owner" ON public."TblP126Group"("OwnerID");
CREATE INDEX IF NOT EXISTS "idx_TblP126GroupInvite_Group" ON public."TblP126GroupInvite"("GroupID");
