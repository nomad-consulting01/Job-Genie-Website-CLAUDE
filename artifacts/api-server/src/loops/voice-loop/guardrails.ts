import type { GuardrailResult, VoiceSpec } from "./types.js";

const GLOBAL_BANNED_CLAIMS = [
  /guaranteed.{0,30}job/i,
  /100% success/i,
  /never fail/i,
  /get hired.{0,20}guaranteed/i,
  /we are not responsible/i,
];

const UNSOURCED_STAT_PATTERN = /\b(\d+(?:\.\d+)?)\s*%(?!\s*(?:of\s+the\s+time|off|discount|increase|decrease|improvement|reduction|growth|roi|apr|apy))/gi;

const SOURCE_PATTERNS = [
  /according to/i,
  /source:/i,
  /data from/i,
  /study by/i,
  /research shows/i,
  /per the/i,
  /^\s*\*/m,
  /https?:\/\//,
  /bureau of labor/i,
  /linkedin data/i,
  /indeed research/i,
  /glassdoor/i,
];

function hasBannedClaim(text: string, voice: VoiceSpec): boolean {
  for (const pattern of GLOBAL_BANNED_CLAIMS) {
    if (pattern.test(text)) return true;
  }
  for (const phrase of voice.bannedPhrases) {
    if (text.toLowerCase().includes(phrase.toLowerCase())) return true;
  }
  return false;
}

function hasUnsourcedStat(text: string): boolean {
  const stats = text.match(UNSOURCED_STAT_PATTERN);
  if (!stats || stats.length === 0) return false;

  const hasSource = SOURCE_PATTERNS.some((p) => p.test(text));
  if (hasSource) return false;

  if (stats.length > 2) return true;

  return false;
}

function hasBrandVoiceIssue(text: string, voice: VoiceSpec): boolean {
  for (const check of voice.brandVoiceChecks) {
    switch (check) {
      case "specific_numbers":
        if (!/\b\d+\b/.test(text)) return true;
        break;
      case "reader_callout":
        if (!/\byou\b/i.test(text)) return true;
        break;
      case "urgency_signal":
        if (!/\b(now|today|don't wait|stop|right now|immediately|before|miss)\b/i.test(text)) return true;
        break;
      case "first_person_present":
        if (!/\b(I|I've|I'm|I had|I was)\b/.test(text)) return true;
        break;
      case "emotional_validation":
        if (!/\b(frustrating|difficult|hard|overwhelming|exhausting|soul-crushing|draining|understand|valid)\b/i.test(text)) return true;
        break;
      case "peer_tone":
        if (!/\b(friend|fellow|same|we|us|our|together)\b/i.test(text)) return true;
        break;
      case "specific_stat":
        if (!/\b\d+\b/.test(text)) return true;
        break;
      case "logical_structure":
        if (!/(because|therefore|since|as a result|which means|this means)/i.test(text)) return true;
        break;
      case "evidence_based_cta":
        if (!/\b(data|evidence|research|shows|proven|study|found)\b/i.test(text)) return true;
        break;
      case "myth_named_explicitly":
        if (!/\b(myth|believe|think|told|conventional wisdom|everyone says|the advice)\b/i.test(text)) return true;
        break;
      case "counterintuitive_flip":
        if (!/\b(actually|in fact|opposite|wrong|instead|but|however|counterintuitive|surprise)\b/i.test(text)) return true;
        break;
      case "specific_alternative":
        if (!/\b(instead|try|do this|here's what|the real)\b/i.test(text)) return true;
        break;
      case "scene_present_tense":
        if (text.length < 100) return true;
        break;
      case "character_specificity":
        if (!/\b(Sarah|Marcus|Alex|Jordan|Taylor|a job seeker|a recruiter|a hiring manager|\w+ was|\w+ had)\b/i.test(text)) return true;
        break;
      case "narrative_resolution":
        if (!/\b(discovered|realized|found|learned|turned|changed|finally|result|outcome)\b/i.test(text)) return true;
        break;
    }
  }
  return false;
}

export function runGuardrails(bodyText: string, voice: VoiceSpec): GuardrailResult {
  const bannedClaim = hasBannedClaim(bodyText, voice);
  const unsourcedStat = hasUnsourcedStat(bodyText);
  const brandVoice = hasBrandVoiceIssue(bodyText, voice);

  const failReasons: string[] = [];
  if (bannedClaim) failReasons.push("Contains a banned claim or phrase");
  if (unsourcedStat) failReasons.push("Contains multiple percentage stats without a source");
  if (brandVoice) failReasons.push(`Brand voice check failed for ${voice.id} (${voice.brandVoiceChecks.join(", ")})`);

  return {
    passed: failReasons.length === 0,
    checks: { bannedClaim, unsourcedStat, brandVoice },
    failReasons,
  };
}
