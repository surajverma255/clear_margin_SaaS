// app/dashboard/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import OrdersTable from "@/components/ui/OrdersTable";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  ResponsiveContainer,
} from "recharts";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";

type MetricRow = {
  day: string;
  sales_net?: number;
  net_sales?: number;
  profit?: number;
  ads_spend?: number;
  platform_fees?: number;
  commission_fees?: number;
  logistics_fees?: number;
  returns_amount?: number;
  [k: string]: any;
};

type OrderRow = {
  id?: string;
  external_order_id?: string;
  order_date?: string;
  net_sales_amount?: number | string;
  financial_status?: string;
  fulfillment_status?: string;
  channel?: string;
  state?: string | null;
  state_code?: string | null;
  pincode?: string | null;
  [k: string]: any;
};

/**
 * Expected shape for OrdersTable component.
 * Ensure we supply these fields (channel must be string).
 */
type ExpectedOrder = {
  id: string;
  external_order_id: string;
  order_date: string;
  net_sales_amount: number;
  financial_status: string;
  fulfillment_status: string;
  channel: string;
  state?: string | null;
  state_code?: string | null;
  pincode?: string | null;
  [k: string]: any;
};

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [from, setFrom] = useState(() => formatDateISO(addDays(new Date(), -30)));
  const [to, setTo] = useState(() => formatDateISO(new Date()));
  const [channel, setChannel] = useState("all");

  const tenantId = "a45cc2ee-a9fc-40f8-8821-f42f93279507"; // your tenant

  async function fetchData() {
    setLoading(true);
    try {
      const query = `tenant_id=${tenantId}&from=${from}&to=${to}&channel=${channel}`;
      const [mRes, oRes] = await Promise.all([
        fetch(`/api/metrics/daily?${query}`),
        fetch(`/api/orders?${query}`),
      ]);
      const mJson = await mRes.json();
      const oJson = await oRes.json();
      setMetrics(mJson.metrics || []);
      setOrders(oJson.orders || []);
    } catch (err) {
      console.error("fetch error", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // initial load
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Normalize orders BEFORE passing to OrdersTable to match its expected type.
  const normalizedOrders: ExpectedOrder[] = useMemo(() => {
    return (orders || []).map((o) => {
      const id = (o.id ?? o.external_order_id ?? `${Math.random()}`).toString();
      const external_order_id = (o.external_order_id ?? o.id ?? id).toString();
      const order_date = o.order_date ?? "";
      const net_sales_amount =
        typeof o.net_sales_amount === "string"
          ? Number(o.net_sales_amount || 0)
          : Number(o.net_sales_amount ?? 0);
      const financial_status = o.financial_status ?? "";
      const fulfillment_status = o.fulfillment_status ?? "";
      const ch = o.channel ?? "unknown"; // ensure channel is always a string

      return {
        id,
        external_order_id,
        order_date,
        net_sales_amount,
        financial_status,
        fulfillment_status,
        channel: ch,
        state: o.state ?? null,
        state_code: o.state_code ?? null,
        pincode: o.pincode ?? null,
        // spread any other useful fields if you want
        ...o,
      } as ExpectedOrder;
    });
  }, [orders]);

  // Aggregates
  const totalProfit = metrics.reduce((s, m) => s + (Number(m.profit) || 0), 0);
  const totalSales = metrics.reduce(
    (s, m) => s + (Number(m.sales_net) || Number(m.net_sales) || 0),
    0
  );
  const totalAdSpend = metrics.reduce((s, m) => s + (Number(m.ads_spend) || 0), 0);
  const platformFees = metrics.reduce((s, m) => s + (Number(m.platform_fees) || 0), 0);
  const commissionFees = metrics.reduce((s, m) => s + (Number(m.commission_fees) || 0), 0);
  const logisticsFees = metrics.reduce((s, m) => s + (Number(m.logistics_fees) || 0), 0);
  const returnsAmount = metrics.reduce((s, m) => s + (Number(m.returns_amount) || 0), 0);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Left Sidebar */}
      <aside className="w-64 bg-[#0f172a] text-white min-h-screen p-6 hidden md:block">
        <h1 className="text-2xl font-bold mb-6">Analytics</h1>
        <nav className="space-y-4 text-sm">
          <a href="/dashboard" className="block hover:text-gray-300">📊 Dashboard</a>
          <a href="/orders" className="block hover:text-gray-300">📦 Orders</a>
          <a href="/reports" className="block hover:text-gray-300">📑 Reports</a>
          <a href="/settings" className="block hover:text-gray-300">⚙️ Settings</a>
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 p-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center mb-6">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border p-2 rounded" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border p-2 rounded" />
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className="border p-2 rounded">
            <option value="all">All Channels</option>
            <option value="shopify">Shopify</option>
            <option value="amazon">Amazon</option>
            <option value="flipkart">Flipkart</option>
          </select>
          <button className="bg-black text-white px-4 py-2 rounded" onClick={fetchData}>Apply</button>
        </div>

        {/* Top KPI + Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
          {/* Sales */}
          <Card>
            <CardContent className="p-4 min-h-[140px]">
              <h3 className="text-lg font-medium">Sales (GST Excluded)</h3>
              <div className="mt-3">
                {loading ? <CardLoader /> : (
                  <>
                    <div className="text-sm text-gray-500">Units: {orders.length}</div>
                    <div className="mt-3 space-y-1">
                      <div>Gross: <strong>₹{formatMoney(totalSales)}</strong></div>
                      <div className="text-red-600">Returned: ₹{formatMoney(returnsAmount)}</div>
                      <div className="font-bold">Net: ₹{formatMoney(totalSales - returnsAmount)}</div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Profit */}
          <Card>
            <CardContent className="p-4 min-h-[140px]">
              <h3 className="text-lg font-medium">Profit</h3>
              <div className="mt-4">
                {loading ? <CardLoader /> : (
                  <div className="text-2xl font-bold text-green-600">₹{formatMoney(totalProfit)}</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Expenses */}
          <Card>
            <CardContent className="p-4 min-h-[140px]">
              <h3 className="text-lg font-medium">Expenses</h3>
              <div className="mt-3">
                {loading ? <CardLoader /> : (
                  <>
                    <div>Platform Fees: ₹{formatMoney(platformFees)}</div>
                    <div>Commission: ₹{formatMoney(commissionFees)}</div>
                    <div>Logistics: ₹{formatMoney(logisticsFees)}</div>
                    <div>Returns: ₹{formatMoney(returnsAmount)}</div>
                    <div className="mt-2 font-bold text-red-600">Ad Spend: ₹{formatMoney(totalAdSpend)}</div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Chart */}
          <Card>
            <CardContent className="p-4 h-[220px]">
              <h3 className="text-lg font-medium mb-2">Daily Sales & Profit</h3>
              {loading ? (
                <div className="flex items-center justify-center h-full"><CardLoader /></div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics}>
                    <XAxis dataKey="day" />
                    <YAxis />
                    <ReTooltip />
                    <Bar dataKey="sales_net" fill="#4f46e5" name="Sales" />
                    <Bar dataKey="profit" fill="#16a34a" name="Profit" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Map + Orders */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="col-span-2">
            <CardContent className="p-4">
              <h3 className="text-lg font-medium mb-4">Orders by State</h3>
              <IndiaHeatMap tenantId={tenantId} from={from} to={to} channel={channel} loading={loading} />
            </CardContent>
          </Card>

          <div className="col-span-1">
            {/* PASS normalizedOrders to OrdersTable so types line up */}
            <OrdersTable orders={normalizedOrders} />
          </div>
        </div>
      </main>
    </div>
  );
}

/* -------------------------- Utility & child components -------------------------- */

function CardLoader() {
  // small "gift-like" loader (animated SVG)
  return (
    <div className="flex items-center justify-center">
      <svg width="48" height="48" viewBox="0 0 100 100" className="animate-pulse" aria-hidden>
        <rect x="10" y="30" rx="6" ry="6" width="80" height="50" fill="#e6eefc" />
        <rect x="30" y="10" width="40" height="15" rx="4" ry="4" fill="#cfe3ff" />
        <circle cx="50" cy="55" r="6" fill="#7fb1ff" />
      </svg>
    </div>
  );
}

function formatMoney(n?: number) {
  if (!n && n !== 0) return "0";
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
function formatDateISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

/* -------------------------- IndiaHeatMap component -------------------------- */

function IndiaHeatMap({
  tenantId,
  from,
  to,
  channel,
  loading,
}: {
  tenantId: string;
  from: string;
  to: string;
  channel: string;
  loading: boolean;
}) {
  const [geoJson, setGeoJson] = useState<any | null>(null);
  const [byState, setByState] = useState<{ state: string; state_code: string; total_orders: number }[]>([]);
  const [hover, setHover] = useState<{ name: string; code?: string; total?: number; x?: number; y?: number } | null>(null);

  // Prefer local file in /public/data if possible
  // If you copied topojson to public/data/india.topo.json you can change this URL to '/data/india.topo.json'
  const GEOJSON_URL = "/data/india.topo.json";

  useEffect(() => {
    // load geojson once
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(GEOJSON_URL);
        if (!r.ok) throw new Error(`GeoJSON fetch failed ${r.status}`);
        const j = await r.json();
        if (!cancelled) setGeoJson(j);
      } catch (err) {
        console.error("geojson load error", err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    (async () => {
      try {
        const q = `tenant_id=${tenantId}&from=${from}&to=${to}&channel=${channel}`;
        const res = await fetch(`/api/metrics/by-state?${q}`);
        const json = await res.json();
        // accommodate possible shapes: { data: [...] } or { by_state: [...] } or direct array
        const arr =
          (json && Array.isArray((json as any).data) && (json as any).data) ||
          (json && Array.isArray((json as any).by_state) && (json as any).by_state) ||
          (Array.isArray(json) ? json : []);
        if (!cancelled) {
          setByState(arr.map((r: any) => ({
            state: r.state,
            state_code: r.state_code,
            total_orders: Number(r.total_orders || 0),
          })));
        }
      } catch (err) {
        console.error("bystate fetch error", err);
        if (!cancelled) setByState([]);
      }
    })();
    return () => { cancelled = true; };
  }, [tenantId, from, to, channel]);

  const maxCount = useMemo(() => {
    return byState.reduce((m, r) => Math.max(m, Number(r.total_orders || 0)), 0) || 1;
  }, [byState]);

  function getColorForCount(count: number) {
    const v = Math.max(0, Math.min(1, count / Math.max(1, maxCount)));
    // simple blue scale
    const start = [245, 247, 250];
    const end = [7, 84, 165];
    const rgb = start.map((s, i) => Math.round(s + (end[i] - s) * v));
    return `rgb(${rgb.join(",")})`;
  }

  function findCountForName(nameOrCode: string) {
    if (!nameOrCode) return 0;
    const byName = byState.find((b) => {
      if (!b) return false;
      if (!b.state && !b.state_code) return false;
      const eqName = String(b.state || "").trim().toLowerCase() === String(nameOrCode).trim().toLowerCase();
      const eqCode = String(b.state_code || "").trim().toLowerCase() === String(nameOrCode).trim().toLowerCase();
      return eqName || eqCode;
    });
    return byName ? Number(byName.total_orders || 0) : 0;
  }

  if (!geoJson) {
    return <div className="text-center py-10"><CardLoader /></div>;
  }

  return (
    <div className="relative">
      <ComposableMap projection="geoMercator" projectionConfig={{ scale: 1000, center: [80, 22] }}>
        <Geographies geography={geoJson}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const name = geo.properties?.NAME_1 || geo.properties?.name || geo.properties?.ST_NM || "";
              const code = geo.properties?.ST_CODE || geo.properties?.state_code || geo.properties?.state_code_iso || "";
              const count = findCountForName(name) || findCountForName(code) || 0;
              const fill = count ? getColorForCount(count) : "#f3f4f6";

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fill}
                  stroke="#e6e6e6"
                  strokeWidth={0.4}
                  onMouseEnter={(evt) => {
                    const x = (evt as any).clientX;
                    const y = (evt as any).clientY;
                    setHover({ name: name || code || "Unknown", code, total: count, x, y });
                  }}
                  onMouseMove={(evt) => {
                    const x = (evt as any).clientX;
                    const y = (evt as any).clientY;
                    setHover((h) => (h ? { ...h, x, y } : h));
                  }}
                  onMouseLeave={() => setHover(null)}
                  style={{
                    default: { outline: "none" },
                    hover: { outline: "none", opacity: 0.9 },
                    pressed: { outline: "none" },
                  }}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>

      {/* tooltip */}
      {hover && (
        <div
          style={{
            position: "fixed",
            left: hover.x ? hover.x + 12 : 0,
            top: hover.y ? hover.y + 12 : 0,
            background: "white",
            border: "1px solid #e5e7eb",
            padding: 10,
            boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
            borderRadius: 8,
            zIndex: 9999,
            minWidth: 160,
          }}
        >
          <div className="font-semibold">{hover.name}</div>
          <div className="text-sm text-gray-600">Orders: <strong>{hover.total}</strong></div>
        </div>
      )}
    </div>
  );
}
