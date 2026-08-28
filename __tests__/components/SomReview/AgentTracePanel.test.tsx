/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import AgentTracePanel from "../../../src/components/SomReview/AgentTracePanel";
import { SomAgentTrace } from "../../../src/types/ISomReview";

const trace: SomAgentTrace = {
  title: "How the system produced this proposal",
  summary: "Open this only when a proposal seems unclear.",
  runtimeInputNote: "Runtime inputs are represented by placeholders.",
  stages: [
    {
      id: "issue-detection",
      sequence: 1,
      role: "issue-detection",
      roleLabel: "Detect the issue",
      actorId: "title-evidence-agent",
      actorName: "Title-evidence agent",
      actorKind: "model",
      actorKindLabel: "Model agent",
      summary: "Checks whether the title is unclear.",
      promptVersion: "ontology-review-v5",
      promptLabel: "Prompt template",
      prompt: "Compare the title with its source evidence.",
      promptDisclosureNote: "Runtime inputs are omitted.",
      sharedExecutionId: "detector-run",
    },
    {
      id: "solution-generation",
      sequence: 2,
      role: "solution-generation",
      roleLabel: "Develop a possible solution",
      actorId: "title-evidence-agent",
      actorName: "Title-evidence agent",
      actorKind: "model",
      actorKindLabel: "Model agent",
      summary: "Proposes a clearer title.",
      promptVersion: "ontology-review-v5",
      promptLabel: "Prompt template",
      prompt: "Propose the smallest evidence-grounded title change.",
      sharedExecutionId: "detector-run",
      sharedExecutionNote:
        "Detection and solution generation share one model call.",
    },
  ],
};

describe("AgentTracePanel", () => {
  it("keeps pipeline detail optional and expands each prompt independently", () => {
    render(<AgentTracePanel trace={trace} />);

    expect(screen.queryByText("Detect the issue")).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: /How the system produced this proposal/i,
      }),
    );

    expect(screen.getByText(/Detect the issue/)).toBeInTheDocument();
    expect(screen.getAllByText("Shared execution")).toHaveLength(2);
    expect(
      screen.getByText(
        "Detection and solution generation share one model call.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Compare the title with its source evidence."),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getAllByRole("button", { name: "View prompt template" })[0],
    );
    expect(
      screen.getByText("Compare the title with its source evidence."),
    ).toBeInTheDocument();
    expect(screen.getByText("Version: ontology-review-v5")).toBeInTheDocument();
    expect(screen.getByText("Runtime inputs are omitted.")).toBeInTheDocument();
  });

  it("uses instance-unique IDs when several proposal traces share a page", () => {
    render(
      <>
        <AgentTracePanel trace={trace} />
        <AgentTracePanel trace={trace} />
      </>,
    );

    const panelButtons = screen.getAllByRole("button", {
      name: /How the system produced this proposal/i,
    });
    expect(panelButtons[0].getAttribute("aria-controls")).not.toBe(
      panelButtons[1].getAttribute("aria-controls"),
    );
    fireEvent.click(panelButtons[0]);
    fireEvent.click(panelButtons[1]);

    const promptButtons = screen.getAllByRole("button", {
      name: "View prompt template",
    });
    const controlledIds = promptButtons.map((button) =>
      button.getAttribute("aria-controls"),
    );
    expect(new Set(controlledIds).size).toBe(controlledIds.length);
  });
});
