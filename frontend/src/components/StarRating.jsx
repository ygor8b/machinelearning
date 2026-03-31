export default function StarRating({ rating }) {
  const n = Math.round(rating || 0);
  return (
    <span style={{ color: "#f5a623", letterSpacing: "2px" }}>
      {"★".repeat(n)}{"☆".repeat(5 - n)}
    </span>
  );
}
