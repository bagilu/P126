# P126 V0.1 Schema

所有資料表位於 public，採帶雙引號 PascalCase 命名。UUID 用 PostgreSQL gen_random_uuid；時間用 timestamptz，畫面依瀏覽器時區顯示。沒有學期欄位。

| 表 | 欄位與型別 | 關聯／限制 |
|---|---|---|
| TblP126Profile | UserID uuid PK；DisplayName text；Department text；Identity text；CreatedAt timestamptz | UserID → auth.users.id；姓名1–80字、系所≤120字；Identity student/teacher/other |
| TblP126Period | Period smallint PK；StartTime time nullable；EndTime time nullable | 1–12；時間同時為空或結束晚於開始 |
| TblP126Timetable | TimetableID uuid PK；UserID uuid UNIQUE；ConfirmedAt timestamptz nullable；UpdatedAt timestamptz；Revision integer | UserID → Profile；一人一表；Revision用於避免舊資料覆蓋 |
| TblP126BusySlot | TimetableID uuid；Day smallint；Period smallint；Kind text；Title text；Room text | 複合PK(TimetableID,Day,Period)；FK課表與節次；Day 1–6；Kind course/other；Title1–100字，Room≤100字 |
| TblP126Group | GroupID uuid PK；Name text；Description text；OwnerID uuid；CreatedAt timestamptz | OwnerID → Profile，ON DELETE RESTRICT；Name1–80字，Description≤500字 |
| TblP126GroupMember | GroupID uuid；UserID uuid；Role text；ShareDetails boolean；JoinedAt timestamptz | 複合PK(GroupID,UserID)；Role admin/member；擁有者由Group.OwnerID判定且必須是admin成員 |
| TblP126GroupInvite | InviteID uuid PK；GroupID uuid；CodeHash text UNIQUE；ExpiresAt timestamptz；Revoked boolean；CreatedAt timestamptz | GroupID → Group；邀請碼32字元隨機UUID hex，儲存SHA-256 hex；預設7日 |

除 Group.OwnerID 的 RESTRICT 外，從屬資料外鍵採 ON DELETE CASCADE。一般使用者只能經 RPC 刪除群組／自己的課表內容；沒有刪除共用 Auth 或 Profile 的入口。

## RPC

唯一公開業務入口：`public."P126Action"(p_action text, p_data jsonb DEFAULT '{}') RETURNS jsonb`。

| action | p_data | 結果／資格 |
|---|---|---|
| bootstrap | {} | 已登入；補建自己的 Profile、Timetable，回傳state |
| state | {} | 自己的資料、12節次、課表、所屬群組 |
| profile | name,department,identity | 只更新自己 |
| save_timetable | revision,slots,confirmed | 只更新自己的72格；鎖課表列並檢查Revision；交易內整份替換 |
| create_group | name,description | 建群並將自己加入admin |
| join | code | 有效邀請碼；重複加入不新增重複資料 |
| members | group_id | 只限群組成員；回傳姓名、系所、角色、確認時間等，不含課程細節 |
| share | group_id,share | 只設定自己的分享權 |
| rename_group | group_id,name,description | admin |
| invite | group_id | admin；撤銷舊碼、傳回新碼與到期時間；明文只回傳一次 |
| revoke_invites | group_id | admin |
| set_role | group_id,user_id,role | 只有擁有者；不能改自己／擁有者 |
| remove_member | group_id,user_id | admin；一般admin不能移除其他admin／擁有者 |
| leave | group_id | 非擁有者自行退出 |
| delete_group | group_id | 只有擁有者；不刪課表 |
| people | {} | 自己＋至少有一個共同群組者，附共同GroupIDs，不列出對方其他群組 |
| compare | user_ids | 1–100人；每人皆是自己或共同群組者；回傳確認狀態與忙碌格，未授權細節為null |

## 安全實作

- 全表RLS、無直接policy、撤銷PUBLIC/anon/authenticated資料表權限。
- authenticated僅可EXECUTE RPC；anon/PUBLIC不可。
- SECURITY DEFINER固定search_path=''，完整public/auth表名，不使用動態SQL。
- 不讀取他人的Email；群組成員只以P126公開姓名／系所辨識。
- share=false時不是由前端隱藏欄位，而是RPC回傳null。
- 跨群組可選人：每位被選者須與查詢者至少有一個共同群組，不要求被選者彼此同群。
- 所有人共享同一套節次；只有資料庫管理者透過Table Editor設定時間。
- 普通查表policy刻意不存在，健康檢查policy_count=0才是本版預期。

完整可執行欄位定義見 Database/01_CreateTables.sql，權限邏輯見04與07。
