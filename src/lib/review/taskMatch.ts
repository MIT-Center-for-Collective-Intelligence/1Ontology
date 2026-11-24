/**
 * Lines a family's flows up by task. A column is a task that at least half
 * of the flows do in its own right; a step whose activity is a specialization
 * of a column's task counts for that column and keeps its own title. The same
 * keys feed the derived parent flow, so the grid and the parent agree.
 */
export type TaskColumn = { key: string; n: number; at: number };

export type TaskColumns = {
  columns: TaskColumn[];
  total: number;
  /** The column a task counts for, or null when it has none. */
  keyOf: (id: string) => string | null;
};

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function taskColumns(
  flows: string[][],
  ancestorsOf: (id: string) => string[] = () => [],
): TaskColumns {
  const total = flows.length;
  const exact = new Map<string, number>();
  for (const flow of flows)
    for (const id of new Set(flow)) exact.set(id, (exact.get(id) || 0) + 1);
  const cols = new Set(
    [...exact].filter(([, n]) => total > 0 && n * 2 >= total).map(([id]) => id),
  );
  const keyOf = (id: string) =>
    cols.has(id) ? id : (ancestorsOf(id).find((a) => cols.has(a)) ?? null);

  const n = new Map<string, number>();
  const pos = new Map<string, number[]>();
  for (const flow of flows) {
    const done = new Set<string>();
    flow.forEach((id, i) => {
      const key = keyOf(id);
      if (!key || done.has(key)) return;
      done.add(key);
      n.set(key, (n.get(key) || 0) + 1);
      pos.set(key, [
        ...(pos.get(key) || []),
        flow.length > 1 ? i / (flow.length - 1) : 0,
      ]);
    });
  }
  const columns = [...cols]
    .map((key) => ({ key, n: n.get(key) || 0, at: mean(pos.get(key) || [0]) }))
    .sort((a, b) => a.at - b.at || b.n - a.n);
  return { columns, total, keyOf };
}
