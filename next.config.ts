import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const deployEnvironment = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";
const releaseName = process.env.VERCEL_GIT_COMMIT_SHA;
const isProductionDeploy = process.env.VERCEL_ENV === "production";
const shouldUploadSourceMaps =
  process.env.VERCEL_ENV === "preview" || isProductionDeploy;

const nextConfig: NextConfig = {
  // Expose only the non-sensitive deployment label so browser telemetry is tagged the
  // same way as server and edge events. VERCEL_ENV itself is build/server scoped.
  env: {
    NEXT_PUBLIC_DEPLOY_ENV: deployEnvironment,
  },
  // The whole /products tree was removed — Whipoff sells a single product and the homepage IS
  // that product surface. Permanently redirect the old listing (/products) and any old PDP URL
  // (/products/:slug, live/indexed) to the homepage so external links and bookmarks don't 404.
  async redirects() {
    return [
      {
        source: "/products",
        destination: "/",
        permanent: true,
      },
      {
        source: "/products/:slug*",
        destination: "/",
        permanent: true,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: "whipoff",
  // Keep Preview and Production releases, artifacts, and issues in dedicated projects.
  project: isProductionDeploy ? "whipoff-production" : "whipoff-preview",
  // A release without uploaded maps is not deployable. Throwing here makes any release
  // creation or source-map upload failure stop the Vercel build.
  errorHandler(error) {
    throw error;
  },
  telemetry: false,
  silent: !process.env.CI,
  release: {
    name: releaseName,
    deploy:
      process.env.VERCEL_ENV && releaseName
        ? {
            env: deployEnvironment,
            name: process.env.VERCEL_URL,
          }
        : undefined,
  },
  // Sentry consumes its standard auth-token environment variable internally.
  // Preview and Production upload to their dedicated projects; local builds never upload.
  // Delete generated maps after upload so the deployment does not serve them publicly.
  sourcemaps: {
    disable: !shouldUploadSourceMaps,
    deleteSourcemapsAfterUpload: true,
  },
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
