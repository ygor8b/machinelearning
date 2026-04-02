"""
Fraud model retraining pipeline.

Pulls data from Supabase, replicates the feature engineering from ml.ipynb,
trains the best model via cross-validation, saves fraud_model.sav locally,
and uploads it to Supabase Storage so Railway can survive redeploys.

Run standalone:  python train.py
Called by API:   from train import run_training; run_training()
"""

import os
import json
import warnings
import joblib
from datetime import datetime, timezone

import pandas as pd
import numpy as np
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

from sklearn.model_selection import train_test_split, StratifiedKFold, cross_validate, GridSearchCV
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import roc_auc_score, recall_score, precision_score, f1_score, accuracy_score

from functions import basic_wrangling, bin_categories, manage_dates, handle_missing_data

warnings.filterwarnings("ignore")
load_dotenv()

MODEL_PATH = os.path.join(os.path.dirname(__file__), "fraud_model.sav")
STORAGE_BUCKET = "ml-models"
STORAGE_PATH   = "fraud_model.sav"


# ── Supabase Storage helpers ──────────────────────────────────────────────────

def _storage_client():
    from supabase import create_client
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_KEY"]
    return create_client(url, key).storage.from_(STORAGE_BUCKET)


def upload_model():
    """Upload the local fraud_model.sav to Supabase Storage."""
    bucket = _storage_client()
    with open(MODEL_PATH, "rb") as f:
        data = f.read()
    try:
        bucket.update(STORAGE_PATH, data, {"content-type": "application/octet-stream"})
    except Exception:
        bucket.upload(STORAGE_PATH, data, {"content-type": "application/octet-stream"})
    print(f"Model uploaded to Supabase Storage: {STORAGE_BUCKET}/{STORAGE_PATH}")


def download_model():
    """Download fraud_model.sav from Supabase Storage to disk."""
    bucket = _storage_client()
    data = bucket.download(STORAGE_PATH)
    with open(MODEL_PATH, "wb") as f:
        f.write(data)
    print(f"Model downloaded from Supabase Storage → {MODEL_PATH}")


# ── Data loading ──────────────────────────────────────────────────────────────

def _coerce_decimals(df):
    """Cast any Decimal columns to float so sklearn doesn't see mixed types."""
    from decimal import Decimal
    for col in df.columns:
        if df[col].apply(lambda x: isinstance(x, Decimal)).any():
            df[col] = df[col].astype(float)
    return df


def _load_data():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM orders")
        orders = _coerce_decimals(pd.DataFrame(cur.fetchall()))
        cur.execute("SELECT * FROM customers")
        customers = _coerce_decimals(pd.DataFrame(cur.fetchall()))
        cur.execute("SELECT order_id, quantity, product_id, unit_price FROM order_items")
        items_raw = _coerce_decimals(pd.DataFrame(cur.fetchall()))
        cur.execute("SELECT order_id, late_delivery, shipping_method, carrier, distance_band FROM shipments")
        shipments = _coerce_decimals(pd.DataFrame(cur.fetchall()))
    finally:
        conn.close()
    return orders, customers, items_raw, shipments


# ── Feature engineering (mirrors ml.ipynb cells 7-11) ────────────────────────

def _build_training_frame(orders, customers, items_raw, shipments):
    items_agg = items_raw.groupby("order_id").agg(
        num_items      =("quantity",   "sum"),
        num_products   =("product_id", "nunique"),
        avg_unit_price =("unit_price", "mean"),
    ).reset_index()

    df = (
        orders
        .merge(
            customers[["customer_id", "birthdate", "created_at", "gender",
                        "customer_segment", "loyalty_tier", "state"]],
            on="customer_id", how="left",
        )
        .merge(items_agg, on="order_id", how="left")
        .merge(shipments, on="order_id", how="left")
    )

    order_dt = pd.to_datetime(df["order_datetime"], format="mixed", utc=True)
    df["customer_age"]        = (order_dt - pd.to_datetime(df["birthdate"], format="mixed", utc=True)).dt.days // 365
    df["account_tenure_days"] = (order_dt - pd.to_datetime(df["created_at"],  format="mixed", utc=True)).dt.days
    df["billing_eq_shipping"] = (df["billing_zip"] == df["shipping_zip"]).astype(int)
    df["is_foreign_ip"]       = (df["ip_country"] != "US").astype(int)

    df.drop(columns=[
        "order_id", "customer_id", "billing_zip", "shipping_zip",
        "birthdate", "created_at", "risk_score", "fraud_probability",
    ], inplace=True, errors="ignore")

    df = manage_dates(df)
    df.drop(columns=["order_datetime"], inplace=True, errors="ignore")

    df, _ = handle_missing_data(df, col_threshold=0.5, row_threshold=0.6,
                                test_mechanism=False, verbose=False)
    df = basic_wrangling(df)
    df = bin_categories(df)

    return df


