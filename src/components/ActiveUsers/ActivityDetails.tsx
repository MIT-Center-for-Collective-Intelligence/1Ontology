import {
  Box,
  Typography,
  Paper,
  Button,
  Tooltip,
  Stack,
  IconButton,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import SubdirectoryArrowRightIcon from "@mui/icons-material/SubdirectoryArrowRight";
import { alpha } from "@mui/material/styles";
import OptimizedAvatar from "../Chat/OptimizedAvatar";
import { getChangeDescription } from "@components/lib/utils/helpers";
import { NodeChange } from "@components/types/INode";
import dayjs from "dayjs";
import { useState } from "react";
import MarkdownRender from "../Markdown/MarkdownRender";
import moment from "moment";

const ActivityDetails = ({
  activity,
  displayDiff,
  modifiedByDetails,
  selectedDiffNode,
  nodes,
}: {
  activity: NodeChange;
  displayDiff: Function;
  modifiedByDetails?: any;
  selectedDiffNode: any;
  nodes: { [nodeId: string]: any };
}) => {
  const [isSelected, setIsSelected] = useState(false);
  const isHighlighted = isSelected || selectedDiffNode?.id === activity.id;
  const changeSummary = getChangeDescription(activity, "");
  const nodeTitle = nodes[activity.nodeId]?.title || activity.fullNode?.title;
  const triggeredBy = activity.triggeredBy;
  const isChildLog = !!triggeredBy;

  const relativeFromNow = () => {
    const t = dayjs(new Date(activity.modifiedAt.toDate())).fromNow();
    return t.includes("NaN") ? "a few minutes ago" : t;
  };

  const getToolTip = () => {
    let tooltipText = "";
    const modifiedMoment = moment(activity.modifiedAt.toDate());
    if (modifiedMoment.isSame(moment(), "day")) {
      tooltipText = `Today at ${modifiedMoment.format("h:mm:ss A")}`;
    } else if (modifiedMoment.isSame(moment().subtract(1, "day"), "day")) {
      tooltipText = `Yesterday at ${modifiedMoment.format("h:mm:ss A")}`;
    } else {
      tooltipText = modifiedMoment.format("MMM Do [at] h:mm:ss A");
    }

    return tooltipText;
  };

  const timeTooltipSlotProps = {
    tooltip: {
      sx: {
        bgcolor: "grey.900",
        color: "grey.50",
        fontSize: "0.75rem",
        fontWeight: 500,
        px: 1,
        py: 0.75,
        boxShadow: 4,
        "& .MuiTooltip-arrow": { color: "grey.900" },
      },
    },
  };

  const metaSecondarySx = {
    fontSize: "0.8125rem",
    lineHeight: 1.45,
    color: "text.secondary",
  } as const;

  const TimeLabel = (
    <Tooltip
      title={getToolTip()}
      placement="top"
      arrow
      slotProps={timeTooltipSlotProps}
    >
      <Typography
        component="span"
        sx={{
          ...metaSecondarySx,
          display: "inline",
          cursor: "default",
          letterSpacing: "0.01em",
          transition: "color 0.15s ease",
          "&:hover": { color: "text.primary" },
        }}
      >
        {relativeFromNow()}
      </Typography>
    </Tooltip>
  );

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", mt: isChildLog ? 1 : 2 }}
    >
      <Paper
        elevation={0}
        sx={(theme) => ({
          mx: 2,
          ml: isChildLog ? 8 : 2,
          p: isChildLog ? 1.75 : 3,
          borderRadius: 3,
          border: "1px solid",
          borderColor: isHighlighted
            ? alpha(theme.palette.warning.main, 0.55)
            : theme.palette.mode === "dark"
              ? alpha(theme.palette.common.white, 0.22)
              : alpha(theme.palette.grey[700], 0.35),
          ...(isChildLog
            ? {
                borderLeft: "3px dashed",
                borderLeftColor: alpha(theme.palette.warning.main, 0.55),
              }
            : {}),
          bgcolor: isHighlighted
            ? alpha(
                theme.palette.warning.main,
                theme.palette.mode === "dark" ? 0.1 : 0.06,
              )
            : theme.palette.mode === "dark"
              ? alpha(theme.palette.common.black, 0.2)
              : theme.palette.background.paper,
          opacity: isChildLog && !isHighlighted ? 0.92 : 1,
          boxShadow: isHighlighted
            ? `0 0 0 1px ${alpha(theme.palette.warning.main, 0.35)}, ${theme.shadows[2]}`
            : theme.palette.mode === "dark"
              ? `0 1px 0 ${alpha(theme.palette.common.white, 0.06)} inset`
              : theme.shadows[1],
          transition:
            "box-shadow 0.2s ease, border-color 0.2s ease, background-color 0.2s ease, opacity 0.2s ease",
          "&:hover": {
            borderColor: isHighlighted
              ? undefined
              : theme.palette.mode === "dark"
                ? alpha(theme.palette.common.white, 0.32)
                : alpha(theme.palette.grey[700], 0.5),
            opacity: 1,
          },
        })}
      >
        <Stack spacing={isChildLog ? 1 : 1.5}>
          <Stack
            direction="row"
            alignItems="stretch"
            justifyContent="space-between"
            gap={2}
          >
            <Box
              sx={{
                minWidth: 0,
                flex: 1,
                display: "flex",
                alignItems: "center",
              }}
            >
              {(!modifiedByDetails || isChildLog) && (
                <Box sx={{ py: 0.25 }}>{TimeLabel}</Box>
              )}
              {modifiedByDetails && !isChildLog && (
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={2}
                  sx={{ minWidth: 0, width: "100%" }}
                >
                  <Box
                    sx={(theme) => {
                      const ring = 44;
                      const inner = 40;
                      return {
                        flexShrink: 0,
                        width: ring,
                        height: ring,
                        borderRadius: "50%",
                        boxSizing: "border-box",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        lineHeight: 0,
                        background: `linear-gradient(135deg, ${theme.palette.warning.light} 0%, ${theme.palette.warning.dark} 100%)`,
                        "& > *": {
                          flexShrink: 0,
                        },
                        [`& .MuiAvatar-root`]: {
                          width: inner,
                          height: inner,
                          minWidth: inner,
                          boxSizing: "border-box",
                        },
                      };
                    }}
                  >
                    <OptimizedAvatar
                      alt={`${modifiedByDetails.fName} ${modifiedByDetails.lName}`}
                      imageUrl={modifiedByDetails.imageUrl || ""}
                      size={40}
                      sx={{
                        m: 0,
                        p: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                      }}
                    />
                  </Box>
                  <Stack
                    spacing={0.35}
                    sx={{ minWidth: 0, justifyContent: "center" }}
                  >
                    <Typography
                      sx={{
                        fontWeight: 600,
                        fontSize: "0.9375rem",
                        lineHeight: 1.35,
                        color: "text.primary",
                      }}
                    >
                      {modifiedByDetails.fName} {modifiedByDetails.lName}
                    </Typography>
                    {TimeLabel}
                  </Stack>
                </Stack>
              )}
            </Box>
            <Stack
              direction="row"
              alignItems="center"
              spacing={0.5}
              sx={{ flexShrink: 0 }}
            >
              <Button
                onClick={() => {
                  if (isHighlighted) {
                    displayDiff(null);
                  } else {
                    displayDiff(null);
                    displayDiff(activity);
                    setIsSelected(true);
                    setTimeout(() => setIsSelected(false), 500);
                  }
                }}
                variant="contained"
                color="warning"
                disableElevation
                size="small"
                sx={(theme) => ({
                  borderRadius: 999,
                  textTransform: "none",
                  fontWeight: 600,
                  fontSize: isChildLog ? "0.75rem" : "0.8125rem",
                  px: isChildLog ? 1.5 : 2.25,
                  py: isChildLog ? 0.4 : 0.65,
                  minWidth: isChildLog ? 70 : 92,
                  boxShadow: "none",
                  ...(isHighlighted
                    ? {
                        bgcolor: "warning.main",
                        color: "warning.contrastText",
                        "&:hover": {
                          bgcolor: "warning.dark",
                          boxShadow: "none",
                        },
                      }
                    : {
                        bgcolor:
                          theme.palette.mode === "dark"
                            ? alpha(theme.palette.common.white, 0.12)
                            : theme.palette.grey[200],
                        color:
                          theme.palette.mode === "dark"
                            ? theme.palette.grey[100]
                            : theme.palette.grey[900],
                        border: "1px solid",
                        borderColor:
                          theme.palette.mode === "dark"
                            ? alpha(theme.palette.common.white, 0.14)
                            : theme.palette.grey[300],
                        "&:hover": {
                          bgcolor:
                            theme.palette.mode === "dark"
                              ? alpha(theme.palette.common.white, 0.18)
                              : theme.palette.grey[300],
                          borderColor:
                            theme.palette.mode === "dark"
                              ? alpha(theme.palette.common.white, 0.22)
                              : theme.palette.grey[400],
                          boxShadow: "none",
                        },
                      }),
                })}
              >
                {isHighlighted ? "Unselect" : "View"}
              </Button>
              {process.env.NODE_ENV === "development" && (
                <Tooltip
                  placement="left"
                  arrow
                  title={
                    <Box
                      sx={{ py: 0.25, textAlign: "left", maxWidth: 320 }}
                      component="div"
                    >
                      {(
                        [
                          ["Log ID", activity.id],
                          ["Node ID", activity.nodeId],
                          [
                            "Log LLM ID",
                            activity.logLLMId != null &&
                            activity.logLLMId !== ""
                              ? String(activity.logLLMId)
                              : "—",
                          ],
                        ] as const
                      ).map(([label, value]) => (
                        <Typography
                          key={label}
                          variant="caption"
                          component="div"
                          sx={{
                            fontFamily:
                              "ui-monospace, SFMono-Regular, Menlo, monospace",
                            fontSize: "0.7rem",
                            lineHeight: 1.65,
                            wordBreak: "break-all",
                          }}
                        >
                          <Box
                            component="span"
                            sx={{ color: "grey.400", mr: 0.5 }}
                          >
                            {label}:
                          </Box>
                          <Box component="span" sx={{ color: "grey.100" }}>
                            {value}
                          </Box>
                        </Typography>
                      ))}
                    </Box>
                  }
                  slotProps={{
                    tooltip: {
                      sx: {
                        bgcolor: "grey.900",
                        color: "grey.100",
                        border: "1px solid",
                        borderColor: alpha("#fff", 0.12),
                        px: 1.25,
                        py: 0.75,
                        boxShadow: 6,
                        "& .MuiTooltip-arrow": { color: "grey.900" },
                      },
                    },
                  }}
                >
                  <IconButton
                    size="small"
                    aria-label="Debug identifiers for this activity"
                    sx={(theme) => ({
                      color: "grey.400",
                      "&:hover": {
                        color: "common.white",
                        bgcolor: alpha(theme.palette.common.white, 0.08),
                      },
                    })}
                  >
                    <InfoOutlinedIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          </Stack>

          <Box
            role="status"
            aria-label="Activity summary and node"
            sx={(theme) => ({
              py: isChildLog ? 0 : 1.25,
              px: isChildLog ? 0 : 1.5,
              borderRadius: 1.25,
              border: isChildLog ? "none" : "1px solid",
              borderColor: alpha(theme.palette.warning.main, 0.45),
              bgcolor: isChildLog
                ? "transparent"
                : alpha(
                    theme.palette.warning.main,
                    theme.palette.mode === "dark" ? 0.14 : 0.08,
                  ),
              boxShadow:
                isChildLog || theme.palette.mode !== "dark"
                  ? "none"
                  : `0 0 0 1px ${alpha(theme.palette.common.white, 0.04)} inset`,
            })}
          >
            {!isChildLog && (
              <Typography
                variant="overline"
                sx={{
                  display: "block",
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  color: "warning.main",
                  lineHeight: 1.2,
                  mb: 0.5,
                }}
              >
                What changed
              </Typography>
            )}
            {triggeredBy && (
              <Tooltip
                title={`Triggered by ${triggeredBy.nodeTitle || "another node"}`}
                placement="top"
                arrow
                slotProps={timeTooltipSlotProps}
              >
                <Box
                  sx={(theme) => ({
                    mb: 1,
                    px: 1,
                    py: 0.4,
                    borderRadius: 999,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.5,
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    letterSpacing: "-0.005em",
                    color: "warning.main",
                    border: "1px dashed",
                    borderColor: alpha(theme.palette.warning.main, 0.55),
                    bgcolor: alpha(
                      theme.palette.warning.main,
                      theme.palette.mode === "dark" ? 0.1 : 0.06,
                    ),
                    transition:
                      "background-color 0.15s ease, border-color 0.15s ease",
                  })}
                >
                  <SubdirectoryArrowRightIcon sx={{ fontSize: 14 }} />
                  Triggered by edit on
                  <Box
                    component="span"
                    sx={{
                      maxWidth: 220,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontWeight: 800,
                    }}
                  >
                    {`"${triggeredBy.nodeTitle || "another node"}"`}
                  </Box>
                </Box>
              </Tooltip>
            )}
            <Typography
              component="p"
              sx={{
                m: 0,
                fontSize: isChildLog ? "0.8125rem" : "0.9375rem",
                fontWeight: isChildLog ? 500 : 600,
                lineHeight: 1.5,
                color: isChildLog ? "text.secondary" : "text.primary",
                letterSpacing: "-0.01em",
                wordBreak: "break-word",
              }}
            >
              {changeSummary}
            </Typography>
            {nodeTitle ? (
              <Typography
                component="p"
                sx={{
                  m: 0,
                  mt: isChildLog ? 0.5 : 1.25,
                  fontWeight: isChildLog ? 600 : 800,
                  fontSize: isChildLog ? "0.875rem" : "1.25rem",
                  lineHeight: 1.35,
                  letterSpacing: "-0.02em",
                  wordBreak: "break-word",
                  color: isChildLog ? "text.secondary" : "text.primary",
                }}
              >
                {nodeTitle}
              </Typography>
            ) : null}
          </Box>

          {activity.reasoning && (
            <Box
              sx={(theme) => ({
                pt: 2,
                borderTop: "1px solid",
                borderColor:
                  theme.palette.mode === "dark"
                    ? alpha(theme.palette.common.white, 0.06)
                    : alpha(theme.palette.divider, 0.85),
              })}
            >
              <Box
                sx={(theme) => ({
                  p: 2,
                  borderRadius: 1.5,
                  border: "1px solid",
                  borderColor:
                    theme.palette.mode === "dark"
                      ? alpha(theme.palette.common.white, 0.1)
                      : theme.palette.divider,
                  bgcolor:
                    theme.palette.mode === "dark"
                      ? alpha(theme.palette.common.white, 0.04)
                      : alpha(theme.palette.warning.main, 0.06),
                  borderLeft: "2px solid",
                  borderLeftColor: "warning.main",
                })}
              >
                <Typography
                  variant="caption"
                  sx={{
                    display: "block",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "text.secondary",
                    mb: 1.25,
                  }}
                >
                  Comments
                </Typography>
                <MarkdownRender
                  text={activity.reasoning}
                  sx={{
                    fontSize: "0.875rem",
                    fontWeight: 400,
                    letterSpacing: "inherit",
                    lineHeight: 1.65,
                    color: "text.primary",
                  }}
                />
              </Box>
            </Box>
          )}
        </Stack>
      </Paper>
    </Box>
  );
};

export default ActivityDetails;
