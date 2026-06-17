// Counts unsaved writes per node and field. Ontology checks this so a stale
// snapshot can't overwrite a field that was just edited but isn't saved yet.
// A count, not a flag, so two overlapping edits both finish before it clears.
//
// `field` is the path that changed, e.g. "properties.parts" or "specializations".
const counts = new Map<string, number>();

const keyOf = (nodeId: string, field: string) => `${nodeId}::${field}`;

export const pendingWrites = {
  start(nodeId: string, field: string) {
    if (!nodeId || !field) return;
    const k = keyOf(nodeId, field);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  },
  end(nodeId: string, field: string) {
    if (!nodeId || !field) return;
    const k = keyOf(nodeId, field);
    const next = (counts.get(k) ?? 0) - 1;
    if (next <= 0) counts.delete(k);
    else counts.set(k, next);
  },
  // Fields with a write still in flight for this node.
  fields(nodeId: string): string[] {
    if (!nodeId) return [];
    const prefix = `${nodeId}::`;
    const result: string[] = [];
    for (const k of counts.keys()) {
      if (k.startsWith(prefix)) result.push(k.slice(prefix.length));
    }
    return result;
  },
};
