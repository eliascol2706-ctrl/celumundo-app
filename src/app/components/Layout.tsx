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
  Plus,
  ChevronDown,
  ChevronUp,
  Search,
  Settings,
  Eye,
  EyeOff
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { getCurrentUser, logoutUser, getSession, getProducts, type Product, getUsersFromDB, updateUserCredentials, checkUsernameExists, saveSession } from '../lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { formatCOP } from '../lib/currency';

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
  
  // Estados para consulta de producto (solo para seller)
  const [productSearchDialogOpen, setProductSearchDialogOpen] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Estados para configuración (solo para admin)
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [sellerUsername, setSellerUsername] = useState("");
  const [sellerPassword, setSellerPassword] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [showSellerPassword, setShowSellerPassword] = useState(false);

  // Cargar productos cuando se abre el diálogo
  useEffect(() => {
    if (productSearchDialogOpen && currentUser?.role === 'seller') {
      loadProducts();
      // Enfocar el input cuando se abre el diálogo
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 100);
    }
  }, [productSearchDialogOpen, currentUser]);

  // Cargar usuarios cuando se abre el diálogo de configuración
  useEffect(() => {
    if (settingsDialogOpen && currentUser?.role === 'admin' && session) {
      loadUsers();
    }
  }, [settingsDialogOpen]);

  const loadUsers = async () => {
    if (!session) return;
    const users = await getUsersFromDB(session.company);

    const admin = users.find(u => u.role === 'admin');
    const seller = users.find(u => u.role === 'seller');

    setAdminUsername(admin?.username || '');
    setAdminPassword(admin?.password || '');
    setSellerUsername(seller?.username || '');
    setSellerPassword(seller?.password || '');
  };

  const handleSaveSettings = async () => {
    if (!session || !currentUser) return;

    setIsSavingSettings(true);

    try {
      const users = await getUsersFromDB(session.company);
      const admin = users.find(u => u.role === 'admin');
      const seller = users.find(u => u.role === 'seller');

      // Validar que los nombres de usuario no estén vacíos
      if (!adminUsername.trim()) {
        alert('El nombre de usuario del administrador no puede estar vacío');
        setIsSavingSettings(false);
        return;
      }

      if (!sellerUsername.trim()) {
        alert('El nombre de usuario del vendedor no puede estar vacío');
        setIsSavingSettings(false);
        return;
      }

      // Validar que las contraseñas no estén vacías
      if (!adminPassword.trim()) {
        alert('La contraseña del administrador no puede estar vacía');
        setIsSavingSettings(false);
        return;
      }

      if (!sellerPassword.trim()) {
        alert('La contraseña del vendedor no puede estar vacía');
        setIsSavingSettings(false);
        return;
      }

      // Verificar si el nuevo username del admin ya existe (excluyendo el admin actual)
      if (admin && adminUsername !== admin.username) {
        const usernameExists = await checkUsernameExists(adminUsername, session.company, admin.id);
        if (usernameExists) {
          alert('El nombre de usuario del administrador ya existe. Por favor elige otro.');
          setIsSavingSettings(false);
          return;
        }
      }

      // Verificar si el nuevo username del seller ya existe (excluyendo el seller actual)
      if (seller && sellerUsername !== seller.username) {
        const usernameExists = await checkUsernameExists(sellerUsername, session.company, seller.id);
        if (usernameExists) {
          alert('El nombre de usuario del vendedor ya existe. Por favor elige otro.');
          setIsSavingSettings(false);
          return;
        }
      }

      // Actualizar credenciales del admin
      if (admin) {
        const adminSuccess = await updateUserCredentials(admin.id, {
          username: adminUsername,
          password: adminPassword
        });

        if (!adminSuccess) {
          alert('Error al actualizar las credenciales del administrador');
          setIsSavingSettings(false);
          return;
        }
      }

      // Actualizar credenciales del seller
      if (seller) {
        const sellerSuccess = await updateUserCredentials(seller.id, {
          username: sellerUsername,
          password: sellerPassword
        });

        if (!sellerSuccess) {
          alert('Error al actualizar las credenciales del vendedor');
          setIsSavingSettings(false);
          return;
        }
      }

      // Si el admin cambió su propio username, actualizar la sesión
      if (admin && currentUser.id === admin.id && adminUsername !== admin.username) {
        const updatedUser = { ...currentUser, username: adminUsername };
        saveSession({ user: updatedUser, company: session.company });
      }

      alert('✅ Configuración guardada exitosamente');
      setSettingsDialogOpen(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Error al guardar la configuración');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const loadProducts = async () => {
    const data = await getProducts();
    setProducts(data);
  };

  // Filtrar productos por código o nombre
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
    product.code.toLowerCase().includes(productSearchTerm.toLowerCase())
  );
  
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

      {/* Botón flotante de Nueva Factura (para todos los usuarios) */}
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
        className="fixed bottom-4 right-4 lg:bottom-6 lg:right-6 z-50 p-3 lg:p-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-full shadow-xl transition-all duration-300 hover:scale-110 hover:shadow-2xl group"
        aria-label="Nueva Factura"
        title="Crear Nueva Factura"
      >
        <div className="relative">
          <FileText className="h-5 w-5 lg:h-6 lg:w-6" />
          <Plus className="h-2.5 w-2.5 lg:h-3 lg:w-3 absolute -top-1 -right-1 bg-blue-500 rounded-full p-0.5 group-hover:rotate-90 transition-transform duration-300" />
        </div>
      </button>

      {/* Botón flotante de Settings (solo para admin) */}
      {currentUser?.role === 'admin' && (
        <button
          onClick={() => {
            setSettingsDialogOpen(true);
          }}
          className="fixed bottom-20 right-4 lg:bottom-24 lg:right-6 z-50 p-3 lg:p-4 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white rounded-full shadow-xl transition-all duration-300 hover:scale-110 hover:shadow-2xl"
          aria-label="Configuración"
          title="Configuración del Sistema"
        >
          <Settings className="h-5 w-5 lg:h-6 lg:w-6" />
        </button>
      )}

      {/* Botón flotante de Consultar Producto (solo para sellers) - En la posición donde estaba Settings */}
      {currentUser?.role === 'seller' && (
        <button
          onClick={() => {
            setProductSearchDialogOpen(true);
            setProductSearchTerm("");
            setSelectedProduct(null);
          }}
          className="fixed bottom-20 right-4 lg:bottom-24 lg:right-6 z-50 p-3 lg:p-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-full shadow-xl transition-all duration-300 hover:scale-110 hover:shadow-2xl"
          aria-label="Consultar Producto"
          title="Consultar Producto"
        >
          <Search className="h-5 w-5 lg:h-6 lg:w-6" />
        </button>
      )}

      {/* Diálogo de Consultar Producto (solo para sellers) */}
      {currentUser?.role === 'seller' && (
        <Dialog open={productSearchDialogOpen} onOpenChange={setProductSearchDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Consultar Producto</DialogTitle>
              <DialogDescription>
                Busca por nombre o código de barras para ver la información del producto
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Buscador con soporte para lector de código de barras */}
              <div className="space-y-2">
                <Label htmlFor="productSearch">Buscar Producto</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="productSearch"
                    ref={barcodeInputRef}
                    type="text"
                    placeholder="Escanea código de barras o escribe nombre/código..."
                    value={productSearchTerm}
                    onChange={(e) => {
                      setProductSearchTerm(e.target.value);
                      // Si hay un producto exacto, seleccionarlo automáticamente
                      const exactMatch = products.find(
                        p => p.code.toLowerCase() === e.target.value.toLowerCase()
                      );
                      if (exactMatch) {
                        setSelectedProduct(exactMatch);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && filteredProducts.length === 1) {
                        setSelectedProduct(filteredProducts[0]);
                      }
                    }}
                    className="pl-10"
                    autoFocus
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  💡 Tip: Usa el lector de código de barras para búsqueda rápida
                </p>
              </div>

              {/* Mostrar producto seleccionado */}
              {selectedProduct && (
                <div className="border-2 border-green-500 dark:border-green-600 rounded-lg p-6 bg-green-50 dark:bg-green-950/30">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-green-900 dark:text-green-100">
                        {selectedProduct.name}
                      </h3>
                      <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                        {selectedProduct.description}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedProduct(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-green-700 dark:text-green-400">Código</p>
                      <p className="text-lg font-mono font-bold text-green-900 dark:text-green-100">
                        {selectedProduct.code}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-medium text-green-700 dark:text-green-400">Stock</p>
                      <p className={`text-lg font-bold ${
                        selectedProduct.stock <= selectedProduct.min_stock
                          ? 'text-red-600'
                          : selectedProduct.stock <= 10
                          ? 'text-yellow-600'
                          : 'text-green-600'
                      }`}>
                        {selectedProduct.stock} unidades
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-medium text-green-700 dark:text-green-400">Categoría</p>
                      <p className="text-sm font-semibold text-green-900 dark:text-green-100">
                        {selectedProduct.category}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-medium text-green-700 dark:text-green-400">Stock Mínimo</p>
                      <p className="text-sm font-semibold text-green-900 dark:text-green-100">
                        {selectedProduct.min_stock} unidades
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-green-200 dark:border-green-800">
                    <h4 className="font-semibold text-green-900 dark:text-green-100 mb-3">Precios de Venta</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-green-200 dark:border-green-800">
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Precio 1</p>
                        <p className="text-2xl font-bold text-green-600">
                          {formatCOP(selectedProduct.price1)}
                        </p>
                        {selectedProduct.margin1 && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Margen: {selectedProduct.margin1.toFixed(1)}%
                          </p>
                        )}
                      </div>

                      <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-green-200 dark:border-green-800">
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Precio 2</p>
                        <p className="text-2xl font-bold text-green-600">
                          {formatCOP(selectedProduct.price2)}
                        </p>
                        {selectedProduct.margin2 && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Margen: {selectedProduct.margin2.toFixed(1)}%
                          </p>
                        )}
                      </div>

                      <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border-2 border-green-500 dark:border-green-600">
                        <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">💰 Precio Final</p>
                        <p className="text-2xl font-bold text-green-600">
                          {formatCOP(selectedProduct.final_price)}
                        </p>
                        {selectedProduct.margin_final && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Margen: {selectedProduct.margin_final.toFixed(1)}%
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-800">
                    <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">Información de Costos</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Costo Actual</p>
                        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {formatCOP(selectedProduct.current_cost)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Costo Anterior</p>
                        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {formatCOP(selectedProduct.old_cost)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {selectedProduct.use_unit_ids && (
                    <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                        <Package className="h-5 w-5" />
                        <span className="font-semibold">Este producto usa IDs únicas por unidad</span>
                      </div>
                      {selectedProduct.registered_ids && selectedProduct.registered_ids.length > 0 && (
                        <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                          Total de IDs registradas: {selectedProduct.registered_ids.length}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Lista de productos si no hay selección */}
              {!selectedProduct && productSearchTerm && (
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="max-h-[400px] overflow-y-auto">
                    {filteredProducts.length > 0 ? (
                      <div className="divide-y divide-border">
                        {filteredProducts.slice(0, 10).map((product) => (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => setSelectedProduct(product)}
                            className="w-full p-4 text-left hover:bg-muted transition-colors flex items-center justify-between gap-4"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="font-mono font-bold text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                  {product.code}
                                </span>
                                {product.use_unit_ids && (
                                  <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                                    🔢 IDs
                                  </span>
                                )}
                              </div>
                              <p className="font-medium text-base truncate">{product.name}</p>
                              <p className="text-sm text-muted-foreground truncate">{product.description}</p>
                            </div>

                            <div className="flex items-center gap-6">
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">Stock</p>
                                <p className={`font-bold text-lg ${
                                  product.stock <= 5
                                    ? "text-red-600"
                                    : product.stock <= 10
                                    ? "text-yellow-600"
                                    : "text-green-600"
                                }`}>
                                  {product.stock}
                                </p>
                              </div>

                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">Precio</p>
                                <p className="font-bold text-lg text-green-600">
                                  {formatCOP(product.final_price)}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="py-12 text-center">
                        <p className="text-muted-foreground">No se encontraron productos</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Intenta con otro término de búsqueda
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!selectedProduct && !productSearchTerm && (
                <div className="text-center py-12">
                  <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-muted-foreground">Escribe o escanea un código para buscar</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Diálogo de Configuración (solo para admin) */}
      {currentUser?.role === 'admin' && (
        <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configuración del Sistema
              </DialogTitle>
              <DialogDescription>
                Administra las credenciales de los usuarios de {companyName}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Sección de Administrador */}
              <div className="border border-green-200 dark:border-green-800 rounded-lg p-6 bg-green-50 dark:bg-green-950/30">
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="h-5 w-5 text-green-600" />
                  <h3 className="text-lg font-bold text-green-900 dark:text-green-100">
                    Credenciales de Administrador
                  </h3>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="adminUsername">Nombre de Usuario</Label>
                    <input
                      id="adminUsername"
                      type="text"
                      placeholder="admin1"
                      value={adminUsername}
                      onChange={(e) => {
                        console.log('Admin username changed:', e.target.value);
                        setAdminUsername(e.target.value);
                      }}
                      disabled={isSavingSettings}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="adminPassword">Contraseña</Label>
                    <div className="relative">
                      <input
                        id="adminPassword"
                        type={showAdminPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={adminPassword}
                        onChange={(e) => {
                          console.log('Admin password changed:', e.target.value);
                          setAdminPassword(e.target.value);
                        }}
                        disabled={isSavingSettings}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminPassword(!showAdminPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        tabIndex={-1}
                      >
                        {showAdminPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sección de Vendedor */}
              <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-6 bg-blue-50 dark:bg-blue-950/30">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100">
                    Credenciales de Vendedor
                  </h3>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="sellerUsername">Nombre de Usuario</Label>
                    <input
                      id="sellerUsername"
                      type="text"
                      placeholder="seller1"
                      value={sellerUsername}
                      onChange={(e) => setSellerUsername(e.target.value)}
                      disabled={isSavingSettings}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sellerPassword">Contraseña</Label>
                    <div className="relative">
                      <input
                        id="sellerPassword"
                        type={showSellerPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={sellerPassword}
                        onChange={(e) => setSellerPassword(e.target.value)}
                        disabled={isSavingSettings}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSellerPassword(!showSellerPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        tabIndex={-1}
                      >
                        {showSellerPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Nota informativa */}
              <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="text-yellow-600 dark:text-yellow-400 mt-0.5">ℹ️</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100 mb-1">
                      Información Importante
                    </p>
                    <ul className="text-xs text-yellow-800 dark:text-yellow-200 space-y-1 list-disc list-inside">
                      <li>Los cambios solo afectan a {companyName}</li>
                      <li>Todas las credenciales deben tener al menos 1 carácter</li>
                      <li>Los nombres de usuario deben ser únicos</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSettingsDialogOpen(false);
                    // Resetear campos al cerrar
                    setAdminUsername('');
                    setAdminPassword('');
                    setSellerUsername('');
                    setSellerPassword('');
                  }}
                  disabled={isSavingSettings}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {isSavingSettings ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
