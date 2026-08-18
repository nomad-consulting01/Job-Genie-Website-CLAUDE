import cron from "node-cron";
import { engineConfig } from "../config/engine.js";
import { logger } from "../lib/logger.js";

let loop1Task: cron.ScheduledTask | null = null;
let loop1Running = false;

let loop2Task: cron.ScheduledTask | null = null;
let loop2Running = false;

let loop3Task: cron.ScheduledTask | null = null;
let loop3Running = false;

let loop4Task: cron.ScheduledTask | null = null;
let loop4Running = false;

let scraperTask: cron.ScheduledTask | null = null;
let scraperRunning = false;

let reactorHarvestTask: cron.ScheduledTask | null = null;
let reactorHarvestRunning = false;

let voiceLoopMetricsTask: cron.ScheduledTask | null = null;
let voiceLoopMetricsRunning = false;

let voiceLoopSelfImproveTask: cron.ScheduledTask | null = null;
let voiceLoopSelfImproveRunning = false;

// ── Pause / Resume ────────────────────────────────────────────────────────────
// When a loop name is in this set its scheduled cron tick is a no-op.
// Running an already-in-flight loop is unaffected — pause prevents the NEXT fire.
export type LoopName =
  | "listingScraper"
  | "loop1"
  | "loop2"
  | "loop3"
  | "loop4"
  | "reactorInviteHarvester"
  | "voiceLoopMetrics"
  | "voiceLoopSelfImprove";

const pausedLoops = new Set<LoopName>();
const pausedAt: Partial<Record<LoopName, string>> = {};

export function pauseLoop(name: LoopName): { paused: boolean; alreadyPaused: boolean } {
  if (pausedLoops.has(name)) return { paused: false, alreadyPaused: true };
  pausedLoops.add(name);
  pausedAt[name] = new Date().toISOString();
  logger.info({ loop: name }, "Scheduler: loop PAUSED");
  return { paused: true, alreadyPaused: false };
}

export function resumeLoop(name: LoopName): { resumed: boolean; wasRunning: boolean } {
  const wasRunning = pausedLoops.has(name);
  pausedLoops.delete(name);
  delete pausedAt[name];
  logger.info({ loop: name }, "Scheduler: loop RESUMED");
  return { resumed: true, wasRunning };
}

export function getPausedLoops(): Record<LoopName, { paused: boolean; pausedAt?: string }> {
  const all: LoopName[] = [
    "listingScraper", "loop1", "loop2", "loop3", "loop4",
    "reactorInviteHarvester", "voiceLoopMetrics", "voiceLoopSelfImprove",
  ];
  return Object.fromEntries(
    all.map((n) => [n, { paused: pausedLoops.has(n), pausedAt: pausedAt[n] }])
  ) as Record<LoopName, { paused: boolean; pausedAt?: string }>;
}

