import LegalPage from "./LegalPage";
import { PRIVACY_POLICY_MD } from "@/content/legal";

export default function PrivacyPolicy() {
  return (
    <LegalPage
      slug="privacy"
      title="Privacy Policy"
      description="How Job-Genie.ai collects, uses, and protects your information when you use our platform."
      content={PRIVACY_POLICY_MD}
      toc={[
        "Overview",
        "Information We Collect",
        "How We Use Your Information",
        "Data Sharing",
        "Data Retention",
        "Your Rights",
        "Cookies & Tracking",
        "Security",
        "Third-Party Services",
        "Children's Privacy",
        "Changes to This Policy",
        "Contact Us",
      ]}
    />
  );
}
