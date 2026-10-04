// Shared look for every admin page. Import from here instead of
// hand-writing colors, so the whole admin area stays consistent.
// All colors come from the theme tokens in globals.css (surface, line,
// brand, tint, ink-soft...) so light and dark mode both just work.

export const ui = {
  page: "max-w-6xl mx-auto space-y-6",
  title:
    "text-3xl font-extrabold tracking-tight text-brand-deep flex items-center gap-3",
  titleIcon: "text-brand shrink-0",
  subtitle: "text-sm text-ink-soft mt-1",
  card: "bg-surface border border-line rounded-2xl shadow-sm",
  input:
    "bg-background text-foreground placeholder:text-ink-soft text-sm px-3 py-2 rounded-xl border border-line outline-none transition focus:ring-2 focus:ring-brand",
  tableHead:
    "bg-tint border-b border-line text-[11px] font-bold text-ink-soft uppercase tracking-wider",
  pill:
    "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider border",
  headerBar: "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4",
  countBadge:
    "px-4 py-2 bg-tint border border-line text-brand-deep rounded-2xl text-xs font-extrabold",
  empty:
    "bg-surface border border-dashed border-line rounded-2xl text-center text-ink-soft font-semibold",
};

const BTN_BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-xl font-bold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap";
const BTN_SIZE = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm" };
const BTN_KIND = {
  primary: "bg-brand text-on-brand hover:opacity-90",
  outline: "border border-line bg-surface text-foreground hover:bg-tint",
  ghost: "text-ink-soft hover:bg-tint hover:text-brand-deep",
  danger: "bg-red-600 text-white hover:bg-red-700",
  dangerOutline:
    "border border-red-300 text-red-700 hover:bg-red-600 hover:text-white hover:border-red-600 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white dark:hover:border-red-600",
  safeOutline:
    "border border-brand/40 text-brand hover:bg-brand hover:text-on-brand hover:border-brand",
};

export const btn = (kind: keyof typeof BTN_KIND, size: keyof typeof BTN_SIZE = "md") =>
  `${BTN_BASE} ${BTN_SIZE[size]} ${BTN_KIND[kind]}`;

export const pillTone = {
  you: "bg-brand text-on-brand border-brand",
  student:
    "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800",
  faculty:
    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  active:
    "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
  banned:
    "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800",
};

// Same role colors as the sidebar: purple super admin, blue admin, green moderator
export function roleStyle(role?: string | null) {
  if (role === "super_admin" || role === "superadmin")
    return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800";
  if (role === "admin")
    return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800";
  if (role === "moderator")
    return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800";
  return "bg-tint text-ink-soft border-line";
}

export function roleLabel(role?: string | null) {
  if (role === "super_admin" || role === "superadmin") return "Super admin";
  if (role === "admin") return "Admin";
  if (role === "moderator") return "Moderator";
  return "User";
}
