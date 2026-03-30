import { useEffect, useState, useRef } from "react";
import { Plus, Search, Pencil, Trash2, AlertCircle, Percent, List } from 'lucide-react';
import { getProducts, addProduct, updateProduct, deleteProduct, getDepartments, type Product, type Department } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { formatCOP } from '../lib/currency';
import { copyToClipboard } from '../lib/clipboard';

export function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isUnitIdsDialogOpen, setIsUnitIdsDialogOpen] = useState(false);
  const [selectedProductForIds, setSelectedProductForIds] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false); // Prevenir doble clic
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    currentCost: '',
    oldCost: '',
    price1: '',
    price2: '',
    finalPrice: '',
    stock: '',
    minStock: '',
    category: '',
    margin1: '',
    margin2: '',
    marginFinal: '',
    useUnitIds: false,
  });

  useEffect(() => {
    loadProducts();
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    const data = await getDepartments();
    setDepartments(data);
  };

  const loadProducts = async () => {
    const data = await getProducts();
    setProducts(data);
  };

  const getNextProductCode = () => {
    if (products.length === 0) {
      return { base: 'A10001A', variant: 1 };
    }
    
    // Extraer todos los códigos base para encontrar el máximo
    const baseCodes = products.map(p => {
      const match = p.code.match(/A(\d+)A/);
      return match ? parseInt(match[1]) : 10000;
    });
    
    const maxBaseNumber = Math.max(...baseCodes, 10000);
    
    // Si estamos creando un producto nuevo, usar el siguiente número base
    const nextBaseNumber = maxBaseNumber >= 10000 ? maxBaseNumber + 1 : 10001;
    const baseCode = `A${nextBaseNumber.toString().padStart(5, '0')}A`;
    
    return { base: baseCode, variant: 1 };
  };

  // Obtener el siguiente número de variante para un código base
  const getNextVariantNumber = (baseCode: string): number => {
    const variants = products.filter(p => p.code === baseCode);
    if (variants.length === 0) return 1;
    
    const variantNumbers = variants.map(p => p.variant_number || 1);
    return Math.max(...variantNumbers) + 1;
  };

  // Generar código completo con extensión
  const generateFullCode = (baseCode: string, variantNumber: number): string => {
    // Validar que variantNumber sea un número válido
    const safeVariantNumber = variantNumber && !isNaN(variantNumber) ? variantNumber : 1;
    // Validar que baseCode sea válido
    const safeBaseCode = baseCode || 'A10001A';
    return `${safeBaseCode.slice(0, -1)}-${safeVariantNumber.toString().padStart(4, '0')}A`;
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.full_code && product.full_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calcular precio desde margen
  const calculatePriceFromMargin = (cost: number, margin: number): number => {
    return cost * (1 + margin / 100);
  };

  // Calcular margen desde precio
  const calculateMarginFromPrice = (cost: number, price: number): number => {
    if (cost === 0) return 0;
    return ((price - cost) / cost) * 100;
  };

  // Actualizar precio cuando cambia el margen
  const handleMarginChange = (field: 'margin1' | 'margin2' | 'marginFinal', value: string) => {
    const cost = parseFloat(formData.currentCost) || 0;
    const margin = parseFloat(value) || 0;
    const price = calculatePriceFromMargin(cost, margin);

    const priceField = field === 'margin1' ? 'price1' : field === 'margin2' ? 'price2' : 'finalPrice';

    setFormData({
      ...formData,
      [field]: value,
      [priceField]: price.toFixed(2),
    });
  };

  // Actualizar margen cuando cambia el precio
  const handlePriceChange = (field: 'price1' | 'price2' | 'finalPrice', value: string) => {
    const cost = parseFloat(formData.currentCost) || 0;
    const price = parseFloat(value) || 0;
    const margin = calculateMarginFromPrice(cost, price);

    const marginField = field === 'price1' ? 'margin1' : field === 'price2' ? 'margin2' : 'marginFinal';

    setFormData({
      ...formData,
      [field]: value,
      [marginField]: margin.toFixed(2),
    });
  };

  // Actualizar todos los precios cuando cambia el costo
  const handleCostChange = (value: string) => {
    const cost = parseFloat(value) || 0;
    
    const margin1 = parseFloat(formData.margin1) || 0;
    const margin2 = parseFloat(formData.margin2) || 0;
    const marginFinal = parseFloat(formData.marginFinal) || 0;

    setFormData({
      ...formData,
      currentCost: value,
      price1: cost > 0 ? calculatePriceFromMargin(cost, margin1).toFixed(2) : '',
      price2: cost > 0 ? calculatePriceFromMargin(cost, margin2).toFixed(2) : '',
      finalPrice: cost > 0 ? calculatePriceFromMargin(cost, marginFinal).toFixed(2) : '',
    });
  };

  const handleOpenDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      
      // Calcular márgenes si no existen
      const currentCost = product.current_cost || 0;
      const margin1 = product.margin1 !== undefined ? product.margin1 : 
        (currentCost > 0 ? calculateMarginFromPrice(currentCost, product.price1) : 0);
      const margin2 = product.margin2 !== undefined ? product.margin2 : 
        (currentCost > 0 ? calculateMarginFromPrice(currentCost, product.price2) : 0);
      const marginFinal = product.margin_final !== undefined ? product.margin_final : 
        (currentCost > 0 ? calculateMarginFromPrice(currentCost, product.final_price) : 0);
      
      // Usar full_code si existe, si no generar desde code y variant_number
      const displayCode = product.full_code || generateFullCode(product.code, product.variant_number);
      
      setFormData({
        code: displayCode,
        name: product.name,
        description: product.description,
        currentCost: product.current_cost.toString(),
        oldCost: product.old_cost.toString(),
        price1: product.price1.toString(),
        price2: product.price2.toString(),
        finalPrice: product.final_price.toString(),
        stock: product.stock.toString(),
        minStock: product.min_stock.toString(),
        category: product.category,
        margin1: margin1.toFixed(2),
        margin2: margin2.toFixed(2),
        marginFinal: marginFinal.toFixed(2),
        useUnitIds: product.use_unit_ids || false,
      });
    } else {
      setEditingProduct(null);
      const { base } = getNextProductCode();
      // Al crear nuevo, solo mostrar el código base sin extensión de variante
      setFormData({
        code: base,
        name: '',
        description: '',
        currentCost: '',
        oldCost: '',
        price1: '',
        price2: '',
        finalPrice: '',
        stock: '0',
        minStock: '5',
        category: '',
        margin1: '',
        margin2: '',
        marginFinal: '',
        useUnitIds: false,
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevenir doble clic
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      // Extraer código base del código ingresado
      // Soporta formatos: A10001A (base) o A10001-0001A (con variante)
      let baseCode = formData.code;
      let variantNumber = 1;
      
      // Si tiene formato con variante: A10001-0001A
      const fullCodeMatch = formData.code.match(/A(\d+)-(\d+)A/);
      if (fullCodeMatch) {
        baseCode = `A${fullCodeMatch[1]}A`;
        variantNumber = parseInt(fullCodeMatch[2]);
      } else {
        // Si tiene formato base: A10001A, extraer solo el número
        const baseCodeMatch = formData.code.match(/A(\d+)A/);
        if (baseCodeMatch) {
          baseCode = formData.code; // Mantener el formato base
          variantNumber = 1;
        }
      }
      
      const productData = {
        code: baseCode,
        full_code: formData.code,
        variant_number: variantNumber,
        name: formData.name,
        description: formData.description,
        current_cost: parseFloat(formData.currentCost),
        old_cost: parseFloat(formData.oldCost),
        price1: parseFloat(formData.price1),
        price2: parseFloat(formData.price2),
        final_price: parseFloat(formData.finalPrice),
        stock: parseInt(formData.stock),
        min_stock: parseInt(formData.minStock),
        category: formData.category,
        margin1: parseFloat(formData.margin1),
        margin2: parseFloat(formData.margin2),
        margin_final: parseFloat(formData.marginFinal),
        use_unit_ids: formData.useUnitIds,
      };

      if (editingProduct) {
        await updateProduct(editingProduct.id, productData);
        toast.success('Producto actualizado correctamente');
      } else {
        await addProduct(productData);
        toast.success('Producto agregado correctamente');
      }

      setIsDialogOpen(false);
      loadProducts();
    } catch (error) {
      console.error('Error al guardar producto:', error);
      toast.error(error instanceof Error ? error.message : 'Error al guardar el producto');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`¿Estás seguro de eliminar el producto "${name}"?`)) {
      await deleteProduct(id);
      toast.success('Producto eliminado');
      loadProducts();
    }
  };

  const handleOpenUnitIdsDialog = (product: Product) => {
    setSelectedProductForIds(product);
    setIsUnitIdsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Productos</h2>
          <p className="text-muted-foreground mt-1">Gestión de inventario</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Producto
        </Button>
      </div>

      {/* Buscador */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Buscar productos por nombre, código o categoría..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Lista de productos */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Productos ({filteredProducts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Código</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Producto</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Categoría</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Precio</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Stock</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => {
                  return (
                    <tr key={product.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-3 px-4">
                        <span className="font-mono text-sm font-bold text-gray-900 dark:text-gray-100">
                          {product.code}
                        </span>
                        {product.use_unit_ids && (
                          <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                            🔢 IDs
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{product.name}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{product.description}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs rounded-full">
                          {product.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {formatCOP(product.final_price)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Costo: {formatCOP(product.current_cost)}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {product.stock <= product.min_stock && (
                            <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
                          )}
                          <span className={`font-medium ${
                            product.stock <= product.min_stock ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'
                          }`}>
                            {product.stock}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Mín: {product.min_stock}</p>
                        {product.use_unit_ids && product.registered_ids && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                            IDs: {product.registered_ids.length}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {product.use_unit_ids && product.registered_ids && product.registered_ids.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenUnitIdsDialog(product)}
                              title="Ver IDs registradas"
                            >
                              <List className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(product)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(product.id, product.name)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500 dark:text-gray-400">
                      No se encontraron productos
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog para agregar/editar */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
            </DialogTitle>
            <DialogDescription>
              Complete el formulario. Los precios se calculan automáticamente según el margen de ganancia.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4 py-4">
              {/* Código y Categoría */}
              <div className="space-y-2">
                <Label htmlFor="code">
                  Código {!editingProduct && <span className="text-xs text-green-600">(Generado automáticamente)</span>}
                </Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  readOnly={!editingProduct}
                  disabled={!editingProduct}
                  className={!editingProduct ? 'bg-green-50 dark:bg-green-950 font-mono text-lg font-bold text-green-600 dark:text-green-400 cursor-not-allowed' : 'font-mono'}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoría</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((department) => (
                      <SelectItem key={department.id} value={department.name}>
                        {department.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Nombre y Descripción */}
              <div className="col-span-2 space-y-2">
                <Label htmlFor="name">Nombre del Producto</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="description">Descripción (Opcional)</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              {/* Costos */}
              <div className="space-y-2">
                <Label htmlFor="currentCost">Costo Actual</Label>
                <Input
                  id="currentCost"
                  type="number"
                  step="0.01"
                  value={formData.currentCost}
                  onChange={(e) => handleCostChange(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="oldCost">Costo Anterior</Label>
                <Input
                  id="oldCost"
                  type="number"
                  step="0.01"
                  value={formData.oldCost}
                  onChange={(e) => setFormData({ ...formData, oldCost: e.target.value })}
                  required
                />
              </div>

              {/* Precio 1 con Margen */}
              <div className="col-span-2 bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="font-semibold text-blue-700 dark:text-blue-300 mb-3 flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  Precio 1
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="margin1">Margen de Ganancia (%)</Label>
                    <Input
                      id="margin1"
                      type="number"
                      step="0.01"
                      value={formData.margin1}
                      onChange={(e) => handleMarginChange('margin1', e.target.value)}
                      placeholder="Ej: 25"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price1">Precio de Venta (COP)</Label>
                    <Input
                      id="price1"
                      type="number"
                      step="0.01"
                      value={formData.price1}
                      onChange={(e) => handlePriceChange('price1', e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Precio 2 con Margen */}
              <div className="col-span-2 bg-green-50 dark:bg-green-950 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <h4 className="font-semibold text-green-700 dark:text-green-300 mb-3 flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  Precio 2
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="margin2">Margen de Ganancia (%)</Label>
                    <Input
                      id="margin2"
                      type="number"
                      step="0.01"
                      value={formData.margin2}
                      onChange={(e) => handleMarginChange('margin2', e.target.value)}
                      placeholder="Ej: 35"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price2">Precio de Venta (COP)</Label>
                    <Input
                      id="price2"
                      type="number"
                      step="0.01"
                      value={formData.price2}
                      onChange={(e) => handlePriceChange('price2', e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Precio Final con Margen */}
              <div className="col-span-2 bg-purple-50 dark:bg-purple-950 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                <h4 className="font-semibold text-purple-700 dark:text-purple-300 mb-3 flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  Precio Final
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="marginFinal">Margen de Ganancia (%)</Label>
                    <Input
                      id="marginFinal"
                      type="number"
                      step="0.01"
                      value={formData.marginFinal}
                      onChange={(e) => handleMarginChange('marginFinal', e.target.value)}
                      placeholder="Ej: 50"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="finalPrice">Precio de Venta (COP)</Label>
                    <Input
                      id="finalPrice"
                      type="number"
                      step="0.01"
                      value={formData.finalPrice}
                      onChange={(e) => handlePriceChange('finalPrice', e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Stock */}
              <div className="space-y-2">
                <Label htmlFor="stock">
                  Stock Actual {!editingProduct && <span className="text-xs text-gray-500">(Se actualiza con movimientos)</span>}
                </Label>
                <Input
                  id="stock"
                  type="number"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  readOnly={!editingProduct}
                  disabled={!editingProduct}
                  className={!editingProduct ? 'bg-gray-100 dark:bg-gray-900 cursor-not-allowed' : ''}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minStock">Stock Mínimo</Label>
                <Input
                  id="minStock"
                  type="number"
                  value={formData.minStock}
                  onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                  required
                />
              </div>

              {/* Checkbox para IDs únicas */}
              <div className="col-span-2 space-y-2">
                <div className="flex items-center space-x-2 p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <input
                    type="checkbox"
                    id="useUnitIds"
                    checked={formData.useUnitIds}
                    onChange={(e) => setFormData({ ...formData, useUnitIds: e.target.checked })}
                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                  />
                  <Label htmlFor="useUnitIds" className="cursor-pointer font-medium">
                    Este producto requiere IDs únicas por unidad
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground pl-1">
                  Activa esta opción para productos de alto valor (celulares, tablets, etc.) que requieren seguimiento individual. Las IDs se asignarán automáticamente al registrar movimientos de entrada.
                </p>
              </div>

              {/* Mostrar IDs registradas si está editando y el producto usa IDs */}
              {editingProduct && editingProduct.use_unit_ids && editingProduct.registered_ids && editingProduct.registered_ids.length > 0 && (
                <div className="col-span-2 space-y-2">
                  <Label>IDs Registradas ({editingProduct.registered_ids.length})</Label>
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg max-h-40 overflow-y-auto">
                    <div className="flex flex-wrap gap-2">
                      {editingProduct.registered_ids.map((id) => (
                        <span key={id} className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs font-mono rounded-full">
                          {id}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : (editingProduct ? 'Actualizar' : 'Guardar')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog para IDs únicas */}
      <Dialog open={isUnitIdsDialogOpen} onOpenChange={setIsUnitIdsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <List className="h-5 w-5 text-blue-600" />
              IDs Únicas Registradas
            </DialogTitle>
            <DialogDescription>
              Lista de todas las IDs únicas registradas para este producto
            </DialogDescription>
          </DialogHeader>
          
          {selectedProductForIds && (
            <div className="mt-2 mb-4">
              <p className="font-medium text-gray-900">{selectedProductForIds.name}</p>
              <p className="text-sm text-gray-600">Código: {selectedProductForIds.code}</p>
            </div>
          )}
          
          {selectedProductForIds && selectedProductForIds.use_unit_ids && (
            <div className="space-y-4 py-4">
              {selectedProductForIds.registered_ids && selectedProductForIds.registered_ids.length > 0 ? (
                <>
                  <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-blue-900 dark:text-blue-100">
                          Total de IDs Registradas
                        </p>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          Unidades individuales con seguimiento
                        </p>
                      </div>
                      <div className="text-4xl font-bold text-blue-600">
                        {selectedProductForIds.registered_ids.length}
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-3 block">
                      Listado de IDs (Click para copiar)
                    </Label>
                    <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg max-h-80 overflow-y-auto">
                      {selectedProductForIds.registered_ids
                        .sort((a, b) => parseInt(a) - parseInt(b))
                        .map((id) => {
                          const fullCode = `${selectedProductForIds.code.slice(0, -1)}-${id}A`;
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={async () => {
                                const success = await copyToClipboard(fullCode);
                                if (success) {
                                  toast.success(`Copiado: ${fullCode}`);
                                } else {
                                  toast.error('No se pudo copiar al portapapeles');
                                }
                              }}
                              className="px-3 py-2 bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900 dark:to-green-800 hover:from-green-200 hover:to-green-300 dark:hover:from-green-800 dark:hover:to-green-700 text-green-800 dark:text-green-200 text-sm font-mono rounded-lg border-2 border-green-300 dark:border-green-700 transition-all hover:scale-105 cursor-pointer shadow-sm hover:shadow-md"
                              title={`Click para copiar: ${fullCode}`}
                            >
                              {id}
                            </button>
                          );
                        })}
                    </div>
                  </div>

                  <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      💡 <strong>Tip:</strong> Haz clic en cualquier ID para copiar el código completo al portapapeles.
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                      Ejemplo: Click en "0001" copia "{selectedProductForIds.code.slice(0, -1)}-0001A"
                    </p>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                    <List className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 font-medium">
                    No hay IDs registradas aún
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                    Las IDs se generarán automáticamente cuando registres una entrada de inventario
                  </p>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsUnitIdsDialogOpen(false)}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}