import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import adminRouter from "./routes/admin.js";
import corpusRouter from "./routes/corpus.js";
import loopsRouter from "./routes/loops.js";
import qaRouter from "./routes/qa.js";
import blogRouter from "./routes/blog.js";
import answersRouter from "./routes/answers.js";
import sitemapRouter from "./routes/sitemap.js";
import blogHtmlRouter from "./routes/blog-html.js";
import redditAeoRouter from "./routes/reddit-aeo.js";
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
app.use("/api/admin/reddit-aeo", redditAeoRouter);
app.use("/api/qa", qaRouter);
app.use("/api/blog", blogRouter);
app.use("/api/answers", answersRouter);

// Dynamic sitemap.xml and llms.txt — served at /api/sitemap.xml and /api/llms.txt
app.use("/api", sitemapRouter);

// Blog post server-side HTML — per-post canonical, metadata, and article body for crawlers.
// Handles /blog/:slug with correct metadata.  Prerendered static files are served first
// (if they exist); dynamic SSR is the fallback for posts added after the last build.
app.use("/blog", blogHtmlRouter);

if (process.env["NODE_ENV"] !== "test") {
  startScheduler();
}

export default app;
