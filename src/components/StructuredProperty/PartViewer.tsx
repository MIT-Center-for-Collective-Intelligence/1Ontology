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
  user: any;
  navigateToNode: any;
  replaceWith: any;
  skillsFutureApp: any;
  getGeneralizationParts: any;
  onDisplayDetailsChange?: (isExpanded: boolean) => void;
  clonedNodesQueue?: { [nodeId: string]: { title: string; id: string } };
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
  user,
  navigateToNode,
  replaceWith,
  skillsFutureApp,
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
    mutateData,
    debouncedRefetch,
  } = useInheritedPartsDetails(currentVisibleNode);
  console.log(inheritedPartsDetails, "inheritedPartsDetails ==>");

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
          skillsFutureApp={skillsFutureApp}
          inheritedPartsDetails={inheritedPartsDetails}
          mutateData={mutateData}
          debouncedRefetch={debouncedRefetch}
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
