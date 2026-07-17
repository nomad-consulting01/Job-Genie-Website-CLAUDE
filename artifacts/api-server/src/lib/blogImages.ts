import { randomUUID } from "crypto";
import { generateImage } from "@workspace/integrations-gemini-ai/image";
import { objectStorageClient, getPrivateObjectDir, parseObjectDir } from "./objectStorage.js";
import { logger } from "./logger.js";
import { SITE_URL } from "@workspace/site-config";
const BLOG_IMAGE_PREFIX = "blog-hero-images";

export type BlogHeroImageStyle = "dark_teal" | "warm_editorial";

export interface BlogHeroImagePrompt {
  title: string;
  summary?: string;
}

const STYLE_DESCRIPTIONS: Record<BlogHeroImageStyle, string> = {
  dark_teal:
    "Style: cinematic photorealistic photography, moody dark navy/black background, dramatic glowing teal-cyan light accents and rim lighting, subtle volumetric haze, high-end premium tech/SaaS advertising aesthetic, shot on a professional camera with shallow depth of field, realistic human subject if a person appears, no readable text or words anywhere in the image, no logos, no UI icons or infographic labels, no flat illustration or vector art, high quality, 16:9 widescreen composition suitable as a website article header.",
  warm_editorial:
    "Style: warm cinematic photorealistic photography, cozy golden-hour amber and honey-toned lighting, realistic office or lifestyle setting, shallow depth of field, editorial magazine photography aesthetic, realistic human subject if a person appears, no readable text or words anywhere in the image, no logos, no UI icons or infographic labels, no flat illustration or vector art, high quality, 16:9 widescreen composition suitable as a website article header.",
};

function buildPrompt(
  { title, summary }: BlogHeroImagePrompt,
  style: BlogHeroImageStyle
): string {
  return [
    "IMPORTANT: Do not render any text, words, letters, numbers, captions, labels, subtitles, or typography of any kind anywhere in the image, including on screens, signage, papers, or floating UI elements. The image must be purely visual with zero legible characters.",
    `Create a striking, photorealistic hero photograph for a career-advice blog post titled "${title}".`,
    summary ? `Article context: ${summary}` : "",
    STYLE_DESCRIPTIONS[style],
    "Final reminder: absolutely no text, words, or writing of any kind should appear anywhere in the generated image.",
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
  slugHint: string,
  style: BlogHeroImageStyle = "dark_teal"
): Promise<string> {
  const { b64_json, mimeType } = await generateImage(buildPrompt(prompt, style), { aspectRatio: "16:9" });
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

  // Serve via wsrv.nl (Cloudflare-backed image CDN) so the og:image bypasses
  // Replit's GCP load balancer, which injects a GAESA session-affinity cookie
  // on every response. That cookie forces Cache-Control: private, breaking
  // Facebook's OG image crawler. wsrv.nl fetches from our API and re-serves
  // with Cache-Control: public — no cookie, no private override.
  const apiPath = `${SITE_URL}/api/blog-images/${filename}`.replace(/^https?:\/\//, "");
  return `https://wsrv.nl/?url=${apiPath}`;
}

/**
 * Returns a direct public GCS URL for a blog hero image so it bypasses
 * Replit's API proxy (which injects a Set-Cookie header that forces
 * Cache-Control: private and breaks Facebook/social OG image previews).
 */
export async function getBlogImagePublicUrl(
  filename: string
): Promise<{ publicUrl: string } | null> {
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

  try {
    await file.makePublic();
  } catch (e) {
    logger.warn({ filename, err: e instanceof Error ? e.message : String(e) }, "Could not make blog image public — falling back to signed URL");
    // Attempt signed URL as fallback (60-minute window)
    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 60 * 60 * 1000,
    });
    return { publicUrl: signedUrl };
  }

  return {
    publicUrl: `https://storage.googleapis.com/${bucketName}/${objectName}`,
  };
}

/** @deprecated Use getBlogImagePublicUrl + redirect instead */
export async function streamBlogImage(
  filename: string
): Promise<{ stream: NodeJS.ReadableStream; contentType: string } | null> {
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
