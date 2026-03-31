import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getAdminProduct } from "../../api";
import StarRating from "../../components/StarRating";

export default function ProductDetail() {
  const { id } = useParams();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminProduct(id).then(setData).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>;
  if (!data)   return <div className="alert alert-danger">Product not found.</div>;

  const { product: p, sales, reviews, margin } = data;

  return (
    <>
      <div className="d-flex align-items-center gap-3 mb-4">
        <Link to="/admin/products" className="btn btn-outline-secondary btn-sm">&larr; Products</Link>
        <h2 className="mb-0">{p.product_name}</h2>
        {p.is_active
          ? <span className="badge bg-success">Active</span>
          : <span className="badge bg-secondary">Inactive</span>}
      </div>

      <div className="row g-4 mb-4">
        {/* Product info */}
        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-header fw-semibold">Product Info</div>
            <div className="card-body">
              <dl className="row mb-0">
                <dt className="col-4 text-muted">SKU</dt>
                <dd className="col-8">{p.sku}</dd>
                <dt className="col-4 text-muted">Category</dt>
                <dd className="col-8">{p.category}</dd>
                <dt className="col-4 text-muted">Price</dt>
                <dd className="col-8">${Number(p.price).toFixed(2)}</dd>
                <dt className="col-4 text-muted">Cost</dt>
                <dd className="col-8">${Number(p.cost).toFixed(2)}</dd>
                <dt className="col-4 text-muted">Margin</dt>
                <dd className="col-8">{margin}%</dd>
              </dl>
            </div>
          </div>
        </div>

        {/* Sales summary */}
        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-header fw-semibold">Sales Summary</div>
            <div className="card-body d-flex flex-column justify-content-center align-items-center gap-3">
              <div className="text-center">
                <div className="display-6 fw-bold text-primary">{sales.units_sold}</div>
                <div className="text-muted">Units Sold</div>
              </div>
              <div className="text-center">
                <div className="display-6 fw-bold text-success">${Number(sales.revenue).toLocaleString()}</div>
                <div className="text-muted">Total Revenue</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reviews */}
      <div className="card">
        <div className="card-header fw-semibold">Reviews ({reviews.length})</div>
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Customer</th>
                <th>Rating</th>
                <th>Date</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {reviews.length === 0 && (
                <tr><td colSpan={4} className="text-center text-muted py-3">No reviews yet</td></tr>
              )}
              {reviews.map((r) => (
                <tr key={r.review_id}>
                  <td>
                    <Link to={`/admin/customers/${r.customer_id}`} className="text-decoration-none">
                      {r.full_name}
                    </Link>
                  </td>
                  <td><StarRating rating={r.rating} /></td>
                  <td className="text-muted small">{new Date(r.review_datetime).toLocaleDateString()}</td>
                  <td className="text-muted small">
                    {r.review_text
                      ? r.review_text.slice(0, 100) + (r.review_text.length > 100 ? "…" : "")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
