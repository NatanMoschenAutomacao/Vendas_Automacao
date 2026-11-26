import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O motor de cálculo é um pacote TypeScript do workspace.
  transpilePackages: ["@zanatta/engine"],
  serverExternalPackages: ["@node-rs/argon2"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
