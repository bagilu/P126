CREATE TABLE IF NOT EXISTS public."TblP126Profile" (
 "UserID" uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 "DisplayName" text NOT NULL CHECK (length(btrim("DisplayName")) BETWEEN 1 AND 80),
 "Department" text NOT NULL DEFAULT '' CHECK(length("Department")<=120),
 "Identity" text NOT NULL DEFAULT 'student' CHECK("Identity" IN ('student','teacher','other')),
 "CreatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public."TblP126Period" (
 "Period" smallint PRIMARY KEY CHECK("Period" BETWEEN 1 AND 12),
 "StartTime" time, "EndTime" time,
 CHECK(("StartTime" IS NULL AND "EndTime" IS NULL) OR ("StartTime" IS NOT NULL AND "EndTime" > "StartTime"))
);
CREATE TABLE IF NOT EXISTS public."TblP126Timetable" (
 "TimetableID" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 "UserID" uuid NOT NULL UNIQUE REFERENCES public."TblP126Profile"("UserID") ON DELETE CASCADE,
 "ConfirmedAt" timestamptz, "UpdatedAt" timestamptz NOT NULL DEFAULT now(),
 "Revision" integer NOT NULL DEFAULT 0 CHECK("Revision">=0)
);
CREATE TABLE IF NOT EXISTS public."TblP126BusySlot" (
 "TimetableID" uuid NOT NULL REFERENCES public."TblP126Timetable"("TimetableID") ON DELETE CASCADE,
 "Day" smallint NOT NULL CHECK("Day" BETWEEN 1 AND 6),
 "Period" smallint NOT NULL REFERENCES public."TblP126Period"("Period"),
 "Kind" text NOT NULL CHECK("Kind" IN ('course','other')),
 "Title" text NOT NULL CHECK(length(btrim("Title")) BETWEEN 1 AND 100),
 "Room" text NOT NULL DEFAULT '' CHECK(length("Room")<=100),
 PRIMARY KEY("TimetableID","Day","Period")
);
CREATE TABLE IF NOT EXISTS public."TblP126Group" (
 "GroupID" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 "Name" text NOT NULL CHECK(length(btrim("Name")) BETWEEN 1 AND 80),
 "Description" text NOT NULL DEFAULT '' CHECK(length("Description")<=500),
 "OwnerID" uuid NOT NULL REFERENCES public."TblP126Profile"("UserID") ON DELETE RESTRICT,
 "CreatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public."TblP126GroupMember" (
 "GroupID" uuid NOT NULL REFERENCES public."TblP126Group"("GroupID") ON DELETE CASCADE,
 "UserID" uuid NOT NULL REFERENCES public."TblP126Profile"("UserID") ON DELETE CASCADE,
 "Role" text NOT NULL DEFAULT 'member' CHECK("Role" IN ('admin','member')),
 "ShareDetails" boolean NOT NULL DEFAULT false,
 "JoinedAt" timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY("GroupID","UserID")
);
CREATE TABLE IF NOT EXISTS public."TblP126GroupInvite" (
 "InviteID" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 "GroupID" uuid NOT NULL REFERENCES public."TblP126Group"("GroupID") ON DELETE CASCADE,
 "CodeHash" text NOT NULL UNIQUE CHECK(length("CodeHash")=64),
 "ExpiresAt" timestamptz NOT NULL,
 "Revoked" boolean NOT NULL DEFAULT false,
 "CreatedAt" timestamptz NOT NULL DEFAULT now()
);
