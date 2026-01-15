import { NextApiRequest, NextApiResponse } from "next";
import { db, admin } from "@components/lib/firestoreServer/admin";
import { NODES } from "@components/lib/firestoreClient/collections";
import fbAuth from "@components/middlewares/fbAuth";
import {
  INode,
  ICollection,
  TransferInheritance,
} from "@components/types/INode";

const getPartOptionalStatus = (
  partId: string,
  nodeId: string,
  nodes: { [id: string]: INode },
): boolean => {
  const node = nodes[nodeId];
  if (!node?.properties?.parts) return false;

  for (const collection of node.properties.parts) {
    const part = collection.nodes.find((n: any) => n.id === partId);
    if (part) return !!part.optional;
  }
  return false;
};

const getCurrentPartOptionalStatus = (
  partId: string,
  currentVisibleNode: INode,
  nodes: { [id: string]: INode },
): boolean => {
  const inheritanceRef = currentVisibleNode.inheritance["parts"]?.ref;
  const currentNodeParts =
    inheritanceRef && nodes[inheritanceRef]
      ? nodes[inheritanceRef].properties["parts"]
      : currentVisibleNode.properties["parts"];

  if (!currentNodeParts) return false;

  for (const collection of currentNodeParts) {
    const part = collection.nodes.find((n: any) => n.id === partId);
    if (part) return !!part.optional;
  }
  return false;
};

