import React from "react";
import {
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  List,
  ListItem,
  ListItemText,
  Checkbox,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

const ReinforcementLoopsDisplay = ({
  reinforcementLoops,
  nodes,
  selectedLoop,
  setSelectedLoop,
}: {
  reinforcementLoops: any;
  nodes: any;
  selectedLoop: any;
  setSelectedLoop: any;
}) => {
  const formatCycle = (cycle: any) =>
    (cycle || []).map((id: string, index: number) => (
      <React.Fragment key={id}>
        {nodes[id]?.label || id}
        {index < cycle.length - 1 && (
          <ArrowForwardIcon
            fontSize="small"
            sx={{ verticalAlign: "middle", mx: 0.5 }}
          />
        )}
      </React.Fragment>
    ));

  return (
    <Box sx={{ p: 3 }}>
      {Object.keys(reinforcementLoops).map((key) => (
        <Accordion key={key} defaultExpanded sx={{ borderRadius: "12px" }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography>{key}</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ p: "5px", mb: "15px", borderRadius: "25px" }}>
            {reinforcementLoops[key].length > 0 ? (
              <List sx={{ p: 0 }}>
                {reinforcementLoops[key].map((loop: any, index: number) => (
                  <ListItem
                    key={index}
                    sx={{
                      marginBottom: 2,
                      gap: "13px",
                      p: 0,
                      m: 0,
                      cursor: "pointer",
                      borderRadius: "8px",
                      transition: "background-color 0.3s ease",
                      "&:hover": {
                        backgroundColor: (theme) =>
                          theme.palette.mode === "dark" ? "#545252" : "#f0f0f0",
                      },
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedLoop((prev: any) =>
                        prev?.loopNodes === loop.loopNodes ? null : loop,
                      );
                    }}
                  >
                    <Checkbox
                      checked={selectedLoop?.loopNodes === loop.loopNodes}
                      sx={{ p: 0 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLoop((prev: any) =>
                          prev?.loopNodes === loop.loopNodes ? null : loop,
                        );
                      }}
                    />
                    <ListItemText
                      primary={
                        <Typography variant="body1">
                          {formatCycle(loop.loopNodes)}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography sx={{ color: "gray", fontSize: "13px" }}>
                No {key}s detected!
              </Typography>
            )}
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};

export default ReinforcementLoopsDisplay;
