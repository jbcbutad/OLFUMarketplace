'use client';

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
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    async function initUserAndHistory() {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      if (user) {
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

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;

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
    if (confirm('Are you sure you want to clear your chat history?')) {
      await supabase.from('ai_messages').delete().eq('user_id', currentUser.id);
      setMessages([
        { role: 'assistant', content: 'Chat history cleared. How can I help you today?' }
      ]);
    }
  };

  return (
    <div className="text-foreground min-h-screen flex flex-col justify-between">

      {/* HEADER BAR */}
      <div className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-20 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/marketplace"
            className="p-2 rounded-xl bg-muted hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 flex items-center justify-center font-bold">
              <Bot size={20} />
            </div>
            <div>
              <h1 className="text-sm font-bold flex items-center gap-1.5">
                OLFU AI Assistant <Sparkles size={13} className="text-amber-500" />
              </h1>
              <p className="text-[10px] text-muted-foreground font-medium">Memory Enabled • Supabase Synced</p>
            </div>
          </div>
        </div>

        {currentUser && (
          <button
            onClick={clearHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors cursor-pointer"
            title="Clear Chat History"
          >
            <Trash2 size={13} /> Clear History
          </button>
        )}
      </div>

      {/* CHAT MESSAGES CONTAINER */}
      <div className="max-w-4xl w-full mx-auto px-4 py-6 flex-grow flex flex-col space-y-4 overflow-y-auto">
        {messages.map((msg, index) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={index}
              className={`flex items-start gap-3 max-w-[80%] sm:max-w-[70%] ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
                }`}
            >
              <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold border ${isUser
                  ? 'bg-foreground text-background border-transparent'
                  : 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'
                }`}>
                {isUser ? <User size={14} /> : <Bot size={14} />}
              </div>
              <div className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs ${isUser
                  ? 'bg-foreground text-background rounded-tr-none font-medium'
                  : 'bg-card border border-border text-foreground rounded-tl-none font-normal'
                }`}>
                {msg.content}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-start gap-3 mr-auto max-w-[70%]">
            <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 flex items-center justify-center shrink-0">
              <Bot size={14} />
            </div>
            <div className="p-4 rounded-2xl bg-card border border-border text-muted-foreground rounded-tl-none flex items-center gap-2 text-xs font-medium">
              <Loader2 size={14} className="animate-spin text-indigo-500" /> AI is thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* SUGGESTION QUICK PILLS */}
      <div className="max-w-4xl w-full mx-auto px-4 pb-2 flex flex-wrap gap-2">
        {["How do I create a listing?", "Where are my transactions?", "How do I report a user?"].map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => setInput(suggestion)}
            className="px-3 py-1.5 rounded-full bg-muted border border-border text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
          >
            {suggestion}
          </button>
        ))}
      </div>

      {/* INPUT FORM FOOTER */}
      <div className="border-t border-border bg-card/80 backdrop-blur-md p-4 sticky bottom-0 z-20">
        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex items-center gap-2">
          <input
            type="text"
            className="flex-grow bg-muted border border-border rounded-xl px-4 py-3 text-xs sm:text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 placeholder:text-muted-foreground"
            placeholder="Ask AI assistant anything about the marketplace..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <Send size={15} /> Send
          </button>
        </form>
      </div>

    </div>
  );
}