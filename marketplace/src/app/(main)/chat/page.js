import { MessageSquare } from "lucide-react";

// The inbox now lives in ./layout.js + ./ChatSidebar.js.
// This page is only the right-hand panel when no conversation is selected
// (hidden on mobile, where the inbox takes the whole screen).
export default function ChatIndexPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="w-16 h-16 rounded-full border border-neutral-300 dark:border-neutral-700 flex items-center justify-center">
        <MessageSquare size={28} className="text-neutral-500 dark:text-neutral-400" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">Select a message</h2>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-xs">
        Choose a conversation from your inbox, or search for someone to start a new one.
      </p>
    </div>
  );
}
