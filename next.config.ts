import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle so the Docker image only needs the
  // traced dependencies rather than the whole node_modules tree.
  output: "standalone",
  // better-sqlite3 is a native addon; it has to be require()d at runtime
  // instead of being bundled into the server build.
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3"],
};

export default nextConfig;
