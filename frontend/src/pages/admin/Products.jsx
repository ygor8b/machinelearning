import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getAdminProducts, getFilterOptions } from "../../api";
import Pagination from "../../components/Pagination";
import StarRating from "../../components/StarRating";

export default function Products() {
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [categories, setCategories] = useState([]);
  const [filters,    setFilters]    = useState({ category: "", active: "", page: 1 });

  useEffect(() => {
    getFilterOptions().then((o) => setCategories(o.categories));
  }, []);

  useEffect(() => {
    setLoading(true);
    getAdminProducts(filters).then(setData).finally(() => setLoading(false));
  }, [filters]);

  const set = (key, val) => setFilters((f) => ({ ...f, [key]: val, page: 1 }));

  return (
    <>
      <h2 className="mb-3">Products</h2>

      <div className="row g-2 mb-3">
        <div className="col-md-3">
          <select className="form-select" value={filters.category} onChange={(e) => set("category", e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
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
                  <th>Name</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th className="text-end">Price</th>
                  <th className="text-end">Cost</th>
                  <th>Status</th>
                  <th>Rating</th>
                  <th>Reviews</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-muted py-4">No products found</td></tr>
                )}
                {data?.items.map((p) => (
                  <tr key={p.product_id}>
                    <td>
                      <Link to={`/admin/products/${p.product_id}`} className="fw-semibold text-decoration-none">
                        {p.product_name}
                      </Link>
                    </td>
                    <td className="text-muted small">{p.sku}</td>
                    <td>{p.category}</td>
                    <td className="text-end">${Number(p.price).toFixed(2)}</td>
                    <td className="text-end">${Number(p.cost).toFixed(2)}</td>
                    <td>
                      {p.is_active
                        ? <span className="badge bg-success">Active</span>
                        : <span className="badge bg-secondary">Inactive</span>}
                    </td>
                    <td>{p.avg_rating ? <StarRating rating={p.avg_rating} /> : "—"}</td>
                    <td>{p.review_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="d-flex justify-content-between align-items-center mt-2">
            <small className="text-muted">{data?.total} products</small>
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
