/* 會場購物禮遇 seed — 跟 Lovable／攤位文案；送完即止；參考用途，非醫療建議 */
window.BPE_GIFTS_SEED = {
  title: "2026 工展會 · 會場購物禮遇",
  subtitle: "產品計數 · 預訂",
  disclaimer:
    "套裝價自動計算。花香套裝或滿 $168／任選 5 支花香油送陶瓷杯墊。任何消費送 2027 年曆卡。滿額贈品（磁石／雨傘／手提袋）以最高一級計。銀髮優惠 95 折後以實付金額計算贈品資格。送完即止；以攤位當日供應為準。參考用途，非醫療建議。",
  enabled: true,
  /* 花香套裝 SKU → 杯墊 */
  coasterSetCodes: ["Z0007A", "Z0007B", "Z0007C"],
  /* 花香油單支；滿 5 支亦送杯墊 */
  coasterScentCodes: ["ZE05", "ZE06", "ZE07"],
  coasterScentMin: 5,
  /* 滿額階（只取最高一級顯示為「滿額贈品」） */
  spendTierIds: ["magnet168", "umbrella328", "bag488"],
  tiers: [
    {
      id: "calendar",
      amount: 0,
      kind: "any",
      title: "2027年曆卡",
      desc: "任何消費即送 2027 年曆卡",
      emoji: "🗓️",
      applyNote: "任何消費",
      soldOut: false,
      paused: false
    },
    {
      id: "coaster",
      amount: 0,
      kind: "coaster",
      title: "紫花油陶瓷杯墊",
      desc: "花香套裝（紅薇／淡花／白木）每套送杯墊；或任選 5 支花香油／滿 $168 花香優惠送杯墊",
      emoji: "☕",
      applyNote: "花香套／5 支花香油",
      soldOut: false,
      paused: false
    },
    {
      id: "magnet168",
      amount: 168,
      kind: "total",
      title: "立體造型磁石貼",
      desc: "滿 $168 送立體造型磁石貼",
      emoji: "🧲",
      applyNote: "實付合計",
      cardLabel: "滿 $168 立體造型磁石貼",
      soldOut: false,
      paused: false
    },
    {
      id: "umbrella328",
      amount: 328,
      kind: "total",
      title: "摺疊雨傘",
      desc: "滿 $328 送摺疊雨傘",
      emoji: "☂️",
      applyNote: "實付合計",
      cardLabel: "滿 $328 摺疊雨傘",
      soldOut: false,
      paused: false
    },
    {
      id: "bag488",
      amount: 488,
      kind: "total",
      title: "手提袋",
      desc: "滿 $488 送手提袋",
      emoji: "🛍️",
      applyNote: "實付合計",
      cardLabel: "滿 $488 手提袋",
      soldOut: false,
      paused: false
    }
  ]
};
