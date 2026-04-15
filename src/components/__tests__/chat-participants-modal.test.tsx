import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { ChatParticipantsModal } from "../chat-participants-modal";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockMembers = [
  {
    id: "m1",
    userId: "u1",
    name: "Alice Owner",
    email: "alice@example.com",
    role: "owner",
    addedAt: "2025-12-01T00:00:00Z",
  },
  {
    id: "m2",
    userId: "u2",
    name: "Bob Participant",
    email: "bob@example.com",
    role: "participant",
    addedAt: "2025-12-05T00:00:00Z",
  },
  {
    id: "m3",
    userId: "u3",
    name: "Carol Viewer",
    email: "carol@example.com",
    role: "viewer",
    addedAt: "2025-12-10T00:00:00Z",
  },
];

// ---------------------------------------------------------------------------
// Fetch mock
// ---------------------------------------------------------------------------

const fetchSpy = vi.fn();

beforeEach(() => {
  fetchSpy.mockReset();
  // Default: return mock members
  fetchSpy.mockResolvedValue({
    ok: true,
    json: async () => ({ members: mockMembers }),
  });
  vi.stubGlobal("fetch", fetchSpy);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ChatParticipantsModal", () => {
  const baseProps = {
    open: true,
    onClose: vi.fn(),
    conversationId: "conv-123",
    currentUserId: "u1",
    isOwner: true,
  };

  it("renders member list with names", async () => {
    render(<ChatParticipantsModal {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByText("Alice Owner")).toBeInTheDocument();
    });
    expect(screen.getByText("Bob Participant")).toBeInTheDocument();
    expect(screen.getByText("Carol Viewer")).toBeInTheDocument();
  });

  it("shows member count in header", async () => {
    render(<ChatParticipantsModal {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByText("(3)")).toBeInTheDocument();
    });
  });

  it("shows owner badge for the owner member", async () => {
    render(<ChatParticipantsModal {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByText("Alice Owner")).toBeInTheDocument();
    });

    const badges = screen.getAllByText("owner");
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it("shows remove button only when isOwner is true", async () => {
    const { unmount } = render(
      <ChatParticipantsModal {...baseProps} isOwner={true} />
    );

    await waitFor(() => {
      expect(screen.getByText("Bob Participant")).toBeInTheDocument();
    });

    // Remove buttons should exist for non-owner members
    expect(screen.getByLabelText("Remove Bob Participant")).toBeInTheDocument();
    expect(screen.getByLabelText("Remove Carol Viewer")).toBeInTheDocument();

    unmount();

    // Re-render as non-owner
    render(<ChatParticipantsModal {...baseProps} isOwner={false} />);

    await waitFor(() => {
      expect(screen.getByText("Bob Participant")).toBeInTheDocument();
    });

    // Remove buttons should NOT exist
    expect(
      screen.queryByLabelText("Remove Bob Participant")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Remove Carol Viewer")
    ).not.toBeInTheDocument();
  });

  it("calls onClose when dialog is dismissed", async () => {
    const onClose = vi.fn();
    render(<ChatParticipantsModal {...baseProps} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText("Alice Owner")).toBeInTheDocument();
    });

    // The dialog close button (X) rendered by DialogContent has sr-only "Close" text
    const closeButton = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  it("shows empty state when no members", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ members: [] }),
    });

    render(<ChatParticipantsModal {...baseProps} />);

    await waitFor(() => {
      expect(
        screen.getByText(/no other participants yet/i)
      ).toBeInTheDocument();
    });
  });

  it("shows loading spinner while fetching", () => {
    // Never-resolving fetch
    fetchSpy.mockReturnValue(new Promise(() => {}));

    render(<ChatParticipantsModal {...baseProps} />);

    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
  });

  it("shows error message on fetch failure", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    render(<ChatParticipantsModal {...baseProps} />);

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load participants")
      ).toBeInTheDocument();
    });
  });

  it("shows add member button only for owners", async () => {
    render(<ChatParticipantsModal {...baseProps} isOwner={true} />);

    await waitFor(() => {
      expect(screen.getByText("Add member")).toBeInTheDocument();
    });
  });

  it("hides add member button for non-owners", async () => {
    render(<ChatParticipantsModal {...baseProps} isOwner={false} />);

    await waitFor(() => {
      expect(screen.getByText("Alice Owner")).toBeInTheDocument();
    });

    expect(screen.queryByText("Add member")).not.toBeInTheDocument();
  });

  it("shows add form when add member button is clicked", async () => {
    render(<ChatParticipantsModal {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByText("Add member")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Add member"));

    expect(screen.getByLabelText("New member name")).toBeInTheDocument();
    expect(screen.getByLabelText("New member email")).toBeInTheDocument();
  });

  it("does not fetch when modal is closed", () => {
    render(<ChatParticipantsModal {...baseProps} open={false} />);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("shows avatar initials for each member", async () => {
    render(<ChatParticipantsModal {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByText("A")).toBeInTheDocument(); // Alice
      expect(screen.getByText("B")).toBeInTheDocument(); // Bob
      expect(screen.getByText("C")).toBeInTheDocument(); // Carol
    });
  });

  it("confirms before removing a member", async () => {
    render(<ChatParticipantsModal {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByText("Bob Participant")).toBeInTheDocument();
    });

    const removeBtn = screen.getByLabelText("Remove Bob Participant");
    fireEvent.click(removeBtn);

    // Should show confirmation text instead of X icon
    expect(screen.getByText("Sure?")).toBeInTheDocument();
  });
});
