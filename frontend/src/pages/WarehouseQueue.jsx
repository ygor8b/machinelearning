import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getWarehouseQueue, runScoring, runTraining } from "../api";

export default function WarehouseQueue() {
  const [rows,     setRows]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [scoring,  setScoring]  = useState(false);
  const [training, setTraining] = useState(false);
  const [message,  setMessage]  = useState(null);

  useEffect(() => {
    setLoading(true);
    setMessage(null);
    runScoring()
      .then((res) => {
        setMessage({ type: "success", text: res.message });
        return getWarehouseQueue();
      })
      .then(setRows)
      .catch((err) => {
        setMessage({ type: "warning", text: `Scoring skipped: ${err.message}` });
        return getWarehouseQueue().then(setRows);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleScore = async () => {
    setScoring(true);
    setMessage(null);
    try {
      const res = await runScoring();
      setMessage({ type: "success", text: res.message });
      setRows(await getWarehouseQueue());
    } catch (err) {
      setMessage({ type: "danger", text: err.message || "Scoring failed." });
    } finally {
      setScoring(false);
    }
  };

  const handleTrain = async () => {
    setTraining(true);
    setMessage(null);
    try {
      const res = await runTraining();
      const scored = await runScoring();
      setMessage({ type: "success", text: `${res.message} — ${scored.message}` });
      setRows(await getWarehouseQueue());
    } catch (err) {
      setMessage({ type: "danger", text: err.message || "Training failed." });
    } finally {
      setTraining(false);
    }
  };

  const probColor = (p) => {
    if (p >= 0.7) return "#dc3545";
    if (p >= 0.4) return "#fd7e14";
    return "#198754";
  };

  const busy = scoring || training || loading;

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-0">Fraud Priority Queue</h2>
          <p className="text-muted mb-0 small">
            Top 50 orders by ML-predicted fraud probability — auto-scored on page load
          </p>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-primary" onClick={handleScore} disabled={busy}>
            {scoring
              ? <><span className="spinner-border spinner-border-sm me-2" />Scoring…</>
              : "Re-score"}
          </button>
          <button className="btn btn-warning" onClick={handleTrain} disabled={busy}>
            {training
              ? <><span className="spinner-border spinner-border-sm me-2" />Training…</>
              : "Retrain Model"}
          </button>
        </div>
      </div>

      {message && (
        <div className={`alert alert-${message.type} alert-dismissible`}>
          {message.text}
          <button type="button" className="btn-close" onClick={() => setMessage(null)} />
        </div>
      )}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-warning mb-2" />
          <div className="text-muted small">Scoring orders…</div>
        </div>
      ) : rows === null ? (
        <div className="alert alert-danger">Failed to load queue.</div>
      ) : rows.length === 0 ? (
        <div className="alert alert-info">
          No predictions available yet. Click <strong>Re-score</strong> to run the model.
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle" style={{ fontSize: "0.875rem" }}>
            <thead>
              {/* Group headers */}
              <tr className="table-dark">
                <th colSpan={7} className="border-end">Order Details</th>
                <th colSpan={2} className="text-center border-end" style={{ background: "#4a1942" }}>
                  ML Prediction
                </th>
                <th colSpan={1} className="text-center" style={{ background: "#1a3a4a" }}>
                  Actual Outcome
                </th>
              </tr>
              {/* Column headers */}
              <tr className="table-secondary">
                <th className="text-muted fw-normal">#</th>
                <th>Order</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Total</th>
                <th>Payment</th>
                <th className="border-end">Device / IP / State</th>
                <th className="border-end" style={{ minWidth: 180 }}>Fraud Probability</th>
                <th className="text-center border-end">ML Verdict</th>
                <th className="text-center">Confirmed Fraud?</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const prob = r.fraud_probability;
                const mlFlagged = prob >= 0.5;
                const rowClass = r.is_fraud ? "table-danger" : mlFlagged ? "table-warning" : "";

                return (
                  <tr key={r.order_id} className={rowClass}>
                    <td className="text-muted">{i + 1}</td>
                    <td>
                      <Link to={`/admin/orders/${r.order_id}`} className="text-decoration-none fw-semibold">
                        #{r.order_id}
                      </Link>
                      {r.promo_used ? (
                        <span className="badge bg-info text-dark ms-1" style={{ fontSize: "0.65rem" }}>promo</span>
                      ) : null}
                    </td>
                    <td>
                      <Link to={`/admin/customers/${r.customer_id}`} className="text-decoration-none">
                        {r.full_name}
                      </Link>
                    </td>
                    <td className="text-muted">
                      {new Date(r.order_datetime).toLocaleDateString()}<br />
                      <span style={{ fontSize: "0.75rem" }}>
                        {new Date(r.order_datetime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </td>
                    <td className="fw-semibold">${Number(r.order_total).toFixed(2)}</td>
                    <td className="text-capitalize">{r.payment_method}</td>
                    <td className="border-end">
                      <div className="text-capitalize">{r.device_type}</div>
                      <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                        {r.ip_country}{r.shipping_state ? ` → ${r.shipping_state}` : ""}
                      </div>
                    </td>

                    {/* ML Prediction */}
                    <td className="border-end" style={{ minWidth: 180 }}>
                      <div className="d-flex align-items-center gap-2">
                        <div className="progress flex-grow-1" style={{ height: 10 }}>
                          <div
                            className="progress-bar"
                            style={{
                              width: `${prob * 100}%`,
                              backgroundColor: probColor(prob),
                            }}
                          />
                        </div>
                        <span className="fw-bold" style={{ color: probColor(prob), minWidth: 42, fontSize: "0.85rem" }}>
                          {(prob * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-muted" style={{ fontSize: "0.72rem" }}>
                        {prob >= 0.7 ? "High risk" : prob >= 0.4 ? "Medium risk" : "Low risk"}
                      </div>
                    </td>
                    <td className="text-center border-end">
                      {mlFlagged
                        ? <span className="badge bg-danger">Flagged</span>
                        : <span className="badge bg-success">Clear</span>}
                    </td>

                    {/* Actual outcome */}
                    <td className="text-center">
                      {r.is_fraud
                        ? <span className="badge bg-danger">Fraud</span>
                        : <span className="badge bg-secondary">Not fraud</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="d-flex gap-3 mt-2" style={{ fontSize: "0.8rem" }}>
            <span><span className="badge bg-danger me-1">■</span>Row highlighted red = confirmed fraud</span>
            <span><span className="badge bg-warning text-dark me-1">■</span>Row highlighted yellow = ML flagged, not confirmed</span>
          </div>
        </div>
      )}
    </>
  );
}
