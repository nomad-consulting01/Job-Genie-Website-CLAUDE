export interface VoiceSpec {
  id: string;
  label: string;
  description: string;
  active: boolean;
  samplingWeight: number;
  hookTypes: string[];
  generationInstructions: string;
  bannedPhrases: string[];
  brandVoiceChecks: string[];
  beta: { alpha: number; beta: number };
}

export interface VoiceLibrary {
  version: string;
  updatedAt: string;
  samplingPolicy: SamplingPolicy;
  voices: VoiceSpec[];
}

export interface SamplingPolicy {
  exploitWeight: number;
  exploreWeight: number;
  minImpressionsGate: number;
  compositeWeights: {
    w1_reach_rate: number;
    w2_engagement_quality: number;
    w3_on_brand_score: number;
    w4_guardrail_risk: number;
    w5_cta_action_rate: number;
  };
}

export interface FbMetricRow {
  post_id: string;
  metric: string;
  date: string;
  value: number;
  ingestedAt: string;
  /** Which platform produced this row. Defaults to "facebook" when absent (backwards-compatible). */
  channel?: "facebook" | "instagram";
}

export interface FbMetricsFile {
  _schema: string;
  _description: string;
  lastIngestAt: string | null;
  rows: FbMetricRow[];
}

export interface AttributionEntry {
  post_id: string;
  variant_id: string;
  voice_id: string;
  voice_label: string;
  hook_type: string;
  topic: string;
  persona: string;
  format: string;
  reach: number;
  impressions: number;
  engagements: number;
  link_clicks: number;
  engagement_rate: number;
  meets_impressions_gate: boolean;
  attributedAt: string;
  /** Which platform's metrics were used for attribution. */
  channel?: "facebook" | "instagram";
  /** Instagram post ID if IG metrics were used. */
  instagram_post_id?: string;
}

export interface AttributionFile {
  _schema: string;
  _description: string;
  lastRunAt: string | null;
  entries: AttributionEntry[];
}

export interface BanditArm {
  voiceId: string;
  topic: string;
  persona: string;
  format: string;
  alpha: number;
  beta: number;
  mean: number;
  impressions: number;
  status: "active" | "under_test" | "retired";
  lastUpdatedAt: string;
}

export interface VoiceLedgerFile {
  _schema: string;
  _description: string;
  lastUpdatedAt: string | null;
  samplingPolicy: SamplingPolicy | null;
  arms: Record<string, BanditArm>;
}

export interface PublishedVariantEntry {
  post_id: string;
  variant_id: string;
  voice_id: string;
  hook_type: string;
  blog_post_asset_id: number;
  approver: string;
  approvedAt: string;
  publishedAt: string;
  /** Instagram post_id stamped by Loop 4 IG scheduler after distribution. */
  instagram_post_id?: string;
}

export interface PublishedVariantsFile {
  _schema: string;
  _description: string;
  lastUpdatedAt: string | null;
  entries: PublishedVariantEntry[];
}

export interface GuardrailResult {
  passed: boolean;
  checks: {
    bannedClaim: boolean;
    unsourcedStat: boolean;
    brandVoice: boolean;
  };
  failReasons: string[];
}

export interface VoiceVariant {
  variantId: string;
  voiceId: string;
  voiceLabel: string;
  blogPostAssetId: number;
  blogPostSlug: string;
  topic: string;
  persona: string;
  format: string;
  generatedAt: string;
  bodyText: string;
  hookType: string;
  predictedScore: number | null;
  guardrail: GuardrailResult;
  status: "pending" | "approved" | "rejected" | "published";
  approver?: string;
  approvedAt?: string;
  rejectReason?: string;
}

export interface SelfImprovementProposal {
  proposalId: string;
  proposedAt: string;
  evidence: {
    underperformers: Array<{ voiceId: string; armKey: string; mean: number; impressions: number }>;
    topPerformers: Array<{ voiceId: string; armKey: string; mean: number; impressions: number }>;
  };
  proposals: Array<{
    action: "retire" | "spawn" | "reweight";
    voiceId: string;
    reason: string;
    newSpec?: Partial<VoiceSpec>;
    newWeight?: number;
  }>;
  status: "pending" | "applied" | "dismissed";
  appliedAt?: string;
  appliedBy?: string;
}
