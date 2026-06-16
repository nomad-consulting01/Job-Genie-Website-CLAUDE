import cron from "node-cron";
import { engineConfig } from "../config/engine.js";
import { logger } from "../lib/logger.js";

let loop1Task: cron.ScheduledTask | null = null;
let loop1Running = false;

export function startScheduler(): void {
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

  logger.info("Scheduler started");
}

export function stopScheduler(): void {
  loop1Task?.stop();
  logger.info("Scheduler stopped");
}

export function getSchedulerStatus() {
  return {
    loop1: {
      schedule: engineConfig.loop1.cronSchedule,
      running: loop1Running,
    },
  };
}
