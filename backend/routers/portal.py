from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List
from datetime import datetime, timezone
from db import query, query_one, execute_returning, paginate

router = APIRouter()


# ── Customer selection ────────────────────────────────────────────────────────

@router.get("/customers")
def list_customers(q: str = Query(default="")):
    conditions = ["TRUE"]
    params: list = []
    if q.strip():
        conditions.append("(full_name ILIKE %s OR email ILIKE %s)")
        params += [f"%{q}%", f"%{q}%"]
    where = "WHERE " + " AND ".join(conditions)
    sql = f"""
        SELECT customer_id, full_name, email, customer_segment, loyalty_tier, city, state
        FROM customers
        {where}
        ORDER BY full_name
        LIMIT 100
    """
    return query(sql, params)


# ── Customer dashboard ────────────────────────────────────────────────────────

@router.get("/dashboard/{customer_id}")
def customer_dashboard(customer_id: int):
    customer = query_one(
        "SELECT * FROM customers WHERE customer_id = %s", (customer_id,)
    )
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    stats = query_one(
        """
        SELECT
            COUNT(o.order_id)                          AS total_orders,
            COALESCE(SUM(o.order_total), 0)            AS total_spent,
            COALESCE(ROUND(AVG(r.rating)::numeric, 2), 0) AS avg_rating
        FROM customers c
        LEFT JOIN orders o ON c.customer_id = o.customer_id
        LEFT JOIN product_reviews r ON c.customer_id = r.customer_id
        WHERE c.customer_id = %s
        """,
        (customer_id,),
    )

    open_shipments = query_one(
        """
        SELECT COUNT(*) AS count
        FROM shipments s
        JOIN orders o ON s.order_id = o.order_id
        WHERE o.customer_id = %s AND s.actual_days IS NULL
        """,
        (customer_id,),
    )

    recent_orders = query(
        """
        SELECT o.order_id, o.order_datetime, o.order_total, o.is_fraud,
               s.carrier, s.late_delivery
        FROM orders o
        LEFT JOIN shipments s ON o.order_id = s.order_id
        WHERE o.customer_id = %s
        ORDER BY o.order_datetime DESC
        LIMIT 5
        """,
        (customer_id,),
    )

    return {
        "customer": customer,
        "stats": {**stats, "open_shipments": open_shipments["count"]},
        "recent_orders": recent_orders,
    }


# ── Order history ─────────────────────────────────────────────────────────────

@router.get("/my-orders/{customer_id}")
def my_orders(customer_id: int, page: int = Query(default=1, ge=1)):
    count_sql = "SELECT COUNT(*) AS count FROM orders WHERE customer_id = %s"
    data_sql = """
        SELECT o.order_id, o.order_datetime, o.order_total, o.payment_method,
               o.is_fraud, s.carrier, s.late_delivery
        FROM orders o
        LEFT JOIN shipments s ON o.order_id = s.order_id
        WHERE o.customer_id = %s
        ORDER BY o.order_datetime DESC
    """
    return paginate(count_sql, data_sql, (customer_id,), page)


# ── Products for new order form ───────────────────────────────────────────────

@router.get("/products")
def available_products():
    return query(
        """
        SELECT product_id, product_name, sku, category, price
        FROM products
        WHERE is_active = TRUE
        ORDER BY category, product_name
        """
    )


# ── Place new order ───────────────────────────────────────────────────────────

class OrderItem(BaseModel):
    product_id: int
    quantity: int


class NewOrderRequest(BaseModel):
    customer_id: int
    payment_method: str
    shipping_state: str
    items: List[OrderItem]


@router.post("/orders")
def place_order(body: NewOrderRequest):
    if not body.items:
        raise HTTPException(status_code=400, detail="Order must contain at least one item")

    # Fetch current prices from DB — never trust client-submitted prices
    product_ids = [item.product_id for item in body.items]
    placeholders = ",".join(["%s"] * len(product_ids))
    products = query(
        f"SELECT product_id, price FROM products WHERE product_id IN ({placeholders}) AND is_active = TRUE",
        product_ids,
    )
    price_map = {p["product_id"]: p["price"] for p in products}

    # Validate all products exist and are active
    for item in body.items:
        if item.product_id not in price_map:
            raise HTTPException(status_code=400, detail=f"Product {item.product_id} not found or inactive")
        if item.quantity < 1:
            raise HTTPException(status_code=400, detail="Quantity must be at least 1")

    # Calculate totals
    subtotal = sum(price_map[item.product_id] * item.quantity for item in body.items)
    shipping_fee = 9.99
    tax_amount = round(subtotal * 0.08, 2)
    order_total = round(subtotal + shipping_fee + tax_amount, 2)
    subtotal = round(subtotal, 2)
    now = datetime.now(timezone.utc).isoformat()

    # Insert order
    new_order = execute_returning(
        """
        INSERT INTO orders (
            customer_id, order_datetime, payment_method, device_type, ip_country,
            shipping_state, order_subtotal, shipping_fee, tax_amount, order_total,
            risk_score, is_fraud, promo_used
        ) VALUES (%s, %s, %s, 'desktop', 'US', %s, %s, %s, %s, %s, 0, FALSE, FALSE)
        RETURNING order_id
        """,
        (
            body.customer_id, now, body.payment_method, body.shipping_state,
            subtotal, shipping_fee, tax_amount, order_total,
        ),
    )
    order_id = new_order["order_id"]

    # Insert order items
    for item in body.items:
        unit_price = price_map[item.product_id]
        line_total = round(unit_price * item.quantity, 2)
        execute_returning(
            """
            INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING order_item_id
            """,
            (order_id, item.product_id, item.quantity, unit_price, line_total),
        )

    return {"order_id": order_id, "order_total": order_total}
