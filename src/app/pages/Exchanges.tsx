import { useState, useEffect } from 'react';
import { Search, Plus, ArrowRightLeft, DollarSign, ChevronLeft, ChevronRight, Trash2, CheckCircle, XCircle, X, Loader2, ArrowRight, Package2, Printer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { formatCOP } from '../lib/currency';
import {
  getExchanges,
  getAllProducts,
  searchInvoicesForExchange,
  searchProductsForInvoice,
  addExchange,
  deleteExchange,
  finalizeExchange,
  cancelExchange,
  getCurrentUser,
  getExchangesStats,
  extractColombiaDate,
  type Exchange,
  type ExchangeProduct,
  type Product,
  type Invoice
} from '../lib/supabase';
import { type UnitIdWithNote } from '../lib/unit-ids-utils';
import { toast } from 'sonner';

type FlowStep = 'search-invoice' | 'select-return-products' | 'select-new-products' | 'payment';

export default function Exchanges() {
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [exchangeType, setExchangeType] = useState<'invoice' | 'pending'>('invoice');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Estados del flujo multi-paso
  const [flowStep, setFlowStep] = useState<FlowStep>('search-invoice');

  // Estados para búsqueda de facturas
  const [invoiceSearchTerm, setInvoiceSearchTerm] = useState('');
  const [searchedInvoices, setSearchedInvoices] = useState<Invoice[]>([]);
  const [isSearchingInvoices, setIsSearchingInvoices] = useState(false);
  const [hasSearchedInvoices, setHasSearchedInvoices] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Estados para productos a devolver
  const [productsToReturn, setProductsToReturn] = useState<ExchangeProduct[]>([]);

  // Estados para productos nuevos (a entregar)
  const [newProducts, setNewProducts] = useState<ExchangeProduct[]>([]);

  // Estados para búsqueda de productos nuevos
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [searchedProducts, setSearchedProducts] = useState<Product[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const [hasSearchedProducts, setHasSearchedProducts] = useState(false);

  // Estados para producto seleccionado temporalmente
  const [tempProduct, setTempProduct] = useState<Product | null>(null);
  const [tempQuantity, setTempQuantity] = useState(1);
  const [tempPrice, setTempPrice] = useState(0);
  const [tempUnitIds, setTempUnitIds] = useState<string[]>([]);

  // Diferencia de precio
  const [paymentCash, setPaymentCash] = useState(0);
  const [paymentTransfer, setPaymentTransfer] = useState(0);
  const [paymentOther, setPaymentOther] = useState(0);

  // Estadísticas
  const [stats, setStats] = useState({
    totalExchanges: 0,
    exchangesByInvoice: 0,
    directExchanges: 0,
    totalPositiveDifference: 0,
    totalNegativeDifference: 0,
  });

  // Modal de finalización de cambio pendiente
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false);
  const [exchangeToFinalize, setExchangeToFinalize] = useState<Exchange | null>(null);
  const [finalizeNewProducts, setFinalizeNewProducts] = useState<ExchangeProduct[]>([]);
  const [finalizeTempProduct, setFinalizeTempProduct] = useState<Product | null>(null);
  const [finalizeTempQuantity, setFinalizeTempQuantity] = useState(1);
  const [finalizeTempPrice, setFinalizeTempPrice] = useState(0);
  const [finalizeTempUnitIds, setFinalizeTempUnitIds] = useState<string[]>([]);
  const [finalizePaymentCash, setFinalizePaymentCash] = useState(0);
  const [finalizePaymentTransfer, setFinalizePaymentTransfer] = useState(0);
  const [finalizePaymentOther, setFinalizePaymentOther] = useState(0);
  const [finalizeProductSearchTerm, setFinalizeProductSearchTerm] = useState('');
  const [finalizeSearchedProducts, setFinalizeSearchedProducts] = useState<Product[]>([]);
  const [isSearchingFinalizeProducts, setIsSearchingFinalizeProducts] = useState(false);
  const [hasSearchedFinalizeProducts, setHasSearchedFinalizeProducts] = useState(false);

  const itemsPerPage = 10;
  const currentUser = getCurrentUser();

  // Helper functions para filtrar IDs según contexto
  const getDisabledIds = (product: Product | null): UnitIdWithNote[] => {
    if (!product || !product.registered_ids) return [];
    return product.registered_ids.filter((idObj: UnitIdWithNote) => idObj.disabled === true);
  };

  const getAvailableIds = (product: Product | null): UnitIdWithNote[] => {
    if (!product || !product.registered_ids) return [];
    return product.registered_ids.filter((idObj: UnitIdWithNote) => !idObj.disabled);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [exchangesData, productsData, statsData] = await Promise.all([
        getExchanges(),
        getAllProducts(),
        getExchangesStats()
      ]);
      setExchanges(exchangesData);
      setProducts(productsData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchInvoices = async () => {
    if (!invoiceSearchTerm.trim()) {
      toast.error('Ingresa un término de búsqueda');
      return;
    }

    setIsSearchingInvoices(true);
    try {
      const results = await searchInvoicesForExchange(invoiceSearchTerm);
      setSearchedInvoices(results);
      setHasSearchedInvoices(true);

      if (results.length === 0) {
        toast.info('No se encontraron facturas');
      }
    } catch (error) {
      console.error('Error searching invoices:', error);
      toast.error('Error al buscar facturas');
    } finally {
      setIsSearchingInvoices(false);
    }
  };

  const handleSearchProducts = async () => {
    if (!productSearchTerm.trim()) {
      toast.error('Ingresa un término de búsqueda');
      return;
    }

    setIsSearchingProducts(true);
    try {
      const results = await searchProductsForInvoice(productSearchTerm);
      setSearchedProducts(results);
      setHasSearchedProducts(true);

      if (results.length === 0) {
        toast.info('No se encontraron productos');
      }
    } catch (error) {
      console.error('Error searching products:', error);
      toast.error('Error al buscar productos');
    } finally {
      setIsSearchingProducts(false);
    }
  };

  const handleSearchFinalizeProducts = async () => {
    if (!finalizeProductSearchTerm.trim()) {
      toast.error('Ingresa un término de búsqueda');
      return;
    }

    setIsSearchingFinalizeProducts(true);
    try {
      const results = await searchProductsForInvoice(finalizeProductSearchTerm);
      setFinalizeSearchedProducts(results);
      setHasSearchedFinalizeProducts(true);

      if (results.length === 0) {
        toast.info('No se encontraron productos');
      }
    } catch (error) {
      console.error('Error searching products:', error);
      toast.error('Error al buscar productos');
    } finally {
      setIsSearchingFinalizeProducts(false);
    }
  };

  const handleOpenDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setExchangeType('invoice');
    setFlowStep('search-invoice');
    setInvoiceSearchTerm('');
    setSearchedInvoices([]);
    setHasSearchedInvoices(false);
    setSelectedInvoice(null);
    setProductsToReturn([]);
    setNewProducts([]);
    setTempProduct(null);
    setTempQuantity(1);
    setTempPrice(0);
    setTempUnitIds([]);
    setPaymentCash(0);
    setPaymentTransfer(0);
    setPaymentOther(0);
    setProductSearchTerm('');
    setSearchedProducts([]);
    setHasSearchedProducts(false);
  };

  const handleSelectInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setFlowStep('select-return-products');
  };

  const handleToggleReturnProduct = (item: any, checked: boolean) => {
    if (checked) {
      if (item.productId.startsWith('common-')) {
        toast.error('Los productos comunes no se pueden intercambiar');
        return;
      }
      const product = products.find(p => p.id === item.productId);
      if (!product) return;

      const initialUnitIds = item.unitIds && item.unitIds.length > 0
        ? [item.unitIds[0]]
        : undefined;

      const exchangeProduct: ExchangeProduct = {
        productId: item.productId,
        productName: item.productName,
        quantity: 1,
        price: item.price,
        total: item.price * 1,
        unitIds: initialUnitIds,
      };
      setProductsToReturn([...productsToReturn, exchangeProduct]);
    } else {
      setProductsToReturn(productsToReturn.filter(p => p.productId !== item.productId));
    }
  };

  const handleUpdateReturnQuantity = (productId: string, newQty: number, maxQty: number, item: any) => {
    const qty = Math.max(1, Math.min(newQty, maxQty));
    setProductsToReturn(prev => prev.map(p => {
      if (p.productId !== productId) return p;
      // Ajustar unitIds si hay más seleccionados de los que caben
      let unitIds = p.unitIds;
      if (unitIds && unitIds.length > qty) {
        unitIds = unitIds.slice(0, qty);
      }
      return { ...p, quantity: qty, total: p.price * qty, unitIds };
    }));
  };

  const handleToggleReturnUnitId = (productId: string, unitId: string, maxQty: number) => {
    setProductsToReturn(prev => prev.map(p => {
      if (p.productId !== productId) return p;
      const current = p.unitIds || [];
      let updated: string[];
      if (current.includes(unitId)) {
        updated = current.filter(id => id !== unitId);
        if (updated.length === 0) updated = current; // no deseleccionar el último
      } else {
        if (current.length >= maxQty) {
          toast.error(`Solo puedes seleccionar hasta ${maxQty} unidad(es)`);
          return p;
        }
        updated = [...current, unitId];
      }
      return { ...p, quantity: updated.length, total: p.price * updated.length, unitIds: updated };
    }));
  };

  const handleAddNewProduct = () => {
    if (!tempProduct) {
      toast.error('Selecciona un producto');
      return;
    }

    if (tempQuantity <= 0) {
      toast.error('La cantidad debe ser mayor a 0');
      return;
    }

    // Validar IDs únicas si aplica
    if (tempProduct.use_unit_ids) {
      const availableIds = getAvailableIds(tempProduct);
      if (tempUnitIds.length !== tempQuantity) {
        toast.error(`Debes seleccionar ${tempQuantity} ID(s) única(s)`);
        return;
      }
    }

    const newProduct: ExchangeProduct = {
      productId: tempProduct.id,
      productName: tempProduct.name,
      quantity: tempQuantity,
      price: tempPrice,
      total: tempPrice * tempQuantity,
      unitIds: tempUnitIds.length > 0 ? tempUnitIds : undefined,
    };

    setNewProducts([...newProducts, newProduct]);

    // Limpiar temporales
    setTempProduct(null);
    setTempQuantity(1);
    setTempPrice(0);
    setTempUnitIds([]);
  };

  const handleRemoveNewProduct = (index: number) => {
    setNewProducts(newProducts.filter((_, i) => i !== index));
  };

  const handleAddFinalizeProduct = () => {
    if (!finalizeTempProduct) {
      toast.error('Selecciona un producto');
      return;
    }

    if (finalizeTempQuantity <= 0) {
      toast.error('La cantidad debe ser mayor a 0');
      return;
    }

    // Validar stock
    if (finalizeTempProduct.stock < finalizeTempQuantity) {
      toast.error(`Stock insuficiente. Disponible: ${finalizeTempProduct.stock}`);
      return;
    }

    // Validar IDs únicas si aplica
    if (finalizeTempProduct.use_unit_ids) {
      const availableIds = getAvailableIds(finalizeTempProduct);
      if (availableIds.length < finalizeTempQuantity) {
        toast.error('No hay suficientes IDs únicas disponibles');
        return;
      }
      if (finalizeTempUnitIds.length !== finalizeTempQuantity) {
        toast.error(`Debes seleccionar ${finalizeTempQuantity} ID(s) única(s)`);
        return;
      }
    }

    const newProduct: ExchangeProduct = {
      productId: finalizeTempProduct.id,
      productName: finalizeTempProduct.name,
      quantity: finalizeTempQuantity,
      price: finalizeTempPrice,
      total: finalizeTempPrice * finalizeTempQuantity,
      unitIds: finalizeTempUnitIds.length > 0 ? finalizeTempUnitIds : undefined,
    };

    setFinalizeNewProducts([...finalizeNewProducts, newProduct]);

    // Limpiar temporales
    setFinalizeTempProduct(null);
    setFinalizeTempQuantity(1);
    setFinalizeTempPrice(0);
    setFinalizeTempUnitIds([]);
  };

  const handleRemoveFinalizeProduct = (index: number) => {
    setFinalizeNewProducts(finalizeNewProducts.filter((_, i) => i !== index));
  };

  const calculatePriceDifference = () => {
    const originalTotal = productsToReturn.reduce((sum, p) => sum + p.total, 0);
    const newTotal = newProducts.reduce((sum, p) => sum + p.total, 0);
    return newTotal - originalTotal;
  };

  const handleDelete = async (exchangeId: string, exchangeNumber: string) => {
    if (!confirm(`¿Estás seguro de eliminar el cambio ${exchangeNumber}?\n\nEsto revertirá los movimientos de inventario.`)) {
      return;
    }

    setIsLoading(true);
    try {
      const success = await deleteExchange(exchangeId);
      if (success) {
        toast.success('Cambio eliminado exitosamente');
        await loadData();
      } else {
        toast.error('Error al eliminar el cambio');
      }
    } catch (error) {
      console.error('Error deleting exchange:', error);
      toast.error('Error al eliminar el cambio');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrintExchange = (exchange: Exchange) => {
    const html = generateExchangeReceiptHTML(exchange);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  const generateExchangeReceiptHTML = (exchange: Exchange): string => {
    const companyName = 'CELUMUNDO VIP';
    const exchangeDate = new Date(exchange.date).toLocaleString('es-ES', {
      timeZone: 'America/Bogota',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Productos devueltos
    const returnedProductsHTML = (exchange.original_products || [])
      .map((prod: ExchangeProduct) => {
        let idsHTML = '';
        if (prod.unitIds && prod.unitIds.length > 0) {
          const idsText = prod.unitIds.join(', ');
          idsHTML = `
            <div style="font-size: 7px; margin-top: 1mm; padding: 1mm; background: #f5f5f5;">
              <div>IDs: ${idsText}</div>
            </div>
          `;
        }

        return `
          <div class="product-item">
            <div style="margin-bottom: 1mm;">${prod.productName}</div>
            <div>${prod.quantity} x ${formatCOP(prod.price)} = ${formatCOP(prod.total)}</div>
            ${idsHTML}
          </div>
        `;
      })
      .join('');

    // Productos entregados
    const deliveredProductsHTML = (exchange.new_products || [])
      .map((prod: ExchangeProduct) => {
        let idsHTML = '';
        if (prod.unitIds && prod.unitIds.length > 0) {
          const idsText = prod.unitIds.join(', ');
          idsHTML = `
            <div style="font-size: 7px; margin-top: 1mm; padding: 1mm; background: #f5f5f5;">
              <div>IDs: ${idsText}</div>
            </div>
          `;
        }

        return `
          <div class="product-item">
            <div style="margin-bottom: 1mm;">${prod.productName}</div>
            <div>${prod.quantity} x ${formatCOP(prod.price)} = ${formatCOP(prod.total)}</div>
            ${idsHTML}
          </div>
        `;
      })
      .join('');

    const difference = exchange.price_difference || 0;
    const differenceLabel = difference > 0 ? 'CLIENTE DEBE PAGAR' : difference < 0 ? 'SE REEMBOLSO AL CLIENTE' : 'SIN DIFERENCIA';

    // Método de pago si hay diferencia
    let paymentHTML = '';
    if (difference !== 0 && exchange.payment_method) {
      const parts: string[] = [];
      if (exchange.payment_cash && exchange.payment_cash > 0) parts.push(`• Efectivo: ${formatCOP(exchange.payment_cash)}`);
      if (exchange.payment_transfer && exchange.payment_transfer > 0) parts.push(`• Transferencia: ${formatCOP(exchange.payment_transfer)}`);
      if (exchange.payment_other && exchange.payment_other > 0) parts.push(`• Otros: ${formatCOP(exchange.payment_other)}`);

      if (parts.length > 0) {
        paymentHTML = `
          <div style="margin-bottom: 3mm; font-size: 8px; border-bottom: 1px solid black; padding-bottom: 2mm;">
            <div style="margin-bottom: 1mm; font-size: 9px;">METODO DE PAGO:</div>
            ${parts.map(p => `<div style="margin-bottom: 1mm;">${p}</div>`).join('')}
          </div>
        `;
      }
    }

    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
            padding: 0;
          }
          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            width: 70mm;
            max-width: 70mm;
            font-family: 'Arial', 'Helvetica Neue', Helvetica, sans-serif;
            font-size: 11px;
            font-weight: 500;
            padding: 2mm 3mm;
            background: white;
            color: #000;
            margin: 0;
            line-height: 1.5;
          }
          .header {
            text-align: center;
            margin-bottom: 3mm;
            border-bottom: 2px solid black;
            padding-bottom: 2mm;
          }
          .info {
            margin-bottom: 3mm;
            font-size: 10px;
            border-bottom: 1px solid black;
            padding-bottom: 2mm;
          }
          .products {
            margin-bottom: 3mm;
            border-bottom: 1px solid black;
            padding-bottom: 2mm;
          }
          .product-item {
            margin-bottom: 2mm;
            font-size: 10px;
          }
          .total-section {
            margin: 3mm 0;
            border-top: 2px solid black;
            border-bottom: 2px solid black;
            padding: 3mm 0;
            text-align: center;
            background: #f0f0f0;
          }
          .total-label {
            font-size: 11px;
            font-weight: 800;
            margin-bottom: 2mm;
            color: #000;
          }
          .total-amount {
            font-size: 16px;
            font-weight: 800;
            color: #000;
          }
          .footer {
            text-align: center;
            font-size: 10px;
            margin-top: 3mm;
            padding-top: 2mm;
            color: #000;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="font-size: 15px; font-weight: 800; margin-bottom: 2mm; color: #000;">${companyName}</div>
          <div style="font-size: 13px; font-weight: 700; margin-bottom: 1mm; color: #000;">COMPROBANTE DE CAMBIO</div>
          <div style="font-size: 12px; font-weight: 500; color: #000;">No. ${exchange.exchange_number}</div>
        </div>

        <div class="info">
          <div style="margin-bottom: 1mm; font-size: 11px; color: #000;">Fecha: ${exchangeDate}</div>
          <div style="margin-bottom: 1mm; font-size: 11px; color: #000;">Factura: ${exchange.invoice_number || '-'}</div>
          <div style="font-size: 11px; color: #000;">Cliente: ${exchange.customer_name || 'Sin nombre'}</div>
        </div>

        <div class="products">
          <div style="text-align: center; font-size: 12px; font-weight: 800; margin-bottom: 2mm; color: #000; background: #000; color: #fff; padding: 2mm;">PRODUCTOS DEVUELTOS</div>
          ${returnedProductsHTML}
        </div>

        <div class="products">
          <div style="text-align: center; font-size: 12px; font-weight: 800; margin-bottom: 2mm; color: #000; background: #000; color: #fff; padding: 2mm;">PRODUCTOS ENTREGADOS</div>
          ${deliveredProductsHTML}
        </div>

        <div class="total-section">
          <div class="total-label">${differenceLabel}</div>
          <div class="total-amount">${formatCOP(Math.abs(difference))}</div>
        </div>

        ${paymentHTML}

        <div class="footer">
          <div style="margin: 2mm 0; border-top: 1px solid black; padding-top: 2mm;"></div>
          <div style="font-size: 12px; font-weight: 800; margin-bottom: 2mm; color: #000;">GRACIAS POR SU COMPRA</div>
          <div style="font-size: 11px; font-weight: 500; margin-bottom: 1mm; color: #000;">${companyName}</div>
          <div style="font-size: 11px; font-weight: 500; margin-bottom: 1mm; color: #000;">www.celumundovip.com</div>
          <div style="font-size: 10px; color: #333;">${new Date().toLocaleString('es-ES')}</div>
        </div>

        <!-- Espacio adicional para que el comprobante salga completo -->
        <div style="height: 30mm; width: 100%;"></div>

        <!-- Comando de corte de papel (ESC/POS) -->
        <div style="page-break-after: always;"></div>
      </body>
    </html>
  `;
  };

  const handleSubmit = async () => {
    if (!selectedInvoice) {
      toast.error('Debes seleccionar una factura');
      return;
    }

    if (productsToReturn.length === 0) {
      toast.error('Debes seleccionar al menos un producto a devolver');
      return;
    }

    if (exchangeType !== 'pending' && newProducts.length === 0) {
      toast.error('Debes agregar al menos un producto nuevo');
      return;
    }

    // Validar diferencia de precio
    if (exchangeType !== 'pending') {
      const difference = calculatePriceDifference();
      if (difference !== 0) {
        const totalPayment = paymentCash + paymentTransfer + paymentOther;
        if (Math.abs(totalPayment - Math.abs(difference)) > 0.01) {
          toast.error(`El total de pagos debe ser igual a la diferencia: ${formatCOP(Math.abs(difference))}`);
          return;
        }
      }
    }

    if (!currentUser) return;

    setIsLoading(true);
    try {
      const exchangeData = {
        type: 'invoice' as const,
        status: exchangeType === 'pending' ? ('pending' as const) : ('completed' as const),
        invoice_id: selectedInvoice.id,
        invoice_number: selectedInvoice.number,
        customer_name: selectedInvoice.customer_name || 'Cliente general',

        // Arrays de productos
        original_products: productsToReturn,
        new_products: exchangeType === 'pending' ? [] : newProducts,

        // Compatibilidad con campos antiguos (primer producto de cada array)
        original_product_id: productsToReturn[0]?.productId || '',
        original_product_name: productsToReturn[0]?.productName || '',
        original_quantity: productsToReturn.reduce((sum, p) => sum + p.quantity, 0),
        original_price: productsToReturn[0]?.price || 0,
        original_total: productsToReturn.reduce((sum, p) => sum + p.total, 0),
        original_unit_ids: productsToReturn[0]?.unitIds,

        new_product_id: newProducts[0]?.productId,
        new_product_name: newProducts[0]?.productName,
        new_quantity: newProducts.reduce((sum, p) => sum + p.quantity, 0),
        new_price: newProducts[0]?.price || 0,
        new_total: newProducts.reduce((sum, p) => sum + p.total, 0),
        new_unit_ids: newProducts[0]?.unitIds,

        price_difference: calculatePriceDifference(),
        payment_cash: paymentCash,
        payment_transfer: paymentTransfer,
        payment_other: paymentOther,
        notes: '',
        registered_by: currentUser?.username || 'Usuario',
      };

      console.log('📤 [Exchanges] Enviando datos de cambio:', {
        invoice_id: exchangeData.invoice_id,
        invoice_number: exchangeData.invoice_number,
        productsToReturn: exchangeData.original_products,
        newProducts: exchangeData.new_products,
        type: exchangeData.type,
        status: exchangeData.status
      });

      const result = await addExchange(exchangeData);

      if (result) {
        console.log('✅ [Exchanges] Cambio creado:', result);
        toast.success('Cambio registrado exitosamente');
        setIsDialogOpen(false);
        loadData();
      } else {
        console.error('❌ [Exchanges] Error: addExchange retornó null');
        toast.error('Error al registrar el cambio');
      }
    } catch (error) {
      console.error('Error submitting exchange:', error);
      toast.error('Error al procesar el cambio');
    } finally {
      setIsLoading(false);
    }
  };

  // Filtrar cambios por búsqueda
  const filteredExchanges = exchanges.filter(exchange => {
    const searchLower = searchTerm.toLowerCase();
    return (
      exchange.exchange_number?.toLowerCase().includes(searchLower) ||
      exchange.original_product_name?.toLowerCase().includes(searchLower) ||
      exchange.new_product_name?.toLowerCase().includes(searchLower) ||
      exchange.customer_name?.toLowerCase().includes(searchLower) ||
      exchange.invoice_number?.toLowerCase().includes(searchLower)
    );
  });

  // Paginación
  const totalPages = Math.ceil(filteredExchanges.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedExchanges = filteredExchanges.slice(startIndex, startIndex + itemsPerPage);

  const priceDifference = calculatePriceDifference();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Cambios</h2>
          <p className="text-muted-foreground mt-1">Gestión de intercambio de productos por factura</p>
        </div>
        <Button onClick={handleOpenDialog} disabled={isLoading}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Cambio
        </Button>
      </div>

      {/* Tarjetas de Estadísticas */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              Total Cambios
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {stats.totalExchanges}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package2 className="h-4 w-4" />
              Por Factura
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {stats.exchangesByInvoice}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Diferencias Cobradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              COP {formatCOP(stats.totalPositiveDifference)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Diferencias Devueltas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              COP {formatCOP(stats.totalNegativeDifference)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Búsqueda */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar por número, producto, cliente..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-10"
          />
        </div>
      </div>

      {/* Lista de Cambios */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Cambios</CardTitle>
        </CardHeader>
        <CardContent>
          {paginatedExchanges.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ArrowRightLeft className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay cambios registrados</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-3 text-sm font-medium">Número</th>
                      <th className="text-left py-3 px-3 text-sm font-medium">Fecha</th>
                      <th className="text-left py-3 px-3 text-sm font-medium">Factura</th>
                      <th className="text-left py-3 px-3 text-sm font-medium">Cliente</th>
                      <th className="text-left py-3 px-3 text-sm font-medium">Estado</th>
                      <th className="text-left py-3 px-3 text-sm font-medium">Producto(s) Devuelto(s)</th>
                      <th className="text-left py-3 px-3 text-sm font-medium">Producto(s) Entregado(s)</th>
                      <th className="text-right py-3 px-3 text-sm font-medium">Diferencia</th>
                      <th className="text-center py-3 px-3 text-sm font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedExchanges.map((exchange) => (
                      <tr key={exchange.id} className="border-b border-border hover:bg-muted/50">
                        <td className="py-3 px-3 text-sm font-medium">{exchange.exchange_number}</td>
                        <td className="py-3 px-3 text-sm">
                          {new Date(exchange.date).toLocaleDateString('es-ES')}
                        </td>
                        <td className="py-3 px-3 text-sm font-medium text-blue-600 dark:text-blue-400">
                          {exchange.invoice_number || '-'}
                        </td>
                        <td className="py-3 px-3 text-sm">
                          {exchange.customer_name || <span className="text-muted-foreground italic">Sin nombre</span>}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            exchange.status === 'completed'
                              ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                              : exchange.status === 'pending'
                              ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
                              : 'bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300'
                          }`}>
                            {exchange.status === 'completed' ? 'Completado' : exchange.status === 'pending' ? 'Pendiente' : 'Cancelado'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-sm">
                          {exchange.original_products && exchange.original_products.length > 0 ? (
                            <div className="space-y-1">
                              {exchange.original_products.map((prod, idx) => (
                                <div key={idx}>
                                  <div className="font-medium">{prod.productName}</div>
                                  <div className="text-xs text-muted-foreground">
                                    Cant: {prod.quantity} × COP {formatCOP(prod.price)}
                                  </div>
                                  {prod.unitIds && prod.unitIds.length > 0 && (
                                    <div className="text-xs text-blue-600 dark:text-blue-400 font-mono">
                                      IDs: {prod.unitIds.join(', ')}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <>
                              <div>{exchange.original_product_name}</div>
                              <div className="text-xs text-muted-foreground">
                                Cant: {exchange.original_quantity}
                              </div>
                            </>
                          )}
                        </td>
                        <td className="py-3 px-3 text-sm">
                          {exchange.new_products && exchange.new_products.length > 0 ? (
                            <div className="space-y-1">
                              {exchange.new_products.map((prod, idx) => (
                                <div key={idx}>
                                  <div className="font-medium">{prod.productName}</div>
                                  <div className="text-xs text-muted-foreground">
                                    Cant: {prod.quantity} × COP {formatCOP(prod.price)}
                                  </div>
                                  {prod.unitIds && prod.unitIds.length > 0 && (
                                    <div className="text-xs text-green-600 dark:text-green-400 font-mono">
                                      IDs: {prod.unitIds.join(', ')}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : exchange.new_product_name ? (
                            <>
                              <div>{exchange.new_product_name}</div>
                              <div className="text-xs text-muted-foreground">
                                Cant: {exchange.new_quantity}
                              </div>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Por definir</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {exchange.status === 'pending' ? (
                            <span className="text-xs text-muted-foreground italic">Por definir</span>
                          ) : exchange.price_difference !== undefined && exchange.price_difference !== null ? (
                            <span className={`text-sm font-medium ${
                              exchange.price_difference > 0
                                ? 'text-green-600 dark:text-green-400'
                                : exchange.price_difference < 0
                                ? 'text-orange-600 dark:text-orange-400'
                                : 'text-muted-foreground'
                            }`}>
                              {exchange.price_difference > 0 ? '+' : ''}
                              COP {formatCOP(Math.abs(exchange.price_difference))}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center justify-center gap-2">
                            {exchange.status === 'pending' ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setExchangeToFinalize(exchange);
                                    setFinalizeNewProducts([]);
                                    setFinalizeTempProduct(null);
                                    setFinalizeTempQuantity(1);
                                    setFinalizeTempPrice(0);
                                    setFinalizeTempUnitIds([]);
                                    setFinalizePaymentCash(0);
                                    setFinalizePaymentTransfer(0);
                                    setFinalizePaymentOther(0);
                                    setFinalizeProductSearchTerm('');
                                    setFinalizeSearchedProducts([]);
                                    setHasSearchedFinalizeProducts(false);
                                    setFinalizeDialogOpen(true);
                                  }}
                                  disabled={isLoading}
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30"
                                  title="Finalizar cambio"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    if (confirm(`¿Cancelar el cambio ${exchange.exchange_number}?\n\nSe restaurará el stock del producto original.`)) {
                                      setIsLoading(true);
                                      try {
                                        const success = await cancelExchange(exchange.id);
                                        if (success) {
                                          toast.success('Cambio cancelado exitosamente');
                                          await loadData();
                                        } else {
                                          toast.error('Error al cancelar el cambio');
                                        }
                                      } catch (error) {
                                        console.error('Error canceling exchange:', error);
                                        toast.error('Error al cancelar el cambio');
                                      } finally {
                                        setIsLoading(false);
                                      }
                                    }
                                  }}
                                  disabled={isLoading}
                                  className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                                  title="Cancelar cambio"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            ) : exchange.status === 'completed' ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handlePrintExchange(exchange)}
                                  disabled={isLoading}
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                  title="Imprimir comprobante"
                                >
                                  <Printer className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(exchange.id, exchange.exchange_number)}
                                  disabled={isLoading}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                  title="Eliminar cambio"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {startIndex + 1} a {Math.min(startIndex + itemsPerPage, filteredExchanges.length)} de {filteredExchanges.length} cambios
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      Página {currentPage} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog Nuevo Cambio */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {flowStep === 'search-invoice' && 'Buscar Factura'}
              {flowStep === 'select-return-products' && 'Productos a Devolver'}
              {flowStep === 'select-new-products' && 'Productos a Entregar'}
              {flowStep === 'payment' && 'Diferencia de Precio'}
            </DialogTitle>
            <DialogDescription>
              {flowStep === 'search-invoice' && 'Busca la factura de la cual se devolverán productos'}
              {flowStep === 'select-return-products' && 'Selecciona los productos que el cliente devuelve'}
              {flowStep === 'select-new-products' && 'Busca y agrega los productos que se entregarán al cliente'}
              {flowStep === 'payment' && 'Configura el método de pago de la diferencia'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Paso 1: Buscar Factura */}
            {flowStep === 'search-invoice' && (
              <div className="space-y-4">
                {/* Tipo de Cambio */}
                <div className="space-y-2">
                  <Label>Tipo de Cambio</Label>
                  <Select value={exchangeType} onValueChange={(value: 'invoice' | 'pending') => setExchangeType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="invoice">Cambio Completo</SelectItem>
                      <SelectItem value="pending">En Espera (Solo Devolución)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {exchangeType === 'invoice'
                      ? 'Se devolverán productos y se entregarán otros en el mismo proceso'
                      : 'Solo se registrará la devolución. Los productos a entregar se definirán después'}
                  </p>
                </div>

                {/* Buscador de Facturas */}
                <div className="space-y-2">
                  <Label>Buscar Factura</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        placeholder="Buscar por número de factura o nombre de cliente..."
                        value={invoiceSearchTerm}
                        onChange={(e) => setInvoiceSearchTerm(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSearchInvoices();
                          }
                        }}
                        className="pl-10"
                        autoFocus
                      />
                    </div>
                    <Button
                      onClick={handleSearchInvoices}
                      disabled={isSearchingInvoices || !invoiceSearchTerm.trim()}
                    >
                      {isSearchingInvoices ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Buscando...
                        </>
                      ) : (
                        <>
                          <Search className="mr-2 h-4 w-4" />
                          Buscar
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Resultados de búsqueda */}
                <div className="border border-border rounded-lg min-h-[300px] max-h-[400px] overflow-y-auto">
                  {!hasSearchedInvoices ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="font-medium">Ingresa un término de búsqueda</p>
                      <p className="text-sm mt-1">Busca por número de factura o nombre de cliente</p>
                    </div>
                  ) : searchedInvoices.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Package2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No se encontraron facturas</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {searchedInvoices.map((invoice) => (
                        <button
                          key={invoice.id}
                          onClick={() => handleSelectInvoice(invoice)}
                          className="w-full p-4 hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors text-left group"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                  {invoice.number}
                                </span>
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  invoice.status === 'paid'
                                    ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                                    : 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300'
                                }`}>
                                  {invoice.status === 'paid' ? 'Pagada' : 'Dev. Parcial'}
                                </span>
                              </div>
                              <p className="font-medium text-sm mb-1">{invoice.customer_name || 'Cliente general'}</p>
                              <p className="text-xs text-muted-foreground">
                                Fecha: {new Date(invoice.date).toLocaleDateString('es-ES')}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-green-600 dark:text-green-400">
                                COP {formatCOP(invoice.total)}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {invoice.items?.length || 0} producto(s)
                              </p>
                            </div>
                          </div>
                          <div className="mt-2 pt-2 border-t border-border opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-xs font-medium text-green-600 dark:text-green-400 text-center">
                              ✓ Click para seleccionar esta factura
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {hasSearchedInvoices && searchedInvoices.length > 0 && (
                  <p className="text-sm text-muted-foreground text-center">
                    Mostrando {searchedInvoices.length} factura{searchedInvoices.length !== 1 ? 's' : ''} encontrada{searchedInvoices.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            )}

            {/* Paso 2: Seleccionar Productos a Devolver */}
            {flowStep === 'select-return-products' && selectedInvoice && (
              <div className="space-y-4">
                {/* Info de factura */}
                <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-700 dark:text-blue-300">Factura Seleccionada</p>
                      <p className="text-lg font-bold text-blue-900 dark:text-blue-100">{selectedInvoice.number}</p>
                      <p className="text-sm text-blue-600 dark:text-blue-400">{selectedInvoice.customer_name}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedInvoice(null);
                        setProductsToReturn([]);
                        setFlowStep('search-invoice');
                      }}
                    >
                      Cambiar Factura
                    </Button>
                  </div>
                </div>

                {/* Lista de productos de la factura */}
                <div className="space-y-2">
                  <Label>Selecciona los productos que el cliente devuelve</Label>
                  <div className="border border-border rounded-lg divide-y divide-border max-h-[500px] overflow-y-auto">
                    {selectedInvoice.items && selectedInvoice.items.length > 0 ? (
                      selectedInvoice.items.map((item: any, index: number) => {
                        const selected = productsToReturn.find(p => p.productId === item.productId);
                        const isSelected = !!selected;
                        const hasUnitIds = item.unitIds && item.unitIds.length > 0;

                        return (
                          <div
                            key={index}
                            className={`p-4 transition-colors ${
                              isSelected ? 'bg-red-50 dark:bg-red-950/30 border-l-4 border-red-500' : 'hover:bg-muted/50'
                            }`}
                          >
                            {/* Fila principal: checkbox + nombre */}
                            <label className="flex items-center gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => handleToggleReturnProduct(item, e.target.checked)}
                                className="w-5 h-5 rounded border-gray-300 flex-shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium">{item.productName}</p>
                                <p className="text-sm text-muted-foreground">
                                  En factura: {item.quantity} × COP {formatCOP(item.price)} = COP {formatCOP(item.total)}
                                </p>
                              </div>
                              {isSelected && <CheckCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />}
                            </label>

                            {/* Controles inline cuando está seleccionado */}
                            {isSelected && (
                              <div className="mt-3 ml-8 space-y-3">
                                {/* Selector de cantidad (solo si qty > 1 en la factura) */}
                                {item.quantity > 1 && !hasUnitIds && (
                                  <div className="flex items-center gap-3">
                                    <span className="text-sm text-muted-foreground">Cantidad a devolver:</span>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        onClick={() => handleUpdateReturnQuantity(item.productId, (selected.quantity) - 1, item.quantity, item)}
                                      >
                                        −
                                      </Button>
                                      <span className="w-6 text-center font-semibold text-sm">{selected.quantity}</span>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        onClick={() => handleUpdateReturnQuantity(item.productId, (selected.quantity) + 1, item.quantity, item)}
                                      >
                                        +
                                      </Button>
                                      <span className="text-xs text-muted-foreground">/ {item.quantity}</span>
                                    </div>
                                    <span className="text-sm font-semibold text-red-600">
                                      = COP {formatCOP(selected.total)}
                                    </span>
                                  </div>
                                )}

                                {/* Selector de IDs individuales */}
                                {hasUnitIds && (
                                  <div>
                                    <p className="text-sm text-muted-foreground mb-2">
                                      Selecciona la(s) unidad(es) devuelta(s):
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      {item.unitIds.map((uid: string) => {
                                        const isUidSelected = selected.unitIds?.includes(uid) ?? false;
                                        return (
                                          <button
                                            key={uid}
                                            type="button"
                                            onClick={() => handleToggleReturnUnitId(item.productId, uid, item.quantity)}
                                            className={`px-3 py-1 rounded-full text-xs font-mono border transition-colors ${
                                              isUidSelected
                                                ? 'bg-red-500 text-white border-red-500'
                                                : 'bg-muted text-muted-foreground border-border hover:border-red-400'
                                            }`}
                                          >
                                            #{uid}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {selected.quantity} seleccionada(s) × COP {formatCOP(selected.price)} = <span className="font-semibold text-red-600">COP {formatCOP(selected.total)}</span>
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-8 text-center text-muted-foreground">
                        <p>Esta factura no tiene productos</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Resumen de selección */}
                {productsToReturn.length > 0 && (
                  <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm font-semibold text-red-900 dark:text-red-100 mb-2">
                      Productos Seleccionados para Devolución: {productsToReturn.length}
                    </p>
                    <p className="text-lg font-bold text-red-600 dark:text-red-400">
                      Total a Devolver: COP {formatCOP(productsToReturn.reduce((sum, p) => sum + p.total, 0))}
                    </p>
                  </div>
                )}

                {/* Botones */}
                <div className="flex justify-between pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedInvoice(null);
                      setProductsToReturn([]);
                      setFlowStep('search-invoice');
                    }}
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Volver
                  </Button>
                  <Button
                    onClick={() => {
                      if (productsToReturn.length === 0) {
                        toast.error('Selecciona al menos un producto');
                        return;
                      }
                      if (exchangeType === 'pending') {
                        // Si es cambio pendiente, ir directo a confirmar
                        handleSubmit();
                      } else {
                        // Si es cambio completo, ir a seleccionar productos nuevos
                        setFlowStep('select-new-products');
                      }
                    }}
                    disabled={productsToReturn.length === 0}
                  >
                    {exchangeType === 'pending' ? 'Registrar Devolución' : 'Siguiente'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Paso 3: Seleccionar Productos Nuevos */}
            {flowStep === 'select-new-products' && (
              <div className="space-y-4">
                {/* Buscador de productos */}
                <div className="space-y-2">
                  <Label>Buscar Productos a Entregar</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        placeholder="Buscar por código, nombre..."
                        value={productSearchTerm}
                        onChange={(e) => setProductSearchTerm(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSearchProducts();
                          }
                        }}
                        className="pl-10"
                      />
                    </div>
                    <Button
                      onClick={handleSearchProducts}
                      disabled={isSearchingProducts || !productSearchTerm.trim()}
                    >
                      {isSearchingProducts ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Buscando...
                        </>
                      ) : (
                        <>
                          <Search className="mr-2 h-4 w-4" />
                          Buscar
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Productos agregados */}
                {newProducts.length > 0 && (
                  <div className="space-y-2">
                    <Label>Productos a Entregar</Label>
                    <div className="space-y-2">
                      {newProducts.map((product, index) => (
                        <div key={index} className="flex items-center gap-2 border rounded p-3 bg-green-50 dark:bg-green-950/30">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{product.productName}</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              {product.quantity} × {formatCOP(product.price)} = {formatCOP(product.total)}
                            </div>
                            {product.unitIds && product.unitIds.length > 0 && (
                              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                IDs: {product.unitIds.join(', ')}
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveNewProduct(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded">
                      <p className="text-sm font-medium text-green-900 dark:text-green-100">
                        Total a Entregar: <span className="font-bold">COP {formatCOP(newProducts.reduce((sum, p) => sum + p.total, 0))}</span>
                      </p>
                    </div>
                  </div>
                )}

                {/* Resultados de búsqueda */}
                <div className="border border-border rounded-lg min-h-[250px] max-h-[350px] overflow-y-auto">
                  {!hasSearchedProducts ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="font-medium">Busca productos para entregar</p>
                      <p className="text-sm mt-1">Ingresa el código o nombre del producto</p>
                    </div>
                  ) : searchedProducts.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Package2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No se encontraron productos</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
                      {searchedProducts.map((product) => (
                        <button
                          key={product.id}
                          onClick={() => {
                            setTempProduct(product);
                            setTempPrice(product.final_price);
                            setTempQuantity(1);
                            setTempUnitIds([]);
                          }}
                          className={`p-3 border rounded-lg text-left hover:border-green-500 dark:hover:border-green-600 hover:bg-green-50 dark:hover:bg-green-950/20 transition-all ${
                            tempProduct?.id === product.id ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : 'border-border'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-mono font-bold bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                              {product.code}
                            </span>
                            {product.use_unit_ids && (
                              <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                                🔢 IDs
                              </span>
                            )}
                          </div>
                          <h4 className="font-semibold text-sm mb-1">{product.name}</h4>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Stock: {product.stock}</span>
                            <span className="font-bold text-green-600 dark:text-green-400">
                              {formatCOP(product.final_price)}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Configuración de producto seleccionado */}
                {tempProduct && (
                  <div className="p-4 border-2 border-green-500 dark:border-green-600 rounded-lg bg-green-50 dark:bg-green-950/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-green-900 dark:text-green-100">
                        Configurar: {tempProduct.name}
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setTempProduct(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-sm">Cantidad</Label>
                        <Input
                          type="number"
                          min="1"
                          value={tempQuantity}
                          onChange={(e) => setTempQuantity(parseInt(e.target.value) || 1)}
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-sm">Precio Unitario</Label>
                        <Input
                          type="number"
                          min="0"
                          value={tempPrice}
                          onChange={(e) => setTempPrice(parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>

                    {tempProduct.use_unit_ids && (
                      <div className="space-y-2">
                        <Label className="text-sm">IDs Únicas (Se requieren {tempQuantity} ID(s))</Label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {Array.from({ length: tempQuantity }).map((_, index) => {
                            const availableForSelection = getAvailableIds(tempProduct).filter(
                              idObj => !tempUnitIds.includes(idObj.id)
                            );

                            return (
                              <div key={index} className="space-y-1">
                                <Label className="text-xs text-muted-foreground">ID #{index + 1}</Label>
                                <Select
                                  value={tempUnitIds[index] || ''}
                                  onValueChange={(value) => {
                                    const newIds = [...tempUnitIds];
                                    newIds[index] = value;
                                    setTempUnitIds(newIds.filter(id => id));
                                  }}
                                >
                                  <SelectTrigger className="font-mono text-xs h-8">
                                    <SelectValue placeholder="Seleccionar" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableForSelection.map((idObj) => (
                                      <SelectItem key={idObj.id} value={idObj.id} className="font-mono text-xs">
                                        {idObj.id} {idObj.note && `(${idObj.note})`}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            );
                          })}
                        </div>
                        {tempUnitIds.length !== tempQuantity && (
                          <p className="text-xs text-red-600 dark:text-red-400">
                            ⚠️ Debes seleccionar {tempQuantity} ID(s)
                          </p>
                        )}
                      </div>
                    )}

                    <div className="p-2 bg-white dark:bg-gray-900 rounded">
                      <p className="text-sm font-medium">Total:</p>
                      <p className="text-lg font-bold text-green-600 dark:text-green-400">
                        COP {formatCOP(tempPrice * tempQuantity)}
                      </p>
                    </div>

                    <Button
                      onClick={handleAddNewProduct}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar Producto
                    </Button>
                  </div>
                )}

                {/* Botones */}
                <div className="flex justify-between pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setFlowStep('select-return-products')}
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Volver
                  </Button>
                  <Button
                    onClick={() => {
                      if (newProducts.length === 0) {
                        toast.error('Agrega al menos un producto a entregar');
                        return;
                      }
                      setFlowStep('payment');
                    }}
                    disabled={newProducts.length === 0}
                  >
                    Siguiente
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Paso 4: Diferencia de Precio */}
            {flowStep === 'payment' && (
              <div className="space-y-4">
                {/* Resumen */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-300 mb-1">Productos Devueltos</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                      COP {formatCOP(productsToReturn.reduce((sum, p) => sum + p.total, 0))}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {productsToReturn.length} producto(s)
                    </p>
                  </div>

                  <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-sm text-green-700 dark:text-green-300 mb-1">Productos Entregados</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      COP {formatCOP(newProducts.reduce((sum, p) => sum + p.total, 0))}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {newProducts.length} producto(s)
                    </p>
                  </div>
                </div>

                {/* Diferencia de precio */}
                <div className="p-4 border-2 border-dashed rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-lg">Diferencia de Precio</h3>
                    <div className={`text-3xl font-bold ${
                      priceDifference > 0
                        ? 'text-green-600 dark:text-green-400'
                        : priceDifference < 0
                        ? 'text-orange-600 dark:text-orange-400'
                        : 'text-muted-foreground'
                    }`}>
                      {priceDifference > 0 ? '+' : ''}COP {formatCOP(Math.abs(priceDifference))}
                    </div>
                  </div>

                  {priceDifference !== 0 && (
                    <div className="space-y-4">
                      <p className={`text-sm font-medium ${
                        priceDifference > 0
                          ? 'text-green-700 dark:text-green-300'
                          : 'text-orange-700 dark:text-orange-300'
                      }`}>
                        {priceDifference > 0 ? 'Cliente paga diferencia' : 'Se devuelve al cliente'}
                      </p>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Efectivo</Label>
                          <Input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={paymentCash || ''}
                            onChange={(e) => setPaymentCash(parseFloat(e.target.value) || 0)}
                            className="text-lg font-semibold"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Transferencia</Label>
                          <Input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={paymentTransfer || ''}
                            onChange={(e) => setPaymentTransfer(parseFloat(e.target.value) || 0)}
                            className="text-lg font-semibold"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Nequi / Otros</Label>
                          <Input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={paymentOther || ''}
                            onChange={(e) => setPaymentOther(parseFloat(e.target.value) || 0)}
                            className="text-lg font-semibold"
                          />
                        </div>
                      </div>

                      <div className={`p-3 rounded ${
                        priceDifference > 0
                          ? 'bg-green-50 dark:bg-green-950/30'
                          : 'bg-orange-50 dark:bg-orange-950/30'
                      }`}>
                        <p className={`text-sm ${
                          priceDifference > 0
                            ? 'text-green-700 dark:text-green-300'
                            : 'text-orange-700 dark:text-orange-300'
                        }`}>
                          Total ingresado: <span className="font-bold">
                            COP {formatCOP(paymentCash + paymentTransfer + paymentOther)}
                          </span>
                        </p>
                        {Math.abs((paymentCash + paymentTransfer + paymentOther) - Math.abs(priceDifference)) > 0.01 && (
                          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                            ⚠️ Debe sumar exactamente COP {formatCOP(Math.abs(priceDifference))}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {priceDifference === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No hay diferencia de precio
                    </p>
                  )}
                </div>

                {/* Botones */}
                <div className="flex justify-between pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setFlowStep('select-new-products')}
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Volver
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Procesando...' : 'Registrar Cambio'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Finalización de Cambio Pendiente */}
      <Dialog open={finalizeDialogOpen} onOpenChange={setFinalizeDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Finalizar Cambio Pendiente</DialogTitle>
            <DialogDescription>
              Selecciona los productos a entregar y configura el pago
            </DialogDescription>
          </DialogHeader>

          {exchangeToFinalize && (
            <div className="space-y-6">
              {/* Información del Producto Devuelto */}
              <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                <h3 className="font-semibold text-lg mb-3 text-red-900 dark:text-red-100">
                  Productos Devueltos
                </h3>
                <div className="space-y-2">
                  {exchangeToFinalize.original_products && exchangeToFinalize.original_products.length > 0 ? (
                    exchangeToFinalize.original_products.map((prod, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                        <div>
                          <p className="font-semibold">{prod.productName}</p>
                          <p className="text-sm text-muted-foreground">
                            Cantidad: {prod.quantity} × COP {formatCOP(prod.price)}
                          </p>
                        </div>
                        <p className="font-bold text-red-600 dark:text-red-400">
                          COP {formatCOP(prod.total)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold">{exchangeToFinalize.original_product_name}</p>
                        <p className="text-sm text-muted-foreground">
                          Cantidad: {exchangeToFinalize.original_quantity}
                        </p>
                      </div>
                      <p className="font-bold text-red-600 dark:text-red-400">
                        COP {formatCOP(exchangeToFinalize.original_total)}
                      </p>
                    </div>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-800">
                  <p className="font-bold text-lg text-red-600 dark:text-red-400">
                    Total Devuelto: COP {formatCOP(exchangeToFinalize.original_total)}
                  </p>
                </div>
              </div>

              {/* Buscador de productos */}
              <div className="space-y-2">
                <Label>Buscar Productos a Entregar</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Buscar por código, nombre..."
                      value={finalizeProductSearchTerm}
                      onChange={(e) => setFinalizeProductSearchTerm(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSearchFinalizeProducts();
                        }
                      }}
                      className="pl-10"
                    />
                  </div>
                  <Button
                    onClick={handleSearchFinalizeProducts}
                    disabled={isSearchingFinalizeProducts || !finalizeProductSearchTerm.trim()}
                  >
                    {isSearchingFinalizeProducts ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Buscando...
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" />
                        Buscar
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Productos agregados */}
              {finalizeNewProducts.length > 0 && (
                <div className="space-y-2">
                  <Label>Productos a Entregar</Label>
                  <div className="space-y-2">
                    {finalizeNewProducts.map((product, index) => (
                      <div key={index} className="flex items-center gap-2 border rounded p-2 bg-green-50 dark:bg-green-950/30">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{product.productName}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {product.quantity} × {formatCOP(product.price)} = {formatCOP(product.total)}
                          </div>
                          {product.unitIds && product.unitIds.length > 0 && (
                            <div className="text-xs text-gray-500">
                              IDs: {product.unitIds.join(', ')}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveFinalizeProduct(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resultados de búsqueda */}
              <div className="border border-border rounded-lg min-h-[200px] max-h-[300px] overflow-y-auto">
                {!hasSearchedFinalizeProducts ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">Busca productos para entregar</p>
                  </div>
                ) : finalizeSearchedProducts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No se encontraron productos</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
                    {finalizeSearchedProducts.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => {
                          setFinalizeTempProduct(product);
                          setFinalizeTempPrice(product.final_price);
                          setFinalizeTempQuantity(1);
                          setFinalizeTempUnitIds([]);
                        }}
                        className={`p-3 border rounded-lg text-left hover:border-green-500 transition-all ${
                          finalizeTempProduct?.id === product.id ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : 'border-border'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                            {product.code}
                          </span>
                          {product.use_unit_ids && (
                            <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1 rounded">
                              IDs
                            </span>
                          )}
                        </div>
                        <h4 className="font-semibold text-sm mb-1">{product.name}</h4>
                        <div className="flex items-center justify-between text-xs">
                          <span>Stock: {product.stock}</span>
                          <span className="font-bold text-green-600">
                            {formatCOP(product.final_price)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Configuración de producto */}
              {finalizeTempProduct && (
                <div className="p-4 border-2 border-green-500 rounded-lg bg-green-50 dark:bg-green-950/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">Configurar: {finalizeTempProduct.name}</h4>
                    <Button variant="ghost" size="sm" onClick={() => setFinalizeTempProduct(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-sm">Cantidad</Label>
                      <Input
                        type="number"
                        min="1"
                        max={finalizeTempProduct.stock}
                        value={finalizeTempQuantity}
                        onChange={(e) => setFinalizeTempQuantity(parseInt(e.target.value) || 1)}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-sm">Precio</Label>
                      <Input
                        type="number"
                        min="0"
                        value={finalizeTempPrice}
                        onChange={(e) => setFinalizeTempPrice(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  {finalizeTempProduct.use_unit_ids && (
                    <div className="space-y-2">
                      <Label className="text-sm">IDs Únicas ({finalizeTempQuantity} requerida(s))</Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {Array.from({ length: finalizeTempQuantity }).map((_, index) => {
                          const availableIds = getAvailableIds(finalizeTempProduct).filter(
                            idObj => !finalizeTempUnitIds.includes(idObj.id)
                          );

                          return (
                            <div key={index} className="space-y-1">
                              <Label className="text-xs">ID #{index + 1}</Label>
                              <Select
                                value={finalizeTempUnitIds[index] || ''}
                                onValueChange={(value) => {
                                  const newIds = [...finalizeTempUnitIds];
                                  newIds[index] = value;
                                  setFinalizeTempUnitIds(newIds.filter(id => id));
                                }}
                              >
                                <SelectTrigger className="font-mono text-xs h-8">
                                  <SelectValue placeholder="Sel." />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableIds.map((idObj) => (
                                    <SelectItem key={idObj.id} value={idObj.id} className="font-mono text-xs">
                                      {idObj.id} {idObj.note && `(${idObj.note})`}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <Button onClick={handleAddFinalizeProduct} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar
                  </Button>
                </div>
              )}

              {/* Diferencia de Precio */}
              {finalizeNewProducts.length > 0 && (() => {
                const newTotal = finalizeNewProducts.reduce((sum, p) => sum + p.total, 0);
                const difference = newTotal - exchangeToFinalize.original_total;

                return (
                  <div className="p-4 border-2 border-dashed rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold">Diferencia de Precio</h3>
                      <div className={`text-2xl font-bold ${
                        difference > 0 ? 'text-green-600' : difference < 0 ? 'text-orange-600' : ''
                      }`}>
                        {difference > 0 ? '+' : ''}COP {formatCOP(Math.abs(difference))}
                      </div>
                    </div>

                    {difference !== 0 && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-sm">Efectivo</Label>
                            <Input
                              type="number"
                              min="0"
                              value={finalizePaymentCash || ''}
                              onChange={(e) => setFinalizePaymentCash(parseFloat(e.target.value) || 0)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-sm">Transferencia</Label>
                            <Input
                              type="number"
                              min="0"
                              value={finalizePaymentTransfer || ''}
                              onChange={(e) => setFinalizePaymentTransfer(parseFloat(e.target.value) || 0)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-sm">Nequi/Otros</Label>
                            <Input
                              type="number"
                              min="0"
                              value={finalizePaymentOther || ''}
                              onChange={(e) => setFinalizePaymentOther(parseFloat(e.target.value) || 0)}
                            />
                          </div>
                        </div>

                        <div className="p-2 bg-muted rounded text-sm">
                          Total: <span className="font-bold">
                            COP {formatCOP(finalizePaymentCash + finalizePaymentTransfer + finalizePaymentOther)}
                          </span>
                          {Math.abs((finalizePaymentCash + finalizePaymentTransfer + finalizePaymentOther) - Math.abs(difference)) > 0.01 && (
                            <p className="text-red-600 text-xs mt-1">
                              ⚠️ Debe ser COP {formatCOP(Math.abs(difference))}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Botones */}
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setFinalizeDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={async () => {
                    if (finalizeNewProducts.length === 0) {
                      toast.error('Agrega al menos un producto');
                      return;
                    }

                    const newTotal = finalizeNewProducts.reduce((sum, p) => sum + p.total, 0);
                    const difference = newTotal - exchangeToFinalize.original_total;

                    if (difference !== 0) {
                      const totalPayment = finalizePaymentCash + finalizePaymentTransfer + finalizePaymentOther;
                      if (Math.abs(totalPayment - Math.abs(difference)) > 0.01) {
                        toast.error(`El pago debe ser ${formatCOP(Math.abs(difference))}`);
                        return;
                      }
                    }

                    setIsLoading(true);
                    try {
                      const success = await finalizeExchange(
                        exchangeToFinalize.id,
                        {
                          new_products: finalizeNewProducts,
                          payment_method: difference > 0 ? 'Mixto' : undefined,
                          payment_cash: finalizePaymentCash,
                          payment_transfer: finalizePaymentTransfer,
                          payment_other: finalizePaymentOther,
                        }
                      );

                      if (success) {
                        toast.success('Cambio finalizado');
                        setFinalizeDialogOpen(false);
                        await loadData();
                      } else {
                        toast.error('Error al finalizar');
                      }
                    } catch (error) {
                      toast.error('Error al procesar');
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  disabled={isLoading}
                >
                  {isLoading ? 'Procesando...' : 'Finalizar'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
