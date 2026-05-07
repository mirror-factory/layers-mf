/**
 * Tool metadata types -- defines the shape of every tool in the registry.
 *
 * This is the single source of truth for tool categorization, access levels,
 * and client/server behavior. All derived registries, documentation, and
 * enforcement tests consume this interface.
 *
 * Updated by @mirror-factory/ai-dev-kit
 */

export interface ToolMetadata {
  /** Unique tool name (matches the key in your tools object) */
  name: string;

  /** Functional category for grouping in docs and UI */
  category:
    | 'knowledge'
    | 'agents'
    | 'code'
    | 'documents'
    | 'scheduling'
    | 'web'
    | 'skills'
    | 'compliance'
    | 'artifacts'
    | 'approvals'
    | 'search'
    | 'generation'
    | 'interview'
    | 'config';

  /** External service or runtime this tool depends on */
  service: string;

  /** Access pattern: read-only, write (side effects), or client-side (no server execute) */
  access: 'read' | 'write' | 'client-side';

  /** Human-readable description (shown in docs, UI, and AGENTS.md). Minimum 50 chars. */
  description: string;

  /**
   * True for tools with no `execute` function -- they pause the conversation,
   * render UI, and wait for user interaction via `addToolOutput()`.
   */
  clientSide?: boolean;

  /** Permission tier: explorer (read-only) or executor (write operations) */
  permissionTier?: 'explorer' | 'executor';

  /** Semantic version of the tool schema */
  version?: string;

  /** Estimated cost per invocation (e.g., "$0.001", "free", "$0.05-0.10") */
  costEstimate?: string;

  /** Current test status */
  testStatus?: 'passing' | 'failing' | 'untested';

  /** Last evaluation score (0-100) */
  lastEvalScore?: number;

  /** Tool names this tool depends on */
  dependencies?: string[];
}
