import { useState, useEffect } from 'react';
import { Search, X, ChevronLeft, ChevronRight, Package, DollarSign, Layers, Hash, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { formatCOP } from '../lib/currency';
import { includesIgnoreAccents } from '../lib/string-utils';
import { searchProductsForInvoice } from '../lib/supabase';

interface Product {
  id: string;
  code: string;
  name: string;
  description?: string;
  department_name?: string;
  current_cost: number;
  price1: number;
  price2: number;
  final_price: number;
  stock: number;
  use_unit_ids: boolean;
  registered_ids: Array<{ id: string; note: string }>;
}

interface ProductSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  departments: Array<{ id: string; name: string }>;
  onSelectProduct: (product: Product) => void;
}

const ITEMS_PER_PAGE = 6;

export function ProductSelectionModal({
  open,
  onOpenChange,
  products,
  departments,
  onSelectProduct
}: ProductSelectionModalProps) {
  const [searchInput, setSearchInput] = useState(''); // Lo que escribe el usuario
  const [searchTerm, setSearchTerm] = useState(''); // Término real para filtrar
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [isSearching, setIsSearching] = useState(false);
  const [searchedProducts, setSearchedProducts] = useState<Product[] | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0); // Índice del producto seleccionado con flechas

  // Función para ejecutar búsqueda
  const handleSearch = async () => {
    if (!searchInput.trim()) {
      // Si no hay término de búsqueda, limpiar resultados
      setSearchedProducts(null);
      setSearchTerm('');
      setCurrentPage(1);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchProductsForInvoice(searchInput.trim());
      setSearchedProducts(results);
      setSearchTerm(searchInput);
      setCurrentPage(1);
    } catch (error) {
      console.error('Error searching products:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Reset page when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedDepartment]);

  // Use searched products if available, otherwise use all products
  const baseProducts = searchedProducts !== null ? searchedProducts : products;

  // Filter products (apply department/category filter on client side)
  const filteredProducts = baseProducts.filter((product) => {
    // Filter by department (using category field)
    if (selectedDepartment !== 'all') {
      const dept = departments.find(d => d.id === selectedDepartment);
      if (dept && product.category !== dept.name) {
        return false;
      }
    }

    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentProducts = filteredProducts.slice(startIndex, endIndex);

  const handleSelectProduct = (product: Product) => {
    onSelectProduct(product);
    onOpenChange(false);
  };

  // Reset when modal closes
  useEffect(() => {
    if (!open) {
      setSearchInput('');
      setSearchTerm('');
      setSearchedProducts(null);
      setSelectedDepartment('all');
      setCurrentPage(1);
      setSelectedIndex(0);
    } else {
      // Auto-seleccionar primer producto al abrir
      setSelectedIndex(0);
    }
  }, [open]);

  // Reset selectedIndex cuando cambia la página o los productos
  useEffect(() => {
    setSelectedIndex(0);
  }, [currentPage, searchTerm, selectedDepartment]);

  // Navegación con teclado
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Solo actuar si no hay un input enfocado (excepto el de búsqueda)
      const activeElement = document.activeElement;
      const isInputFocused = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';

      // Flecha Arriba
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      }

      // Flecha Abajo
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(currentProducts.length - 1, prev + 1));
      }

      // Enter - Seleccionar producto resaltado
      if (e.key === 'Enter' && currentProducts.length > 0 && !isInputFocused) {
        e.preventDefault();
        const selectedProduct = currentProducts[selectedIndex];
        if (selectedProduct) {
          handleSelectProduct(selectedProduct);
        }
      }

      // Escape - Cerrar modal
      if (e.key === 'Escape') {
        e.preventDefault();
        onOpenChange(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, selectedIndex, currentProducts]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Seleccionar Producto
          </DialogTitle>
          <DialogDescription>
            Busca y selecciona un producto para agregar a tu lista
          </DialogDescription>
        </DialogHeader>

        {/* Search and Filter Bar */}
        <div className="flex flex-col gap-3 pb-4 border-b border-border">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar por código, nombre o descripción..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10 pr-10"
              />
              {searchInput && (
                <button
                  onClick={() => {
                    setSearchInput('');
                    setSearchTerm('');
                    setSearchedProducts(null);
                  }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Department Filter */}
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Todos los departamentos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los departamentos</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Botón de búsqueda */}
          <Button onClick={handleSearch} disabled={isSearching} className="w-full sm:w-auto">
            {isSearching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Buscando...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Buscar Producto
              </>
            )}
          </Button>
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto py-4">
          {currentProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-3" />
              <h3 className="text-lg font-medium text-muted-foreground mb-1">
                No se encontraron productos
              </h3>
              <p className="text-sm text-muted-foreground">
                Intenta con otro término de búsqueda o filtro
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentProducts.map((product, index) => (
                <button
                  key={product.id}
                  onClick={() => handleSelectProduct(product)}
                  className={`group relative bg-card border rounded-lg p-4 hover:shadow-lg transition-all duration-200 text-left ${
                    index === selectedIndex
                      ? 'border-emerald-500 shadow-lg ring-2 ring-emerald-500 ring-opacity-50 bg-emerald-50 dark:bg-emerald-950/30'
                      : 'border-border hover:border-emerald-500'
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-foreground truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {product.name}
                        </h4>
                        {product.use_unit_ids && (
                          <div className="flex-shrink-0">
                            <Badge 
                              variant="outline" 
                              className="text-[10px] px-1.5 py-0 h-5 bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400"
                              title="Este producto usa IDs únicas por unidad"
                            >
                              <Hash className="h-3 w-3 mr-0.5" />
                              IDs
                            </Badge>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Código: {product.code}
                      </p>
                      {product.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {product.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Department Badge */}
                  {product.department_name && (
                    <div className="mb-3">
                      <Badge variant="outline" className="text-xs">
                        <Layers className="h-3 w-3 mr-1" />
                        {product.department_name}
                      </Badge>
                    </div>
                  )}

                  {/* Stock */}
                  <div className="mb-3 flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      Stock:{' '}
                      <span
                        className={`font-semibold ${
                          product.stock > 10
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : product.stock > 0
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {product.stock}
                      </span>
                    </span>
                    {product.use_unit_ids && (
                      <span className="text-xs text-muted-foreground">
                        ({product.registered_ids?.length || 0} IDs disponibles)
                      </span>
                    )}
                  </div>

                  {/* Prices Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Costo Actual */}
                    <div className="bg-muted/50 rounded px-2 py-1.5">
                      <p className="text-xs text-muted-foreground">Costo</p>
                      <p className="text-sm font-semibold text-foreground">
                        ${formatCOP(product.current_cost)}
                      </p>
                    </div>

                    {/* Precio 1 */}
                    <div className="bg-blue-50 dark:bg-blue-950/30 rounded px-2 py-1.5">
                      <p className="text-xs text-blue-600 dark:text-blue-400">Precio 1</p>
                      <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                        ${formatCOP(product.price1)}
                      </p>
                    </div>

                    {/* Precio 2 */}
                    <div className="bg-purple-50 dark:bg-purple-950/30 rounded px-2 py-1.5">
                      <p className="text-xs text-purple-600 dark:text-purple-400">Precio 2</p>
                      <p className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                        ${formatCOP(product.price2)}
                      </p>
                    </div>

                    {/* Precio Final */}
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded px-2 py-1.5">
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">P. Final</p>
                      <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                        ${formatCOP(product.final_price)}
                      </p>
                    </div>
                  </div>

                  {/* Selected indicator */}
                  {index === selectedIndex && (
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-emerald-600 text-white text-[10px] px-2 py-0.5">
                        ↵ Enter
                      </Badge>
                    </div>
                  )}

                  {/* Hover indicator */}
                  <div className="absolute inset-0 border-2 border-emerald-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {filteredProducts.length > 0 && (
          <div className="border-t border-border pt-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Mostrando {startIndex + 1} - {Math.min(endIndex, filteredProducts.length)} de{' '}
              {filteredProducts.length} productos
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="text-sm font-medium">
                Página {currentPage} de {totalPages}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Keyboard hints */}
        {currentProducts.length > 0 && (
          <div className="border-t border-border pt-3 mt-2">
            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <kbd className="px-2 py-1 bg-muted rounded text-[10px] font-mono">↑</kbd>
                <kbd className="px-2 py-1 bg-muted rounded text-[10px] font-mono">↓</kbd>
                Navegar
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-2 py-1 bg-muted rounded text-[10px] font-mono">Enter</kbd>
                Seleccionar
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-2 py-1 bg-muted rounded text-[10px] font-mono">Esc</kbd>
                Cerrar
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}