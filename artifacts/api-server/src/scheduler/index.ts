import cron from "node-cron";
import { engineConfig } from "../config/engine.js";
import { logger } from "../lib/logger.js";

let loop1Task: cron.ScheduledTask | null = null;
let loop1Running = false;

let loop2Task: cron.ScheduledTask | null = null;
let loop2Running = false;

let loop3Task: cron.ScheduledTask | null = null;
let loop3Running = false;

let scraperTask: cron.ScheduledTask | null = null;
let scraperRunning = false;

export function startScheduler(): void {
  // 2 AM — Listing scraper (fills pending queue, no Claude cost)
  const scraperSchedule = engineConfig.listingScraper.cronSchedule;
  logger.info({ schedule: scraperSchedule }, "Scheduler: scheduling listing scraper");

  scraperTask = cron.schedule(scraperSchedule, async () => {
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

  logger.info("Scheduler started (scraper 2AM → Loop1 3AM → Loop2 4AM → Loop3 5AM)");
}

export function stopScheduler(): void {
  scraperTask?.stop();
  loop1Task?.stop();
  loop2Task?.stop();
  loop3Task?.stop();
  logger.info("Scheduler stopped");
}

export function getSchedulerStatus() {
  return {
    listingScraper: {
      schedule: engineConfig.listingScraper.cronSchedule,
      running: scraperRunning,
      urls: engineConfig.listingScraper.urls,
    },
    loop1: {
      schedule: engineConfig.loop1.cronSchedule,
      running: loop1Running,
    },
    loop2: {
      schedule: engineConfig.loop2.cronSchedule,
      running: loop2Running,
      channels: engineConfig.loop2.channels,
    },
    loop3: {
      schedule: engineConfig.loop3.cronSchedule,
      running: loop3Running,
    },
  };
}