const analyzeInheritance = (
  inheritance: any,
  generalizationParts: string[],
  generalizationId: string,
  currentParts: string[],
  currentVisibleNode: INode,
  nodes: { [id: string]: INode },
  inheritanceForParts: any,
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

    for (const collection of fromNode.properties.parts) {
      for (const part of collection.nodes) {
        if (part.id === toPartId) {
          return 1;
        }
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
          nodes,
        );
        const toOptional = getCurrentPartOptionalStatus(
          key,
          currentVisibleNode,
          nodes,
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
            nodes,
          );
          const toOptional = getCurrentPartOptionalStatus(
            currentPart,
            currentVisibleNode,
            nodes,
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

  const inheritanceRef = currentVisibleNode.inheritance["parts"]?.ref;
  const currentNodeParts =
    inheritanceRef && nodes[inheritanceRef]
      ? nodes[inheritanceRef].properties["parts"]
      : currentVisibleNode.properties["parts"];
  const currentPartsOrder =
    currentNodeParts?.[0]?.nodes?.map((c: any) => c.id) || [];

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
        fromOptional: getPartOptionalStatus(part, generalizationId, nodes),
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
        toOptional: getCurrentPartOptionalStatus(
          key,
          currentVisibleNode,
          nodes,
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
          toOptional: getCurrentPartOptionalStatus(
            currentPart,
            currentVisibleNode,
            nodes,
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
): { genId: string; partOf: string | null }[] | null => {
  let inheritanceDetails: { genId: string; partOf: string | null }[] = [];

  const generalizations = (currentVisibleNode?.generalizations || []).flatMap(
    (c) => c.nodes,
  );

  for (let generalization of generalizations) {
    if (!relatedNodes[generalization.id]) {
      continue;
    }
    const refPartsId =
      relatedNodes[generalization.id]?.inheritance?.["parts"]?.ref;
    let generalizationParts =
      relatedNodes[generalization.id]?.properties?.parts;
    if (refPartsId && relatedNodes[refPartsId]?.properties?.parts) {
      generalizationParts = relatedNodes[refPartsId].properties.parts;
    }

    if (!generalizationParts || !generalizationParts[0]) {
      continue;
    }

    const partIdex = generalizationParts[0].nodes.findIndex(
      (c) => c.id === partId,
    );

    let partOfIdx: any = -1;

    if (partIdex === -1) {
      for (let { id } of generalizationParts[0].nodes) {
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

      const exacts = generalizationParts[0].nodes.filter((n) => {
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
        partOf: generalizationParts[0].nodes[partIdex].id,
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

  const fetchPromises = uniqueIds.map(async (nodeId) => {
    try {
      const doc = await db.collection(NODES).doc(nodeId).get();
      if (doc.exists) {
        const data = doc.data();
        if (data && !data.deleted) {
          nodesMap[doc.id] = { id: doc.id, ...data } as INode;
        }
      }
    } catch (error) {
      console.error(`Error fetching node ${nodeId}:`, error);
    }
  });

  await Promise.all(fetchPromises);
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

    const nodeIdsToFetch = new Set<string>();
    nodeIdsToFetch.add(nodeId);

    const generalizations =
      currentNode.generalizations?.flatMap((c) => c.nodes) || [];
    generalizations.forEach((g) => nodeIdsToFetch.add(g.id));

    const inheritanceRef = currentNode.inheritance?.["parts"]?.ref;
    if (inheritanceRef) nodeIdsToFetch.add(inheritanceRef);

    let parts = currentNode.properties?.parts || [];
    if (inheritanceRef) {
      const refDoc = await db.collection(NODES).doc(inheritanceRef).get();
      if (refDoc.exists) {
        const refData = refDoc.data();
        if (refData?.properties?.parts) {
          parts = refData.properties.parts;
        }
      }
    }

    const partIds = parts[0]?.nodes?.map((n: any) => n.id) || [];
    partIds.forEach((id: string) => nodeIdsToFetch.add(id));

    const relatedNodes = await fetchNodes([...nodeIdsToFetch]);
    relatedNodes[nodeId] = currentNode;

    const generalizationPartIds = new Set<string>();
    for (const gen of generalizations) {
      const genNode = relatedNodes[gen.id];
      if (!genNode) continue;

      const genRef = genNode.inheritance?.["parts"]?.ref;
      if (genRef) {
        nodeIdsToFetch.add(genRef);
        const refDoc = await db.collection(NODES).doc(genRef).get();
        if (refDoc.exists) {
          const refData = refDoc.data();
          if (refData?.properties?.parts) {
            refData.properties.parts.forEach((collection: ICollection) => {
              collection.nodes?.forEach((n: any) =>
                generalizationPartIds.add(n.id),
              );
            });
          }
        }
      } else {
        const genParts = genNode.properties?.parts || [];
        genParts.forEach((collection: ICollection) => {
          collection.nodes?.forEach((n: any) =>
            generalizationPartIds.add(n.id),
          );
        });
      }
    }

    const genPartNodes = await fetchNodes([...generalizationPartIds]);
    Object.assign(relatedNodes, genPartNodes);

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

    const eachNodePath = buildNodePaths(relatedNodes, appName);

    const inheritanceForParts: any = {};
    if (parts && parts[0]) {
      for (let node of parts[0].nodes) {
        if (relatedNodes[node.id]) {
          const result = checkGeneralizations(
            node.id,
            currentNode,
            relatedNodes,
            eachNodePath,
          );
          inheritanceForParts[node.id] = result;
          if (result) {
            result.forEach((r: any) => {});
          } else {
          }
        }
      }
    }

    const calculations: any[] = [];

    for (const gen of generalizations) {
      const genNode = relatedNodes[gen.id];
      if (!genNode) continue;

      const genRef = genNode.inheritance?.["parts"]?.ref;
      let genParts = genNode.properties?.parts || [];
      if (genRef && relatedNodes[genRef]?.properties?.parts) {
        genParts = relatedNodes[genRef].properties.parts;
      }

      const generalizationParts =
        genParts[0]?.nodes?.map((n: any) => n.id) || [];
      const currentParts = partIds;

      const analysisResult = analyzeInheritance(
        inheritanceForParts,
        generalizationParts,
        gen.id,
        currentParts,
        currentNode,
        relatedNodes,
        inheritanceForParts,
      );

      const detailsWithTitles = analysisResult.details.map((detail: any) => ({
        ...detail,
        fromTitle: detail.from ? relatedNodes[detail.from]?.title || "" : "",
        toTitle: detail.to ? relatedNodes[detail.to]?.title || "" : "",
      }));

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
