import { Box, Typography } from "@mui/material";
import React, { useEffect, useState } from "react";
import InheritedPartsViewerEdit from "./InheritedPartsViewerEdit";
import InheritedPartsViewer from "./InheritedPartsViewer";
import { INode, InheritedPartsDetail } from "@components/types/INode";
import { useInheritedPartsDetails } from "@components/lib/hooks/useInheritedPartsDetails";

interface PartViewerProps {
  enableEdit: boolean;
  property: string;
  getAllGeneralizations: any;
  currentVisibleNode: any;
  relatedNodes: { [id: string]: any };
  fetchNode: (nodeId: string) => Promise<INode | null>;
  addNodesToCache?: (
    nodes: { [id: string]: INode },
    parentNodeId?: string,
  ) => void;
  linkNodeRelation: any;
  unlinkNodeRelation: any;
  saveParts: (
    newParts: any[],
    inheritedPartsDetails?: InheritedPartsDetail[] | null,
  ) => Promise<void>;
  sortParts: (newParts: any[]) => Promise<void>;
  switchPartSource: (partId: string, genId: string) => Promise<void>;
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
  relatedNodes,
  fetchNode,
  addNodesToCache,
  linkNodeRelation,
  unlinkNodeRelation,
  saveParts,
  sortParts,
  switchPartSource,
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
    loading: inheritedPartsLoading,
    mutateData: mutateInheritedPartsDetails,
    refetchNow,
  } = useInheritedPartsDetails(currentVisibleNode);

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
          saveParts={saveParts}
          sortParts={sortParts}
          switchPartSource={switchPartSource}
          appName={appName}
          inheritedPartsDetails={inheritedPartsDetails}
          inheritedPartsLoading={inheritedPartsLoading}
          mutateInheritedPartsDetails={mutateInheritedPartsDetails}
          refetchNow={refetchNow}
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
        />
      )}
    </Box>
  );
};

export default PartViewer;
