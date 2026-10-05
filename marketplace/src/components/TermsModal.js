"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { termsContent } from "@/lib/termsContent";

const sectionTitles = [
  "Overview",
  "1. Our Service",
  "2. Who Can Use the Marketplace",
  "3. Your Account",
  "4. Buying and Selling",
  "5. Listings",
  "6. Content You Share",
  "7. Communication",
  "8. Your Safety",
  "9. Reporting and Blocking",
  "10. Prohibited Activities",
  "11. Official OLFU Merchandise",
  "12. Reviews",
  "13. Payments and Delivery",
  "14. Privacy and Information",
  "15. Enforcement of These Terms",
  "16. Changes to the Marketplace",
  "17. Disclaimer",
  "18. Acceptance of These Terms",
];

const sectionId = (title) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

function renderTermsContent() {
  return termsContent.split(/\n{2,}/).map((block, index) => {
    const lines = block.split("\n");

    if (lines[0].startsWith("# ")) {
      return (
        <h1 id="overview" key={index} className="text-2xl font-bold tracking-tight text-neutral-950">
          {lines[0].slice(2)}
        </h1>
      );
    }

    if (lines[0].startsWith("## ")) {
      return (
        <h3 id={sectionId(lines[0].slice(3))} key={index} className="border-b border-neutral-200 pb-2 pt-4 text-lg font-bold text-neutral-950">
          {lines[0].slice(3)}
        </h3>
      );
    }

    if (lines.every((line) => line.startsWith("- "))) {
      return (
        <ul key={index} className="list-disc space-y-1.5 pl-5 text-[14px] leading-6 text-neutral-700">
          {lines.map((line) => <li key={line}>{line.slice(2)}</li>)}
        </ul>
      );
    }

    return (
      <p key={index} className="text-[14px] leading-6 text-neutral-700">
        {block}
      </p>
    );
  });
}

export default function TermsModal({ isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <div>
            <h2 id="terms-title" className="text-lg font-bold text-neutral-900">
              Terms and Conditions
            </h2>
            <p className="mt-0.5 text-xs text-neutral-500">OLFU Valenzuela Marketplace</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close terms and conditions"
            className="rounded-full p-2 text-neutral-500 transition-colors hover:bg-blue-50 hover:text-[#1877f2]"
          >
            <X size={18} />
          </button>
        </div>
        <div className="border-b border-neutral-100 bg-blue-50/60 px-5 py-3">
          <p className="text-xs leading-5 text-neutral-600">
            Please review these terms before creating your account. Your agreement is required to join the marketplace.
          </p>
        </div>
        <div className="grid min-h-0 flex-1 sm:grid-cols-[210px_minmax(0,1fr)]">
          <aside className="hidden overflow-y-auto border-r border-neutral-200 bg-neutral-50 px-4 py-5 sm:block">
            <div className="mb-5 flex items-center gap-2 text-sm font-bold text-neutral-950">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1877f2] text-xs font-black text-white">
                O
              </span>
              OLFU Marketplace
            </div>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              On this page
            </p>
            <nav className="space-y-1" aria-label="Terms sections">
              {sectionTitles.map((title, index) => (
                <button
                  type="button"
                  key={title}
                  onClick={() => document.getElementById(index === 0 ? "overview" : sectionId(title))?.scrollIntoView({ behavior: "smooth" })}
                  className={`block w-full rounded-md px-2 py-1.5 text-left text-xs leading-4 ${index === 0 ? "bg-blue-50 font-bold text-[#1877f2]" : "text-neutral-600"
                    }`}
                >
                  {title}
                </button>
              ))}
            </nav>
          </aside>
          <article className="overflow-y-auto px-6 py-7 sm:px-9">
            <div className="max-w-2xl space-y-5">
              {renderTermsContent()}
            </div>
          </article>
        </div>
        <div className="border-t border-neutral-200 px-5 py-4 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#1877f2] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#166fe5]"
          >
            Done
          </button>
        </div>
      </section>
    </div>
  );
}