import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { Search, ArrowUp, ArrowDown, Loader2, Calendar, FileText, Eye, Printer, Download } from 'lucide-react';
import { searchMovementReceipts, type MovementReceipt } from '../lib/supabase';
import { formatCOP } from '../lib/currency';

interface MovementReceiptsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewReceipt: (receipt: MovementReceipt) => void;
  onPrintReceipt: (receipt: MovementReceipt) => void;
  onDownloadReceipt: (receipt: MovementReceipt) => void;
}

export function MovementReceiptsModal({
  open,
  onOpenChange,
  onViewReceipt,
  onPrintReceipt,
  onDownloadReceipt
}: MovementReceiptsModalProps) {
  const [receipts, setReceipts] = useState<MovementReceipt[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'entry' | 'exit'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Búsqueda con debounce
  useEffect(() => {
    if (!open) return;

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      try {
        const data = await searchMovementReceipts(
          searchTerm,
          filterType,
          startDate || undefined,
          endDate || undefined
        );
        setReceipts(data);
      } finally {
        setIsLoading(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, filterType, startDate, endDate, open]);

  // Reset página cuando cambian filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, startDate, endDate]);

  // Paginación
  const totalPages = Math.ceil(receipts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedReceipts = receipts.slice(startIndex, endIndex);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Registro de Ingresos y Salidas
          </DialogTitle>
          <DialogDescription>
            Historial completo de comprobantes de movimientos de inventario
          </DialogDescription>
        </DialogHeader>

        {/* Filtros */}
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Buscador */}
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Buscar por referencia o motivo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-10"
              />
              {isLoading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
              )}
            </div>

            {/* Filtro por tipo */}
            <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los movimientos</SelectItem>
                <SelectItem value="entry">Solo ingresos</SelectItem>
                <SelectItem value="exit">Solo salidas</SelectItem>
              </SelectContent>
            </Select>

            {/* Filtro por fecha */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="Desde"
                className="flex-1"
              />
            </div>
          </div>

          {startDate && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Hasta:</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="max-w-xs"
              />
            </div>
          )}
        </div>

        {/* Lista de comprobantes */}
        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
          {paginatedReceipts.length === 0 && !isLoading && (
            <div className="text-center py-12 text-gray-500">
              No se encontraron comprobantes
            </div>
          )}

          {paginatedReceipts.map((receipt) => (
            <Card key={receipt.id} className="p-4 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Información principal */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <Badge
                      variant={receipt.type === 'entry' ? 'default' : 'destructive'}
                      className={receipt.type === 'entry' ? 'bg-green-600' : 'bg-red-600'}
                    >
                      <div className="flex items-center gap-1">
                        {receipt.type === 'entry' ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )}
                        {receipt.type === 'entry' ? 'Entrada' : 'Salida'}
                      </div>
                    </Badge>
                    <span className="font-mono text-sm font-medium text-blue-600">
                      {receipt.reference}
                    </span>
                  </div>

                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                    {receipt.reason}
                  </p>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
                    <span>📅 {new Date(receipt.date).toLocaleString('es-ES')}</span>
                    <span>👤 {receipt.user_name}</span>
                    <span>📦 {receipt.total_products} productos</span>
                    <span>🔢 {receipt.total_units} unidades</span>
                    <span className="font-semibold text-green-600">💰 {formatCOP(receipt.total_cost)}</span>
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-2 sm:flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onViewReceipt(receipt)}
                    className="flex-1 sm:flex-initial"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Ver más
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onPrintReceipt(receipt)}
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onDownloadReceipt(receipt)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-gray-600">
              Mostrando {startIndex + 1} - {Math.min(endIndex, receipts.length)} de {receipts.length}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Anterior
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = currentPage <= 3 ? i + 1 : currentPage - 2 + i;
                  if (pageNum > totalPages) return null;
                  return (
                    <Button
                      key={pageNum}
                      size="sm"
                      variant={currentPage === pageNum ? 'default' : 'outline'}
                      onClick={() => setCurrentPage(pageNum)}
                      className="min-w-[40px]"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
