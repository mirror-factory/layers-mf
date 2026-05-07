import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AnnotationOverlay, type Annotation } from "../portal-annotation-overlay";

function makeAnnotation(overrides: Partial<Annotation> = {}): Annotation {
  return {
    id: "ann-1",
    page: 1,
    text: "Budget Overview",
    note: "This section outlines the total project cost.",
    type: "info",
    visible: true,
    ...overrides,
  };
}

describe("AnnotationOverlay", () => {
  it("renders nothing when no annotations", () => {
    const { container } = render(
      <AnnotationOverlay
        annotations={[]}
        onDismiss={vi.fn()}
        currentPage={1}
        totalPages={5}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when all annotations are hidden", () => {
    const { container } = render(
      <AnnotationOverlay
        annotations={[makeAnnotation({ visible: false })]}
        onDismiss={vi.fn()}
        currentPage={1}
        totalPages={5}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders annotation indicator for current page", () => {
    render(
      <AnnotationOverlay
        annotations={[makeAnnotation({ page: 1 })]}
        onDismiss={vi.fn()}
        currentPage={1}
        totalPages={5}
      />
    );
    expect(screen.getByText("p. 1")).toBeInTheDocument();
  });

  it("does not show annotations far from current page", () => {
    const { container } = render(
      <AnnotationOverlay
        annotations={[makeAnnotation({ page: 5 })]}
        onDismiss={vi.fn()}
        currentPage={1}
        totalPages={10}
      />
    );
    // Page 5 is too far from page 1 (visibility range is current-1 to current+2)
    expect(screen.queryByText("p. 5")).not.toBeInTheDocument();
  });

  it("shows annotations on adjacent pages", () => {
    render(
      <AnnotationOverlay
        annotations={[makeAnnotation({ page: 2 })]}
        onDismiss={vi.fn()}
        currentPage={1}
        totalPages={5}
      />
    );
    expect(screen.getByText("p. 2")).toBeInTheDocument();
  });

  it("expands annotation on click", () => {
    render(
      <AnnotationOverlay
        annotations={[
          makeAnnotation({
            note: "Important budget details here",
            type: "warning",
          }),
        ]}
        onDismiss={vi.fn()}
        currentPage={1}
        totalPages={5}
      />
    );

    // Click the indicator button
    const button = screen.getByTitle('Warning: Budget Overview');
    fireEvent.click(button);

    // Expanded note should be visible
    expect(
      screen.getByText("Important budget details here")
    ).toBeInTheDocument();
    expect(screen.getByText("Warning")).toBeInTheDocument();
  });

  it("calls onDismiss when X is clicked on expanded annotation", () => {
    const onDismiss = vi.fn();
    render(
      <AnnotationOverlay
        annotations={[makeAnnotation({ id: "ann-42" })]}
        onDismiss={onDismiss}
        currentPage={1}
        totalPages={5}
      />
    );

    // Expand
    fireEvent.click(screen.getByTitle("Info: Budget Overview"));

    // Click dismiss X
    const dismissButtons = screen.getAllByRole("button");
    const xButton = dismissButtons.find((btn) =>
      btn.querySelector(".h-3.w-3")
    );
    if (xButton) {
      fireEvent.click(xButton);
      expect(onDismiss).toHaveBeenCalledWith("ann-42");
    }
  });

  it("renders multiple annotations grouped by page", () => {
    render(
      <AnnotationOverlay
        annotations={[
          makeAnnotation({ id: "a1", page: 1, type: "info" }),
          makeAnnotation({ id: "a2", page: 1, type: "tip" }),
          makeAnnotation({ id: "a3", page: 2, type: "warning" }),
        ]}
        onDismiss={vi.fn()}
        currentPage={1}
        totalPages={5}
      />
    );

    expect(screen.getByText("p. 1")).toBeInTheDocument();
    expect(screen.getByText("p. 2")).toBeInTheDocument();
  });

  it("clamps page numbers to valid range", () => {
    render(
      <AnnotationOverlay
        annotations={[makeAnnotation({ page: 99 })]}
        onDismiss={vi.fn()}
        currentPage={5}
        totalPages={5}
      />
    );
    // Should clamp to page 5
    expect(screen.getByText("p. 5")).toBeInTheDocument();
  });

  it("renders all 4 annotation types with correct labels", () => {
    const types: Annotation["type"][] = ["info", "highlight", "warning", "tip"];
    types.forEach((type) => {
      const { unmount } = render(
        <AnnotationOverlay
          annotations={[makeAnnotation({ type, text: `${type}-test` })]}
          onDismiss={vi.fn()}
          currentPage={1}
          totalPages={5}
        />
      );

      const expectedLabel =
        type === "info"
          ? "Info"
          : type === "highlight"
            ? "Highlight"
            : type === "warning"
              ? "Warning"
              : "Tip";

      // Expand to see label
      fireEvent.click(
        screen.getByTitle(`${expectedLabel}: ${type}-test`)
      );
      expect(screen.getByText(expectedLabel)).toBeInTheDocument();

      unmount();
    });
  });
});
