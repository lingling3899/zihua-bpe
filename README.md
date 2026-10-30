# 紫花油 · 工展會（靜態 Pages）

第60屆工展會攤位工具：展會資料、職員班表、遊戲抽獎、三品牌社交／QR、古寶入會表。

## 預覽（本機）

```bash
cd /workspace/zihua-bpe
python3 -m http.server 8766
```

瀏覽器開：<http://127.0.0.1:8766/?v=20261030a>

GitHub Pages：<https://lingling3899.github.io/zihua-bpe/?v=20261030a>

## 職員登入

| 項目 | 值 |
|------|-----|
| 帳號 | `zihua` |
| 密碼 | `office2026` |

資料存瀏覽器 `localStorage`（班表／入會／獎品權重／社交連結／得獎記錄）。

## 分頁

1. **展會資料** — 第60屆日期、時間、地點、入場、交通（連官方頁）
2. **班表** — Senior Promoter／Promoter／Cashier／宅配會員招募助理；點心紙備註；職員可增刪改
3. **遊戲** — 抽獎、投壺、豆袋、翻牌子、夾東西、拋圈圈；獎品池（原子筆／月歷／神秘禮品／$20 券）
4. **追蹤我哋** — 紫花油／日本叮叮／古寶 QR＋FB／IG／小紅書（可後台改）
5. **古寶入會** — 表單提交；後台列表、刪除、Export CSV
6. **後台** — 入會、獎品權重、社交連結（需登入）

## 部署 GitHub Pages

```bash
cd /workspace/zihua-bpe
git init
git add -A && git commit -m "Initial zihua-bpe fair booth app"
gh repo create lingling3899/zihua-bpe --public --source=. --remote=origin --push
gh api repos/lingling3899/zihua-bpe/pages -X POST -f build_type=legacy -F 'source[branch]=main' -F 'source[path]=/'
```

（若 repo 已存在：`git push -u origin main`，再開 Pages source = `main`／`/`。）

## 已知限制

- 點心紙／真名時間表附件未入庫；預載為「待填」範本班次（2026-12-12～2027-01-04）
- 紫花油／古寶 FB／IG／小紅書多數為 placeholder，職員可後台補
- 叮叮 Facebook 已填：`facebook.com/japandingding`
- 遊戲為簡易 HTML 互動，非真實物理
- 入會資料只存本機，換裝置唔會同步

## 免責

參考用途，非醫療建議；唔聲稱產品療效。獎品以攤位當日供應為準。
