from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from db import query, query_one, paginate

router = APIRouter()


# ── Stats / KPI ───────────────────────────────────────────────────────────────

@router.get("/stats")
def admin_stats():
    orders = query_one(
        """
        SELECT
            COUNT(*)                                        AS total_orders,
            COALESCE(ROUND(SUM(order_total)::numeric, 2), 0) AS total_revenue,
            ROUND(100.0 * SUM(is_fraud::int) / COUNT(*), 2)  AS fraud_rate
        FROM orders
        """
    )
    customers = query_one("SELECT COUNT(*) AS total_customers FROM customers")
    late = query_one(
        "SELECT ROUND(100.0 * SUM(late_delivery::int) / COUNT(*), 2) AS late_rate FROM shipments"
    )
    rating = query_one(
        "SELECT ROUND(AVG(rating)::numeric, 2) AS avg_rating FROM product_reviews"
    )
    return {
        "total_customers": customers["total_customers"],
        "total_orders": orders["total_orders"],
        "total_revenue": orders["total_revenue"],
        "fraud_rate": orders["fraud_rate"],
        "late_rate": late["late_rate"],
        "avg_rating": rating["avg_rating"],
    }


# ── Charts ────────────────────────────────────────────────────────────────────

@router.get("/chart/revenue")
def chart_revenue():
    return query(
        """
        SELECT TO_CHAR(order_datetime, 'YYYY-MM') AS month,
               ROUND(SUM(order_total)::numeric, 2) AS revenue
        FROM orders
        GROUP BY 1
        ORDER BY 1
        """
    )


@router.get("/chart/payments")
def chart_payments():
    return query(
        "SELECT payment_method, COUNT(*) AS count FROM orders GROUP BY 1 ORDER BY 2 DESC"
    )


@router.get("/chart/carriers")
def chart_carriers():
    return query(
        """
        SELECT carrier,
               SUM(late_delivery::int)          AS late_count,
               COUNT(*) - SUM(late_delivery::int) AS on_time_count,
               COUNT(*)                         AS total
        FROM shipments
        GROUP BY 1
        ORDER BY 1
        """
    )


# ── Customers ─────────────────────────────────────────────────────────────────

@router.get("/customers")
def admin_customers(
    q:       str           = Query(default=""),
    segment: Optional[str] = Query(default=None),
    tier:    Optional[str] = Query(default=None),
    active:  Optional[int] = Query(default=None),
    page:    int           = Query(default=1, ge=1),
):
    conditions = ["TRUE"]
    params: list = []
    if q.strip():
        conditions.append("(c.full_name ILIKE %s OR c.email ILIKE %s)")
        params += [f"%{q}%", f"%{q}%"]
    if segment:
        conditions.append("c.customer_segment = %s")
        params.append(segment)
    if tier:
        conditions.append("c.loyalty_tier = %s")
        params.append(tier)
    if active is not None:
        conditions.append("c.is_active = %s")
        params.append(int(active))
    where = "WHERE " + " AND ".join(conditions)

    count_sql = f"SELECT COUNT(DISTINCT c.customer_id) AS count FROM customers c {where}"
    data_sql = f"""
        SELECT c.customer_id, c.full_name, c.email, c.customer_segment, c.loyalty_tier,
               c.city, c.state, c.is_active,
               COUNT(o.order_id)                         AS order_count,
               COALESCE(ROUND(SUM(o.order_total)::numeric, 2), 0) AS lifetime_value
        FROM customers c
        LEFT JOIN orders o ON c.customer_id = o.customer_id
        {where}
        GROUP BY c.customer_id
        ORDER BY c.customer_id
    """
    return paginate(count_sql, data_sql, params, page)


