import { NextRequest, NextResponse } from "next/server";
import { supaSrv } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const tenantId = url.searchParams.get("tenant_id");

  if (!tenantId) {
    return NextResponse.json({ error: "tenant_id is required" }, { status: 400 });
  }

  const sb = supaSrv();

  const { data, error } = await sb
    .from("channel_accounts")
    .select("id, channel, status, auth_json->>store_domain as store_domain")
    .eq("tenant_id", tenantId);

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 });
  }

  return NextResponse.json({ accounts: data });
}
