'use client';
import { toast } from "sonner";
import ReactMarkdown from 'react-markdown';
import { useConfirm } from "@/components/ConfirmProvider";
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';
import {
  ArrowUp,
  Bot,
  User,
  Loader2,
  Sparkles,
  Trash2,
  Copy,
  Check,
  PackagePlus,
  Receipt,
  Flag,
} from 'lucide-react';
const GREETING =
  'Hello! I am your OLFU Marketplace AI assistant. How can I help you find listings, check items, or navigate the platform today?';
const SUGGESTIONS = [
  { icon: PackagePlus, text: 'How do I create a listing?' },
  { icon: Receipt, text: 'Where are my transactions?' },
  { icon: Flag, text: 'How do I report a user?' },
];
const makeMessage = (role, content) => ({
  role,
  content,
  created_at: new Date().toISOString(),
});
const formatTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};
const dayKey = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d) ? null : d.toDateString();
};
const dayLabel = (iso) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  });
};
// Shared look for the assistant's avatar
function AssistantAvatar({ className = 'w-7 h-7 sm:w-8 sm:h-8', iconSize = 15 }) {
  return (
    <div
      className={${className} rounded-full shrink-0 flex items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-sm}
    >
      <Bot size={iconSize} />
    </div>
  );
}
// Markdown styling for assistant replies
const markdownComponents = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
  h1: ({ children }) => <h3 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="text-sm font-bold mb-1.5 mt-2 first:mt-0">{children}</h4>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-indigo-400 pl-3 my-2 text-neutral-600 dark:text-neutral-400">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded-md bg-stone-100 dark:bg-neutral-800 px-1.5 py-0.5 text-[0.85em] font-mono">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-xl bg-stone-100 dark:bg-neutral-800 p-3 text-xs [&>code]:bg-transparent [&>code]:p-0">
      {children}
    </pre>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline text-indigo-600 dark:text-indigo-400 break-all hover:opacity-80"
    >
      {children}
    </a>
  ),
};
export default function AiChatPage() {
  const askConfirm = useConfirm();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const didInitialScroll = useRef(false);
  useEffect(() => {
    async function initUserAndHistory() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUser(user);
        setAuthChecked(true);
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('id', user.id)
            .maybeSingle();
          setAvatarUrl(
            profile?.avatar_url ||
            user.user_metadata?.avatar_url ||
            user.user_metadata?.picture ||
            null
          );
          // Fetch past chat memory from Supabase
          const { data, error } = await supabase
            .from('ai_messages')
            .select('role, content, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true });
          if (!error && data && data.length > 0) {
            setMessages(data);
          } else {
            // Default initial greeting if no history exists
            setMessages([{ role: 'assistant', content: GREETING }]);
          }
        }
      } finally {
        setAuthChecked(true);
        setHistoryLoading(false);
      }
    }
    initUserAndHistory();
  }, []);
  // Jump to the bottom instantly on first load, then scroll smoothly after that
  useEffect(() => {
    if (historyLoading) return;
    messagesEndRef.current?.scrollIntoView({
      behavior: didInitialScroll.current ? 'smooth' : 'auto',
    });
    didInitialScroll.current = true;
  }, [messages, loading, historyLoading]);
  // Auto-grow the textarea with its content (up to a max height)
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = ${Math.min(el.scrollHeight, 160)}px;
  }, [input]);
  if (authChecked && !currentUser) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center gap-4 px-6 text-center text-neutral-900 dark:text-neutral-100">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/25 flex items-center justify-center">
          <Bot size={28} />
        </div>
        <h1 className="text-lg font-bold">Log in to use the AI Assistant</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-xs">
          The assistant is for signed-in OLFU members.
        </p>
        <div className="flex gap-2">
          <Link
            href="/login"
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/marketplace"
            className="px-5 py-2.5 rounded-xl bg-stone-200 hover:bg-stone-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white font-bold text-sm transition-colors"
          >
            Back
          </Link>
        </div>
      </div>
    );
  }
  // Only the very first, unsaved greeting counts as an empty conversation
  const isFresh =
    !historyLoading &&
    messages.length === 1 &&
    messages[0].role === 'assistant' &&
    !messages[0].created_at;
  const pickSuggestion = (text) => {
    setInput(text);
    inputRef.current?.focus();
  };
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;
    if (!currentUser) {
      toast.error('Please log in to use the AI assistant.');
      return;
    }
    const userMessage = input.trim();
    setInput('');
    // Only role + content go to the API
    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((prev) => [...prev, makeMessage('user', userMessage)]);
    setLoading(true);
    await supabase.from('ai_messages').insert({
      user_id: currentUser.id,
      role: 'user',
      content: userMessage
    });
    try {
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history, message: userMessage })
      });
      const data = await response.json();
      if (!response.ok) {
        setMessages((prev) => [
          ...prev,
          makeMessage('assistant', data.error || "I'm having trouble responding right now.")
        ]);
        return;
      }
      const aiReply = data.reply || "I'm having trouble responding right now.";
      setMessages((prev) => [...prev, makeMessage('assistant', aiReply)]);
      await supabase.from('ai_messages').insert({
        user_id: currentUser.id,
        role: 'assistant',
        content: aiReply
      });
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        makeMessage('assistant', 'Sorry, I encountered an error connecting to the AI service.')
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };
  // Enter sends on desktop, Shift+Enter adds a new line.
  // On touch devices Enter stays a new line; use the send button.
  const handleKeyDown = (e) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    const hasFinePointer =
      typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;
    if (hasFinePointer) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  const copyMessage = async (text, index) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex((cur) => (cur === index ? null : cur)), 1500);
    } catch {
      toast.error('Could not copy to clipboard.');
    }
  };
  const clearHistory = async () => {
    if (!currentUser) return;
    const ok = await askConfirm({
      title: 'Clear chat history?',
      message: 'This deletes your AI chat history and can\'t be undone.',
      confirmText: 'Clear history',
    });
    if (ok) {
      const { error } = await supabase.from('ai_messages').delete().eq('user_id', currentUser.id);
      if (error) {
        toast.error('Failed to clear history: ' + error.message);
        return;
      }
      setMessages([
        { role: 'assistant', content: 'Chat history cleared. How can I help you today?' }
      ]);
      toast.success('Chat history cleared');
    }
  };
  return (
    // Fixed-height column: only the messages area scrolls.
    // If the purple status bar covers the input, use h-[calc(100dvh-2.5rem)] instead of h-dvh.
    // On phones it still fills the screen; from sm up it becomes a centered card.
    // Card style matches the Messages box: 16px corners, #262626 border, faint shadow,
    // and a fill identical to the page background (#0f1511 in dark mode).
    <div className="w-full max-w-4xl mx-auto h-dvh sm:h-[calc(100dvh-3rem)] sm:my-6 flex flex-col overflow-hidden sm:rounded-2xl sm:border border-neutral-300 dark:border-neutral-800 bg-background dark:bg-[#0f1511] sm:shadow-sm text-foreground">
      {/* HEADER BAR */}
      <header className="shrink-0 border-b border-neutral-300 dark:border-neutral-800 px-3 py-3 sm:px-6 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <AssistantAvatar className="w-10 h-10 !rounded-xl" iconSize={20} />
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#0f1511]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold flex items-center gap-1.5">
                <span className="truncate">OLFU AI Assistant</span>
                <Sparkles size={13} className="text-amber-500 shrink-0" />
              </h1>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium truncate">
                Online · Your chats are saved
              </p>
            </div>
          </div>
        </div>
        {currentUser && (
          <button
            onClick={clearHistory}
            aria-label="Clear chat history"
            className="shrink-0 flex items-center justify-center gap-1.5 w-9 h-9 sm:w-auto sm:h-auto sm:px-3 sm:py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-600 hover:text-white dark:hover:bg-rose-600 dark:hover:text-white border border-rose-500/20 transition-colors cursor-pointer"
          >
            <Trash2 size={14} />
            <span className="hidden sm:inline">Clear History</span>
          </button>
        )}
      </header>
      {/* CHAT MESSAGES: the only part that scrolls */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div
          role="log"
          aria-live="polite"
          className={`max-w-3xl w-full mx-auto px-3 sm:px-4 py-5 sm:py-8 flex flex-col gap-4 ${isFresh ? 'min-h-full justify-center' : ''
            }`}
        >
          {/* LOADING SKELETON while history is fetched */}
          {historyLoading && (
            <div className="space-y-5 animate-pulse" aria-hidden="true">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-stone-200 dark:bg-neutral-800 shrink-0" />
                <div className="h-16 w-64 max-w-[70%] rounded-2xl rounded-bl-md bg-stone-200 dark:bg-neutral-800" />
              </div>
              <div className="flex flex-row-reverse items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-stone-200 dark:bg-neutral-800 shrink-0" />
                <div className="h-10 w-44 max-w-[60%] rounded-2xl rounded-br-md bg-stone-200 dark:bg-neutral-800" />
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-stone-200 dark:bg-neutral-800 shrink-0" />
                <div className="h-24 w-72 max-w-[75%] rounded-2xl rounded-bl-md bg-stone-200 dark:bg-neutral-800" />
              </div>
            </div>
          )}
          {/* WELCOME STATE */}
          {isFresh && (
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25">
                  <Bot size={30} />
                </div>
                <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-amber-400 text-white flex items-center justify-center ring-4 ring-white dark:ring-[#0f1511]">
                  <Sparkles size={14} />
                </span>
              </div>
              <h2 className="mt-5 text-xl sm:text-2xl font-black tracking-tight">
                How can I help you today?
              </h2>
              <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400 max-w-md">
                Ask me about listings, items, or how to get around the OLFU Marketplace.
              </p>
              <div className="mt-7 grid w-full max-w-2xl gap-2.5 sm:grid-cols-3">
                {SUGGESTIONS.map(({ icon: Icon, text }) => (
                  <button
                    key={text}
                    type="button"
                    onClick={() => pickSuggestion(text)}
                    className="group flex sm:flex-col items-center sm:items-start gap-3 text-left p-3.5 rounded-2xl bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer"
                  >
                    <span className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                      <Icon size={16} />
                    </span>
                    <span className="text-sm font-semibold leading-snug">{text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* MESSAGES */}
          {!isFresh &&
            messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              const key = dayKey(msg.created_at);
              const prevKey = index > 0 ? dayKey(messages[index - 1].created_at) : null;
              const showDay = key && key !== prevKey;
              const time = formatTime(msg.created_at);
              return (
                <div key={index}>
                  {showDay && (
                    <div className="flex items-center gap-3 mb-4" role="separator">
                      <div className="h-px flex-1 bg-stone-200 dark:bg-neutral-800" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                        {dayLabel(msg.created_at)}
                      </span>
                      <div className="h-px flex-1 bg-stone-200 dark:bg-neutral-800" />
                    </div>
                  )}
                  <div
                    className={group flex items-start gap-2 sm:gap-3 ${isUser ? 'flex-row-reverse' : ''}}
                  >
                    {/* AVATAR */}
                    {isUser ? (
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full shrink-0 flex items-center justify-center overflow-hidden bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 ring-2 ring-emerald-600/30">
                        {avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={avatarUrl}
                            alt="You"
                            referrerPolicy="no-referrer"
                            onError={() => setAvatarUrl(null)}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User size={14} />
                        )}
                      </div>
                    ) : (
                      <AssistantAvatar />
                    )}
                    {/* BUBBLE + META */}
                    <div
                      className={`flex flex-col min-w-0 max-w-[85%] sm:max-w-[75%] ${isUser ? 'items-end' : 'items-start'
                        }`}
                    >
                      {/* min-w-0 + break-words stop long text and links from overflowing */}
                      <div
                        className={`min-w-0 break-words px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${isUser
                          ? 'bg-emerald-600 text-white rounded-br-md font-medium'
                          : 'bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-100 rounded-bl-md'
                          }`}
                      >
                        {isUser ? (
                          <span className="whitespace-pre-wrap">{msg.content}</span>
                        ) : (
                          <ReactMarkdown components={markdownComponents}>
                            {msg.content}
                          </ReactMarkdown>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2 px-1 text-[10px] font-medium text-neutral-500 dark:text-neutral-400">
                        {time && <span>{time}</span>}
                        {!isUser && (
                          <button
                            type="button"
                            onClick={() => copyMessage(msg.content, index)}
                            aria-label="Copy reply"
                            className="flex items-center gap-1 rounded-md px-1 py-0.5 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all cursor-pointer sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
                          >
                            {copiedIndex === index ? (
                              <>
                                <Check size={12} /> Copied
                              </>
                            ) : (
                              <>
                                <Copy size={12} /> Copy
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          {/* TYPING INDICATOR */}
          {loading && (
            <div className="flex items-start gap-2 sm:gap-3">
              <AssistantAvatar />
              <div
                role="status"
                aria-label="AI is typing"
                className="px-4 py-3.5 rounded-2xl rounded-bl-md bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 shadow-sm flex items-center gap-1"
              >
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"
                    style={{ animationDelay: ${i * 150}ms }}
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      {/* COMPOSER (safe-area padding keeps it clear of the phone's home bar) */}
      <div className="shrink-0 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4 sm:pb-4">
        <div className="max-w-3xl mx-auto">
          {/* QUICK SUGGESTIONS (hidden on the welcome screen, which has its own cards) */}
          {!isFresh && !historyLoading && (
            <div className="mb-2 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {SUGGESTIONS.map(({ text }) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => pickSuggestion(text)}
                  className="shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full bg-white dark:bg-neutral-900 border border-stone-300 dark:border-neutral-700 text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-emerald-600 hover:border-emerald-600 hover:text-white dark:hover:bg-emerald-600 dark:hover:border-emerald-600 dark:hover:text-white transition-colors cursor-pointer"
                >
                  {text}
                </button>
              ))}
            </div>
          )}
          <form
            onSubmit={handleSendMessage}
            className="flex items-end gap-2 rounded-2xl border border-stone-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-2 shadow-sm transition-all focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20"
          >
            {/* text-base on mobile stops iOS from zooming in on focus */}
            <textarea
              ref={inputRef}
              rows={1}
              aria-label="Message the AI assistant"
              className="flex-1 min-w-0 resize-none bg-transparent px-2 py-2 text-base sm:text-sm font-medium text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none max-h-40"
              placeholder="Ask the AI assistant..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              type="submit"
              aria-label="Send message"
              disabled={!input.trim() || loading}
              className="w-10 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center shrink-0"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowUp size={18} />}
            </button>
          </form>
          <p className="mt-2 text-center text-[10px] text-neutral-500 dark:text-neutral-400">
            AI can make mistakes. Double-check important details.
          </p>
        </div>
      </div>
    </div>
  );
}