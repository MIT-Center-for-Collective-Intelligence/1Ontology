import React from "react";
import {
  FormControl,
  ListItemText,
  MenuItem,
  Select,
  SelectChangeEvent,
} from "@mui/material";

import { SomReviewHistoryItem } from "../../types/ISomReview";

const ReviewHistorySelect = ({
  history,
  selectedProposalId,
  onSelect,
}: {
  history: SomReviewHistoryItem[];
  selectedProposalId: string;
  onSelect: (proposalId: string) => void;
}) => {
  if (history.length === 0) return null;

  const selectedItem = history.find(
    (item) => item.proposalId === selectedProposalId,
  );

  return (
    <FormControl
      size="small"
      sx={{
        width: { xs: "100%", sm: 360 },
        maxWidth: "100%",
      }}
    >
      <Select<string>
        value={selectedProposalId}
        displayEmpty
        inputProps={{ "aria-label": "Revise an earlier review" }}
        onChange={(event: SelectChangeEvent<string>) =>
          onSelect(event.target.value)
        }
        renderValue={() =>
          selectedItem
            ? "Revising item " + (selectedItem.proposalIndex + 1)
            : "Revise an earlier review"
        }
        MenuProps={{
          PaperProps: {
            sx: { maxWidth: 560 },
          },
        }}
        sx={{
          minHeight: 48,
          backgroundColor: "background.paper",
          fontWeight: 700,
          "& .MuiSelect-select": {
            display: "flex",
            alignItems: "center",
            whiteSpace: "normal",
          },
        }}
      >
        {history.map((item) => (
          <MenuItem
            key={item.proposalId}
            value={item.proposalId}
            sx={{
              alignItems: "flex-start",
              py: 1.25,
              whiteSpace: "normal",
            }}
          >
            <ListItemText
              primary={
                "Item " + (item.proposalIndex + 1) + ": " + item.question
              }
              secondary={
                "Current answer: " +
                (item.decision === "agree" ? "Agreed" : "Disagreed")
              }
              primaryTypographyProps={{
                sx: {
                  fontWeight: 700,
                  lineHeight: 1.35,
                  whiteSpace: "normal",
                },
              }}
              secondaryTypographyProps={{ sx: { mt: 0.4 } }}
            />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default ReviewHistorySelect;
