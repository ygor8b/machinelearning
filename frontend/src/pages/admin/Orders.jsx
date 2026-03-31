import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getAdminOrders } from "../../api";
import Pagination from "../../components/Pagination";
import FraudBadge from "../../components/FraudBadge";

export default function Orders() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ fraud: "", payment: "", device: "", page: 1 });

  useEffect(() => {
    setLoading(true);
    getAdminOrders(filters).then(setData).finally(() => setLoading(false));
  }, [filters]);

  const set = (key, val) => setFilters((f) => ({ ...f, [key]: val, page: 1 }));

  return (
    <>
      <h2 className="mb-3">Orders</h2>

      <div className="row g-2 mb-3">
        <div className="col-md-2">
          <select className="form-select" value={filters.fraud} onChange={(e) => set("fraud", e.target.value)}>
            <option value="">All orders</option>
            <option value="1">Fraud only</option>
            <option value="0">Clean only</option>
          </select>
        </div>
        <div className="col-md-2">
          <select className="form-select" value={filters.payment} onChange={(e) => set("payment", e.target.value)}>
            <option value="">All payments</option>
            {["card","paypal","bank","crypto"].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="col-md-2">
          <select className="form-select" value={filters.device} onChange={(e) => set("device", e.target.value)}>
            <option value="">All devices</option>
            {["mobile","desktop","tablet"].map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead className="table-dark">
                <tr>
                  <th>Order ID</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Payment</th>
                  <th>Device</th>
                  <th>Total</th>
                  <th>Risk Score</th>
                  <th>Fraud</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-muted py-4">No orders found</td></tr>
                )}
                {data?.items.map((o) => (
                  <tr key={o.order_id} className={o.is_fraud ? "table-danger" : ""}>
                    <td>
                      <Link to={`/admin/orders/${o.order_id}`} className="text-decoration-none fw-semibold">
                        #{o.order_id}
                      </Link>
                    </td>
                    <td className="text-muted small">{new Date(o.order_datetime).toLocaleDateString()}</td>
                    <td>
                      {o.full_name ? (
                        <Link to={`/admin/customers/${o.customer_id}`} className="text-decoration-none">
                          {o.full_name}
                        </Link>
                      ) : "—"}
                    </td>
                    <td className="text-capitalize">{o.payment_method}</td>
                    <td className="text-capitalize">{o.device_type}</td>
                    <td>${Number(o.order_total).toFixed(2)}</td>
                    <td>
                      <span className={`badge ${o.risk_score >= 70 ? "bg-danger" : o.risk_score >= 40 ? "bg-warning text-dark" : "bg-success"}`}>
                        {Number(o.risk_score).toFixed(0)}
                      </span>
                    </td>
                    <td><FraudBadge isFraud={o.is_fraud} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="d-flex justify-content-between align-items-center mt-2">
            <small className="text-muted">{data?.total} orders</small>
            <Pagination
              page={data?.page || 1}
              totalPages={data?.total_pages || 1}
              onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))}
            />
          </div>
        </>
      )}
    </>
  );
}
