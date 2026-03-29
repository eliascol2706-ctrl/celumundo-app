import { createBrowserRouter, Navigate } from 'react-router';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Products } from './pages/Products';
import { Invoices } from './pages/Invoices';
import { Movements } from './pages/Movements';
import { Expenses } from './pages/Expenses';
import { Reports } from './pages/Reports';
import { Closures } from './pages/Closures';
import { Departments } from './pages/Departments';
import { Returns } from './pages/Returns';
import { Customers } from './pages/Customers';
import { Settings } from './pages/Settings';
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
        path: 'facturacion', 
        element: (
          <ProtectedRoute allowedRoles={['admin', 'seller']}>
            <Invoices />
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
            <Customers />
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
        path: 'configuracion', 
        element: (
          <ProtectedRoute allowedRoles={['admin']}>
            <Settings />
          </ProtectedRoute>
        )
      },
    ],
  },
]);