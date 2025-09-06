"use client";
import { useEffect, useState } from "react";
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

export default function DashboardPage() {
  // data states
  const [metrics, setMetrics] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

  // per-area loading flags
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Filters
  const [from, setFrom] = useState("2025-08-01");
  const [to, setTo] = useState("2025-08-31");
  const [channel, setChannel] = useState("all");

  const tenantId = "a45cc2ee-a9fc-40f8-8821-f42f93279507";

  async function fetchData() {
    // fetch metrics and orders concurrently with individual loading states
    const query = `tenant_id=${tenantId}&from=${from}&to=${to}&channel=${channel}`;

    setLoadingMetrics(true);
    setLoadingOrders(true);

    try {
      const [res1, res2] = await Promise.all([
        fetch(`/api/metrics/daily?${query}`),
        fetch(`/api/orders?${query}`),
      ]);

      if (res1.ok) {
        const data1 = await res1.json();
        setMetrics(data1.metrics || []);
      } else {
        console.error("Failed to fetch metrics", await res1.text());
        setMetrics([]);
      }

      if (res2.ok) {
        const data2 = await res2.json();
        setOrders(data2.orders || []);
      } else {
        console.error("Failed to fetch orders", await res2.text());
        setOrders([]);
      }
    } catch (err) {
      console.error("fetchData error:", err);
      setMetrics([]);
      setOrders([]);
    } finally {
      setLoadingMetrics(false);
      setLoadingOrders(false);
    }
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Small presentational component for our gif loader
  const Loader = ({ size = 36 }: { size?: number }) => (
    <div
      role="status"
      aria-busy="true"
      className="flex items-center justify-center"
      style={{ height: "36px" }}
    >
      <img
        src="/loading.gif"
        alt="loading"
        width={size}
        height={size}
        style={{ display: "block" }}
      />
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Left Sidebar (Navigation) */}
      <aside className="w-64 bg-[#0f172a] text-white min-h-screen p-6">
        <h1 className="text-xl font-bold mb-6">Analytics</h1>
        <nav className="space-y-4">
          <a href="/dashboard" className="block hover:text-gray-300">📊 Dashboard</a>
          <a href="/orders" className="block hover:text-gray-300">📦 Orders</a>
          <a href="/reports" className="block hover:text-gray-300">📑 Reports</a>
          <a href="/settings" className="block hover:text-gray-300">⚙️ Settings</a>
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
          >
            Apply
          </button>
        </div>

        {/* Top Metrics */}
        <div className="grid grid-cols-4 gap-6 mb-6">
          {/* Sales Summary */}
          <Card>
            <CardContent className="p-4">
              <h2 className="text-lg font-semibold mb-2">Sales (GST Excluded)</h2>

              {loadingMetrics ? (
                <Loader size={48} />
              ) : (
                <>
                  <p className="text-sm text-gray-500">Units: {orders.length.toLocaleString()}</p>
                  <div className="mt-2 space-y-1">
                    <p>Gross: ₹{totalSales.toLocaleString()}</p>
                    <p className="text-red-500">Returned: ₹{returnsAmount.toLocaleString()}</p>
                    <p className="font-bold">Net: ₹{(totalSales - returnsAmount).toLocaleString()}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Profit */}
          <Card>
            <CardContent className="p-4">
              <h2 className="text-lg font-semibold">Profit</h2>
              {loadingMetrics ? (
                <Loader />
              ) : (
                <p className="text-2xl font-bold text-green-600">₹{totalProfit.toLocaleString()}</p>
              )}
            </CardContent>
          </Card>

          {/* Expenses */}
          <Card>
            <CardContent className="p-4">
              <h2 className="text-lg font-semibold">Expenses</h2>
              {loadingMetrics ? (
                <Loader />
              ) : (
                <>
                  <p>Platform Fees: ₹{platformFees.toLocaleString()}</p>
                  <p>Commission: ₹{commissionFees.toLocaleString()}</p>
                  <p>Logistics: ₹{logisticsFees.toLocaleString()}</p>
                  <p>Returns: ₹{returnsAmount.toLocaleString()}</p>
                  <p className="font-bold text-red-500">Ad Spend: ₹{totalAdSpend.toLocaleString()}</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Daily Sales vs Profit */}
          <Card className="col-span-1">
            <CardContent className="p-4 h-[200px]">
              <h2 className="text-lg font-semibold mb-2">Daily Sales & Profit</h2>

              {loadingMetrics ? (
                <Loader size={48} />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics}>
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="sales_net" fill="#8884d8" name="Sales" />
                    <Bar dataKey="profit" fill="#82ca9d" name="Profit" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Orders Table with its own loader */}
        <div>
          {loadingOrders ? (
            <div className="rounded-2xl bg-white shadow p-6">
              <div className="flex items-center gap-4">
                <Loader />
                <div>
                  <div className="h-4 w-48 bg-gray-200 rounded mb-2" />
                  <div className="h-3 w-32 bg-gray-200 rounded" />
                </div>
              </div>
            </div>
          ) : (
            <OrdersTable orders={orders} />
          )}
        </div>
      </main>
    </div>
  );
}
