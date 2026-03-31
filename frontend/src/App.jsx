import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import SelectCustomer from "./pages/SelectCustomer";
import Dashboard from "./pages/Dashboard";
import NewOrder from "./pages/NewOrder";
import OrderHistory from "./pages/OrderHistory";
import WarehouseQueue from "./pages/WarehouseQueue";
import AdminDashboard from "./pages/admin/AdminDashboard";
import Customers from "./pages/admin/Customers";
import CustomerDetail from "./pages/admin/CustomerDetail";
import Orders from "./pages/admin/Orders";
import OrderDetail from "./pages/admin/OrderDetail";
import Products from "./pages/admin/Products";
import ProductDetail from "./pages/admin/ProductDetail";
import Shipments from "./pages/admin/Shipments";
import Reviews from "./pages/admin/Reviews";

export default function App() {
  return (
    <>
      <Navbar />
      <div className="container-fluid py-4">
        <Routes>
          {/* Customer portal */}
          <Route path="/" element={<SelectCustomer />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/orders/new" element={<NewOrder />} />
          <Route path="/my-orders" element={<OrderHistory />} />
          {/* Warehouse */}
          <Route path="/warehouse" element={<WarehouseQueue />} />
          {/* Admin */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/customers" element={<Customers />} />
          <Route path="/admin/customers/:id" element={<CustomerDetail />} />
          <Route path="/admin/orders" element={<Orders />} />
          <Route path="/admin/orders/:id" element={<OrderDetail />} />
          <Route path="/admin/products" element={<Products />} />
          <Route path="/admin/products/:id" element={<ProductDetail />} />
          <Route path="/admin/shipments" element={<Shipments />} />
          <Route path="/admin/reviews" element={<Reviews />} />
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </>
  );
}
