"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

const termsContent = `# OLFU Valenzuela Marketplace Terms of Service

Effective Date: September 2026

Welcome to OLFU Valenzuela Marketplace.

These Terms of Service ("Terms") govern your access to and use of the OLFU Valenzuela Marketplace website and its features. By creating an account, accessing, or using the Marketplace, you agree to be bound by these Terms.

If you do not agree with these Terms, please do not use the Marketplace.

## 1. Our Service

OLFU Valenzuela Marketplace is a web-based marketplace platform designed for the OLFU community. The platform allows verified OLFU members to browse, search, list, and communicate about products and potential transactions within the community.

The Marketplace includes features such as product listings, categories, messaging, search, notifications, account verification, reporting, blocking, and administrative management.

The Marketplace is designed primarily to provide members of the OLFU community with a convenient platform for buying and selling items such as pre-loved books, school supplies, uniforms, gadgets, and other relevant items.

## 2. Who Can Use the Marketplace

The OLFU Valenzuela Marketplace is intended for verified members of the OLFU community.

To use the Marketplace, you must:

- Provide accurate information during registration.
- Complete the required account verification process.
- Use your own account.
- Keep your account information accurate and updated.
- Keep your login credentials secure.

The Marketplace uses OLFU credential verification to help ensure that only authorized members of the community can access the platform.

## 3. Your Account

You are responsible for the activity that occurs through your account.

You agree not to:

- Create an account using another person's identity.
- Share your account with another person.
- Use another user's account without permission.
- Provide false or misleading information.
- Attempt to bypass the verification process.
- Use the Marketplace after your access has been suspended or removed.

If we determine that an account violates these Terms or poses a risk to the community, administrators may restrict, suspend, or remove access to the account.

## 4. Buying and Selling

The Marketplace allows users to communicate and arrange transactions with other users.

When you buy or sell an item, you understand that:

- You are responsible for reviewing the listing and communicating with the other party.
- Sellers are responsible for the accuracy of their product information.
- Buyers are responsible for determining whether an item meets their expectations.
- Buyers and sellers are responsible for agreeing on the price and transaction arrangements.
- The Marketplace does not act as the buyer or seller of user-listed products.

The current system facilitates communication and transaction arrangements between users rather than directly completing the transaction on behalf of the users.

## 5. Listings

When you create a listing, you are responsible for the content and information you provide.

You agree that your listings must:

- Accurately describe the item.
- Use appropriate and truthful images.
- Provide accurate pricing information.
- Clearly describe the condition of pre-loved or secondhand items.
- Not intentionally mislead potential buyers.
- Follow the rules of the Marketplace.

Administrators may review, approve, remove, or restrict listings when necessary. Authorized merchandise sellers may submit official OLFU merchandise for approval.

## 6. Content You Share

The Marketplace allows you to submit content such as:

- Product information
- Product photographs
- Profile information
- Messages
- Reviews
- Reports

You are responsible for the content you submit.

You must not submit content that is fraudulent, abusive, threatening, inappropriate, misleading, or intended to harm another user.

The Marketplace may use moderation features to help identify inappropriate or harmful content.

## 7. Communication

The Marketplace provides a built-in messaging system that allows buyers and sellers to communicate regarding listings and transactions.

You agree to use this feature responsibly.

You must not use messaging to:

- Harass another user.
- Threaten another user.
- Send spam.
- Attempt to scam another user.
- Send inappropriate content.
- Impersonate another person.
- Conduct activities unrelated to the intended purpose of the Marketplace.

The system stores conversations as part of its messaging functionality and provides administrators with tools for managing reports and platform activity.

## 8. Your Safety

We provide features intended to help create a safer marketplace, including account verification, reporting, blocking, administrative monitoring, and content moderation.

However, no online platform can guarantee that every interaction or transaction will be completely safe.

Before completing a transaction, users should carefully review the listing, communicate with the other party, and use reasonable caution when arranging payment or meeting arrangements.

## 9. Reporting and Blocking

If you encounter a suspicious listing, inappropriate behavior, or another violation of these Terms, you may use the Marketplace's reporting features.

You may also use available blocking features to prevent unwanted communication.

Reports may be reviewed by administrators, who may take appropriate action based on the circumstances.

The system's design includes reporting and blocking functionality as part of its marketplace safety and administration features.

## 10. Prohibited Activities

You may not use the Marketplace to:

- Scam or defraud another user.
- Post fake or misleading listings.
- Impersonate another person.
- Harass, threaten, or abuse other users.
- Upload inappropriate or harmful content.
- Send spam or malicious messages.
- Attempt to gain unauthorized access to another account.
- Attempt to bypass account verification.
- Interfere with or damage the operation of the Marketplace.
- Abuse the reporting or blocking system.
- Use the platform for activities that violate applicable laws or university rules.

## 11. Official OLFU Merchandise

Official OLFU merchandise may only be listed through the authorized merchandise seller process.

Listings for official merchandise may require administrator approval before becoming visible on the Marketplace.

This is consistent with your system design, where authorized merchandise sellers submit official OLFU merchandise listings for approval and administrators manage those submissions.

## 12. Reviews

Where the review feature is available, users may provide feedback regarding a transaction.

Reviews should be:

- Honest.
- Relevant to the transaction.
- Based on the user's actual experience.
- Free from threats, harassment, or intentionally misleading information.

The system's database design includes reviews associated with users and transactions.

## 13. Payments and Delivery

The OLFU Valenzuela Marketplace currently provides a platform for users to communicate and arrange transactions.

The Marketplace does not directly provide payment processing or delivery services within the current system scope.

Therefore, users are responsible for independently agreeing on payment, pickup, delivery, or other transaction arrangements.

## 14. Privacy and Information

To operate the Marketplace, information such as account details, listings, messages, and other system information may be stored within the platform's database and storage systems.

The system architecture identifies Supabase Auth, Database, and Storage as components used for user accounts, listings, categories, messages, and uploaded files.

Users should avoid sharing unnecessary sensitive information through listings or messages.

## 15. Enforcement of These Terms

If you violate these Terms, administrators may take actions including:

- Removing your listing.
- Removing inappropriate content.
- Restricting certain account features.
- Suspending your account.
- Blocking your account from accessing the Marketplace.
- Taking other appropriate administrative action.

The purpose of these actions is to maintain an organized and safer marketplace for the OLFU community.

## 16. Changes to the Marketplace

The Marketplace may be updated from time to time to improve its features, security, functionality, and user experience.

New features may include improvements to search, messaging, notifications, content moderation, or other marketplace functions.

Your paper describes the system as undergoing testing, deployment, review, and continued improvement based on user feedback.

## 17. Disclaimer

OLFU Valenzuela Marketplace is a platform designed to facilitate interactions between members of the OLFU community.

We do not guarantee:

- The accuracy of every listing.
- The quality or condition of every item.
- The availability of an item.
- The completion of a transaction.
- The conduct of every user.
- The outcome of transactions arranged between users.

Users are responsible for making their own decisions before completing a transaction.

## 18. Acceptance of These Terms

By clicking "I Agree", creating an account, or using the OLFU Valenzuela Marketplace, you acknowledge that you have read and understood these Terms of Service and agree to follow them.

If you do not agree to these Terms, you may not use the Marketplace.`;

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
                  className={`block w-full rounded-md px-2 py-1.5 text-left text-xs leading-4 ${
                    index === 0 ? "bg-blue-50 font-bold text-[#1877f2]" : "text-neutral-600"
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
