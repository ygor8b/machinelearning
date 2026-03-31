const get  = (url) => fetch(url).then((r) => r.json());
const post = (url, body) =>
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());

// ── Portal ────────────────────────────────────────────────────────────────────
export const getPortalCustomers = (q = "") =>
  get(`/api/portal/customers?q=${encodeURIComponent(q)}`);

export const getCustomerDashboard = (id) =>
  get(`/api/portal/dashboard/${id}`);

export const getMyOrders = (id, page = 1) =>
  get(`/api/portal/my-orders/${id}?page=${page}`);

export const getPortalProducts = () => get("/api/portal/products");

export const placeOrder = (body) => post("/api/portal/orders", body);

// ── Warehouse ─────────────────────────────────────────────────────────────────
export const getWarehouseQueue = () => get("/api/warehouse/queue");
export const runScoring = () => post("/api/warehouse/score", {});

// ── Admin ─────────────────────────────────────────────────────────────────────
export const getAdminStats    = () => get("/api/admin/stats");
export const getChartRevenue  = () => get("/api/admin/chart/revenue");
export const getChartPayments = () => get("/api/admin/chart/payments");
export const getChartCarriers = () => get("/api/admin/chart/carriers");
export const getFilterOptions = () => get("/api/admin/filter-options");

const qs = (params) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== "") p.set(k, v);
  });
  return p.toString() ? "?" + p.toString() : "";
};

export const getAdminCustomers = (filters) =>
  get(`/api/admin/customers${qs(filters)}`);
export const getAdminCustomer = (id) => get(`/api/admin/customers/${id}`);

export const getAdminOrders = (filters) =>
  get(`/api/admin/orders${qs(filters)}`);
export const getAdminOrder = (id) => get(`/api/admin/orders/${id}`);

export const getAdminProducts = (filters) =>
  get(`/api/admin/products${qs(filters)}`);
export const getAdminProduct = (id) => get(`/api/admin/products/${id}`);

export const getAdminShipments = (filters) =>
  get(`/api/admin/shipments${qs(filters)}`);

export const getAdminReviews = (filters) =>
  get(`/api/admin/reviews${qs(filters)}`);
