import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import adminRouter from "./routes/admin.js";
import corpusRouter from "./routes/corpus.js";
import loopsRouter from "./routes/loops.js";
import qaRouter from "./routes/qa.js";
import { logger } from "./lib/logger.js";
import { startScheduler } from "./scheduler/index.js";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);
app.use("/api/admin", adminRouter);
app.use("/api/admin/corpus", corpusRouter);
app.use("/api/admin/loops", loopsRouter);
app.use("/api/qa", qaRouter);

if (process.env["NODE_ENV"] !== "test") {
  startScheduler();
}

export default app;
