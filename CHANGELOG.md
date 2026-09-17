# CHANGELOG

## V0.1 — Current Timetable & Shared Auth（2026-09-17）

- 新增Supabase共用帳號註冊、登入、重設／變更密碼與獨立session儲存。
- 新增唯一目前課表、6×12格、連續節次編輯、確認狀態與Revision檢查。
- 新增群組、邀請碼、管理者、逐群組細節分享。
- 新增跨群組選人、空堂比對、連續節次篩選與格子明細。
- SQL為全新P126初始化，不是既有專案migration；不修改其他P專案資料。
- 未提供真實config.js；部署者自行填入公開設定。原有專案設定不覆蓋。
- 本機驗證詳見Documents/Verification.md；實際Email、Auth回跳與多人裝置操作待部署驗收。
