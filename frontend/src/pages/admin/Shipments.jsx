import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getAdminShipments } from "../../api";
import Pagination from "../../components/Pagination";

export default function Shipments() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ carrier: "", method: "", late: "", distance: "", page: 1 });

  useEffect(() => {
    setLoading(true);
    getAdminShipments(filters).then(setData).finally(() => setLoading(false));
  }, [filters]);

  const set = (key, val) => setFilters((f) => ({ ...f, [key]: val, page: 1 }));

  return (
    <>
      <h2 className="mb-3">Shipments</h2>

      <div className="row g-2 mb-3">
        <div className="col-md-2">
          <select className="form-select" value={filters.carrier} onChange={(e) => set("carrier", e.target.value)}>
            <option value="">All carriers</option>
            {["FedEx","UPS","USPS"].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="col-md-2">
          <select className="form-select" value={filters.method} onChange={(e) => set("method", e.target.value)}>
            <option value="">All methods</option>
            {["standard","expedited","overnight"].map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="col-md-2">
          <select className="form-select" value={filters.late} onChange={(e) => set("late", e.target.value)}>
            <option value="">All deliveries</option>
            <option value="1">Late only</option>
            <option value="0">On time only</option>
          </select>
        </div>
        <div className="col-md-2">
          <select className="form-select" value={filters.distance} onChange={(e) => set("distance", e.target.value)}>
            <option value="">All distances</option>
            {["local","regional","national"].map((d) => <option key={d} value={d}>{d}</option>)}
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
                  <th>Ship ID</th>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Ship Date</th>
                  <th>Carrier</th>
                  <th>Method</th>
                  <th>Distance</th>
                  <th>Promised</th>
                  <th>Actual</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.length === 0 && (
                  <tr><td colSpan={10} className="text-center text-muted py-4">No shipments found</td></tr>
                )}
                {data?.items.map((s) => (
                  <tr key={s.shipment_id} className={s.late_delivery ? "table-warning" : ""}>
                    <td className="text-muted small">{s.shipment_id}</td>
                    <td>
                      <Link to={`/admin/orders/${s.order_id}`} className="text-decoration-none">
                        #{s.order_id}
                      </Link>
                    </td>
                    <td>
                      <Link to={`/admin/customers/${s.customer_id}`} className="text-decoration-none">
                        {s.full_name}
                      </Link>
                    </td>
                    <td className="text-muted small">{new Date(s.ship_datetime).toLocaleDateString()}</td>
                    <td>{s.carrier}</td>
                    <td className="text-capitalize">{s.shipping_method}</td>
                    <td className="text-capitalize">{s.distance_band}</td>
                    <td>{s.promised_days}d</td>
                    <td>{s.actual_days != null ? `${s.actual_days}d` : "—"}</td>
                    <td>
                      {s.late_delivery
                        ? <span className="badge bg-danger">Late</span>
                        : <span className="badge bg-success">On Time</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="d-flex justify-content-between align-items-center mt-2">
            <small className="text-muted">{data?.total} shipments</small>
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
