export type Loop2Channel = "newsletter" | "blog_post" | "linkedin" | "email_nurture";

export interface EngineConfig {
  loop4: {
    cronSchedule: string;
    maxItemsPerChannel: number;
  };
  loop3: {
    cronSchedule: string;
    maxPostsPerRun: number;
    costBudgetUsd: number;
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
}

export const engineConfig: EngineConfig = {
  loop4: {
    cronSchedule: process.env["LOOP4_CRON"] ?? "0 6 * * *",
    maxItemsPerChannel: parseInt(process.env["LOOP4_MAX_ITEMS"] ?? "20"),
  },
  loop3: {
    cronSchedule: process.env["LOOP3_CRON"] ?? "0 5 * * *",
    maxPostsPerRun: parseInt(process.env["LOOP3_MAX_POSTS"] ?? "5"),
    costBudgetUsd: parseFloat(process.env["LOOP3_COST_BUDGET_USD"] ?? "1.00"),
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
