import { randomUUID } from "crypto";
import { generateImage } from "@workspace/integrations-gemini-ai/image";
import { objectStorageClient, getPrivateObjectDir, parseObjectDir } from "./objectStorage.js";
import { logger } from "./logger.js";

const SITE_URL = "https://job-genie.ai";
const BLOG_IMAGE_PREFIX = "blog-hero-images";

export interface BlogHeroImagePrompt {
  title: string;
  summary?: string;
}

function buildPrompt({ title, summary }: BlogHeroImagePrompt): string {
  return [
    `Create a modern, editorial hero illustration for a career-advice blog post titled "${title}".`,
    summary ? `Article context: ${summary}` : "",
    "Style: clean flat-vector illustration with warm, professional colors (deep teal, cream, and coral accents), soft geometric shapes, no readable text or words anywhere in the image, no logos, high quality, 16:9 widescreen composition suitable as a website article header.",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Generates a brand-new, content-specific hero image for a blog post via
 * Gemini image generation, uploads it to object storage, and returns a
 * stable public URL served through the api-server's /api/blog-images route.
 */
export async function generateBlogHeroImage(
  prompt: BlogHeroImagePrompt,
  slugHint: string
): Promise<string> {
  const { b64_json, mimeType } = await generateImage(buildPrompt(prompt), { aspectRatio: "16:9" });
  const buffer = Buffer.from(b64_json, "base64");
  const ext = mimeType.includes("png") ? "png" : "jpg";
  const safeSlug = slugHint.replace(/[^a-z0-9-]/gi, "-").slice(0, 60);
  const filename = `${safeSlug}-${randomUUID().slice(0, 8)}.${ext}`;

  const { bucketName, prefix } = parseObjectDir(getPrivateObjectDir());
  const objectName = [prefix, BLOG_IMAGE_PREFIX, filename].filter(Boolean).join("/");

  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(objectName);
  await file.save(buffer, {
    contentType: mimeType,
    metadata: { cacheControl: "public, max-age=31536000, immutable" },
  });

  logger.info({ slugHint, filename }, "Generated unique blog hero image");

  return `${SITE_URL}/api/blog-images/${filename}`;
}

export async function streamBlogImage(
  filename: string
): Promise<{ stream: NodeJS.ReadableStream; contentType: string } | null> {
  // Guard against path traversal — only allow the exact filename shape we generate.
  if (!/^[a-z0-9-]+\.(png|jpg)$/i.test(filename)) {
    return null;
  }

  const { bucketName, prefix } = parseObjectDir(getPrivateObjectDir());
  const objectName = [prefix, BLOG_IMAGE_PREFIX, filename].filter(Boolean).join("/");

  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(objectName);
  const [exists] = await file.exists();
  if (!exists) return null;

  const [metadata] = await file.getMetadata();
  return {
    stream: file.createReadStream(),
    contentType: (metadata.contentType as string) || "image/png",
  };
}
