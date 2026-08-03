import { Box, Typography } from "@mui/material";
import React, { useEffect, useState } from "react";
import InheritedPartsViewerEdit from "./InheritedPartsViewerEdit";
import InheritedPartsViewer from "./InheritedPartsViewer";
import {
  ILinkNode,
  INode,
  InheritedPartsDetail,
} from "@components/types/INode";
import { useInheritedPartsDetails } from "@components/lib/hooks/useInheritedPartsDetails";

interface PartViewerProps {
  enableEdit: boolean;
  property: string;
  getAllGeneralizations: any;
  currentVisibleNode: any;
  resolvedParts: ILinkNode[];
  resolvedPartsLoading: boolean;
  partsWriting?: boolean;
  relatedNodes: { [id: string]: any };
  fetchNode: (nodeId: string) => Promise<INode | null>;
  addNodesToCache?: (
    nodes: { [id: string]: INode },
    parentNodeId?: string,
  ) => void;
  linkNodeRelation: any;
  unlinkNodeRelation: any;
  sortParts: (
    orderedIds: string[],
    inheritedPartsDetails?: InheritedPartsDetail[] | null,
  ) => Promise<void>;
  switchPartSource: (partId: string, genId: string) => Promise<void>;
  addPartFromGen: (partId: string, genId?: string) => Promise<void>;
  togglePartOptional: (partId: string, optional: boolean) => Promise<void>;
  savingPartIds: Set<string>;
  user: any;
  navigateToNode: any;
  replaceWith: any;
  appName?: string;
  getGeneralizationParts: any;
  onDisplayDetailsChange?: (isExpanded: boolean) => void;
  clonedNodesQueue?: {
    [nodeId: string]: { title: string; id: string; property: string };
  };
  saveNewSpecialization?: (queuedId: string, collectionName: string) => void;
  cancelPendingPart?: (queuedId: string) => void;
  updatePendingPartTitle?: (queuedId: string, title: string) => void;
}

const PartViewer: React.FC<PartViewerProps> = ({
  enableEdit,
  property,
  getAllGeneralizations,
  currentVisibleNode,
  resolvedParts,
  resolvedPartsLoading,
  partsWriting,
  relatedNodes,
  fetchNode,
  addNodesToCache,
  linkNodeRelation,
  unlinkNodeRelation,
  sortParts,
  switchPartSource,
  addPartFromGen,
  togglePartOptional,
  savingPartIds,
  user,
  navigateToNode,
  replaceWith,
  appName,
  getGeneralizationParts,
  onDisplayDetailsChange,
  clonedNodesQueue,
  saveNewSpecialization,
  cancelPendingPart,
  updatePendingPartTitle,
}) => {
  const [displayDetails, setDisplayDetails] = useState(false);

  const {
    data: inheritedPartsDetails,
    repairing: inheritedPartsRepairing,
    mutateData: mutateInheritedPartsDetails,
  } = useInheritedPartsDetails(
    currentVisibleNode,
    resolvedParts,
    resolvedPartsLoading,
  );

  useEffect(() => {
    onDisplayDetailsChange?.(displayDetails);
  }, [displayDetails, onDisplayDetailsChange]);

  return (
    <Box>
      {enableEdit ? (
        <InheritedPartsViewerEdit
          selectedProperty={property}
          getAllGeneralizations={() =>
            getAllGeneralizations(currentVisibleNode, relatedNodes)
          }
          getGeneralizationParts={getGeneralizationParts}
          nodes={relatedNodes}
          fetchNode={fetchNode}
          addNodesToCache={addNodesToCache}
          readOnly={true}
          currentVisibleNode={currentVisibleNode}
          resolvedParts={resolvedParts}
          setDisplayDetails={setDisplayDetails}
          enableEdit={enableEdit}
          addPart={
            enableEdit
              ? (partId: string) => {
                  linkNodeRelation({
                    currentNodeId: currentVisibleNode.id,
                    partId,
                  });
                }
              : null
          }
          removePart={
            enableEdit
              ? (partId: any) => {
                  unlinkNodeRelation(
                    currentVisibleNode.id,
                    partId,
                    -1,
                    0,
                    true,
                  );
                }
              : null
          }
          user={user}
          navigateToNode={navigateToNode}
          replaceWith={replaceWith}
          sortParts={sortParts}
          switchPartSource={switchPartSource}
          addPartFromGen={addPartFromGen}
          togglePartOptional={togglePartOptional}
          savingPartIds={savingPartIds}
          appName={appName}
          inheritedPartsDetails={inheritedPartsDetails}
          inheritedPartsRepairing={inheritedPartsRepairing || !!partsWriting}
          mutateInheritedPartsDetails={mutateInheritedPartsDetails}
          clonedNodesQueue={clonedNodesQueue}
          approvePendingPart={(queuedId: string) =>
            saveNewSpecialization?.(queuedId, "main")
          }
          cancelPendingPart={cancelPendingPart}
          updatePendingPartTitle={updatePendingPartTitle}
        />
      ) : (
        <InheritedPartsViewer
          selectedProperty={property}
          getAllGeneralizations={() =>
            getAllGeneralizations(currentVisibleNode, relatedNodes)
          }
          nodes={relatedNodes}
          fetchNode={fetchNode}
          readOnly={true}
          currentVisibleNode={currentVisibleNode}
          resolvedParts={resolvedParts}
          setDisplayDetails={setDisplayDetails}
          addPart={
            enableEdit
              ? (partId: string) => {
                  linkNodeRelation({
                    currentNodeId: currentVisibleNode.id,
                    partId,
                  });
                }
              : null
          }
          removePart={
            enableEdit
              ? (partId: any) => {
                  unlinkNodeRelation(
                    currentVisibleNode.id,
                    partId,
                    -1,
                    0,
                    true,
                  );
                }
              : null
          }
          navigateToNode={navigateToNode}
          displayDetails={displayDetails}
          inheritedPartsDetails={inheritedPartsDetails}
          inheritedPartsRepairing={inheritedPartsRepairing || !!partsWriting}
        />
      )}
    </Box>
  );
};

export default PartViewer;
