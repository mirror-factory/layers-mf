import { ChatInterface } from "@/components/chat-interface";

export default function ChatPage() {
  return (
    <div className="flex flex-col h-screen">
      <div className="border-b px-8 py-4 shrink-0">
        <h1 className="text-lg font-semibold">Chat</h1>
        <p className="text-xs text-muted-foreground">
          Ask questions across all your team&apos;s context.
        </p>
      </div>
      <div className="flex-1 overflow-hidden">
        <ChatInterface />
      </div>
    </div>
  );
}
