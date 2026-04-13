import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { LogIn, Building2, Search, BookOpen, Trash2, Upload, X, Image as ImageIcon } from 'lucide-react';
import { saveSession, type User, type Session, getProducts, type Product, authenticateUser, getCatalogProducts, addProductToCatalog, removeProductFromCatalog, updateCatalogPriceType, uploadCatalogImage, deleteCatalogImage, updateCatalogImage, type PublicCatalog } from '../lib/supabase';
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

  // Estados para el diálogo de catálogo
  const [isCatalogDialogOpen, setIsCatalogDialogOpen] = useState(false);
  const [catalogCompany, setCatalogCompany] = useState<'celumundo' | 'repuestos'>('celumundo');
  const [catalogItems, setCatalogItems] = useState<PublicCatalog[]>([]);
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('');
  const [catalogFilteredProducts, setCatalogFilteredProducts] = useState<Product[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [catalogImageFiles, setCatalogImageFiles] = useState<{[productId: string]: File}>({});
  const [catalogImagePreviews, setCatalogImagePreviews] = useState<{[productId: string]: string}>({});

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

  const handleCatalogClick = async () => {
    setIsCatalogDialogOpen(true);
    await loadCatalogItems(catalogCompany);
  };

  const loadCatalogItems = async (company: 'celumundo' | 'repuestos') => {
    setIsLoadingCatalog(true);
    try {
      const [catalogData, productsData] = await Promise.all([
        getCatalogProducts(company),
        getProducts()
      ]);
      setCatalogItems(catalogData);
      setAllProducts(productsData);
      setCatalogFilteredProducts([]);
    } catch (error) {
      toast.error('Error al cargar el catálogo');
      console.error('Error loading catalog:', error);
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  const handleCatalogSearch = () => {
    if (!catalogSearchQuery.trim()) {
      setCatalogFilteredProducts([]);
      return;
    }

    const query = catalogSearchQuery.toLowerCase().trim();
    const catalogProductIds = catalogItems.map(item => item.product_id);

    const results = allProducts.filter(
      (product) =>
        product.company === catalogCompany &&
        !catalogProductIds.includes(product.id) &&
        (product.code.toLowerCase().includes(query) ||
          product.name.toLowerCase().includes(query))
    );
    setCatalogFilteredProducts(results);

    if (results.length === 0) {
      toast.info('No se encontraron productos');
    }
  };

  const handleCatalogImageChange = (productId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar que sea una imagen
      if (!file.type.startsWith('image/')) {
        toast.error('Por favor selecciona un archivo de imagen válido');
        return;
      }

      // Validar tamaño (máx 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('La imagen no debe superar 5MB');
        return;
      }

      setCatalogImageFiles(prev => ({ ...prev, [productId]: file }));

      // Crear preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setCatalogImagePreviews(prev => ({ ...prev, [productId]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveCatalogImage = (productId: string) => {
    setCatalogImageFiles(prev => {
      const newFiles = { ...prev };
      delete newFiles[productId];
      return newFiles;
    });
    setCatalogImagePreviews(prev => {
      const newPreviews = { ...prev };
      delete newPreviews[productId];
      return newPreviews;
    });
  };

  const handleAddToCatalog = async (productId: string, priceType: 'price1' | 'price2' | 'final_price') => {
    try {
      let imageUrl: string | undefined = undefined;

      // Si hay una imagen seleccionada, subirla primero
      if (catalogImageFiles[productId]) {
        const uploadedUrl = await uploadCatalogImage(catalogImageFiles[productId], productId);
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        } else {
          toast.error('Error al subir la imagen, pero el producto se agregará al catálogo');
        }
      }

      const result = await addProductToCatalog(catalogCompany, productId, priceType, imageUrl);
      if (result) {
        toast.success('Producto agregado al catálogo');
        await loadCatalogItems(catalogCompany);
        setCatalogSearchQuery('');
        setCatalogFilteredProducts([]);
        handleRemoveCatalogImage(productId);
      } else {
        toast.error('Error al agregar producto al catálogo');
      }
    } catch (error) {
      toast.error('Error al agregar producto al catálogo');
      console.error('Error adding to catalog:', error);
    }
  };

  const handleRemoveFromCatalog = async (catalogId: string, imageUrl?: string) => {
    try {
      // Si tiene imagen, eliminarla del storage primero
      if (imageUrl) {
        await deleteCatalogImage(imageUrl);
      }

      const success = await removeProductFromCatalog(catalogId);
      if (success) {
        toast.success('Producto eliminado del catálogo');
        await loadCatalogItems(catalogCompany);
      } else {
        toast.error('Error al eliminar producto del catálogo');
      }
    } catch (error) {
      toast.error('Error al eliminar producto del catálogo');
      console.error('Error removing from catalog:', error);
    }
  };

  const handleUpdateCatalogImage = async (catalogId: string, currentImageUrl?: string) => {
    try {
      // Si hay una nueva imagen seleccionada
      if (catalogImageFiles[catalogId]) {
        // Eliminar la imagen anterior si existe
        if (currentImageUrl) {
          await deleteCatalogImage(currentImageUrl);
        }

        // Subir la nueva imagen
        const uploadedUrl = await uploadCatalogImage(catalogImageFiles[catalogId], catalogId);
        if (uploadedUrl) {
          const result = await updateCatalogImage(catalogId, uploadedUrl);
          if (result) {
            toast.success('Imagen actualizada');
            await loadCatalogItems(catalogCompany);
            handleRemoveCatalogImage(catalogId);
          } else {
            toast.error('Error al actualizar la imagen');
          }
        } else {
          toast.error('Error al subir la imagen');
        }
      }
    } catch (error) {
      toast.error('Error al actualizar la imagen');
      console.error('Error updating catalog image:', error);
    }
  };

  const handleDeleteCatalogImage = async (catalogId: string, imageUrl: string) => {
    try {
      await deleteCatalogImage(imageUrl);
      const result = await updateCatalogImage(catalogId, null);
      if (result) {
        toast.success('Imagen eliminada');
        await loadCatalogItems(catalogCompany);
      } else {
        toast.error('Error al eliminar la imagen');
      }
    } catch (error) {
      toast.error('Error al eliminar la imagen');
      console.error('Error deleting catalog image:', error);
    }
  };

  const handleUpdatePriceType = async (catalogId: string, priceType: 'price1' | 'price2' | 'final_price') => {
    try {
      const result = await updateCatalogPriceType(catalogId, priceType);
      if (result) {
        toast.success('Tipo de precio actualizado');
        await loadCatalogItems(catalogCompany);
      } else {
        toast.error('Error al actualizar tipo de precio');
      }
    } catch (error) {
      toast.error('Error al actualizar tipo de precio');
      console.error('Error updating price type:', error);
    }
  };

  useEffect(() => {
    if (isCatalogDialogOpen) {
      loadCatalogItems(catalogCompany);
    }
  }, [catalogCompany]);

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
      {/* Botones en la esquina superior */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <Button
          onClick={handleConsultClick}
          className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 animate-fade-in"
        >
          <Search className="h-4 w-4 mr-2" />
          Consultar
        </Button>
        <Button
          onClick={handleCatalogClick}
          className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 animate-fade-in"
        >
          <BookOpen className="h-4 w-4 mr-2" />
          Catálogo
        </Button>
      </div>

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

      {/* Diálogo de catálogo */}
      <Dialog open={isCatalogDialogOpen} onOpenChange={setIsCatalogDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gestión de Catálogo Público</DialogTitle>
            <DialogDescription>
              Administra los productos que aparecerán en el catálogo público de cada empresa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Selector de empresa */}
            <div className="space-y-2">
              <Label htmlFor="catalogCompany" className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-purple-600" />
                Seleccionar Empresa
              </Label>
              <Select value={catalogCompany} onValueChange={(value: 'celumundo' | 'repuestos') => setCatalogCompany(value)}>
                <SelectTrigger className="border-purple-200 dark:border-purple-800 focus:border-purple-600">
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

            {/* Lista actual de productos en el catálogo */}
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">Productos en el Catálogo</h3>
              {isLoadingCatalog ? (
                <p className="text-muted-foreground text-center py-8">Cargando catálogo...</p>
              ) : catalogItems.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">El catálogo está vacío. Busca productos para agregar.</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {catalogItems.map(item => {
                    const product = allProducts.find(p => p.id === item.product_id);
                    if (!product) return null;

                    return (
                      <div key={item.id} className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                        <div className="flex items-start justify-between gap-4">
                          {/* Imagen del producto */}
                          <div className="flex-shrink-0">
                            {item.image_url || catalogImagePreviews[item.id] ? (
                              <div className="relative">
                                <img
                                  src={catalogImagePreviews[item.id] || item.image_url}
                                  alt={product.name}
                                  className="h-24 w-24 object-cover rounded-lg border border-purple-300"
                                />
                                {!catalogImagePreviews[item.id] && item.image_url && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCatalogImage(item.id, item.image_url!)}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                                    title="Eliminar imagen"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="h-24 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                                <ImageIcon className="h-8 w-8 text-gray-400" />
                              </div>
                            )}
                            <div className="mt-2">
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleCatalogImageChange(item.id, e)}
                                className="text-xs h-8"
                              />
                              {catalogImageFiles[item.id] && (
                                <Button
                                  size="sm"
                                  onClick={() => handleUpdateCatalogImage(item.id, item.image_url)}
                                  className="w-full mt-1 h-7 text-xs"
                                >
                                  <Upload className="h-3 w-3 mr-1" />
                                  Guardar
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Información del producto */}
                          <div className="flex-1">
                            <p className="text-sm font-mono font-bold text-purple-700 dark:text-purple-400">Código: {product.code}</p>
                            <p className="text-base font-semibold mt-1">{product.name}</p>
                            <div className="mt-2 flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <Label className="text-xs">Precio mostrado:</Label>
                                <Select
                                  value={item.price_type}
                                  onValueChange={(value: 'price1' | 'price2' | 'final_price') => handleUpdatePriceType(item.id, value)}
                                >
                                  <SelectTrigger className="h-8 w-32 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="price1">Precio 1</SelectItem>
                                    <SelectItem value="price2">Precio 2</SelectItem>
                                    <SelectItem value="final_price">Precio Final</SelectItem>
                                  </SelectContent>
                                </Select>
                                <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                                  {formatCOP(product[item.price_type])}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Botón eliminar */}
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRemoveFromCatalog(item.id, item.image_url)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Buscador para agregar productos */}
            <div className="space-y-2 pt-4 border-t">
              <h3 className="font-semibold text-lg">Agregar Productos</h3>
              <div className="space-y-2">
                <Label htmlFor="catalogSearchQuery">Buscar Producto</Label>
                <Input
                  id="catalogSearchQuery"
                  type="text"
                  placeholder="Código o nombre del producto"
                  value={catalogSearchQuery}
                  onChange={(e) => setCatalogSearchQuery(e.target.value)}
                  className="border-purple-200 dark:border-purple-800 focus:border-purple-600"
                />
              </div>

              <Button
                type="button"
                className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
                onClick={handleCatalogSearch}
              >
                <Search className="h-4 w-4 mr-2" />
                Buscar
              </Button>

              {catalogFilteredProducts.length > 0 && (
                <div className="space-y-2 max-h-[300px] overflow-y-auto mt-4">
                  {catalogFilteredProducts.map(product => (
                    <div key={product.id} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
                      <div className="flex gap-4">
                        {/* Sección de imagen */}
                        <div className="flex-shrink-0">
                          {catalogImagePreviews[product.id] ? (
                            <div className="relative">
                              <img
                                src={catalogImagePreviews[product.id]}
                                alt="Preview"
                                className="h-24 w-24 object-cover rounded-lg border border-gray-300"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveCatalogImage(product.id)}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                                title="Eliminar imagen"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="h-24 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                              <ImageIcon className="h-8 w-8 text-gray-400" />
                            </div>
                          )}
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleCatalogImageChange(product.id, e)}
                            className="text-xs h-8 mt-2"
                          />
                        </div>

                        {/* Información del producto */}
                        <div className="flex-1">
                          <p className="text-sm font-mono font-bold text-gray-700 dark:text-gray-400">Código: {product.code}</p>
                          <p className="text-base font-semibold mt-1">{product.name}</p>
                          <p className="text-sm text-muted-foreground">{product.description}</p>
                          <div className="mt-3 space-y-2">
                            <Label className="text-xs">Seleccionar precio y agregar:</Label>
                            <div className="flex gap-2 flex-wrap">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAddToCatalog(product.id, 'price1')}
                              >
                                Precio 1 ({formatCOP(product.price1)})
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAddToCatalog(product.id, 'price2')}
                              >
                                Precio 2 ({formatCOP(product.price2)})
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAddToCatalog(product.id, 'final_price')}
                              >
                                Precio Final ({formatCOP(product.final_price)})
                              </Button>
                            </div>
                          </div>
                        </div>
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
