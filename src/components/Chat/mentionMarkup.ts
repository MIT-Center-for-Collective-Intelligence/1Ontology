/** Match stored chat mentions: [@display](userId) */
const MENTION_RE = /\[@([^\]]+)\]\(([^)]+)\)/g;

type Piece =
  | {
      kind: "text";
      markupStart: number;
      markupEnd: number;
      plainStart: number;
      plainEnd: number;
    }
  | {
      kind: "mention";
      markupStart: number;
      markupEnd: number;
      plainStart: number;
      plainEnd: number;
      display: string;
      id: string;
    };

function parsePieces(markup: string): Piece[] {
  const pieces: Piece[] = [];
  let lastM = 0;
  let plainAcc = 0;
  const re = new RegExp(MENTION_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(markup)) !== null) {
    if (m.index > lastM) {
      const t = markup.slice(lastM, m.index);
      pieces.push({
        kind: "text",
        markupStart: lastM,
        markupEnd: m.index,
        plainStart: plainAcc,
        plainEnd: plainAcc + t.length,
      });
      plainAcc += t.length;
    }
    const full = m[0];
    const display = m[1];
    const id = m[2];
    const plen = `@${display}`.length;
    pieces.push({
      kind: "mention",
      markupStart: m.index,
      markupEnd: m.index + full.length,
      plainStart: plainAcc,
      plainEnd: plainAcc + plen,
      display,
      id,
    });
    plainAcc += plen;
    lastM = m.index + full.length;
  }
  if (lastM < markup.length) {
    const t = markup.slice(lastM);
    pieces.push({
      kind: "text",
      markupStart: lastM,
      markupEnd: markup.length,
      plainStart: plainAcc,
      plainEnd: plainAcc + t.length,
    });
  }
  return pieces;
}

export function markupToPlain(markup: string): string {
  return markup.replace(/\[@([^\]]+)\]\(([^)]+)\)/g, "@$1");
}

function expandPlainRange(
  markup: string,
  plainStart: number,
  plainEnd: number,
): [number, number] {
  let a = plainStart;
  let b = plainEnd;
  for (const pc of parsePieces(markup)) {
    if (pc.kind !== "mention") continue;
    if (plainStart < pc.plainEnd && plainEnd > pc.plainStart) {
      a = Math.min(a, pc.plainStart);
      b = Math.max(b, pc.plainEnd);
    }
  }
  return [a, b];
}

function plainRangeToMarkupRange(
  markup: string,
  plainStart: number,
  plainEnd: number,
): { start: number; end: number } | null {
  const pieces = parsePieces(markup);
  let ms = Infinity;
  let me = 0;
  let found = false;
  for (const pc of pieces) {
    if (plainStart < pc.plainEnd && plainEnd > pc.plainStart) {
      found = true;
      ms = Math.min(ms, pc.markupStart);
      me = Math.max(me, pc.markupEnd);
    }
  }
  if (!found) return null;
  return { start: ms, end: me };
}

/** Apply a plain-text edit from the textarea back into markup. */
export function applyPlainTextEdit(
  markup: string,
  prevPlain: string,
  newPlain: string,
): string {
  if (prevPlain === newPlain) return markup;
  let a = 0;
  while (
    a < prevPlain.length &&
    a < newPlain.length &&
    prevPlain[a] === newPlain[a]
  ) {
    a++;
  }
  let b = 0;
  while (
    b < prevPlain.length - a &&
    b < newPlain.length - a &&
    prevPlain[prevPlain.length - 1 - b] === newPlain[newPlain.length - 1 - b]
  ) {
    b++;
  }
  let eStart = a;
  let eEnd = prevPlain.length - b;
  [eStart, eEnd] = expandPlainRange(markup, eStart, eEnd);
  const m = plainRangeToMarkupRange(markup, eStart, eEnd);
  if (!m) return markup;
  const newMid = newPlain.slice(eStart, newPlain.length - b);
  return markup.slice(0, m.start) + newMid + markup.slice(m.end);
}

export function getActiveMentionQuery(
  plain: string,
  caret: number,
): { query: string; atPlainIndex: number } | null {
  const before = plain.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at === -1) return null;
  if (at > 0 && !/\s/.test(before[at - 1]!)) return null;
  const after = before.slice(at + 1);
  if (/\s/.test(after)) return null;
  return { query: after, atPlainIndex: at };
}

/** Replace @query in plain (from atPlainIndex..caret) with [@display](id) plus trailing space in markup. */
export function insertMentionMarkup(
  markup: string,
  plain: string,
  atPlainIndex: number,
  caretPlain: number,
  display: string,
  id: string,
): string {
  const mentionMarkup = `[@${display}](${id}) `;
  let eStart = atPlainIndex;
  let eEnd = caretPlain;
  [eStart, eEnd] = expandPlainRange(markup, eStart, eEnd);
  const m = plainRangeToMarkupRange(markup, eStart, eEnd);
  if (!m) return markup;
  return markup.slice(0, m.start) + mentionMarkup + markup.slice(m.end);
}

/** Plain-text caret index after inserting mention + space. */
export function caretAfterMentionInsert(
  atPlainIndex: number,
  display: string,
): number {
  return atPlainIndex + `@${display} `.length;
}
