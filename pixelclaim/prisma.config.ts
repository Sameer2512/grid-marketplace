import "dotenv/config";
import { defineConfig } from "prisma/config";

// NOTE on Supabase + Prisma v7:
// - DATABASE_URL should point to the POOLED connection (port 6543) at runtime.
// - When running `prisma migrate dev` or `prisma migrate deploy`, temporarily
//   set DATABASE_URL to the DIRECT connection (port 5432) to bypass PgBouncer,
//   or set it in your shell before running the migrate command:
//   DATABASE_URL="<direct_url>" npx prisma migrate dev

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"]!,
  },
});
