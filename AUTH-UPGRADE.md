# P126 V0.2 — SBI-P-SDS v3.1 帳號更新

P126 保留共用 Supabase Auth 登入與既有專案獨立 storageKey `p126-auth-token`，不需登出所有既有使用者。註冊、忘記密碼、修改密碼及共用帳號基本資料改連 P130。課表顯示資料仍屬 P126 業務資料。

登入密碼預設隱藏，可按「顯示密碼／隱藏密碼」，送出登入、切換分頁時恢復隱藏。移除 signUp、resetPasswordForEmail、updateUser 與密碼重設視窗；不再接收 URL session。舊郵件連結提示使用者改到 P130，且不轉送 token。

不修改既有 config.js、資料表、課表、群組或 RPC；既有部署不需執行 SQL。account-config.js 提供已核對的 P130 網址，config.js 可選擇以 accountCenterUrl 覆寫。請勿刪除既有 Supabase Redirect URLs；新註冊及密碼郵件回 P130，由 P130 管理。

共用 Auth 帳號可首次建立自己的 P126 課表；群組資格、角色及課表細節分享繼續由 P126 RPC 控制。本次不臆造尚未定案的共用 Project Access 表或跨專案授權介面。

驗收：既有帳號登入、登入失敗、顯示密碼切換、P130 三個連結、登出及課表／群組操作。P130 首頁目前以頁籤切換註冊，連到首頁後請選註冊。實際密碼驗證、SMTP 郵件與正式資料操作仍需持帳號者驗收。