export function startScheduler(): void {
  // 2 AM — Listing scraper (fills pending queue, no Claude cost)
  const scraperSchedule = engineConfig.listingScraper.cronSchedule;
  logger.info({ schedule: scraperSchedule }, "Scheduler: scheduling listing scraper");

  scraperTask = cron.schedule(scraperSchedule, async () => {
    if (pausedLoops.has("listingScraper")) { logger.info("Listing scraper PAUSED — skipping scheduled fire"); return; }
    if (scraperRunning) {
      logger.warn("Listing scraper already running — skipping");
      return;
    }
    scraperRunning = true;
    try {
      logger.info("Scheduler: triggering listing scraper");
      const { runListingScraper } = await import("../loops/scrape-listings/index.js");
      await runListingScraper();
    } catch (err) {
      logger.error({ err }, "Scheduler: listing scraper failed");
    } finally {
      scraperRunning = false;
    }
  });

  // 3 AM — Loop 1 (Claude normalise + answer + publish AEO)
  const loop1Schedule = engineConfig.loop1.cronSchedule;
  logger.info({ schedule: loop1Schedule }, "Scheduler: scheduling Loop 1");

  loop1Task = cron.schedule(loop1Schedule, async () => {
    if (pausedLoops.has("loop1")) { logger.info("Loop 1 PAUSED — skipping scheduled fire"); return; }
    if (loop1Running) {
      logger.warn("Loop 1 already running — skipping scheduled trigger");
      return;
    }
    loop1Running = true;
    try {
      logger.info("Scheduler: triggering Loop 1");
      const { run } = await import("../loops/loop1/index.js");
      await run();
    } catch (err) {
      logger.error({ err }, "Scheduler: Loop 1 failed");
    } finally {
      loop1Running = false;
    }
  });

  // 4 AM — Loop 2 (multi-channel content × 2 variants)
  const loop2Schedule = engineConfig.loop2.cronSchedule;
  logger.info({ schedule: loop2Schedule }, "Scheduler: scheduling Loop 2");

  loop2Task = cron.schedule(loop2Schedule, async () => {
    if (pausedLoops.has("loop2")) { logger.info("Loop 2 PAUSED — skipping scheduled fire"); return; }
    if (loop2Running) {
      logger.warn("Loop 2 already running — skipping scheduled trigger");
      return;
    }
    loop2Running = true;
    try {
      logger.info("Scheduler: triggering Loop 2");
      const { run } = await import("../loops/loop2/index.js");
      await run();
    } catch (err) {
      logger.error({ err }, "Scheduler: Loop 2 failed");
    } finally {
      loop2Running = false;
    }
  });

  // 5 AM — Loop 3 (Blog publication: slug + SEO meta + FAQ JSON-LD)
  const loop3Schedule = engineConfig.loop3.cronSchedule;
  logger.info({ schedule: loop3Schedule }, "Scheduler: scheduling Loop 3");

  loop3Task = cron.schedule(loop3Schedule, async () => {
    if (pausedLoops.has("loop3")) { logger.info("Loop 3 PAUSED — skipping scheduled fire"); return; }
    if (loop3Running) {
      logger.warn("Loop 3 already running — skipping scheduled trigger");
      return;
    }
    loop3Running = true;
    try {
      logger.info("Scheduler: triggering Loop 3");
      const { run } = await import("../loops/loop3/index.js");
      await run();
    } catch (err) {
      logger.error({ err }, "Scheduler: Loop 3 failed");
    } finally {
      loop3Running = false;
    }
  });

  // 6 AM — Loop 4 (Distribution: GEO pages, Reddit, Email, LinkedIn)
  const loop4Schedule = engineConfig.loop4.cronSchedule;
  logger.info({ schedule: loop4Schedule }, "Scheduler: scheduling Loop 4");

  loop4Task = cron.schedule(loop4Schedule, async () => {
    if (pausedLoops.has("loop4")) { logger.info("Loop 4 PAUSED — skipping scheduled fire"); return; }
    if (loop4Running) {
      logger.warn("Loop 4 already running — skipping scheduled trigger");
      return;
    }
    loop4Running = true;
    try {
      logger.info("Scheduler: triggering Loop 4");
      const { run } = await import("../loops/loop4/index.js");
      await run();
    } catch (err) {
      logger.error({ err }, "Scheduler: Loop 4 failed");
    } finally {
      loop4Running = false;
    }
  });

  // Every 6 hours — Reactor Invite Harvester (harvest Facebook post reactions)
  const reactorSchedule = engineConfig.reactorInvites.cronSchedule;
  logger.info({ schedule: reactorSchedule }, "Scheduler: scheduling Reactor Invite Harvester");

  reactorHarvestTask = cron.schedule(reactorSchedule, async () => {
    if (pausedLoops.has("reactorInviteHarvester")) { logger.info("Reactor Harvester PAUSED — skipping scheduled fire"); return; }
    if (reactorHarvestRunning) {
      logger.warn("Reactor invite harvester already running — skipping scheduled trigger");
      return;
    }
    reactorHarvestRunning = true;
    try {
      logger.info("Scheduler: triggering Reactor Invite Harvester");
      const { runHarvester } = await import("../loops/reactor-invite-queue/harvester.js");
      await runHarvester();
    } catch (err) {
      logger.error({ err }, "Scheduler: Reactor Invite Harvester failed");
    } finally {
      reactorHarvestRunning = false;
    }
  });

  // 8 AM daily — Voice Loop Stations ①②③ (FB metrics + attribution + ledger update)
  const voiceMetricsSchedule = engineConfig.voiceLoop.cronScheduleMetrics;
  logger.info({ schedule: voiceMetricsSchedule }, "Scheduler: scheduling Voice Loop daily metrics pipeline");

  voiceLoopMetricsTask = cron.schedule(voiceMetricsSchedule, async () => {
    if (pausedLoops.has("voiceLoopMetrics")) { logger.info("Voice Loop metrics PAUSED — skipping scheduled fire"); return; }
    if (voiceLoopMetricsRunning) {
      logger.warn("Voice Loop metrics pipeline already running — skipping");
      return;
    }
    voiceLoopMetricsRunning = true;
    try {
      logger.info("Scheduler: triggering Voice Loop daily metrics pipeline");
      const { runDailyMetricsPipeline } = await import("../loops/voice-loop/index.js");
      const result = await runDailyMetricsPipeline();
      logger.info({ result }, "Voice Loop daily metrics pipeline completed");
    } catch (err) {
      logger.error({ err }, "Scheduler: Voice Loop daily metrics pipeline failed");
    } finally {
      voiceLoopMetricsRunning = false;
    }
  });

  // Sunday 1 AM — Voice Loop Station ⑦ (weekly self-improvement proposal, human-gated)
  const voiceSelfImproveSchedule = engineConfig.voiceLoop.cronScheduleSelfImprove;
  logger.info({ schedule: voiceSelfImproveSchedule }, "Scheduler: scheduling Voice Loop weekly self-improve");

  voiceLoopSelfImproveTask = cron.schedule(voiceSelfImproveSchedule, async () => {
    if (pausedLoops.has("voiceLoopSelfImprove")) { logger.info("Voice Loop self-improve PAUSED — skipping scheduled fire"); return; }
    if (voiceLoopSelfImproveRunning) {
      logger.warn("Voice Loop self-improve already running — skipping");
      return;
    }
    voiceLoopSelfImproveRunning = true;
    try {
      logger.info("Scheduler: triggering Voice Loop weekly self-improve (Station ⑦)");
      const { runVoiceLibrarySelfImprove } = await import("../loops/voice-loop/selfImprove.js");
      const result = await runVoiceLibrarySelfImprove();
      logger.info({ result }, "Voice Loop weekly self-improve completed — proposal requires human approval");
    } catch (err) {
      logger.error({ err }, "Scheduler: Voice Loop weekly self-improve failed");
    } finally {
      voiceLoopSelfImproveRunning = false;
    }
  });

  logger.info("Scheduler started (scraper 2AM → Loop1 3AM → Loop2 4AM → Loop3 5AM → Loop4 6AM → Reactor every 6h → VoiceLoop metrics 8AM daily → VoiceLoop self-improve Sunday 1AM)");
}

