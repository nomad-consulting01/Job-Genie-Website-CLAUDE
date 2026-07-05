import LegalPage from "./LegalPage";
import { PRIVACY_POLICY_MD } from "@/content/legal";

export default function PrivacyPolicy() {
  return (
    <LegalPage
      slug="privacy"
      title="Privacy Policy"
      description="How Job-Genie.ai collects, uses, and protects your information when you use our platform."
      content={PRIVACY_POLICY_MD}
    />
  );
}
