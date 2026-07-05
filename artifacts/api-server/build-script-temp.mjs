import { createRequire } from "node:module";
import path from "node:path";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";

globalThis.require = createRequire(import.meta.url);
const artifactDir = "/home/runner/workspace/artifacts/api-server";

await esbuild({
  entryPoints: [path.resolve(artifactDir, "src/scripts/regenerate-blog-hero-images.ts")],
  platform: "node",
  bundle: true,
  format: "esm",
  outdir: "/home/runner/workspace/artifacts/api-server/dist-regen",
  outExtension: { ".js": ".mjs" },
  logLevel: "info",
  external: [
    "*.node","sharp","better-sqlite3","sqlite3","canvas","bcrypt","argon2","fsevents","re2",
    "farmhash","xxhash-addon","bufferutil","utf-8-validate","ssh2","cpu-features","dtrace-provider",
    "isolated-vm","lightningcss","pg-native","oracledb","mongodb-client-encryption","nodemailer",
    "handlebars","knex","typeorm","protobufjs","onnxruntime-node","@tensorflow/*","@prisma/client",
    "@mikro-orm/*","@grpc/*","@swc/*","@aws-sdk/*","@azure/*","@opentelemetry/*","@google-cloud/*",
    "@google/*","googleapis","firebase-admin","@parcel/watcher","@sentry/profiling-node",
    "@tree-sitter/*","aws-sdk","classic-level","dd-trace","ffi-napi","grpc","hiredis","kerberos","leveldown",
  ],
  plugins: [
    esbuildPluginPino({ transports: ["pino-pretty"] })
  ],
  banner: {
    js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
  },
});
console.log("done");
