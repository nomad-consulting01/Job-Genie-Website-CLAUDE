export type Loop2Channel = "newsletter" | "blog_post" | "linkedin" | "email_nurture";

export interface EngineConfig {
  voiceLoop: {
    cronScheduleMetrics: string;
    cronScheduleSelfImprove: string;
    budgetUsd: number;
    minImpressionsGate: number;
  };
  loop4: {
    cronSchedule: string;
    maxItemsPerChannel: number;
  };
  loop3: {
    cronSchedule: string;
    maxPostsPerRun: number;
    costBudgetUsd: number;
    /** Cosine-like similarity threshold above which a new blog post is auto-redirected to its keeper. */
    cannibalThreshold: number;
  };
  loop1: {
    cronSchedule: string;
    maxQuestionsPerRun: number;
    costBudgetUsd: number;
    qualityScoreThreshold: number;
    targetSubreddits: string[];
    searchQueries: string[];
    dedupeThreshold: number;
  };
  loop2: {
    cronSchedule: string;
    maxAnswersPerRun: number;
    costBudgetUsd: number;
    channels: Loop2Channel[];
  };
  listingScraper: {
    cronSchedule: string;
    urls: string[];
    dedupeThreshold: number;
  };
  reactorInvites: {
    cronSchedule: string;
    lookbackDays: number;
    inviteReadyDelta: number;
    inviteReadyMinTotal: number;
    dailyCap: number;
    dailyCapWarning: number;
  };
}

export const engineConfig: EngineConfig = {
  voiceLoop: {
    cronScheduleMetrics: process.env["VOICE_LOOP_METRICS_CRON"] ?? "0 8 * * *",
    cronScheduleSelfImprove: process.env["VOICE_LOOP_SELF_IMPROVE_CRON"] ?? "0 1 * * 0",
    budgetUsd: parseFloat(process.env["VOICE_LOOP_BUDGET_USD"] ?? "2.00"),
    minImpressionsGate: parseInt(process.env["VOICE_LOOP_MIN_IMPRESSIONS"] ?? "500"),
  },
  loop4: {
    cronSchedule: process.env["LOOP4_CRON"] ?? "0 6 * * *",
    maxItemsPerChannel: parseInt(process.env["LOOP4_MAX_ITEMS"] ?? "20"),
  },
  loop3: {
    cronSchedule: process.env["LOOP3_CRON"] ?? "0 5 * * *",
    maxPostsPerRun: parseInt(process.env["LOOP3_MAX_POSTS"] ?? "5"),
    costBudgetUsd: parseFloat(process.env["LOOP3_COST_BUDGET_USD"] ?? "1.00"),
    cannibalThreshold: parseFloat(process.env["LOOP3_CANNIBAL_THRESHOLD"] ?? "0.80"),
  },
  loop1: {
    cronSchedule: process.env["LOOP1_CRON"] ?? "0 3 * * *",
    maxQuestionsPerRun: parseInt(process.env["LOOP1_MAX_QUESTIONS"] ?? "10"),
    costBudgetUsd: parseFloat(process.env["LOOP1_COST_BUDGET_USD"] ?? "2.00"),
    qualityScoreThreshold: parseFloat(process.env["LOOP1_QUALITY_THRESHOLD"] ?? "7.0"),
    targetSubreddits: (
      process.env["LOOP1_SUBREDDITS"] ??
      "jobs,jobsearchhacks,careerguidance,resumes,recruitinghell"
    ).split(","),
    searchQueries: [
      "no response job application ghosted",
      "resume getting ignored ATS",
      "ghost job posting fake listing",
      "hidden job market recruiter",
      "application silence no reply",
      "recruiter ghosted after interview",
      "networking job search not working",
    ],
    dedupeThreshold: 0.85,
  },
  loop2: {
    cronSchedule: process.env["LOOP2_CRON"] ?? "0 4 * * *",
    maxAnswersPerRun: parseInt(process.env["LOOP2_MAX_ANSWERS"] ?? "5"),
    costBudgetUsd: parseFloat(process.env["LOOP2_COST_BUDGET_USD"] ?? "3.00"),
    channels: ["newsletter", "blog_post", "linkedin", "email_nurture"],
  },
  reactorInvites: {
    cronSchedule: process.env["REACTOR_HARVEST_CRON"] ?? "0 */6 * * *",
    lookbackDays: parseInt(process.env["REACTOR_LOOKBACK_DAYS"] ?? "14"),
    inviteReadyDelta: parseInt(process.env["REACTOR_INVITE_DELTA"] ?? "10"),
    inviteReadyMinTotal: parseInt(process.env["REACTOR_INVITE_MIN_TOTAL"] ?? "25"),
    dailyCap: parseInt(process.env["REACTOR_DAILY_CAP"] ?? "1000"),
    dailyCapWarning: parseInt(process.env["REACTOR_CAP_WARNING"] ?? "900"),
  },
  listingScraper: {
    cronSchedule: process.env["LISTING_SCRAPER_CRON"] ?? "0 2 * * *",
    urls: (process.env["LISTING_SCRAPER_URLS"] ?? [
      "https://www.reddit.com/r/jobs/top/?t=year",
      "https://www.reddit.com/r/jobs/top/?t=month",
      "https://www.reddit.com/search/?q=r+careerguidance+subreddit&type=posts&sort=top&t=year",
      "https://www.reddit.com/r/careerguidance/top/?t=month",
      "https://www.reddit.com/search/?q=r+cscareerquestions&type=posts&sort=top&t=year",
      "https://www.reddit.com/search/?q=r+recruitinghell&type=posts&sort=top&t=year",
      "https://www.reddit.com/search/?q=r+resumes&type=posts&sort=top&t=year",
      "https://www.reddit.com/r/jobsearchhacks/top/?t=year",
    ].join(",")).split(",").map((u) => u.trim()).filter(Boolean),
    dedupeThreshold: 0.75,
  },
};
