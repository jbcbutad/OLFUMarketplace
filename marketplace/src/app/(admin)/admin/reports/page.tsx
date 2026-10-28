'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { toast } from "sonner";
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { banUserAction } from './actions';
import { ui, btn } from '../ui';
import {
  ShieldAlert,
  CheckCircle2,
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
  Search,
  ArrowRight,
  Flame,
} from 'lucide-react';

// "[Product Report: "Title"]" is added to the reason by the report form. Used to find the item
// when a report has no product_id, and removed from the text we show.
const PRODUCT_TAG_RE = /\[Product Report:\s*"([^"]+)"\]\s*/i;
const productTitleFromReason = (reason?: string | null) => reason?.match(PRODUCT_TAG_RE)?.[1] ?? null;
const cleanReason = (reason?: string | null) => (reason || '').replace(PRODUCT_TAG_RE, '').trim();

function Avatar({ name, url, size = 36 }: { name: string; url?: string | null; size?: number }) {
  const initials =
    name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
  return url ? (
    <img
      src={url}
      alt=""
      style={{ width: size, height: size }}
      className="rounded-full object-cover shrink-0 border border-line bg-tint"
    />
  ) : (
    <div
      style={{ width: size, height: size }}
      className="rounded-full shrink-0 flex items-center justify-center bg-tint text-ink-soft text-[11px] font-black border border-line"
    >
      {initials}
    </div>
  );
}

// One person in a report (the reporter or the reported user)
function Party({
  label,
  name,
  profile,
  tone,
  extra,
}: {
  label: string;
  name: string;
  profile?: any;
  tone: 'reporter' | 'reported';
  extra?: React.ReactNode;
}) {
  return (
    <div
      className={`flex-1 min-w-0 flex items-center gap-3 p-3 rounded-xl border ${tone === 'reported'
        ? 'border-rose-500/25 bg-rose-500/5'
        : 'border-line bg-tint'
        }`}
    >
      <Avatar name={name} url={profile?.avatar_url} size={40} />
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wider text-ink-soft">{label}</p>
        <p className="text-sm font-bold text-foreground truncate">{name}</p>
        {profile?.email && <p className="text-[11px] text-ink-soft truncate">{profile.email}</p>}
        {extra}
      </div>
    </div>
  );
}

const CONFIRM_COPY = {
  resolve: {
    title: 'Mark as resolved?',
    message: 'This report will move to the Resolved Archive.',
    confirmText: 'Mark Resolved',
    style: 'primary',
  },
  dismiss: {
    title: 'Dismiss this report?',
    message: 'This report will move to the Dismissed Archive with no action taken.',
    confirmText: 'Dismiss',
    style: 'danger',
  },
  reopen: {
    title: 'Re-open this report?',
    message: 'This report will go back into the pending queue.',
    confirmText: 'Re-open',
    style: 'primary',
  },
};

