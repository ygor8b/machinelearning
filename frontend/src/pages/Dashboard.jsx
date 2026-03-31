import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCustomer } from "../context/CustomerContext";
import { getCustomerDashboard } from "../api";
import FraudBadge from "../components/FraudBadge";

function KpiCard({ label, value, sub }) {
  return (
    <div className="col-sm-6 col-lg-3">
      <div className="card text-center h-100">
        <div className="card-body">
          <div className="display-6 fw-bold">{value}</div>
          <div className="text-muted small">{label}</div>
          {sub && <div className="text-muted" style={{ fontSize: "0.75rem" }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { customer } = useCustomer();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customer) { navigate("/"); return; }
    getCustomerDashboard(customer.customer_id)
      .then(setData)
      .finally(() => setLoading(false));
  }, [customer]);

  if (!customer) return null;
  if (loading) return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>;
  if (!data)   return <div className="alert alert-danger">Failed to load dashboard.</div>;

  const { stats, recent_orders } = data;

  const shipmentStatus = (o) => {
    if (o.late_delivery === true || o.late_delivery === 1) return <span className="badge bg-danger">Late</span>;
    if (o.late_delivery === false || o.late_delivery === 0) return <span className="badge bg-success">On Time</span>;
    return <span className="badge bg-secondary">Pending</span>;
  };

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-0">Welcome, {customer.full_name}</h2>
          <div className="text-muted small">
            {customer.customer_segment} customer · {customer.loyalty_tier} tier
          </div>
        </div>
        <div className="d-flex gap-2">
          <Link className="btn btn-primary" to="/orders/new">Place New Order</Link>
          <Link className="btn btn-outline-secondary" to="/my-orders">Order History</Link>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <KpiCard label="Total Orders"    value={stats.total_orders} />
        <KpiCard label="Total Spent"     value={`$${Number(stats.total_spent).toFixed(2)}`} />
        <KpiCard label="Open Shipments"  value={stats.open_shipments} />
        <KpiCard label="Avg Rating Given" value={stats.avg_rating ? `${stats.avg_rating} ★` : "—"} />
      </div>

      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <strong>Recent Orders</strong>
          <Link className="btn btn-sm btn-outline-primary" to="/my-orders">View All</Link>
        </div>
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Order ID</th>
                <th>Date</th>
                <th>Total</th>
                <th>Carrier</th>
                <th>Status</th>
                <th>Fraud</th>
              </tr>
            </thead>
            <tbody>
              {recent_orders.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted py-3">No orders yet</td></tr>
              )}
              {recent_orders.map((o) => (
                <tr key={o.order_id}>
                  <td>#{o.order_id}</td>
                  <td className="text-muted small">{new Date(o.order_datetime).toLocaleDateString()}</td>
                  <td>${Number(o.order_total).toFixed(2)}</td>
                  <td>{o.carrier || "—"}</td>
                  <td>{shipmentStatus(o)}</td>
                  <td><FraudBadge isFraud={o.is_fraud} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
