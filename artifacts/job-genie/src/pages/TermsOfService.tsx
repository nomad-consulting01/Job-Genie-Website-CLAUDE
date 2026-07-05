import LegalPage from "./LegalPage";
import { TERMS_OF_SERVICE_MD } from "@/content/legal";

export default function TermsOfService() {
  return (
    <LegalPage
      slug="terms"
      title="Terms of Service"
      description="Terms of Service for Job-Genie.ai — the rules governing your access to and use of the Job Genie platform."
      content={TERMS_OF_SERVICE_MD}
      toc={[
        "Overview & Acceptance",
        "Eligibility",
        "Accounts & Registration",
        "Platform Description",
        "Acceptable Use",
        "Your Content & Data",
        "Intellectual Property",
        "Third-Party Services",
        "Disclaimers",
        "Limitation of Liability",
        "Indemnification",
        "Termination",
        "Disputes & Governing Law",
        "Changes to These Terms",
        "Contact",
      ]}
    />
  );
}
