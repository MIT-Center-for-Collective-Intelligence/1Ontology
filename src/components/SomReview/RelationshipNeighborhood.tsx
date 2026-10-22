import { useEffect, useRef, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { relationshipRequest as request } from "../../lib/relationshipReview/client";
import type {
  ContextNode,
  ContextPage,
  RelationshipContext,
} from "../../lib/relationshipReview/context";
import type { RelationshipCase } from "../../types/IRelationshipReview";

type Props = {
  item: RelationshipCase;
  datasetVersion: string;
  datasetSha256: string;
  preview: boolean;
};
type Query = {
  focusId: string;
  activityOffset: number;
  sourceOffset: number;
};
type Expected = Query & {
  caseId: string;
  datasetVersion: string;
  datasetSha256: string;
  limit: number;
};
type Role = RelationshipContext["choices"][number]["roles"][number];
const roles: Role[] = ["focal", "current", "proposed", "alternative"];
const pageLimit = 20;
const mismatchMessage =
  "The neighboring activities do not match this activity, focus or page. Please retry.";

function captureDate(value: string): string {
  if (!value) return "Not recorded for this version";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
}

function isNode(value: unknown): value is ContextNode {
  if (!value || typeof value !== "object") return false;
  const node = value as ContextNode;
  return (
    typeof node.id === "string" &&
    typeof node.title === "string" &&
    (node.description === undefined || typeof node.description === "string") &&
    (node.descriptionSource == null ||
      typeof node.descriptionSource === "string")
  );
}
function isPage(value: unknown): value is ContextPage {
  if (!value || typeof value !== "object") return false;
  const page = value as ContextPage;
  return (
    Array.isArray(page.items) &&
    page.items.every(isNode) &&
    Number.isSafeInteger(page.total) &&
    page.total >= page.items.length &&
    Number.isSafeInteger(page.offset) &&
    page.offset >= 0 &&
    Number.isSafeInteger(page.limit) &&
    page.limit >= 0 &&
    (page.nextOffset === null ||
      (Number.isSafeInteger(page.nextOffset) && page.nextOffset > page.offset))
  );
}
function matchesContext(
  value: unknown,
  expected: Expected,
): value is RelationshipContext {
  if (!value || typeof value !== "object") return false;
  const context = value as RelationshipContext;
  if (
    context.caseId !== expected.caseId ||
    context.datasetVersion !== expected.datasetVersion ||
    context.datasetSha256 !== expected.datasetSha256 ||
    typeof context.available !== "boolean" ||
    ![
      context.sourceSha256,
      context.disclosureVersion,
      context.contextSha256,
      context.sourceApp,
      context.sourceCapturedAt,
    ].every((text) => typeof text === "string") ||
    !Array.isArray(context.choices) ||
    !context.choices.every(
      (choice) =>
        choice &&
        isNode(choice.node) &&
        Array.isArray(choice.roles) &&
        choice.roles.length > 0 &&
        choice.roles.every((role) => roles.includes(role)),
    ) ||
    !Array.isArray(context.generalizations) ||
    !context.generalizations.every(isNode) ||
    !Number.isSafeInteger(context.generalizationsTotal) ||
    context.generalizationsTotal < context.generalizations.length ||
    !isPage(context.specializationPage) ||
    !isPage(context.sourcePage) ||
    !Array.isArray(context.ancestors?.nodes) ||
    !context.ancestors.nodes.every(isNode) ||
    !Array.isArray(context.ancestors.edges) ||
    !context.ancestors.edges.every(
      (edge) =>
        edge &&
        typeof edge.generalizationId === "string" &&
        typeof edge.specializationId === "string",
    ) ||
    typeof context.ancestors.truncated !== "boolean" ||
    !Array.isArray(context.ancestors.cycles) ||
    !context.ancestors.cycles.every(
      (cycle) =>
        Array.isArray(cycle) && cycle.every((id) => typeof id === "string"),
    ) ||
    !Array.isArray(context.missingNodeIds) ||
    !context.missingNodeIds.every((id) => typeof id === "string") ||
    !Array.isArray(context.limitations) ||
    !context.limitations.every((text) => typeof text === "string")
  )
    return false;
  if (!context.available)
    return (
      context.focus === null &&
      context.choices.length === 0 &&
      context.generalizationsTotal === 0 &&
      context.generalizations.length === 0 &&
      context.specializationPage.total === 0 &&
      context.specializationPage.items.length === 0 &&
      context.sourcePage.total === 0 &&
      context.sourcePage.items.length === 0 &&
      context.ancestors.nodes.length === 0 &&
      context.ancestors.edges.length === 0 &&
      context.ancestors.cycles.length === 0 &&
      context.missingNodeIds.length === 0
    );
  return (
    isNode(context.focus) &&
    context.focus.id === expected.focusId &&
    context.choices.some(({ node }) => node.id === expected.focusId) &&
    context.specializationPage.offset === expected.activityOffset &&
    context.sourcePage.offset === expected.sourceOffset &&
    context.specializationPage.limit === expected.limit &&
    context.sourcePage.limit === expected.limit &&
    context.specializationPage.items.every((node) => node.oNetTask !== true) &&
    context.sourcePage.items.every((node) => node.oNetTask === true) &&
    context.contextSha256.length > 0
  );
}
function roleLabel(role: Role, choiceRoles: Role[]): string {
  return {
    focal: "Activity under review",
    current: "Current Generalization (recorded)",
    proposed: choiceRoles.includes("current")
      ? "Proposed Generalization (retained link)"
      : "Proposed Generalization (not applied)",
    alternative: "Alternative Generalization (considered)",
  }[role];
}
function defaultFocus(
  choices: RelationshipContext["choices"],
  caseId: string,
): string {
  return (
    choices.find(
      ({ roles }) => roles.includes("proposed") && !roles.includes("current"),
    )?.node.id ??
    choices.find(({ roles }) => roles.includes("proposed"))?.node.id ??
    caseId
  );
}
function NodeList({ nodes, empty }: { nodes: ContextNode[]; empty: string }) {
  if (!nodes.length) return <Typography>{empty}</Typography>;
  return (
    <Box component="ul" sx={{ pl: 3, my: 1 }}>
      {nodes.map((node, index) => (
        <Box component="li" key={`${node.id}:${index}`} sx={{ mb: 1.5 }}>
          <Typography sx={{ fontWeight: 600 }}>{node.title}</Typography>
          {node.description && (
            <Typography
              sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
            >
              {node.description}
            </Typography>
          )}
          <Box component="details" sx={{ mt: 0.5 }}>
            <Box
              component="summary"
              sx={{ typography: "caption", cursor: "pointer" }}
            >
              Record details
            </Box>
            <Typography
              variant="caption"
              sx={{ display: "block", overflowWrap: "anywhere" }}
            >
              ID: {node.id}
            </Typography>
            {node.descriptionSource && (
              <Typography variant="caption" color="text.secondary">
                Description source: {node.descriptionSource}
              </Typography>
            )}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
function PageControls({
  page,
  label,
  onOffset,
}: {
  page: ContextPage;
  label: "activity Specializations" | "O*NET records";
  onOffset: (offset: number) => void;
}) {
  const noun = label === "activity Specializations" ? "activities" : "records";
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1}
      alignItems={{ xs: "stretch", sm: "center" }}
      justifyContent="space-between"
    >
      <Typography variant="body2">
        {page.items.length
          ? `${page.offset + 1}–${page.offset + page.items.length} of ${page.total} ${noun}`
          : `${page.total} ${noun} in total; none on this page.`}
      </Typography>
      <Stack direction="row" spacing={1}>
        <Button
          aria-label={`Previous ${label}`}
          disabled={page.offset === 0}
          onClick={() => onOffset(Math.max(0, page.offset - page.limit))}
        >
          Previous
        </Button>
        <Button
          aria-label={`Next ${label}`}
          disabled={page.nextOffset === null}
          onClick={() => {
            if (page.nextOffset !== null) onOffset(page.nextOffset);
          }}
        >
          Next
        </Button>
      </Stack>
    </Stack>
  );
}
function TechnicalDetails({ context }: { context: RelationshipContext }) {
  const fields: [string, string][] = [
    ["Dataset version", context.datasetVersion],
    ["Case ID", context.caseId],
    ["Focus ID", context.focus?.id || "None"],
    ["Source capture timestamp", context.sourceCapturedAt],
    [
      "Focus description source",
      context.focus?.descriptionSource || "Not supplied",
    ],
    ["Dataset SHA-256", context.datasetSha256],
    ["Source SHA-256", context.sourceSha256],
    ["Context SHA-256 (this case, focus and pages)", context.contextSha256],
    ["Disclosure version", context.disclosureVersion],
    [
      "Activity page",
      `Offset ${context.specializationPage.offset}; limit ${context.specializationPage.limit}`,
    ],
    [
      "O*NET page",
      `Offset ${context.sourcePage.offset}; limit ${context.sourcePage.limit}`,
    ],
  ];
  return (
    <Accordion disableGutters>
      <AccordionSummary expandIcon={<span aria-hidden="true">⌄</span>}>
        <Typography>Snapshot identity and technical details</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Box
          role="region"
          aria-label="Snapshot technical details"
          component="dl"
          sx={{ m: 0 }}
        >
          {fields.map(([label, value]) => (
            <Box key={label} sx={{ mb: 1 }}>
              <Typography
                component="dt"
                variant="body2"
                sx={{ fontWeight: 600 }}
              >
                {label}
              </Typography>
              <Typography
                component="dd"
                variant="body2"
                sx={{ m: 0, overflowWrap: "anywhere" }}
              >
                {value || "Not supplied"}
              </Typography>
            </Box>
          ))}
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}
function RecordedDetails({ context }: { context: RelationshipContext }) {
  const nodes = new Map<string, ContextNode>();
  for (const node of [
    ...context.choices.map(({ node }) => node),
    ...context.generalizations,
    ...context.ancestors.nodes,
  ])
    nodes.set(node.id, node);
  const identify = (id: string) =>
    `${nodes.get(id)?.title || "Missing reference"} (ID: ${id})`;
  return (
    <Accordion disableGutters>
      <AccordionSummary expandIcon={<span aria-hidden="true">⌄</span>}>
        <Typography>Recorded ancestor connections and limitations</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack role="region" aria-label="Recorded ancestor details" spacing={2}>
          <Typography>
            These are recorded ancestor connections, not proposed links. Each
            connection names a Generalization and its Specialization.
          </Typography>
          <Typography component="h5" variant="subtitle1">
            Ancestor activities
          </Typography>
          <NodeList
            nodes={context.ancestors.nodes}
            empty="No ancestor activities are included in this view."
          />
          <Typography component="h5" variant="subtitle1">
            Recorded connections ({context.ancestors.edges.length})
          </Typography>
          <Box component="ul" sx={{ pl: 3, m: 0 }}>
            {context.ancestors.edges.map((edge, index) => (
              <Typography
                component="li"
                key={index}
                sx={{ overflowWrap: "anywhere" }}
              >
                Generalization: {identify(edge.generalizationId)}.
                Specialization: {identify(edge.specializationId)}.
              </Typography>
            ))}
          </Box>
          <Typography>
            {context.ancestors.truncated
              ? "The ancestor view is truncated; some connections may be missing."
              : "No truncation was reported for this view."}
          </Typography>
          <Typography component="h5" variant="subtitle1">
            Reported cycles
          </Typography>
          {context.ancestors.cycles.length ? (
            <Box component="ul" sx={{ pl: 3, m: 0 }}>
              {context.ancestors.cycles.map((cycle, index) => (
                <Typography
                  component="li"
                  key={index}
                  sx={{ overflowWrap: "anywhere" }}
                >
                  {cycle.map(identify).join(" → ")}
                </Typography>
              ))}
            </Box>
          ) : (
            <Typography>No cycles were reported for this view.</Typography>
          )}
          <Typography component="h5" variant="subtitle1">
            Missing references
          </Typography>
          {context.missingNodeIds.length ? (
            <Box component="ul" sx={{ pl: 3, m: 0 }}>
              {context.missingNodeIds.map((id, index) => (
                <Typography
                  component="li"
                  key={index}
                  sx={{ overflowWrap: "anywhere" }}
                >
                  ID: {id}
                </Typography>
              ))}
            </Box>
          ) : (
            <Typography>
              No missing references were reported for this view.
            </Typography>
          )}
          <Typography component="h5" variant="subtitle1">
            Limitations
          </Typography>
          {context.limitations.length ? (
            context.limitations.map((text, index) => (
              <Typography key={index}>{text}</Typography>
            ))
          ) : (
            <Typography>No additional limitations were reported.</Typography>
          )}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

function Neighborhood({ item, datasetVersion, datasetSha256, preview }: Props) {
  const caseId = item.id;
  const [shown, setShown] = useState(false);
  const [query, setQuery] = useState<Query>({
    focusId: caseId,
    activityOffset: 0,
    sourceOffset: 0,
  });
  const [choices, setChoices] = useState<RelationshipContext["choices"]>([]);
  const [loaded, setLoaded] = useState<{
    identity: string;
    context: RelationshipContext;
  } | null>(null);
  const [error, setError] = useState<{
    identity: string;
    message: string;
  } | null>(null);
  const [retry, setRetry] = useState(0);
  const [sourceOpen, setSourceOpen] = useState(false);
  const generation = useRef(0);
  const chooseDefault = useRef(true);
  const { focusId, activityOffset, sourceOffset } = query;
  const identity = JSON.stringify([
    datasetVersion,
    datasetSha256,
    caseId,
    focusId,
    activityOffset,
    sourceOffset,
    pageLimit,
    preview,
  ]);
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;

  useEffect(() => {
    if (!shown) return;
    let active = true;
    const requestGeneration = ++generation.current;
    const expected: Expected = {
      caseId,
      datasetVersion,
      datasetSha256,
      focusId,
      activityOffset,
      sourceOffset,
      limit: pageLimit,
    };
    const isCurrent = () =>
      active &&
      generation.current === requestGeneration &&
      currentIdentity.current === identity;
    setLoaded(null);
    setError(null);
    request("context", expected, preview)
      .then((data) => {
        if (!isCurrent()) return;
        const response: unknown = data?.context;
        if (!matchesContext(response, expected)) throw Error(mismatchMessage);
        if (response.available) {
          setChoices(response.choices);
          if (chooseDefault.current) {
            chooseDefault.current = false;
            // Discover available choices with a known focal ID first. Do not
            // briefly present the focal leaf as the default when a proposed
            // Generalization is available in the captured graph.
            const preferred = defaultFocus(response.choices, caseId);
            if (preferred !== focusId) {
              generation.current++;
              setQuery({
                focusId: preferred,
                activityOffset: 0,
                sourceOffset: 0,
              });
              return;
            }
          }
        }
        setLoaded({ identity, context: response });
      })
      .catch((failure: unknown) => {
        if (!isCurrent()) return;
        setError({
          identity,
          message:
            failure instanceof Error && failure.message
              ? failure.message
              : "Neighboring activities could not be loaded. Please retry.",
        });
      });
    return () => {
      active = false;
    };
  }, [
    shown,
    caseId,
    datasetVersion,
    datasetSha256,
    focusId,
    activityOffset,
    sourceOffset,
    preview,
    identity,
    retry,
  ]);

  function invalidate() {
    generation.current++;
    setLoaded(null);
    setError(null);
  }
  function changeFocus(id: string) {
    if (id === focusId) return;
    invalidate();
    chooseDefault.current = false;
    setSourceOpen(false);
    setQuery({ focusId: id, activityOffset: 0, sourceOffset: 0 });
  }
  function changePage(
    field: "activityOffset" | "sourceOffset",
    offset: number,
  ) {
    invalidate();
    setQuery((current) => ({ ...current, [field]: offset }));
  }
  const context = loaded?.identity === identity ? loaded.context : null;
  const message = error?.identity === identity ? error.message : "";
  const selectedChoice = context?.choices.find(
    ({ node }) => node.id === context.focus?.id,
  );

  return (
    <Box
      component="section"
      aria-label="Neighboring activities"
      sx={{
        mb: 3,
        p: { xs: 2, sm: 3 },
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
      }}
    >
      <Typography component="h3" variant="h6">
        Neighboring activities
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        Inspect recorded Generalizations and Specializations in the captured
        snapshot. This view does not change any links or your feedback.
      </Typography>
      {!shown && (
        <Button
          variant="outlined"
          sx={{ mt: 2, width: { xs: "100%", sm: "auto" } }}
          onClick={() => setShown(true)}
        >
          Show neighboring activities
        </Button>
      )}
      {shown && (
        <Stack spacing={2} sx={{ mt: 2 }}>
          {choices.length > 0 && (
            <TextField
              select
              fullWidth
              label="Activity to inspect"
              value={focusId}
              onChange={(event) => changeFocus(event.target.value)}
              SelectProps={{
                MenuProps: {
                  PaperProps: { sx: { maxWidth: "calc(100vw - 32px)" } },
                },
              }}
            >
              {choices.map((choice) => (
                <MenuItem
                  key={choice.node.id}
                  value={choice.node.id}
                  sx={{ whiteSpace: "normal" }}
                >
                  {choice.node.title} —{" "}
                  {choice.roles
                    .map((role) => roleLabel(role, choice.roles))
                    .join("; ")}
                  {choices.filter(
                    ({ node }) => node.title === choice.node.title,
                  ).length > 1 && ` (ID: ${choice.node.id})`}
                </MenuItem>
              ))}
            </TextField>
          )}
          {!context && !message && (
            <Box role="status" aria-live="polite">
              <LinearProgress />
              <Typography sx={{ mt: 1 }}>
                Loading neighboring activities…
              </Typography>
            </Box>
          )}
          {message && (
            <Alert severity="warning">
              <Typography>{message}</Typography>
              <Button
                onClick={() => {
                  invalidate();
                  setRetry((value) => value + 1);
                }}
              >
                Retry neighboring activities
              </Button>
            </Alert>
          )}
          {context && (
            <>
              <Box>
                <Typography variant="body2">
                  Source:{" "}
                  {context.sourceApp === "final-hierarchy-with-o*net"
                    ? "Final Hierarchy with O*NET"
                    : context.sourceApp || "Not recorded for this version"}
                </Typography>
                <Typography variant="body2">
                  Captured: {captureDate(context.sourceCapturedAt)}
                </Typography>
              </Box>
              {!context.available && (
                <Alert severity="info">
                  <Typography>
                    Neighboring activities are not available for this review
                    version.
                  </Typography>
                  {context.limitations.map((text, index) => (
                    <Typography key={index}>{text}</Typography>
                  ))}
                </Alert>
              )}
              {context.available && context.focus && (
                <>
                  <Typography variant="body2">
                    The lists below contain recorded snapshot links only. A new
                    proposed link is not added to these lists. Activities can
                    have more than one Generalization.
                  </Typography>
                  <Box component="section" aria-label="Selected focus">
                    <Typography component="h4" variant="h6">
                      {context.focus.title}
                    </Typography>
                    <Stack
                      direction="row"
                      flexWrap="wrap"
                      gap={1}
                      sx={{ my: 1 }}
                    >
                      {selectedChoice?.roles.map((role) => (
                        <Chip
                          key={role}
                          size="small"
                          variant="outlined"
                          label={roleLabel(role, selectedChoice.roles)}
                          sx={{
                            height: "auto",
                            py: 0.5,
                            "& .MuiChip-label": { whiteSpace: "normal" },
                          }}
                        />
                      ))}
                    </Stack>
                    <Typography
                      sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                    >
                      {context.focus.description ||
                        "No recorded description is supplied."}
                    </Typography>
                    {selectedChoice?.roles.includes("proposed") &&
                      !selectedChoice.roles.includes("current") &&
                      context.focus.id !== caseId && (
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          If approved, the activity under review, {item.title},
                          would be added among these Specializations. This is a
                          proposed placement, not a recorded link.
                        </Typography>
                      )}
                  </Box>
                  <Box
                    component="section"
                    aria-label="Recorded Generalizations"
                  >
                    <Typography component="h4" variant="h6">
                      Generalizations ({context.generalizationsTotal})
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Recorded direct Generalizations for the selected focus.
                      {context.generalizationsTotal >
                        context.generalizations.length &&
                        ` Showing ${context.generalizations.length} of ${context.generalizationsTotal}.`}
                    </Typography>
                    <NodeList
                      nodes={context.generalizations}
                      empty="No recorded Generalizations are returned for this focus."
                    />
                  </Box>
                  <Box
                    component="section"
                    aria-label="Activity Specializations"
                  >
                    <Typography component="h4" variant="h6">
                      Specializations ({context.specializationPage.total}{" "}
                      activities)
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Recorded activity links only. O*NET records are listed
                      separately below.
                    </Typography>
                    <NodeList
                      nodes={context.specializationPage.items}
                      empty="No activity Specializations are returned for this focus."
                    />
                    <PageControls
                      page={context.specializationPage}
                      label="activity Specializations"
                      onOffset={(offset) =>
                        changePage("activityOffset", offset)
                      }
                    />
                  </Box>
                  <Accordion
                    disableGutters
                    expanded={sourceOpen}
                    onChange={(_, expanded) => setSourceOpen(expanded)}
                  >
                    <AccordionSummary
                      expandIcon={<span aria-hidden="true">⌄</span>}
                    >
                      <Typography>
                        O*NET source records ({context.sourcePage.total})
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box role="region" aria-label="O*NET source records">
                        <Typography variant="body2">
                          These are source records for the selected focus, not
                          activity Specializations.
                        </Typography>
                        <NodeList
                          nodes={context.sourcePage.items}
                          empty="No O*NET source records are returned for this focus."
                        />
                        <PageControls
                          page={context.sourcePage}
                          label="O*NET records"
                          onOffset={(offset) =>
                            changePage("sourceOffset", offset)
                          }
                        />
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                  <RecordedDetails context={context} />
                </>
              )}
              <TechnicalDetails context={context} />
            </>
          )}
        </Stack>
      )}
    </Box>
  );
}

export default function RelationshipNeighborhood(props: Props) {
  // A different card or snapshot starts closed, without an automatic request.
  // Cleanup also cancels acceptance of any response for the previous instance.
  return (
    <Neighborhood
      key={JSON.stringify([
        props.datasetVersion,
        props.datasetSha256,
        props.item.id,
        props.preview,
      ])}
      {...props}
    />
  );
}
