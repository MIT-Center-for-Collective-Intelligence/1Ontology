import React from "react";
import {
  Alert,
  Box,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";

const TrustedPropagationControl = ({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) => (
  <Alert
    severity={enabled ? "success" : "info"}
    icon={<BoltOutlinedIcon aria-hidden="true" />}
    sx={{
      mb: 2,
      alignItems: "center",
      "& .MuiAlert-message": { width: "100%", minWidth: 0 },
    }}
  >
    <Stack
      direction={{ xs: "column", sm: "row" }}
      alignItems={{ xs: "flex-start", sm: "center" }}
      justifyContent="space-between"
      spacing={1.25}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 800 }}>
          Continuous expert review
        </Typography>
        <Typography sx={{ color: "text.secondary", lineHeight: 1.45 }}>
          Save each decision immediately, open already-generated dependent
          questions automatically, and continue into the next ready review type.
          The session pauses only when accepted changes require an auditable
          ontology-regeneration checkpoint.
        </Typography>
      </Box>
      <FormControlLabel
        label={enabled ? "Continuous review on" : "Manual navigation"}
        labelPlacement="start"
        control={
          <Switch
            checked={enabled}
            onChange={(event) => onChange(event.target.checked)}
            slotProps={{
              input: { "aria-label": "Continuous expert review" },
            }}
          />
        }
        sx={{
          m: 0,
          flex: "0 0 auto",
          "& .MuiFormControlLabel-label": { fontWeight: 750 },
        }}
      />
    </Stack>
  </Alert>
);

export default TrustedPropagationControl;
