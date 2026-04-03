/**
 * Avatar State Engine
 *
 * Maps chat activity to NeuralMorph formations.
 * Current message gets dynamic state, past messages get settled states.
 */

type Formation = "idle" | "active" | "done" | "error" | "scatter" | "ring" | "spiral"
  | "galaxy" | "orbit" | "helix" | "flow" | "bloom" | "triangle" | "hexagon" | "star"
  | "infinity" | "grid" | "breathe" | "pulse" | "converge" | "disperse" | "vortex" | "wave"
  | "heart" | "check" | "cross";

// Map tool names to expressive formations while running
const TOOL_FORMATIONS: Record<string, Formation> = {
  // Search/lookup tools — orbital, searching
  search_context: "orbit",
  get_document: "flow",
  web_search: "galaxy",
  web_browse: "flow",

  // Specialist agents — energized
  ask_linear_agent: "helix",
  ask_gmail_agent: "wave",
  ask_notion_agent: "spiral",
  ask_granola_agent: "bloom",
  ask_drive_agent: "orbit",

  // Direct API — fast
  list_linear_issues: "vortex",
  search_gmail: "wave",
  search_notion: "spiral",
  list_drive_files: "orbit",

  // Code/sandbox — building
  run_code: "pulse",
  run_project: "galaxy",
  write_code: "helix",

  // Documents — flowing
  create_document: "flow",
  edit_document: "wave",

  // Artifacts — structured
  artifact_list: "grid",
  artifact_get: "ring",
  artifact_version: "spiral",

  // Scheduling — rhythmic
  schedule_action: "breathe",
  list_schedules: "ring",

  // Review — analytical
  review_compliance: "hexagon",

  // Skills — creative
  activate_skill: "bloom",
  create_skill: "star",

  // Ingestion — absorbing
  ingest_github_repo: "vortex",

  // Approvals — decisive
  list_approvals: "triangle",
  propose_action: "pulse",
};

// Map tool names to settled formations (shown after completion)
const TOOL_DONE_FORMATIONS: Record<string, Formation> = {
  search_context: "scatter",
  web_search: "scatter",
  run_project: "star",
  write_code: "hexagon",
  create_document: "infinity",
  review_compliance: "check",
  ingest_github_repo: "ring",
};

/**
 * Get the avatar formation for the current (generating) message.
 * Looks at active tool calls to determine what the AI is doing.
 */
export function getActiveFormation(activeTools: string[]): Formation {
  if (activeTools.length === 0) return "active";

  // Use the most recent tool's formation
  const lastTool = activeTools[activeTools.length - 1];
  return TOOL_FORMATIONS[lastTool] ?? "active";
}

/**
 * Get the avatar formation for a completed past message.
 * Based on what tools were used in that message.
 */
export function getDoneFormation(toolsUsed: string[]): Formation {
  if (toolsUsed.length === 0) return "done";

  // Check if any tool has a specific done formation
  for (const tool of toolsUsed.reverse()) {
    if (TOOL_DONE_FORMATIONS[tool]) return TOOL_DONE_FORMATIONS[tool];
  }

  return "done";
}

/**
 * Get formation for older messages (further back in history).
 * Simpler, calmer formations.
 */
export function getOldFormation(): Formation {
  return "idle";
}

/**
 * Get formation for error state.
 */
export function getErrorFormation(): Formation {
  return "error";
}
