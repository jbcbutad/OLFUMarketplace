"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Tag, Tags, Plus, Pencil, Trash2, Lock, Check, X, Search } from "lucide-react";
import {
    addCategory, updateCategory, deleteCategory,
    addSuggestedTag, removeSuggestedTag, removeTagEverywhere,
} from "./actions";

type Category = { id: number; name: string; icon: string | null };
type Suggested = { id: number; name: string };
type TagRow = { key: string; label: string; count: number; isProtected: boolean };
type Result = { error: string | null; count?: number };

const card = "bg-surface border border-line rounded-2xl p-5 sm:p-6";
const input =
    "bg-background border border-line rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-ink-soft outline-none focus:ring-2 focus:ring-brand";
const btnPrimary =
    "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-on-brand text-sm font-bold hover:opacity-90 disabled:opacity-50 transition cursor-pointer";
const btnGhost =
    "p-2 rounded-lg text-ink-soft hover:bg-tint hover:text-brand-deep disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer";
const btnDanger =
    "px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50 cursor-pointer";

const EMOJIS = [
    "📚", "📖", "✏️", "🎒", "💻", "🖥️", "⌨️", "🖱️", "🎧", "📱", "🔌", "🔋",
    "📷", "🎮", "👕", "👖", "👟", "🧥", "👜", "🥼", "🩺", "🧪", "🔬", "📐",
    "🧮", "🍔", "☕", "🥤", "🪑", "🛏️", "🏠", "🚲", "🛴", "🎸", "🎨", "⚽",
    "🏀", "💍", "🎁", "🧴", "🏷️", "📦", "🛒", "🎓",
];

