import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getAdminReviews } from "../../api";
import Pagination from "../../components/Pagination";
import StarRating from "../../components/StarRating";

export default function Reviews() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ rating: "", page: 1 });

  useEffect(() => {
    setLoading(true);
    getAdminReviews(filters).then(setData).finally(() => setLoading(false));
  }, [filters]);

  const set = (key, val) => setFilters((f) => ({ ...f, [key]: val, page: 1 }));

  return (
    <>
      <h2 className="mb-3">Product Reviews</h2>

      <div className="row g-2 mb-3">
        <div className="col-md-2">
          <select className="form-select" value={filters.rating} onChange={(e) => set("rating", e.target.value)}>
            <option value="">All ratings</option>
            {[5,4,3,2,1].map((r) => <option key={r} value={r}>{r} star{r !== 1 ? "s" : ""}</option>)}
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
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Product</th>
                  <th>Rating</th>
                  <th>Review</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-muted py-4">No reviews found</td></tr>
                )}
                {data?.items.map((r) => (
                  <tr key={r.review_id}>
                    <td className="text-muted small">{new Date(r.review_datetime).toLocaleDateString()}</td>
                    <td>
                      <Link to={`/admin/customers/${r.customer_id}`} className="text-decoration-none">
                        {r.full_name}
                      </Link>
                    </td>
                    <td>
                      <Link to={`/admin/products/${r.product_id}`} className="text-decoration-none">
                        {r.product_name}
                      </Link>
                    </td>
                    <td><StarRating rating={r.rating} /></td>
                    <td className="text-muted small">
                      {r.review_text
                        ? r.review_text.slice(0, 80) + (r.review_text.length > 80 ? "…" : "")
                        : <em>No text</em>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="d-flex justify-content-between align-items-center mt-2">
            <small className="text-muted">{data?.total} reviews</small>
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