function ReportsContent() {
  const [reports, setReports] = useState([]);
  // Items found by the title in the report reason (for reports saved without a product_id)
  const [linkedProducts, setLinkedProducts] = useState<Record<string, any>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  const [reportCategory, setReportCategory] = useState('chat');
  const [filterStatus, setFilterStatus] = useState('pending');

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
          product:product_id ( id, title, image_urls, status, seller_id )
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      const fetchedReports: any[] = (data as any[]) || [];
      setReports(fetchedReports);

      // Reports saved without a product_id: find the item from the title in the reason
      const titles = [
        ...new Set(
          fetchedReports
            .filter((r) => !r.product_id && !r.product?.id)
            .map((r) => productTitleFromReason(r.reason))
            .filter(Boolean)
        ),
      ] as string[];
      const byTitle: Record<string, any> = {};
      await Promise.all(
        titles.map(async (title) => {
          const { data: rows } = await supabase
            .from('products')
            .select('id, title, image_urls, status, seller_id')
            .ilike('title', title.replace(/[%_\\]/g, (m) => '\\' + m))
            .order('created_at', { ascending: false })
            .limit(1);
          if (rows && rows[0]) byTitle[title.toLowerCase()] = rows[0];
        })
      );
      const linksMap: Record<string, any> = {};
      for (const r of fetchedReports) {
        if (r.product_id || r.product?.id) continue;
        const t = productTitleFromReason(r.reason);
        if (t && byTitle[t.toLowerCase()]) linksMap[r.id] = byTitle[t.toLowerCase()];
      }
      setLinkedProducts(linksMap);
    } catch (err) {
      console.error('Error fetching reports:', err.message || err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  // ---- Jump to a specific report (from the notification bell: /admin/reports?report=<id>) ----
  const searchParams = useSearchParams();
  const targetId = searchParams?.get('report') ?? null;
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const handledRef = useRef<string | null>(null);

  // Switch to the report's tab and status, clear the search, then highlight it
  useEffect(() => {
    if (!targetId || loading || handledRef.current === targetId) return;
    const r: any = reports.find((x: any) => String(x.id) === targetId);
    handledRef.current = targetId;
    if (!r) {
      toast.error(`Report ${targetId} was not found (only the latest 200 reports are loaded).`);
      return;
    }
    setReportCategory(isProductReport(r) ? 'product' : 'chat');
    setFilterStatus(r.status || 'pending');
    setSearch('');
    setHighlightId(targetId);
  }, [targetId, reports, loading]);

  // Scroll to it once the right tab has rendered, then fade the highlight
  useEffect(() => {
    if (!highlightId) return;
    const t1 = setTimeout(() => {
      document.getElementById(`report-${highlightId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
    const t2 = setTimeout(() => setHighlightId(null), 6000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [highlightId]);

  const [modal, setModal] = useState(null); // { type: 'ban' | 'remove', report }
  const [chatView, setChatView] = useState(null); // { report, messages, loading }
  const [modalReason, setModalReason] = useState('');
  const [confirmAction, setConfirmAction] = useState(null); // { type, report }

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
  const requestAction = (type, report) => setConfirmAction({ type, report });

  const closeConfirm = () => {
    if (!updatingId) setConfirmAction(null);
  };

  const handleConfirm = async () => {
    const { type, report } = confirmAction;
    setConfirmAction(null);
    if (type === 'resolve') await handleResolve(report.id);
    else if (type === 'dismiss') await handleDismiss(report.id);
    else await handleReopen(report.id);
  };

  // Close the popup with Escape
  useEffect(() => {
    if (!confirmAction) return;
    const onKey = (e) => e.key === 'Escape' && closeConfirm();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmAction, updatingId]);

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
          p_product_id: productIdOf(report),
          p_reason: reason,
          p_report_id: report.id,
        }),
        'Failed to remove listing'
      );
    }
  };

  const openChat = async (report) => {
    setChatView({ report, messages: [], loading: true });
    const { data, error } = await supabase.rpc('moderate_get_reported_chat', { p_report_id: report.id });
    if (error) {
      toast.error('Could not load chat: ' + error.message);
      setChatView(null);
      return;
    }
    setChatView({ report, messages: data || [], loading: false });
  };

  // The reported item for a report: from product_id, else found by the title in the reason
  const productOf = (r) => r.product || linkedProducts[r.id] || null;
  const productIdOf = (r) => r.product_id || r.product?.id || linkedProducts[r.id]?.id || null;

  const isProductReport = (r) => {
    return Boolean(r.product_id || r.product?.id || (r.reason && r.reason.includes('[Product Report')));
  };

  const resolveName = (p) => {
    if (!p) return 'Unknown User';
    const derived = `${p.First_Name || ''} ${p.Last_Name || ''}`.trim();
    return p.full_name || (derived.length > 0 ? derived : null) || p.email || 'Unknown User';
  };

  const inCategory = (r, cat) => (cat === 'product' ? isProductReport(r) : !isProductReport(r));
  const countOf = (cat, status) =>
    reports.filter((r) => (r.status || 'pending') === status && inCategory(r, cat)).length;

  // How many reports each user has received (to spot repeat offenders)
  const againstUser: Record<string, { total: number; pending: number }> = {};
  reports.forEach((r) => {
    const id = r.reported?.id;
    if (!id) return;
    if (!againstUser[id]) againstUser[id] = { total: 0, pending: 0 };
    againstUser[id].total += 1;
    if ((r.status || 'pending') === 'pending') againstUser[id].pending += 1;
  });

  const query = search.trim().toLowerCase();
  const filteredReports = reports.filter((r) => {
    const status = r.status || 'pending';
    if (status !== filterStatus || !inCategory(r, reportCategory)) return false;
    if (!query) return true;
    const haystack = [
      resolveName(r.reporter),
      resolveName(r.reported),
      r.reporter?.email,
      r.reported?.email,
      cleanReason(r.reason),
      productOf(r)?.title,
      productTitleFromReason(r.reason),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });

  return (
    <div className={ui.page}>
      {/* HEADER SECTION */}
      <div className={ui.headerBar}>
        <div>
          <h1 className={ui.title}>
            <ShieldAlert className={ui.titleIcon} size={28} /> Moderation Queue
          </h1>
          <p className={ui.subtitle}>
            Review user and listing reports, inspect the reported item or chat, and manage archives.
          </p>
        </div>
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
          User & Chat Reports
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${reportCategory === 'chat' ? 'bg-white/20' : 'bg-rose-500/15 text-rose-600'}`}>
            {countOf('chat', 'pending')}
          </span>
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
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${reportCategory === 'product' ? 'bg-white/20' : 'bg-rose-500/15 text-rose-600'}`}>
            {countOf('product', 'pending')}
          </span>
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
          Pending ({countOf(reportCategory, 'pending')})
        </button>
        <button
          onClick={() => setFilterStatus('resolved')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${filterStatus === 'resolved'
            ? 'bg-brand text-on-brand border-brand shadow-sm'
            : 'bg-tint text-ink-soft border-line hover:text-brand-deep'
            }`}
        >
          Resolved Archive ({countOf(reportCategory, 'resolved')})
        </button>
        <button
          onClick={() => setFilterStatus('dismissed')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${filterStatus === 'dismissed'
            ? 'bg-brand text-on-brand border-brand shadow-sm'
            : 'bg-tint text-ink-soft border-line hover:text-brand-deep'
            }`}
        >
          Dismissed Archive ({countOf(reportCategory, 'dismissed')})
        </button>
      </div>

      {/* SEARCH */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={reportCategory === 'product' ? 'Search by item, seller, reporter or reason...' : 'Search by user, email or reason...'}
          className={`${ui.input} w-full pl-10 text-xs`}
        />
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
            {query
              ? 'No reports match your search.'
              : `No ${filterStatus} ${reportCategory === 'product' ? 'product listing' : 'user & chat'} reports recorded right now.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReports.map((report) => {
            const reporterName = resolveName(report.reporter);
            const reportedName = resolveName(report.reported);
            const isUpdating = updatingId === report.id;
            const status = report.status || 'pending';
            const product = productOf(report);
            const resolvedProductId = productIdOf(report);
            const isProduct = isProductReport(report);
            const productImage = product?.image_urls?.[0];
            const productTitle = product?.title || productTitleFromReason(report.reason);
            const against = report.reported?.id ? againstUser[report.reported.id] : null;
            const details = cleanReason(report.reason);

            return (
              <div
                key={report.id}
                id={`report-${report.id}`}
                style={
                  String(highlightId) === String(report.id)
                    ? { boxShadow: '0 0 0 3px #f43f5e, 0 0 0 7px rgba(244,63,94,0.25), 0 0 28px rgba(244,63,94,0.45)' }
                    : undefined
                }
                className={`bg-surface border border-line rounded-2xl p-5 shadow-sm space-y-4 transition-all ${isUpdating ? 'opacity-50 pointer-events-none' : ''
                  } ${String(highlightId) === String(report.id) ? 'animate-pulse' : ''}`}
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
                        {isProduct ? (
                          <>
                            Reported Listing:{' '}
                            <span className="text-rose-600 dark:text-rose-400">{productTitle || 'Unknown listing'}</span>
                          </>
                        ) : (
                          <>
                            Reported User: <span className="text-rose-600 dark:text-rose-400">{reportedName}</span>
                          </>
                        )}
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

                {/* REPORTED ITEM (product listing reports) */}
                {isProduct && (
                  <div className="flex gap-4 p-3 rounded-xl border border-line bg-tint">
                    {resolvedProductId ? (
                      <Link href={`/products/${resolvedProductId}`} className="shrink-0">
                        {productImage ? (
                          <img src={productImage} alt={productTitle || 'Reported item'} className="w-24 h-24 rounded-xl object-cover border border-line bg-surface" />
                        ) : (
                          <div className="w-24 h-24 rounded-xl border border-line bg-surface flex items-center justify-center text-ink-soft">
                            <Package size={28} />
                          </div>
                        )}
                      </Link>
                    ) : (
                      <div className="w-24 h-24 rounded-xl border border-dashed border-line bg-surface flex items-center justify-center text-ink-soft shrink-0">
                        <Package size={28} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1 flex flex-col justify-center gap-1">
                      <p className="text-[10px] font-black uppercase tracking-wider text-ink-soft">Reported item</p>
                      {resolvedProductId ? (
                        <Link href={`/products/${resolvedProductId}`} className="text-base font-bold text-foreground hover:underline line-clamp-2">
                          {productTitle || 'View listing'}
                        </Link>
                      ) : (
                        <p className="text-base font-bold text-foreground line-clamp-2">{productTitle || 'Listing not found'}</p>
                      )}
                      {!resolvedProductId && (
                        <p className="text-xs text-ink-soft">This listing could not be found. It may have been deleted.</p>
                      )}
                      {product?.status && (
                        <span className="w-fit px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border border-line bg-surface text-ink-soft">
                          Listing {String(product.status).replaceAll('_', ' ')}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* PEOPLE INVOLVED */}
                <div className="flex flex-col sm:flex-row sm:items-stretch gap-2">
                  <Party label="Reported by" name={reporterName} profile={report.reporter} tone="reporter" />
                  <div className="hidden sm:flex items-center text-ink-soft">
                    <ArrowRight size={16} />
                  </div>
                  <Party
                    label={isProduct ? 'Seller' : 'Reported user'}
                    name={reportedName}
                    profile={report.reported}
                    tone="reported"
                    extra={
                      against && against.total > 1 ? (
                        <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                          <Flame size={12} /> {against.total} reports against this user
                          {against.pending > 0 ? ` (${against.pending} pending)` : ''}
                        </p>
                      ) : null
                    }
                  />
                </div>

                {/* REASON BOX */}
                <div className="p-3.5 rounded-xl bg-tint border border-line">
                  <p className="text-xs font-bold text-ink-soft uppercase tracking-wider mb-1">
                    Report Reason / Details
                  </p>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-line font-medium">
                    {details ? `"${details}"` : 'No details were provided.'}
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
                    {report.context_room_id ? (
                      <button
                        type="button"
                        onClick={() => openChat(report)}
                        className={btn("outline", "sm")}
                      >
                        <MessageSquare size={14} /> Inspect Chat Context
                      </button>
                    ) : (
                      !isProduct && <span className="text-xs text-ink-soft">No chat was attached to this report.</span>
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
                          onClick={() => requestAction('resolve', report)}
                          disabled={isUpdating}
                          className={btn("primary", "sm")}
                        >
                          <CheckCircle2 size={14} /> Mark Resolved
                        </button>
                        <button
                          onClick={() => requestAction('dismiss', report)}
                          disabled={isUpdating}
                          className={btn("outline", "sm")}
                        >
                          <XCircle size={14} /> Dismiss
                        </button>
                      </>
                    )}

                    {status !== 'pending' && (
                      <button
                        onClick={() => requestAction('reopen', report)}
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

      {confirmAction && (() => {
        const copy = CONFIRM_COPY[confirmAction.type];
        return (
          <div
            className="fixed inset-0 bg-black/60 z-[9999] backdrop-blur-sm flex items-center justify-center p-4"
            onClick={closeConfirm}
          >
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-md bg-surface text-foreground border border-line rounded-2xl p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold mb-1">{copy.title}</h3>
              <p className="text-sm text-ink-soft mb-6">{copy.message}</p>
              <div className="flex justify-end gap-3">
                <button onClick={closeConfirm} className={btn("outline", "sm")}>Cancel</button>
                <button onClick={handleConfirm} className={btn(copy.style, "sm")}>{copy.confirmText}</button>
              </div>
            </div>
          </div>
        );
      })()}

      {modal && (
        <div className="fixed inset-0 bg-black/60 z-[9999] backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => { setModal(null); setModalReason(''); }}>
          <div className="w-full max-w-md bg-surface text-foreground border border-line rounded-2xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-1">
              {modal.type === 'ban'
                ? `Ban ${resolveName(modal.report.reported)}?`
                : `Remove "${productOf(modal.report)?.title || productTitleFromReason(modal.report.reason) || 'this listing'}"?`}
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

      {chatView && (
        <div
          className="fixed inset-0 bg-black/60 z-[9999] backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setChatView(null)}
        >
          <div
            className="w-full max-w-lg max-h-[85vh] flex flex-col bg-surface text-foreground border border-line rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-line flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Reported chat (read-only)</h3>
                <p className="text-[11px] text-ink-soft flex items-center gap-1.5">
                  <Avatar name={resolveName(chatView.report.reporter)} url={chatView.report.reporter?.avatar_url} size={18} />
                  {resolveName(chatView.report.reporter)} (reporter) ·
                  <Avatar name={resolveName(chatView.report.reported)} url={chatView.report.reported?.avatar_url} size={18} />
                  {resolveName(chatView.report.reported)} (reported)
                </p>
              </div>
              <button onClick={() => setChatView(null)} className={btn("outline", "sm")}>Close</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatView.loading ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-ink-soft" size={28} /></div>
              ) : chatView.messages.length === 0 ? (
                <p className="text-sm text-ink-soft text-center py-10">No messages in this conversation.</p>
              ) : (
                chatView.messages.map((m) => {
                  const isReported = m.msg_sender_id === chatView.report.reported?.id;
                  const isReporter = m.msg_sender_id === chatView.report.reporter?.id;
                  const who = isReported ? resolveName(chatView.report.reported) : isReporter ? resolveName(chatView.report.reporter) : 'Unknown';
                  return (
                    <div key={m.msg_id} className={`flex flex-col ${isReported ? 'items-start' : 'items-end'}`}>
                      <span className="text-[10px] text-ink-soft mb-0.5">
                        {who}{isReported ? ' (reported)' : ''} · {new Date(m.msg_created_at).toLocaleString()}
                      </span>
                      {m.msg_image_url && (
                        <img src={m.msg_image_url} alt="attachment" className="max-w-[240px] rounded-xl border border-line mb-1" />
                      )}
                      {m.msg_body && m.msg_body !== 'Sent an image' && (
                        <div className={`px-3 py-2 rounded-2xl text-sm max-w-[80%] whitespace-pre-wrap break-words border ${isReported ? 'bg-rose-500/10 border-rose-500/20' : 'bg-tint border-line'}`}>
                          {m.msg_body}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={null}>
      <ReportsContent />
    </Suspense>
  );
}