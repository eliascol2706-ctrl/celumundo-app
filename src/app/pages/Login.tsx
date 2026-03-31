import { useState } from 'react';
import { useNavigate } from 'react-router';
import { LogIn, Building2, Search } from 'lucide-react';
import { saveSession, type User, type Session, getProducts, type Product, authenticateUser } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { toast } from 'sonner';
import { formatCOP } from '../lib/currency';

export function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState<'celumundo' | 'repuestos'>('celumundo');
  const [isLoading, setIsLoading] = useState(false);
  
  // Estados para el diálogo de consulta
  const [isConsultDialogOpen, setIsConsultDialogOpen] = useState(false);
  const [consultCompany, setConsultCompany] = useState<'celumundo' | 'repuestos'>('celumundo');
  const [searchQuery, setSearchQuery] = useState('');
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleConsultClick = async () => {
    setIsConsultDialogOpen(true);
    setIsSearching(true);
    try {
      const products = await getProducts();
      setAllProducts(products);
      setFilteredProducts([]);
    } catch (error) {
      toast.error('Error al cargar productos');
      console.error('Error loading products:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setFilteredProducts([]);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const results = allProducts.filter(
      (product) =>
        product.company === consultCompany &&
        (product.code.toLowerCase().includes(query) ||
          product.name.toLowerCase().includes(query))
    );
    setFilteredProducts(results);

    if (results.length === 0) {
      toast.info('No se encontraron productos');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const user = await authenticateUser(username, password, company);

      if (user) {
        const session: Session = {
          user,
          company,
        };
        saveSession(session);
        
        const companyName = company === 'celumundo' ? 'CELUMUNDO VIP' : 'REPUESTOS VIP';
        toast.success(`¡Bienvenido a ${companyName}!`, {
          description: `Usuario: ${user.role === 'admin' ? 'Administrador' : 'Vendedor'}`,
        });
        navigate('/');
      } else {
        toast.error('Usuario o contraseña incorrectos para esta empresa');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Error al iniciar sesión. Verifica tu conexión.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 dark:from-green-950 dark:via-background dark:to-green-950 flex items-center justify-center p-4 relative">
      {/* Botón Consultar en la esquina superior */}
      <Button
        onClick={handleConsultClick}
        className="absolute top-4 right-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 animate-fade-in"
      >
        <Search className="h-4 w-4 mr-2" />
        Consultar
      </Button>

      <Card className="w-full max-w-md shadow-2xl border-green-200 dark:border-green-800 animate-scale-in">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 h-20 w-20 bg-gradient-to-br from-green-600 to-green-700 rounded-full flex items-center justify-center shadow-lg">
            <LogIn className="h-10 w-10 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-green-600 to-green-700 bg-clip-text text-transparent">GESTION Y MANEJO</CardTitle>
          <p className="text-muted-foreground mt-2">CELUMUNDO VIP&nbsp;&nbsp;&nbsp;</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="company" className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-green-600" />
                Seleccionar Empresa
              </Label>
              <Select value={company} onValueChange={(value: 'celumundo' | 'repuestos') => setCompany(value)}>
                <SelectTrigger className="border-green-200 dark:border-green-800 focus:border-green-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="celumundo">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                      <span className="font-medium">CELUMUNDO VIP</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="repuestos">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-orange-500"></div>
                      <span className="font-medium">REPUESTOS VIP</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Usuario</Label>
              <Input
                id="username"
                type="text"
                placeholder="Ingresa tu usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                className="border-green-200 dark:border-green-800 focus:border-green-600"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="Ingresa tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="border-green-200 dark:border-green-800 focus:border-green-600"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800" 
              disabled={isLoading}
            >
              {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-xs text-muted-foreground">
              Empresa seleccionada: <strong className={company === 'celumundo' ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}>
                {company === 'celumundo' ? 'CELUMUNDO VIP' : 'REPUESTOS VIP'}
              </strong>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Diálogo de consulta */}
      <Dialog open={isConsultDialogOpen} onOpenChange={setIsConsultDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Consultar Productos</DialogTitle>
            <DialogDescription>
              Busca productos en la empresa seleccionada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="consultCompany" className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-green-600" />
                Seleccionar Empresa
              </Label>
              <Select value={consultCompany} onValueChange={(value: 'celumundo' | 'repuestos') => setConsultCompany(value)}>
                <SelectTrigger className="border-green-200 dark:border-green-800 focus:border-green-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="celumundo">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                      <span className="font-medium">CELUMUNDO VIP</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="repuestos">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-orange-500"></div>
                      <span className="font-medium">REPUESTOS VIP</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="searchQuery">Buscar</Label>
              <Input
                id="searchQuery"
                type="text"
                placeholder="Código o nombre del producto"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                required
                className="border-green-200 dark:border-green-800 focus:border-green-600"
              />
            </div>

            <Button 
              type="button" 
              className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800" 
              disabled={isSearching}
              onClick={handleSearch}
            >
              {isSearching ? 'Buscando...' : 'Buscar'}
            </Button>

            <div className="mt-4">
              {filteredProducts.length > 0 && (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {filteredProducts.map(product => (
                    <div key={product.id} className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800 hover:shadow-md transition-all duration-200">
                      <p className="text-sm font-mono font-bold text-green-700 dark:text-green-400">Código: {product.code}</p>
                      <p className="text-base font-semibold mt-1">{product.name}</p>
                      <p className="text-sm text-muted-foreground">{product.description}</p>
                      <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-700">
                        <p className="text-sm text-muted-foreground">Precio Final: <span className="font-bold text-green-600 dark:text-green-400">{formatCOP(product.final_price)}</span></p>
                        <p className="text-sm text-muted-foreground">Stock disponible: <span className="font-medium">{product.stock}</span></p>
                        <p className="text-sm text-muted-foreground">Categoría: <span className="font-medium">{product.category}</span></p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
