import { useState, useMemo, memo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { formatCOP } from '../lib/currency';

interface ProductConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: any | null;
  unitIdSelectedIds: string[];
  onConfirm: (quantity: number, price: number) => Promise<void>;
  onCancel: () => void;
}

export const ProductConfigModal = memo(function ProductConfigModal({
  open,
  onOpenChange,
  product,
  unitIdSelectedIds,
  onConfirm,
  onCancel
}: ProductConfigModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState('0');

  // Inicializar precio cuando se abre el modal con un producto
  useEffect(() => {
    if (open && product) {
      setQuantity(product.use_unit_ids ? unitIdSelectedIds.length : 1);
      setPrice(product.current_cost?.toString() || '0');
    }
  }, [open, product, unitIdSelectedIds.length]);

  // Si el producto usa IDs únicas, la cantidad es la de IDs seleccionadas
  const effectiveQuantity = product?.use_unit_ids ? unitIdSelectedIds.length : quantity;

  // Cálculo memorizado del total
  const total = useMemo(() => {
    return formatCOP(effectiveQuantity * (parseFloat(price) || 0));
  }, [effectiveQuantity, price]);

  const handleConfirm = async () => {
    const priceValue = parseFloat(price) || 0;
    if (priceValue <= 0) {
      return;
    }
    await onConfirm(effectiveQuantity, priceValue);
    // Reset
    setQuantity(1);
    setPrice('0');
  };

  const handleCancel = () => {
    setQuantity(1);
    setPrice('0');
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm bg-white dark:bg-zinc-950">
        <DialogHeader>
          <DialogTitle className="text-zinc-900 dark:text-zinc-100">Configurar Producto</DialogTitle>
          <DialogDescription className="text-zinc-600 dark:text-zinc-400">
            {product?.name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label className="text-zinc-700 dark:text-zinc-300">Cantidad</Label>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              disabled={product?.use_unit_ids}
              className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
            />
            {product?.use_unit_ids && (
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Cantidad fijada por IDs seleccionadas: {unitIdSelectedIds.join(', ')}
              </div>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-zinc-700 dark:text-zinc-300">Precio unitario</Label>
            <Input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
            />
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Total: {total}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>Cancelar</Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleConfirm}
          >
            Agregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
