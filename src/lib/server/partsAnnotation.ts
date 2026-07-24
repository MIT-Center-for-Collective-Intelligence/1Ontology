import { admin } from "@components/lib/firestoreServer/admin";
import {
  ICollection,
  ILinkNode,
  INode,
  TransferInheritance,
} from "@components/types/INode";
import { PartsGraph, resolveParts, toPartsNode } from "./partsModel";

/**
 * The inheritedPartsDetails computation (ref model), shared by the
 * generate-inheritance-part-details endpoint, the parts write endpoints and
 * the backfill/repair script. Pure compute over prefetched nodes — callers
 * fetch the neighborhood (gens, chain, parts, gen-parts and their specs).
 */

/** Memoized resolved-parts accessor over a fetched node set (ref model). */
export const makeResolvedOf = (nodes: { [id: string]: INode }) => {
  const graph: PartsGraph = new Map(
    Object.values(nodes).map((n) => [n.id, toPartsNode(n)]),
  );
  const memo = new Map<string, ILinkNode[]>();
  return (id: string): ILinkNode[] => {
    if (!memo.has(id)) memo.set(id, resolveParts(id, graph));
    return memo.get(id)!;
  };
};

const getPartOptionalStatus = (
  partId: string,
  listOwnerId: string,
  resolvedOf: (id: string) => ILinkNode[],
): boolean => {
  return !!resolvedOf(listOwnerId).find((p) => p.id === partId)?.optional;
};

