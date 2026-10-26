'use client';

import { toast } from "sonner";
import ReactMarkdown from 'react-markdown';
import { useConfirm } from "@/components/ConfirmProvider";
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';
import {
  ArrowLeft,
  Send,
  Bot,
  User,
  Loader2,
  Sparkles,
  Trash2
} from 'lucide-react';

export default function AiChatPage() {
  const askConfirm = useConfirm();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    async function initUserAndHistory() {
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
          setMessages([
            {
              role: 'assistant',
              content: 'Hello! I am your OLFU Marketplace AI assistant. How can I help you find listings, check items, or navigate the platform today?'
            }
          ]);
        }
      }
    }
    initUserAndHistory();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  if (authChecked && !currentUser) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center gap-4 px-6 text-center text-foreground">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 flex items-center justify-center">
          <Bot size={24} />
        </div>
        <h1 className="text-lg font-bold">Log in to use the AI Assistant</h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          The assistant is for signed-in OLFU members.
        </p>
        <div className="flex gap-2">
          <Link href="/login" className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm">
            Log in
          </Link>
          <Link href="/marketplace" className="px-5 py-2.5 rounded-xl bg-muted text-foreground font-bold text-sm">
            Back
          </Link>
        </div>
      </div>
    );
  }

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;

    if (!currentUser) {
      toast.error('Please log in to use the AI assistant.');
      return;
    }

    const userMessage = input.trim();
    setInput('');

    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setLoading(true);

    if (currentUser) {
      await supabase.from('ai_messages').insert({
        user_id: currentUser.id,
        role: 'user',
        content: userMessage
      });
    }

    try {
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history: messages, message: userMessage })
      });

      const data = await response.json();
      if (!response.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.error || "I'm having trouble responding right now." }]);
        return;
      }
      const aiReply = data.reply || "I'm having trouble responding right now.";

      setMessages((prev) => [...prev, { role: 'assistant', content: aiReply }]);

      if (currentUser) {
        await supabase.from('ai_messages').insert({
          user_id: currentUser.id,
          role: 'assistant',
          content: aiReply
        });
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error connecting to the AI service.' }
      ]);
    } finally {
      setLoading(false);
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
    }
  };

  return (
    // Fixed-height column: only the messages area scrolls.
    // If the purple status bar covers the input, use h-[calc(100dvh-2.5rem)] instead of h-dvh.
    <div className="text-foreground h-dvh flex flex-col overflow-hidden">

      {/* HEADER BAR */}
      <div className="shrink-0 border-b border-border bg-card/50 backdrop-blur-md px-3 py-3 sm:px-6 sm:py-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link
            href="/marketplace"
            aria-label="Back to marketplace"
            className="p-2 rounded-xl bg-muted hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 flex items-center justify-center font-bold shrink-0">
              <Bot size={20} />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold flex items-center gap-1.5">
                <span className="truncate">OLFU AI Assistant</span>
                <Sparkles size={13} className="text-amber-500 shrink-0" />
              </h1>
              <p className="text-[10px] text-muted-foreground font-medium truncate">Memory Enabled • Supabase Synced</p>
            </div>
          </div>
        </div>

        {currentUser && (
          <button
            onClick={clearHistory}
            aria-label="Clear chat history"
            className="shrink-0 flex items-center justify-center gap-1.5 w-9 h-9 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors cursor-pointer"
            title="Clear Chat History"
          >
            <Trash2 size={14} />
            <span className="hidden sm:inline">Clear History</span>
          </button>
        )}
      </div>

      {/* CHAT MESSAGES: the only part that scrolls */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-4xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-6 flex flex-col space-y-3 sm:space-y-4">
          {messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={index}
                className={`flex items-start gap-2 sm:gap-3 max-w-[90%] sm:max-w-[70%] ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
                  }`}
              >
                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full shrink-0 flex items-center justify-center overflow-hidden text-xs font-bold border ${isUser
                  ? 'bg-foreground text-background border-transparent'
                  : 'bg-white text-indigo-500 border-indigo-500/50'
                  }`}>
                  {isUser ? (
                    avatarUrl ? (
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
                    )
                  ) : (
                    <Bot size={14} />
                  )}
                </div>
                {/* min-w-0 + break-words stop long text and links from overflowing */}
                <div className={`min-w-0 break-words p-3 sm:p-4 rounded-2xl text-sm leading-relaxed shadow-xs ${isUser
                  ? 'bg-emerald-600 text-background rounded-tr-none font-medium'
                  : 'bg-white dark:bg-neutral-900 border border-border text-foreground rounded-tl-none font-normal'
                  }`}>
                  {isUser ? (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  ) : (
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
                        strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                        a: ({ href, children }) => (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="underline text-indigo-600 break-all">
                            {children}
                          </a>
                        ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex items-start gap-2 sm:gap-3 mr-auto max-w-[90%] sm:max-w-[70%]">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white text-indigo-500 border border-indigo-500/20 flex items-center justify-center shrink-0">
                <Bot size={14} />
              </div>
              <div className="p-3 sm:p-4 rounded-2xl bg-card border border-border text-muted-foreground rounded-tl-none flex items-center gap-2 text-xs font-medium">
                <Loader2 size={14} className="animate-spin text-indigo-500" /> AI is thinking...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* SUGGESTION QUICK PILLS */}
      <div className="shrink-0 max-w-4xl w-full mx-auto px-3 sm:px-4 pb-2 flex flex-wrap gap-1.5 sm:gap-2 hover:text-white">
        {["How do I create a listing?", "Where are my transactions?", "How do I report a user?"].map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => setInput(suggestion)}
            className="px-2.5 py-1.5 sm:px-3 rounded-full bg-white border border-border text-[11px] font-semibold text-muted-foreground hover:border border-black hover:text-white hover:bg-emerald-600 transition-colors cursor-pointer dark:text-white dark:bg-neutral-900 dark:hover:bg-emerald-600 dark:hover:text-white"
          >
            {suggestion}
          </button>
        ))}
      </div>

      {/* INPUT FORM FOOTER (safe-area padding keeps it clear of the phone's home bar) */}
      <div className="shrink-0 border-t border-border bg-card/80 backdrop-blur-md px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 dark:text-black">
        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex items-center gap-2">
          {/* text-base on mobile stops iOS from zooming in on focus */}
          <input
            type="text"
            className="flex-grow min-w-0 bg-white border border-border rounded-xl px-3 sm:px-4 py-3 text-base sm:text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-foreground/20 placeholder:text-muted-foreground dark:text-black dark:bg-neutral-900 dark:border-border dark:placeholder:text-muted-foreground"
            placeholder="Ask the AI assistant..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={!input.trim() || loading}
            className="w-11 h-11 sm:w-auto sm:h-auto sm:px-5 sm:py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
          >
            <Send size={16} /> <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>

    </div>
  );
}