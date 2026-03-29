import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { 
  LayoutDashboard, 
  Package, 
  FileText, 
  ArrowRightLeft, 
  BarChart3,
  Receipt,
  Menu,
  X,
  Moon,
  Sun,
  DoorOpen,
  LogOut,
  Building2,
  FolderOpen,
  RotateCcw,
  Users,
  Settings as SettingsIcon,
  Plus
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { getCurrentUser, logoutUser, getSession } from '../lib/supabase';

const adminNavigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Departamentos', href: '/departamentos', icon: FolderOpen },
  { name: 'Productos', href: '/productos', icon: Package },
  { name: 'Facturación', href: '/facturacion', icon: FileText },
  { name: 'Devoluciones', href: '/devoluciones', icon: RotateCcw },
  { name: 'Clientes', href: '/clientes', icon: Users },
  { name: 'Movimientos', href: '/movimientos', icon: ArrowRightLeft },
  { name: 'Gastos', href: '/gastos', icon: Receipt },
  { name: 'Cierres', href: '/cierres', icon: DoorOpen },
  { name: 'Reportes', href: '/reportes', icon: BarChart3 },
];

const sellerNavigation = [
  { name: 'Facturación', href: '/facturacion', icon: FileText },
  { name: 'Devoluciones', href: '/devoluciones', icon: RotateCcw },
  { name: 'Clientes', href: '/clientes', icon: Users },
  { name: 'Movimientos', href: '/movimientos', icon: ArrowRightLeft },
  { name: 'Cierres', href: '/cierres', icon: DoorOpen },
];

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  
  const currentUser = getCurrentUser();
  const session = getSession();
  const companyName = session?.company === 'celumundo' ? 'CELUMUNDO VIP' : 'REPUESTOS VIP';
  
  // Redirigir a login si no hay usuario
  useEffect(() => {
    if (!currentUser) {
      navigate('/login', { replace: true });
    }
  }, [currentUser, navigate]);

  const navigation = currentUser?.role === 'admin' ? adminNavigation : sellerNavigation;

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
    }
  };

  const handleLogout = () => {
    logoutUser();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar para móvil */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-[#0a1810] dark:bg-[#050c08]">
            <div className="flex items-center justify-between p-4 border-b border-green-800/30">
              <h1 className="text-xl font-bold text-white">{companyName}</h1>
              <button 
                onClick={() => setSidebarOpen(false)}
                className="text-green-300 hover:text-white"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <nav className="p-4 space-y-2">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-green-600 text-white'
                        : 'text-green-100 hover:bg-green-900/50 hover:text-white'
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-red-500 hover:bg-red-900/50 hover:text-white"
              >
                <LogOut className="h-5 w-5" />
                <span>Cerrar sesión</span>
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* Sidebar para desktop */}
      <div className="hidden lg:flex lg:flex-col lg:w-64 bg-[#0a1810] dark:bg-[#050c08]">
        <div className="flex items-center justify-center h-16 border-b border-green-800/30 px-4">
          <h1 className="text-xl font-bold text-white">{companyName}</h1>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-green-600 text-white'
                    : 'text-green-100 hover:bg-green-900/50 hover:text-white'
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-red-500 hover:bg-red-900/50 hover:text-white"
          >
            <LogOut className="h-5 w-5" />
            <span>Cerrar sesión</span>
          </button>
        </nav>
      </div>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:px-6">
          <button
            className="lg:hidden text-foreground"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1 flex items-center justify-end gap-4">
            <div className="text-sm">
              <span className="text-muted-foreground">Usuario: </span>
              <span className="font-medium text-green-600 dark:text-green-400">
                {currentUser?.username} ({currentUser?.role === 'admin' ? 'Administrador' : 'Vendedor'})
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString('es-ES', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
          </div>
        </header>

        {/* Contenido */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      {/* Botón de tema fijo en esquina inferior izquierda */}
      <button
        onClick={toggleTheme}
        className="fixed bottom-6 left-6 z-50 p-4 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-lg transition-all duration-300 hover:scale-110"
        aria-label="Toggle theme"
      >
        {isDark ? <Sun className="h-6 w-6" /> : <Moon className="h-6 w-6" />}
      </button>

      {/* Botón flotante de Nueva Factura (para todos los usuarios) - arriba del botón de config */}
      <button
        onClick={() => navigate('/facturacion')}
        className="fixed bottom-24 right-6 z-50 p-5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-full shadow-xl transition-all duration-300 hover:scale-110 hover:shadow-2xl group"
        aria-label="Nueva Factura"
        title="Crear Nueva Factura"
      >
        <div className="relative">
          <FileText className="h-7 w-7" />
          <Plus className="h-4 w-4 absolute -top-1 -right-1 bg-blue-500 rounded-full p-0.5 group-hover:rotate-90 transition-transform duration-300" />
        </div>
      </button>

      {/* Botón flotante de Configuración (solo para Admin) - esquina inferior derecha */}
      {currentUser?.role === 'admin' && (
        <button
          onClick={() => navigate('/configuracion')}
          className="fixed bottom-6 right-6 z-50 p-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-full shadow-xl transition-all duration-300 hover:scale-110 hover:shadow-2xl group"
          aria-label="Configuración"
          title="Configuración de Credenciales"
        >
          <SettingsIcon className="h-6 w-6 group-hover:rotate-90 transition-transform duration-300" />
        </button>
      )}
    </div>
  );
}