/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import TitlePromptStudy, {
  TitlePromptStudyData,
} from "../../../src/components/SomReview/TitlePromptStudy";
jest.mock("../../../src/components/SomReview/ThemeModeToggle", () => () => (
  <button>Theme</button>
));
jest.mock("next/head", () => ({
  __esModule: true,
  default: ({ children }: any) => <>{children}</>,
}));

const data: TitlePromptStudyData = {
  version: "test-version",
  label: "Rob’s simple title prompt",
  explanation: "Exact supplied prompt; original development examples.",
  prompt: "Exact Rob prompt",
  outputFormat: "Return the numbered descriptions in the output format.",
  softwareChecks:
    "Coverage is checked by ordinary code; meaning is reviewed by people.",
  promptSha256: "prompt-hash",
  sourceSha256: "source-hash",
  collaborationUrl: "https://docs.google.com/document/d/example/edit",
  model: "gpt-6-astra",
  modelVersion: "2026-09-03",
  reasoning: "max",
  deployment: "gpt-6-astra-society-of-mind",
  funding: "ACCESS CIS261400 / CloudBank Azure",
  costs: {
    knownUsd: 0.7,
    unknownReservedUsd: 0.9,
    attempts: 3,
    totalTokens: 100,
  },
  cases: [
    {
      id: "case-1",
      title: "Stock Area",
      input: '{"title":"Stock Area"}',
      descriptions: [
        { number: 1, text: "Stock serving and dining areas." },
        { number: 2, text: "An unassigned original description." },
      ],
      groups: [
        {
          title: "Stock Serving Areas",
          descriptionNumbers: [1],
          reason: "Serving activity.",
        },
        {
          title: "Stock Dining Areas",
          descriptionNumbers: [1],
          reason: "Dining activity.",
        },
      ],
      reason: "Two proposed activities.",
      observations: ["Description 1 supports more than one proposed group."],
      rawOutput: '<script>alert("proposal")</script>',
      status: "completed",
      requestedAt: "2026-09-13T19:00:00Z",
      attemptId: "test-attempt",
      inputSha256: "input-hash",
      outputSha256: "output-hash",
    },
  ],
};
describe("read-only title prompt development examples", () => {
  beforeEach(() =>
    window.history.replaceState(null, "", "/title-prompt-study"),
  );
  it("retains original evidence and displays overlaps without making a policy decision", () => {
    render(<TitlePromptStudy data={data} />);
    expect(
      screen.getByRole("link", { name: "Link to this example" }),
    ).toHaveAttribute("href", "#case-1");
    expect(screen.getByLabelText("Choose a title")).toHaveValue("case-1");
    expect(
      screen.getByText("An unassigned original description."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("selected-description")).toHaveTextContent(
      "Stock serving and dining areas.",
    );
    expect(
      screen.getByText("Description 1 supports more than one proposed group."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: /agree|apply|submit|save judgment/i,
      }),
    ).not.toBeInTheDocument();
  });
  it("keeps the exact input, output and funding trace readable in each case", () => {
    const { container } = render(<TitlePromptStudy data={data} />);
    const trace = within(screen.getByTestId("prompt-study-trace"));
    expect(
      trace.getByText("Agents and prompts used for this proposal"),
    ).toBeInTheDocument();
    expect(trace.getByText(/reasoning: max/)).toBeInTheDocument();
    expect(trace.getByText(/ACCESS CIS261400/)).toBeInTheDocument();
    expect(trace.getByText(data.cases[0].input)).toBeInTheDocument();
    expect(trace.getByText(data.cases[0].rawOutput)).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
    expect(
      trace.queryByText(
        /SHA-256|test-attempt|source-hash|input-hash|output-hash/,
      ),
    ).not.toBeInTheDocument();
  });
  it("does not invent a proposal when a request failed", () => {
    render(
      <TitlePromptStudy
        data={{
          ...data,
          cases: [
            {
              ...data.cases[0],
              status: "failed",
              groups: [],
              reason: "",
              rawOutput: "",
            },
          ],
        }}
      />,
    );
    expect(
      screen.getByText(/did not produce a complete result/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Stock Serving Areas" }),
    ).toBeNull();
    expect(screen.getByText("No answer returned.")).toBeInTheDocument();
  });
  it("compares the selected description in both versions without altering memberships", () => {
    const item = {
      ...data.cases[0],
      previous: {
        groups: [
          {
            title: "Stock Both Areas",
            descriptionNumbers: [1, 2],
            reason: "One broader group.",
          },
        ],
        reason: "Broader.",
        trace: {
          title: "Previous instructions",
          summary: "Exact prior instructions",
          runtimeInputNote: "Recorded",
          stages: [],
        },
      },
    };
    render(<TitlePromptStudy data={{ ...data, cases: [item] }} />);
    fireEvent.change(screen.getByLabelText("Description number"), {
      target: { value: "2" },
    });
    expect(screen.getByTestId("selected-description")).toHaveTextContent(
      "An unassigned original description.",
    );
    expect(
      screen.getByText("No group includes this description."),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("switch", {
        name: /Show only groups containing description #2/,
      }),
    );
    expect(
      screen.getByRole("heading", { name: "Stock Both Areas" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Stock Serving Areas" }),
    ).toBeNull();
    expect(item.groups[0].descriptionNumbers).toEqual([1]);
    expect(item.groups[1].descriptionNumbers).toEqual([1]);
  });
  it("supports direct example links, next/previous navigation and evidence search", () => {
    const cases = [
      data.cases[0],
      { ...data.cases[0], id: "case-2", title: "Second Title" },
    ];
    window.history.replaceState(null, "", "/title-prompt-study#case-2");
    render(<TitlePromptStudy data={{ ...data, cases }} />);
    expect(
      screen.getByRole("heading", { name: "Second Title" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(window.location.hash).toBe("#case-1");
    expect(
      screen.getByRole("heading", { name: "Stock Area" }),
    ).toBeInTheDocument();
    fireEvent.change(
      screen.getByLabelText("Find a description by wording or number"),
      { target: { value: "#2" } },
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "1 of 2 descriptions shown",
    );
    fireEvent.click(screen.getByRole("button", { name: "Compare #2" }));
    expect(screen.getByLabelText("Description number")).toHaveValue("2");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByLabelText("Description number")).toHaveValue("1");
    expect(
      screen.getByLabelText("Find a description by wording or number"),
    ).toHaveValue("");
  });
});
