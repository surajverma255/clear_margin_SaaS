"use client";
import { useReactTable, getCoreRowModel, flexRender, createColumnHelper } from "@tanstack/react-table";
import { Card, CardContent } from "@/components/ui/card";

type Order = {
  id: string;
  external_order_id: string;
  order_date: string;
  net_sales_amount: number;
  financial_status: string;
  fulfillment_status: string;
};

interface OrdersTableProps {
  orders: Order[];
}

export default function OrdersTable({ orders }: OrdersTableProps) {
  const columnHelper = createColumnHelper<Order>();
  const columns = [
    columnHelper.accessor("external_order_id", { header: "Order ID" }),
    columnHelper.accessor("order_date", { 
      header: "Date",
      cell: info => new Date(info.getValue()).toLocaleString()  // 👈 Proper formatted date
    }),
    columnHelper.accessor("net_sales_amount", {
      header: "Amount",
      cell: info => `₹${info.getValue().toLocaleString()}`
    }),
    columnHelper.accessor("financial_status", { header: "Payment" }),
    columnHelper.accessor("fulfillment_status", { 
      header: "Fulfillment",
      cell: info => info.getValue() || "-"   // 👈 null/empty handle
    }),
  ];

  const table = useReactTable({
    data: orders,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Card className="mt-6 shadow-xl">
      <CardContent className="p-4">
        <h2 className="text-lg font-semibold mb-4">Recent Orders</h2>
        <table className="w-full border rounded-md overflow-hidden">
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id} className="bg-gray-100">
                {hg.headers.map(header => (
                  <th key={header.id} className="p-2 text-left border-b">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map(row => (
                <tr key={row.id} className="border-b hover:bg-gray-50">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="p-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="p-4 text-center text-gray-500">
                  No orders found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
