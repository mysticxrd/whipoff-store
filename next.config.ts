import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

export default nextConfig;
