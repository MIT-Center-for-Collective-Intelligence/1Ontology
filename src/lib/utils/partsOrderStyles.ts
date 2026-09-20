/**
 * Presentation for the parts order rails: colours, geometry and the `sx`
 * objects the viewers spread onto their rows. No data here — the rails
 * themselves are computed in partsHelper.
 */

/** Rail colour. A part that moved is left unmarked, so there is only one. */
const ORDER_RAIL_COLOR = { dark: "#52d68a", light: "#22a558" };

/** Dashed rule between two part rows. */
const partRowSeparator = (isDark: boolean) =>
  `1px dashed ${isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.16)"}`;

/** First rail column at 2px, each further one 9px in. */
export const ORDER_RUN_BRACKET_LEFT = 2;
const ORDER_RUN_BRACKET_STEP = 9;

const ORDER_RUN_ROW_INSET_PX = 26;
const ORDER_RUN_ROW_INSET = `${ORDER_RUN_ROW_INSET_PX}px`;
const ORDER_RUN_ROW_GAP = "5px";

/** Accent for a configured link on the descendant rail. */
export const DESCENDANT_RAIL_ACCENT = "#f2a43a";
/** Neutral backbone, drawn on every row. */
const DESCENDANT_BASE_RAIL = { dark: "#8b9199", light: "#9ca3af" };
/** One colour per mode, for a configured link. */
const ORDER_LINK_COLORS: {
  [mode: string]: { dark: string; light: string };
} = {
  alwaysInherit: { dark: "#52d68a", light: "#22a558" },
  neverInherit: { dark: "#ff6b6b", light: "#e04848" },
  inheritUnlessAlreadyOverRidden: { dark: "#f2a43a", light: "#d98a1f" },
};
export const orderLinkColor = (mode: string, isDark: boolean): string => {
  const pair =
    ORDER_LINK_COLORS[mode] ?? ORDER_LINK_COLORS.inheritUnlessAlreadyOverRidden;
  return isDark ? pair.dark : pair.light;
};
/** Reaches the dropdown's border on an edit row. */
const DESCENDANT_RAIL_DASH = 26;

export const descendantBaseRailSx = (
  edge: { isFirst: boolean; isLast: boolean },
  isDark: boolean,
) => {
  const color = `${isDark ? DESCENDANT_BASE_RAIL.dark : DESCENDANT_BASE_RAIL.light}8C`;
  const radius = "7px";
  return {
    position: "absolute",
    right: `${ORDER_RUN_BRACKET_LEFT}px`,
    top: edge.isFirst ? "50%" : 0,
    bottom: edge.isLast ? "50%" : 0,
    width: `${DESCENDANT_RAIL_DASH}px`,
    boxSizing: "border-box",
    borderRight: `2px solid ${color}`,
    ...(edge.isFirst && {
      borderTop: `2px solid ${color}`,
      borderTopRightRadius: radius,
    }),
    ...(edge.isLast && {
      borderBottom: `2px solid ${color}`,
      borderBottomRightRadius: radius,
    }),
    pointerEvents: "none",
    ...(!edge.isFirst &&
      !edge.isLast && {
        "&::after": {
          content: '""',
          position: "absolute",
          right: "-2px",
          top: "50%",
          width: `${DESCENDANT_RAIL_DASH}px`,
          borderTop: `2px solid ${color}`,
        },
      }),
  } as const;
};

/**
 * Half a link's rail: a link owns the lower half of its upper row and the
 * upper half of its lower row, so a row draws at most two halves.
 */
export const descendantRailHalfSx = (opts: {
  half: "upper" | "lower";
  /** Whether the row's other half is drawn, so the join stays straight. */
  otherVisible: boolean;
  color: string;
}) => {
  const { half, otherVisible, color } = opts;
  const dash = DESCENDANT_RAIL_DASH;
  const radius = "7px";
  const isUpper = half === "upper";
  return {
    position: "absolute",
    right: `${ORDER_RUN_BRACKET_LEFT}px`,
    ...(isUpper ? { top: 0, bottom: "50%" } : { top: "50%", bottom: 0 }),
    width: `${dash}px`,
    boxSizing: "border-box",
    borderRight: `2px solid ${color}`,
    // The dash is the upper half's bottom edge, or the lower half's top edge
    // when there is no upper. It curves unless the rail carries on.
    ...(isUpper
      ? {
          borderBottom: `2px solid ${color}`,
          ...(otherVisible ? {} : { borderBottomRightRadius: radius }),
        }
      : otherVisible
        ? {}
        : {
            borderTop: `2px solid ${color}`,
            borderTopRightRadius: radius,
          }),
    pointerEvents: "none",
  } as const;
};

export const orderRunRowSx = (isDark: boolean, isLastRow = false) =>
  ({
    position: "relative",
    pl: ORDER_RUN_ROW_INSET,
    py: ORDER_RUN_ROW_GAP,
    // Starts past the bracket so the two never cross.
    ...(isLastRow
      ? {}
      : {
          "&::after": {
            content: '""',
            position: "absolute",
            left: ORDER_RUN_ROW_INSET,
            right: 0,
            bottom: 0,
            pointerEvents: "none",
            borderBottom: partRowSeparator(isDark),
          },
        }),
  }) as const;

/** Hit zone over the bracket gutter. Mirrored, it is the right-hand gutter
 *  and takes no clicks. */
export const orderRunBracketWrapperSx = (mirrored = false) =>
  ({
    position: "absolute",
    ...(mirrored ? { right: 0, pointerEvents: "none" } : { left: 0 }),
    top: 0,
    bottom: 0,
    width: mirrored ? `${DESCENDANT_RAIL_DASH + 6}px` : "24px",
  }) as const;

/** One rail segment: runs title-to-title, with a dash into each member's
 *  title and a rounded corner at each end. */
export const orderRunBracketSx = (
  seg: {
    depth: number;
    isFirst: boolean;
    isLast: boolean;
    isMember: boolean;
  },
  isDark: boolean,
) => {
  const color = isDark ? ORDER_RAIL_COLOR.dark : ORDER_RAIL_COLOR.light;
  // Pass-through rows are dashed.
  const style = seg.isMember ? "solid" : "dashed";
  const left = ORDER_RUN_BRACKET_LEFT + seg.depth * ORDER_RUN_BRACKET_STEP;
  // Every dash stops at the same x, just short of the title.
  const dash = ORDER_RUN_ROW_INSET_PX - left - 6;
  const radius = "7px";
  return {
    position: "absolute",
    left: `${left}px`,
    // Level with the title, not the row edge.
    top: seg.isFirst ? "50%" : 0,
    bottom: seg.isLast ? "50%" : 0,
    width: `${dash}px`,
    boxSizing: "border-box",
    borderLeft: `2px ${style} ${color}`,
    // The ends curve out of the rail into their dash.
    ...(seg.isFirst && {
      borderTop: `2px ${style} ${color}`,
      borderTopLeftRadius: radius,
    }),
    ...(seg.isLast && {
      borderBottom: `2px ${style} ${color}`,
      borderBottomLeftRadius: radius,
    }),
    transition: "border-color 0.15s ease-in-out",
    pointerEvents: "none",
    // Middle rows get a straight dash.
    ...(seg.isMember &&
      !seg.isFirst &&
      !seg.isLast && {
        "&::after": {
          content: '""',
          position: "absolute",
          left: "-2px",
          top: "50%",
          width: `${dash}px`,
          borderTop: `2px ${style} ${color}`,
        },
      }),
  } as const;
};
