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
          Trusted-reviewer fast path
        </Typography>
        <Typography sx={{ color: "text.secondary", lineHeight: 1.45 }}>
          Eligible answers enter an audited, snapshot-bound propagation draft.
          Ontology changes still require a separate batch application.
        </Typography>
      </Box>
      <FormControlLabel
        label={enabled ? "Fast path on" : "Review only"}
        labelPlacement="start"
        control={
          <Switch
            checked={enabled}
            onChange={(event) => onChange(event.target.checked)}
            slotProps={{
              input: { "aria-label": "Trusted-reviewer fast path" },
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
