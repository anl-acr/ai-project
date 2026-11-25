/**
 * Nornia Real Desk Phone Photo Catalog & Hardware Coordinate Registry
 * ===================================================================
 * Maps all 56 auto-provisioning IP phone models (Yealink, Grandstream, Fanvil, Cisco)
 * to their 21 tight-cropped front-view product photos under `/images/phones/*.jpg`
 * with calibrated percentage coordinates for:
 *   - `lcd`: Live monochrome / color / touch LCD overlay rectangle
 *   - `leftBtnX` / `rightBtnX` / `btnTop` / `btnStep`: Physical DSS/BLF LED buttons
 *   - `softkeys`: Physical F1–F4 softkey hotspot row below LCD
 *   - `sideDss`: Secondary side BLF display strip (for dual-screen models like X4U/X6U/GRP2616)
 */

export const CHASSIS_SPECS = {
  // ======================= YEALINK (9 chassis -> 25 models) =======================
  "yealink-t23g": {
    image: "/images/phones/yealink-t23g.jpg",
    aspect: "455 / 341",
    lcd: { left: 54.6, top: 17.5, width: 22.8, height: 13.8 },
    btnMode: "right_only",
    rightBtnX: 80.0,
    btnW: 6.0,
    btnH: 3.4,
    btnTop: 18.8,
    btnStep: 4.2,
    softkeys: { left: 54.5, top: 34.8, width: 23.5, height: 3.4 },
  },
  "yealink-t29g": {
    image: "/images/phones/yealink-t29g.jpg",
    aspect: "582 / 344",
    lcd: { left: 54.5, top: 19.5, width: 29.0, height: 26.2 },
    btnMode: "split",
    leftBtnX: 48.2,
    rightBtnX: 84.4,
    btnW: 4.8,
    btnH: 3.0,
    btnTop: 21.8,
    btnStep: 4.3,
    softkeys: { left: 54.5, top: 49.5, width: 27.5, height: 3.6 },
  },
  "yealink-t31g": {
    image: "/images/phones/yealink-t31g.jpg",
    aspect: "650 / 539",
    lcd: { left: 60.4, top: 18.8, width: 20.8, height: 13.8 },
    btnMode: "right_only",
    rightBtnX: 83.2,
    btnW: 5.5,
    btnH: 3.0,
    btnTop: 21.8,
    btnStep: 4.4,
    softkeys: { left: 60.0, top: 36.2, width: 21.5, height: 3.2 },
  },
  "yealink-t33g": {
    image: "/images/phones/yealink-t33g.jpg",
    aspect: "650 / 485",
    lcd: { left: 59.8, top: 18.2, width: 19.0, height: 17.5 },
    btnMode: "right_only",
    rightBtnX: 81.2,
    btnW: 5.8,
    btnH: 2.9,
    btnTop: 19.4,
    btnStep: 3.8,
    softkeys: { left: 59.8, top: 39.2, width: 20.0, height: 3.2 },
  },
  "yealink-t42s": {
    image: "/images/phones/yealink-t42s.jpg",
    aspect: "681 / 551",
    lcd: { left: 54.1, top: 19.8, width: 27.9, height: 14.8 },
    btnMode: "split",
    leftBtnX: 48.2,
    rightBtnX: 82.4,
    btnW: 5.5,
    btnH: 2.9,
    btnTop: 23.0,
    btnStep: 3.6,
    softkeys: { left: 56.6, top: 37.2, width: 23.0, height: 3.2 },
  },
  "yealink-t46u": {
    image: "/images/phones/yealink-t46u.jpg",
    aspect: "720 / 562",
    lcd: { left: 51.0, top: 18.2, width: 31.0, height: 17.6 },
    btnMode: "split",
    leftBtnX: 45.6,
    rightBtnX: 82.5,
    btnW: 4.8,
    btnH: 2.4,
    btnTop: 19.5,
    btnStep: 3.1,
    softkeys: { left: 53.5, top: 38.2, width: 26.0, height: 3.0 },
  },
  "yealink-t48u": {
    image: "/images/phones/yealink-t48u.jpg",
    aspect: "618 / 448",
    lcd: { left: 41.8, top: 11.2, width: 46.2, height: 31.8 },
    btnMode: "touch",
    softkeys: { left: 44.0, top: 38.5, width: 42.0, height: 4.2 },
  },
  "yealink-t54w": {
    image: "/images/phones/yealink-t54w.jpg",
    aspect: "532 / 333",
    lcd: { left: 57.2, top: 12.2, width: 28.4, height: 24.8 },
    btnMode: "split",
    leftBtnX: 51.6,
    rightBtnX: 86.2,
    btnW: 4.8,
    btnH: 3.0,
    btnTop: 14.6,
    btnStep: 4.1,
    softkeys: { left: 58.2, top: 40.5, width: 26.4, height: 3.6 },
  },
  "yealink-t57w": {
    image: "/images/phones/yealink-t57w.jpg",
    aspect: "650 / 437",
    lcd: { left: 48.8, top: 6.8, width: 45.2, height: 41.0 },
    btnMode: "touch",
    softkeys: { left: 50.5, top: 43.0, width: 41.5, height: 4.5 },
  },

  // ======================= GRANDSTREAM (5 chassis -> 14 models) =======================
  "grandstream-grp2602": {
    image: "/images/phones/grandstream-grp2602.jpg",
    aspect: "347 / 353",
    lcd: { left: 60.5, top: 14.6, width: 23.8, height: 11.0 },
    btnMode: "left_only",
    leftBtnX: 54.6,
    btnW: 5.0,
    btnH: 2.9,
    btnTop: 15.6,
    btnStep: 3.6,
    softkeys: { left: 60.2, top: 27.8, width: 24.4, height: 3.2 },
  },
  "grandstream-grp2613": {
    image: "/images/phones/grandstream-grp2613.jpg",
    aspect: "500 / 411",
    lcd: { left: 53.6, top: 16.2, width: 29.8, height: 14.8 },
    btnMode: "split",
    leftBtnX: 47.4,
    rightBtnX: 84.4,
    btnW: 4.8,
    btnH: 3.0,
    btnTop: 17.8,
    btnStep: 4.1,
    softkeys: { left: 54.0, top: 33.4, width: 29.0, height: 3.2 },
  },
  "grandstream-grp2615": {
    image: "/images/phones/grandstream-grp2615.jpg",
    aspect: "474 / 398",
    lcd: { left: 51.5, top: 14.2, width: 31.2, height: 19.0 },
    btnMode: "split",
    leftBtnX: 45.4,
    rightBtnX: 83.6,
    btnW: 5.0,
    btnH: 2.7,
    btnTop: 15.2,
    btnStep: 3.5,
    softkeys: { left: 52.2, top: 35.8, width: 30.0, height: 3.2 },
  },
  "grandstream-grp2616": {
    image: "/images/phones/grandstream-grp2616.jpg",
    aspect: "920 / 863",
    lcd: { left: 50.4, top: 13.2, width: 31.8, height: 20.8 },
    btnMode: "split",
    leftBtnX: 45.0,
    rightBtnX: 83.2,
    btnW: 4.8,
    btnH: 2.7,
    btnTop: 14.5,
    btnStep: 3.6,
    softkeys: { left: 51.2, top: 36.2, width: 30.2, height: 3.0 },
  },
  "grandstream-gxp2170": {
    image: "/images/phones/grandstream-gxp2170.jpg",
    aspect: "500 / 395",
    lcd: { left: 54.2, top: 16.4, width: 31.2, height: 17.8 },
    btnMode: "split",
    leftBtnX: 48.2,
    rightBtnX: 86.2,
    btnW: 5.0,
    btnH: 2.3,
    btnTop: 17.0,
    btnStep: 2.8,
    softkeys: { left: 54.5, top: 36.8, width: 30.2, height: 3.0 },
  },

  // ======================= FANVIL (5 chassis -> 11 models) =======================
  "fanvil-x3u": {
    image: "/images/phones/fanvil-x3u.jpg",
    aspect: "314 / 366",
    lcd: { left: 61.8, top: 8.6, width: 26.2, height: 16.0 },
    btnMode: "right_only",
    rightBtnX: 89.2,
    btnW: 5.2,
    btnH: 3.2,
    btnTop: 10.6,
    btnStep: 4.3,
    softkeys: { left: 62.2, top: 27.6, width: 25.6, height: 3.0 },
  },
  "fanvil-x4u": {
    image: "/images/phones/fanvil-x4u.jpg",
    aspect: "621 / 650",
    lcd: { left: 52.8, top: 9.2, width: 24.4, height: 17.8 },
    btnMode: "split",
    leftBtnX: 47.4,
    rightBtnX: 78.2,
    btnW: 4.6,
    btnH: 3.1,
    btnTop: 11.6,
    btnStep: 4.5,
    softkeys: { left: 53.0, top: 29.4, width: 24.0, height: 3.0 },
  },
  "fanvil-x6u": {
    image: "/images/phones/fanvil-x6u.jpg",
    aspect: "333 / 321",
    lcd: { left: 55.6, top: 8.8, width: 29.4, height: 18.2 },
    btnMode: "split",
    leftBtnX: 50.0,
    rightBtnX: 85.8,
    btnW: 4.6,
    btnH: 2.7,
    btnTop: 10.6,
    btnStep: 3.3,
    softkeys: { left: 56.2, top: 29.8, width: 28.2, height: 3.0 },
  },
  "fanvil-x7": {
    image: "/images/phones/fanvil-x7.jpg",
    aspect: "500 / 407",
    lcd: { left: 44.2, top: 8.0, width: 49.0, height: 33.4 },
    btnMode: "touch",
    softkeys: { left: 46.5, top: 37.2, width: 44.5, height: 3.8 },
  },
  "fanvil-v64": {
    image: "/images/phones/fanvil-v64.jpg",
    aspect: "750 / 756",
    lcd: { left: 56.8, top: 11.4, width: 27.8, height: 16.6 },
    btnMode: "split",
    leftBtnX: 51.0,
    rightBtnX: 85.4,
    btnW: 5.0,
    btnH: 2.7,
    btnTop: 13.2,
    btnStep: 3.4,
    softkeys: { left: 57.2, top: 30.8, width: 27.2, height: 3.0 },
  },

  // ======================= CISCO (2 chassis -> 6 models) =======================
  "cisco-7841": {
    image: "/images/phones/cisco-7841.jpg",
    aspect: "634 / 650",
    lcd: { left: 52.0, top: 11.5, width: 34.4, height: 13.2 },
    btnMode: "split",
    leftBtnX: 45.2,
    rightBtnX: 88.8,
    btnW: 5.2,
    btnH: 2.6,
    btnTop: 14.5,
    btnStep: 4.0,
    softkeys: { left: 53.5, top: 27.2, width: 32.0, height: 3.2 },
  },
  "cisco-8851": {
    image: "/images/phones/cisco-8851.jpg",
    aspect: "650 / 594",
    lcd: { left: 50.6, top: 6.2, width: 36.2, height: 23.2 },
    btnMode: "split",
    leftBtnX: 44.2,
    rightBtnX: 89.0,
    btnW: 4.8,
    btnH: 2.6,
    btnTop: 9.8,
    btnStep: 3.6,
    softkeys: { left: 52.5, top: 32.4, width: 33.2, height: 3.2 },
  },
};

