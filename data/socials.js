/** 三品牌社交預設；職員可喺後台改（存 localStorage）。已知連結已填，其餘 placeholder。 */
window.BPE_SOCIALS_DEFAULT = {
  version: 1,
  brands: [
    {
      id: "zihua",
      name: "紫花油",
      nameEn: "ZIHUA",
      color: "#6b3fa0",
      website: "https://www.hkzihua.com/",
      facebook: "",
      instagram: "",
      xiaohongshu: "",
      qrTarget: "https://www.hkzihua.com/"
    },
    {
      id: "dingding",
      name: "日本叮叮",
      nameEn: "Japan DingDing",
      color: "#1e3a5f",
      website: "https://www.japandingding.com/",
      facebook: "https://www.facebook.com/japandingding/",
      instagram: "",
      xiaohongshu: "",
      qrTarget: "https://www.facebook.com/japandingding/"
    },
    {
      id: "cupal",
      name: "古寶",
      nameEn: "Cupal",
      color: "#0f766e",
      website: "https://www.cupal.com.hk/",
      facebook: "",
      instagram: "",
      xiaohongshu: "",
      qrTarget: "https://www.cupal.com.hk/"
    }
  ]
};

window.BPE_PRIZES_DEFAULT = {
  version: 1,
  prizes: [
    { id: "pen", label: "紫花油原子筆", weight: 40 },
    { id: "calendar", label: "月歷（紫花油／日本叮叮／古寶隨機）", weight: 25, variants: ["紫花油月歷", "日本叮叮月歷", "古寶月歷"] },
    { id: "mystery", label: "神秘禮品", weight: 20 },
    { id: "coupon20", label: "優惠券 $20", weight: 15 }
  ]
};

window.BPE_CUPAL_PRODUCTS = [
  "Fortigel 骨膠原",
  "UC-II 關節",
  "安宮牛黃丸（按包裝說明）",
  "強腱肌",
  "濕敏淨／益生菌",
  "MSM 有機硫",
  "NMN",
  "液體鈣／Pro Calcium",
  "補適貼",
  "其他"
];
