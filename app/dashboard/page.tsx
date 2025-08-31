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
  const [metrics, setMetrics] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

  // 🔹 Filters
  const [from, setFrom] = useState("2025-08-01");
  const [to, setTo] = useState("2025-08-31");
  const [channel, setChannel] = useState("all");

  const tenantId = "a45cc2ee-a9fc-40f8-8821-f42f93279507";

  async function fetchData() {
    const query = `tenant_id=${tenantId}&from=${from}&to=${to}&channel=${channel}`;

    const res1 = await fetch(`/api/metrics/daily?${query}`);
    const data1 = await res1.json();
    setMetrics(data1.metrics || []);

    const res2 = await fetch(`/api/orders?${query}`);
    const data2 = await res2.json();
    setOrders(data2.orders || []);
  }

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="p-6 grid gap-6">
      {/* Filter Controls */}
      <div className="flex gap-4 items-center">
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

      {/* Stats + Chart */}
      <div className="grid grid-cols-4 gap-6">
        {/* Profit */}
        <Card>
          <CardContent className="p-4">
            <h2 className="text-lg font-semibold">Profit</h2>
            <p className="text-2xl font-bold text-green-600">
              ₹
              {metrics
                .reduce((sum, m) => sum + (Number(m.profit) || 0), 0)
                .toLocaleString()}
            </p>
          </CardContent>
        </Card>

        {/* Ad Spend */}
        <Card>
          <CardContent className="p-4">
            <h2 className="text-lg font-semibold">Ad Spend</h2>
            <p className="text-2xl font-bold text-red-500">
              ₹
              {metrics
                .reduce((sum, m) => sum + (Number(m.ads_spend) || 0), 0)
                .toLocaleString()}
            </p>
          </CardContent>
        </Card>

        {/* Sales vs Profit */}
        <Card className="col-span-2">
          <CardContent className="p-4 h-[300px]">
            <h2 className="text-lg font-semibold mb-2">Daily Sales & Profit</h2>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics}>
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="net_sales" fill="#8884d8" name="Sales" />
                <Bar dataKey="profit" fill="#82ca9d" name="Profit" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Orders Table */}
      <OrdersTable orders={orders} />
    </div>
  );
}
