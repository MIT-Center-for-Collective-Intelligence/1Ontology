import {
  REVIEW_ACCENT_COLORS,
  REVIEW_ICON_COLORS,
  REVIEW_PRIMARY_ACTION_HOVER,
  REVIEW_PRIMARY_ACTION_TEXT,
} from "../../../src/components/SomReview/reviewStyles";

const channel = (value: string): number => {
  const normalized = Number.parseInt(value, 16) / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string): number => {
  const value = hex.replace("#", "");
  const red = channel(value.slice(0, 2));
  const green = channel(value.slice(2, 4));
  const blue = channel(value.slice(4, 6));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

const contrast = (foreground: string, background: string): number => {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
};

describe("Society of Mind review colors", () => {
  it("keeps primary action text readable in normal and hover states", () => {
    expect(
      contrast(REVIEW_PRIMARY_ACTION_TEXT, "#ff8a33"),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(REVIEW_PRIMARY_ACTION_TEXT, REVIEW_PRIMARY_ACTION_HOVER),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps review accents readable in light and dark modes", () => {
    expect(
      contrast(REVIEW_ACCENT_COLORS.light, "#f8f8f8"),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(REVIEW_ACCENT_COLORS.dark, "#28282a"),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps brighter issue icons distinguishable from their surfaces", () => {
    expect(
      contrast(REVIEW_ICON_COLORS.light, "#f5f5f5"),
    ).toBeGreaterThanOrEqual(3);
    expect(
      contrast(REVIEW_ICON_COLORS.dark, "#333335"),
    ).toBeGreaterThanOrEqual(3);
  });
});
