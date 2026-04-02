import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getWarehouseQueue, runScoring } from "../api";

export default function WarehouseQueue() {
  const [rows, setRows]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [scoring, setScoring]   = useState(false);
  const [message, setMessage]   = useState(null);

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

  const riskColor = (prob) => {
    if (prob >= 0.7) return "#dc3545";
    if (prob >= 0.4) return "#fd7e14";
    return "#198754";
  };

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-0">Late Delivery Priority Queue</h2>
          <p className="text-muted mb-0 small">Top 50 shipments by predicted late-delivery risk</p>
        </div>
        <button
          className="btn btn-warning"
          onClick={handleScore}
          disabled={scoring}
        >
          {scoring ? (
            <><span className="spinner-border spinner-border-sm me-2" />Running…</>
          ) : "Run Scoring"}
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
          <strong>No predictions yet.</strong> Click <strong>Run Scoring</strong> to generate late-delivery probability scores for all shipments.
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead className="table-dark">
              <tr>
                <th>#</th>
                <th>Order</th>
                <th>Customer</th>
                <th>Order Date</th>
                <th>Carrier</th>
                <th>Method</th>
                <th>Promised Days</th>
                <th>Predicted Risk</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.shipment_id}>
                  <td className="text-muted">{i + 1}</td>
                  <td>
                    <Link to={`/admin/orders/${r.order_id}`} className="text-decoration-none">
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
                  <td>{r.carrier}</td>
                  <td className="text-capitalize">{r.shipping_method}</td>
                  <td>{r.promised_days}d</td>
                  <td style={{ minWidth: 160 }}>
                    <div className="d-flex align-items-center gap-2">
                      <div
                        className="progress flex-grow-1"
                        style={{ height: 10 }}
                        title={`${(r.predicted_late_prob * 100).toFixed(1)}%`}
                      >
                        <div
                          className="progress-bar"
                          style={{
                            width: `${r.predicted_late_prob * 100}%`,
                            backgroundColor: riskColor(r.predicted_late_prob),
                          }}
                        />
                      </div>
                      <span
                        className="fw-bold small"
                        style={{ color: riskColor(r.predicted_late_prob), minWidth: 42 }}
                      >
                        {(r.predicted_late_prob * 100).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
