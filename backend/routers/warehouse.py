from fastapi import APIRouter
from db import query

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
    # TODO: Wire up ML inference job here.
    # The ML team will replace this stub with either:
    #   - subprocess.run(["python", "score.py"]) for a local script, or
    #   - an HTTP call to a Supabase Edge Function
    # The job should populate shipments.predicted_late_prob for all rows.
    return {
        "status": "queued",
        "message": "Scoring job queued — ML inference not yet wired up. Check back after the ML team integrates the pipeline.",
    }
