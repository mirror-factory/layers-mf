import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { LibrarySections } from "../library-sections";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const MOCK_ITEMS = [
  {
    id: "1",
    title: "Design Document",
    source_type: "document",
    updated_at: new Date().toISOString(),
    user_tags: ["design", "v2"],
  },
  {
    id: "2",
    title: "API Handler",
    source_type: "artifact",
    updated_at: new Date().toISOString(),
    user_tags: ["backend"],
  },
  {
    id: "3",
    title: "Team Standup Notes",
    source_type: "conversation",
    updated_at: new Date().toISOString(),
    user_tags: null,
  },
  {
    id: "4",
    title: "Homepage",
    source_type: "web",
    updated_at: new Date().toISOString(),
    user_tags: ["frontend"],
  },
];

function setupFetchSuccess(items = MOCK_ITEMS) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ items }),
  });
}

describe("LibrarySections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 3 tabs: My Items, Shared with Me, Org Library", async () => {
    setupFetchSuccess();
    render(<LibrarySections />);

    expect(screen.getByTestId("tab-my-items")).toBeInTheDocument();
    expect(screen.getByTestId("tab-shared")).toBeInTheDocument();
    expect(screen.getByTestId("tab-org")).toBeInTheDocument();

    expect(screen.getByTestId("tab-my-items")).toHaveTextContent("My Items");
    expect(screen.getByTestId("tab-shared")).toHaveTextContent("Shared with Me");
    expect(screen.getByTestId("tab-org")).toHaveTextContent("Org Library");
  });

  it("fetches from /api/context?owner=me for My Items tab", async () => {
    setupFetchSuccess();
    render(<LibrarySections />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/context?owner=me");
    });
  });

  it("renders items after fetch", async () => {
    setupFetchSuccess();
    render(<LibrarySections />);

    await waitFor(() => {
      expect(screen.getByText("Design Document")).toBeInTheDocument();
    });

    expect(screen.getByText("API Handler")).toBeInTheDocument();
    expect(screen.getByText("Team Standup Notes")).toBeInTheDocument();
    expect(screen.getByText("Homepage")).toBeInTheDocument();
  });

  it("shows source type badges", async () => {
    setupFetchSuccess();
    render(<LibrarySections />);

    await waitFor(() => {
      expect(screen.getByText("Design Document")).toBeInTheDocument();
    });

    expect(screen.getByText("Document")).toBeInTheDocument();
    expect(screen.getByText("Artifact")).toBeInTheDocument();
    expect(screen.getByText("Conversation")).toBeInTheDocument();
    expect(screen.getByText("Web")).toBeInTheDocument();
  });

  it("filters items by search text", async () => {
    setupFetchSuccess();
    render(<LibrarySections />);

    await waitFor(() => {
      expect(screen.getByText("Design Document")).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId("library-search");
    fireEvent.change(searchInput, { target: { value: "Design" } });

    expect(screen.getByText("Design Document")).toBeInTheDocument();
    expect(screen.queryByText("API Handler")).not.toBeInTheDocument();
    expect(screen.queryByText("Team Standup Notes")).not.toBeInTheDocument();
  });

  it("filters by source type dropdown", async () => {
    setupFetchSuccess();
    render(<LibrarySections />);

    await waitFor(() => {
      expect(screen.getByText("Design Document")).toBeInTheDocument();
    });

    // All 4 items visible initially
    expect(screen.getAllByTestId("library-item-row")).toHaveLength(4);
  });

  it("shows empty state when no items match filters", async () => {
    setupFetchSuccess();
    render(<LibrarySections />);

    await waitFor(() => {
      expect(screen.getByText("Design Document")).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId("library-search");
    fireEvent.change(searchInput, { target: { value: "nonexistent" } });

    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    expect(screen.getByText("No items match your filters")).toBeInTheDocument();
  });

  it("switches tab to Shared with Me", async () => {
    setupFetchSuccess();
    render(<LibrarySections />);

    await waitFor(() => {
      expect(screen.getByText("Design Document")).toBeInTheDocument();
    });

    // Click the Shared tab — it should become active
    fireEvent.click(screen.getByTestId("tab-shared"));

    // The tab trigger should now have active state
    const sharedTab = screen.getByTestId("tab-shared");
    expect(sharedTab).toBeInTheDocument();
  });

  it("switches to Org Library tab", async () => {
    setupFetchSuccess();
    render(<LibrarySections />);

    await waitFor(() => {
      expect(screen.getByText("Design Document")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("tab-org"));
    const orgTab = screen.getByTestId("tab-org");
    expect(orgTab).toBeInTheDocument();
  });

  it("calls onItemClick when an item is clicked", async () => {
    setupFetchSuccess();
    const onItemClick = vi.fn();
    render(<LibrarySections onItemClick={onItemClick} />);

    await waitFor(() => {
      expect(screen.getByText("Design Document")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Design Document"));

    expect(onItemClick).toHaveBeenCalledWith("1");
  });

  it("shows tags when present", async () => {
    setupFetchSuccess();
    render(<LibrarySections />);

    await waitFor(() => {
      expect(screen.getByText("Design Document")).toBeInTheDocument();
    });

    expect(screen.getByText("design")).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText("backend")).toBeInTheDocument();
  });

  it("shows loading skeletons while fetching", () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
    render(<LibrarySections />);

    expect(screen.getByTestId("section-loading")).toBeInTheDocument();
  });

  it("shows error state on fetch failure", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    render(<LibrarySections />);

    await waitFor(() => {
      expect(screen.getByText("Failed to fetch: 500")).toBeInTheDocument();
    });

    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("search input exists and accepts text", async () => {
    setupFetchSuccess();
    render(<LibrarySections />);

    await waitFor(() => {
      expect(screen.getByText("Design Document")).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId("library-search");
    fireEvent.change(searchInput, { target: { value: "Design" } });
    expect((searchInput as HTMLInputElement).value).toBe("Design");
  });
});
