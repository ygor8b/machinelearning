import { useState, useEffect } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { getAdminStats, getChartRevenue, getChartPayments, getChartCarriers } from "../../api";

function KpiCard({ label, value, color = "primary" }) {
  return (
    <div className="col-sm-6 col-xl-2">
      <div className={`card border-${color} h-100`}>
        <div className="card-body text-center">
          <div className={`display-6 fw-bold text-${color}`}>{value}</div>
          <div className="text-muted small mt-1">{label}</div>
        </div>
      </div>
    </div>
  );
}

const PIE_COLORS = ["#0d6efd", "#198754", "#ffc107", "#dc3545"];

export default function AdminDashboard() {
  const [stats,    setStats]    = useState(null);
  const [revenue,  setRevenue]  = useState([]);
  const [payments, setPayments] = useState([]);
  const [carriers, setCarriers] = useState([]);

  useEffect(() => {
    getAdminStats().then(setStats);
    getChartRevenue().then(setRevenue);
    getChartPayments().then(setPayments);
    getChartCarriers().then(setCarriers);
  }, []);

  if (!stats) return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>;

  return (
    <>
      <h2 className="mb-4">Admin Overview</h2>

      <div className="row g-3 mb-4">
        <KpiCard label="Customers"     value={stats.total_customers}                      color="primary" />
        <KpiCard label="Orders"        value={stats.total_orders}                         color="info" />
        <KpiCard label="Revenue"       value={`$${Number(stats.total_revenue).toLocaleString()}`} color="success" />
        <KpiCard label="Fraud Rate"    value={`${stats.fraud_rate}%`}                     color="danger" />
        <KpiCard label="Late Delivery" value={`${stats.late_rate}%`}                      color="warning" />
        <KpiCard label="Avg Rating"    value={`${stats.avg_rating} ★`}                    color="secondary" />
      </div>

      <div className="row g-4">
        {/* Monthly Revenue */}
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header fw-semibold">Monthly Revenue</div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={revenue}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} />
                  <Line type="monotone" dataKey="revenue" stroke="#0d6efd" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="col-lg-3">
          <div className="card h-100">
            <div className="card-header fw-semibold">Payment Methods</div>
            <div className="card-body d-flex align-items-center justify-content-center">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={payments} dataKey="count" nameKey="payment_method" cx="50%" cy="50%" outerRadius={80} label={({ payment_method, percent }) => `${payment_method} ${(percent * 100).toFixed(0)}%`}>
                    {payments.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Late Delivery by Carrier */}
        <div className="col-lg-3">
          <div className="card h-100">
            <div className="card-header fw-semibold">Late Delivery by Carrier</div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={carriers}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="carrier" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="on_time_count" name="On Time" stackId="a" fill="#198754" />
                  <Bar dataKey="late_count"    name="Late"    stackId="a" fill="#dc3545" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
