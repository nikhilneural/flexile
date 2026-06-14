import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    Object.assign(config.resolve.alias, {
      "@tiptap/extension-bubble-menu": false,
      "@tiptap/extension-floating-menu": false,
    });
    return config;
  },
  experimental: {
    typedRoutes: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.r2.cloudflarestorage.com",
      },
    ],
  },
};

export default nextConfig;
