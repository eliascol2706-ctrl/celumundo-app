import * as React from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Products } from './pages/Products';
import { InvoicesMenu } from './pages/InvoicesMenu';
import { RegularInvoice } from './pages/RegularInvoice';
import { CreditInvoice } from './pages/CreditInvoice';
import { FinancialManagement } from './pages/FinancialManagement';
import { Movements } from './pages/Movements';
import { Expenses } from './pages/Expenses';
import { Reports } from './pages/Reports';
import { Closures } from './pages/Closures';
import { Departments } from './pages/Departments';
import { Returns } from './pages/Returns';
import { Customers } from './pages/Customers';
import { CustomersNew } from './pages/CustomersNew';
import { CustomerProfile } from './pages/CustomerProfile';
import Exchanges from './pages/Exchanges';
import Warranties from './pages/Warranties';
import { getCurrentUser } from './lib/supabase';

// Componente para proteger rutas
function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const currentUser = getCurrentUser();
  
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  
  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    path: '/login',
    Component: Login,
  },
  {
    path: '/',
    Component: Layout,
    children: [
      { 
        index: true, 
        element: (
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        )
      },
      { 
        path: 'productos', 
        element: (
          <ProtectedRoute allowedRoles={['admin']}>
            <Products />
          </ProtectedRoute>
        )
      },
      { 
        path: 'garantias', 
        element: (
          <ProtectedRoute allowedRoles={['admin', 'seller']}>
            <Warranties />
          </ProtectedRoute>
        )
      },
      { 
        path: 'facturacion', 
        element: (
          <ProtectedRoute allowedRoles={['admin', 'seller']}>
            <InvoicesMenu />
          </ProtectedRoute>
        )
      },
      { 
        path: 'facturacion/regular', 
        element: (
          <ProtectedRoute allowedRoles={['admin', 'seller']}>
            <RegularInvoice />
          </ProtectedRoute>
        )
      },
      { 
        path: 'facturacion/credito', 
        element: (
          <ProtectedRoute allowedRoles={['admin', 'seller']}>
            <CreditInvoice />
          </ProtectedRoute>
        )
      },
      {
        path: 'facturacion/historial',
        element: (
          <ProtectedRoute allowedRoles={['admin']}>
            <FinancialManagement />
          </ProtectedRoute>
        )
      },
      { 
        path: 'movimientos', 
        element: (
          <ProtectedRoute allowedRoles={['admin', 'seller']}>
            <Movements />
          </ProtectedRoute>
        )
      },
      { 
        path: 'gastos', 
        element: (
          <ProtectedRoute allowedRoles={['admin']}>
            <Expenses />
          </ProtectedRoute>
        )
      },
      { 
        path: 'reportes', 
        element: (
          <ProtectedRoute allowedRoles={['admin']}>
            <Reports />
          </ProtectedRoute>
        )
      },
      { 
        path: 'cierres', 
        element: (
          <ProtectedRoute allowedRoles={['admin', 'seller']}>
            <Closures />
          </ProtectedRoute>
        )
      },
      { 
        path: 'clientes', 
        element: (
          <ProtectedRoute allowedRoles={['admin', 'seller']}>
            <CustomersNew />
          </ProtectedRoute>
        )
      },
      {
        path: 'clientes/:document',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'seller']}>
            <CustomerProfile />
          </ProtectedRoute>
        )
      },
      { 
        path: 'departamentos', 
        element: (
          <ProtectedRoute allowedRoles={['admin']}>
            <Departments />
          </ProtectedRoute>
        )
      },
      { 
        path: 'devoluciones', 
        element: (
          <ProtectedRoute allowedRoles={['admin', 'seller']}>
            <Returns />
          </ProtectedRoute>
        )
      },
      { 
        path: 'cambios', 
        element: (
          <ProtectedRoute allowedRoles={['admin', 'seller']}>
            <Exchanges />
          </ProtectedRoute>
        )
      },
    ],
  },
]);