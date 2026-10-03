"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  MoreVertical,
  Flag,
  Ban,
  Check,
  Copy,
  X,
  Trash2,
  Archive,
  ArchiveRestore,
  Mail,
} from "lucide-react";
import ChatInput from "./ChatInput";
import ConfirmModal from "@/components/ConfirmModal";
import ChatProductBanner from "./ChatProductBanner";


const ROOM_PRODUCT_SELECT =
  "product_id, products(id, title, price, image_urls, seller_id, status, is_available, expires_at, tags, stock_quantity, categories(name))";

export default function ChatRoom() {
  const router = useRouter();
  const { roomId } = useParams();
  const searchParams = useSearchParams();
  const sellerId = searchParams.get("sellerId");
  const productId = searchParams.get("productId");

  const [activeRoomId, setActiveRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [otherUser, setOtherUser] = useState(null);
  const [productContext, setProductContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [activeOverlayImage, setActiveOverlayImage] = useState(null);

  // Block state: the database tells us about BOTH directions
  const [iBlocked, setIBlocked] = useState(false);
  const [blockedMe, setBlockedMe] = useState(false);
  const isBlocked = iBlocked || blockedMe;
  const [showTimestampId, setShowTimestampId] = useState(null);

  // Modal & Notification states
  const [activeModal, setActiveModal] = useState(null); // unsend | block | unblock | delete | report
  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const [reportReason, setReportReason] = useState("");
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });

  const messagesEndRef = useRef(null);
  const currentUserIdRef = useRef(null);

  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "info" }), 3000);
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 60);
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  // Load user session, room information, and block status
  useEffect(() => {
    async function loadChat() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return router.push("/login");
      setCurrentUser(user);
      currentUserIdRef.current = user.id;

      let resolvedRoomId = roomId;

      if (sellerId && (roomId === "new" || roomId === sellerId)) {
        const { data: existingRoomId, error: rpcErr } = await supabase.rpc(
          "get_or_create_direct_room",
          { p_other_user: sellerId }
        );

        if (rpcErr) {
          console.error("RPC Error:", rpcErr);
        } else if (existingRoomId) {
          resolvedRoomId = existingRoomId;
          setActiveRoomId(existingRoomId);
          window.history.replaceState(
            null,
            "",
            `/chat/${existingRoomId}?sellerId=${sellerId}${productId ? `&productId=${productId}` : ""}`
          );
        }
      } else {
        setActiveRoomId(roomId);
      }

      if (!resolvedRoomId) {
        setLoading(false);
        return;
      }

      // My membership: archived state + "deleted conversation" cut-off
      const { data: myMembership } = await supabase
        .from("direct_room_members")
        .select("archived_at, history_cleared_at")
        .eq("room_id", resolvedRoomId)
        .eq("user_id", user.id)
        .maybeSingle();
      setIsArchived(!!myMembership?.archived_at);

      // Messages (only those after I deleted the conversation, if I ever did)
      let msgQuery = supabase
        .from("direct_messages")
        .select("id, room_id, sender_id, body, image_url, created_at, is_unsent, unsent_at")
        .eq("room_id", resolvedRoomId)
        .order("created_at", { ascending: true });

      if (myMembership?.history_cleared_at) {
        msgQuery = msgQuery.gt("created_at", myMembership.history_cleared_at);
      }

      const { data: msgs } = await msgQuery;
      setMessages(msgs || []);

      // The product banner ONLY comes from the room itself.
      // Chats started from a profile have no product_id, so no banner.
      const { data: roomRow } = await supabase
        .from("direct_rooms")
        .select(ROOM_PRODUCT_SELECT)
        .eq("id", resolvedRoomId)
        .maybeSingle();
      setProductContext(roomRow?.products || null);

      // Mark everything as read (also clears a manual "mark as unread")
      const { error: readErr } = await supabase.rpc("mark_room_read", {
        p_room: resolvedRoomId,
      });
      if (!readErr) {
        window.dispatchEvent(new Event("messages-read"));
      }

      // Who am I talking to? Always trust the room's members first.
      const { data: members } = await supabase
        .from("direct_room_members")
        .select("user_id")
        .eq("room_id", resolvedRoomId);

      const targetUserId =
        members?.find((m) => m.user_id !== user.id)?.user_id || sellerId;

      if (targetUserId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select('id, full_name, avatar_url, email, "First_Name", "Last_Name"')
          .eq("id", targetUserId)
          .maybeSingle();

        setOtherUser(profile);

        const { data: rels } = await supabase.rpc("get_my_block_relations");
        const rel = (rels || []).find((r) => r.other_id === targetUserId);
        setIBlocked(!!rel?.i_blocked);
        setBlockedMe(!!rel?.blocked_me);
      }

      setLoading(false);
    }

    loadChat();
  }, [roomId, sellerId, productId, router]);

  // Real-time Supabase subscription
  useEffect(() => {
    if (!activeRoomId) return;

    const channel = supabase
      .channel(`room-${activeRoomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "direct_messages",
          filter: `room_id=eq.${activeRoomId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setIsArchived(false); // any new message auto-unarchives the room (DB trigger)
            setMessages((current) => {
              if (current.some((msg) => msg.id === payload.new.id)) return current;
              return [...current, payload.new];
            });

            // I'm looking at this chat right now, so a new incoming message counts as read
            if (
              payload.new.sender_id !== currentUserIdRef.current &&
              document.visibilityState === "visible"
            ) {
              supabase.rpc("mark_room_read", { p_room: activeRoomId }).then(({ error }) => {
                if (!error) window.dispatchEvent(new Event("messages-read"));
              });
            }
          } else if (payload.eventType === "UPDATE") {
            setMessages((current) =>
              current.map((msg) => (msg.id === payload.new.id ? payload.new : msg))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeRoomId]);

  const formatDateTime = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const closeModal = () => {
    setActiveModal(null);
    setSelectedMessageId(null);
  };

  const refreshProductContext = async () => {
    if (!activeRoomId) return;
    const { data } = await supabase
      .from("direct_rooms")
      .select(ROOM_PRODUCT_SELECT)
      .eq("id", activeRoomId)
      .maybeSingle();
    setProductContext(data?.products || null);
  };

  const executeUnsend = async () => {
    if (!selectedMessageId) return;
    try {
      const { error } = await supabase
        .from("direct_messages")
        .update({
          body: "Message was unsent",
          image_url: null,
          is_unsent: true,
          unsent_at: new Date().toISOString(),
        })
        .eq("id", selectedMessageId);

      if (error) throw error;
      showToast("Message unsent", "success");
    } catch (err) {
      showToast("Failed to unsend message", "error");
    } finally {
      closeModal();
    }
  };

  const executeReportUser = async () => {
    if (!otherUser || !reportReason.trim()) return;
    try {
      const { error } = await supabase.from("reports").insert({
        reporter_id: currentUser.id,
        reported_id: otherUser.id,
        reason: reportReason.trim(),
        context_room_id: activeRoomId,
        status: "pending",
      });

      if (error) throw error;
      showToast("Report submitted successfully", "success");
    } catch (err) {
      showToast("Failed to submit report", "error");
    } finally {
      closeModal();
      setReportReason("");
    }
  };

  const executeBlockUser = async () => {
    if (!otherUser) return;
    try {
      const { error } = await supabase
        .from("blocked_users")
        .upsert(
          { blocker_id: currentUser.id, blocked_id: otherUser.id },
          { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true }
        );

      if (error) throw error;
      showToast("User blocked", "success");
      setIBlocked(true);
      window.dispatchEvent(new Event("unread-refresh"));
    } catch (err) {
      showToast("Failed to block user", "error");
    } finally {
      closeModal();
    }
  };

  const executeUnblockUser = async () => {
    if (!otherUser) return;
    try {
      const { error } = await supabase
        .from("blocked_users")
        .delete()
        .eq("blocker_id", currentUser.id)
        .eq("blocked_id", otherUser.id);

      if (error) throw error;
      showToast("User unblocked", "success");
      setIBlocked(false);
      window.dispatchEvent(new Event("unread-refresh"));
    } catch (err) {
      showToast("Failed to unblock user", "error");
    } finally {
      closeModal();
    }
  };

  const executeToggleArchive = async () => {
    if (!activeRoomId) return;
    const willArchive = !isArchived;
    try {
      const { error } = await supabase.rpc(
        willArchive ? "archive_direct_room" : "unarchive_direct_room",
        { p_room: activeRoomId }
      );
      if (error) throw error;
      window.dispatchEvent(new Event("unread-refresh"));

      setIsArchived(willArchive);
      if (willArchive) {
        router.push("/chat");
      } else {
        showToast("Chat moved back to your inbox", "success");
      }
    } catch (err) {
      console.error("Archive error:", err);
      showToast(willArchive ? "Failed to archive chat" : "Failed to unarchive chat", "error");
    }
  };

  const executeMarkUnread = async () => {
    if (!activeRoomId) return;
    try {
      const { error } = await supabase.rpc("mark_room_unread", { p_room: activeRoomId });
      if (error) throw error;
      window.dispatchEvent(new Event("unread-refresh"));
      router.push("/chat");
    } catch (err) {
      console.error("Mark unread error:", err);
      showToast("Failed to mark as unread", "error");
    }
  };

  const executeDeleteConversation = async () => {
    if (!activeRoomId) return;
    try {
      const { error } = await supabase.rpc("delete_direct_room", { p_room: activeRoomId });
      if (error) throw error;
      window.dispatchEvent(new Event("unread-refresh"));
      router.push("/chat");
    } catch (err) {
      console.error("Delete conversation error:", err);
      showToast("Failed to delete conversation", "error");
      closeModal();
    }
  };

  const handleCopyText = async (text, id) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Could not copy text: ", err);
    }
  };

  const toggleTimestamp = (id) => {
    setShowTimestampId(showTimestampId === id ? null : id);
  };

  if (loading) {
    return (
      <div className="text-foreground w-full h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-foreground" size={40} />
      </div>
    );
  }

  const derivedName = `${otherUser?.First_Name || ""} ${otherUser?.Last_Name || ""}`.trim();
  const otherName =
    otherUser?.full_name ||
    (derivedName.length > 0 ? derivedName : null) ||
    otherUser?.email ||
    "Unknown User";

  const menuItemClass =
    "w-full flex items-center gap-3 px-4 py-2.5 text-left font-semibold text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer";

  return (
    <div
      className="text-foreground w-full h-[calc(100vh-4rem)] max-h-screen overflow-hidden flex flex-col transition-colors"
      onClick={() => showMenu && setShowMenu(false)}
    >
      {/* TOAST NOTIFICATION */}
      {toast.show && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[10000] animate-in fade-in slide-in-from-top-4 duration-200">
          <div
            className={`px-4 py-2.5 rounded-xl shadow-xl border text-sm font-semibold flex items-center gap-2 ${toast.type === "success"
              ? "bg-foreground text-background border-transparent"
              : toast.type === "error"
                ? "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
                : "bg-muted border-border text-foreground"
              }`}
          >
            {toast.type === "success" && <Check size={16} className="text-emerald-500" />}
            {toast.message}
          </div>
        </div>
      )}

      <div className="max-w-3xl w-full mx-auto h-full flex flex-col border-x border-border overflow-hidden">
        {/* HEADER BAR */}
        <div className="p-4 border-b border-border bg-white dark:bg-neutral-900 flex items-center gap-4 relative z-40 shrink-0">          <button
          onClick={() => router.push("/chat")}
          className="text-foreground hover:bg-accent hover:text-foreground transition-colors p-2 rounded-full cursor-pointer"
          title="Back to messages"
        >
          <ArrowLeft size={20} />
        </button>

          {/* Clickable Profile Link */}
          {otherUser?.id ? (
            <Link
              href={`/profile/${otherUser.id}`}
              className="flex items-center gap-3 flex-1 min-w-0 group hover:opacity-80 transition-opacity"
            >
              <div className="w-10 h-10 bg-white dark:bg-neutral-900 rounded-full flex items-center justify-center text-foreground font-bold overflow-hidden shrink-0 border border-border">
                {otherUser?.avatar_url ? (
                  <img
                    src={otherUser.avatar_url}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  otherName.charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-foreground truncate group-hover:underline">
                  {otherName}
                </h2>
                <p className="text-[11px] text-muted-foreground font-semibold truncate">
                  {productContext ? `Re: ${productContext.title}` : "View Profile →"}
                </p>
              </div>
            </Link>
          ) : (
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center text-foreground font-bold overflow-hidden shrink-0 border border-border">
                {otherName.charAt(0).toUpperCase()}
              </div>
              <h2 className="text-base font-bold text-foreground truncate">{otherName}</h2>
            </div>
          )}

          <div className="relative ml-auto shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="text-foreground hover:bg-accent transition-colors p-2 rounded-full cursor-pointer"
            >
              <MoreVertical size={20} />
            </button>

            {/* SOLID OPAQUE DROPDOWN */}
            {showMenu && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl overflow-hidden z-50 py-1">
                <button
                  className={`${menuItemClass} text-neutral-800 dark:text-neutral-200`}
                  onClick={() => {
                    setShowMenu(false);
                    executeMarkUnread();
                  }}
                >
                  <Mail size={15} /> Mark as unread
                </button>
                <button
                  className={`${menuItemClass} text-neutral-800 dark:text-neutral-200`}
                  onClick={() => {
                    setShowMenu(false);
                    executeToggleArchive();
                  }}
                >
                  {isArchived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                  {isArchived ? "Unarchive" : "Archive"}
                </button>
                <button
                  className={`${menuItemClass} text-neutral-800 dark:text-neutral-200`}
                  onClick={() => {
                    setActiveModal("report");
                    setShowMenu(false);
                  }}
                >
                  <Flag size={15} className="text-rose-500" /> Report user
                </button>

                {iBlocked ? (
                  <button
                    className={`${menuItemClass} text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10`}
                    onClick={() => {
                      setActiveModal("unblock");
                      setShowMenu(false);
                    }}
                  >
                    <Check size={15} /> Unblock user
                  </button>
                ) : (
                  <button
                    className={`${menuItemClass} text-rose-600 dark:text-rose-400 hover:bg-rose-500/10`}
                    onClick={() => {
                      setActiveModal("block");
                      setShowMenu(false);
                    }}
                  >
                    <Ban size={15} /> Block user
                  </button>
                )}

                <button
                  className={`${menuItemClass} text-rose-600 dark:text-rose-400 hover:bg-rose-500/10`}
                  onClick={() => {
                    setActiveModal("delete");
                    setShowMenu(false);
                  }}
                >
                  <Trash2 size={15} /> Delete conversation
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ITEM CONTEXT BANNER: only for chats that were started from a listing */}
        {productContext && (
          <ChatProductBanner
            product={productContext}
            currentUserId={currentUser?.id}
            otherUser={otherUser}
            otherName={otherName}
            onChanged={refreshProductContext}
            showToast={showToast}
          />
        )}

        {/* MESSAGE THREAD */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-4 bg-background scrollbar-thin">
          {messages.map((m) => {
            const isMine = m.sender_id === currentUser?.id;
            const isTimestampOpen = showTimestampId === m.id;

            if (m.is_unsent || m.body === "Message was unsent") {
              const unsentTime = m.unsent_at || m.created_at;
              return (
                <div
                  key={m.id}
                  className="flex flex-col items-center justify-center my-4 space-y-1 cursor-pointer select-none"
                  onClick={() => toggleTimestamp(m.id)}
                >
                  <span className="text-xs text-muted-foreground italic bg-muted px-4 py-1.5 rounded-full border border-border hover:opacity-80 transition-opacity">
                    {isMine ? "You unsent a message" : `${otherName} unsent a message`}
                  </span>
                  {isTimestampOpen && (
                    <span className="text-[10px] text-muted-foreground animate-in fade-in slide-in-from-top-1 duration-150">
                      Unsent on {formatDateTime(unsentTime)}
                    </span>
                  )}
                </div>
              );
            }

            return (
              <div
                key={m.id}
                className={`flex flex-col ${isMine ? "items-end" : "items-start"} space-y-1 group relative`}
              >
                {/* ATTACHMENT IMAGE */}
                {m.image_url && (
                  <div
                    className="relative my-1 max-w-[240px] sm:max-w-xs rounded-2xl overflow-hidden border border-border bg-muted shadow-xs cursor-pointer hover:opacity-95 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveOverlayImage(m.image_url);
                    }}
                  >
                    <img
                      src={m.image_url}
                      alt="Message attachment"
                      className="w-full h-auto max-h-[280px] object-cover block"
                      onLoad={scrollToBottom}
                    />
                  </div>
                )}

                {/* TEXT BUBBLE */}
                {m.body && m.body !== "Sent an image" && (
                  <div
                    onClick={() => toggleTimestamp(m.id)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      handleCopyText(m.body, m.id);
                    }}
                    className={`p-3 rounded-2xl max-w-[80%] shadow-xs relative cursor-pointer select-text transition-all duration-150 active:scale-[0.99] ${isMine
                      ? "bg-foreground text-background font-medium rounded-br-xs"
                      : "bg-muted text-foreground font-medium rounded-bl-xs border border-border"
                      }`}
                  >
                    <p className="text-sm break-words whitespace-pre-wrap px-0.5 pointer-events-none">
                      {m.body}
                    </p>

                    <div
                      className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-1 transition-all opacity-0 group-hover:opacity-100 focus-within:opacity-100 hidden sm:flex ${isMine ? "-left-16" : "-right-16"
                        }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => handleCopyText(m.body, m.id)}
                        className="p-1.5 rounded-md bg-card shadow-xs border border-border text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Copy text"
                      >
                        {copiedId === m.id ? (
                          <Check size={13} className="text-emerald-500" />
                        ) : (
                          <Copy size={13} />
                        )}
                      </button>

                      {isMine && (
                        <button
                          onClick={() => {
                            setSelectedMessageId(m.id);
                            setActiveModal("unsend");
                          }}
                          className="p-1.5 rounded-md bg-card shadow-xs border border-border text-muted-foreground hover:text-rose-500 cursor-pointer"
                          title="Unsend message"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {isTimestampOpen && (
                  <span
                    className={`text-[10px] text-muted-foreground px-1 pt-1 animate-in fade-in slide-in-from-top-1 duration-150 ${isMine ? "text-right" : "text-left"
                      }`}
                  >
                    Sent {formatDateTime(m.created_at)}
                  </span>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* FOOTER CONTROL BAR */}
        <div className="shrink-0 bg-card border-t border-border">
          {isBlocked ? (
            <div className="p-4 bg-muted/60 text-center text-xs font-semibold text-muted-foreground italic select-none">
              {iBlocked
                ? "You have blocked this user. Unblock them to resume conversation."
                : "You cannot send or reply to messages in this conversation."}
            </div>
          ) : (
            <ChatInput roomId={activeRoomId} sellerId={sellerId} />
          )}
        </div>
      </div>

      {/* OVERLAY IMAGE VIEWPORT */}
      {activeOverlayImage && (
        <div
          className="fixed inset-0 bg-black/90 z-[999] flex items-center justify-center p-4 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
          onClick={() => setActiveOverlayImage(null)}
        >
          <button
            onClick={() => setActiveOverlayImage(null)}
            className="absolute top-4 right-4 bg-card text-foreground hover:bg-accent p-2.5 rounded-full z-[1000] border border-border cursor-pointer"
          >
            <X size={20} />
          </button>
          <div
            className="relative max-w-4xl max-h-[85vh] w-full h-full flex items-center justify-center animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={activeOverlayImage}
              alt="Expanded preview"
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* CONFIRM DIALOGS */}
      {activeModal === "unsend" && (
        <ConfirmModal
          title="Unsend message?"
          description="This will remove the message content for everyone in the chat room. This action cannot be undone."
          confirmLabel="Unsend message"
          onConfirm={executeUnsend}
          onCancel={closeModal}
        />
      )}
      {activeModal === "block" && (
        <ConfirmModal
          title={`Block ${otherName}?`}
          description="Neither of you will be able to send messages in this conversation. You can unblock them anytime."
          confirmLabel="Block user"
          showIcon
          onConfirm={executeBlockUser}
          onCancel={closeModal}
        />
      )}
      {activeModal === "unblock" && (
        <ConfirmModal
          title={`Unblock ${otherName}?`}
          description="Messaging will work again between both accounts."
          confirmLabel="Unblock"
          tone="safe"
          onConfirm={executeUnblockUser}
          onCancel={closeModal}
        />
      )}
      {activeModal === "delete" && (
        <ConfirmModal
          title="Delete conversation?"
          description="This removes the conversation from your list. The other person will still have their copy. If they message you again, a new conversation will appear."
          confirmLabel="Delete conversation"
          onConfirm={executeDeleteConversation}
          onCancel={closeModal}
        />
      )}

      {/* REPORT MODAL */}
      {activeModal === "report" && (
        <div
          className="fixed inset-0 bg-black/75 z-[9999] backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => {
            closeModal();
            setReportReason("");
          }}
        >
          <div
            className="relative z-10 w-full max-w-md bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-1">
              Report profile
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
              Detail the issues regarding <strong>{otherName}</strong> for moderator review.
            </p>

            <div className="flex flex-wrap gap-1.5 mb-3">
              {["Spam/Scam", "Harassment", "Inappropriate", "Suspicious Listing"].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() =>
                    setReportReason((prev) => (prev ? `${prev} - ${preset}` : preset))
                  }
                  className="px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-[11px] font-semibold text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                >
                  + {preset}
                </button>
              ))}
            </div>

            <textarea
              className="w-full min-h-[90px] bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl p-3 text-xs font-medium text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 resize-none mb-4 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
              placeholder="Type your reason here..."
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  closeModal();
                  setReportReason("");
                }}
                className="px-4 py-2 text-xs font-bold border border-neutral-200 dark:border-neutral-700 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-700 dark:text-neutral-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={executeReportUser}
                disabled={!reportReason.trim()}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs"
              >
                Submit report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}