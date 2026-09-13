/** @jest-environment jsdom */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import TitlePromptStudy, { TitlePromptStudyData } from "../../../src/components/SomReview/TitlePromptStudy";
jest.mock("../../../src/components/SomReview/ThemeModeToggle", () => () => <button>Theme</button>);
jest.mock("next/head", () => ({ __esModule: true, default: ({ children }: any) => <>{children}</> }));

const data: TitlePromptStudyData = {
  version: "test-version", label: "Rob’s simple title prompt", explanation: "Exact supplied prompt; original development examples.",
  prompt: "Exact Rob prompt", outputFormat: "Return the numbered descriptions in the output format.",
  softwareChecks: "Coverage is checked by ordinary code; meaning is reviewed by people.",
  promptSha256: "prompt-hash", sourceSha256: "source-hash", collaborationUrl: "https://docs.google.com/document/d/example/edit",
  model: "gpt-6-astra", modelVersion: "2026-09-03", reasoning: "max", deployment: "gpt-6-astra-society-of-mind",
  funding: "ACCESS CIS261400 / CloudBank Azure", costs: { knownUsd: 0.7, unknownReservedUsd: 0.9, attempts: 3, totalTokens: 100 },
  cases: [{ id: "case-1", title: "Stock Area", input: '{"title":"Stock Area"}',
    descriptions: [{number:1,text:"Stock serving and dining areas."},{number:2,text:"An unassigned original description."}],
    groups: [{ title:"Stock Serving Areas",descriptionNumbers:[1],reason:"Serving activity." },
      { title:"Stock Dining Areas",descriptionNumbers:[1],reason:"Dining activity." }],
    reason: "Two proposed activities.", observations: ["Description 1 supports more than one proposed group."],
    rawOutput: '<script>alert("proposal")</script>', status: "completed", requestedAt: "2026-09-13T19:00:00Z",
    attemptId: "test-attempt", inputSha256: "input-hash", outputSha256: "output-hash" }],
};
describe("read-only title prompt development examples", () => {
  it("retains original evidence and displays overlaps without making a policy decision", () => {
    render(<TitlePromptStudy data={data} />);
    expect(screen.getByRole("link", {name:"Stock Area"})).toHaveAttribute("href", "#case-1");
    expect(screen.getByText("An unassigned original description.")).toBeInTheDocument();
    expect(screen.getAllByText("Stock serving and dining areas.")).toHaveLength(3);
    expect(screen.getByText("Description 1 supports more than one proposed group.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /agree|apply|submit|save judgment/i })).not.toBeInTheDocument();
  });
  it("keeps the exact input, output and funding trace readable in each case", () => {
    const { container } = render(<TitlePromptStudy data={data} />);
    const trace = within(screen.getByTestId("prompt-study-trace"));
    expect(trace.getByText("Agents and prompts used for this proposal")).toBeInTheDocument();
    expect(trace.getByText(/reasoning: max/)).toBeInTheDocument();
    expect(trace.getByText(/ACCESS CIS261400/)).toBeInTheDocument();
    expect(trace.getByText(data.cases[0].input)).toBeInTheDocument();
    expect(trace.getByText(data.cases[0].rawOutput)).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
    expect(trace.getByText(/Ontology source SHA-256: source-hash/)).toBeInTheDocument();
  });
  it("does not invent a proposal when a request failed", () => {
    render(<TitlePromptStudy data={{...data,cases:[{...data.cases[0],status:"failed",groups:[],reason:"",rawOutput:""}]}} />);
    expect(screen.getByText(/did not produce a complete result/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", {name:"Stock Serving Areas"})).toBeNull();
    expect(screen.getByText("No answer returned.")).toBeInTheDocument();
  });
});
