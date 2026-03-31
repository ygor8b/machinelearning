import { Link, useLocation } from "react-router-dom";
import { useCustomer } from "../context/CustomerContext";

export default function Navbar() {
  const { customer, clear } = useCustomer();
  const { pathname } = useLocation();
  const active = (path) => pathname === path || pathname.startsWith(path + "/") ? "active" : "";

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark px-3">
      <Link className="navbar-brand fw-bold" to="/">
        Shop Admin
      </Link>

      <button
        className="navbar-toggler"
        type="button"
        data-bs-toggle="collapse"
        data-bs-target="#navbarContent"
      >
        <span className="navbar-toggler-icon" />
      </button>

      <div className="collapse navbar-collapse" id="navbarContent">
        <ul className="navbar-nav me-auto">
          {/* Customer portal links — only shown when a customer is selected */}
          {customer && (
            <>
              <li className="nav-item">
                <span className="nav-link text-secondary small">Customer Portal:</span>
              </li>
              <li className="nav-item">
                <Link className={`nav-link ${active("/dashboard")}`} to="/dashboard">
                  Dashboard
                </Link>
              </li>
              <li className="nav-item">
                <Link className={`nav-link ${active("/orders/new")}`} to="/orders/new">
                  New Order
                </Link>
              </li>
              <li className="nav-item">
                <Link className={`nav-link ${active("/my-orders")}`} to="/my-orders">
                  Order History
                </Link>
              </li>
            </>
          )}

          {/* Separator */}
          <li className="nav-item">
            <span className="nav-link text-secondary small">Warehouse:</span>
          </li>
          <li className="nav-item">
            <Link className={`nav-link ${active("/warehouse")}`} to="/warehouse">
              Priority Queue
            </Link>
          </li>

          <li className="nav-item">
            <span className="nav-link text-secondary small">Admin:</span>
          </li>
          <li className="nav-item">
            <Link className={`nav-link ${active("/admin") && pathname === "/admin" ? "active" : ""}`} to="/admin">
              Overview
            </Link>
          </li>
          <li className="nav-item">
            <Link className={`nav-link ${active("/admin/customers")}`} to="/admin/customers">
              Customers
            </Link>
          </li>
          <li className="nav-item">
            <Link className={`nav-link ${active("/admin/orders")}`} to="/admin/orders">
              Orders
            </Link>
          </li>
          <li className="nav-item">
            <Link className={`nav-link ${active("/admin/products")}`} to="/admin/products">
              Products
            </Link>
          </li>
          <li className="nav-item">
            <Link className={`nav-link ${active("/admin/shipments")}`} to="/admin/shipments">
              Shipments
            </Link>
          </li>
          <li className="nav-item">
            <Link className={`nav-link ${active("/admin/reviews")}`} to="/admin/reviews">
              Reviews
            </Link>
          </li>
        </ul>

        {/* Customer badge / switch */}
        <div className="d-flex align-items-center gap-2">
          {customer ? (
            <>
              <span className="text-light small">
                Viewing as: <strong>{customer.full_name}</strong>
              </span>
              <Link className="btn btn-sm btn-outline-light" to="/" onClick={clear}>
                Switch
              </Link>
            </>
          ) : (
            <Link className="btn btn-sm btn-outline-warning" to="/">
              Select Customer
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
