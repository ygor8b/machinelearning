from fastapi import APIRouter, HTTPException
from db import query
import score as scoring_module

router = APIRouter()


@router.get("/queue")
def late_delivery_queue():
    rows = query(
        """
        SELECT
            s.shipment_id,
            s.order_id,
            s.carrier,
            s.shipping_method,
            s.promised_days,
            s.actual_days,
            s.late_delivery,
            s.predicted_late_prob,
            o.order_datetime,
            o.order_total,
            c.full_name,
            c.customer_id
        FROM shipments s
        JOIN orders o ON s.order_id = o.order_id
        JOIN customers c ON o.customer_id = c.customer_id
        WHERE s.predicted_late_prob IS NOT NULL
        ORDER BY s.predicted_late_prob DESC
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
