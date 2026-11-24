import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  Snackbar,
  Typography,
} from "@mui/material";

/**
 * The bar pinned under a step. It has no status text: the buttons carry the
 * state. Save while there is something unsaved ("Saving…" while it is
 * written), Next as the primary button once there is not, and a toast when
 * a save failed.
 */
type Props = {
  unsaved: number;
  state: "idle" | "saving" | "error";
  /** Why Next is blocked: unsaved changes, or what the step still needs. */
  hint?: string;
  /** Previous; shown on every step, with nothing to go to on the first. */
  previous?: { onClick: () => void; disabled?: boolean };
  /** The next step; none on the last one. */
  next?: { label: string; onClick: () => void };
  /** The last step: its own words, a save with no edits, and the way out. */
  last?: {
    saveLabel: string;
    /** The step's result is not stored yet, edited or not. */
    mustSave: boolean;
    doneHref: string;
  };
  onSave: () => void;
  onDiscard: () => void;
  /** Set while the reviewer is asked about leaving with unsaved changes. */
  leaving?: boolean;
  onLeave?: (choice: "save" | "discard" | "cancel") => void;
  dark: boolean;
};

// The padding of the page's scroll area (#node-section). A sticky element
// stops inside it, so the bar sticks that much lower, at the window's edge.
const PAGE_PAD = 20;
const changes = (n: number) => `${n} ${n === 1 ? "change" : "changes"}`;

// A ring on keyboard focus only, in the button's own colour: nothing at
// rest, nothing on a mouse click.
const NEUTRAL_RING = "#5a5a60";
const ring = (color: string) => ({
  "&.Mui-focusVisible, &:focus-visible": {
    boxShadow: `0 0 0 3px ${color}`,
  },
});

/**
 * One confirmation dialog for the whole workflow: a title, a line of text,
 * Cancel and one filled button, with an optional text button at the far
 * left. The backdrop and Esc cancel; focus is kept inside and given back.
 */
