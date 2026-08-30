import React, { useMemo, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  InputAdornment,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SearchIcon from "@mui/icons-material/Search";

import { SomLargeCaseInventory } from "../../types/ISomReview";

const csvCell = (value: string | number) =>
  `"${String(value).replaceAll('"', '""')}"`;

const LargeCaseInventoryPanel = ({
  inventory,
}: {
  inventory: SomLargeCaseInventory;
}) => {
  const [query, setQuery] = useState("");
  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return inventory.rows;
    return inventory.rows.filter((row) =>
      row.title.toLocaleLowerCase().includes(normalizedQuery),
    );
  }, [inventory.rows, query]);

  const downloadCsv = () => {
    const csv = [
      ["Current atomic activity title", "Linked O*NET descriptions"],
      ...inventory.rows.map((row) => [
        row.title,
        row.linkedONetDescriptionCount,
      ]),
    ]
      .map((row) => row.map(csvCell).join(","))
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([`${csv}\n`], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `atomic-activities-more-than-${inventory.cutoff}-onet-descriptions.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Accordion
      disableGutters
      variant="outlined"
      sx={{
        mb: 3,
        borderRadius: 1,
        overflow: "hidden",
        "&:before": { display: "none" },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        aria-controls="large-onet-inventory-content"
        id="large-onet-inventory-header"
        sx={{ px: { xs: 1.75, sm: 2.25 }, py: 0.5 }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "flex-start", sm: "center" }}
          gap={1}
          sx={{ minWidth: 0 }}
        >
          <Typography component="h2" sx={{ fontWeight: 800 }}>
            Activities with more than {inventory.cutoff} O*NET descriptions
          </Typography>
          <Chip
            size="small"
            variant="outlined"
            label={`${inventory.uniqueTitleCount} titles`}
          />
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ px: { xs: 1.75, sm: 2.25 }, pt: 0, pb: 2.25 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "stretch", sm: "center" }}
          justifyContent="space-between"
          gap={1.25}
          sx={{ mb: 1.5 }}
        >
          <Typography sx={{ color: "text.secondary", lineHeight: 1.5 }}>
            {inventory.uniqueTitleCount} unique titles across{" "}
            {inventory.ontologyOccurrenceCount} ontology occurrences
          </Typography>
          <Stack direction="row" alignItems="center" gap={1}>
            <TextField
              size="small"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search titles"
              inputProps={{ "aria-label": "Search activity titles" }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: { xs: 0, sm: 240 }, flex: { xs: 1, sm: "none" } }}
            />
            <Tooltip title="Download the complete table as CSV">
              <Button
                variant="outlined"
                onClick={downloadCsv}
                startIcon={<DownloadOutlinedIcon />}
                sx={{ minHeight: 40, whiteSpace: "nowrap" }}
              >
                Download
              </Button>
            </Tooltip>
          </Stack>
        </Stack>

        <TableContainer
          component={Box}
          sx={{
            maxHeight: 480,
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
          }}
        >
          <Table
            stickyHeader
            size="small"
            aria-label="Large O*NET activity cases"
          >
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 800 }}>
                  Current atomic activity title
                </TableCell>
                <TableCell align="right" sx={{ width: 190, fontWeight: 800 }}>
                  Linked O*NET descriptions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRows.map((row) => (
                <TableRow key={row.title} hover>
                  <TableCell sx={{ overflowWrap: "anywhere" }}>
                    {row.title}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {row.linkedONetDescriptionCount}
                  </TableCell>
                </TableRow>
              ))}
              {!filteredRows.length && (
                <TableRow>
                  <TableCell colSpan={2} align="center" sx={{ py: 4 }}>
                    No matching titles
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </AccordionDetails>
    </Accordion>
  );
};

export default LargeCaseInventoryPanel;
