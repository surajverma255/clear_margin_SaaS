// app/api/metrics/by-state/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supaSrv } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const tenantId = url.searchParams.get("tenant_id");
    if (!tenantId) {
      return NextResponse.json({ error: "tenant_id is required" }, { status: 400 });
    }

    const from = url.searchParams.get("from") || null; // 'YYYY-MM-DD' or null
    const to   = url.searchParams.get("to")   || null;
    const channel = url.searchParams.get("channel") || "all"; // 'all' or 'shopify' etc

    const sb = supaSrv();

    // Call RPC. Parameter names must match function arg names.
    const { data, error } = await sb
      .rpc("orders_by_state", {
        p_tenant: tenantId,
        p_from: from,
        p_to: to,
        p_channel: channel
      });

    if (error) {
      console.error("RPC error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // data will be array of { state, state_code, total_orders }
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "unknown" }, { status: 500 });
  }
}
