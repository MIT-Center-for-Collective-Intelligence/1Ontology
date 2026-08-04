/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import TrustedPropagationControl from "../../../src/components/SomReview/TrustedPropagationControl";

describe("continuous expert review control", () => {
  it("explains continuous review and lets the reviewer change navigation mode", () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <TrustedPropagationControl enabled={false} onChange={onChange} />,
    );

    expect(screen.getByText("Manual navigation")).toBeInTheDocument();
    expect(screen.getByText(/regeneration checkpoint/i)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Continuous expert review" }),
    );
    expect(onChange).toHaveBeenCalledWith(true);

    rerender(<TrustedPropagationControl enabled onChange={onChange} />);
    expect(screen.getByText("Continuous review on")).toBeInTheDocument();
  });
});
