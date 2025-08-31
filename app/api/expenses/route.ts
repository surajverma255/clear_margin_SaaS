import { NextRequest, NextResponse } from "next/server";
import { supaSrv } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const tenantId = url.searchParams.get("tenant_id");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const channel = url.searchParams.get("channel");

  if (!tenantId) {
    return NextResponse.json({ error: "tenant_id is required" }, { status: 400 });
  }

  const sb = supaSrv();
  let query = sb.from("daily_metrics_mv").select("*").eq("tenant_id", tenantId);

  if (from) query = query.gte("day", from);
  if (to) query = query.lte("day", to);
  if (channel && channel !== "all") query = query.eq("channel", channel);

  const { data, error } = await query;
  if (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 });
  }

  const summary = {
    fees_total: data.reduce((s, r) => s + (Number(r.fees_total) || 0), 0),
    commission_fees: data.reduce((s, r) => s + (Number(r.commission_fees) || 0), 0),
    logistics_fees: data.reduce((s, r) => s + (Number(r.logistics_fees) || 0), 0),
    returns_amount: data.reduce((s, r) => s + (Number(r.returns_amount) || 0), 0),
    ads_spend: data.reduce((s, r) => s + (Number(r.ads_spend) || 0), 0),
  };

  return NextResponse.json({ summary });
}
