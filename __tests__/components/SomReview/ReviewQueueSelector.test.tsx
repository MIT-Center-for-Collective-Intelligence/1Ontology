/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import ReviewQueueSelector from "../../../src/components/SomReview/ReviewQueueSelector";
import { SomIssueTypeOption } from "../../../src/types/ISomReview";

const issues: SomIssueTypeOption[] = [
  {
    id: "title-clarity",
    label: "Title clarity",
    total: 47,
    pending: 37,
    enabled: true,
    activeSession: { cursor: 3, total: 10 },
  },
  {
    id: "sibling-grouping",
    label: "Sibling grouping",
    total: 3,
    pending: 3,
    enabled: true,
  },
  {
    id: "duplicate-synonym",
    label: "Duplicate or synonym",
    total: 0,
    pending: 0,
    enabled: true,
  },
  {
    id: "placement",
    label: "Placement",
    total: 16,
    pending: 16,
    enabled: true,
  },
  {
    id: "structural-overlap",
    label: "Structural overlap",
    total: 2,
    pending: 0,
    enabled: true,
  },
  {
    id: "wrong-verb",
    label: "Wrong main verb",
    total: 7,
    pending: 7,
    enabled: true,
  },
  {
    id: "node-merge",
    label: "Merge nodes",
    total: 3,
    pending: 3,
    enabled: true,
  },
  {
    id: "relocation",
    label: "Exact relocation",
    total: 0,
    pending: 0,
    enabled: true,
  },
  {
    id: "missing-activity",
    label: "Missing activity",
    total: 10,
    pending: 10,
    enabled: true,
  },
  {
    id: "redundant-node",
    label: "Redundant node",
    total: 1,
    pending: 1,
    enabled: true,
  },
];

describe("Society of Mind review queue selector", () => {
  it("shows all ten issue types and their availability", () => {
    render(<ReviewQueueSelector issueTypes={issues} onStart={jest.fn()} />);
    for (const issue of issues) {
      expect(screen.getByText(issue.label)).toBeInTheDocument();
    }
    expect(screen.getByText("Resume 4 of 10")).toBeInTheDocument();
    expect(screen.getAllByText("No items")).toHaveLength(2);
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("starts available queues and disables empty queues", () => {
    const onStart = jest.fn();
    render(<ReviewQueueSelector issueTypes={issues} onStart={onStart} />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Start Placement review, 16 remaining",
      }),
    );
    expect(onStart).toHaveBeenCalledWith("placement");
    expect(
      screen.getByRole("button", {
        name: "Duplicate or synonym, no review items available",
      }),
    ).toBeDisabled();
  });

  it("shows the deliberation entry only for authorized reviewers", () => {
    const { rerender } = render(
      <ReviewQueueSelector issueTypes={issues} onStart={jest.fn()} />,
    );
    expect(
      screen.queryByRole("button", { name: "Group deliberation" }),
    ).not.toBeInTheDocument();

    const onOpenDeliberation = jest.fn();
    rerender(
      <ReviewQueueSelector
        issueTypes={issues}
        onStart={jest.fn()}
        canDeliberate
        onOpenDeliberation={onOpenDeliberation}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Group deliberation" }));
    expect(onOpenDeliberation).toHaveBeenCalledTimes(1);
  });
});