function EmojiPicker({ value, onChange }: { value: string; onChange: (e: string) => void }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="w-14 h-[42px] rounded-xl border border-line bg-background text-xl hover:bg-tint cursor-pointer"
                aria-label="Choose icon"
                title="Choose icon"
            >
                {value || "🏷️"}
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                    <div className="absolute left-0 z-20 mt-2 w-72 p-2 grid grid-cols-8 gap-1 bg-surface border border-line rounded-xl shadow-lg">
                        {EMOJIS.map((e) => (
                            <button
                                key={e}
                                type="button"
                                onClick={() => { onChange(e); setOpen(false); }}
                                className="text-xl p-1 rounded-lg hover:bg-tint cursor-pointer"
                            >
                                {e}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

export default function CategoriesManager({
    categories, usage, suggested, tags, canDeleteCategories,
}: {
    categories: Category[];
    usage: Record<number, number>;
    suggested: Suggested[];
    tags: TagRow[];
    canDeleteCategories: boolean;
}) {
    const [pending, startTransition] = useTransition();

    const [newName, setNewName] = useState("");
    const [newIcon, setNewIcon] = useState("");
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState("");
    const [editIcon, setEditIcon] = useState("");
    const [confirmCatId, setConfirmCatId] = useState<number | null>(null);

    const [tagInput, setTagInput] = useState("");
    const [tagSearch, setTagSearch] = useState("");
    const [confirmTagKey, setConfirmTagKey] = useState<string | null>(null);

    const run = (fn: () => Promise<Result>, ok: (r: Result) => string, after?: () => void) =>
        startTransition(async () => {
            const res = await fn();
            if (res.error) toast.error(res.error);
            else { toast.success(ok(res)); after?.(); }
        });

    const filteredTags = tags.filter((t) =>
        t.label.toLowerCase().includes(tagSearch.trim().toLowerCase().replace(/^#/, ""))
    );

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-brand-deep">Categories & Tags</h1>
                <p className="text-sm text-ink-soft mt-1">
                    Manage the categories sellers can pick and the tags used across listings.
                </p>
            </div>

            {/* CATEGORIES */}
            <section className={card}>
                <h2 className="flex items-center gap-2 text-lg font-bold text-foreground mb-4">
                    <Tag size={18} className="text-brand" /> Categories
                </h2>

                <div className="flex flex-col sm:flex-row gap-2 mb-5">
                    <EmojiPicker value={newIcon} onChange={setNewIcon} />
                    <input className={`${input} flex-1`} placeholder="New category name" maxLength={30}
                        value={newName} onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && newName.trim() &&
                            run(() => addCategory(newName, newIcon), () => "Category added", () => { setNewName(""); setNewIcon(""); })} />
                    <button className={btnPrimary} disabled={pending || newName.trim().length < 2}
                        onClick={() => run(() => addCategory(newName, newIcon), () => "Category added",
                            () => { setNewName(""); setNewIcon(""); })}>
                        <Plus size={16} /> Add
                    </button>
                </div>

                <ul className="divide-y divide-line border border-line rounded-xl overflow-visible">
                    {categories.map((c) => {
                        const locked = c.name.toLowerCase() === "merchandise";
                        const count = usage[c.id] ?? 0;
                        const editing = editingId === c.id;
                        const confirming = confirmCatId === c.id;
                        const deleteBlockedReason = locked
                            ? "Merchandise is locked"
                            : count > 0
                                ? `${count} listing${count === 1 ? "" : "s"} use this category`
                                : !canDeleteCategories
                                    ? "Only admins can delete categories"
                                    : "";

                        return (
                            <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3 bg-background first:rounded-t-xl last:rounded-b-xl">
                                {editing ? (
                                    <>
                                        <EmojiPicker value={editIcon} onChange={setEditIcon} />
                                        <input className={`${input} flex-1 min-w-[140px]`} value={editName} maxLength={30}
                                            disabled={locked} onChange={(e) => setEditName(e.target.value)} aria-label="Name" />
                                        <button className={btnGhost} disabled={pending} title="Save"
                                            onClick={() => run(() => updateCategory(c.id, editName, editIcon),
                                                () => "Category updated", () => setEditingId(null))}>
                                            <Check size={16} />
                                        </button>
                                        <button className={btnGhost} title="Cancel" onClick={() => setEditingId(null)}>
                                            <X size={16} />
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-xl w-8 text-center" aria-hidden>{c.icon || "🏷️"}</span>
                                        <span className="font-semibold text-foreground">{c.name}</span>
                                        {locked && (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-gold-soft text-gold border border-gold/40">
                                                <Lock size={10} /> Locked
                                            </span>
                                        )}
                                        <span className="text-xs text-ink-soft ml-auto">
                                            {count} listing{count === 1 ? "" : "s"}
                                        </span>

                                        {confirming ? (
                                            <span className="flex items-center gap-2">
                                                <span className="text-xs text-ink-soft">Delete?</span>
                                                <button className={btnDanger} disabled={pending}
                                                    onClick={() => run(() => deleteCategory(c.id), () => "Category deleted",
                                                        () => setConfirmCatId(null))}>
                                                    Yes, delete
                                                </button>
                                                <button className={btnGhost} onClick={() => setConfirmCatId(null)}><X size={16} /></button>
                                            </span>
                                        ) : (
                                            <span className="flex items-center">
                                                <button className={btnGhost} title="Edit"
                                                    onClick={() => { setEditingId(c.id); setEditName(c.name); setEditIcon(c.icon ?? ""); }}>
                                                    <Pencil size={16} />
                                                </button>
                                                <button className={btnGhost}
                                                    title={deleteBlockedReason || "Delete category"}
                                                    disabled={!!deleteBlockedReason}
                                                    onClick={() => setConfirmCatId(c.id)}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </span>
                                        )}
                                    </>
                                )}
                            </li>
                        );
                    })}
                    {categories.length === 0 && (
                        <li className="px-4 py-6 text-sm text-ink-soft text-center bg-background">No categories yet.</li>
                    )}
                </ul>
            </section>

            {/* SUGGESTED TAGS */}
            <section className={card}>
                <h2 className="flex items-center gap-2 text-lg font-bold text-foreground mb-1">
                    <Tags size={18} className="text-brand" /> Suggested tags
                </h2>
                <p className="text-xs text-ink-soft mb-4">
                    These appear as quick-add chips when sellers create a listing.
                </p>

                <div className="flex gap-2 mb-4">
                    <input className={`${input} flex-1`} placeholder="Add a suggested tag (e.g. engineering)" maxLength={30}
                        value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && tagInput.trim() &&
                            run(() => addSuggestedTag(tagInput), () => "Suggested tag added", () => setTagInput(""))} />
                    <button className={btnPrimary} disabled={pending || tagInput.trim().length < 2}
                        onClick={() => run(() => addSuggestedTag(tagInput), () => "Suggested tag added", () => setTagInput(""))}>
                        <Plus size={16} /> Add
                    </button>
                </div>

                <div className="flex flex-wrap gap-2">
                    {suggested.map((t) => (
                        <span key={t.id}
                            className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-lg bg-tint text-brand-deep text-xs font-semibold border border-line">
                            #{t.name}
                            <button type="button" disabled={pending} title="Remove"
                                className="p-1 rounded hover:bg-background hover:text-red-600 cursor-pointer"
                                onClick={() => run(() => removeSuggestedTag(t.id), () => "Suggested tag removed")}>
                                <X size={12} />
                            </button>
                        </span>
                    ))}
                    {suggested.length === 0 && <p className="text-sm text-ink-soft">No suggested tags yet.</p>}
                </div>
            </section>

            {/* TAGS IN USE */}
            <section className={card}>
                <h2 className="flex items-center gap-2 text-lg font-bold text-foreground mb-1">
                    <Tags size={18} className="text-brand" /> Tags in use
                </h2>
                <p className="text-xs text-ink-soft mb-4">
                    Removing a tag strips it from every listing. Protected tags can&apos;t be removed.
                </p>

                <div className="relative mb-4">
                    <Search size={16} className="absolute left-3 top-3 text-ink-soft" />
                    <input className={`${input} w-full pl-9`} placeholder="Search tags..."
                        value={tagSearch} onChange={(e) => setTagSearch(e.target.value)} />
                </div>

                <ul className="divide-y divide-line border border-line rounded-xl overflow-hidden max-h-[28rem] overflow-y-auto">
                    {filteredTags.map((t) => {
                        const confirming = confirmTagKey === t.key;
                        return (
                            <li key={t.key} className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-background">
                                <span className="text-sm font-semibold text-foreground">#{t.label}</span>
                                {t.isProtected && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-gold-soft text-gold border border-gold/40">
                                        <Lock size={10} /> Protected
                                    </span>
                                )}
                                <span className="text-xs text-ink-soft ml-auto">
                                    {t.count} listing{t.count === 1 ? "" : "s"}
                                </span>

                                {confirming ? (
                                    <span className="flex items-center gap-2">
                                        <span className="text-xs text-ink-soft">Remove from {t.count}?</span>
                                        <button className={btnDanger} disabled={pending}
                                            onClick={() => run(() => removeTagEverywhere(t.label),
                                                (r) => `Removed from ${r.count ?? 0} listing${r.count === 1 ? "" : "s"}`,
                                                () => setConfirmTagKey(null))}>
                                            Yes, remove
                                        </button>
                                        <button className={btnGhost} onClick={() => setConfirmTagKey(null)}><X size={16} /></button>
                                    </span>
                                ) : (
                                    <button className={btnGhost} disabled={t.isProtected}
                                        title={t.isProtected ? "Protected tag" : "Remove from all listings"}
                                        onClick={() => setConfirmTagKey(t.key)}>
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </li>
                        );
                    })}
                    {filteredTags.length === 0 && (
                        <li className="px-4 py-6 text-sm text-ink-soft text-center bg-background">No tags found.</li>
                    )}
                </ul>
            </section>
        </div>
    );
}