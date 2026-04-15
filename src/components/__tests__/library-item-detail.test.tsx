import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LibraryItemDetail } from "../library-item-detail";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const MOCK_ITEM = {
  id: "item-1",
  title: "Architecture Overview",
  source_type: "document",
  content_type: "document",
  raw_content: "This is the architecture overview document. ".repeat(20), // > 500 chars
  created_at: "2026-01-15T10:00:00Z",
  updated_at: "2026-04-10T14:30:00Z",
  user_tags: ["architecture", "engineering"],
  category: "engineering",
  source_url: "https://example.com/doc",
  embedded: true,
  embedding_model: "text-embedding-3-small",
};

const MOCK_ARTIFACT_ITEM = {
  ...MOCK_ITEM,
  id: "item-2",
  title: "API Handler Code",
  source_type: "artifact",
  user_tags: ["backend", "api"],
};

const MOCK_INTERACTIONS = [
  {
    id: "ix-1",
    action: "viewed",
    user_email: "alice@example.com",
    created_at: "2026-04-10T12:00:00Z",
  },
  {
    id: "ix-2",
    action: "edited",
    user_email: "bob@example.com",
    created_at: "2026-04-09T09:00:00Z",
  },
];

const MOCK_SHARES = [
  {
    id: "sh-1",
    user_email: "carol@example.com",
    permission: "read",
    created_at: "2026-03-01T00:00:00Z",
  },
  {
    id: "sh-2",
    user_email: "dave@example.com",
    permission: "write",
    created_at: "2026-03-15T00:00:00Z",
  },
];

function setupFetchMocks(
  item = MOCK_ITEM,
  interactions: unknown[] = [],
  shares: unknown[] = []
) {
  mockFetch.mockImplementation(async (url: string) => {
    if (url.includes("/interactions")) {
      return { ok: true, json: async () => ({ interactions }) };
    }
    if (url.includes("/shares")) {
      return { ok: true, json: async () => ({ shares }) };
    }
    if (url.includes("/embed")) {
      return { ok: true, json: async () => ({}) };
    }
    if (url.includes("/api/context/")) {
      // Could be GET or PATCH
      return { ok: true, json: async () => item };
    }
    return { ok: false, status: 404 };
  });
}