@router.get("/customers/{customer_id}")
def admin_customer_detail(customer_id: int):
    customer = query_one("SELECT * FROM customers WHERE customer_id = %s", (customer_id,))
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    orders = query(
        """
        SELECT o.order_id, o.order_datetime, o.order_total, o.is_fraud,
               o.fraud_probability, s.carrier, s.late_delivery
        FROM orders o
        LEFT JOIN shipments s ON o.order_id = s.order_id
        WHERE o.customer_id = %s
        ORDER BY o.order_datetime DESC
        """,
        (customer_id,),
    )
    reviews = query(
        """
        SELECT r.review_id, r.rating, r.review_datetime, r.review_text, p.product_name
        FROM product_reviews r
        JOIN products p ON r.product_id = p.product_id
        WHERE r.customer_id = %s
        ORDER BY r.review_datetime DESC
        """,
        (customer_id,),
    )
    return {"customer": customer, "orders": orders, "reviews": reviews}


# ── Orders ────────────────────────────────────────────────────────────────────

@router.get("/orders")
def admin_orders(
    fraud:   Optional[int] = Query(default=None),
    payment: Optional[str] = Query(default=None),
    device:  Optional[str] = Query(default=None),
    page:    int           = Query(default=1, ge=1),
):
    conditions = ["TRUE"]
    params: list = []
    if fraud is not None:
        conditions.append("o.is_fraud = %s")
        params.append(bool(fraud))
    if payment:
        conditions.append("o.payment_method = %s")
        params.append(payment)
    if device:
        conditions.append("o.device_type = %s")
        params.append(device)
    where = "WHERE " + " AND ".join(conditions)

    count_sql = f"SELECT COUNT(*) AS count FROM orders o {where}"
    data_sql = f"""
        SELECT o.order_id, o.order_datetime, o.order_total, o.payment_method,
               o.device_type, o.is_fraud, o.risk_score, o.fraud_probability,
               c.full_name, c.customer_id
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.customer_id
        {where}
        ORDER BY o.order_datetime DESC
    """
    return paginate(count_sql, data_sql, params, page)