# ── Model training ────────────────────────────────────────────────────────────

def run_training():
    print(f"[{datetime.now(timezone.utc).isoformat()}] Starting training…")

    orders, customers, items_raw, shipments = _load_data()
    df = _build_training_frame(orders, customers, items_raw, shipments)

    X = df.drop(columns=["is_fraud"])
    y = df["is_fraud"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    num_cols = X_train.select_dtypes(include=["int64", "float64"]).columns.tolist()
    cat_cols = X_train.select_dtypes(include=["object"]).columns.tolist()

    preprocessor = ColumnTransformer([
        ("num", Pipeline([("imp", SimpleImputer(strategy="median")),
                          ("sc",  StandardScaler())]), num_cols),
        ("cat", Pipeline([("imp", SimpleImputer(strategy="most_frequent")),
                          ("ohe", OneHotEncoder(handle_unknown="ignore",
                                                sparse_output=False))]), cat_cols),
    ])

    models = [
        ("Logistic Regression", Pipeline([("prep", preprocessor),
            ("clf", LogisticRegression(max_iter=1000, class_weight="balanced",
                                       random_state=42))])),
        ("Decision Tree", Pipeline([("prep", preprocessor),
            ("clf", DecisionTreeClassifier(max_depth=6, class_weight="balanced",
                                           random_state=42))])),
        ("Random Forest", Pipeline([("prep", preprocessor),
            ("clf", RandomForestClassifier(n_estimators=200, class_weight="balanced",
                                           random_state=42, n_jobs=-1))])),
        ("Gradient Boosting", Pipeline([("prep", preprocessor),
            ("clf", GradientBoostingClassifier(n_estimators=200, learning_rate=0.05,
                                               max_depth=3, random_state=42))])),
    ]

    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    scoring = {"roc_auc": "roc_auc"}

    print("Cross-validating models…")
    cv_scores = {}
    for name, model in models:
        cv = cross_validate(model, X_train, y_train, cv=skf,
                            scoring=scoring, n_jobs=-1)
        cv_scores[name] = cv["test_roc_auc"].mean()
        print(f"  {name}: AUC={cv_scores[name]:.4f}")

    best_name  = max(cv_scores, key=cv_scores.get)
    best_model = dict(models)[best_name]
    print(f"Best model: {best_name} (AUC={cv_scores[best_name]:.4f})")

    # Hyperparameter tuning
    param_grids = {
        "Random Forest":      {"clf__n_estimators": [100, 200], "clf__max_depth": [None, 5, 10]},
        "Gradient Boosting":  {"clf__n_estimators": [100, 200], "clf__learning_rate": [0.05, 0.1]},
        "Logistic Regression":{"clf__C": [0.1, 1.0, 10.0]},
        "Decision Tree":      {"clf__max_depth": [3, 5, 6, None]},
    }
    grid = GridSearchCV(best_model, param_grids[best_name],
                        cv=skf, scoring="roc_auc", n_jobs=-1)
    grid.fit(X_train, y_train)
    best_model = grid.best_estimator_
    print(f"Tuned params: {grid.best_params_}")

    # Final fit + test metrics
    best_model.fit(X_train, y_train)
    y_pred = best_model.predict(X_test)
    y_prob = best_model.predict_proba(X_test)[:, 1]

    metrics = {
        "roc_auc":         round(float(roc_auc_score(y_test, y_prob)), 4),
        "recall_fraud":    round(float(recall_score(y_test, y_pred)), 4),
        "precision_fraud": round(float(precision_score(y_test, y_pred)), 4),
        "f1_fraud":        round(float(f1_score(y_test, y_pred)), 4),
        "accuracy":        round(float(accuracy_score(y_test, y_pred)), 4),
    }
    metadata = {
        "model_name":      "fraud_detection_pipeline",
        "best_model_type": best_name,
        "trained_at_utc":  datetime.now(timezone.utc).isoformat(),
        "n_train_rows":    int(X_train.shape[0]),
        "n_test_rows":     int(X_test.shape[0]),
        "features":        X_train.columns.tolist(),
        "metrics":         metrics,
    }

    # Save locally
    joblib.dump(best_model, MODEL_PATH)
    print(f"Model saved → {MODEL_PATH}")
    print(f"Metrics: {metrics}")

    # Upload to Supabase Storage so it survives redeploys
    try:
        upload_model()
    except Exception as e:
        print(f"Warning: could not upload to Supabase Storage: {e}")

    return metadata


if __name__ == "__main__":
    result = run_training()
    print(json.dumps(result, indent=2))
