import Dag from "react-d3-dag";
import React, { useMemo } from "react";
import { Box, CircularProgress } from "@mui/material";

const DagViewSimplified = ({ mainSpecializations }: any) => {
  const convertedData = useMemo(() => {
    const convertToStructure: any = (data: any, key: string) => {
      const result: { name: string; children: any[] } = {
        name: key,
        children: [],
      };

      if (data.specializations) {
        result.children = Object.keys(data.specializations).map((childKey) =>
          convertToStructure(data.specializations[childKey], childKey)
        );
      }

      return result;
    };

    const convertedDataMap: any = [];

    Object.keys(mainSpecializations).forEach((key) => {
      convertedDataMap.push(convertToStructure(mainSpecializations[key], key));
    });

    return convertedDataMap;
  }, [mainSpecializations]);
  if (!convertedData.length) {
    return <CircularProgress />;
  }
  return (
    <Box id="treeWrapper" style={{ width: "100%", height: "110vh" }}>
      <Dag
        data={{ name: "Types", children: [...convertedData] }}
        rootNodeClassName="node__root"
        branchNodeClassName="node__branch"
        leafNodeClassName="node__leaf"
        renderCustomNodeElement={({ nodeDatum, toggleNode }) => (
          <g>
            <rect
              width="200"
              height="50"
              x="-30"
              y="-25"
              onClick={toggleNode}
            />
            <text fill="black" x="0">
              {nodeDatum.name}
            </text>
            {nodeDatum.attributes?.department && (
              <text fill="black" x="0" dy="20" strokeWidth="1">
                Department: {nodeDatum.attributes?.department}
              </text>
            )}
          </g>
        )}
      />
    </Box>
  );
};

export default React.memo(DagViewSimplified);
