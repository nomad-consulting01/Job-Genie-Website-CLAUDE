export interface EngineConfig {
  loop1: {
    cronSchedule: string;
    maxQuestionsPerRun: number;
    costBudgetUsd: number;
    qualityScoreThreshold: number;
    targetSubreddits: string[];
    searchQueries: string[];
    dedupeThreshold: number;
  };
  listingScraper: {
    cronSchedule: string;
    urls: string[];
    dedupeThreshold: number;
  };
}

export const engineConfig: EngineConfig = {
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
  listingScraper: {
    cronSchedule: process.env["LISTING_SCRAPER_CRON"] ?? "0 2 * * *",
    urls: (process.env["LISTING_SCRAPER_URLS"] ?? [
      // r/jobs — confirmed by user
      "https://www.reddit.com/r/jobs/top/?t=year",
      "https://www.reddit.com/r/jobs/top/?t=month",
      // r/careerguidance — user provided
      "https://www.reddit.com/search/?q=r+careerguidance+subreddit&type=posts&sort=top&t=year",
      "https://www.reddit.com/r/careerguidance/top/?t=month",
      // r/cscareerquestions — user provided
      "https://www.reddit.com/search/?q=r+cscareerquestions&type=posts&sort=top&t=year",
      // r/recruitinghell — user provided
      "https://www.reddit.com/search/?q=r+recruitinghell&type=posts&sort=top&t=year",
      // r/resumes — user provided
      "https://www.reddit.com/search/?q=r+resumes&type=posts&sort=top&t=year",
      // extras
      "https://www.reddit.com/r/jobsearchhacks/top/?t=year",
    ].join(",")).split(",").map((u) => u.trim()).filter(Boolean),
    dedupeThreshold: 0.75,
  },
};
