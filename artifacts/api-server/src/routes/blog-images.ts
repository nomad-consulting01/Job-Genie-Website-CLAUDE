import { Router, type IRouter } from "express";
import { streamBlogImage } from "../lib/blogImages.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

router.get("/blog-images/:filename", async (req, res) => {
  try {
    const result = await streamBlogImage(req.params.filename);
    if (!result) {
      res.status(404).end();
      return;
    }
    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    result.stream.pipe(res);
  } catch (err) {
    logger.error(
      { filename: req.params.filename, err: err instanceof Error ? err.message : String(err) },
      "Failed to stream blog hero image"
    );
    res.status(500).end();
  }
});

export default router;
