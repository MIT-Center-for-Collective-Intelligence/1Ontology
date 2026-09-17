/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import TitleModelComparison, {
  TitleModelComparisonData,
} from "../../../src/components/SomReview/TitleModelComparison";
import type { TitleModelComparisonJudgment } from "../../../src/types/ITitleModelComparison";
jest.mock("../../../src/components/SomReview/ThemeModeToggle", () => () => (
  <button>Theme</button>
));
jest.mock("next/head", () => ({
  __esModule: true,
  default: ({ children }: any) => <>{children}</>,
}));

const judgment = (
  overrides: Partial<TitleModelComparisonJudgment> = {},
): TitleModelComparisonJudgment => ({
  status: "valid",
  verdict: "no-issues",
  softwareFindings: [],
  issues: [],
  summary: "No problems were found.",
  otherQuoteWarning: false,
  ...overrides,
});

const descriptions = [
  { number: 1, text: "Measure the output of production equipment." },
  { number: 2, text: "Inspect workplace safety equipment for defects." },
  { number: 3, text: "Calibrate measuring instruments to standards." },
];

const data: TitleModelComparisonData = {
  version: "test-comparison",
  label: "Four models on Rob’s very short title prompt",
  explanation: "Saved proposals.",
  prompt: "Exact very short prompt",
  wordingCorrection: {
    original: "but the title is adequate;",
    replacement: "but the title is inadequate;",
    reason: "B(ii) contradicts its own instruction.",
  },
  clarification: "Approximately 5–9 descriptions per new group.",
  outputFormat: "Return groups and a reason.",
  softwareChecks: "Ordinary code flags leading-verb changes.",
  funding: "Test funding route",
  lettersNote: "Letters were shuffled separately for each example.",
  models: [
    { id: "astra", label: "GPT-6 Astra", model: "gpt-6-astra", modelVersion: "2026-09-03", reasoning: "max", runDate: "2026-09-15", completed: 2, groupCount: 2, generationCostUsd: 2.02049 },
    { id: "sol", label: "GPT-5.6 Sol", model: "gpt-5.6-sol", modelVersion: "2026-07-09", reasoning: "medium", runDate: "2026-09-16", completed: 2, groupCount: 3, generationCostUsd: 0.40331 },
    { id: "terra", label: "GPT-5.6 Terra", model: "gpt-5.6-terra", modelVersion: "2026-07-09", reasoning: "medium", runDate: "2026-09-16", completed: 2, groupCount: 2, generationCostUsd: 0.107012 },
    { id: "mini", label: "GPT-5.4 Mini", model: "gpt-5.4-mini", modelVersion: "2026-03-17", reasoning: "medium", runDate: "2026-09-16", completed: 2, groupCount: 2, generationCostUsd: 0.059089 },
  ],
  cases: [
    {
      id: "case-1",
      title: "Measure Equipment",
      originalTitle: "Measure Equipment (Synonyms: Evaluate Equipment)",
      descriptions,
      options: [
        {
          letter: "A",
          modelId: "sol",
          status: "completed",
          groups: [
            { title: "Measure Equipment Output", descriptionNumbers: [1, 3], reason: "Both measure output." },
            { title: "Inspect Workplace Safety", descriptionNumbers: [2], reason: "Safety inspection." },
          ],
          reason: "Two different activities.",
          observations: ["“Inspect Workplace Safety” changes the leading verb."],
          judgment: judgment({
            verdict: "prompt-violation",
            softwareFindings: [
              {
                check: "initial-verb",
                severity: "prompt-violation",
                groupNumbers: [2],
                descriptionNumbers: [],
                explanation: "“Inspect Workplace Safety” does not begin with the current verb “Measure”.",
              },
            ],
            issues: [
              {
                rule: "same-activity",
                severity: "prompt-violation",
                groupNumbers: [2],
                descriptionNumbers: [2],
                evidenceQuote: "workplace safety equipment",
                explanation: "The title names safety inspection rather than measuring equipment.",
                quoteUnmatched: false,
              },
            ],
            summary: "One group names a different activity.",
          }),
        },
        {
          letter: "B",
          modelId: "astra",
          status: "completed",
          groups: [
            { title: "Measure Equipment Performance", descriptionNumbers: [1, 2, 3], reason: "All measure equipment." },
          ],
          reason: "One activity.",
          observations: [],
          judgment: judgment({
            verdict: "minor",
            issues: [
              {
                rule: "supported-detail",
                severity: "minor",
                groupNumbers: [1],
                descriptionNumbers: [1, 3],
                evidenceQuote: "equipment performance levels",
                explanation: "Performance is plausible but not stated.",
                quoteUnmatched: true,
              },
            ],
            summary: "A plausible added word.",
          }),
        },
        {
          letter: "C",
          modelId: "terra",
          status: "completed",
          groups: [
            { title: "Measure Production Equipment", descriptionNumbers: [1], reason: "Production." },
            { title: "Measure Instruments", descriptionNumbers: [2, 3], reason: "Instruments." },
          ],
          reason: "Split by equipment kind.",
          observations: [],
          judgment: judgment({
            status: "missing",
            verdict: null,
            summary: "",
          }),
        },
        {
          letter: "D",
          modelId: "mini",
          status: "completed",
          groups: [
            { title: "Measure Equipment", descriptionNumbers: [1, 2, 3], reason: "Current title is clear." },
          ],
          reason: "Keep the current title.",
          observations: [],
          judgment: judgment(),
        },
      ],
    },
    {
      id: "case-2",
      title: "Stock Area",
      originalTitle: "Stock Area",
      descriptions: [{ number: 1, text: "Stock serving areas with supplies." }],
      options: (["A", "B", "C", "D"] as const).map((letter, index) => ({
        letter,
        modelId: (["mini", "terra", "astra", "sol"] as const)[index],
        status: "completed",
        groups: [
          { title: `Stock Serving Area ${letter}`, descriptionNumbers: [1], reason: "Serving." },
        ],
        reason: "Clearer object.",
        observations: [],
        judgment: letter === "B"
          ? judgment({ status: "invalid", verdict: null, summary: "" })
          : judgment({ verdict: letter === "A" ? "major" : "no-issues", issues: letter === "A" ? [{ rule: "clarity", severity: "major", groupNumbers: [1], descriptionNumbers: [], evidenceQuote: "", explanation: "The title is easily misread.", quoteUnmatched: false }] : [] }),
      })),
    },
  ],
  judge: {
    promptVersion: "title-clarification-judge-test-v1",
    instructions: "You are a judging agent. Report problems for expert reviewers.",
    schema: { type: "json_schema", name: "title_clarification_judgment", strict: true },
    validationRules: "Software keeps a judgment only when it is well formed.",
    softwareChecks: "Software checks the initial verb and title length.",
  },
  execution: {
    runner: "Test runner",
    model: "Test judge model",
    runDate: "2026-09-16",
    method: "Each proposal was judged separately.",
    stability: "A second run changed few verdicts.",
    limitations: ["Development evidence only."],
  },
};

