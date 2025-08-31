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
  let query = sb.from("sales_summary_mv").select("*").eq("tenant_id", tenantId);

  if (from) query = query.gte("day", from);
  if (to) query = query.lte("day", to);
  if (channel && channel !== "all") query = query.eq("channel", channel);

  const { data, error } = await query;
  if (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch sales summary" }, { status: 500 });
  }

  // Aggregate
  const summary = {
    gross: data.reduce((s, r) => s + (Number(r.gross) || 0), 0),
    cancelled: data.reduce((s, r) => s + (Number(r.cancelled) || 0), 0),
    returned: data.reduce((s, r) => s + (Number(r.returned) || 0), 0),
    net_sales: data.reduce((s, r) => s + (Number(r.net_sales) || 0), 0),
    orders: data.reduce((s, r) => s + (Number(r.orders) || 0), 0),
  };

  return NextResponse.json({ summary });
}
