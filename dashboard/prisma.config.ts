// Prisma config — loads env vars from .env.local
import "dotenv/config";
import { defineConfig } from "prisma/config";
import path from "path";
import dotenv from "dotenv";

// Load .env.local which Next.js uses and override any values loaded from .env
dotenv.config({ path: path.resolve(__dirname, ".env.local"), override: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
