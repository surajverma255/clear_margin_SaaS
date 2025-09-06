"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup
} from "react-simple-maps";
import { scaleLinear } from "d3-scale";
import { interpolateGreens } from "d3-scale-chromatic";
// Tooltip path — change if your project's tooltip lives elsewhere.
// If you don't have a Tooltip component, see fallback note below.
import { Tooltip } from "@/components/ui/Tooltip";

type BystateResponse = {
  data: Array<{
    state: string;
    state_code?: string;
    total_orders: number;
  }>;
};

export default function IndiaHeatMap({
  tenantId,
  from,
  to,
  channel
}: {
  tenantId: string;
  from?: string;
  to?: string;
  channel?: string;
}) {
  const [geoJson, setGeoJson] = useState<any | null>(null);
  const [rows, setRows] = useState<Array<{ state: string; state_code?: string; total_orders: number }>>([]);
  const [hover, setHover] = useState<{ name: string; count: number } | null>(null);
  const [loading, setLoading] = useState(true);

  // small canonicalization map to fix common naming mismatches
  const canonical: Record<string, string> = {
    "andaman & nicobar": "Andaman and Nicobar",
    "andaman and nicobar islands": "Andaman and Nicobar",
    "odisha": "Odisha",
    "tamil nadu": "Tamil Nadu",
    // add more if you see mismatches
  };

  function normalizeStateName(s?: string) {
    if (!s) return "";
    const key = s.trim().toLowerCase();
    if (canonical[key]) return canonical[key];
    // Title-case fallback
    return key
      .split(" ")
      .map(w => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
      .join(" ");
  }

  // 1) load topojson/geojson from public/data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/data/india.topo.json");
        if (!res.ok) throw new Error(`geojson fetch failed ${res.status}`);
        const j = await res.json();
        if (!cancelled) setGeoJson(j);
      } catch (err) {
        console.error("Failed to load topojson:", err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 2) fetch by-state metrics from your API and read `.data`
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const q = new URLSearchParams();
    if (tenantId) q.set("tenant_id", tenantId);
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    if (channel) q.set("channel", channel || "all");

    (async () => {
      try {
        const res = await fetch(`/api/metrics/by-state?${q.toString()}`);
        const json: BystateResponse = await res.json();
        const payload = Array.isArray((json as any).data) ? (json as any).data : (json as any);
        if (!cancelled) setRows(payload.map((r: any) => ({ state: r.state, state_code: r.state_code, total_orders: Number(r.total_orders || 0) })));
      } catch (err) {
        console.error("Failed to fetch by-state metrics", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [tenantId, from, to, channel]);

  // lookup map: canonical state name -> count
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const key = normalizeStateName(r.state);
      m.set(key, (m.get(key) || 0) + (r.total_orders || 0));
    }
    return m;
  }, [rows]);

  const maxCount = useMemo(() => {
    let mx = 0;
    counts.forEach(v => { if (v > mx) mx = v; });
    return mx;
  }, [counts]);

  const colorScale = useMemo(() => {
    if (maxCount <= 0) {
      // no data -> light fill
      return (_: number) => "#f5f7fa";
    }
    const s = scaleLinear<number>().domain([0, maxCount]).range([0.2, 1]);
    return (val: number) => interpolateGreens(s(Math.max(0, val)));
  }, [maxCount]);

  // Some topojsons put features in geoJson.features — adapt accordingly
  const featureArray: any[] = geoJson && (geoJson.features ? geoJson.features : (geoJson.objects && geoJson.objects.states ? geoJson.objects.states.geometries : []));

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Orders by State</h3>
        {loading && <div className="text-sm text-gray-500">Loading map…</div>}
      </div>

      {geoJson ? (
        <div>
          <ComposableMap projection="geoMercator" projectionConfig={{ scale: 1000 }} width={980} height={600}>
            <ZoomableGroup center={[80, 22]} zoom={1}>
              <Geographies geography={geoJson as any}>
                {({ geographies }) =>
                  geographies.map(geo => {
                    const props = geo.properties || {};
                    // adapt property key to your topojson — many files use NAME_1 for Indian states
                    const rawName = props.NAME_1 || props.name || props.NAME || props.STATE || "";
                    const name = normalizeStateName(rawName);
                    const count = counts.get(name) || 0;
                    const fill = count > 0 ? colorScale(count) : "#f5f7fa";

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={fill}
                        stroke="#e6e6e6"
                        strokeWidth={0.4}
                        onMouseEnter={() => setHover({ name: name, count })}
                        onMouseLeave={() => setHover(null)}
                        style={{
                          default: { outline: "none" },
                          hover: { outline: "none", opacity: 0.9, cursor: "pointer" },
                          pressed: { outline: "none" }
                        }}
                      />
                    );
                  })
                }
              </Geographies>
            </ZoomableGroup>
          </ComposableMap>

          {/* Tooltip — simple inline tooltip wrapper */}
          {hover && (
            <div className="mt-2">
              {/* If you have a Tooltip component, use that instead */}
              <div className="inline-block bg-white shadow rounded p-2 text-sm">
                <div className="font-medium">{hover.name || "Unknown"}</div>
                <div>Orders: {hover.count}</div>
              </div>
            </div>
          )}

          {/* legend */}
          <div className="mt-3 flex items-center gap-3 text-sm">
            <span>Low</span>
            <div className="flex gap-1">
              {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
                const c = interpolateGreens(t);
                return <div key={i} style={{ width: 28, height: 14, background: c, borderRadius: 2 }} />;
              })}
            </div>
            <span>High ({maxCount})</span>
          </div>
        </div>
      ) : (
        <div className="text-sm text-muted">Map data not available</div>
      )}
    </div>
  );
}
