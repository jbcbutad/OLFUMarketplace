import Link from "next/link";

function renderContent(content) {
    return content.split(/\n{2,}/).map((block, index) => {
        const lines = block.split("\n");

        if (lines[0].startsWith("# ")) {
            return (
                <h1 key={index} className="text-3xl font-bold tracking-tight text-neutral-950">
                    {lines[0].slice(2)}
                </h1>
            );
        }

        if (lines[0].startsWith("## ")) {
            return (
                <h2 key={index} className="border-b border-neutral-200 pb-2 pt-6 text-xl font-bold text-neutral-950">
                    {lines[0].slice(3)}
                </h2>
            );
        }

        if (lines.every((line) => line.startsWith("- "))) {
            return (
                <ul key={index} className="list-disc space-y-1.5 pl-6 text-base leading-7 text-neutral-700">
                    {lines.map((line) => (
                        <li key={line}>{line.slice(2)}</li>
                    ))}
                </ul>
            );
        }

        return (
            <p key={index} className="text-base leading-7 text-neutral-700">
                {block}
            </p>
        );
    });
}

export default function LegalPage({ content, otherHref, otherLabel }) {
    return (
        <div className="min-h-screen bg-white text-neutral-900">
            <header className="border-b border-neutral-200">
                <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
                    <Link href="/" className="text-sm font-bold text-neutral-950">
                        OLFU Valenzuela Marketplace
                    </Link>
                    <Link href={otherHref} className="text-sm text-neutral-600 underline hover:text-neutral-950">
                        {otherLabel}
                    </Link>
                </div>
            </header>

            <main className="mx-auto max-w-3xl space-y-4 px-6 py-10">{renderContent(content)}</main>
        </div>
    );
}