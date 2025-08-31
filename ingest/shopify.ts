/* eslint-disable no-console */
import 'dotenv/config';
import { supaSrv } from '../lib/supabase';

type ShopAuth = { 
  store_domain: string; 
  api_version: string; 
  access_token: string 
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function nextFrom(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const match = linkHeader.match(/<([^>]+)>; rel="next"/);
  return match ? match[1] : null;
}

function buildUrl(auth: ShopAuth, since?: string, pageUrl?: string) {
  if (pageUrl) return new URL(pageUrl);
  const url = new URL(
    `https://${auth.store_domain}/admin/api/${auth.api_version}/orders.json`
  );
  url.searchParams.set('status', 'any');
  url.searchParams.set('limit', '250');
  if (since) url.searchParams.set('updated_at_min', since);
  return url;
}

async function getWatermark(tenantId: string, accountId: string): Promise<string | null> {
  const sb = supaSrv();
  const { data, error } = await sb
    .from('sync_state')
    .select('last_updated_at')
    .eq('tenant_id', tenantId)
    .eq('channel', 'shopify')
    .eq('account_id', accountId)
    .maybeSingle();

  if (error) throw error;
  return data?.last_updated_at ?? null;
}

async function upsertOrder(tenantId: string, order: any, accountId: string) {
  const sb = supaSrv();
  const o = {
    tenant_id: tenantId,
    channel: 'shopify',
    account_id: accountId,
    external_order_id: order.id.toString(),
    order_date: order.created_at,
    currency: order.currency,
    financial_status: order.financial_status,
    fulfillment_status: order.fulfillment_status,
    gross_amount: order.total_price,
    discount_amount: order.total_discounts,
    net_sales_amount: order.current_total_price,
    created_at: order.created_at
  };
  await sb.from('orders').upsert(o, { onConflict: 'tenant_id,channel,external_order_id' });
}

/**
 * 🔹 Ingest one Shopify account
 */
async function ingestShopifyAccount(tenantId: string, accountId: string, auth: ShopAuth) {
  let since = await getWatermark(tenantId, accountId);
  if (!since) since = new Date(Date.now() - 7 * 864e5).toISOString(); // last 7 days

  let next: string | null = null;
  let lastUpdated: string | null = null;

  while (true) {
    const url = buildUrl(auth, since ?? undefined, next || undefined);
    const res = await fetch(url.toString(), {
      headers: { 'X-Shopify-Access-Token': auth.access_token }
    });
    if (!res.ok) throw new Error(`Shopify ${res.status}`);

    const body = await res.json();
    const orders = body.orders || [];

    for (const o of orders) {
      await upsertOrder(tenantId, o, accountId);
      lastUpdated = o.updated_at;
    }

    const callHdr = res.headers.get('x-shopify-shop-api-call-limit');
    if (callHdr) {
      const [u, t] = callHdr.split('/').map(Number);
      if (u / t > 0.8) await sleep(600); // throttle
    }

    next = nextFrom(res.headers.get('link') || res.headers.get('Link'));
    if (!next) break;
  }

  const sb = supaSrv();
  if (lastUpdated) {
    await sb.from('sync_state').upsert(
      {
        tenant_id: tenantId,
        channel: 'shopify',
        account_id: accountId,
        last_updated_at: lastUpdated
      },
      { onConflict: 'tenant_id,channel,account_id' }
    );
  }
}

/**
 * 🔹 Ingest all connected Shopify accounts for a tenant
 */
export async function ingestShopify(tenantId: string) {
  const sb = supaSrv();

  const { data: accounts, error } = await sb
    .from('channel_accounts')
    .select('id, auth_json')
    .eq('tenant_id', tenantId)
    .eq('channel', 'shopify')
    .eq('status', 'connected');

  if (error) throw error;
  if (!accounts || accounts.length === 0) throw new Error("No Shopify accounts found");

  for (const acc of accounts) {
    console.log(`🚀 Ingesting Shopify account ${acc.id} for tenant ${tenantId}`);
    await ingestShopifyAccount(tenantId, acc.id, acc.auth_json as ShopAuth);
  }

  await sb.rpc('refresh_metrics');
}

/**
 * CLI entrypoint
 */
if (process.argv[2]) {
  ingestShopify(process.argv[2])
    .then(() => {
      console.log("✅ Ingestion completed");
      process.exit(0);
    })
    .catch(err => {
      console.error("❌ Ingestion failed", err);
      process.exit(1);
    });
}
