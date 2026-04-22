import * as React from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { getCurrentUser } from './lib/supabase';

// Imports críticos (siempre cargados)
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';

// Lazy loading para componentes pesados
const Products = React.lazy(() => import('./pages/Products').then(m => ({ default: m.Products })));
const InvoicesMenu = React.lazy(() => import('./pages/InvoicesMenu').then(m => ({ default: m.InvoicesMenu })));
const RegularInvoice = React.lazy(() => import('./pages/RegularInvoice').then(m => ({ default: m.RegularInvoice })));
const CreditInvoice = React.lazy(() => import('./pages/CreditInvoice').then(m => ({ default: m.CreditInvoice })));
const FinancialManagement = React.lazy(() => import('./pages/FinancialManagement').then(m => ({ default: m.FinancialManagement })));
const Movements = React.lazy(() => import('./pages/Movements').then(m => ({ default: m.Movements })));
const Expenses = React.lazy(() => import('./pages/Expenses').then(m => ({ default: m.Expenses })));
const Reports = React.lazy(() => import('./pages/Reports').then(m => ({ default: m.Reports })));
const Closures = React.lazy(() => import('./pages/Closures').then(m => ({ default: m.Closures })));
const Departments = React.lazy(() => import('./pages/Departments').then(m => ({ default: m.Departments })));
const Returns = React.lazy(() => import('./pages/Returns').then(m => ({ default: m.Returns })));
const Customers = React.lazy(() => import('./pages/Customers').then(m => ({ default: m.Customers })));
const CustomersNew = React.lazy(() => import('./pages/CustomersNew').then(m => ({ default: m.CustomersNew })));
const CustomerProfile = React.lazy(() => import('./pages/CustomerProfile').then(m => ({ default: m.CustomerProfile })));
const Exchanges = React.lazy(() => import('./pages/Exchanges'));
const Warranties = React.lazy(() => import('./pages/Warranties'));
const ServiceOrders = React.lazy(() => import('./pages/ServiceOrders'));
const TrackingPage = React.lazy(() => import('./pages/TrackingPage'));
const CatalogAdmin = React.lazy(() => import('./pages/CatalogAdmin').then(m => ({ default: m.CatalogAdmin })));
const PublicCatalog = React.lazy(() => import('./pages/PublicCatalog').then(m => ({ default: m.PublicCatalog })));

// Componente Suspense Wrapper
function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return (
    <React.Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-xl font-semibold text-gray-700">Cargando...</p>
          </div>
        </div>
      }
    >
      {children}
    </React.Suspense>
  );
}

// Componente para proteger rutas
function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const currentUser = getCurrentUser();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Si el usuario es catalog_admin y no está en una ruta permitida, redirigir a catálogo
  if (currentUser.role === 'catalog_admin' && allowedRoles && !allowedRoles.includes('catalog_admin')) {
    return <Navigate to="/catalogo" replace />;
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
    path: '/seguimiento/:trackingCode',
    Component: TrackingPage,
  },
  {
    path: '/catalogo-publico/:company',
    Component: PublicCatalog,
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
      {
        path: 'ordenes-servicio',
        element: (
          <ProtectedRoute allowedRoles={['admin', 'seller']}>
            <ServiceOrders />
          </ProtectedRoute>
        )
      },
      {
        path: 'catalogo',
        element: (
          <ProtectedRoute allowedRoles={['catalog_admin']}>
            <CatalogAdmin />
          </ProtectedRoute>
        )
      },
    ],
  },
]);