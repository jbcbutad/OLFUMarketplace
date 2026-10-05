import LegalPage from "@/components/LegalPage";
import { privacyContent } from "@/lib/privacyContent";

export const metadata = {
    title: "Privacy Policy | OLFU Valenzuela Marketplace",
};

export default function PrivacyPage() {
    return <LegalPage content={privacyContent} otherHref="/terms" otherLabel="Terms of Service" />;
}