import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useCustomer } from "../context/CustomerContext";
import { getPortalProducts, placeOrder } from "../api";

export default function NewOrder() {
  const { customer } = useCustomer();
  const navigate = useNavigate();
  const [products, setProducts]           = useState([]);
  const [quantities, setQuantities]       = useState({});
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [shippingState, setShippingState] = useState("");
  const [submitting, setSubmitting]       = useState(false);
  const [error, setError]                 = useState(null);

  useEffect(() => {
    if (!customer) { navigate("/"); return; }
    setShippingState(customer.state || "");
    getPortalProducts().then(setProducts);
  }, [customer]);

  const setQty = (productId, val) => {
    const n = Math.max(0, parseInt(val) || 0);
    setQuantities((prev) => ({ ...prev, [productId]: n }));
  };

  const subtotal = products.reduce(
    (sum, p) => sum + (quantities[p.product_id] || 0) * p.price,
    0
  );
  const shipping = subtotal > 0 ? 9.99 : 0;
  const tax      = subtotal * 0.08;
  const total    = subtotal + shipping + tax;

  const selectedItems = products
    .filter((p) => (quantities[p.product_id] || 0) > 0)
    .map((p) => ({ product_id: p.product_id, quantity: quantities[p.product_id] }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedItems.length === 0) { setError("Add at least one item."); return; }
    setSubmitting(true);
    setError(null);
    try {
      await placeOrder({
        customer_id:    customer.customer_id,
        payment_method: paymentMethod,
        shipping_state: shippingState,
        items:          selectedItems,
      });
      navigate("/my-orders");
    } catch {
      setError("Failed to place order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!customer) return null;

  // Group products by category
  const byCategory = products.reduce((acc, p) => {
    (acc[p.category] = acc[p.category] || []).push(p);
    return acc;
  }, {});

  return (
    <>
      <div className="d-flex align-items-center gap-3 mb-4">
        <Link to="/dashboard" className="btn btn-outline-secondary btn-sm">&larr; Back</Link>
        <h2 className="mb-0">Place New Order</h2>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="row g-4">
          {/* Product catalog */}
          <div className="col-lg-8">
            {Object.entries(byCategory).sort().map(([cat, prods]) => (
              <div key={cat} className="card mb-3">
                <div className="card-header fw-semibold">{cat}</div>
                <div className="table-responsive">
                  <table className="table mb-0 align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>Product</th>
                        <th>SKU</th>
                        <th className="text-end">Price</th>
                        <th style={{ width: 120 }}>Qty</th>
                        <th className="text-end">Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prods.map((p) => {
                        const qty  = quantities[p.product_id] || 0;
                        const line = qty * p.price;
                        return (
                          <tr key={p.product_id}>
                            <td>{p.product_name}</td>
                            <td className="text-muted small">{p.sku}</td>
                            <td className="text-end">${p.price.toFixed(2)}</td>
                            <td>
                              <input
                                type="number"
                                className="form-control form-control-sm"
                                min={0}
                                value={qty || ""}
                                placeholder="0"
                                onChange={(e) => setQty(p.product_id, e.target.value)}
                              />
                            </td>
                            <td className="text-end">
                              {line > 0 ? `$${line.toFixed(2)}` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          {/* Order summary */}
          <div className="col-lg-4">
            <div className="card sticky-top" style={{ top: 80 }}>
              <div className="card-header fw-semibold">Order Summary</div>
              <div className="card-body">
                <div className="mb-3">
                  <label className="form-label">Payment Method</label>
                  <select
                    className="form-select"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option value="card">Card</option>
                    <option value="paypal">PayPal</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="crypto">Crypto</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Shipping State</label>
                  <input
                    type="text"
                    className="form-control"
                    value={shippingState}
                    maxLength={2}
                    onChange={(e) => setShippingState(e.target.value.toUpperCase())}
                    placeholder="e.g. CA"
                  />
                </div>

                <hr />
                <div className="d-flex justify-content-between mb-1">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="d-flex justify-content-between mb-1">
                  <span>Shipping</span>
                  <span>{subtotal > 0 ? "$9.99" : "—"}</span>
                </div>
                <div className="d-flex justify-content-between mb-1">
                  <span>Tax (8%)</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                <div className="d-flex justify-content-between fw-bold mt-2">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-100 mt-3"
                  disabled={submitting || selectedItems.length === 0}
                >
                  {submitting ? (
                    <><span className="spinner-border spinner-border-sm me-2" />Placing…</>
                  ) : "Place Order"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
