'use client';

import { toast } from "sonner";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { banUserAction } from './actions';
import { ui, btn } from '../ui';
import {
  ShieldAlert,
  CheckCircle2,
  UserCheck,
  MessageSquare,
  XCircle,
  ExternalLink,
  Clock,
  AlertCircle,
  Loader2,
  RotateCcw,
  Package,
  MessageCircle,
  Ban,
  Trash2,
} from 'lucide-react';

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [productLinks, setProductLinks] = useState({});
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  const [reportCategory, setReportCategory] = useState('chat');
  const [filterStatus, setFilterStatus] = useState('pending');

  const [userEmail, setUserEmail] = useState(null);
  const [userName, setUserName] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reports')
        .select(`
          id,
          reason,
          context_room_id,
          product_id,
          status,
          action_taken,
          resolution_note,
          created_at,
          reporter:reporter_id ( id, full_name, email, avatar_url, "First_Name", "Last_Name" ),
          reported:reported_id ( id, full_name, email, avatar_url, "First_Name", "Last_Name" ),
          product:product_id ( id, title, image_urls )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const fetchedReports = data || [];
      setReports(fetchedReports);

      const linksMap = {};
      for (const r of fetchedReports) {
        if (r.product_id) {
          linksMap[r.id] = r.product_id;
        } else if (r.reason && r.reason.includes('[Product Report:')) {
          const match = r.reason.match(/\[Product Report:\s*"([^"]+)"\]/);
          if (match && match[1]) {
            const productTitle = match[1];
            const { data: prodData } = await supabase
              .from('products')
              .select('id')
              .ilike('title', productTitle)
              .maybeSingle();

            if (prodData) {
              linksMap[r.id] = prodData.id;
            }
          }
        }
      }
      setProductLinks(linksMap);
    } catch (err) {
      console.error('Error fetching reports:', err.message || err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function checkRoleAndUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserEmail(session.user.email || null);

        const { data: profile } = await supabase
          .from('profiles')
          .select('role, full_name, avatar_url, "First_Name", "Last_Name"')
          .eq('id', session.user.id)
          .maybeSingle();

        const derivedName = `${profile?.First_Name || ''} ${profile?.Last_Name || ''}`.trim();
        setUserName(profile?.full_name || (derivedName.length > 0 ? derivedName : null) || session.user.email || 'User');
        setAvatarUrl(profile?.avatar_url || null);
      }
    }

    checkRoleAndUser();
    fetchReports();

    const channel = supabase
      .channel('realtime-reports-queue')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reports' },
        () => {
          fetchReports();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const [modal, setModal] = useState(null); // { type: 'ban' | 'remove', report }
  const [modalReason, setModalReason] = useState('');

  const runAction = async (reportId, fn, failLabel) => {
    setUpdatingId(reportId);
    try {
      const { error } = await fn();
      if (error) throw error;
      await fetchReports();
    } catch (err) {
      toast.error(`${failLabel}: ` + (err.message || err));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleResolve = (id) => runAction(id, () => supabase.rpc('moderate_resolve_report', { p_report_id: id }), 'Failed to resolve');
  const handleDismiss = (id) => runAction(id, () => supabase.rpc('moderate_dismiss_report', { p_report_id: id }), 'Failed to dismiss');
  const handleReopen = (id) => runAction(id, () => supabase.rpc('moderate_reopen_report', { p_report_id: id }), 'Failed to re-open');

  const submitModal = async () => {
    const reason = modalReason.trim();
    if (!modal || !reason) return;
    const { type, report } = modal;
    setModal(null);
    setModalReason('');

    if (type === 'ban') {
      await runAction(report.id, () => banUserAction(report.reported?.id, reason, report.id), 'Failed to ban user');
    } else {
      await runAction(
        report.id,
        () => supabase.rpc('moderate_remove_listing', {
          p_product_id: report.product_id || report.product?.id,
          p_reason: reason,
          p_report_id: report.id,
        }),
        'Failed to remove listing'
      );
    }
  };

  const isProductReport = (r) => {
    return Boolean(r.product_id || r.product?.id || (r.reason && r.reason.includes('[Product Report')));
  };

  const filteredReports = reports.filter((r) => {
    const status = r.status || 'pending';
    const matchesStatus = status === filterStatus;
    const matchesCategory = reportCategory === 'product' ? isProductReport(r) : !isProductReport(r);

    return matchesStatus && matchesCategory;
  });

  const resolveName = (p) => {
    if (!p) return 'Unknown User';
    const derived = `${p.First_Name || ''} ${p.Last_Name || ''}`.trim();
    return p.full_name || (derived.length > 0 ? derived : null) || p.email || 'Unknown User';
  };

  return (
    <div className={ui.page}>
      {/* HEADER SECTION */}
      <div className={ui.headerBar}>
        <div>
          <h1 className={ui.title}>
            <ShieldAlert className={ui.titleIcon} size={28} /> Moderation Queue
          </h1>
          <p className={ui.subtitle}>
            Review separated chat and product reports, inspect targets, and manage archives.
          </p>
        </div>

        {/* LOGGED IN USER CARD */}
        {userEmail && (
          <div className={`${ui.card} flex items-center gap-3 px-4 py-2.5`}>
            <div className="w-8 h-8 rounded-full bg-tint border border-line flex items-center justify-center font-bold text-xs text-foreground shrink-0 overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                userName ? userName.charAt(0).toUpperCase() : 'U'
              )}
            </div>
            <div className="text-left overflow-hidden">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-soft flex items-center gap-1">
                <UserCheck size={12} className="text-brand" /> Moderator Active
              </p>
              <p className="text-xs font-bold text-foreground truncate max-w-[160px]">{userName || userEmail}</p>
            </div>
          </div>
        )}
      </div>

      {/* MAIN CATEGORY SWITCHER */}
      <div className="grid grid-cols-2 gap-3 p-1.5 bg-tint rounded-2xl border border-line">
        <button
          onClick={() => setReportCategory('chat')}
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${reportCategory === 'chat'
            ? 'bg-brand text-on-brand shadow-sm'
            : 'text-ink-soft hover:text-brand-deep'
            }`}
        >
          <MessageCircle size={16} />
          Chat Reports
        </button>

        <button
          onClick={() => setReportCategory('product')}
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${reportCategory === 'product'
            ? 'bg-brand text-on-brand shadow-sm'
            : 'text-ink-soft hover:text-brand-deep'
            }`}
        >
          <Package size={16} />
          Product Listing Reports
        </button>
      </div>

      {/* SUB-STATUS FILTER TABS */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line pb-4">
        <button
          onClick={() => setFilterStatus('pending')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${filterStatus === 'pending'
            ? 'bg-brand text-on-brand border-brand shadow-sm'
            : 'bg-tint text-ink-soft border-line hover:text-brand-deep'
            }`}
        >
          Pending ({reports.filter((r) => (r.status || 'pending') === 'pending' && (reportCategory === 'product' ? isProductReport(r) : !isProductReport(r))).length})
        </button>
        <button
          onClick={() => setFilterStatus('resolved')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${filterStatus === 'resolved'
            ? 'bg-brand text-on-brand border-brand shadow-sm'
            : 'bg-tint text-ink-soft border-line hover:text-brand-deep'
            }`}
        >
          Resolved Archive ({reports.filter((r) => r.status === 'resolved' && (reportCategory === 'product' ? isProductReport(r) : !isProductReport(r))).length})
        </button>
        <button
          onClick={() => setFilterStatus('dismissed')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${filterStatus === 'dismissed'
            ? 'bg-brand text-on-brand border-brand shadow-sm'
            : 'bg-tint text-ink-soft border-line hover:text-brand-deep'
            }`}
        >
          Dismissed Archive ({reports.filter((r) => r.status === 'dismissed' && (reportCategory === 'product' ? isProductReport(r) : !isProductReport(r))).length})
        </button>
      </div>

      {/* QUEUE CONTENT */}
      {loading ? (
        <div className="border border-line rounded-2xl bg-surface p-16 text-center flex flex-col items-center justify-center min-h-[300px] shadow-sm">
          <Loader2 size={32} className="animate-spin text-ink-soft mb-3" />
          <p className="text-sm font-semibold text-ink-soft">Loading reports queue...</p>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="border border-line rounded-2xl bg-surface p-16 text-center flex flex-col items-center justify-center min-h-[350px] shadow-sm space-y-2">
          <CheckCircle2 size={48} className="text-ink-soft/40 mb-2" />
          <h3 className="text-base font-bold text-foreground">Queue Cleared</h3>
          <p className="text-sm text-ink-soft">
            No {filterStatus} {reportCategory} reports recorded right now.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReports.map((report) => {
            const reporterName = resolveName(report.reporter);
            const reportedName = resolveName(report.reported);
            const isUpdating = updatingId === report.id;
            const status = report.status || 'pending';
            const resolvedProductId = report.product_id || report.product?.id || productLinks[report.id];

            return (
              <div
                key={report.id}
                className={`bg-surface border border-line rounded-2xl p-5 shadow-sm space-y-4 transition-all ${isUpdating ? 'opacity-50 pointer-events-none' : ''
                  }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
                  <div className="flex items-center gap-3">
                    <span className={`p-2 rounded-xl border ${status === 'resolved'
                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                      : status === 'dismissed'
                        ? 'bg-neutral-500/10 text-neutral-500 border-neutral-500/20'
                        : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                      }`}>
                      <AlertCircle size={18} />
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">
                        Reported User: <span className="text-rose-600 dark:text-rose-400">{reportedName}</span>
                      </h4>
                      <p className="text-xs text-ink-soft flex items-center gap-2 mt-0.5">
                        <span>Submitted by: <strong>{reporterName}</strong></span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} /> {new Date(report.created_at).toLocaleString()}
                        </span>
                      </p>
                    </div>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border w-fit ${status === 'resolved'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                      : status === 'dismissed'
                        ? 'bg-neutral-500/15 text-neutral-500 border-neutral-500/30'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                      }`}
                  >
                    {status}
                  </span>
                </div>

                {/* REASON BOX */}
                <div className="p-3.5 rounded-xl bg-tint border border-line">
                  <p className="text-xs font-bold text-ink-soft uppercase tracking-wider mb-1">
                    Report Reason / Details
                  </p>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-line font-medium">
                    "{report.reason}"
                  </p>
                </div>

                {status !== 'pending' && report.action_taken && (
                  <p className="text-xs text-ink-soft">
                    Action: <strong>{report.action_taken.replaceAll('_', ' ')}</strong>
                    {report.resolution_note ? ` — ${report.resolution_note}` : ''}
                  </p>
                )}

                {/* ACTION BUTTONS & LINKS */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {report.context_room_id && (
                      <Link
                        href={`/chat/${report.context_room_id}`}
                        className={btn("outline", "sm")}
                      >
                        <MessageSquare size={14} /> Inspect Chat Context <ExternalLink size={12} />
                      </Link>
                    )}

                    {resolvedProductId && (
                      <Link
                        href={`/products/${resolvedProductId}`}
                        className={btn("outline", "sm")}
                      >
                        <Package size={14} /> Inspect Product Listing <ExternalLink size={12} />
                      </Link>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 ml-auto">
                    {status === 'pending' && (
                      <>
                        {report.reported?.id && (
                          <button
                            onClick={() => setModal({ type: 'ban', report })}
                            disabled={isUpdating}
                            className={btn("dangerOutline", "sm")}
                          >
                            <Ban size={14} /> Ban User
                          </button>
                        )}
                        {(report.product_id || report.product?.id) && (
                          <button
                            onClick={() => setModal({ type: 'remove', report })}
                            disabled={isUpdating}
                            className={btn("dangerOutline", "sm")}
                          >
                            <Trash2 size={14} /> Remove Listing
                          </button>
                        )}
                        <button
                          onClick={() => handleResolve(report.id)}
                          disabled={isUpdating}
                          className={btn("primary", "sm")}
                        >
                          <CheckCircle2 size={14} /> Mark Resolved
                        </button>
                        <button
                          onClick={() => handleDismiss(report.id)}
                          disabled={isUpdating}
                          className={btn("outline", "sm")}
                        >
                          <XCircle size={14} /> Dismiss
                        </button>
                      </>
                    )}

                    {status !== 'pending' && (
                      <button
                        onClick={() => handleReopen(report.id)}
                        disabled={isUpdating}
                        className={btn("outline", "sm")}
                        title="Re-open into pending queue"
                      >
                        <RotateCcw size={14} /> Re-open
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {modal && (
        <div className="fixed inset-0 bg-black/60 z-[9999] backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => { setModal(null); setModalReason(''); }}>
          <div className="w-full max-w-md bg-surface text-foreground border border-line rounded-2xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-1">
              {modal.type === 'ban'
                ? `Ban ${resolveName(modal.report.reported)}?`
                : `Remove "${modal.report.product?.title || 'this listing'}"?`}
            </h3>
            <p className="text-xs text-ink-soft mb-4">
              {modal.type === 'ban'
                ? 'They are signed out, cannot post or message, and their listings are hidden. An admin can reverse this.'
                : 'The listing is hidden and marked unavailable. The owner cannot restore it.'}
            </p>
            <textarea
              className={`${ui.input} w-full min-h-[90px] resize-none mb-4 text-xs`}
              placeholder="Reason (required, saved with the report)"
              value={modalReason}
              onChange={(e) => setModalReason(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => { setModal(null); setModalReason(''); }}
                className={btn("outline", "sm")}>
                Cancel
              </button>
              <button onClick={submitModal} disabled={!modalReason.trim()}
                className={btn("danger", "sm")}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}