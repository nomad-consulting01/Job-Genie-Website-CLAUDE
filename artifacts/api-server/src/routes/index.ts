import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import eventsRouter from "./events.js";
import metricsRouter from "./metrics.js";
import newsletterRouter from "./newsletter.js";
import publishRouter from "./publish.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(eventsRouter);
router.use(metricsRouter);
router.use(newsletterRouter);
router.use(publishRouter);

export default router;
