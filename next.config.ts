import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 16 rejects /_next/* dev-asset requests whose Host/Origin isn't
  // localhost, so tunnelling `next dev` to a phone (ngrok) served the HTML but
  // 403'd every JS chunk — the page rendered unhydrated and every control was
  // dead. Allow the tunnel hostnames. Dev-only; ignored by `next build`.
  allowedDevOrigins: [
    "*.ngrok-free.app",
    "*.ngrok-free.dev",
    "*.ngrok.app",
    "*.ngrok.io",
  ],
};

export default nextConfig;
