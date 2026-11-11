import Head from "next/head";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  FormControlLabel,
  FormLabel,
  LinearProgress,
  MenuItem,
  Radio,
  RadioGroup,
  ScopedCssBaseline,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useAuth } from "@components/components/context/AuthContext";
import withAuthUser from "@components/components/hoc/withAuthUser";
import ReviewTheme from "@components/components/SomReview/ReviewTheme";
import { getIdToken } from "@components/lib/firestoreClient/auth";
import {
  MULTI_SOURCE_COMMENT_LIMIT,
  type MultiSourceCase,
  type MultiSourceRating,
  type MultiSourceReview,
  type MultiSourceSession,
} from "@components/lib/titleValidation/multiSourceContract";

const endpoint = "/api/som-review/multi-source-title-review";
const ratings = [
  { value: "acceptable", label: "Acceptable" },
  { value: "not_acceptable", label: "Not acceptable" },
  { value: "unsure", label: "I’m not sure" },
] as const;
type Judgment = { rating: MultiSourceRating | ""; comment: string };
type ReviewFields = {
  titles: Record<string, Judgment>;
  categorization: Judgment;
};

const blankJudgment: Judgment = { rating: "", comment: "" };
function reviewFields(
  item: MultiSourceCase,
  saved?: MultiSourceReview,
): ReviewFields {
  return {
    titles: Object.fromEntries(
      item.groups.map((group) => [
        group.id,
        saved?.titles[group.id] ?? blankJudgment,
      ]),
    ),
    categorization: saved?.categorization ?? blankJudgment,
  };
}

async function request<T>(body?: object, signal?: AbortSignal): Promise<T> {
  const token = await getIdToken();
  if (!token) throw new Error("Sign in again to continue.");
  const response = await fetch(endpoint, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
    signal,
  });
  const data = await response.json().catch(() => undefined);
  if (!response.ok || !data)
    throw new Error(
      data?.error ||
        "The review could not be loaded or saved. Please try again.",
    );
  return data as T;
}

function RatingField({
  id,
  label,
  value,
  onChange,
  requiredError,
}: {
  id: string;
  label: string;
  value: Judgment;
  onChange: (value: Judgment) => void;
  requiredError: boolean;
}) {
  return (
    <FormControl component="fieldset" fullWidth error={requiredError}>
      <FormLabel id={`${id}-label`} component="legend">
        {label}
      </FormLabel>
      <RadioGroup
        row
        name={id}
        aria-labelledby={`${id}-label`}
        value={value.rating}
        onChange={(_, rating) =>
          onChange({ ...value, rating: rating as MultiSourceRating })
        }
      >
        {ratings.map((rating) => (
          <FormControlLabel
            key={rating.value}
            value={rating.value}
            control={<Radio />}
            label={rating.label}
          />
        ))}
      </RadioGroup>
      <TextField
        label={`${label} notes (optional)`}
        value={value.comment}
        onChange={(event) =>
          onChange({ ...value, comment: event.target.value })
        }
        multiline
        minRows={2}
        slotProps={{ htmlInput: { maxLength: MULTI_SOURCE_COMMENT_LIMIT } }}
      />
    </FormControl>
  );
}

