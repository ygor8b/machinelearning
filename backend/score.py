"""
Fraud scoring pipeline.

Loads all orders from Supabase, applies the same feature engineering used
during training in ml.ipynb, scores them with the saved fraud_model.sav,
and writes fraud_probability back to the orders table.

Run standalone:  python score.py
Called by API:   from score import run_scoring; run_scoring()
"""

import os
import pandas as pd
import joblib
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

MODEL_PATH = os.path.join(os.path.dirname(__file__), "fraud_model.sav")

# Exact 29 features the model was trained on, in the correct order.
# Must match X_train.columns from ml.ipynb cell 16.
FEATURE_COLS = [
    # Numeric
    "promo_used", "order_subtotal", "shipping_fee", "tax_amount", "order_total",
    "num_items", "num_products", "avg_unit_price", "late_delivery",
    "customer_age", "account_tenure_days", "billing_eq_shipping", "is_foreign_ip",
    # Date components (extracted from order_datetime)
    "order_datetime_hour", "order_datetime_weekday", "order_datetime_month",
    "order_datetime_year", "order_datetime_day",
    # Categorical
    "shipping_state", "payment_method", "device_type", "ip_country",
    "gender", "customer_segment", "loyalty_tier", "state",
    "shipping_method", "carrier", "distance_band",
]


def _load_data(conn):
    """Pull all required tables from Supabase into DataFrames."""
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cur.execute("SELECT * FROM orders")
    orders = pd.DataFrame(cur.fetchall())

    cur.execute(
        "SELECT customer_id, birthdate, created_at, gender, "
        "customer_segment, loyalty_tier, state FROM customers"
    )
    customers = pd.DataFrame(cur.fetchall())

    cur.execute(
        "SELECT order_id, quantity, product_id, unit_price FROM order_items"
    )
    items_raw = pd.DataFrame(cur.fetchall())

    cur.execute(
        "SELECT order_id, late_delivery, shipping_method, carrier, distance_band "
        "FROM shipments"
    )
    shipments = pd.DataFrame(cur.fetchall())

    return orders, customers, items_raw, shipments


def _build_features(orders, customers, items_raw, shipments):
    """
    Replicate the feature engineering from ml.ipynb cells 7 & 8.
    Returns (order_ids, X) where X is a DataFrame with FEATURE_COLS columns.
    """
    # Aggregate order items → one row per order
    items_agg = items_raw.groupby("order_id").agg(
        num_items=("quantity", "sum"),
        num_products=("product_id", "nunique"),
        avg_unit_price=("unit_price", "mean"),
    ).reset_index()

    # Merge everything together
    df = (
        orders
        .merge(customers, on="customer_id", how="left")
        .merge(items_agg, on="order_id", how="left")
        .merge(shipments, on="order_id", how="left")
    )

    order_ids = df["order_id"].values

    # Derived features (cell 7)
    order_dt = pd.to_datetime(df["order_datetime"])
    df["customer_age"] = (
        (order_dt - pd.to_datetime(df["birthdate"])).dt.days // 365
    )
    df["account_tenure_days"] = (
        (order_dt - pd.to_datetime(df["created_at"])).dt.days
    )
    df["billing_eq_shipping"] = (
        df["billing_zip"] == df["shipping_zip"]
    ).astype(int)
    df["is_foreign_ip"] = (df["ip_country"] != "US").astype(int)

    # Date component extraction — replicates manage_dates() (cell 8)
    df["order_datetime_hour"]    = order_dt.dt.hour
    df["order_datetime_weekday"] = order_dt.dt.weekday
    df["order_datetime_month"]   = order_dt.dt.month
    df["order_datetime_year"]    = order_dt.dt.year
    df["order_datetime_day"]     = order_dt.dt.day

    # Select only the features the model expects, in the right order.
    # Missing columns become NaN — the pipeline's SimpleImputer handles them.
    X = df.reindex(columns=FEATURE_COLS)

    return order_ids, X


def run_scoring():
    """
    Score all orders and write fraud_probability back to Supabase.
    Returns a summary dict.
    """
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(
            f"Model file not found at {MODEL_PATH}. "
            "Run ml.ipynb to train and save fraud_model.sav, "
            "then copy it to the backend/ directory."
        )

    model = joblib.load(MODEL_PATH)

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    try:
        orders, customers, items_raw, shipments = _load_data(conn)
        order_ids, X = _build_features(orders, customers, items_raw, shipments)

        fraud_probs = model.predict_proba(X)[:, 1]

        # Write results back to the orders table
        cur = conn.cursor()
        for order_id, prob in zip(order_ids, fraud_probs):
            cur.execute(
                "UPDATE orders SET fraud_probability = %s WHERE order_id = %s",
                (float(round(prob, 6)), int(order_id)),
            )
        conn.commit()
    finally:
        conn.close()

    n = len(order_ids)
    avg = float(fraud_probs.mean())
    flagged = int((fraud_probs >= 0.5).sum())
    return {"scored": n, "flagged": flagged, "avg_fraud_probability": round(avg, 4)}


if __name__ == "__main__":
    result = run_scoring()
    print(
        f"Scored {result['scored']} orders | "
        f"Flagged: {result['flagged']} | "
        f"Avg probability: {result['avg_fraud_probability']:.4f}"
    )