const option = (letter: string) => within(screen.getByTestId(`model-option-${letter}`));

describe("read-only four-model comparison with judging agent findings", () => {
  beforeEach(() => window.history.replaceState(null, "", "/title-model-comparison"));

  it("hides model names by default and reveals them only when asked", () => {
    render(<TitleModelComparison data={data} />);
    expect(screen.getByRole("heading", { level: 1, name: "Compare four models and the judging agent" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to review" })).toHaveAttribute("href", "/review");
    expect(screen.getByRole("link", { name: "Compare title prompts" })).toHaveAttribute("href", "/title-prompt-study");
    expect(screen.getByLabelText("Show model names")).not.toBeChecked();
    for (const letter of ["A", "B", "C", "D"])
      expect(option(letter).getByRole("heading", { level: 3 })).toHaveTextContent(new RegExp(`^Option ${letter}$`));
    expect(screen.queryByText(/GPT-[\d.]+ \w+ \((medium|Max) reasoning\)/)).toBeNull();
    expect(screen.getByRole("region", { name: "Option A" })).toBe(screen.getByTestId("model-option-A"));

    fireEvent.click(screen.getByLabelText("Show model names"));
    expect(option("A").getByRole("heading", { level: 3 })).toHaveTextContent("Option A · GPT-5.6 Sol (medium reasoning)");
    expect(option("B").getByRole("heading", { level: 3 })).toHaveTextContent("Option B · GPT-6 Astra (Max reasoning)");
    expect(screen.getByRole("region", { name: "Option A" })).toBeInTheDocument();
  });

  it("shows the findings overview by default, adds the per-model table only with names, and hides everything with the switch", () => {
    render(<TitleModelComparison data={data} />);
    expect(screen.getByLabelText("Show judging agent findings")).toBeChecked();
    expect(screen.getByRole("heading", { name: "Judging agent overview" })).toBeInTheDocument();
    expect(screen.getByText("Verdicts for all 8 proposals.", { exact: false })).toBeInTheDocument();
    expect(screen.getByTestId("verdict-count-prompt-violation")).toHaveTextContent("1Prompt violation");
    expect(screen.getByTestId("verdict-count-major")).toHaveTextContent("1Major issue");
    expect(screen.getByTestId("verdict-count-minor")).toHaveTextContent("1Minor issue");
    expect(screen.getByTestId("verdict-count-no-issues")).toHaveTextContent("3No issues found");
    expect(screen.getByTestId("verdict-count-unavailable")).toHaveTextContent("2Judgment unavailable");
    expect(screen.getByTestId("judge-run-line")).toHaveTextContent("Test runner · Test judge model · 2026-09-16");
    expect(screen.getByText("How the judging agent was run")).toBeInTheDocument();
    expect(screen.getByText("Development evidence only.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();

    fireEvent.click(screen.getByLabelText("Show model names"));
    const table = screen.getByRole("table", { name: "Judging agent findings by model" });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(5);
    expect(rows[0]).toHaveTextContent("Estimated generation cost for 2 examples");
    const solRow = within(table).getByRole("rowheader", { name: "GPT-5.6 Sol (medium reasoning)" }).closest("tr")!;
    expect(Array.from(solRow.querySelectorAll("td")).map((cell) => cell.textContent)).toEqual(["3", "1", "0", "0", "1", "0", "$0.40"]);
    const astraRow = within(table).getByRole("rowheader", { name: "GPT-6 Astra (Max reasoning)" }).closest("tr")!;
    expect(astraRow).toHaveTextContent("$2.02");

    fireEvent.click(screen.getByLabelText("Show judging agent findings"));
    expect(screen.queryByRole("heading", { name: "Judging agent overview" })).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryAllByTestId("verdict-chip")).toHaveLength(0);
    expect(screen.queryByRole("heading", { name: "Judging agent findings" })).toBeNull();
    expect(screen.queryByText("Judging agent: see findings")).toBeNull();
    expect(option("A").getByRole("heading", { name: "Inspect Workplace Safety" })).toBeInTheDocument();
  });

  it("labels each option with its verdict and explains unavailable judgments", () => {
    render(<TitleModelComparison data={data} />);
    const chip = (letter: string) => option(letter).getByTestId("verdict-chip");
    expect(chip("A")).toHaveTextContent("Prompt violation");
    expect(chip("A")).toHaveClass("MuiChip-colorError");
    expect(chip("B")).toHaveTextContent("Minor issue");
    expect(chip("B")).toHaveClass("MuiChip-colorInfo");
    expect(chip("C")).toHaveTextContent("Judgment unavailable");
    expect(chip("C")).toHaveClass("MuiChip-colorDefault");
    expect(chip("D")).toHaveTextContent("No issues found");
    expect(chip("D")).toHaveClass("MuiChip-colorSuccess");
    expect(option("C").getByText("No judgment was recorded.")).toBeInTheDocument();
    expect(option("D").getByText("No problems were found.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(option("A").getByTestId("verdict-chip")).toHaveTextContent("Major issue");
    expect(option("A").getByTestId("verdict-chip")).toHaveClass("MuiChip-colorWarning");
    expect(option("A").getByText("Unclear title")).toBeInTheDocument();
    expect(option("B").getByText("The model judge’s response did not pass validation and is not shown.")).toBeInTheDocument();
  });

  it("shows each finding with its cited group title, quote and explanation", () => {
    render(<TitleModelComparison data={data} />);
    const findings = within(screen.getByTestId("judge-findings-A"));
    expect(findings.getByRole("heading", { name: "Judging agent findings" })).toBeInTheDocument();
    expect(findings.getByText("Software check")).toBeInTheDocument();
    expect(findings.getByText("Initial verb changed")).toBeInTheDocument();
    expect(findings.getByText("Model judge")).toBeInTheDocument();
    expect(findings.getByText("Different or added activity")).toBeInTheDocument();
    expect(findings.getAllByText("Group 2: Inspect Workplace Safety")).toHaveLength(2);
    expect(findings.getByText("“workplace safety equipment”")).toBeInTheDocument();
    expect(findings.getByText("The title names safety inspection rather than measuring equipment.")).toBeInTheDocument();
    expect(findings.getByText("One group names a different activity.")).toBeInTheDocument();
    expect(findings.queryByText("The quoted words could not be matched exactly to a description.")).toBeNull();
    expect(within(screen.getByTestId("model-option-A-group-2")).getByText("Judging agent: see findings")).toBeInTheDocument();
    expect(within(screen.getByTestId("model-option-A-group-1")).queryByText("Judging agent: see findings")).toBeNull();

    const other = within(screen.getByTestId("judge-findings-B"));
    expect(other.getByText("Unsupported detail")).toBeInTheDocument();
    expect(other.getByText("Group 1: Measure Equipment Performance")).toBeInTheDocument();
    expect(other.getByText("The quoted words could not be matched exactly to a description.")).toBeInTheDocument();
    expect(option("A").getByText("1 software note")).toBeInTheDocument();
  });

  it("highlights a description across all options from group, finding and evidence controls", () => {
    render(<TitleModelComparison data={data} />);
    const select = screen.getByLabelText("Highlight description");
    expect(select).toHaveValue("");
    expect(screen.queryByTestId("highlighted-description")).toBeNull();
    const groupButton = screen.getByRole("button", { name: "Option A: highlight description 2" });
    expect(groupButton).toHaveAttribute("aria-pressed", "false");

    groupButton.focus();
    fireEvent.click(groupButton);
    expect(groupButton).toHaveAttribute("aria-pressed", "true");
    expect(document.activeElement).toBe(groupButton);
    expect(select).toHaveValue("2");
    expect(screen.getByTestId("highlighted-description")).toHaveTextContent("Inspect workplace safety equipment for defects.");
    expect(screen.getByTestId("model-option-A-group-2")).toHaveAttribute("data-highlighted", "true");
    expect(screen.getByTestId("model-option-A-group-1")).toHaveAttribute("data-highlighted", "false");
    expect(screen.getByTestId("model-option-C-group-2")).toHaveAttribute("data-highlighted", "true");
    expect(within(screen.getByTestId("model-option-A-group-2")).getByText("Contains description #2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Option A finding: highlight description 2" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Highlight #2" })).toHaveAttribute("aria-pressed", "true");
    const placement = within(screen.getByTestId("highlight-placement"));
    expect(placement.getByText("Inspect Workplace Safety")).toBeInTheDocument();
    expect(placement.getByText("Measure Instruments")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Highlight #3" }));
    expect(select).toHaveValue("3");
    expect(screen.getByTestId("model-option-A-group-1")).toHaveAttribute("data-highlighted", "true");
    expect(screen.getByTestId("model-option-A-group-2")).toHaveAttribute("data-highlighted", "false");

    fireEvent.click(screen.getByRole("button", { name: "Option B finding: highlight description 3" }));
    expect(select).toHaveValue("");
    expect(screen.getByTestId("model-option-A-group-1")).toHaveAttribute("data-highlighted", "false");

    fireEvent.change(select, { target: { value: "1" } });
    expect(screen.getByRole("button", { name: "Option D: highlight description 1" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(select, { target: { value: "" } });
    expect(screen.getByRole("button", { name: "Option D: highlight description 1" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Show all 3 descriptions")).toBeInTheDocument();
  });

  it("supports example links, title links, and previous/next navigation", () => {
    window.history.replaceState(null, "", "/title-model-comparison#case-2");
    const { unmount } = render(<TitleModelComparison data={data} />);
    expect(screen.getByRole("heading", { level: 2, name: "Stock Area" })).toBeInTheDocument();
    expect(screen.getByLabelText("Choose an example")).toHaveValue("case-2");
    expect(screen.getByText("2 of 2 examples")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Link to this example" })).toHaveAttribute("href", "#case-2");
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(window.location.hash).toBe("#case-1");
    expect(screen.getByRole("heading", { level: 2, name: "Measure Equipment" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Choose an example"), { target: { value: "case-2" } });
    expect(window.location.hash).toBe("#case-2");
    expect(screen.getByRole("heading", { level: 2, name: "Stock Area" })).toBeInTheDocument();
    unmount();

    window.history.replaceState(null, "", "/title-model-comparison?title=" + encodeURIComponent("Measure Equipment (Synonyms: Evaluate Equipment)"));
    render(<TitleModelComparison data={data} />);
    expect(screen.getByLabelText("Choose an example")).toHaveValue("case-1");
  });

  it("switches the single visible option on small screens", () => {
    render(<TitleModelComparison data={data} />);
    const group = screen.getByRole("group", { name: "Option on small screens" });
    const buttons = within(group).getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual(["A", "B", "C", "D"]);
    expect(within(group).getByRole("button", { name: "A" })).toHaveAttribute("aria-pressed", "true");
    // jsdom does not evaluate breakpoints, so check which option compact screens show.
    expect(screen.getByTestId("model-option-A")).toHaveAttribute("data-compact-selected", "true");
    expect(screen.getByTestId("model-option-C")).toHaveAttribute("data-compact-selected", "false");
    fireEvent.click(within(group).getByRole("button", { name: "C" }));
    expect(within(group).getByRole("button", { name: "C" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("model-option-A")).toHaveAttribute("data-compact-selected", "false");
    expect(screen.getByTestId("model-option-C")).toHaveAttribute("data-compact-selected", "true");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(
      within(screen.getByRole("group", { name: "Option on small screens" })).getByRole("button", { name: "C" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("stays read-only and never shows hashes or run identifiers", () => {
    const { container } = render(<TitleModelComparison data={data} />);
    fireEvent.click(screen.getByLabelText("Show model names"));
    expect(
      screen.queryAllByRole("button", { name: /agree|apply|submit|save|approve/i }),
    ).toHaveLength(0);
    expect(container.textContent).not.toMatch(/SHA-256|[a-f0-9]{64}|requestId|attempt/i);
    expect(screen.getByText("Exact title prompt and clarification")).toBeInTheDocument();
    expect(screen.getByText("Exact very short prompt")).toBeInTheDocument();
    expect(screen.getByTestId("wording-correction")).toHaveTextContent(
      "The prompt as received read “but the title is adequate”; the models received “but the title is inadequate”. B(ii) contradicts its own instruction.",
    );
    expect(screen.getByText("Judging agent instructions")).toBeInTheDocument();
    expect(screen.getByText(/"name": "title_clarification_judgment"/)).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
  });
});
