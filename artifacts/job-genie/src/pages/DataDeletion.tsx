import LegalPage from "./LegalPage";
import { DATA_DELETION_MD } from "@/content/legal";

export default function DataDeletion() {
  return (
    <LegalPage
      slug="data-deletion"
      title="Request Data Deletion"
      description="Request deletion of your personal data from Job-Genie.ai. CCPA and GDPR compliant, processed within 30 days."
      content={DATA_DELETION_MD}
    />
  );
}
