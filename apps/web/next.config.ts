import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O motor de cálculo é um pacote TypeScript do workspace.
  transpilePackages: ["@zanatta/engine"],
  serverExternalPackages: ["@node-rs/argon2"],
  experimental: {
    // Imagens de até 4 MB, com folga para o envelope do formulário.
    serverActions: { bodySizeLimit: "5mb" },
  },
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
