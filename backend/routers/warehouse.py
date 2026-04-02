from fastapi import APIRouter, HTTPException
from db import query
import score as scoring_module
import train as training_module

router = APIRouter()


@router.get("/queue")
def fraud_priority_queue():
    rows = query(
        """
        SELECT
            o.order_id,
            o.order_datetime,
            o.order_total,
            o.payment_method,
            o.device_type,
            o.ip_country,
            o.is_fraud,
            o.fraud_probability,
            c.full_name,
            c.customer_id
        FROM orders o
        JOIN customers c ON o.customer_id = c.customer_id
        WHERE o.fraud_probability IS NOT NULL
        ORDER BY o.fraud_probability DESC
        LIMIT 50
        """
    )
    return rows


@router.post("/score")
def run_scoring():
    try:
        result = scoring_module.run_scoring()
        return {
            "status": "success",
            "message": (
                f"Scored {result['scored']} orders — "
                f"{result['flagged']} flagged as likely fraud "
                f"(avg probability {result['avg_fraud_probability']:.1%})"
            ),
            **result,
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scoring failed: {e}")


@router.post("/train")
def run_training():
    try:
        result = training_module.run_training()
        return {
            "status": "success",
            "message": (
                f"Model retrained ({result['best_model_type']}) — "
                f"AUC {result['metrics']['roc_auc']:.4f}, "
                f"Recall {result['metrics']['recall_fraud']:.4f}"
            ),
            **result,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training failed: {e}")
