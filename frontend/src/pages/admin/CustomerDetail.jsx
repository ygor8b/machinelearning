import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getAdminCustomer } from "../../api";
import FraudBadge from "../../components/FraudBadge";
import StarRating from "../../components/StarRating";

export default function CustomerDetail() {
  const { id } = useParams();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminCustomer(id).then(setData).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>;
  if (!data)   return <div className="alert alert-danger">Customer not found.</div>;

  const { customer: c, orders, reviews } = data;

  return (
    <>
      <div className="d-flex align-items-center gap-3 mb-4">
        <Link to="/admin/customers" className="btn btn-outline-secondary btn-sm">&larr; Customers</Link>
        <h2 className="mb-0">{c.full_name}</h2>
      </div>

      {/* Customer info card */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-4">
              <div className="text-muted small">Email</div>
              <div>{c.email}</div>
            </div>
            <div className="col-md-2">
              <div className="text-muted small">Gender</div>
              <div>{c.gender}</div>
            </div>
            <div className="col-md-2">
              <div className="text-muted small">Segment</div>
              <div className="text-capitalize">{c.customer_segment}</div>
            </div>
            <div className="col-md-2">
              <div className="text-muted small">Loyalty Tier</div>
              <div className="text-capitalize">{c.loyalty_tier}</div>
            </div>
            <div className="col-md-2">
              <div className="text-muted small">Status</div>
              <div>
                {c.is_active
                  ? <span className="badge bg-success">Active</span>
                  : <span className="badge bg-secondary">Inactive</span>}
              </div>
            </div>
            <div className="col-md-4">
              <div className="text-muted small">Location</div>
              <div>{c.city}, {c.state} {c.zip_code}</div>
            </div>
            <div className="col-md-4">
              <div className="text-muted small">Member Since</div>
              <div>{c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}</div>
            </div>
            <div className="col-md-4">
              <div className="text-muted small">Date of Birth</div>
              <div>{c.birthdate || "—"}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        {/* Orders */}
        <div className="col-lg-7">
          <div className="card">
            <div className="card-header fw-semibold">Orders ({orders.length})</div>
            <div className="table-responsive">
              <table className="table table-hover mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    <th>Order ID</th>
                    <th>Date</th>
                    <th>Total</th>
                    <th>Carrier</th>
                    <th>Fraud</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 && (
                    <tr><td colSpan={5} className="text-center text-muted py-3">No orders</td></tr>
                  )}
                  {orders.map((o) => (
                    <tr key={o.order_id} className={o.is_fraud ? "table-danger" : ""}>
                      <td>
                        <Link to={`/admin/orders/${o.order_id}`} className="text-decoration-none">
                          #{o.order_id}
                        </Link>
                      </td>
                      <td className="small text-muted">{new Date(o.order_datetime).toLocaleDateString()}</td>
                      <td>${Number(o.order_total).toFixed(2)}</td>
                      <td>{o.carrier || "—"}</td>
                      <td><FraudBadge isFraud={o.is_fraud} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Reviews */}
        <div className="col-lg-5">
          <div className="card">
            <div className="card-header fw-semibold">Reviews ({reviews.length})</div>
            <div className="table-responsive">
              <table className="table table-hover mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    <th>Product</th>
                    <th>Rating</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.length === 0 && (
                    <tr><td colSpan={3} className="text-center text-muted py-3">No reviews</td></tr>
                  )}
                  {reviews.map((r) => (
                    <tr key={r.review_id}>
                      <td>
                        <Link to={`/admin/products/${r.product_id}`} className="text-decoration-none small">
                          {r.product_name}
                        </Link>
                        {r.review_text && (
                          <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                            {r.review_text.slice(0, 60)}{r.review_text.length > 60 ? "…" : ""}
                          </div>
                        )}
                      </td>
                      <td><StarRating rating={r.rating} /></td>
                      <td className="text-muted small">{new Date(r.review_datetime).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