@router.get("/orders/{order_id}")
def admin_order_detail(order_id: int):
    order = query_one(
        """
        SELECT o.*, c.full_name, c.email
        FROM orders o
        JOIN customers c ON o.customer_id = c.customer_id
        WHERE o.order_id = %s
        """,
        (order_id,),
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    items = query(
        """
        SELECT oi.*, p.product_name, p.sku, p.category
        FROM order_items oi
        JOIN products p ON oi.product_id = p.product_id
        WHERE oi.order_id = %s
        ORDER BY oi.order_item_id
        """,
        (order_id,),
    )
    shipment = query_one("SELECT * FROM shipments WHERE order_id = %s", (order_id,))
    return {"order": order, "items": items, "shipment": shipment}


# ── Products ──────────────────────────────────────────────────────────────────

@router.get("/products")
def admin_products(
    category: Optional[str] = Query(default=None),
    active:   Optional[int] = Query(default=None),
    page:     int           = Query(default=1, ge=1),
):
    conditions = ["TRUE"]
    params: list = []
    if category:
        conditions.append("p.category = %s")
        params.append(category)
    if active is not None:
        conditions.append("p.is_active = %s")
        params.append(int(active))
    where = "WHERE " + " AND ".join(conditions)

    count_sql = f"SELECT COUNT(*) AS count FROM products p {where}"
    data_sql = f"""
        SELECT p.product_id, p.sku, p.product_name, p.category, p.price, p.cost, p.is_active,
               COUNT(r.review_id)                       AS review_count,
               ROUND(AVG(r.rating)::numeric, 2)         AS avg_rating
        FROM products p
        LEFT JOIN product_reviews r ON p.product_id = r.product_id
        {where}
        GROUP BY p.product_id
        ORDER BY p.product_name
    """
    return paginate(count_sql, data_sql, params, page)


@router.get("/products/{product_id}")
def admin_product_detail(product_id: int):
    product = query_one("SELECT * FROM products WHERE product_id = %s", (product_id,))
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    sales = query_one(
        """
        SELECT COUNT(*) AS units_sold, COALESCE(ROUND(SUM(line_total)::numeric, 2), 0) AS revenue
        FROM order_items WHERE product_id = %s
        """,
        (product_id,),
    )
    reviews = query(
        """
        SELECT r.review_id, r.rating, r.review_datetime, r.review_text, c.full_name, c.customer_id
        FROM product_reviews r
        JOIN customers c ON r.customer_id = c.customer_id
        WHERE r.product_id = %s
        ORDER BY r.review_datetime DESC
        """,
        (product_id,),
    )
    margin = round((product["price"] - product["cost"]) / product["price"] * 100, 1) if product["price"] else 0
    return {"product": product, "sales": sales, "reviews": reviews, "margin": margin}


# ── Shipments ─────────────────────────────────────────────────────────────────

@router.get("/shipments")
def admin_shipments(
    carrier:  Optional[str] = Query(default=None),
    method:   Optional[str] = Query(default=None),
    late:     Optional[int] = Query(default=None),
    distance: Optional[str] = Query(default=None),
    page:     int           = Query(default=1, ge=1),
):
    conditions = ["TRUE"]
    params: list = []
    if carrier:
        conditions.append("s.carrier = %s")
        params.append(carrier)
    if method:
        conditions.append("s.shipping_method = %s")
        params.append(method)
    if late is not None:
        conditions.append("s.late_delivery = %s")
        params.append(bool(late))
    if distance:
        conditions.append("s.distance_band = %s")
        params.append(distance)
    where = "WHERE " + " AND ".join(conditions)

    count_sql = f"SELECT COUNT(*) AS count FROM shipments s {where}"
    data_sql = f"""
        SELECT s.shipment_id, s.order_id, s.ship_datetime, s.carrier, s.shipping_method,
               s.distance_band, s.promised_days, s.actual_days, s.late_delivery,
               c.full_name, c.customer_id
        FROM shipments s
        JOIN orders o ON s.order_id = o.order_id
        JOIN customers c ON o.customer_id = c.customer_id
        {where}
        ORDER BY s.ship_datetime DESC
    """
    return paginate(count_sql, data_sql, params, page)


# ── Reviews ───────────────────────────────────────────────────────────────────

@router.get("/reviews")
def admin_reviews(
    rating:     Optional[int] = Query(default=None),
    product_id: Optional[int] = Query(default=None),
    page:       int           = Query(default=1, ge=1),
):
    conditions = ["TRUE"]
    params: list = []
    if rating is not None:
        conditions.append("r.rating = %s")
        params.append(rating)
    if product_id is not None:
        conditions.append("r.product_id = %s")
        params.append(product_id)
    where = "WHERE " + " AND ".join(conditions)

    count_sql = f"SELECT COUNT(*) AS count FROM product_reviews r {where}"
    data_sql = f"""
        SELECT r.review_id, r.rating, r.review_datetime, r.review_text,
               c.full_name, c.customer_id, p.product_name, p.product_id
        FROM product_reviews r
        JOIN customers c ON r.customer_id = c.customer_id
        JOIN products p ON r.product_id = p.product_id
        {where}
        ORDER BY r.review_datetime DESC
    """
    return paginate(count_sql, data_sql, params, page)


# ── Filter options (for dropdowns) ───────────────────────────────────────────

@router.get("/filter-options")
def filter_options():
    categories = [r["category"] for r in query("SELECT DISTINCT category FROM products ORDER BY category")]
    return {
        "categories": categories,
        "segments": ["budget", "standard", "premium"],
        "tiers": ["none", "silver", "gold"],
        "payment_methods": ["card", "paypal", "bank", "crypto"],
        "device_types": ["mobile", "desktop", "tablet"],
        "carriers": ["FedEx", "UPS", "USPS"],
        "shipping_methods": ["standard", "expedited", "overnight"],
        "distance_bands": ["local", "regional", "national"],
    }
