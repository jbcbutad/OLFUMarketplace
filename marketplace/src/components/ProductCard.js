"use client";
import { useState } from "react";
import Image from "next/image";
import { isMerch } from "@/lib/merch";
import { ShieldCheck } from "lucide-react";
import { cleanName } from "@/lib/cleanName";

// "2h ago", "3d ago", "Mar 5" etc.
function timeAgo(dateInput) {
  if (!dateInput) return null;
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return null;

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "Just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  if (days < 30) return `${weeks}w ago`;

  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() !== new Date().getFullYear() && { year: "numeric" }),
  });
}

function getInitials(name) {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function SellerAvatar({ src, name }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-border flex items-center justify-center text-[9px] font-bold shrink-0">
        {getInitials(name)}
      </div>
    );
  }

  return (
    <div className="relative w-6 h-6 rounded-full overflow-hidden border border-border shrink-0 bg-muted">
      <Image
        src={src}
        alt={name || "Seller"}
        fill
        sizes="24px"
        className="object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

export default function ProductCard({
  title,
  price,
  seller,
  sellerAvatar = null,
  createdAt = null,
  image,
  category,
  tags,
  priority = false,
  isVerifiedOrg = false,
  orgName = null,
  stockQuantity = null,
}) {
  const sellerName = cleanName(seller);
  const isMerchListing = isMerch({ tags, categories: { name: category } });
  const isRental = (tags || []).some((t) =>
    ["rentals", "rental"].includes(String(t).toLowerCase().replace(/[\s_#-]+/g, ""))
  );
  const listedAgo = timeAgo(createdAt);

  return (
    <div className="bg-white dark:bg-neutral-900 border border-border rounded-xl shadow-sm hover:shadow-md transition p-3 group relative flex flex-col justify-between">
      <div>
        {/* Product Image */}
        <div className="relative w-full h-48 overflow-hidden rounded-lg border border-border bg-muted">
          <Image
            src={image}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            priority={priority}
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />

          {/* Floating Category Badge: Hidden for Merchandise to prevent overlap with the Official Merch badge */}
          {category && !isMerchListing && (
            <div className="absolute top-2 left-2 bg-emerald-100 backdrop-blur-md border border-emerald-700 text-[11px] font-semibold text-foreground px-2 py-0.5 rounded-md shadow-sm z-10 dark:text-black">
              {category}
            </div>
          )}

          {/* PRODUCT BADGE: Only shown for official merch from a verified seller */}
          {isMerchListing && isVerifiedOrg && (
            <div className="absolute top-2 right-2 bg-emerald-600 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-md shadow-md z-10 flex items-center gap-1">
              <ShieldCheck size={12} /> Official Merch
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="mt-3 space-y-1">
          <h3 className="font-bold text-foreground line-clamp-1 text-sm">
            {title}
          </h3>
          <p className="text-base font-black text-foreground">
            ₱{Number(price).toLocaleString()}
            {isRental && (
              <span className="text-xs text-muted-foreground ml-1 font-normal">/ day</span>
            )}
          </p>
        </div>
      </div>

      {/* Stock Quantity Badge */}
      {stockQuantity !== null && stockQuantity !== undefined && (
        <div className="mt-2">
          <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md font-bold">
            Stock: {stockQuantity}
          </span>
        </div>
      )}

      {/* SELLER INFO: Avatar + real name (+ org if verified) + listed time */}
      <div className="mt-3 pt-2 border-t border-border/60 text-xs text-muted-foreground">
        <div className="flex items-center gap-2 min-w-0">
          <SellerAvatar src={sellerAvatar} name={sellerName} />

          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="truncate font-semibold text-foreground">{sellerName}</span>

            {isVerifiedOrg && (
              <div className="flex items-center gap-1 shrink-0 text-emerald-600 dark:text-emerald-400 font-bold">
                <ShieldCheck size={14} title="Verified Org Representative" />
                {orgName && <span className="text-[11px] truncate max-w-[80px]">({orgName})</span>}
              </div>
            )}
          </div>

          {listedAgo && (
            <time
              dateTime={new Date(createdAt).toISOString()}
              title={new Date(createdAt).toLocaleString("en-PH")}
              className="shrink-0 text-[11px] text-muted-foreground"
            >
              {listedAgo}
            </time>
          )}
        </div>
      </div>
    </div>
  );
}