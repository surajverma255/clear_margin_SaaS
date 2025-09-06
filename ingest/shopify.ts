/* eslint-disable no-console */
import 'dotenv/config';
import { supaSrv } from '../lib/supabase';

type ShopAuth = {
  store_domain: string;
  api_version: string;
  access_token: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function nextFrom(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const match = linkHeader.match(/<([^>]+)>; rel="next"/);
  return match ? match[1] : null;
}

function buildUrl(auth: ShopAuth, since?: string, pageUrl?: string) {
  if (pageUrl) return new URL(pageUrl);
  const url = new URL(`https://${auth.store_domain}/admin/api/${auth.api_version}/orders.json`);
  url.searchParams.set('status', 'any');
  url.searchParams.set('limit', '250');
  if (since) url.searchParams.set('updated_at_min', since);
  return url;
}

/**
 * Simple normalization for state names/codes.
 * Extend STATE_MAP with more aliases as you see in real data.
 */
const STATE_MAP: Record<string, { name: string; code?: string }> = {
  // lowercase keys and common codes/aliases
  'karnataka': { name: 'Karnataka', code: 'KA' },
  'ka': { name: 'Karnataka', code: 'KA' },

  'maharashtra': { name: 'Maharashtra', code: 'MH' },
  'mh': { name: 'Maharashtra', code: 'MH' },

  'delhi': { name: 'Delhi', code: 'DL' },
  'nct': { name: 'Delhi', code: 'DL' },

  'tamil nadu': { name: 'Tamil Nadu', code: 'TN' },
  'tn': { name: 'Tamil Nadu', code: 'TN' },

  'gujarat': { name: 'Gujarat', code: 'GJ' },
  'gj': { name: 'Gujarat', code: 'GJ' },

  'west bengal': { name: 'West Bengal', code: 'WB' },
  'wb': { name: 'West Bengal', code: 'WB' },

  'andhra pradesh': { name: 'Andhra Pradesh', code: 'AP' },
  'ap': { name: 'Andhra Pradesh', code: 'AP' },

  'kerala': { name: 'Kerala', code: 'KL' },
  'kl': { name: 'Kerala', code: 'KL' },

  'rajasthan': { name: 'Rajasthan', code: 'RJ' },
  'rj': { name: 'Rajasthan', code: 'RJ' },

  'punjab': { name: 'Punjab', code: 'PB' },
  'pb': { name: 'Punjab', code: 'PB' },

  // add more as needed...
};

/** normalize raw state string/code -> {state, state_code} */
function normalizeState(rawState?: string | null, rawCode?: string | null, pincode?: string | null) {
  // prefer explicit code if present
  if (rawCode) {
    const key = String(rawCode).trim().toLowerCase();
    if (STATE_MAP[key]) return { state: STATE_MAP[key].name, state_code: STATE_MAP[key].code };
  }

  if (!rawState) {
    // optional: fallback using pincode prefix map if implemented later
    return { state: null, state_code: null };
  }

  const s = String(rawState).trim();
  const key = s.toLowerCase();

  if (STATE_MAP[key]) return { state: STATE_MAP[key].name, state_code: STATE_MAP[key].code ?? null };

  // Title-case fallback and return raw code if available
  const title = s
    .split(/\s+/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');

  const code = rawCode ? String(rawCode).trim().toUpperCase() : null;
  return { state: title || null, state_code: code };
}

/**
 * fetch single order detail only when list entry lacks address
 * includes simple retry/backoff for 429/500
 */
async function fetchOrderDetail(auth: ShopAuth, orderId: string, maxRetries = 3) {
  const url = `https://${auth.store_domain}/admin/api/${auth.api_version}/orders/${orderId}.json`;

  let attempt = 0;
  let backoff = 200; // ms

  while (attempt <= maxRetries) {
    try {
      const res = await fetch(url, {
        headers: { 'X-Shopify-Access-Token': auth.access_token, Accept: 'application/json' },
      });
      if (res.ok) {
        const body = await res.json();
        return body.order ?? null;
      }

      // handle rate-limiting and server errors with backoff
      if (res.status === 429 || res.status >= 500) {
        attempt += 1;
        const retryAfter = res.headers.get('Retry-After');
        const delay = retryAfter ? Number(retryAfter) * 1000 : backoff;
        console.warn(`Shopify detail fetch ${orderId} returned ${res.status}, retry #${attempt} after ${delay}ms`);
        await sleep(delay);
        backoff *= 2;
        continue;
      }

      // other non-OK: log and return null (do not throw to avoid aborting whole ingest)
      console.warn(`Shopify detail fetch failed for ${orderId}: ${res.status}`);
      return null;
    } catch (err) {
      attempt += 1;
      console.warn(`Shopify detail fetch error for ${orderId}, attempt ${attempt}:`, err);
      await sleep(backoff);
      backoff *= 2;
    }
  }

  console.warn(`Shopify detail fetch failed after ${maxRetries} retries for ${orderId}`);
  return null;
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

/**
 * Upsert order into `orders` table.
 * We now extract shipping/billing address and save state/state_code/pincode.
 */
async function upsertOrder(tenantId: string, order: any, accountId: string) {
  const sb = supaSrv();

  // Shopify provides shipping_address or billing_address
  const addr = order.shipping_address || order.billing_address || null;

  // Try different address fields for pincode
  const pincode =
    addr?.zip ||
    addr?.postal_code ||
    addr?.postcode ||
    addr?.zip_code ||
    addr?.pincode ||
    null;

  const rawState = addr?.province || addr?.state || addr?.region || null;
  const rawCode = addr?.province_code || addr?.state_code || null;

  const { state, state_code } = normalizeState(rawState, rawCode, pincode);

  const o: any = {
    tenant_id: tenantId,
    channel: 'shopify',
    account_id: accountId,
    external_order_id: order.id ? String(order.id) : order.name ?? null,
    order_date: order.created_at ?? null,
    currency: order.currency ?? order.currency_code ?? null,
    financial_status: order.financial_status ?? null,
    fulfillment_status: order.fulfillment_status ?? null,
    gross_amount:
      order.total_price != null ? Number(order.total_price) : order.total_price_set?.shop_money?.amount ? Number(order.total_price_set.shop_money.amount) : null,
    discount_amount:
      order.total_discounts != null ? Number(order.total_discounts) : order.total_discount != null ? Number(order.total_discount) : 0,
    net_sales_amount:
      order.current_total_price?.amount != null
        ? Number(order.current_total_price.amount)
        : order.current_total_price != null
        ? Number(order.current_total_price)
        : order.total_price != null
        ? Number(order.total_price) - Number(order.total_discounts || 0)
        : null,
    created_at: order.created_at ?? null,

    // newly added fields
    state: state,
    state_code: state_code,
    pincode: pincode ?? null,
  };

  // upsert with same conflict key as rest of the code expects
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
      headers: { 'X-Shopify-Access-Token': auth.access_token },
    });
    if (!res.ok) throw new Error(`Shopify ${res.status}`);

    const body = await res.json();
    const orders = body.orders || [];

    for (const o of orders) {
      // If address exists in list response, use it directly.
      // Otherwise fetch the full order detail and use that.
      const addr = o.shipping_address || o.billing_address || null;
      let orderToUpsert = o;

      if (!addr) {
        const detail = await fetchOrderDetail(auth, String(o.id));
        if (detail) {
          orderToUpsert = detail;
        } else {
          // if detail fetch failed, proceed with list object (state/pincode may be null)
          orderToUpsert = o;
        }
        // throttle a bit after a detail fetch to be safe with rate limits
        await sleep(150);
      }

      await upsertOrder(tenantId, orderToUpsert, accountId);
      lastUpdated = orderToUpsert.updated_at ?? lastUpdated;
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
        last_updated_at: lastUpdated,
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
  if (!accounts || accounts.length === 0) throw new Error('No Shopify accounts found');

  for (const acc of accounts) {
    console.log(`🚀 Ingesting Shopify account ${acc.id} for tenant ${tenantId}`);
    await ingestShopifyAccount(tenantId, acc.id, acc.auth_json as ShopAuth);
  }

  // refresh materialized view (existing behavior)
  await sb.rpc('refresh_metrics');
}

/**
 * CLI entrypoint
 */
if (process.argv[2]) {
  ingestShopify(process.argv[2])
    .then(() => {
      console.log('✅ Ingestion completed');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Ingestion failed', err);
      process.exit(1);
    });
}
