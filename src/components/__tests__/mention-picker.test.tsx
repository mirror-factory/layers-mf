import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MentionPicker, type MentionPickerProps } from "../mention-picker";

// ---------------------------------------------------------------------------
// Mock ResizeObserver (not available in jsdom, required by cmdk)
// ---------------------------------------------------------------------------

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

beforeEach(() => {
  // @ts-expect-error - mock browser API
  globalThis.ResizeObserver = MockResizeObserver;
});

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const mockMembers = [
  { id: "u1", name: "Alice Smith", email: "alice@example.com" },
  { id: "u2", name: "Bob Jones", email: "bob@example.com" },
  { id: "u3", name: "Charlie Brown", email: "charlie@example.com" },
];

const mockItems = [
  { id: "i1", type: "document", title: "Project Roadmap" },
  { id: "i2", type: "artifact", title: "API Schema" },
  { id: "i3", type: "conversation", title: "Design Review Chat" },
];

function mockFetchSuccess() {
  global.fetch = vi.fn((url: string | URL | Request) => {
    const urlStr = typeof url === "string" ? url : url.toString();
    if (urlStr.includes("/api/team/members")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ members: mockMembers }),
      } as Response);
    }
    if (urlStr.includes("/api/context")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ items: mockItems }),
      } as Response);
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    } as Response);
  });
}

function mockFetchEmpty() {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ members: [], items: [] }),
    } as Response)
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultProps: MentionPickerProps = {
  open: true,
  onClose: vi.fn(),
  onSelectUser: vi.fn(),
  onSelectItem: vi.fn(),
  query: "",
  orgId: "org-123",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MentionPicker", () => {
  beforeEach(() => {
    mockFetchSuccess();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---- Rendering ----

  it("renders People and Library tabs", async () => {
    render(<MentionPicker {...defaultProps} />);
    expect(screen.getByText("People")).toBeInTheDocument();
    expect(screen.getByText("Library")).toBeInTheDocument();
  });

  it("returns null when not open", () => {
    const { container } = render(
      <MentionPicker {...defaultProps} open={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders with absolute positioning from position prop", () => {
    render(
      <MentionPicker
        {...defaultProps}
        position={{ top: 100, left: 200 }}
      />
    );
    const picker = screen.getByTestId("mention-picker");
    expect(picker.style.top).toBe("100px");
    expect(picker.style.left).toBe("200px");
  });

  // ---- People tab ----

  it("shows org members in People tab", async () => {
    render(<MentionPicker {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
    expect(screen.getByText("Charlie Brown")).toBeInTheDocument();
  });

  it("displays avatar placeholder with first letter of name", async () => {
    render(<MentionPicker {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("A")).toBeInTheDocument();
    });
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.getByText("C")).toBeInTheDocument();
  });

  it("filters people by query (name match)", async () => {
    render(<MentionPicker {...defaultProps} query="alice" />);

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });
    expect(screen.queryByText("Bob Jones")).not.toBeInTheDocument();
  });

  it("filters people by query (email match)", async () => {
    render(<MentionPicker {...defaultProps} query="bob@" />);

    await waitFor(() => {
      expect(screen.getByText("Bob Jones")).toBeInTheDocument();
    });
    expect(screen.queryByText("Alice Smith")).not.toBeInTheDocument();
  });

  it("calls onSelectUser when person clicked", async () => {
    const onSelectUser = vi.fn();
    render(
      <MentionPicker {...defaultProps} onSelectUser={onSelectUser} />
    );

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Alice Smith"));

    expect(onSelectUser).toHaveBeenCalledWith({
      id: "u1",
      name: "Alice Smith",
      email: "alice@example.com",
    });
  });

  it("closes after selecting a person", async () => {
    const onClose = vi.fn();
    render(<MentionPicker {...defaultProps} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Alice Smith"));
    expect(onClose).toHaveBeenCalled();
  });

  // ---- Library tab ----

  it("shows library items when Library tab is clicked", async () => {
    render(<MentionPicker {...defaultProps} />);

    fireEvent.click(screen.getByText("Library"));

    await waitFor(() => {
      expect(screen.getByText("Project Roadmap")).toBeInTheDocument();
    });
    expect(screen.getByText("API Schema")).toBeInTheDocument();
    expect(screen.getByText("Design Review Chat")).toBeInTheDocument();
  });

  it("calls onSelectItem when library item clicked", async () => {
    const onSelectItem = vi.fn();
    render(
      <MentionPicker {...defaultProps} onSelectItem={onSelectItem} />
    );

    fireEvent.click(screen.getByText("Library"));

    await waitFor(() => {
      expect(screen.getByText("Project Roadmap")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Project Roadmap"));

    expect(onSelectItem).toHaveBeenCalledWith({
      id: "i1",
      type: "document",
      title: "Project Roadmap",
    });
  });

  it("shows My Items and Shared with me toggles in Library tab", async () => {
    render(<MentionPicker {...defaultProps} />);

    fireEvent.click(screen.getByText("Library"));

    expect(screen.getByText("My Items")).toBeInTheDocument();
    expect(screen.getByText("Shared with me")).toBeInTheDocument();
  });

  it("switches library scope when Shared with me is clicked", async () => {
    render(<MentionPicker {...defaultProps} />);

    fireEvent.click(screen.getByText("Library"));
    fireEvent.click(screen.getByText("Shared with me"));

    // Should re-fetch with scope=shared
    await waitFor(() => {
      const fetchCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
      const contextCalls = fetchCalls.filter(
        (c: [string | URL | Request]) =>
          typeof c[0] === "string" && c[0].includes("/api/context")
      );
      const hasSharedScope = contextCalls.some(
        (c: [string]) => c[0].includes("scope=shared")
      );
      expect(hasSharedScope).toBe(true);
    });
  });

  // ---- Escape ----

  it("closes on Escape key", () => {
    const onClose = vi.fn();
    render(<MentionPicker {...defaultProps} onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalled();
  });

  // ---- Empty state ----

  it("shows empty state when no people match", async () => {
    mockFetchEmpty();
    render(<MentionPicker {...defaultProps} query="nonexistent" />);

    await waitFor(() => {
      expect(screen.getByText("No people found.")).toBeInTheDocument();
    });
  });

  it("shows empty state when no library items match", async () => {
    mockFetchEmpty();
    render(<MentionPicker {...defaultProps} query="nonexistent" />);

    fireEvent.click(screen.getByText("Library"));

    await waitFor(() => {
      expect(screen.getByText("No items found.")).toBeInTheDocument();
    });
  });
});
