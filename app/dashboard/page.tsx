"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import OrdersTable from "@/components/ui/OrdersTable";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function fmt(n: number) {
  return n.toLocaleString();
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // 🔹 Filters
  const [from, setFrom] = useState("2025-08-01");
  const [to, setTo] = useState("2025-08-31");
  const [channel, setChannel] = useState("all");

  // TODO: replace with dynamic tenant id when implementing auth / multi-tenant flow
  const tenantId = "a45cc2ee-a9fc-40f8-8821-f42f93279507";

  async function fetchData() {
    try {
      setLoading(true);
      const query = `tenant_id=${tenantId}&from=${from}&to=${to}&channel=${channel}`;

      // RPC-backed API (Option 1)
      const res1 = await fetch(`/api/metrics/daily?${query}`);
      const data1 = await res1.json();
      setMetrics(Array.isArray(data1.metrics) ? data1.metrics : []);

      const res2 = await fetch(`/api/orders?${query}`);
      const data2 = await res2.json();
      setOrders(Array.isArray(data2.orders) ? data2.orders : []);
    } catch (err) {
      console.error("fetchData error", err);
      // optionally show toast / error state
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Normalize metrics so UI doesn't care about field naming differences
  const transformedMetrics = useMemo(() => {
    return metrics.map((m) => {
      const sales_net = Number(m.sales_net ?? m.net_sales ?? 0);
      const profit = Number(m.profit ?? 0);
      const ads_spend = Number(m.ads_spend ?? 0);
      const platform_fees = Number(m.platform_fees ?? 0);
      const commission_fees = Number(m.commission_fees ?? m.commission_fee ?? 0);
      const logistics_fees = Number(m.logistics_fees ?? 0);
      const returns_amount = Number(m.returns_amount ?? m.returns_amount ?? 0);
      const day = m.day ?? m.date ?? null;
      const channel = m.channel ?? "unknown";

      return {
        ...m,
        day,
        channel,
        sales_net,
        profit,
        ads_spend,
        platform_fees,
        commission_fees,
        logistics_fees,
        returns_amount,
      };
    });
  }, [metrics]);

  // Aggregates (computed from transformed metrics)
  const totalProfit = useMemo(
    () => transformedMetrics.reduce((s, m) => s + (Number(m.profit) || 0), 0),
    [transformedMetrics]
  );
  const totalSales = useMemo(
    () => transformedMetrics.reduce((s, m) => s + (Number(m.sales_net) || 0), 0),
    [transformedMetrics]
  );
  const totalAdSpend = useMemo(
    () => transformedMetrics.reduce((s, m) => s + (Number(m.ads_spend) || 0), 0),
    [transformedMetrics]
  );
  const platformFees = useMemo(
    () => transformedMetrics.reduce((s, m) => s + (Number(m.platform_fees) || 0), 0),
    [transformedMetrics]
  );
  const commissionFees = useMemo(
    () => transformedMetrics.reduce((s, m) => s + (Number(m.commission_fees) || 0), 0),
    [transformedMetrics]
  );
  const logisticsFees = useMemo(
    () => transformedMetrics.reduce((s, m) => s + (Number(m.logistics_fees) || 0), 0),
    [transformedMetrics]
  );
  const returnsAmount = useMemo(
    () => transformedMetrics.reduce((s, m) => s + (Number(m.returns_amount) || 0), 0),
    [transformedMetrics]
  );

  // UI helpers
  const isEmpty = !loading && transformedMetrics.length === 0;

  return (
    <div className="flex min-h-screen">
      {/* Left Sidebar (Navigation) */}
      <aside className="w-60 bg-[#0f172a] text-white min-h-screen p-6">
        <h1 className="text-xl font-bold mb-6">Analytics</h1>
        <nav className="space-y-4 text-sm">
          <a href="/dashboard" className="block hover:text-gray-300">
            📊 Dashboard
          </a>
          <a href="/orders" className="block hover:text-gray-300">
            📦 Orders
          </a>
          <a href="/reports" className="block hover:text-gray-300">
            📑 Reports
          </a>
          <a href="/settings" className="block hover:text-gray-300">
            ⚙️ Settings
          </a>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 bg-gray-50">
        {/* Filter Controls */}
        <div className="flex gap-4 items-center mb-6">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border p-2 rounded"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border p-2 rounded"
          />
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="border p-2 rounded"
          >
            <option value="all">All Channels</option>
            <option value="shopify">Shopify</option>
            <option value="amazon">Amazon</option>
            <option value="flipkart">Flipkart</option>
          </select>
          <button
            className="bg-black text-white px-4 py-2 rounded"
            onClick={fetchData}
            disabled={loading}
          >
            {loading ? "Loading..." : "Apply"}
          </button>
        </div>

        {/* Top Metrics */}
        <div className="grid grid-cols-4 gap-6 mb-6">
          {/* Sales Summary */}
          <Card>
            <CardContent className="p-4 min-h-[140px]">
              <h2 className="text-lg font-semibold mb-2">Sales (GST Excluded)</h2>

              {loading ? (
                <p className="text-sm text-gray-500">Loading sales...</p>
              ) : isEmpty ? (
                <p className="text-sm text-gray-500">No data for selected range</p>
              ) : (
                <>
                  <p className="text-sm text-gray-500">
                    Units: {orders.length.toLocaleString()}
                  </p>
                  <div className="mt-2 space-y-1">
                    <p>Gross: ₹{fmt(totalSales)}</p>
                    <p className="text-red-500">Returned: ₹{fmt(returnsAmount)}</p>
                    <p className="font-bold">Net: ₹{fmt(totalSales - returnsAmount)}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Profit */}
          <Card>
            <CardContent className="p-4 min-h-[140px]">
              <h2 className="text-lg font-semibold">Profit</h2>
              {loading ? (
                <p className="text-sm text-gray-500">Calculating...</p>
              ) : (
                <p className="text-2xl font-bold text-green-600">₹{fmt(totalProfit)}</p>
              )}
            </CardContent>
          </Card>

          {/* Expenses */}
          <Card>
            <CardContent className="p-4 min-h-[140px]">
              <h2 className="text-lg font-semibold">Expenses</h2>
              {loading ? (
                <p className="text-sm text-gray-500">Loading expenses...</p>
              ) : (
                <>
                  <p>Platform Fees: ₹{fmt(platformFees)}</p>
                  <p>Commission: ₹{fmt(commissionFees)}</p>
                  <p>Logistics: ₹{fmt(logisticsFees)}</p>
                  <p>Returns: ₹{fmt(returnsAmount)}</p>
                  <p className="font-bold text-red-500">Ad Spend: ₹{fmt(totalAdSpend)}</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Daily Sales vs Profit */}
          <Card className="col-span-1">
            <CardContent className="p-4 h-[200px]">
              <h2 className="text-lg font-semibold mb-2">Daily Sales & Profit</h2>

              {loading ? (
                <p className="text-sm text-gray-500">Loading chart...</p>
              ) : isEmpty ? (
                <p className="text-sm text-gray-500">No metrics to chart</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={transformedMetrics}>
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip formatter={(v: any) => (typeof v === "number" ? `₹${fmt(Number(v))}` : v)} />
                    <Bar dataKey="sales_net" fill="#8884d8" name="Sales" />
                    <Bar dataKey="profit" fill="#82ca9d" name="Profit" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Orders Table */}
        <div>
          <OrdersTable orders={orders} />
        </div>
      </main>
    </div>
  );
}
