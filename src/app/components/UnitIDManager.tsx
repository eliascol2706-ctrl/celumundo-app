import { useState } from 'react';
import { Search, X, Power, PowerOff, RotateCw, Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { supabase, getCurrentCompany } from '../lib/supabase';
import { toast } from 'sonner';
import { Switch } from './ui/switch';

interface Product {
  id: string;
  code: string;
  name: string;
  use_unit_ids: boolean;
  registered_ids: Array<{ id: string; note: string; disabled?: boolean; in_warranty?: boolean }>;
}

interface UnitIDManagerProps {
  isOpen: boolean;
  onClose: () => void;
  inline?: boolean;
}

export function UnitIDManager({ isOpen, onClose, inline = false }: UnitIDManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [newUnitId, setNewUnitId] = useState('');
  const [newNote, setNewNote] = useState('');

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const company = getCurrentCompany();

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('company', company)
        .eq('use_unit_ids', true)
        .or(`code.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%`)
        .limit(10);

      if (error) {
        console.error('Error searching products:', error);
        toast.error('Error al buscar productos');
        return;
      }

      setSearchResults(data || []);
    } catch (error) {
      console.error('Error searching products:', error);
      toast.error('Error al buscar productos');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleToggleActive = async (unitId: string) => {
    if (!selectedProduct) return;

    const updatedIds = selectedProduct.registered_ids.map(item => {
      if (item.id === unitId) {
        return { ...item, disabled: !item.disabled };
      }
      return item;
    });

    try {
      const { error } = await supabase
        .from('products')
        .update({ registered_ids: updatedIds })
        .eq('id', selectedProduct.id);

      if (error) {
        console.error('Error updating unit ID:', error);
        toast.error('Error al actualizar ID única');
        return;
      }

      setSelectedProduct({ ...selectedProduct, registered_ids: updatedIds });
      toast.success('ID única actualizada');
    } catch (error) {
      console.error('Error updating unit ID:', error);
      toast.error('Error al actualizar ID única');
    }
  };

  const handleReturnFromWarranty = async (unitId: string) => {
    if (!selectedProduct) return;

    const updatedIds = selectedProduct.registered_ids.map(item => {
      if (item.id === unitId) {
        return { ...item, in_warranty: false, disabled: false };
      }
      return item;
    });

    try {
      const { error } = await supabase
        .from('products')
        .update({ registered_ids: updatedIds })
        .eq('id', selectedProduct.id);

      if (error) {
        console.error('Error returning from warranty:', error);
        toast.error('Error al devolver de garantía');
        return;
      }

      setSelectedProduct({ ...selectedProduct, registered_ids: updatedIds });
      toast.success('ID devuelta de garantía y marcada como disponible');
    } catch (error) {
      console.error('Error returning from warranty:', error);
      toast.error('Error al devolver de garantía');
    }
  };

  const handleAddUnitId = async () => {
    if (!selectedProduct || !newUnitId.trim()) {
      toast.error('Ingresa una ID única válida');
      return;
    }

    // Verificar que no exista ya
    const exists = selectedProduct.registered_ids.some(item => item.id === newUnitId.trim());
    if (exists) {
      toast.error('Esta ID única ya existe para este producto');
      return;
    }

    const updatedIds = [
      ...selectedProduct.registered_ids,
      { id: newUnitId.trim(), note: newNote.trim(), disabled: false }
    ];

    try {
      const { error } = await supabase
        .from('products')
        .update({ registered_ids: updatedIds })
        .eq('id', selectedProduct.id);

      if (error) {
        console.error('Error adding unit ID:', error);
        toast.error('Error al agregar ID única');
        return;
      }

      setSelectedProduct({ ...selectedProduct, registered_ids: updatedIds });
      setNewUnitId('');
      setNewNote('');
      toast.success('ID única agregada');
    } catch (error) {
      console.error('Error adding unit ID:', error);
      toast.error('Error al agregar ID única');
    }
  };

  const handleDeleteUnitId = async (unitId: string) => {
    if (!selectedProduct) return;

    const updatedIds = selectedProduct.registered_ids.filter(item => item.id !== unitId);

    try {
      const { error } = await supabase
        .from('products')
        .update({ registered_ids: updatedIds })
        .eq('id', selectedProduct.id);

      if (error) {
        console.error('Error deleting unit ID:', error);
        toast.error('Error al eliminar ID única');
        return;
      }

      setSelectedProduct({ ...selectedProduct, registered_ids: updatedIds });
      toast.success('ID única eliminada');
    } catch (error) {
      console.error('Error deleting unit ID:', error);
      toast.error('Error al eliminar ID única');
    }
  };

  const handleClose = () => {
    setSelectedProduct(null);
    setSearchQuery('');
    setSearchResults([]);
    setNewUnitId('');
    setNewNote('');
    onClose();
  };

  const content = (
    <div className="space-y-6">
          {!selectedProduct ? (
            <>
              {/* Búsqueda de productos */}
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Buscar producto por código o nombre..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSearch();
                      }
                    }}
                  />
                  <Button onClick={handleSearch} disabled={isSearching}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>

                {/* Resultados de búsqueda */}
                {searchResults.length > 0 && (
                  <div className="border rounded-lg divide-y">
                    {searchResults.map((product) => (
                      <div
                        key={product.id}
                        className="p-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer flex items-center justify-between"
                        onClick={() => handleSelectProduct(product)}
                      >
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Código: {product.code} • {product.registered_ids?.length || 0} ID's registradas
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {searchQuery && searchResults.length === 0 && !isSearching && (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                    No se encontraron productos con ID's únicas
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Producto seleccionado */}
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h3 className="text-lg font-bold">{selectedProduct.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Código: {selectedProduct.code}
                  </p>
                </div>
                <Button variant="ghost" onClick={() => setSelectedProduct(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Agregar nueva ID */}
              <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                <h4 className="font-semibold mb-3">Agregar Nueva ID Única</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>ID Única</Label>
                    <Input
                      placeholder="Ej: IMEI123456789"
                      value={newUnitId}
                      onChange={(e) => setNewUnitId(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Nota (opcional)</Label>
                    <Input
                      placeholder="Ej: Color negro"
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  onClick={handleAddUnitId}
                  className="mt-3"
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar
                </Button>
              </div>

              {/* Lista de IDs */}
              <div className="space-y-2">
                <h4 className="font-semibold">
                  ID's Registradas ({selectedProduct.registered_ids?.length || 0})
                </h4>

                {selectedProduct.registered_ids && selectedProduct.registered_ids.length > 0 ? (
                  <div className="border rounded-lg divide-y">
                    {selectedProduct.registered_ids.map((item, index) => (
                      <div
                        key={index}
                        className={`p-4 ${
                          item.in_warranty
                            ? 'bg-yellow-50 dark:bg-yellow-950/20'
                            : item.disabled
                            ? 'bg-gray-100 dark:bg-gray-800'
                            : 'bg-white dark:bg-gray-900'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-mono font-semibold">{item.id}</p>
                              {item.in_warranty && (
                                <span className="text-xs px-2 py-0.5 bg-yellow-200 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded">
                                  En Garantía
                                </span>
                              )}
                              {item.disabled && (
                                <span className="text-xs px-2 py-0.5 bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                                  Deshabilitada
                                </span>
                              )}
                            </div>
                            {item.note && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {item.note}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {item.in_warranty && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReturnFromWarranty(item.id)}
                                className="border-yellow-500 text-yellow-700 dark:text-yellow-400"
                              >
                                <RotateCw className="h-3 w-3 mr-1" />
                                Devolver de Garantía
                              </Button>
                            )}

                            <div className="flex items-center gap-2">
                              {!item.disabled ? (
                                <Power className="h-4 w-4 text-green-600" />
                              ) : (
                                <PowerOff className="h-4 w-4 text-gray-400" />
                              )}
                              <Switch
                                checked={!item.disabled}
                                onCheckedChange={() => handleToggleActive(item.id)}
                                disabled={item.in_warranty}
                                className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-gray-400"
                              />
                            </div>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteUnitId(item.id)}
                              disabled={item.in_warranty}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-8 border rounded-lg">
                    No hay ID's únicas registradas para este producto
                  </p>
                )}
              </div>
            </>
          )}
    </div>
  );

  if (inline) {
    return content;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gestión de ID's Únicas</DialogTitle>
          <DialogDescription>
            Busca productos y gestiona sus ID's únicas
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
