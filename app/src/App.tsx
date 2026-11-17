import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { OwnerLayout } from './components/OwnerLayout';
import AccountPage from './pages/AccountPage';
import CheckoutPage from './pages/CheckoutPage';
import DetailPage from './pages/DetailPage';
import ExplorePage from './pages/ExplorePage';
import GateLoginPage from './pages/GateLoginPage';
import GateScanPage from './pages/GateScanPage';
import JelajahPage from './pages/JelajahPage';
import LoginPage from './pages/LoginPage';
import MapPage from './pages/MapPage';
import MitraApplyPage from './pages/MitraApplyPage';
import MitraDashboardPage from './pages/MitraDashboardPage';
import TicketsPage from './pages/TicketsPage';
import { AuthProvider } from './store/authStore';
import { BookingProvider } from './store/bookingStore';

export default function App() {
  return (
    <AuthProvider>
      <BookingProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/gate/login" element={<GateLoginPage />} />
            <Route path="/gate/scan" element={<GateScanPage />} />
            <Route element={<AppLayout />}>
              <Route index element={<Navigate to="/explore" replace />} />
              <Route path="/explore" element={<ExplorePage />} />
              <Route path="/jelajah" element={<JelajahPage />} />
              <Route path="/peta" element={<MapPage />} />
              <Route path="/destinasi/:id" element={<DetailPage />} />
              <Route path="/checkout/:invoiceId" element={<CheckoutPage />} />
              <Route path="/tiket" element={<TicketsPage />} />
              <Route path="/tiket/:ticketCode" element={<TicketsPage />} />
              <Route path="/akun" element={<AccountPage />} />
              <Route path="/jadi-mitra" element={<MitraApplyPage />} />
              <Route path="*" element={<Navigate to="/explore" replace />} />
            </Route>
            <Route element={<OwnerLayout />}>
              <Route path="/mitra" element={<MitraDashboardPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </BookingProvider>
    </AuthProvider>
  );
}
