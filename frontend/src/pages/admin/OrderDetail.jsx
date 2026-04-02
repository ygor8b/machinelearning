import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getAdminOrder } from "../../api";
import FraudBadge from "../../components/FraudBadge";

export default function OrderDetail() {
  const { id } = useParams();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminOrder(id).then(setData).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>;
  if (!data)   return <div className="alert alert-danger">Order not found.</div>;

  const { order: o, items, shipment: s } = data;

  return (
    <>
      <div className="d-flex align-items-center gap-3 mb-4">
        <Link to="/admin/orders" className="btn btn-outline-secondary btn-sm">&larr; Orders</Link>
        <h2 className="mb-0">Order #{o.order_id}</h2>
        <FraudBadge isFraud={o.is_fraud} />
      </div>

      {o.is_fraud && (
        <div className="alert alert-danger">
          <strong>This order has been flagged as fraudulent.</strong>
          {o.fraud_probability != null && (
            <> ML model confidence: <strong>{(o.fraud_probability * 100).toFixed(1)}%</strong></>
          )}
        </div>
      )}
      {!o.is_fraud && o.fraud_probability != null && o.fraud_probability >= 0.5 && (
        <div className="alert alert-warning">
          <strong>ML model flagged this order as high risk</strong> ({(o.fraud_probability * 100).toFixed(1)}% fraud probability) but it has not been manually marked as fraud.
        </div>
      )}

      <div className="row g-4 mb-4">
        {/* Order info */}
        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-header fw-semibold">Order Info</div>
            <div className="card-body">
              <dl className="row mb-0">
                <dt className="col-5 text-muted">Customer</dt>
                <dd className="col-7">
                  <Link to={`/admin/customers/${o.customer_id}`}>{o.full_name}</Link>
                </dd>
                <dt className="col-5 text-muted">Date</dt>
                <dd className="col-7">{new Date(o.order_datetime).toLocaleString()}</dd>
                <dt className="col-5 text-muted">Payment</dt>
                <dd className="col-7 text-capitalize">{o.payment_method}</dd>
                <dt className="col-5 text-muted">Device</dt>
                <dd className="col-7 text-capitalize">{o.device_type}</dd>
                <dt className="col-5 text-muted">IP Country</dt>
                <dd className="col-7">{o.ip_country}</dd>
                <dt className="col-5 text-muted">Promo Used</dt>
                <dd className="col-7">{o.promo_used ? (o.promo_code || "Yes") : "No"}</dd>
                <dt className="col-5 text-muted">Risk Score</dt>
                <dd className="col-7">{Number(o.risk_score).toFixed(1)}</dd>
                <dt className="col-5 text-muted">ML Fraud Prob</dt>
                <dd className="col-7">
                  {o.fraud_probability != null ? (
                    <span className={`badge ${o.fraud_probability >= 0.5 ? "bg-danger" : o.fraud_probability >= 0.25 ? "bg-warning text-dark" : "bg-success"}`}>
                      {(o.fraud_probability * 100).toFixed(1)}%
                    </span>
                  ) : <span className="text-muted">not scored</span>}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        {/* Shipment info */}
        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-header fw-semibold">Shipment Info</div>
            <div className="card-body">
              {!s ? (
                <p className="text-muted">No shipment record found.</p>
              ) : (
                <dl className="row mb-0">
                  <dt className="col-5 text-muted">Carrier</dt>
                  <dd className="col-7">{s.carrier}</dd>
                  <dt className="col-5 text-muted">Method</dt>
                  <dd className="col-7 text-capitalize">{s.shipping_method}</dd>
                  <dt className="col-5 text-muted">Distance</dt>
                  <dd className="col-7 text-capitalize">{s.distance_band}</dd>
                  <dt className="col-5 text-muted">Ship Date</dt>
                  <dd className="col-7">{new Date(s.ship_datetime).toLocaleString()}</dd>
                  <dt className="col-5 text-muted">Promised</dt>
                  <dd className="col-7">{s.promised_days} days</dd>
                  <dt className="col-5 text-muted">Actual</dt>
                  <dd className="col-7">{s.actual_days != null ? `${s.actual_days} days` : "Pending"}</dd>
                  <dt className="col-5 text-muted">Late</dt>
                  <dd className="col-7">
                    {s.late_delivery
                      ? <span className="badge bg-danger">Late</span>
                      : <span className="badge bg-success">On Time</span>}
                  </dd>
                </dl>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="card">
        <div className="card-header fw-semibold">Line Items</div>
        <div className="table-responsive">
          <table className="table mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Category</th>
                <th className="text-end">Qty</th>
                <th className="text-end">Unit Price</th>
                <th className="text-end">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.order_item_id}>
                  <td>
                    <Link to={`/admin/products/${item.product_id}`} className="text-decoration-none">
                      {item.product_name}
                    </Link>
                  </td>
                  <td className="text-muted small">{item.sku}</td>
                  <td>{item.category}</td>
                  <td className="text-end">{item.quantity}</td>
                  <td className="text-end">${Number(item.unit_price).toFixed(2)}</td>
                  <td className="text-end">${Number(item.line_total).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="table-light fw-semibold">
              <tr>
                <td colSpan={5} className="text-end">Subtotal</td>
                <td className="text-end">${Number(o.order_subtotal).toFixed(2)}</td>
              </tr>
              <tr>
                <td colSpan={5} className="text-end">Shipping</td>
                <td className="text-end">${Number(o.shipping_fee).toFixed(2)}</td>
              </tr>
              <tr>
                <td colSpan={5} className="text-end">Tax</td>
                <td className="text-end">${Number(o.tax_amount).toFixed(2)}</td>
              </tr>
              <tr className="table-primary">
                <td colSpan={5} className="text-end fw-bold">Total</td>
                <td className="text-end fw-bold">${Number(o.order_total).toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  );
}
