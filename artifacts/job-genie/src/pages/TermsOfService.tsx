import LegalPage from "./LegalPage";
import { TERMS_OF_SERVICE_MD } from "@/content/legal";

export default function TermsOfService() {
  return (
    <LegalPage
      slug="terms"
      title="Terms of Service"
      description="Terms of Service for Job-Genie.ai — the rules governing your access to and use of the Job Genie platform."
      content={TERMS_OF_SERVICE_MD}
    />
  );
}
