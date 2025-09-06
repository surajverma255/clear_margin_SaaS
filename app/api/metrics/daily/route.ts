// app/api/metrics/daily/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supaSrv } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const tenantId = url.searchParams.get("tenant_id");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const channel = url.searchParams.get("channel") || "all";

  if (!tenantId) {
    return NextResponse.json({ error: "tenant_id is required" }, { status: 400 });
  }

  const sb = supaSrv();
  // we have a materialized view for this created in the supabse table which we were using earlier
  // but have shifted to rpc for realtime data fetching and no refresh needed for mv.
  const { data, error } = await sb.rpc("get_daily_metrics", {
    p_tenant: tenantId,
    p_from: from,
    p_to: to,
    p_channel: channel
  });

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch metrics", detail: error }, { status: 500 });
  }

  return NextResponse.json({ metrics: data || [] });
}
