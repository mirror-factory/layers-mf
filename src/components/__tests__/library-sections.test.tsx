import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

  it("renders 3 tabs: My Items, Shared with Me, Org Library", () => {
    setupFetchSuccess();
    render(<LibrarySections />);

    expect(screen.getByTestId("tab-my-items")).toBeInTheDocument();
    expect(screen.getByTestId("tab-shared")).toBeInTheDocument();
    expect(screen.getByTestId("tab-org")).toBeInTheDocument();

    expect(screen.getByTestId("tab-my-items")).toHaveTextContent("My Items");
    expect(screen.getByTestId("tab-shared")).toHaveTextContent("Shared with Me");
    expect(screen.getByTestId("tab-org")).toHaveTextContent("Org Library");
  });

  it("My Items tab is active by default", () => {
    setupFetchSuccess();
    render(<LibrarySections />);

    expect(screen.getByTestId("tab-my-items")).toHaveAttribute(
      "data-state",
      "active"
    );
    expect(screen.getByTestId("tab-shared")).toHaveAttribute(
      "data-state",
      "inactive"
    );
    expect(screen.getByTestId("tab-org")).toHaveAttribute(
      "data-state",
      "inactive"
    );
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

  it("renders the search input and type filter controls", () => {
    setupFetchSuccess();
    render(<LibrarySections />);

    expect(screen.getByTestId("library-search")).toBeInTheDocument();
    expect(screen.getByTestId("type-filter")).toBeInTheDocument();
  });

  it("each tab has correct role and aria attributes", () => {
    setupFetchSuccess();
    render(<LibrarySections />);

    const myItemsTab = screen.getByTestId("tab-my-items");
    const sharedTab = screen.getByTestId("tab-shared");
    const orgTab = screen.getByTestId("tab-org");

    expect(myItemsTab).toHaveAttribute("role", "tab");
    expect(sharedTab).toHaveAttribute("role", "tab");
    expect(orgTab).toHaveAttribute("role", "tab");

    expect(myItemsTab).toHaveAttribute("aria-selected", "true");
    expect(sharedTab).toHaveAttribute("aria-selected", "false");
    expect(orgTab).toHaveAttribute("aria-selected", "false");
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

  it("shows +N indicator when item has more than 3 tags", async () => {
    const manyTagItems = [
      {
        id: "1",
        title: "Tagged Item",
        source_type: "document",
        updated_at: new Date().toISOString(),
        user_tags: ["tag1", "tag2", "tag3", "tag4", "tag5"],
      },
    ];
    setupFetchSuccess(manyTagItems);
    render(<LibrarySections />);

    await waitFor(() => {
      expect(screen.getByText("Tagged Item")).toBeInTheDocument();
    });

    expect(screen.getByText("+2")).toBeInTheDocument();
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

  it("handles API returning array directly (no wrapper object)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => MOCK_ITEMS,
    });

    render(<LibrarySections />);

    await waitFor(() => {
      expect(screen.getByText("Design Document")).toBeInTheDocument();
    });
  });

  it("handles API returning { data: [...] } format", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: MOCK_ITEMS }),
    });

    render(<LibrarySections />);

    await waitFor(() => {
      expect(screen.getByText("Design Document")).toBeInTheDocument();
    });
  });

  it("filters by tag text in search", async () => {
    setupFetchSuccess();
    render(<LibrarySections />);

    await waitFor(() => {
      expect(screen.getByText("Design Document")).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId("library-search");
    fireEvent.change(searchInput, { target: { value: "backend" } });

    // Only item with "backend" tag should remain
    expect(screen.getByText("API Handler")).toBeInTheDocument();
    expect(screen.queryByText("Design Document")).not.toBeInTheDocument();
  });
});