const analyzeInheritance = (
  inheritance: any,
  generalizationParts: string[],
  generalizationId: string,
  currentParts: string[],
  currentVisibleNode: INode,
  nodes: { [id: string]: INode },
  inheritanceForParts: any,
  resolvedOf: (id: string) => ILinkNode[],
) => {
  const result: {
    from: string;
    to: string;
    symbol: ">" | "x" | "=" | "+";
    fromOptional?: boolean;
    toOptional?: boolean;
    optionalChange?: "added" | "removed" | "none";
    hops?: number;
  }[] = [];

  const matchedParts = new Set<string>(); // Track generalization parts found in current node
  const usedKeys = new Set<string>(); // Track current node part IDs that have been matched to a generalization part
  const usedGeneralizationParts = new Set<string>(); // Track generalization parts that are unchanged (same ID)

  const findHierarchicalDistance = (
    fromPartId: string,
    toPartId: string,
    visited = new Set<string>(),
  ): number => {
    if (visited.has(fromPartId)) return -1;
    if (fromPartId === toPartId) return 0;

    visited.add(fromPartId);

    const fromNode = nodes[fromPartId];
    if (!fromNode) return -1;

    let minDistance = -1;

    for (const part of resolvedOf(fromPartId)) {
      if (part.id === toPartId) {
        return 1;
      }
    }
    for (let specializationNode of fromNode.specializations.flatMap(
      (c: ICollection) => c.nodes,
    )) {
      const deeperDistance = findHierarchicalDistance(
        specializationNode.id,
        toPartId,
        new Set(visited),
      );

      if (deeperDistance !== -1) {
        const totalDistance = 1 + deeperDistance;
        minDistance =
          minDistance === -1
            ? totalDistance
            : Math.min(minDistance, totalDistance);
      }
    }

    return minDistance;
  };

  for (const [key, entries] of Object.entries(inheritance)) {
    if (entries === null) continue;

    for (const entry of entries as any) {
      if (entry.genId !== generalizationId) {
        continue;
      }
      const part = entry.partOf;

      if (generalizationParts.includes(part)) {
        matchedParts.add(part);
        usedKeys.add(key);

        const fromOptional = getPartOptionalStatus(
          part,
          generalizationId,
          resolvedOf,
        );
        const toOptional = getPartOptionalStatus(
          key,
          currentVisibleNode.id,
          resolvedOf,
        );

        let optionalChange: "added" | "removed" | "none" = "none";
        if (fromOptional !== toOptional) {
          optionalChange = toOptional ? "added" : "removed";
        }

        if (key === part) {
          result.push({
            from: part,
            to: key,
            symbol: "=",
            fromOptional,
            toOptional,
            optionalChange,
            hops: 0,
          });
          usedGeneralizationParts.add(part);
        } else {
          const hops = findHierarchicalDistance(part, key);
          result.push({
            from: part,
            to: key,
            symbol: ">",
            fromOptional,
            toOptional,
            optionalChange,
            hops,
          });
        }
      } else {
      }
    }
  }

  for (const generalizationPart of generalizationParts) {
    if (!matchedParts.has(generalizationPart)) {
      for (const currentPart of currentParts) {
        const hops = findHierarchicalDistance(generalizationPart, currentPart);
        if (hops !== -1) {
          const fromOptional = getPartOptionalStatus(
            generalizationPart,
            generalizationId,
            resolvedOf,
          );
          const toOptional = getPartOptionalStatus(
            currentPart,
            currentVisibleNode.id,
            resolvedOf,
          );

          let optionalChange: "added" | "removed" | "none" = "none";
          if (fromOptional !== toOptional) {
            optionalChange = toOptional ? "added" : "removed";
          }

          result.push({
            from: generalizationPart,
            to: currentPart,
            symbol: ">",
            fromOptional,
            toOptional,
            optionalChange,
            hops,
          });
          matchedParts.add(generalizationPart);
          break;
        }
      }
      if (!matchedParts.has(generalizationPart)) {
      }
    }
  }

  const groupedByGeneralization = result.reduce(
    (acc, entry) => {
      if (entry.symbol === ">") {
        if (!acc[entry.from]) acc[entry.from] = [];
        acc[entry.from].push(entry);
      }

      return acc;
    },
    {} as Record<string, typeof result>,
  );

  const currentPartsOrder = currentParts;

  const hasSeenTo = new Set();
  const filteredSpecializations: TransferInheritance[] = Object.entries(
    groupedByGeneralization,
  ).reduce((acc, [from, entries]) => {
    const picked =
      entries.length === 1
        ? entries[0]
        : entries.reduce((a, b) => {
            const aHops = a.hops ?? -1;
            const bHops = b.hops ?? -1;
            if (
              inheritanceForParts[from] &&
              inheritanceForParts[from] === b.to
            ) {
              return b;
            }
            if (aHops === -1 && bHops === -1) {
              return currentPartsOrder.indexOf(a.to) <=
                currentPartsOrder.indexOf(b.to)
                ? a
                : b;
            }
            if (aHops === -1) return b;
            if (bHops === -1) return a;

            if (aHops !== bHops) return aHops < bHops ? a : b;

            return currentPartsOrder.indexOf(a.to) <=
              currentPartsOrder.indexOf(b.to)
              ? a
              : b;
          });

    if (!hasSeenTo.has(picked.to)) {
      hasSeenTo.add(picked.to);
      acc.push(picked);
    }

    return acc;
  }, [] as any);

  const nonPickedOnes: any = {};

  for (let key in groupedByGeneralization) {
    const exist = filteredSpecializations.findIndex((c) => c.from === key);
    if (exist === -1) {
      filteredSpecializations.push({
        from: key,
        to: "",
        symbol: "x",
        fromOptional: false,
        toOptional: false,
        optionalChange: "none",
        hops: 0,
      });
    }
    nonPickedOnes[key] = new Array(
      ...new Set(
        groupedByGeneralization[key]
          .filter((c) => {
            const index = filteredSpecializations.findIndex(
              (l) => l.to === c.to && l.from === c.from,
            );
            return index === -1;
          })
          .map((c) => c.to),
      ),
    );
  }

  const directMatches = result.filter((entry) => entry.symbol === "=");
  const finalSpecializations = filteredSpecializations.filter(
    (entry) => !usedGeneralizationParts.has(entry.from),
  );

  const finalResult = [...directMatches, ...finalSpecializations];

  for (const part of generalizationParts) {
    if (!matchedParts.has(part) && !usedGeneralizationParts.has(part)) {
      finalResult.push({
        from: part,
        to: "",
        symbol: "x",
        fromOptional: getPartOptionalStatus(part, generalizationId, resolvedOf),
        toOptional: false,
        optionalChange: "none",
        hops: -1,
      });
    }
  }

  for (const [key, value] of Object.entries(inheritance)) {
    const existIdx = finalResult.findIndex((c) => c.to === key);
    if (existIdx === -1) {
      finalResult.push({
        from: "",
        to: key,
        symbol: "+",
        fromOptional: false,
        toOptional: getPartOptionalStatus(
          key,
          currentVisibleNode.id,
          resolvedOf,
        ),
        optionalChange: "none",
        hops: 0,
      });
    }
  }

  for (const currentPart of currentParts) {
    const existIdx = finalResult.findIndex((c) => c.to === currentPart);
    if (existIdx === -1) {
      if (!generalizationParts.includes(currentPart)) {
        finalResult.push({
          from: "",
          to: currentPart,
          symbol: "+",
          fromOptional: false,
          toOptional: getPartOptionalStatus(
            currentPart,
            currentVisibleNode.id,
            resolvedOf,
          ),
          optionalChange: "none",
          hops: 0,
        });
      }
    }
  }

  const seen = new Set();
  const uniqueResult = finalResult.filter((entry) => {
    const key = `${entry.from}|${entry.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  uniqueResult.sort((a, b) => {
    const indexA = currentPartsOrder.indexOf(a.to);
    const indexB = currentPartsOrder.indexOf(b.to);

    return (
      (indexA === -1 ? Infinity : indexA) - (indexB === -1 ? Infinity : indexB)
    );
  });

  return { details: uniqueResult, nonPickedOnes };
};

const checkGeneralizations = (
  partId: string,
  currentVisibleNode: INode,
  relatedNodes: { [id: string]: INode },
  eachNodePath: { [id: string]: any[] },
  resolvedOf: (id: string) => ILinkNode[],
): { genId: string; partOf: string | null }[] | null => {
  let inheritanceDetails: { genId: string; partOf: string | null }[] = [];

  const generalizations = (currentVisibleNode?.generalizations || []).flatMap(
    (c) => c.nodes,
  );

  for (let generalization of generalizations) {
    if (!relatedNodes[generalization.id]) {
      continue;
    }
    const generalizationParts = resolvedOf(generalization.id);

    if (generalizationParts.length === 0) {
      continue;
    }

    const partIdex = generalizationParts.findIndex((c) => c.id === partId);

    let partOfIdx: any = -1;

    if (partIdex === -1) {
      for (let { id } of generalizationParts) {
        const specializationPart = (
          relatedNodes[id]?.specializations || []
        ).flatMap((c) => c.nodes);
        partOfIdx = specializationPart.findIndex((c) => c.id === partId);
        if (partOfIdx !== -1) {
          inheritanceDetails.push({
            genId: generalization.id,
            partOf: id,
          });
        }
      }
    }
    if (partIdex === -1) {
      const ontologyPathForPart = eachNodePath[partId] ?? [];

      const exacts = generalizationParts.filter((n) => {
        const findIndex = ontologyPathForPart.findIndex((d) => d.id === n.id);
        return findIndex !== -1;
      });
      if (exacts.length > 0) {
        inheritanceDetails.push({
          genId: generalization.id,
          partOf: exacts[0].id,
        });
      }
    }

    if (partIdex !== -1) {
      inheritanceDetails.push({
        genId: generalization.id,
        partOf: generalizationParts[partIdex].id,
      });
    }
  }
  if (inheritanceDetails.length > 0) {
    return inheritanceDetails;
  }
  return null;
};

function buildNodePaths(nodes: { [id: string]: INode }): {
  [id: string]: any[];
} {
  const pathsMap: { [id: string]: any[] } = {};

  function buildPath(nodeId: string, currentPath: any[] = []): any[] {
    if (pathsMap[nodeId]) return pathsMap[nodeId];

    const node = nodes[nodeId];
    if (!node) return currentPath;

    const generalizations = node.generalizations?.flatMap((c) => c.nodes) || [];

    for (const gen of generalizations) {
      const genNode = nodes[gen.id];
      if (genNode) {
        const genPath = buildPath(gen.id, [
          ...currentPath,
          { id: gen.id, title: genNode.title },
        ]);
        if (!pathsMap[nodeId] || genPath.length > pathsMap[nodeId].length) {
          pathsMap[nodeId] = genPath;
        }
      }
    }

    if (!pathsMap[nodeId]) {
      pathsMap[nodeId] = currentPath;
    }

    return pathsMap[nodeId];
  }

  for (const nodeId in nodes) {
    buildPath(nodeId);
  }

  return pathsMap;
}

/**
 * Compute a node's full inheritedPartsDetails (one entry per generalization,
 * titles grafted, userOverride picks preserved from the node's existing
 * details). `relatedNodes` must hold the neighborhood listed at the top.
 */
export function computeInheritedPartsDetails(params: {
  currentNode: INode;
  relatedNodes: { [id: string]: INode };
  resolvedOf: (id: string) => ILinkNode[];
}): any[] {
  const { currentNode, relatedNodes, resolvedOf } = params;

  const partIds = resolvedOf(currentNode.id).map((p) => p.id);
  const generalizations =
    currentNode.generalizations?.flatMap((c) => c.nodes) || [];

  const eachNodePath = buildNodePaths(relatedNodes);

  const inheritanceForParts: any = {};
  for (const partId of partIds) {
    if (relatedNodes[partId]) {
      inheritanceForParts[partId] = checkGeneralizations(
        partId,
        currentNode,
        relatedNodes,
        eachNodePath,
        resolvedOf,
      );
    }
  }

  // Read existing inheritedPartsDetails to preserve userOverride entries
  const existingDetails = currentNode.inheritedPartsDetails || [];

  const calculations: any[] = [];

  for (const gen of generalizations) {
    const genNode = relatedNodes[gen.id];
    if (!genNode) continue;

    const generalizationParts = resolvedOf(gen.id).map((p) => p.id);
    const currentParts = partIds;

    const analysisResult = analyzeInheritance(
      inheritanceForParts,
      generalizationParts,
      gen.id,
      currentParts,
      currentNode,
      relatedNodes,
      inheritanceForParts,
      resolvedOf,
    );

    const detailsWithTitles = analysisResult.details.map((detail: any) => ({
      ...detail,
      fromTitle: detail.from ? relatedNodes[detail.from]?.title || "" : "",
      toTitle: detail.to ? relatedNodes[detail.to]?.title || "" : "",
    }));

    // Preserve userOverride entries from existing data
    const existingGen = existingDetails.find(
      (d: any) => d.generalizationId === gen.id,
    );
    if (existingGen) {
      const overriddenEntries = (existingGen.details || []).filter(
        (d: any) => d.userOverride,
      );
      for (const override of overriddenEntries) {
        // Both endpoints of the override must still exist on the node.
        const fromStillExists = generalizationParts.includes(override.from);
        const toStillExists = currentParts.includes(override.to);
        if (!fromStillExists || !toStillExists) continue;

        // Point the generalization-part's row at the user's pick.
        const computedIdx = detailsWithTitles.findIndex(
          (d: any) => d.from === override.from,
        );
        if (computedIdx === -1) continue;

        const displacedTo = detailsWithTitles[computedIdx].to;
        detailsWithTitles[computedIdx] = {
          ...detailsWithTitles[computedIdx],
          to: override.to,
          toTitle: relatedNodes[override.to]?.title || override.toTitle || "",
          userOverride: true,
          symbol: override.from === override.to ? "=" : ">",
        };

        // Drop the row the picked part already had, so it isn't listed twice.
        for (let i = detailsWithTitles.length - 1; i >= 0; i--) {
          if (i !== computedIdx && detailsWithTitles[i].to === override.to) {
            detailsWithTitles.splice(i, 1);
          }
        }

        // Give the displaced part a "+" row so it doesn't lose its row.
        if (
          displacedTo &&
          displacedTo !== override.to &&
          !detailsWithTitles.some((d: any) => d.to === displacedTo)
        ) {
          detailsWithTitles.push({
            from: "",
            to: displacedTo,
            symbol: "+",
            fromTitle: "",
            toTitle: relatedNodes[displacedTo]?.title || "",
            fromOptional: false,
            toOptional: getPartOptionalStatus(
              displacedTo,
              currentNode.id,
              resolvedOf,
            ),
            optionalChange: "none",
            hops: 0,
          });
        }
      }

      // Re-sort into parts order after the override reshuffle.
      if (overriddenEntries.length > 0) {
        detailsWithTitles.sort((a: any, b: any) => {
          const ia = currentParts.indexOf(a.to);
          const ib = currentParts.indexOf(b.to);
          return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
        });
      }
    }

    const nonPickedWithTitles: any = {};
    for (const [fromId, toIds] of Object.entries(
      analysisResult.nonPickedOnes,
    )) {
      nonPickedWithTitles[fromId] = (toIds as string[]).map((toId: string) => ({
        id: toId,
        title: relatedNodes[toId]?.title || "",
      }));
    }

    // Update nonPickedOnes to reflect userOverride swaps
    if (existingGen) {
      const overriddenEntries = (existingGen.details || []).filter(
        (d: any) => d.userOverride,
      );
      for (const override of overriddenEntries) {
        const fromStillExists = generalizationParts.includes(override.from);
        const toStillExists = currentParts.includes(override.to);
        if (!fromStillExists || !toStillExists) continue;

        // Find what the algorithm originally picked for this "from"
        const originalEntry = analysisResult.details.find(
          (d: any) => d.from === override.from,
        );
        if (originalEntry && originalEntry.to !== override.to) {
          // The algorithm's pick should go back to nonPickedOnes
          if (!nonPickedWithTitles[override.from]) {
            nonPickedWithTitles[override.from] = [];
          }
          const alreadyInNonPicked = nonPickedWithTitles[override.from].some(
            (item: any) => item.id === originalEntry.to,
          );
          if (!alreadyInNonPicked && originalEntry.to) {
            nonPickedWithTitles[override.from].push({
              id: originalEntry.to,
              title: relatedNodes[originalEntry.to]?.title || "",
            });
          }
          // Remove the user's pick from nonPickedOnes
          nonPickedWithTitles[override.from] = nonPickedWithTitles[
            override.from
          ].filter((item: any) => item.id !== override.to);
        }
      }
    }

    calculations.push({
      generalizationId: gen.id,
      generalizationTitle: genNode.title,
      createdAt: admin.firestore.Timestamp.now(),
      details: detailsWithTitles,
      nonPickedOnes: nonPickedWithTitles,
    });
  }

  return calculations;
}