/**
 * Resolves any of the 56 catalog (brand, model) pairs to its exact calibrated photo chassis spec.
 */
export function resolvePhonePhotoSpec(brand = "Yealink", model = "T46U") {
  const b = String(brand || "").trim().toLowerCase();
  const m = String(model || "").trim().toLowerCase().replace(/\s+/g, "");

  if (b.includes("yealink")) {
    if (m.includes("t21") || m.includes("t23") || m.includes("t19")) return CHASSIS_SPECS["yealink-t23g"];
    if (m.includes("t27") || m.includes("t29")) return CHASSIS_SPECS["yealink-t29g"];
    if (m.includes("t30") || m.includes("t31")) return CHASSIS_SPECS["yealink-t31g"];
    if (m.includes("t33")) return CHASSIS_SPECS["yealink-t33g"];
    if (m.includes("t40") || m.includes("t41") || m.includes("t42")) return CHASSIS_SPECS["yealink-t42s"];
    if (m.includes("t43") || m.includes("t46")) return CHASSIS_SPECS["yealink-t46u"];
    if (m.includes("t48")) return CHASSIS_SPECS["yealink-t48u"];
    if (m.includes("t53") || m.includes("t54")) return CHASSIS_SPECS["yealink-t54w"];
    if (m.includes("t57") || m.includes("t58")) return CHASSIS_SPECS["yealink-t57w"];
    return CHASSIS_SPECS["yealink-t46u"];
  }

  if (b.includes("grandstream")) {
    if (m.includes("1628")) return CHASSIS_SPECS["grandstream-gxp2170"];
    if (m.includes("162") || m.includes("2601") || m.includes("2602") || m.includes("2603") || m.includes("2604")) {
      return CHASSIS_SPECS["grandstream-grp2602"];
    }
    if (m.includes("2612") || m.includes("2613")) return CHASSIS_SPECS["grandstream-grp2613"];
    if (m.includes("2615") || m.includes("2624")) return CHASSIS_SPECS["grandstream-grp2615"];
    if (m.includes("2614") || m.includes("2616") || m.includes("2634") || m.includes("2636")) {
      return CHASSIS_SPECS["grandstream-grp2616"];
    }
    if (m.includes("213") || m.includes("214") || m.includes("216") || m.includes("217")) {
      return CHASSIS_SPECS["grandstream-gxp2170"];
    }
    return CHASSIS_SPECS["grandstream-grp2615"];
  }

  if (b.includes("fanvil")) {
    if (m.includes("x3")) return CHASSIS_SPECS["fanvil-x3u"];
    if (m.includes("x4") || m.includes("x5")) return CHASSIS_SPECS["fanvil-x4u"];
    if (m.includes("x6") || m.includes("x210")) return CHASSIS_SPECS["fanvil-x6u"];
    if (m.includes("x7")) return CHASSIS_SPECS["fanvil-x7"];
    if (m.includes("v6")) return CHASSIS_SPECS["fanvil-v64"];
    return CHASSIS_SPECS["fanvil-v64"];
  }

  if (b.includes("cisco")) {
    if (m.includes("78")) return CHASSIS_SPECS["cisco-7841"];
    return CHASSIS_SPECS["cisco-8851"];
  }

  return null;
}
