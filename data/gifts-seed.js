/* 會場購物禮遇 seed（更新版）— 送完即止；參考用途，非醫療建議 */
window.BPE_GIFTS_SEED = {
  title: "會場購物禮遇",
  subtitle: "全場折實購物滿指定金額送贈品（送完即止）",
  disclaimer: "送完即止。贈品以攤位當日供應為準；詳見攤位／社交。$70 陶瓷杯墊只適用「1枝花香＋2枝6ml紫花油」同款套。參考用途，非醫療建議。",
  enabled: true,
  /* 杯墊適用套裝 SKU（點心紙特別套裝） */
  coasterSetCodes: ["Z0007A", "Z0007B", "Z0007C"],
  /* 亦可由單品組成：花香 1 支＋6ml 2 支 */
  coasterScentCodes: ["ZE05", "ZE06", "ZE07"],
  coasterOil6Codes: ["CO98"],
  tiers: [
    {
      id: "calendar",
      amount: 0,
      kind: "any",
      title: "2027年曆卡",
      desc: "任何消費即送：紫花油／日本叮叮／古寶 CUPAL 2027年曆卡",
      emoji: "🗓️",
      applyNote: "任何消費",
      soldOut: false,
      paused: false
    },
    {
      id: "coaster70",
      amount: 70,
      kind: "set70",
      title: "紫花油陶瓷杯墊",
      desc: "買滿 $70／套，適用（1枝花香＋2枝6ml紫花油）／同款套",
      emoji: "☕",
      applyNote: "指定花香套裝",
      soldOut: false,
      paused: false
    },
    {
      id: "magnet168",
      amount: 168,
      kind: "total",
      title: "紫花油立體造型磁石貼",
      desc: "買滿 $168（紫花油、DDM、CUPAL 及其他產品）",
      emoji: "🧲",
      applyNote: "全場折實合計",
      soldOut: false,
      paused: false
    },
    {
      id: "umbrella328",
      amount: 328,
      kind: "total",
      title: "紫花油摺疊雨傘",
      desc: "買滿 $328（紫花油、DDM、CUPAL 及其他產品）",
      emoji: "☂️",
      applyNote: "全場折實合計",
      soldOut: false,
      paused: false
    },
    {
      id: "bag488",
      amount: 488,
      kind: "total",
      title: "紫花油手提袋",
      desc: "買滿 $488（手提袋，約 35×43cm；紫花油、DDM、CUPAL 及其他產品）",
      emoji: "🛍️",
      applyNote: "全場折實合計",
      soldOut: false,
      paused: false
    }
  ]
};
