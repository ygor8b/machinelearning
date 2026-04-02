import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { getAdminOrders, getPortalCustomers, getPortalProducts, placeOrder } from "../../api";
import Pagination from "../../components/Pagination";
import FraudBadge from "../../components/FraudBadge";

function NewOrderModal({ onCreated }) {
  const [customers,    setCustomers]    = useState([]);
  const [products,     setProducts]     = useState([]);
  const [customerId,   setCustomerId]   = useState("");
  const [quantities,   setQuantities]   = useState({});
  const [payment,      setPayment]      = useState("card");
  const [shipState,    setShipState]    = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState(null);
  const [success,      setSuccess]      = useState(null);
  const closeRef = useRef(null);

  useEffect(() => {
    getPortalCustomers("").then(setCustomers);
    getPortalProducts().then(setProducts);
  }, []);

  const setQty = (id, val) => {
    const n = Math.max(0, parseInt(val) || 0);
    setQuantities((q) => ({ ...q, [id]: n }));
  };

  const subtotal = products.reduce((s, p) => s + (quantities[p.product_id] || 0) * p.price, 0);
  const shipping = subtotal > 0 ? 9.99 : 0;
  const tax      = subtotal * 0.08;
  const total    = subtotal + shipping + tax;
  const items    = products.filter((p) => (quantities[p.product_id] || 0) > 0)
                           .map((p) => ({ product_id: p.product_id, quantity: quantities[p.product_id] }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!customerId) { setError("Select a customer."); return; }
    if (items.length === 0) { setError("Add at least one item."); return; }
    setSubmitting(true); setError(null);
    try {
      const res = await placeOrder({
        customer_id: parseInt(customerId), payment_method: payment,
        shipping_state: shipState, items,
      });
      setSuccess(`Order #${res.order_id} created — total $${Number(res.order_total).toFixed(2)}`);
      setQuantities({}); setCustomerId(""); setShipState("");
      onCreated();
    } catch (err) {
      setError(err.message || "Failed to place order.");
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => { setError(null); setSuccess(null); setQuantities({}); setCustomerId(""); };

  // Group products by category
  const byCategory = products.reduce((acc, p) => {
    (acc[p.category] = acc[p.category] || []).push(p);
    return acc;
  }, {});

  return (
    <div className="modal fade" id="newOrderModal" tabIndex="-1">
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">New Order</h5>
            <button type="button" className="btn-close" data-bs-dismiss="modal" onClick={reset} ref={closeRef} />
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {error   && <div className="alert alert-danger py-2">{error}</div>}
              {success && <div className="alert alert-success py-2">{success}</div>}

              <div className="row g-3 mb-3 align-items-end">
                <div className="col-md-4">
                  <label className="form-label fw-semibold">Customer</label>
                  <select className="form-select" value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)} required>
                    <option value="">Select a customer…</option>
                    {customers.map((c) => (
                      <option key={c.customer_id} value={c.customer_id}>
                        {c.full_name} — {c.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-label fw-semibold">Payment</label>
                  <select className="form-select" value={payment} onChange={(e) => setPayment(e.target.value)}>
                    {["card","paypal","bank","crypto"].map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-label fw-semibold">Ship State</label>
                  <input className="form-control" maxLength={2} placeholder="e.g. CA"
                    value={shipState} onChange={(e) => setShipState(e.target.value.toUpperCase())} />
                </div>
                <div className="col-md-2">
                  <div className="text-muted small">Total</div>
                  <div className="fw-bold text-primary fs-5">${total.toFixed(2)}</div>
                  <div className="text-muted" style={{ fontSize: "0.72rem" }}>
                    ${subtotal.toFixed(2)} + ${shipping.toFixed(2)} ship + ${tax.toFixed(2)} tax
                  </div>
                </div>
                <div className="col-md-2">
                  <button type="submit" className="btn btn-primary w-100"
                    disabled={submitting || items.length === 0 || !customerId}>
                    {submitting
                      ? <><span className="spinner-border spinner-border-sm me-1" />Placing…</>
                      : "Place Order"}
                  </button>
                </div>
              </div>
              <hr />

              {Object.entries(byCategory).sort().map(([cat, prods]) => (
                <div key={cat} className="mb-3">
                  <div className="fw-semibold text-muted small mb-1">{cat}</div>
                  <table className="table table-sm table-bordered mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Product</th>
                        <th className="text-end">Price</th>
                        <th style={{ width: 100 }}>Qty</th>
                        <th className="text-end">Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prods.map((p) => {
                        const qty  = quantities[p.product_id] || 0;
                        return (
                          <tr key={p.product_id}>
                            <td>{p.product_name}</td>
                            <td className="text-end">${p.price.toFixed(2)}</td>
                            <td>
                              <input type="number" className="form-control form-control-sm"
                                min={0} value={qty || ""} placeholder="0"
                                onChange={(e) => setQty(p.product_id, e.target.value)} />
                            </td>
                            <td className="text-end text-muted">
                              {qty > 0 ? `$${(qty * p.price).toFixed(2)}` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function Orders() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ fraud: "", payment: "", device: "", page: 1 });

  const reload = () => {
    setLoading(true);
    getAdminOrders(filters).then(setData).finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, [filters]);

  const set = (key, val) => setFilters((f) => ({ ...f, [key]: val, page: 1 }));

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="mb-0">Orders</h2>
        <button className="btn btn-primary" data-bs-toggle="modal" data-bs-target="#newOrderModal">
          + New Order
        </button>
      </div>
      <NewOrderModal onCreated={reload} />

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
                  <th>ML Fraud Prob</th>
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
                      {o.fraud_probability != null ? (
                        <span className={`badge ${o.fraud_probability >= 0.5 ? "bg-danger" : o.fraud_probability >= 0.25 ? "bg-warning text-dark" : "bg-success"}`}>
                          {(o.fraud_probability * 100).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="badge bg-secondary">not scored</span>
                      )}
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
