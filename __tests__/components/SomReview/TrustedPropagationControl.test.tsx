/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import TrustedPropagationControl from "../../../src/components/SomReview/TrustedPropagationControl";

describe("trusted propagation control", () => {
  it("starts in review-only mode and requires an explicit opt-in", () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <TrustedPropagationControl enabled={false} onChange={onChange} />,
    );

    expect(screen.getByText("Review only")).toBeInTheDocument();
    expect(screen.getByText(/separate batch application/i)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Trusted-reviewer fast path" }),
    );
    expect(onChange).toHaveBeenCalledWith(true);

    rerender(<TrustedPropagationControl enabled onChange={onChange} />);
    expect(screen.getByText("Fast path on")).toBeInTheDocument();
  });
});
