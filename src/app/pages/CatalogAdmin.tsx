import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Image as ImageIcon, Percent, Eye, EyeOff, GripVertical, Upload, Search, Loader2, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
import {
  getCatalogItems,
  addCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
  getAllProducts,
  searchProductsForInvoice,
  uploadCatalogImage,
  getCurrentCompany,
  type CatalogItem
} from '../lib/supabase';
import { formatCOP } from '../lib/currency';
import { toast } from 'sonner';
import { useDebounce } from '../hooks/useDebounce';

export function CatalogAdmin() {
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);

  // Form states
  const [selectedProductId, setSelectedProductId] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [showPrice, setShowPrice] = useState(true);
  const [imageUrl, setImageUrl] = useState('');
  const [displayOrder, setDisplayOrder] = useState(0);
  const [description, setDescription] = useState('');
  const [customPrice, setCustomPrice] = useState<number | ''>('');
  const [displayName, setDisplayName] = useState('');
  const [showReferences, setShowReferences] = useState(false);
  const [productReferences, setProductReferences] = useState<string[]>([]);

  // References modal
  const [showReferencesModal, setShowReferencesModal] = useState(false);

  // Image upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState('');

  // Product search states
  const [productSearchInput, setProductSearchInput] = useState('');
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const debouncedSearchTerm = useDebounce(productSearchInput, 400);

  useEffect(() => {
    loadData();
  }, []);

  // Efecto para búsqueda con debounce
  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedSearchTerm.trim()) {
        setSearchResults([]);
        return;
      }

      setIsSearchingProducts(true);
      try {
        const results = await searchProductsForInvoice(debouncedSearchTerm);
        // Filtrar productos que ya están en el catálogo (excepto si estamos editando)
        const filtered = results.filter(p => {
          if (editingItem && p.id === editingItem.product_id) return true;
          return !catalogItems.some(ci => ci.product_id === p.id);
        });
        setSearchResults(filtered);
      } catch (error) {
        console.error('Error searching products:', error);
        toast.error('Error al buscar productos');
      } finally {
        setIsSearchingProducts(false);
      }
    };

    performSearch();
  }, [debouncedSearchTerm, catalogItems, editingItem]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [catalogData, productsData] = await Promise.all([
        getCatalogItems(),
        getAllProducts()
      ]);
      setCatalogItems(catalogData);
      setProducts(productsData);
    } catch (error) {
      console.error('Error loading catalog data:', error);
      toast.error('Error al cargar datos del catálogo');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddDialog = () => {
    resetForm();
    setEditingItem(null);
    setShowAddDialog(true);
  };

  const handleOpenEditDialog = (item: CatalogItem) => {
    setEditingItem(item);
    setSelectedProductId(item.product_id);
    setDiscountPercentage(item.discount_percentage || 0);
    setShowPrice(item.show_price !== false);
    setImageUrl(item.image_url || '');
    setImagePreview(item.image_url || '');
    setDisplayOrder(item.display_order || 0);
    setDescription(item.description || '');
    setCustomPrice(item.custom_price || '');
    setDisplayName(item.display_name || '');
    setShowReferences(item.show_references || false);
    setProductReferences(item.product_references || []);
    setShowAddDialog(true);
  };

  const resetForm = () => {
    setSelectedProductId('');
    setDiscountPercentage(0);
    setShowPrice(true);
    setImageUrl('');
    setDisplayOrder(catalogItems.length);
    setDescription('');
    setCustomPrice('');
    setDisplayName('');
    setShowReferences(false);
    setProductReferences([]);
    setSelectedFile(null);
    setImagePreview('');
    setProductSearchInput('');
    setSearchResults([]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona una imagen válida');
      return;
    }

    // Validar tamaño (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no debe superar 5MB');
      return;
    }

    setSelectedFile(file);

    // Generar preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadImage = async () => {
    if (!selectedFile) {
      toast.error('Por favor selecciona una imagen');
      return;
    }

    setIsUploading(true);
    try {
      const url = await uploadCatalogImage(selectedFile);
      setImageUrl(url);
      toast.success('Imagen cargada exitosamente');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Error al cargar la imagen');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSelectProduct = (productId: string) => {
    setSelectedProductId(productId);
    setProductSearchInput('');
    setSearchResults([]);

    // Cargar el precio y nombre del producto automáticamente
    const selectedProduct = products.find(p => p.id === productId) ||
                           searchResults.find(p => p.id === productId);
    if (selectedProduct) {
      setCustomPrice(selectedProduct.price1 || selectedProduct.final_price || 0);
      setDisplayName(selectedProduct.name || '');
    }
  };

  const handleAddReference = () => {
    setProductReferences([...productReferences, '']);
  };

  const handleRemoveReference = (index: number) => {
    setProductReferences(productReferences.filter((_, i) => i !== index));
  };

  const handleReferenceChange = (index: number, value: string) => {
    const newReferences = [...productReferences];
    newReferences[index] = value;
    setProductReferences(newReferences);
  };

  const getSelectedProduct = () => {
    return products.find(p => p.id === selectedProductId) ||
           searchResults.find(p => p.id === selectedProductId);
  };

  const handleSave = async () => {
    if (!selectedProductId) {
      toast.error('Debes seleccionar un producto');
      return;
    }

    if (!imageUrl) {
      toast.error('Debes cargar una imagen del producto');
      return;
    }

    if (showPrice && (!customPrice || Number(customPrice) <= 0)) {
      toast.error('Debes ingresar un precio válido para el producto');
      return;
    }

    const product = products.find(p => p.id === selectedProductId);
    if (!product) {
      // Si no está en products, buscar en searchResults
      const foundProduct = searchResults.find(p => p.id === selectedProductId);
      if (!foundProduct) {
        toast.error('Producto no encontrado');
        return;
      }
    }

    const selectedProduct = products.find(p => p.id === selectedProductId) ||
                           searchResults.find(p => p.id === selectedProductId);

    const catalogData = {
      product_id: selectedProductId,
      company: getCurrentCompany(),
      price_type: 'price1', // Campo requerido por la base de datos
      original_price: selectedProduct!.price1 || selectedProduct!.final_price || 0,
      custom_price: customPrice ? Number(customPrice) : null,
      discount_percentage: discountPercentage,
      description: description.trim() || null,
      display_name: displayName.trim() || null,
      show_references: showReferences,
      product_references: productReferences.length > 0 ? productReferences.filter(ref => ref.trim()) : null,
      show_price: showPrice,
      image_url: imageUrl,
      display_order: displayOrder
    };

    try {
      if (editingItem) {
        await updateCatalogItem(editingItem.id, catalogData);
        toast.success('Producto actualizado en el catálogo');
      } else {
        await addCatalogItem(catalogData);
        toast.success('Producto agregado al catálogo');
      }
      setShowAddDialog(false);
      loadData();
    } catch (error) {
      console.error('Error saving catalog item:', error);
      toast.error('Error al guardar el producto');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este producto del catálogo?')) {
      return;
    }

    try {
      await deleteCatalogItem(id);
      toast.success('Producto eliminado del catálogo');
      loadData();
    } catch (error) {
      console.error('Error deleting catalog item:', error);
      toast.error('Error al eliminar el producto');
    }
  };

  const calculateDiscountedPrice = (originalPrice: number, discount: number) => {
    return originalPrice * (1 - discount / 100);
  };

  const getProductName = (productId: string) => {
    const product = products.find(p => p.id === productId) ||
                   searchResults.find(p => p.id === productId);
    return product?.name || 'Producto desconocido';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg">Cargando catálogo...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Administrador de Catálogo</h2>
          <p className="text-muted-foreground mt-1">
            Gestiona los productos que aparecen en el catálogo público
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const company = getCurrentCompany();
              window.open(`/catalogo-publico/${company}`, '_blank');
            }}
          >
            <Eye className="h-4 w-4 mr-2" />
            Ver Catálogo
          </Button>
          <Button onClick={handleOpenAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Agregar Producto
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Productos en Catálogo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{catalogItems.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Con Descuento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {catalogItems.filter(item => (item.discount_percentage || 0) > 0).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Precio Oculto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {catalogItems.filter(item => item.show_price === false).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Catalog Items */}
      <Card>
        <CardHeader>
          <CardTitle>Productos en Catálogo</CardTitle>
        </CardHeader>
        <CardContent>
          {catalogItems.length === 0 ? (
            <div className="text-center py-12">
              <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No hay productos en el catálogo. Agrega el primero.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {catalogItems.map((item) => {
                const hasDiscount = (item.discount_percentage || 0) > 0;
                const discountedPrice = hasDiscount
                  ? calculateDiscountedPrice(item.original_price, item.discount_percentage!)
                  : item.original_price;

                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    {/* Drag Handle */}
                    <div className="flex-shrink-0">
                      <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
                    </div>

                    {/* Image Preview */}
                    <div className="flex-shrink-0 w-20 h-20 bg-muted rounded-md overflow-hidden">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={getProductName(item.product_id)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="flex-1">
                      <h3 className="font-semibold">{getProductName(item.product_id)}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        {item.show_price ? (
                          <>
                            {hasDiscount && (
                              <span className="text-sm text-muted-foreground line-through">
                                {formatCOP(item.original_price)}
                              </span>
                            )}
                            <span className={`font-bold ${hasDiscount ? 'text-green-600' : ''}`}>
                              {formatCOP(discountedPrice)}
                            </span>
                            {hasDiscount && (
                              <Badge variant="destructive" className="text-xs">
                                -{item.discount_percentage}%
                              </Badge>
                            )}
                          </>
                        ) : (
                          <Badge variant="secondary">Precio por consulta</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          Orden: {item.display_order}
                        </Badge>
                        {item.show_price ? (
                          <Eye className="h-3 w-3 text-green-600" />
                        ) : (
                          <EyeOff className="h-3 w-3 text-orange-600" />
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex-shrink-0 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEditDialog(item)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>
              {editingItem ? 'Editar Producto' : 'Agregar Producto al Catálogo'}
            </DialogTitle>
            <DialogDescription>
              {editingItem ? 'Modifica la información del producto en el catálogo' : 'Configura cómo se mostrará el producto en el catálogo público'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 overflow-y-auto flex-1 px-1">
            {/* Product Search */}
            <div className="space-y-2">
              <Label>Producto</Label>
              {selectedProductId ? (
                <div className="flex items-center gap-2 p-2 border rounded-md bg-accent/50">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">
                      {getProductName(selectedProductId)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatCOP(products.find(p => p.id === selectedProductId)?.price1 || 0)}
                    </div>
                  </div>
                  {!editingItem && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedProductId('');
                        setProductSearchInput('');
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={productSearchInput}
                      onChange={(e) => setProductSearchInput(e.target.value)}
                      placeholder="Buscar producto..."
                      className="pl-10 h-9"
                      disabled={!!editingItem}
                    />
                    {isSearchingProducts && (
                      <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>

                  {searchResults.length > 0 && (
                    <div className="border rounded-md max-h-40 overflow-y-auto">
                      {searchResults.map((product) => (
                        <button
                          key={product.id}
                          onClick={() => handleSelectProduct(product.id)}
                          className="w-full text-left p-2 hover:bg-accent transition-colors border-b last:border-b-0"
                        >
                          <div className="font-semibold text-sm">{product.name}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{product.code}</span>
                            <span>•</span>
                            <span>{formatCOP(product.price1)}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {productSearchInput && !isSearchingProducts && searchResults.length === 0 && (
                    <div className="text-sm text-muted-foreground text-center py-2">
                      No se encontraron productos
                    </div>
                  )}
                </div>
              )}
            </div>

            {selectedProductId && (
              <>
                {/* Display Name */}
                <div className="space-y-1">
                  <Label className="text-sm">Nombre de Visualización</Label>
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Nombre para mostrar en el catálogo"
                    className="h-9"
                  />
                  <p className="text-xs text-muted-foreground">
                    Este nombre aparecerá en el catálogo público
                  </p>
                </div>

                {/* Show References Toggle and Button */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 border rounded-md">
                    <Label className="text-sm">Mostrar Referencias</Label>
                    <Switch
                      checked={showReferences}
                      onCheckedChange={setShowReferences}
                    />
                  </div>
                  {showReferences && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowReferencesModal(true)}
                      className="w-full h-9"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {productReferences.length > 0
                        ? `${productReferences.length} Referencias`
                        : 'Agregar Referencias'}
                    </Button>
                  )}
                </div>

                {/* Price and Discount in Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Custom Price */}
                  <div className="space-y-1">
                    <Label className="text-sm">Precio</Label>
                    <Input
                      type="number"
                      min="0"
                      step="100"
                      value={customPrice}
                      onChange={(e) => setCustomPrice(e.target.value ? Number(e.target.value) : '')}
                      placeholder="Precio"
                      className="h-9"
                    />
                  </div>

                  {/* Discount */}
                  <div className="space-y-1">
                    <Label className="text-sm">Descuento (%)</Label>
                    <div className="flex items-center gap-2">
                      <Percent className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={discountPercentage}
                        onChange={(e) => setDiscountPercentage(Number(e.target.value))}
                        placeholder="0"
                        className="h-9"
                      />
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <Label className="text-sm">Descripción</Label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descripción del producto..."
                    className="w-full min-h-[60px] px-3 py-2 text-sm rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    rows={2}
                  />
                </div>

                {/* Show Price and Order in Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Show Price */}
                  <div className="flex items-center justify-between p-2 border rounded-md">
                    <Label className="text-sm">Mostrar Precio</Label>
                    <Switch
                      checked={showPrice}
                      onCheckedChange={setShowPrice}
                    />
                  </div>

                  {/* Display Order */}
                  <div className="space-y-1">
                    <Label className="text-sm">Orden</Label>
                    <Input
                      type="number"
                      min="0"
                      value={displayOrder}
                      onChange={(e) => setDisplayOrder(Number(e.target.value))}
                      placeholder="0"
                      className="h-9"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Image Upload */}
            <div className="space-y-2">
              <Label className="text-sm">Imagen del Producto</Label>

              {imageUrl ? (
                <div className="space-y-2">
                  <div className="w-full h-32 border rounded-md overflow-hidden bg-muted">
                    <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setImageUrl('');
                      setSelectedFile(null);
                      setImagePreview('');
                    }}
                    className="w-full h-8"
                  >
                    <X className="h-3 w-3 mr-2" />
                    Cambiar Imagen
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="cursor-pointer h-9 text-sm"
                  />

                  {imagePreview && (
                    <div className="space-y-2">
                      <div className="w-full h-32 border rounded-md overflow-hidden bg-muted">
                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                      <Button
                        onClick={handleUploadImage}
                        disabled={isUploading}
                        className="w-full h-8"
                        size="sm"
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                            Subiendo...
                          </>
                        ) : (
                          <>
                            <Upload className="h-3 w-3 mr-2" />
                            Subir Imagen
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Preview */}
            {selectedProductId && imageUrl && (
              <div className="border-t pt-3">
                <Label className="mb-2 block text-sm">Vista Previa</Label>
                <div className="border rounded-lg p-3 bg-accent/20">
                  <div className="flex items-start gap-3">
                    <div className="w-16 h-16 bg-muted rounded-md overflow-hidden flex-shrink-0">
                      <img src={imageUrl || imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm truncate">
                        {displayName || getProductName(selectedProductId)}
                      </h4>
                      {description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {description}
                        </p>
                      )}
                      {showReferences && productReferences.length > 0 && (
                        <div className="mt-1">
                          <p className="text-xs text-muted-foreground mb-1">Referencias:</p>
                          <div className="flex flex-wrap gap-1">
                            {productReferences.filter(ref => ref.trim()).map((ref, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {ref}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {showPrice ? (
                        <div className="mt-1">
                          {(() => {
                            const basePrice = customPrice ? Number(customPrice) : 0;
                            return (
                              <>
                                {discountPercentage > 0 && (
                                  <div className="text-xs text-muted-foreground line-through">
                                    {formatCOP(basePrice)}
                                  </div>
                                )}
                                <div className={`text-lg font-bold ${discountPercentage > 0 ? 'text-green-600' : ''}`}>
                                  {formatCOP(calculateDiscountedPrice(basePrice, discountPercentage))}
                                </div>
                                {discountPercentage > 0 && (
                                  <Badge variant="destructive" className="mt-1 text-xs">
                                    -{discountPercentage}%
                                  </Badge>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      ) : (
                        <Button variant="outline" className="mt-1 h-7 text-xs" size="sm">
                          Consultar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-3 pt-3 border-t flex-shrink-0">
            <Button variant="outline" onClick={() => setShowAddDialog(false)} size="sm">
              Cancelar
            </Button>
            <Button onClick={handleSave} size="sm">
              {editingItem ? 'Actualizar' : 'Agregar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* References Modal */}
      <Dialog open={showReferencesModal} onOpenChange={setShowReferencesModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar Referencias</DialogTitle>
            <DialogDescription>
              Agrega las referencias o modelos compatibles del producto (ej: Samsung A34, Samsung A35)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {productReferences.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No hay referencias agregadas
              </div>
            ) : (
              productReferences.map((reference, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={reference}
                    onChange={(e) => handleReferenceChange(index, e.target.value)}
                    placeholder={`Referencia ${index + 1}`}
                    className="h-9"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveReference(index)}
                    className="flex-shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}

            <Button
              onClick={handleAddReference}
              variant="outline"
              className="w-full"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar Referencia
            </Button>
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
            <Button
              variant="outline"
              onClick={() => setShowReferencesModal(false)}
              size="sm"
            >
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
