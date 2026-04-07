// DB health check route — used during Phase 1 setup verification only.
// Hit GET /api/health to confirm Prisma can reach the database.
// Safe to keep in production (read-only, no sensitive data returned).
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    // Run a lightweight query: count rows in SystemConfig.
    // Table exists but is empty at this point — that's fine.
    const configCount = await db.systemConfig.count();
    const blockCount = await db.block.count();
    const userCount = await db.user.count();

    return NextResponse.json({
      status: "ok",
      database: "connected",
      tables: {
        systemConfig: configCount,
        blocks: blockCount,
        users: userCount,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { status: "error", database: "unreachable", error: message },
      { status: 500 }
    );
  }
}
