import React, { useState } from "react";
import { Button, CircularProgress, Box, Typography } from "@mui/material";
import ImprovementsSlider from "./ImprovementsSlider";
import {
  collection,
  getDocs,
  getFirestore,
  query,
  where,
} from "firebase/firestore";
import { NODES } from " @components/lib/firestoreClient/collections";
import { ICollection, INode } from " @components/types/INode";
import {
  compareProperties,
  getNodeIdByTitle,
} from " @components/lib/utils/helpersCopilot";
type ImprovementsProps = {
  currentImprovement: any;
  setCurrentImprovement: any;
  currentVisibleNode: any;
};
const Improvements = ({
  currentImprovement,
  setCurrentImprovement,
  currentVisibleNode: any,
}: ImprovementsProps) => {
  const db = getFirestore();
  const [isLoading, setIsLoading] = useState(false);
  const [improvements, setImprovements] = useState<any>([]);

  const handleImproveClick = async () => {
    setIsLoading(true);

    try {
      const response: any = await new Promise((resolve) =>
        setTimeout(
          () =>
            resolve({
              data: [
                {
                  title: "Actor",
                  nodeType:
                    "The type of the node, which could be either 'activity', 'actor', 'object', 'evaluationDimension', 'incentive', or 'reward'",
                  changes: [
                    {
                      title: "new title",
                      reasoning:
                        "Your reasoning for proposing this change to the title of the node.",
                    },
                    /*                     {
                      description: "The improved description of the node.",
                      reasoning:
                        "Your reasoning for proposing this change to the description of the node.",
                    },
                    {
                      specializations: [],
                      reasoning:
                        "Your reasoning for proposing this change to the specializations of the node.",
                    },
                    {
                      generalizations: [],
                      reasoning:
                        "Your reasoning for proposing this change to the generalizations of the node.",
                    },
                    {
                      parts: [],
                      reasoning:
                        "Your reasoning for proposing this change to the parts of the node.",
                    },
                    {
                      isPartOf: [],
                      reasoning:
                        "Your reasoning for proposing this change to the isPartOf of the node.",
                    }, */
                  ],
                },
              ],
            }),
          2000
        )
      );
      const improvements = (
        (await compareProposals(response.data)) || []
      ).filter((m: any) => (m.detailsOfChange || []).length > 0);
      console.log("improvements ==>", improvements);

      if (improvements) {
        setImprovements(improvements);
        setCurrentImprovement(improvements[0]);
      }
    } catch (error) {
      console.error("Error fetching improvements:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const compareProposals = async (improvements: any[]) => {
    try {
      for (let improvement of improvements) {
        const nodeDocs = await getDocs(
          query(collection(db, NODES), where("title", "==", improvement.title))
        );

        if (nodeDocs.docs.length > 0) {
          const nodeData = nodeDocs.docs[0].data() as INode;

          // for(let )
          const detailsOfChange = [];
          for (let property of ["specializations", "generalizations"]) {
            let changedProperty = false;
            const nodePropertyIds = nodeData[
              property as "specializations" | "generalizations"
            ]
              .flatMap((spec) => spec.nodes)
              .map((n) => n.id);
            const proposalPropertyIds: string[] = [];
            for (let collection of improvement[property]) {
              const newNodes = [];
              for (let nodeTitle of collection.nodes) {
                const id = await getNodeIdByTitle(nodeTitle);
                if (id) {
                  newNodes.push({
                    id,
                  });
                  proposalPropertyIds.push(id);
                }
              }
              collection.nodes = newNodes;
            }

            const missingSpecializations = proposalPropertyIds.filter(
              (id: string) => !nodePropertyIds.includes(id)
            );
            const extraSpecializations = nodePropertyIds.filter(
              (id: string) => !proposalPropertyIds.includes(id)
            );
            if (missingSpecializations.length > 0) {
              changedProperty = true;
              console.log(
                `New specializations added: ${missingSpecializations.join(
                  ", "
                )}`
              );
            }
            if (extraSpecializations.length > 0) {
              changedProperty = true;
              console.log(
                `Specializations removed: ${extraSpecializations.join(", ")}`
              );
            }
            if (changedProperty) {
              detailsOfChange.push({
                modifiedProperty: property,
                previousValue:
                  nodeData[property as "specializations" | "generalizations"],
                newValue:
                  improvement[property].length === 0
                    ? [
                        {
                          collectionName: "main",
                          nodes: [],
                        },
                      ]
                    : improvement[property],
              });
            }
          }

          const nodeProperties = nodeData.properties || {};
          const proposalProperties = improvement || {};

          // Function to compare properties based on type

          // Compare the properties of the node and the proposal
          const _detailsOfChange = await compareProperties(
            nodeProperties,
            proposalProperties,
            improvement
          );
          detailsOfChange.push(..._detailsOfChange);
          console.log("detailsOfChange", detailsOfChange);
          improvement.detailsOfChange = detailsOfChange;
          console.log(`Comparison complete for ${improvement.old_title}`);
        } else {
          console.log(
            `No node found with the title "${improvement.old_title}"`
          );
        }
      }
      console.log("done-improvements", improvements);
      return improvements;
    } catch (error) {
      console.error("Error comparing proposals:", error);
    }
  };
  const onRejectChange = () => {};
  const onAcceptChange = () => {
    try {
      console.log(currentImprovement, "setCurrentImprovement");
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Box textAlign="center" padding={4} sx={{ width: "450px" }}>
      {isLoading ? (
        <Box display="flex" flexDirection="column" alignItems="center">
          <CircularProgress />
          <Typography variant="body1" marginTop={2}>
            Loading...
          </Typography>
        </Box>
      ) : improvements.length > 0 ? (
        <Box>
          <ImprovementsSlider
            proposals={improvements}
            setCurrentImprovement={setCurrentImprovement}
            handleAcceptChange={onAcceptChange}
            setImprovements={setImprovements}
            handleRejectChange={onRejectChange}
          />
          <Button variant="contained" onClick={handleImproveClick}>
            Suggest Improvements to the Sub-Ontology Centered Around This Node
          </Button>
        </Box>
      ) : (
        <Button variant="contained" onClick={handleImproveClick}>
          Suggest Improvements to the Sub-Ontology Centered Around This Node
        </Button>
      )}
    </Box>
  );
};

export default Improvements;
