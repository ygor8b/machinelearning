import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getAdminCustomers } from "../../api";
import Pagination from "../../components/Pagination";

export default function Customers() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: "", segment: "", tier: "", active: "", page: 1 });

  useEffect(() => {
    setLoading(true);
    getAdminCustomers(filters).then(setData).finally(() => setLoading(false));
  }, [filters]);

  const set = (key, val) => setFilters((f) => ({ ...f, [key]: val, page: 1 }));

  const segmentBadge = { budget: "secondary", standard: "primary", premium: "warning" };
  const tierBadge    = { none: "light text-dark border", silver: "secondary", gold: "warning text-dark" };

  return (
    <>
      <h2 className="mb-3">Customers</h2>

      {/* Filters */}
      <div className="row g-2 mb-3">
        <div className="col-md-4">
          <input
            className="form-control"
            placeholder="Search name or email…"
            value={filters.q}
            onChange={(e) => set("q", e.target.value)}
          />
        </div>
        <div className="col-md-2">
          <select className="form-select" value={filters.segment} onChange={(e) => set("segment", e.target.value)}>
            <option value="">All segments</option>
            <option value="budget">Budget</option>
            <option value="standard">Standard</option>
            <option value="premium">Premium</option>
          </select>
        </div>
        <div className="col-md-2">
          <select className="form-select" value={filters.tier} onChange={(e) => set("tier", e.target.value)}>
            <option value="">All tiers</option>
            <option value="none">None</option>
            <option value="silver">Silver</option>
            <option value="gold">Gold</option>
          </select>
        </div>
        <div className="col-md-2">
          <select className="form-select" value={filters.active} onChange={(e) => set("active", e.target.value)}>
            <option value="">All status</option>
            <option value="1">Active</option>
            <option value="0">Inactive</option>
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
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Segment</th>
                  <th>Tier</th>
                  <th>Status</th>
                  <th>Orders</th>
                  <th>Lifetime Value</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-muted py-4">No customers found</td></tr>
                )}
                {data?.items.map((c) => (
                  <tr key={c.customer_id}>
                    <td className="text-muted small">{c.customer_id}</td>
                    <td>
                      <Link to={`/admin/customers/${c.customer_id}`} className="fw-semibold text-decoration-none">
                        {c.full_name}
                      </Link>
                    </td>
                    <td className="text-muted small">{c.email}</td>
                    <td>
                      <span className={`badge bg-${segmentBadge[c.customer_segment] || "secondary"}`}>
                        {c.customer_segment}
                      </span>
                    </td>
                    <td>
                      <span className={`badge bg-${tierBadge[c.loyalty_tier] || "secondary"}`}>
                        {c.loyalty_tier}
                      </span>
                    </td>
                    <td>
                      {c.is_active
                        ? <span className="badge bg-success">Active</span>
                        : <span className="badge bg-secondary">Inactive</span>}
                    </td>
                    <td>{c.order_count}</td>
                    <td>${Number(c.lifetime_value).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="d-flex justify-content-between align-items-center mt-2">
            <small className="text-muted">{data?.total} customers</small>
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
