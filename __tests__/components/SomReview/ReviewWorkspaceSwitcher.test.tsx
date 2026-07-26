/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import ReviewWorkspaceSwitcher from "../../../src/components/SomReview/ReviewWorkspaceSwitcher";
import { SomReviewWorkspaceOption } from "../../../src/types/ISomReview";

const workspaces: SomReviewWorkspaceOption[] = [
  {
    id: "buy",
    label: "Buy",
    activeDatasetId: "buy-current",
    rounds: [
      {
        id: "buy-current",
        datasetVersion: "buy-v2",
        label: "Current Buy round",
        current: true,
      },
      {
        id: "buy-original",
        datasetVersion: "buy-v1",
        label: "Initial Buy round",
        current: false,
      },
    ],
  },
  {
    id: "sell",
    label: "Sell",
    activeDatasetId: "sell-current",
    rounds: [
      {
        id: "sell-current",
        datasetVersion: "sell-v2",
        label: "Current Sell round",
        current: true,
      },
    ],
  },
];

describe("review workspace switcher", () => {
  it("switches to the active round of another sub-ontology", () => {
    const onChange = jest.fn();
    render(
      <ReviewWorkspaceSwitcher
        workspaces={workspaces}
        workspaceId="buy"
        datasetId="buy-current"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sell sub-ontology" }));
    expect(onChange).toHaveBeenCalledWith("sell-current");
  });

  it("opens a past round in the selected workspace", () => {
    const onChange = jest.fn();
    render(
      <ReviewWorkspaceSwitcher
        workspaces={workspaces}
        workspaceId="buy"
        datasetId="buy-current"
        onChange={onChange}
      />,
    );

    fireEvent.mouseDown(screen.getByLabelText("Review round"));
    fireEvent.click(screen.getByRole("option", { name: "Initial Buy round" }));

    expect(onChange).toHaveBeenCalledWith("buy-original");
    expect(screen.getByText("Current hierarchy")).toBeInTheDocument();
  });
});
