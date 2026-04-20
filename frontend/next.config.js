/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Produce a fully static export so the Next.js app can be served by any
  // static file server (including FastAPI's StaticFiles mount for our
  // single-container Fly.io deploy).
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  experimental: {},
};

module.exports = nextConfig;
