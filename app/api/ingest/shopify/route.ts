import { NextRequest, NextResponse } from 'next/server';
import { ingestShopify } from '../../../../ingest/shopify';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { tenant_id } = await req.json();
  if (!tenant_id) return NextResponse.json({ error: 'tenant_id required' }, { status: 400 });

  await ingestShopify(tenant_id);
  return NextResponse.json({ ok: true });
}