export function stopScheduler(): void {
  scraperTask?.stop();
  loop1Task?.stop();
  loop2Task?.stop();
  loop3Task?.stop();
  loop4Task?.stop();
  reactorHarvestTask?.stop();
  voiceLoopMetricsTask?.stop();
  voiceLoopSelfImproveTask?.stop();
  logger.info("Scheduler stopped");
}

export function getSchedulerStatus() {
  const paused = getPausedLoops();
  return {
    listingScraper: {
      schedule: engineConfig.listingScraper.cronSchedule,
      running: scraperRunning,
      paused: paused.listingScraper.paused,
      pausedAt: paused.listingScraper.pausedAt,
      urls: engineConfig.listingScraper.urls,
    },
    loop1: {
      schedule: engineConfig.loop1.cronSchedule,
      running: loop1Running,
      paused: paused.loop1.paused,
      pausedAt: paused.loop1.pausedAt,
    },
    loop2: {
      schedule: engineConfig.loop2.cronSchedule,
      running: loop2Running,
      paused: paused.loop2.paused,
      pausedAt: paused.loop2.pausedAt,
      channels: engineConfig.loop2.channels,
    },
    loop3: {
      schedule: engineConfig.loop3.cronSchedule,
      running: loop3Running,
      paused: paused.loop3.paused,
      pausedAt: paused.loop3.pausedAt,
    },
    loop4: {
      schedule: engineConfig.loop4.cronSchedule,
      running: loop4Running,
      paused: paused.loop4.paused,
      pausedAt: paused.loop4.pausedAt,
    },
    reactorInviteHarvester: {
      schedule: engineConfig.reactorInvites.cronSchedule,
      running: reactorHarvestRunning,
      paused: paused.reactorInviteHarvester.paused,
      pausedAt: paused.reactorInviteHarvester.pausedAt,
    },
    voiceLoopMetrics: {
      schedule: engineConfig.voiceLoop.cronScheduleMetrics,
      running: voiceLoopMetricsRunning,
      paused: paused.voiceLoopMetrics.paused,
      pausedAt: paused.voiceLoopMetrics.pausedAt,
    },
    voiceLoopSelfImprove: {
      schedule: engineConfig.voiceLoop.cronScheduleSelfImprove,
      running: voiceLoopSelfImproveRunning,
      paused: paused.voiceLoopSelfImprove.paused,
      pausedAt: paused.voiceLoopSelfImprove.pausedAt,
    },
  };
}
