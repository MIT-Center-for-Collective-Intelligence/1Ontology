import { NextApiRequest, NextApiResponse } from "next";
import { db, admin } from "@components/lib/firestoreServer/admin";
import { NODES } from "@components/lib/firestoreClient/collections";
import fbAuth from "@components/middlewares/fbAuth";
import {
  ILinkNode,
  INode,
  ICollection,
  TransferInheritance,
} from "@components/types/INode";
import {
  PartsGraph,
  resolveParts,
  toPartsNode,
} from "@components/lib/server/partsModel";

/** Memoized resolved-parts accessor over the fetched node set (ref model). */
const makeResolvedOf = (nodes: { [id: string]: INode }) => {
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

  uniqueResult.forEach((entry) => {
    const fromTitle = entry.from ? nodes[entry.from]?.title : "(none)";
    const toTitle = entry.to ? nodes[entry.to]?.title : "(none)";
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

async function fetchNodes(nodeIds: string[]): Promise<{ [id: string]: INode }> {
  if (nodeIds.length === 0) return {};

  const nodesMap: { [id: string]: INode } = {};
  const uniqueIds = [...new Set(nodeIds)];

  // One BatchGet RPC per chunk instead of one RPC per document.
  const CHUNK = 300;
  const chunks: string[][] = [];
  for (let i = 0; i < uniqueIds.length; i += CHUNK) {
    chunks.push(uniqueIds.slice(i, i + CHUNK));
  }
  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const snaps = await db.getAll(
          ...chunk.map((id) => db.collection(NODES).doc(id)),
        );
        for (const snap of snaps) {
          if (!snap.exists) continue;
          const data = snap.data();
          if (data && !data.deleted) {
            nodesMap[snap.id] = { id: snap.id, ...data } as INode;
          }
        }
      } catch (error) {
        console.error(`Error fetching nodes batch:`, error);
      }
    }),
  );
  return nodesMap;
}

function buildNodePaths(
  nodes: { [id: string]: INode },
  appName: string,
): { [id: string]: any[] } {
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

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { nodeId, appName } = req.body;

    if (!nodeId || typeof nodeId !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "nodeId is required" });
    }

    if (!appName || typeof appName !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "appName is required" });
    }

    const currentNodeDoc = await db.collection(NODES).doc(nodeId).get();
    if (!currentNodeDoc.exists) {
      return res.status(404).json({ success: false, error: "Node not found" });
    }

    const currentNode = {
      id: currentNodeDoc.id,
      ...currentNodeDoc.data(),
    } as INode;

    const generalizations =
      currentNode.generalizations?.flatMap((c) => c.nodes) || [];

    const relatedNodes = await fetchNodes(generalizations.map((g) => g.id));
    relatedNodes[nodeId] = currentNode;

    // Close the ref chains: parts resolve through partsInheritance.source.
    const missingSources = () => [
      ...new Set(
        Object.values(relatedNodes)
          .map((n) => n.partsInheritance?.source)
          .filter((s): s is string => !!s && !relatedNodes[s]),
      ),
    ];
    let frontier = missingSources();
    while (frontier.length > 0) {
      const fetched = await fetchNodes(frontier);
      Object.assign(relatedNodes, fetched);
      if (Object.keys(fetched).length === 0) break;
      frontier = missingSources();
    }

    const chainResolvedOf = makeResolvedOf(relatedNodes);
    const partIds = chainResolvedOf(nodeId).map((p) => p.id);

    const generalizationPartIds = new Set<string>();
    for (const gen of generalizations) {
      if (!relatedNodes[gen.id]) continue;
      chainResolvedOf(gen.id).forEach((p) => generalizationPartIds.add(p.id));
    }

    const partNodes = await fetchNodes([
      ...new Set([...partIds, ...generalizationPartIds]),
    ]);
    Object.assign(relatedNodes, partNodes);

    const specializationIds = new Set<string>();
    for (const partId of generalizationPartIds) {
      const partNode = relatedNodes[partId];
      if (partNode?.specializations) {
        partNode.specializations.forEach((collection: ICollection) => {
          collection.nodes?.forEach((n: any) => {
            specializationIds.add(n.id);
          });
        });
      }
    }

    const specNodes = await fetchNodes([...specializationIds]);
    Object.assign(relatedNodes, specNodes);

    // Rebuild over the full fetched set (part nodes resolve too, for hops).
    const resolvedOf = makeResolvedOf(relatedNodes);

    const eachNodePath = buildNodePaths(relatedNodes, appName);

    const inheritanceForParts: any = {};
    for (const partId of partIds) {
      if (relatedNodes[partId]) {
        const result = checkGeneralizations(
          partId,
          currentNode,
          relatedNodes,
          eachNodePath,
          resolvedOf,
        );
        inheritanceForParts[partId] = result;
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
        nonPickedWithTitles[fromId] = (toIds as string[]).map(
          (toId: string) => ({
            id: toId,
            title: relatedNodes[toId]?.title || "",
          }),
        );
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

    await db.collection(NODES).doc(nodeId).update({
      inheritedPartsDetails: calculations,
    });

    return res.status(200).json({
      success: true,
      data: calculations,
    });
  } catch (error: any) {
    console.error("Error generating inheritance part details:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
}

export default fbAuth(handler);
