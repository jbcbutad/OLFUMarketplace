"use client";
import Image from "next/image";
import { ShieldCheck } from "lucide-react";

export default function ProductCard({
  title,
  price,
  seller,
  image,
  category,
  tags,
  priority = false,
  isVerifiedOrg = false,
  orgName = null,
  stockQuantity = null,
}) {
  const isMerchandiseCategory = category === "Merchandise";

  return (
    <div className="bg-white dark:bg-neutral-900 border border-border rounded-xl shadow-sm hover:shadow-md transition p-3 group relative flex flex-col justify-between">      <div>
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

        {/* 👉 Floating Category Badge: Hidden for Merchandise to prevent overlap with the Official Merch badge */}
        {category && !isMerchandiseCategory && (
          <div className="absolute top-2 left-2 bg-background/90 backdrop-blur-md border border-border text-[11px] font-semibold text-foreground px-2 py-0.5 rounded-md shadow-sm z-10">
            {category}
          </div>
        )}

        {/* PRODUCT BADGE: Only shown if Category is "Merchandise" AND Seller is Verified */}
        {isMerchandiseCategory && isVerifiedOrg && (
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
          {tags?.includes("Rentals") && (
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

      {/* SELLER INFO: Always shows User's Real Name + Org Name if verified */}
      <div className="mt-3 pt-2 border-t border-border/60 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 truncate">
          <span className="truncate font-semibold text-foreground">{seller}</span>

          {isVerifiedOrg && (
            <div className="flex items-center gap-1 shrink-0 text-emerald-600 dark:text-emerald-400 font-bold">
              <ShieldCheck size={14} title="Verified Org Representative" />
              {orgName && <span className="text-[11px] truncate">({orgName})</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}