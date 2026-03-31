import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCustomer } from "../context/CustomerContext";
import { getPortalCustomers } from "../api";

export default function SelectCustomer() {
  const { select } = useCustomer();
  const navigate = useNavigate();
  const [search, setSearch]     = useState("");
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    setLoading(true);
    getPortalCustomers(search)
      .then(setCustomers)
      .finally(() => setLoading(false));
  }, [search]);

  const handleSelect = (c) => {
    select(c);
    navigate("/dashboard");
  };

  const segmentColor = { budget: "secondary", standard: "primary", premium: "warning" };
  const tierColor    = { none: "light text-dark", silver: "secondary", gold: "warning text-dark" };

  return (
    <div className="row justify-content-center">
      <div className="col-lg-8">
        <h2 className="mb-1">Select Customer</h2>
        <p className="text-muted mb-4">Choose a customer to view their portal</p>

        <input
          type="search"
          className="form-control mb-3"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" />
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead className="table-dark">
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Segment</th>
                  <th>Tier</th>
                  <th>Location</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-4">
                      No customers found
                    </td>
                  </tr>
                )}
                {customers.map((c) => (
                  <tr key={c.customer_id}>
                    <td className="fw-semibold">{c.full_name}</td>
                    <td className="text-muted small">{c.email}</td>
                    <td>
                      <span className={`badge bg-${segmentColor[c.customer_segment] || "secondary"}`}>
                        {c.customer_segment}
                      </span>
                    </td>
                    <td>
                      <span className={`badge bg-${(tierColor[c.loyalty_tier] || "secondary")}`}>
                        {c.loyalty_tier}
                      </span>
                    </td>
                    <td className="text-muted small">
                      {c.city}, {c.state}
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleSelect(c)}
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
