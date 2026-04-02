import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getWarehouseQueue, runScoring } from "../api";
import FraudBadge from "../components/FraudBadge";

export default function WarehouseQueue() {
  const [rows,    setRows]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [message, setMessage] = useState(null);

  const loadQueue = () => {
    setLoading(true);
    getWarehouseQueue()
      .then(setRows)
      .finally(() => setLoading(false));
  };

  useEffect(loadQueue, []);

  const handleScore = async () => {
    setScoring(true);
    setMessage(null);
    try {
      const res = await runScoring();
      const type = res.status === "success" ? "success" : "info";
      setMessage({ type, text: res.message });
      if (res.status === "success") loadQueue();
    } catch {
      setMessage({ type: "danger", text: "Failed to trigger scoring job." });
    } finally {
      setScoring(false);
    }
  };

  const probColor = (p) => {
    if (p >= 0.7) return "#dc3545";
    if (p >= 0.4) return "#fd7e14";
    return "#198754";
  };

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-0">Fraud Priority Queue</h2>
          <p className="text-muted mb-0 small">
            Top 50 orders by ML-predicted fraud probability — click Run Scoring to refresh
          </p>
        </div>
        <button className="btn btn-warning" onClick={handleScore} disabled={scoring}>
          {scoring
            ? <><span className="spinner-border spinner-border-sm me-2" />Scoring…</>
            : "Run Scoring"}
        </button>
      </div>

      {message && (
        <div className={`alert alert-${message.type} alert-dismissible`}>
          {message.text}
          <button type="button" className="btn-close" onClick={() => setMessage(null)} />
        </div>
      )}

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border text-warning" /></div>
      ) : rows === null ? (
        <div className="alert alert-danger">Failed to load queue.</div>
      ) : rows.length === 0 ? (
        <div className="alert alert-info">
          <strong>No predictions yet.</strong> Click <strong>Run Scoring</strong> to run the fraud
          detection model against all orders. Make sure <code>fraud_model.sav</code> is in the{" "}
          <code>backend/</code> directory first.
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead className="table-dark">
              <tr>
                <th>#</th>
                <th>Order</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Payment</th>
                <th>Device</th>
                <th>IP Country</th>
                <th>Total</th>
                <th>Fraud Probability</th>
                <th>Flagged</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.order_id} className={r.is_fraud ? "table-danger" : ""}>
                  <td className="text-muted">{i + 1}</td>
                  <td>
                    <Link to={`/admin/orders/${r.order_id}`} className="text-decoration-none fw-semibold">
                      #{r.order_id}
                    </Link>
                  </td>
                  <td>
                    <Link to={`/admin/customers/${r.customer_id}`} className="text-decoration-none">
                      {r.full_name}
                    </Link>
                  </td>
                  <td className="text-muted small">
                    {new Date(r.order_datetime).toLocaleDateString()}
                  </td>
                  <td className="text-capitalize">{r.payment_method}</td>
                  <td className="text-capitalize">{r.device_type}</td>
                  <td>{r.ip_country}</td>
                  <td>${Number(r.order_total).toFixed(2)}</td>
                  <td style={{ minWidth: 160 }}>
                    <div className="d-flex align-items-center gap-2">
                      <div className="progress flex-grow-1" style={{ height: 10 }}>
                        <div
                          className="progress-bar"
                          style={{
                            width: `${r.fraud_probability * 100}%`,
                            backgroundColor: probColor(r.fraud_probability),
                          }}
                        />
                      </div>
                      <span className="fw-bold small" style={{ color: probColor(r.fraud_probability), minWidth: 42 }}>
                        {(r.fraud_probability * 100).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td><FraudBadge isFraud={r.is_fraud} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
