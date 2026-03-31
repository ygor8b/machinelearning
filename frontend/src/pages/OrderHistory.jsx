import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCustomer } from "../context/CustomerContext";
import { getMyOrders } from "../api";
import Pagination from "../components/Pagination";
import FraudBadge from "../components/FraudBadge";

export default function OrderHistory() {
  const { customer } = useCustomer();
  const navigate = useNavigate();
  const [data, setData]       = useState(null);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customer) { navigate("/"); return; }
    setLoading(true);
    getMyOrders(customer.customer_id, page)
      .then(setData)
      .finally(() => setLoading(false));
  }, [customer, page]);

  if (!customer) return null;

  const shipmentBadge = (o) => {
    if (o.late_delivery === true || o.late_delivery === 1)
      return <span className="badge bg-danger">Late</span>;
    if (o.late_delivery === false || o.late_delivery === 0)
      return <span className="badge bg-success">On Time</span>;
    return <span className="badge bg-secondary">Pending</span>;
  };

  return (
    <>
      <div className="d-flex align-items-center gap-3 mb-4">
        <Link to="/dashboard" className="btn btn-outline-secondary btn-sm">&larr; Back</Link>
        <h2 className="mb-0">Order History</h2>
        <span className="text-muted small">— {customer.full_name}</span>
      </div>

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
      ) : !data ? (
        <div className="alert alert-danger">Failed to load orders.</div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead className="table-dark">
                <tr>
                  <th>Order ID</th>
                  <th>Date</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Carrier</th>
                  <th>Delivery</th>
                  <th>Fraud</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-muted py-4">No orders found</td></tr>
                )}
                {data.items.map((o) => (
                  <tr key={o.order_id}>
                    <td>
                      <Link to={`/admin/orders/${o.order_id}`} className="text-decoration-none">
                        #{o.order_id}
                      </Link>
                    </td>
                    <td className="text-muted small">
                      {new Date(o.order_datetime).toLocaleDateString()}
                    </td>
                    <td>${Number(o.order_total).toFixed(2)}</td>
                    <td className="text-capitalize">{o.payment_method}</td>
                    <td>{o.carrier || "—"}</td>
                    <td>{shipmentBadge(o)}</td>
                    <td><FraudBadge isFraud={o.is_fraud} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="d-flex justify-content-between align-items-center mt-2">
            <small className="text-muted">
              {data.total} order{data.total !== 1 ? "s" : ""}
            </small>
            <Pagination page={data.page} totalPages={data.total_pages} onPageChange={setPage} />
          </div>
        </>
      )}
    </>
  );
}
