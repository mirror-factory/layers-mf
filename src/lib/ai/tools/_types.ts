export interface ToolMetadata {
  name: string;
  category:
    | "knowledge"
    | "agents"
    | "code"
    | "documents"
    | "scheduling"
    | "web"
    | "skills"
    | "compliance"
    | "artifacts"
    | "approvals";
  service: string;
  access: "read" | "write" | "client-side";
  description: string;
  clientSide?: boolean;
}