const Confirm = ({
  open,
  id,
  title,
  body,
  wide,
  focus,
  onCancel,
  primary,
  aside,
  dark,
}: {
  open: boolean;
  /** Prefix of the ids the dialog is labelled and described by. */
  id: string;
  title: string;
  body: string;
  /** Three buttons need a little more room. */
  wide?: boolean;
  /** The button in focus when it opens. */
  focus: "cancel" | "primary";
  onCancel: () => void;
  primary: { label: string; tone: "danger" | "save"; onClick: () => void };
  aside?: { label: string; onClick: () => void };
  dark: boolean;
}) => {
  const button = {
    minWidth: 0,
    px: "16px",
    py: "9px",
    // pills, as in the bar
    borderRadius: "999px",
    fontSize: 14,
    lineHeight: "20px",
    textTransform: "none" as const,
  };
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-body`}
      slotProps={{ backdrop: { sx: { bgcolor: "rgba(10,10,12,.7)" } } }}
      PaperProps={{
        role: "alertdialog",
        elevation: 0,
        sx: {
          width: wide ? 420 : 400,
          maxWidth: "calc(100vw - 32px)",
          m: 0,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          p: "22px 22px 18px",
          bgcolor: dark ? "#26262a" : "#fff",
          backgroundImage: "none",
          border: `1px solid ${dark ? "#34343a" : "#d0d7de"}`,
          borderRadius: "12px",
          boxShadow: "0 20px 50px rgba(0,0,0,.5)",
        },
      }}
    >
      <Typography
        id={`${id}-title`}
        component="h2"
        sx={{
          m: 0,
          fontSize: 17,
          fontWeight: 600,
          lineHeight: 1.4,
          color: dark ? "#f0f0f2" : "#111",
        }}
      >
        {title}
      </Typography>
      <Typography
        id={`${id}-body`}
        sx={{
          fontSize: 14,
          lineHeight: 1.5,
          color: dark ? "#a9a9ae" : "#57575c",
        }}
      >
        {body}
      </Typography>
      <Box sx={{ display: "flex", gap: "8px", pt: "14px" }}>
        {aside && (
          <Button
            onClick={aside.onClick}
            // text only, in red: it throws the changes away
            sx={{
              ...button,
              fontWeight: 500,
              color: dark ? "#f6736c" : "#c5221f",
              "&:hover": { bgcolor: "action.hover" },
              ...ring("#d5413f59"),
            }}
          >
            {aside.label}
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button
          autoFocus={focus === "cancel"}
          onClick={onCancel}
          sx={{
            ...button,
            fontWeight: 500,
            color: dark ? "#d6d6da" : "#333",
            border: `1px solid ${dark ? "#3a3a40" : "#c9ccd1"}`,
            "&:hover": { bgcolor: "action.hover" },
            ...ring(NEUTRAL_RING),
          }}
        >
          Cancel
        </Button>
        <Button
          autoFocus={focus === "primary"}
          disableElevation
          onClick={primary.onClick}
          // the one filled button of the dialog
          sx={(t) => ({
            ...button,
            fontWeight: 600,
            ...(primary.tone === "danger"
              ? {
                  color: "#fff",
                  bgcolor: "#d5413f",
                  "&:hover": { bgcolor: "#c23533" },
                  ...ring("#d5413f59"),
                }
              : {
                  color: "#1a0f02",
                  bgcolor: "primary.main",
                  "&:hover": { bgcolor: "primary.light" },
                  ...ring(`${t.palette.primary.main}59`),
                }),
          })}
        >
          {primary.label}
        </Button>
      </Box>
    </Dialog>
  );
};

const SaveBar = ({
  unsaved,
  state,
  hint,
  previous,
  next,
  last,
  onSave,
  onDiscard,
  leaving,
  onLeave,
  dark,
}: Props) => {
  const [asking, setAsking] = useState(false);
  // The toast of a failed save: shown again for each failure.
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(state === "error"), [state]);
  const c = {
    bar: dark ? "#222226" : "#fff",
    edge: dark ? "#34343a" : "#d0d7de",
    outline: dark ? "#3a3a40" : "#c9ccd1",
    button: dark ? "#c9c9ce" : "#333",
    offLine: dark ? "#2e2e33" : "#e1e4e8",
    offText: dark ? "#55555b" : "#a0a0a6",
    text: dark ? "#e6e6e3" : "#222",
    muted: dark ? "#8a8a90" : "#6b6b70",
    light: dark ? "#ececef" : "#24292f",
    onLight: dark ? "#111" : "#fff",
  };

  const saving = state === "saving";
  const dirty = unsaved > 0 || !!last?.mustSave;
  const base = {
    minWidth: 0,
    borderRadius: "999px",
    fontSize: 14,
    lineHeight: "20px",
    textTransform: "none" as const,
    whiteSpace: "nowrap" as const,
  };
  const outlinedSx = {
    ...base,
    px: "16px",
    py: "10px",
    fontWeight: 500,
    color: c.button,
    bgcolor: "transparent",
    border: `1px solid ${c.outline}`,
    "&:hover": { bgcolor: "action.hover", borderColor: c.outline },
    "&.Mui-disabled": { color: c.offText, borderColor: c.offLine },
    ...ring(NEUTRAL_RING),
  };
  // The light fill of the one primary button once nothing is unsaved.
  const lightSx = {
    ...base,
    px: "20px",
    py: "10px",
    fontWeight: 600,
    color: c.onLight,
    bgcolor: c.light,
    "&:hover": { bgcolor: dark ? "#fff" : "#000" },
    ...ring(`${c.light}59`),
  };
  return (
    <Box
      data-testid="save-bar"
      sx={{
        position: "sticky",
        bottom: -PAGE_PAD,
        zIndex: 5,
        display: "flex",
        alignItems: "center",
        flexWrap: { xs: "wrap", md: "nowrap" },
        gap: "10px",
        minHeight: 72,
        boxSizing: "border-box",
        // the bottom edge of the step's container, whose corners clip it
        px: "22px",
        py: "12px",
        bgcolor: c.bar,
        borderTop: `1px solid ${c.edge}`,
        // content scrolls under it
        boxShadow: "0 -12px 24px rgba(0,0,0,.35)",
      }}
    >
      {previous && (
        <Button
          sx={outlinedSx}
          disabled={previous.disabled}
          onClick={previous.onClick}
        >
          ← Previous
        </Button>
      )}
      {/* nothing is said here: the buttons to the right carry the state */}
      <Box sx={{ flex: 1 }} />
      {unsaved > 0 && !saving && (
        <Button
          sx={{
            ...base,
            px: "10px",
            py: "9px",
            fontSize: 13,
            fontWeight: 500,
            color: c.muted,
            "&:hover": { bgcolor: "action.hover", color: c.text },
            ...ring(NEUTRAL_RING),
          }}
          onClick={() => setAsking(true)}
        >
          Discard
        </Button>
      )}
      {dirty && (
        <Button
          disableElevation
          disabled={saving}
          onClick={onSave}
          sx={(t) => ({
            ...base,
            px: "20px",
            py: "10px",
            fontWeight: 600,
            color: "#1a0f02",
            // a solid fill, with no shadow or ring at rest
            bgcolor: "primary.main",
            "&:hover": { bgcolor: "primary.light" },
            ...ring(`${t.palette.primary.main}59`),
            // while saving: the same pill, its fill dimmed
            "&.Mui-disabled": {
              color: "#1a0f02",
              bgcolor: dark ? "#8a5e3c" : "#e0b08a",
            },
          })}
        >
          {saving && (
            <CircularProgress
              size={14}
              thickness={5}
              sx={{ mr: "8px", color: "#1a0f02" }}
            />
          )}
          {saving ? "Saving…" : last?.saveLabel || "Save changes"}
        </Button>
      )}
      {next &&
        (dirty || hint ? (
          // blocked: the cursor says so, and the reason is on hover
          <Box
            component="span"
            title={hint}
            sx={{ display: "inline-flex", cursor: "not-allowed" }}
          >
            <Button disabled sx={outlinedSx}>
              Next →
            </Button>
          </Box>
        ) : (
          <Button disableElevation onClick={next.onClick} sx={lightSx}>
            Next: {next.label} →
          </Button>
        ))}
      {last && !dirty && !hint && (
        <Button
          component="a"
          href={last.doneHref}
          disableElevation
          sx={lightSx}
        >
          Done
        </Button>
      )}
      <Snackbar
        open={failed}
        autoHideDuration={6000}
        onClose={() => setFailed(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity="error"
          variant="filled"
          onClose={() => setFailed(false)}
        >
          Couldn&apos;t save. Try again.
        </Alert>
      </Snackbar>
      <Confirm
        open={asking}
        id="review-discard"
        title={`Discard ${changes(unsaved)}?`}
        body="The step goes back to what was last saved."
        onCancel={() => setAsking(false)}
        focus="cancel"
        dark={dark}
        primary={{
          label: "Discard changes",
          tone: "danger",
          onClick: () => {
            setAsking(false);
            onDiscard();
          },
        }}
      />
      <Confirm
        open={!!leaving}
        id="review-leave"
        wide
        title="Save changes before leaving?"
        body={`You have ${unsaved} unsaved ${
          unsaved === 1 ? "change" : "changes"
        } on this step.`}
        onCancel={() => onLeave?.("cancel")}
        focus="primary"
        dark={dark}
        aside={{ label: "Discard", onClick: () => onLeave?.("discard") }}
        primary={{
          label: "Save",
          tone: "save",
          onClick: () => onLeave?.("save"),
        }}
      />
    </Box>
  );
};

export default SaveBar;
