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
};