describe("LibraryItemDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading skeleton while fetching", () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
    render(<LibraryItemDetail itemId="item-1" onClose={vi.fn()} />);

    expect(screen.getByTestId("detail-loading")).toBeInTheDocument();
  });

  it("renders item header with title and metadata", async () => {
    setupFetchMocks();
    render(<LibraryItemDetail itemId="item-1" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("detail-header")).toBeInTheDocument();
    });

    expect(screen.getByText("Architecture Overview")).toBeInTheDocument();
    expect(screen.getByText("Document")).toBeInTheDocument();
  });

  it("shows content preview truncated to 500 chars", async () => {
    setupFetchMocks();
    render(<LibraryItemDetail itemId="item-1" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("content-preview")).toBeInTheDocument();
    });

    // The content should be truncated
    expect(screen.getByText(/more chars/)).toBeInTheDocument();
  });

  it("renders metadata section with tags", async () => {
    setupFetchMocks();
    render(<LibraryItemDetail itemId="item-1" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("metadata-section")).toBeInTheDocument();
    });

    expect(screen.getByText("architecture")).toBeInTheDocument();
    expect(screen.getByText("engineering")).toBeInTheDocument();
  });

  it("renders embedding section with embedded status", async () => {
    setupFetchMocks();
    render(<LibraryItemDetail itemId="item-1" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("embedding-section")).toBeInTheDocument();
    });

    expect(screen.getByText("Embedded")).toBeInTheDocument();
    expect(screen.getByText("text-embedding-3-small")).toBeInTheDocument();
    expect(screen.getByTestId("re-embed-button")).toBeInTheDocument();
  });

  it("renders not-embedded badge when item is not embedded", async () => {
    setupFetchMocks({ ...MOCK_ITEM, embedded: false, embedding_model: null });
    render(<LibraryItemDetail itemId="item-1" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Not embedded")).toBeInTheDocument();
    });
  });

  it("renders sharing section", async () => {
    setupFetchMocks(MOCK_ITEM, [], MOCK_SHARES);
    render(<LibraryItemDetail itemId="item-1" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("sharing-section")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText("carol@example.com")).toBeInTheDocument();
    });

    expect(screen.getByText("dave@example.com")).toBeInTheDocument();
    expect(screen.getByTestId("share-button")).toBeInTheDocument();
  });

  it("shows 'Not shared' when no shares exist", async () => {
    setupFetchMocks(MOCK_ITEM, [], []);
    render(<LibraryItemDetail itemId="item-1" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Not shared with anyone")).toBeInTheDocument();
    });
  });

  it("editable title: entering edit mode and saving", async () => {
    setupFetchMocks();
    render(<LibraryItemDetail itemId="item-1" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("editable-title")).toBeInTheDocument();
    });

    // Click to edit
    fireEvent.click(screen.getByTestId("editable-title"));

    const input = screen.getByTestId("title-input");
    expect(input).toBeInTheDocument();

    // Change value
    fireEvent.change(input, { target: { value: "New Title" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // Should have called PATCH
    await waitFor(() => {
      const patchCalls = mockFetch.mock.calls.filter(
        (call: unknown[]) =>
          typeof call[0] === "string" &&
          call[0].includes("/api/context/item-1") &&
          (call[1] as RequestInit)?.method === "PATCH"
      );
      expect(patchCalls.length).toBeGreaterThan(0);
    });
  });

  it("editable title: escape cancels editing", async () => {
    setupFetchMocks();
    render(<LibraryItemDetail itemId="item-1" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("editable-title")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("editable-title"));

    const input = screen.getByTestId("title-input");
    fireEvent.change(input, { target: { value: "Should Not Save" } });
    fireEvent.keyDown(input, { key: "Escape" });

    // Should NOT have called PATCH for title
    const patchCalls = mockFetch.mock.calls.filter(
      (call: unknown[]) =>
        typeof call[0] === "string" &&
        (call[1] as RequestInit)?.method === "PATCH"
    );
    expect(patchCalls.length).toBe(0);
  });

  it("shows interaction history for artifact items", async () => {
    setupFetchMocks(MOCK_ARTIFACT_ITEM, MOCK_INTERACTIONS, []);
    render(<LibraryItemDetail itemId="item-2" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("interaction-history")).toBeInTheDocument();
    });

    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("viewed")).toBeInTheDocument();
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
    expect(screen.getByText("edited")).toBeInTheDocument();
  });

  it("shows version history link for artifact items", async () => {
    setupFetchMocks(MOCK_ARTIFACT_ITEM, [], []);
    render(<LibraryItemDetail itemId="item-2" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("version-history")).toBeInTheDocument();
    });

    expect(screen.getByText("View versions")).toBeInTheDocument();
  });

  it("does not show version history for non-artifact items", async () => {
    setupFetchMocks(MOCK_ITEM, [], []);
    render(<LibraryItemDetail itemId="item-1" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("metadata-section")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("version-history")).not.toBeInTheDocument();
  });

  it("calls onClose when sheet is closed", async () => {
    setupFetchMocks();
    const onClose = vi.fn();
    render(<LibraryItemDetail itemId="item-1" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByTestId("detail-header")).toBeInTheDocument();
    });

    // Find the Sheet close button (X button from SheetContent)
    const closeButtons = screen.getAllByRole("button");
    const sheetClose = closeButtons.find(
      (btn) => btn.querySelector(".sr-only")?.textContent === "Close"
    );
    if (sheetClose) {
      fireEvent.click(sheetClose);
      expect(onClose).toHaveBeenCalled();
    }
  });

  it("shows error state on fetch failure", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    render(<LibraryItemDetail itemId="item-1" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Failed to fetch: 500")).toBeInTheDocument();
    });

    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("can add a tag", async () => {
    setupFetchMocks();
    render(<LibraryItemDetail itemId="item-1" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("add-tag-button")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("add-tag-button"));

    const tagInput = screen.getByTestId("new-tag-input");
    fireEvent.change(tagInput, { target: { value: "newtag" } });
    fireEvent.keyDown(tagInput, { key: "Enter" });

    // Should have sent a PATCH with updated tags
    await waitFor(() => {
      const patchCalls = mockFetch.mock.calls.filter(
        (call: unknown[]) =>
          typeof call[0] === "string" &&
          (call[1] as RequestInit)?.method === "PATCH"
      );
      expect(patchCalls.length).toBeGreaterThan(0);
    });
  });

  it("can remove a tag", async () => {
    setupFetchMocks();
    render(<LibraryItemDetail itemId="item-1" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("architecture")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("remove-tag-architecture"));

    await waitFor(() => {
      const patchCalls = mockFetch.mock.calls.filter(
        (call: unknown[]) =>
          typeof call[0] === "string" &&
          (call[1] as RequestInit)?.method === "PATCH"
      );
      expect(patchCalls.length).toBeGreaterThan(0);
    });
  });

  it("re-embed button triggers POST request", async () => {
    setupFetchMocks();
    render(<LibraryItemDetail itemId="item-1" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("re-embed-button")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("re-embed-button"));

    await waitFor(() => {
      const embedCalls = mockFetch.mock.calls.filter(
        (call: unknown[]) =>
          typeof call[0] === "string" &&
          (call[0] as string).includes("/embed") &&
          (call[1] as RequestInit)?.method === "POST"
      );
      expect(embedCalls.length).toBe(1);
    });
  });
});
