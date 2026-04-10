import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { formatCOP } from '../lib/currency';
import { Package, DollarSign, TrendingUp, Hash, Barcode } from 'lucide-react';

interface Product {
  id: string;
  company: 'celumundo' | 'repuestos';
  code: string;
  name: string;
  description: string;
  current_cost: number;
  old_cost: number;
  price1: number;
  price2: number;
  final_price: number;
  margin1: number;
  margin2: number;
  margin_final: number;
  stock: number;
  min_stock: number;
  category: string;
  use_unit_ids: boolean;
  registered_ids?: Array<{ id: string; note: string }>;
}

interface ProductInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
}

export function ProductInfoDialog({ open, onOpenChange, product }: ProductInfoDialogProps) {
  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Package className="h-5 w-5 text-green-600" />
            Información Completa del Producto
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            Detalles detallados del producto seleccionado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Información Básica */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
              <Barcode className="h-4 w-4" />
              Información Básica
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Código</p>
                <p className="font-mono font-bold text-lg text-gray-900">{product.code}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Categoría</p>
                <p className="font-semibold text-gray-900">{product.category}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-gray-600">Nombre</p>
                <p className="font-semibold text-gray-900">{product.name}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-gray-600">Descripción</p>
                <p className="text-gray-700">{product.description}</p>
              </div>
            </div>
          </div>

          {/* Inventario */}
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Inventario
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-3 rounded-lg">
                <p className="text-sm text-gray-600">Stock Actual</p>
                <p className="text-2xl font-bold text-blue-900">{product.stock}</p>
                <p className="text-xs text-gray-500 mt-1">unidades disponibles</p>
              </div>
              <div className="bg-white p-3 rounded-lg">
                <p className="text-sm text-gray-600">Stock Mínimo</p>
                <p className="text-2xl font-bold text-orange-600">{product.min_stock}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {product.stock <= product.min_stock ? '⚠️ Stock bajo' : '✓ Stock normal'}
                </p>
              </div>
            </div>
          </div>

          {/* Costos */}
          <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-900 mb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Costos
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-3 rounded-lg">
                <p className="text-sm text-gray-600">Costo Actual</p>
                <p className="text-xl font-bold text-gray-900">{formatCOP(product.current_cost)}</p>
              </div>
              <div className="bg-white p-3 rounded-lg">
                <p className="text-sm text-gray-600">Costo Anterior</p>
                <p className="text-lg font-semibold text-gray-600">{formatCOP(product.old_cost)}</p>
                {product.old_cost > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    {product.current_cost > product.old_cost ? '↑' : '↓'} 
                    {' '}Cambio: {formatCOP(Math.abs(product.current_cost - product.old_cost))}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Precios de Venta */}
          <div className="bg-gradient-to-r from-green-50 to-teal-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Precios de Venta
            </h3>
            <div className="space-y-3">
              {/* Precio 1 */}
              <div className="bg-white border border-blue-200 p-3 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-blue-900">Precio 1</p>
                    <p className="text-xs text-gray-600">Precio base de venta</p>
                  </div>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                    +{product.margin1}% ganancia
                  </span>
                </div>
                <p className="text-2xl font-bold text-blue-900">{formatCOP(product.price1)}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Ganancia: {formatCOP(product.price1 - product.current_cost)}
                </p>
              </div>

              {/* Precio 2 (Al Mayor) */}
              <div className="bg-white border border-purple-200 p-3 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-purple-900">Precio 2 (Al Mayor)</p>
                    <p className="text-xs text-gray-600">Para ventas al por mayor</p>
                  </div>
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                    +{product.margin2}% ganancia
                  </span>
                </div>
                <p className="text-2xl font-bold text-purple-900">{formatCOP(product.price2)}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Ganancia: {formatCOP(product.price2 - product.current_cost)}
                </p>
              </div>

              {/* Precio Final (Regular) */}
              <div className="bg-white border border-green-200 p-3 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-green-900">Precio Final (Regular)</p>
                    <p className="text-xs text-gray-600">Para ventas regulares</p>
                  </div>
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                    +{product.margin_final}% ganancia
                  </span>
                </div>
                <p className="text-2xl font-bold text-green-900">{formatCOP(product.final_price)}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Ganancia: {formatCOP(product.final_price - product.current_cost)}
                </p>
              </div>
            </div>
          </div>

          {/* IDs Únicas */}
          {product.use_unit_ids && (
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg p-4">
              <h3 className="font-semibold text-indigo-900 mb-3 flex items-center gap-2">
                <Hash className="h-4 w-4" />
                IDs Únicas Registradas
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                Este producto maneja identificadores únicos por unidad
              </p>
              <div className="bg-white p-3 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">
                  Total de IDs: <span className="font-bold text-indigo-900">{product.registered_ids?.length || 0}</span>
                </p>
                {product.registered_ids && product.registered_ids.length > 0 && (
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {product.registered_ids.map((item) => (
                      <span
                        key={item.id}
                        className="px-3 py-1 bg-indigo-100 text-indigo-700 font-mono text-xs rounded-full flex flex-col items-center gap-0.5"
                        title={item.note || 'Sin nota'}
                      >
                        <span>{product.code}-{item.id}</span>
                        {item.note && <span className="text-[9px] opacity-70">{item.note.substring(0, 15)}{item.note.length > 15 ? '...' : ''}</span>}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}