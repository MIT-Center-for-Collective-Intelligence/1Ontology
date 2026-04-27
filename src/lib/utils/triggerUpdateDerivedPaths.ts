import { Post } from "./Post";

/**
 * After generalizations / specializations link changes, recomputes parentIds, primaryParentId,
 * and pathIds on the server for the affected subgraph. Fire-and-forget; logs errors only.
 */
export async function triggerUpdateDerivedPaths(changedNodeIds: string[]) {
  const ids = [...new Set(changedNodeIds.filter(Boolean))];
  if (ids.length === 0) return;
  try {
    await Post("/nodes/update-derived-paths", { changedNodeIds: ids });
  } catch (e) {
    console.error("[triggerUpdateDerivedPaths]", e);
  }
}
