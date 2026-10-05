import LegalPage from "@/components/LegalPage";
import { termsContent } from "@/lib/termsContent";

export const metadata = {
    title: "Terms of Service | OLFU Valenzuela Marketplace",
};

export default function TermsPage() {
    return <LegalPage content={termsContent} otherHref="/privacy" otherLabel="Privacy Policy" />;
}