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
  Plus,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { getCurrentUser, logoutUser, getSession } from '../lib/supabase';

const adminNavigation = [
  // Sección 1: Gestión de Inventario
  {
    section: 'Gestión de Inventario',
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
      { name: 'Departamentos', href: '/departamentos', icon: FolderOpen },
      { name: 'Productos', href: '/productos', icon: Package },
    ]
  },
  // Sección 2: Operaciones
  {
    section: 'Operaciones',
    items: [
      { name: 'Facturación', href: '/facturacion', icon: FileText },
      { name: 'Devoluciones', href: '/devoluciones', icon: RotateCcw },
      { name: 'Clientes', href: '/clientes', icon: Users },
      { name: 'Movimientos', href: '/movimientos', icon: ArrowRightLeft },
    ]
  },
  // Sección 3: Finanzas y Reportes
  {
    section: 'Finanzas y Reportes',
    items: [
      { name: 'Gastos', href: '/gastos', icon: Receipt },
      { name: 'Cierres', href: '/cierres', icon: DoorOpen },
      { name: 'Reportes', href: '/reportes', icon: BarChart3 },
    ]
  }
];

const sellerNavigation = [
  // Sección 1: Ventas
  {
    section: 'Ventas',
    items: [
      { name: 'Facturación', href: '/facturacion', icon: FileText },
      { name: 'Devoluciones', href: '/devoluciones', icon: RotateCcw },
      { name: 'Clientes', href: '/clientes', icon: Users },
    ]
  },
  // Sección 2: Consultas
  {
    section: 'Consultas',
    items: [
      { name: 'Cierres', href: '/cierres', icon: DoorOpen },
    ]
  }
];

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  
  const currentUser = getCurrentUser();
  const session = getSession();
  const companyName = session?.company === 'celumundo' ? 'CELUMUNDO VIP' : 'REPUESTOS VIP';
  
  // Estado para controlar qué secciones están abiertas/cerradas
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('nav-sections-state');
    if (saved) {
      return JSON.parse(saved);
    }
    // Por defecto, todas las secciones abiertas
    return {};
  });

  // Función para toggle de secciones
  const toggleSection = (sectionName: string) => {
    setOpenSections(prev => {
      const newState = {
        ...prev,
        [sectionName]: !prev[sectionName]
      };
      localStorage.setItem('nav-sections-state', JSON.stringify(newState));
      return newState;
    });
  };

  // Función para verificar si una sección está abierta (por defecto true)
  const isSectionOpen = (sectionName: string) => {
    return openSections[sectionName] !== false;
  };
  
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
            <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
              {navigation.map((section, sectionIndex) => {
                const isOpen = isSectionOpen(section.section);
                return (
                  <div key={section.section}>
                    {/* Título de la sección con botón toggle */}
                    <button
                      onClick={() => toggleSection(section.section)}
                      className="w-full flex items-center gap-2 mb-3 hover:opacity-80 transition-opacity group"
                    >
                      <div className="h-px flex-1 bg-green-800/30 group-hover:bg-green-700/40 transition-colors"></div>
                      <h3 className="text-xs font-semibold text-green-400/80 uppercase tracking-wider px-2 flex items-center gap-2">
                        {section.section}
                        {isOpen ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </h3>
                      <div className="h-px flex-1 bg-green-800/30 group-hover:bg-green-700/40 transition-colors"></div>
                    </button>
                    
                    {/* Items de la sección con animación de colapso */}
                    <div 
                      className={`overflow-hidden transition-all duration-300 ease-in-out ${
                        isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
                      }`}
                    >
                      <div className="space-y-1 mb-4">
                        {section.items.map((item) => {
                          const isActive = location.pathname === item.href;
                          return (
                            <Link
                              key={item.name}
                              to={item.href}
                              onClick={() => setSidebarOpen(false)}
                              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                                isActive
                                  ? 'bg-green-600 text-white shadow-lg'
                                  : 'text-green-100 hover:bg-green-900/50 hover:text-white'
                              }`}
                            >
                              <item.icon className="h-5 w-5" />
                              <span className="text-sm">{item.name}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* Separador entre secciones (excepto después de la última) */}
                    {sectionIndex < navigation.length - 1 && (
                      <div className="h-px bg-green-800/20 my-4"></div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Sidebar para desktop */}
      <div className="hidden lg:flex lg:flex-col lg:w-64 bg-[#0a1810] dark:bg-[#050c08]">
        <div className="flex items-center justify-center h-16 border-b border-green-800/30 px-4">
          <h1 className="text-xl font-bold text-white">{companyName}</h1>
        </div>
        <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
          {navigation.map((section, sectionIndex) => {
            const isOpen = isSectionOpen(section.section);
            return (
              <div key={section.section}>
                {/* Título de la sección con botón toggle */}
                <button
                  onClick={() => toggleSection(section.section)}
                  className="w-full flex items-center gap-2 mb-3 hover:opacity-80 transition-opacity group"
                >
                  <div className="h-px flex-1 bg-green-800/30 group-hover:bg-green-700/40 transition-colors"></div>
                  <h3 className="text-xs font-semibold text-green-400/80 uppercase tracking-wider px-2 flex items-center gap-2">
                    {section.section}
                    {isOpen ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </h3>
                  <div className="h-px flex-1 bg-green-800/30 group-hover:bg-green-700/40 transition-colors"></div>
                </button>
                
                {/* Items de la sección con animación de colapso */}
                <div 
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="space-y-1 mb-4">
                    {section.items.map((item) => {
                      const isActive = location.pathname === item.href;
                      return (
                        <Link
                          key={item.name}
                          to={item.href}
                          className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                            isActive
                              ? 'bg-green-600 text-white shadow-lg'
                              : 'text-green-100 hover:bg-green-900/50 hover:text-white'
                          }`}
                        >
                          <item.icon className="h-5 w-5" />
                          <span className="text-sm">{item.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
                
                {/* Separador entre secciones (excepto después de la última) */}
                {sectionIndex < navigation.length - 1 && (
                  <div className="h-px bg-green-800/20 my-4"></div>
                )}
              </div>
            );
          })}
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
            <div className="hidden md:block text-sm text-muted-foreground">
              {new Date().toLocaleDateString('es-ES', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 text-red-500 hover:text-red-400 hover:bg-red-900/10 border border-red-900/30 hover:border-red-700/50"
              title="Cerrar sesión"
            >
              <LogOut className="h-5 w-5" />
              <span className="hidden lg:inline text-sm font-medium">Cerrar sesión</span>
            </button>
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
        className="fixed bottom-4 left-4 lg:bottom-6 lg:left-6 z-50 p-3 lg:p-4 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-lg transition-all duration-300 hover:scale-110"
        aria-label="Toggle theme"
      >
        {isDark ? <Sun className="h-5 w-5 lg:h-6 lg:w-6" /> : <Moon className="h-5 w-5 lg:h-6 lg:w-6" />}
      </button>

      {/* Botón flotante de Nueva Factura (para todos los usuarios) - arriba del botón de config */}
      <button
        onClick={() => {
          // Si estamos en la página de facturación, disparar evento para abrir el modal
          if (location.pathname === '/facturacion') {
            window.dispatchEvent(new CustomEvent('openCreateInvoiceDialog'));
          } else {
            // Si no estamos en facturación, navegar primero y luego abrir el modal
            navigate('/facturacion');
            // Esperar un poco para que se monte el componente y luego disparar el evento
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('openCreateInvoiceDialog'));
            }, 100);
          }
        }}
        className="fixed bottom-20 right-4 lg:bottom-24 lg:right-6 z-50 p-3 lg:p-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-full shadow-xl transition-all duration-300 hover:scale-110 hover:shadow-2xl group"
        aria-label="Nueva Factura"
        title="Crear Nueva Factura"
      >
        <div className="relative">
          <FileText className="h-5 w-5 lg:h-6 lg:w-6" />
          <Plus className="h-2.5 w-2.5 lg:h-3 lg:w-3 absolute -top-1 -right-1 bg-blue-500 rounded-full p-0.5 group-hover:rotate-90 transition-transform duration-300" />
        </div>
      </button>

      {/* Botón flotante de Configuración (solo para Admin) - esquina inferior derecha */}
      {currentUser?.role === 'admin' && (
        <button
          onClick={() => navigate('/configuracion')}
          className="fixed bottom-4 right-4 lg:bottom-6 lg:right-6 z-50 p-3 lg:p-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-full shadow-xl transition-all duration-300 hover:scale-110 hover:shadow-2xl group"
          aria-label="Configuración"
          title="Configuración de Credenciales"
        >
          <SettingsIcon className="h-5 w-5 lg:h-6 lg:w-6 group-hover:rotate-90 transition-transform duration-300" />
        </button>
      )}
    </div>
  );
}