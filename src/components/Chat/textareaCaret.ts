/** Viewport caret box for a textarea position (proportional font approximation). */
export function getTextareaCaretClientRect(
  ta: HTMLTextAreaElement,
  position: number,
): DOMRect {
  const rect = ta.getBoundingClientRect();
  const cs = getComputedStyle(ta);
  const lineHeight = parseFloat(cs.lineHeight) || 22;
  const padL = parseFloat(cs.paddingLeft) || 0;
  const padT = parseFloat(cs.paddingTop) || 0;
  const before = ta.value.slice(0, position);
  const lines = before.split("\n");
  const row = lines.length - 1;
  const colLine = lines[row] ?? "";

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  let w = 0;
  if (ctx) {
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${parseFloat(cs.fontSize)}px ${cs.fontFamily}`;
    w = ctx.measureText(colLine).width;
  } else {
    w = colLine.length * (parseFloat(cs.fontSize) || 15) * 0.52;
  }

  const left = rect.left + padL + w - ta.scrollLeft;
  const top = rect.top + padT + row * lineHeight - ta.scrollTop;
  return DOMRect.fromRect({
    x: left,
    y: top,
    width: 0,
    height: lineHeight,
  });
}
