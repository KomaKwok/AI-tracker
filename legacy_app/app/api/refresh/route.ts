import { NextResponse } from "next/server";
import { refreshRadarDataWithOptions } from "@/lib/radar/fetchers";

const SLOW_SOURCE_IDS = ["gemini-api-changelog"];

export async function POST() {
  try {
    const store = await refreshRadarDataWithOptions({
      excludeSourceIds: SLOW_SOURCE_IDS
    });

    setTimeout(() => {
      refreshRadarDataWithOptions({
        sourceIds: SLOW_SOURCE_IDS
      }).catch(() => {});
    }, 0);

    return NextResponse.json({
      ok: true,
      message: `Refresh complete for fast sources. ${store.signals.length} signals in store. Slow sources will continue in the background.`,
      lastUpdatedAt: store.lastUpdatedAt
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown refresh error";
    return NextResponse.json(
      {
        ok: false,
        message: `Refresh failed: ${message}`
      },
      { status: 500 }
    );
  }
}
