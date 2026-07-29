import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";

import { SomInspectionItem } from "../../types/ISomReview";
import ContextRenderer, {
  contextShowsStateComparison,
} from "./ContextRenderer";
import { reviewAccentColor } from "./reviewStyles";

const sourceLabel = {
  "proposed-change": "Proposed change",
  "status-quo-audit": "Sampled no-change control",
  "manual-check": "Direct review question",
} as const;

const StateBlock = ({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) => (
  <Box
    sx={{
      flex: 1,
      minWidth: 0,
      borderLeft: "3px solid",
      borderColor: emphasized ? reviewAccentColor : "divider",
      pl: 1.5,
      py: 0.5,
    }}
  >
    <Typography
      sx={{
        color: emphasized ? reviewAccentColor : "text.secondary",
        fontSize: "0.78rem",
        fontWeight: 800,
      }}
    >
      {label}
    </Typography>
    <Typography sx={{ mt: 0.4, lineHeight: 1.55 }}>{value}</Typography>
  </Box>
);

const SelectedDecision = ({
  item,
  reviewerName,
}: {
  item: SomInspectionItem;
  reviewerName: string;
}) => {
  const agreed = item.subjectResponse.decision === "agree";
  const label = agreed
    ? item.card.reviewerView.agreeLabel
    : item.card.reviewerView.disagreeLabel;
  return (
    <Box
      aria-label={`${reviewerName} selected ${label}`}
      sx={{
        borderLeft: "4px solid",
        borderColor: agreed ? "success.main" : "error.main",
        pl: 1.5,
        py: 0.75,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1}>
        <Chip
          color={agreed ? "success" : "error"}
          icon={agreed ? <CheckIcon /> : <CloseIcon />}
          label={label}
          sx={{ fontWeight: 800 }}
        />
        <Typography sx={{ color: "text.secondary", fontSize: "0.84rem" }}>
          Selected by {reviewerName}
        </Typography>
      </Stack>
      {!agreed && item.subjectResponse.disagreementReason && (
        <Box sx={{ mt: 1.25 }}>
          <Typography
            sx={{
              color: "text.secondary",
              fontSize: "0.78rem",
              fontWeight: 800,
            }}
          >
            Explanation
          </Typography>
          <Typography sx={{ mt: 0.35, lineHeight: 1.55 }}>
            {item.subjectResponse.disagreementReason}
          </Typography>
        </Box>
      )}
      {!agreed && item.subjectResponse.suggestedCorrection && (
        <Box sx={{ mt: 1.25 }}>
          <Typography
            sx={{
              color: "text.secondary",
              fontSize: "0.78rem",
              fontWeight: 800,
            }}
          >
            Proposed alternative
          </Typography>
          <Typography sx={{ mt: 0.35, lineHeight: 1.55 }}>
            {item.subjectResponse.suggestedCorrection}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

const InspectionItemCard = ({
  item,
  reviewerName,
  canAnnotate = true,
  onSaveException,
}: {
  item: SomInspectionItem;
  reviewerName: string;
  canAnnotate?: boolean;
  onSaveException: (
    item: SomInspectionItem,
    rationale: string,
    suggestedAlternative: string,
    clear?: boolean,
  ) => Promise<void>;
}) => {
  const [editing, setEditing] = useState(Boolean(item.exception));
  const [rationale, setRationale] = useState(item.exception?.rationale || "");
  const [alternative, setAlternative] = useState(
    item.exception?.suggestedAlternative || "",
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    setEditing(Boolean(item.exception));
    setRationale(item.exception?.rationale || "");
    setAlternative(item.exception?.suggestedAlternative || "");
    setSaveError("");
  }, [item.exception]);

  const mutate = async (clear = false) => {
    if (saving || (!clear && rationale.trim().length < 3)) return;
    setSaving(true);
    setSaveError("");
    try {
      await onSaveException(item, rationale.trim(), alternative.trim(), clear);
      if (clear) {
        setEditing(false);
        setRationale("");
        setAlternative("");
      }
    } catch {
      setSaveError("The inspection note could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const view = item.card.reviewerView;
  const comparisonInContext = contextShowsStateComparison(view.context);

  return (
    <Box
      component="article"
      id={`inspection-${item.card.proposalId}`}
      sx={{
        border: 1,
        borderColor: item.exception ? "warning.main" : "divider",
        borderRadius: 1,
        p: { xs: 2, sm: 2.5 },
        backgroundColor: "background.paper",
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
        spacing={1}
      >
        <Stack direction="row" flexWrap="wrap" gap={0.75}>
          <Chip size="small" label={sourceLabel[item.recordSource]} />
          <Chip size="small" variant="outlined" label={item.issueLabel} />
          {!item.currentlyApplicable && (
            <Chip
              size="small"
              color="warning"
              variant="outlined"
              label="Superseded by a dependency"
            />
          )}
          {item.exception && (
            <Chip size="small" color="warning" label="Not aligned" />
          )}
        </Stack>
        <Typography sx={{ color: "text.secondary", fontSize: "0.8rem" }}>
          Item {item.proposalIndex + 1}
        </Typography>
      </Stack>

      <Typography
        component="h2"
        sx={{
          mt: 2,
          fontSize: { xs: "1.05rem", sm: "1.15rem" },
          fontWeight: 800,
          lineHeight: 1.45,
        }}
      >
        {view.question}
      </Typography>

      {!comparisonInContext && (
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{ mt: 2 }}
        >
          <StateBlock label="Before" value={view.currentState} />
          <StateBlock
            label="LLM-suggested after"
            value={view.proposedState}
            emphasized
          />
        </Stack>
      )}

      <Box sx={{ mt: 2 }}>
        <ContextRenderer context={view.context} branch={item.card.branch} />
      </Box>

      {view.reasoning && (
        <Box sx={{ mt: 1.5 }}>
          <Typography
            sx={{
              color: "text.secondary",
              fontSize: "0.78rem",
              fontWeight: 800,
            }}
          >
            Proposal rationale
          </Typography>
          <Typography sx={{ mt: 0.35, lineHeight: 1.55 }}>
            {view.reasoning}
          </Typography>
        </Box>
      )}

      <Divider sx={{ my: 2 }} />
      <SelectedDecision item={item} reviewerName={reviewerName} />

      <Divider sx={{ my: 2 }} />
      {!canAnnotate && (
        <Typography sx={{ color: "text.secondary", fontSize: "0.88rem" }}>
          This is your own response. Inspection notes are available only to
          another reviewer.
        </Typography>
      )}
      {canAnnotate && !editing && (
        <Button
          disableElevation
          color="inherit"
          startIcon={<EditNoteOutlinedIcon />}
          onClick={() => setEditing(true)}
          sx={{ minHeight: 44, fontWeight: 750 }}
        >
          Mark not aligned
        </Button>
      )}
      {canAnnotate && editing && (
        <Stack spacing={1.25}>
          <Typography sx={{ fontWeight: 800 }}>
            Your separate inspection note
          </Typography>
          <Typography sx={{ color: "text.secondary", fontSize: "0.88rem" }}>
            This does not overwrite {reviewerName}&apos;s response.
          </Typography>
          <TextField
            label="Why are you not aligned?"
            multiline
            minRows={2}
            value={rationale}
            onChange={(event) => setRationale(event.target.value)}
            inputProps={{ maxLength: 3000 }}
            required
          />
          <TextField
            label="Suggested alternative (optional)"
            multiline
            minRows={2}
            value={alternative}
            onChange={(event) => setAlternative(event.target.value)}
            inputProps={{ maxLength: 3000 }}
          />
          {saveError && <Alert severity="error">{saveError}</Alert>}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button
              disableElevation
              variant="contained"
              onClick={() => mutate(false)}
              disabled={saving || rationale.trim().length < 3}
              sx={{ minHeight: 44, fontWeight: 750 }}
            >
              {saving ? (
                <CircularProgress size={20} color="inherit" />
              ) : item.exception ? (
                "Update note"
              ) : (
                "Save not-aligned note"
              )}
            </Button>
            {item.exception ? (
              <Button
                disableElevation
                color="inherit"
                onClick={() => mutate(true)}
                disabled={saving}
                sx={{ minHeight: 44, fontWeight: 700 }}
              >
                Clear note
              </Button>
            ) : (
              <Button
                disableElevation
                color="inherit"
                onClick={() => setEditing(false)}
                disabled={saving}
                sx={{ minHeight: 44, fontWeight: 700 }}
              >
                Cancel
              </Button>
            )}
          </Stack>
        </Stack>
      )}
    </Box>
  );
};

export default InspectionItemCard;