export function MultiSourceReview() {
  const [batch, setBatch] = useState<MultiSourceSession>();
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<ReviewFields>();
  const [loading, setLoading] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [checkRatings, setCheckRatings] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const saveInFlight = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    request<MultiSourceSession>(undefined, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        const next = Math.max(
          0,
          result.cases.findIndex((item) => !result.reviews[item.id]),
        );
        const item = result.cases[next];
        setBatch(result);
        setIndex(next);
        setDraft(item && reviewFields(item, result.reviews[item.id]));
      })
      .catch((cause: Error) => {
        if (!controller.signal.aborted) setError(cause.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [loadAttempt]);

  const item = batch?.cases[index];
  const saved = item && batch?.reviews[item.id];
  const dirty = !!(
    item &&
    draft &&
    JSON.stringify(draft) !== JSON.stringify(reviewFields(item, saved))
  );
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function goTo(next: number) {
    const nextItem = batch?.cases[next];
    if (!batch || !nextItem || next === index || saveInFlight.current) return;
    if (
      dirty &&
      !window.confirm(
        "Leave this activity and discard your unsaved ratings and notes?",
      )
    )
      return;
    setIndex(next);
    setDraft(reviewFields(nextItem, batch.reviews[nextItem.id]));
    setCheckRatings(false);
    setNotice("");
    setError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!batch || !item || !draft || saveInFlight.current) return;
    setError("");
    setNotice("");
    setCheckRatings(true);
    if (
      !draft.categorization.rating ||
      item.groups.some((group) => !draft.titles[group.id].rating)
    ) {
      setError(
        "Choose a rating for every proposed title and for categorization.",
      );
      return;
    }
    saveInFlight.current = true;
    setSaving(true);
    try {
      const result = await request<MultiSourceReview>({
        version: batch.version,
        caseId: item.id,
        titles: draft.titles,
        categorization: draft.categorization,
        expectedRevision: saved?.revision ?? 0,
      });
      setBatch({ ...batch, reviews: { ...batch.reviews, [item.id]: result } });
      setDraft(reviewFields(item, result));
      setCheckRatings(false);
      setNotice("Review saved.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Your review could not be saved. Please try again.",
      );
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <ReviewTheme>
      <ScopedCssBaseline>
        <Stack
          component="main"
          spacing={3}
          sx={{ maxWidth: 1250, mx: "auto", p: { xs: 2, md: 4 } }}
        >
          <Typography component="h1" variant="h4">
            Multi-description activity review
          </Typography>
          {loading && <LinearProgress aria-label="Loading assigned review" />}
          {error && <Alert severity="error">{error}</Alert>}
          {!loading && !batch && (
            <Button
              onClick={() => {
                setError("");
                setLoading(true);
                setLoadAttempt((value) => value + 1);
              }}
            >
              Reload review
            </Button>
          )}
          {batch && item && draft && (
            <>
              <Typography color="text.secondary">
                {batch.reviewerLabel} · {Object.keys(batch.reviews).length} of{" "}
                {batch.cases.length} activities reviewed
              </Typography>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                alignItems={{ sm: "center" }}
              >
                <Button
                  disabled={index === 0 || saving}
                  onClick={() => goTo(index - 1)}
                >
                  Previous activity
                </Button>
                <TextField
                  select
                  label="Activity"
                  value={index}
                  onChange={(event) => goTo(Number(event.target.value))}
                  disabled={saving}
                  sx={{ minWidth: { sm: 280 } }}
                >
                  {batch.cases.map((entry, i) => (
                    <MenuItem key={entry.id} value={i}>
                      {i + 1}. {entry.originalTitle}
                      {batch.reviews[entry.id] ? " (reviewed)" : ""}
                    </MenuItem>
                  ))}
                </TextField>
                <Button
                  disabled={index === batch.cases.length - 1 || saving}
                  onClick={() => goTo(index + 1)}
                >
                  Next activity
                </Button>
              </Stack>
              <Typography component="h2" variant="h5">
                {index + 1}. {item.originalTitle}
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    md: "minmax(0, 1fr) minmax(0, 1fr)",
                  },
                  gap: 3,
                }}
              >
                <Card variant="outlined" sx={{ alignSelf: "start" }}>
                  <CardContent>
                    <Typography component="h3" variant="h6">
                      O*NET source descriptions
                    </Typography>
                    <Box component="ol" sx={{ pl: 3, mb: 0 }}>
                      {item.descriptions.map((description) => (
                        <Box
                          component="li"
                          key={description.number}
                          value={description.number}
                          sx={{ mb: 2 }}
                        >
                          <Typography variant="caption" color="text.secondary">
                            O*NET {description.sourceId}
                          </Typography>
                          <Typography sx={{ whiteSpace: "pre-wrap" }}>
                            {description.text}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
                <Stack component="form" noValidate onSubmit={save} spacing={2}>
                  <Typography component="h3" variant="h6">
                    Proposed titles and grouping
                  </Typography>
                  <Typography color="text.secondary">
                    Rate each title against its assigned descriptions. Then rate
                    how the descriptions were grouped across the proposed
                    titles.
                  </Typography>
                  <Box
                    component="fieldset"
                    disabled={saving}
                    sx={{ minWidth: 0, border: 0, m: 0, p: 0 }}
                  >
                    <Stack spacing={2}>
                      {item.groups.map((group, i) => (
                        <Card key={group.id} variant="outlined">
                          <CardContent>
                            <Typography
                              component="h4"
                              variant="subtitle1"
                              fontWeight="bold"
                            >
                              Group {i + 1}. {group.title}
                            </Typography>
                            <Typography sx={{ mb: 1 }} color="text.secondary">
                              Assigned descriptions:{" "}
                              {group.descriptionNumbers.join(", ")}
                            </Typography>
                            <RatingField
                              id={`title-${i + 1}`}
                              label={`Title quality for group ${i + 1}`}
                              value={draft.titles[group.id]}
                              requiredError={
                                checkRatings && !draft.titles[group.id].rating
                              }
                              onChange={(judgment) =>
                                setDraft({
                                  ...draft,
                                  titles: {
                                    ...draft.titles,
                                    [group.id]: judgment,
                                  },
                                })
                              }
                            />
                          </CardContent>
                        </Card>
                      ))}
                      <Card variant="outlined">
                        <CardContent>
                          <RatingField
                            id="categorization"
                            label="Categorization of descriptions"
                            value={draft.categorization}
                            requiredError={
                              checkRatings && !draft.categorization.rating
                            }
                            onChange={(judgment) =>
                              setDraft({ ...draft, categorization: judgment })
                            }
                          />
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 1 }}
                          >
                            In your notes, identify any descriptions you would
                            move or groups you would split or merge.
                          </Typography>
                        </CardContent>
                      </Card>
                    </Stack>
                  </Box>
                  {notice && <Alert severity="success">{notice}</Alert>}
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={saving || (!!saved && !dirty)}
                  >
                    {saving ? "Saving…" : "Save review"}
                  </Button>
                  {dirty && (
                    <Typography role="status" variant="body2">
                      Unsaved changes
                    </Typography>
                  )}
                </Stack>
              </Box>
            </>
          )}
        </Stack>
      </ScopedCssBaseline>
    </ReviewTheme>
  );
}

function AuthenticatedReview() {
  const [{ isAuthInitialized, isAuthenticated, user }] = useAuth();
  return (
    <>
      <Head>
        <title>Multi-description activity review</title>
      </Head>
      {isAuthInitialized && isAuthenticated ? (
        <MultiSourceReview key={user?.userId} />
      ) : (
        <main aria-busy="true">Loading your account…</main>
      )}
    </>
  );
}

export default withAuthUser({
  shouldRedirectToHomeIfAuthenticated: false,
  shouldRedirectToLogin: true,
})(AuthenticatedReview);
