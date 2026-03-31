export default function FraudBadge({ isFraud }) {
  return isFraud ? (
    <span className="badge bg-danger">Fraud</span>
  ) : (
    <span className="badge bg-success">Clean</span>
  );
}
