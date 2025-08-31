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

  let query = sb.from("orders").select("*").eq("tenant_id", tenantId);

  if (from) query = query.gte("order_date", from);
  if (to) query = query.lte("order_date", to);
  if (channel && channel !== "all") query = query.eq("channel", channel);

  // Latest 50 orders
  const { data, error } = await query.order("order_date", { ascending: false }).limit(50);

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }

  return NextResponse.json({ orders: data });
}
