# 開發者測試

網站部署不需執行此測試。

資料庫測試在獨立記憶體PostgreSQL執行，不連接老師的Supabase。需Node.js及`@electric-sql/pglite@0.3.14`。可在本目錄安裝測試依賴後執行：

```sh
npm install --no-save @electric-sql/pglite@0.3.14
node database.cjs
```

Auth schema/uid與角色是測試替身，不涵蓋真正郵件、PKCE／回跳及Supabase設定。測試驗證本版SQL可重跑、權限拒絕、共享、邀請撤銷、版本衝突與空堂演算法。不要把node_modules放到GitHub Pages或交付ZIP。
