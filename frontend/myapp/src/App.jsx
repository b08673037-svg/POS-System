import { Routes, Route } from "react-router-dom";
import MainLayout from "./layouts/MainLayout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

// Protected Pages
import DashboardPage from "./pages/DashboardPage.jsx";
import CheckoutPage from "./pages/CheckoutPage.jsx";
import ProductsPage from "./pages/ProductsPage.jsx";
import CategoriesPage from "./pages/CategoriesPage.jsx";
import CustomersPage from "./pages/CustomersPage.jsx";
import SuppliersPage from "./pages/SuppliersPage.jsx";
import SalesPage from "./pages/SalesPage.jsx";
import PurchasesPage from "./pages/PurchasesPage.jsx";
import InventoryPage from "./pages/InventoryPage.jsx";
import ReportsPage from "./pages/ReportsPage.jsx";

// Public Auth Pages
import LoginPage from "./pages/auth/LoginPage.jsx";
import RegisterPage from "./pages/auth/RegisterPage.jsx";
import VerifyOtpPage from "./pages/auth/VerifyOtpPage.jsx";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage.jsx";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage.jsx";

import NotificationsPage from "./pages/NotificationsPage.jsx";

export default function App() {
  return (
    <Routes>
      {/* ---------- Public Routes ---------- */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-otp" element={<VerifyOtpPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

      {/* ---------- Protected App Shell ---------- */}
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="/sales" element={<SalesPage />} />
        <Route path="/purchases" element={<PurchasesPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
      </Route>
    </Routes>
  );
}