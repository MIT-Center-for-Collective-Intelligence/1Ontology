export type CompassAxis = "left" | "right" | "top" | "bottom";

export type CompassSatellite = {
  id: string;
  axis: CompassAxis;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type CompassCenter = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type CompassEdge = {
  axis: CompassAxis;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  horiz: boolean;
};

export type CompassOverflow = {
  axis: CompassAxis;
  total: number;
  shown: number;
};

export type CompassLayout = {
  center: CompassCenter;
  satellites: CompassSatellite[];
  edges: CompassEdge[];
  overflow: CompassOverflow[];
  effectiveL1X: number;
  effectiveL1Y: number;
};

export type CompassInput = {
  centerId: string;
  leftIds: string[];
  rightIds: string[];
  topIds: string[];
  bottomIds: string[];
};

export const COMPASS = {
  CW: 230,
  CH: 76,
  N1W: 190,
  N1H: 42,
  L1X: 270,
  L1Y: 150,
  MAX_LR: 10,
  MAX_TB: 6,
  GAP: 14,
  LABEL_PAD: 26,
} as const;

const colHalfH = (n: number) =>
  n > 0 ? (n * (COMPASS.N1H + 10) + (n - 1) * COMPASS.GAP) / 2 : 0;

const rowHalfW = (n: number) =>
  n > 0 ? (n * (COMPASS.N1W + 10) - 10) / 2 : 0;

export function computeCompassLayout(input: CompassInput): CompassLayout {
  const shownLeft = input.leftIds.slice(0, COMPASS.MAX_LR);
  const shownRight = input.rightIds.slice(0, COMPASS.MAX_LR);
  const shownTop = input.topIds.slice(0, COMPASS.MAX_TB);
  const shownBottom = input.bottomIds.slice(0, COMPASS.MAX_TB);

  const overflow: CompassOverflow[] = [];
  const recordOverflow = (
    axis: CompassAxis,
    ids: string[],
    shown: string[],
  ) => {
    if (ids.length > shown.length) {
      overflow.push({ axis, total: ids.length, shown: shown.length });
    }
  };
  recordOverflow("left", input.leftIds, shownLeft);
  recordOverflow("right", input.rightIds, shownRight);
  recordOverflow("top", input.topIds, shownTop);
  recordOverflow("bottom", input.bottomIds, shownBottom);

  // Two non-overlap constraints (axis-aligned rectangles, all centered on
  // their stated coords with width/height N1W × N1H):
  //
  // 1. T/B rows must clear the vertical extent of L/R columns. Otherwise a
  //    tall L/R column will pass through the y-band where T/B rows sit.
  // 2. L/R columns must clear the horizontal extent of T/B rows for the
  //    same symmetric reason.
  //
  // We expand L1Y / L1X just enough to satisfy each.
  const lrHalfH = Math.max(
    colHalfH(shownLeft.length),
    colHalfH(shownRight.length),
  );
  const tbHalfW = Math.max(
    rowHalfW(shownTop.length),
    rowHalfW(shownBottom.length),
  );

  const requiredL1Y = lrHalfH + COMPASS.N1H / 2 + COMPASS.GAP;
  const requiredL1X = tbHalfW + COMPASS.N1W / 2 + COMPASS.GAP;

  const effectiveL1Y = Math.max(COMPASS.L1Y, requiredL1Y);
  const effectiveL1X = Math.max(COMPASS.L1X, requiredL1X);

  const center: CompassCenter = {
    id: input.centerId,
    x: 0,
    y: 0,
    w: COMPASS.CW,
    h: COMPASS.CH,
  };
  const satellites: CompassSatellite[] = [];
  const edges: CompassEdge[] = [];

  const layoutLR = (shown: string[], axis: "left" | "right") => {
    if (!shown.length) return;
    const sign = axis === "left" ? -1 : 1;
    const rowH = COMPASS.N1H + 10;
    const totalH = shown.length * rowH + (shown.length - 1) * COMPASS.GAP;
    let y = -totalH / 2;
    for (const id of shown) {
      const cy = y + rowH / 2;
      satellites.push({
        id,
        axis,
        x: sign * effectiveL1X,
        y: cy,
        w: COMPASS.N1W,
        h: COMPASS.N1H,
      });
      edges.push({
        axis,
        x1: (sign * COMPASS.CW) / 2,
        y1: 0,
        x2: sign * (effectiveL1X - COMPASS.N1W / 2),
        y2: cy,
        horiz: true,
      });
      y += rowH + COMPASS.GAP;
    }
  };

  const layoutTB = (shown: string[], axis: "top" | "bottom") => {
    if (!shown.length) return;
    const sign = axis === "top" ? -1 : 1;
    const totalW = shown.length * (COMPASS.N1W + 10) - 10;
    shown.forEach((id, i) => {
      const cx = -totalW / 2 + i * (COMPASS.N1W + 10) + COMPASS.N1W / 2;
      satellites.push({
        id,
        axis,
        x: cx,
        y: sign * effectiveL1Y,
        w: COMPASS.N1W,
        h: COMPASS.N1H,
      });
      edges.push({
        axis,
        x1: 0,
        y1: (sign * COMPASS.CH) / 2,
        x2: cx,
        y2: sign * (effectiveL1Y - COMPASS.N1H / 2),
        horiz: false,
      });
    });
  };

  layoutLR(shownLeft, "left");
  layoutLR(shownRight, "right");
  layoutTB(shownTop, "top");
  layoutTB(shownBottom, "bottom");

  return {
    center,
    satellites,
    edges,
    overflow,
    effectiveL1X,
    effectiveL1Y,
  };
}
