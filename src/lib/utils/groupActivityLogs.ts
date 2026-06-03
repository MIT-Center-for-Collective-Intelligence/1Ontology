import { NodeChange } from "@components/types/INode";

type LogWithId = NodeChange & { id: string };

export type GroupedActivityLogs<T> = {
  items: T[];
  childrenByParent: Map<string, T[]>;
};


export const groupActivityLogs = <T extends LogWithId>(
  logs: T[],
): GroupedActivityLogs<T> => {
  const byId = new Map<string, T>();
  for (const log of logs) byId.set(log.id, log);

  const childrenByParent = new Map<string, T[]>();
  const items: T[] = [];

  for (const log of logs) {
    const parentId = log.triggeredBy?.logId;
    if (parentId && byId.has(parentId)) {
      const arr = childrenByParent.get(parentId);
      if (arr) arr.push(log);
      else childrenByParent.set(parentId, [log]);
    } else {
      // True root, or orphaned child whose parent isn't in `logs`
      items.push(log);
    }
  }

  // Children oldest-first inside their group
  const toMs = (t: any): number => {
    if (!t) return 0;
    if (typeof t.toMillis === "function") return t.toMillis();
    if (typeof t.getTime === "function") return t.getTime();
    return 0;
  };
  for (const arr of childrenByParent.values()) {
    arr.sort((a, b) => toMs(a.modifiedAt) - toMs(b.modifiedAt));
  }

  return { items, childrenByParent };
};
