# 紫花油 · 2026 工展會（靜態 Pages）

第60屆工展會攤位工具（Lovable 風格底欄）：產品計數／預訂、抽獎遊戲、宅配入會、推廣員更表、3D 環視／地圖。

## 預覽

GitHub Pages：<https://lingling3899.github.io/zihua-bpe/?v=20261105l>

本機：

```bash
cd /workspace/zihua-bpe
python3 -m http.server 8766
```

## 底欄六頁

1. **3D 展位** — Three.js 立體展位（自動轉／拖轉）
2. **展位地圖** — 維園場次提示
3. **產品計數** — 搜尋／分類／加減／銀髮 95 折／滿額禮遇／預訂
4. **抽獎遊戲** — 輪盤／乒乓球／翻牌對對胡（示意）
5. **宅配入會** — CUPAL Health 宅配訂購表
6. **推廣員更表** — 按日期／按人；職員可編輯

## 職員登入

用 **Google 帳戶**認證；只准 `cherry3899@gmail.com`（已驗證電郵）登入後修改庫存／加產品／禮遇等。

Client ID 放喺 `data/google-client.js`（`window.ZIHUA_GOOGLE_CLIENT_ID`）。授權 JavaScript 來源：`https://lingling3899.github.io`。未填 Client ID 時登入掣會提示尚未設定。

### POS 機同單號

- 產品計數頂欄 **POS** 掣喺 POS1／POS2 之間切換（預設 POS1）
- 結算單號格式：`pos1-20261105-0001`（前綴＝邊部機；流水號全日共用，跟住落）
- 同一部機切換 POS1／POS2 共用當日流水；兩部實體機暫時各自計

資料存瀏覽器 `localStorage`／`sessionStorage`。禮遇／預訂／宅配／更表均可本機保存。

## 禮遇（送完即止）

- 任何消費：2027 年曆卡
- 花香套裝或任選 5 支花香油：陶瓷杯墊
- 實付滿 $168／$328／$488：磁石貼／摺疊雨傘／手提袋（**只計最高一級**）
- 銀髮 95 折後以實付金額計贈品

免責：參考用途，非醫療建議；獎品以攤位當日為準。

## 庫存（總預貨量）

- Seed：`data/stock-seed.js`（`window.BPE_STOCK_SEED`，版本 `20261105a`）
- 剩餘：瀏覽器 `localStorage` 鍵 `zihua_bpe_stock_remaining_v1`（只存與 seed 唔同嘅覆寫）
- 職員登入後：右上選單 **📦 庫存** → 搜尋／改剩餘／重設為總預貨量／匯出 CSV
- 產品計數頁每款顯示「庫存 N」；0 顯示「暫無貨」（唔硬擋下單，請職員確認）
- 散裝 CO98／CO99／ZE01／ZE05–07 用獨立摘要表較大數量；pack 套裝用 sheet1 pack 列存為 Z0004／Z0004B／Z0004C
