import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useBlocker } from 'react-router';
import { useTaskQueue } from '../contexts/TaskQueueContext';
import {
  ArrowLeft, Plus, Trash2, Receipt, CreditCard, Loader2, Scan, Search,
  Filter, ChevronRight, UserPlus, CheckCircle, Banknote, Smartphone,
  DollarSign, FileText, Percent, AlertTriangle, Check, X, Package,
  Landmark, Hash, Calendar, User, ArrowRightLeft, Pencil, Info, BookUser,
} from 'lucide-react';
import {
  getAllProducts, getDepartments, getCustomers, addInvoice, canCreateInvoice,
  getCurrentUser, addCreditHistory, updateCustomer, getInvoices,
  searchInvoiceCustomers, getInvoiceCustomerByName, addInvoiceCustomer,
  searchInvoiceCustomersByQuery,
  getCreditNotesByCustomer, applyCreditNoteBalance, addCreditPayment,
  getColombiaDate, getCurrentCompany, supabase,
  type Customer, type InvoiceCustomer, type CreditNote,
} from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { toast } from 'sonner';
import { formatCOP } from '../lib/currency';
import { CreditWarningModal } from '../components/CreditWarningModal';
import { CreditLimitExceededModal } from '../components/CreditLimitExceededModal';

// ─── Types ──────────────────────────────────────────────────────────────────

type WizardStep = 1 | 2 | 3 | 4;
type InvoiceType = 'regular' | 'credit';
type PaymentMethod = 'cash' | 'transfer' | 'nequi' | 'daviplata' | 'mixed';
type InvoiceStatus = 'paid' | 'pending_confirmation';

interface CartItem {
  productId: string;
  productName: string;
  productCode: string;
  quantity: number;
  price: number;
  total: number;
  useUnitIds?: boolean;
  unitIds?: string[];
  availableIds?: Array<{ id: string; note: string }>;
  unitIdNotes?: { [id: string]: string };
  price1?: number;
  price2?: number;
  finalPrice?: number;
  currentCost?: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  nequi: 'Nequi',
  daviplata: 'Daviplata',
  mixed: 'Mixto',
};

const STEPS = [
  { n: 1, title: 'Información', sub: 'Datos de cliente y factura' },
  { n: 2, title: 'Productos', sub: 'Agregar productos' },
  { n: 3, title: 'Pago', sub: 'Seleccionar método' },
  { n: 4, title: 'Resumen', sub: 'Verificar y emitir' },
];

const CATALOG_PER_PAGE = 12;

// ─── Component ───────────────────────────────────────────────────────────────

export function NewInvoice() {
  const navigate = useNavigate();
  const { addTask, updateTask } = useTaskQueue();
  const shouldProceedRef = useRef(false);

  // Wizard
  const [step, setStep] = useState<WizardStep>(1);
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('regular');

  // Data
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  // Catalog UI
  const [catalogTab, setCatalogTab] = useState<'catalog' | 'frequent'>('catalog');
  const [catalogSearchInput, setCatalogSearchInput] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogPage, setCatalogPage] = useState(1);
  const [selectedDept, setSelectedDept] = useState('all');
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [catalogTotalCount, setCatalogTotalCount] = useState(0);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const catalogDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Regular customer (optional)
  const [customerName, setCustomerName] = useState('');
  const [customerDocument, setCustomerDocument] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [isConsumerFinal, setIsConsumerFinal] = useState(false);
  const [docType, setDocType] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState<InvoiceCustomer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [customerFound, setCustomerFound] = useState<boolean | null>(null);
  const [showRegisterCustomer, setShowRegisterCustomer] = useState(false);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [registeringCustomer, setRegisteringCustomer] = useState(false);
  const customerSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const customerInputRef = useRef<HTMLDivElement>(null);

  // Agenda modal
  const [agendaOpen, setAgendaOpen] = useState(false);
  const [agendaSearch, setAgendaSearch] = useState('');
  const [agendaResults, setAgendaResults] = useState<InvoiceCustomer[]>([]);
  const [agendaLoading, setAgendaLoading] = useState(false);
  const [agendaNewName, setAgendaNewName] = useState('');
  const [agendaNewDoc, setAgendaNewDoc] = useState('');
  const [agendaNewPhone, setAgendaNewPhone] = useState('');
  const [agendaNewAddress, setAgendaNewAddress] = useState('');
  const [agendaSaving, setAgendaSaving] = useState(false);
  const [agendaShowNew, setAgendaShowNew] = useState(false);
  const agendaDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Credit customer (required for credit invoices)
  const [creditCustomers, setCreditCustomers] = useState<Customer[]>([]);
  const [selectedCreditCustomer, setSelectedCreditCustomer] = useState<Customer | null>(null);
  const [creditSearch, setCreditSearch] = useState('');
  const [showCreditDropdown, setShowCreditDropdown] = useState(false);
  const [creditAnalysis, setCreditAnalysis] = useState({
    usedCredit: 0, availableCredit: 0, creditAfterSale: 0,
    hasEnoughCredit: true, overdueDays: 0, totalDebt: 0,
  });
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showCreditLimitModal, setShowCreditLimitModal] = useState(false);
  const [warningData, setWarningData] = useState({ overdueDays: 0, totalDebt: 0 });
  const [availableCreditNotes, setAvailableCreditNotes] = useState<CreditNote[]>([]);
  const [selectedCreditNoteId, setSelectedCreditNoteId] = useState('');
  const [applyBalance, setApplyBalance] = useState(false);
  const [paymentTerm, setPaymentTerm] = useState('30');

  // Invoice metadata
  const [serie, setSerie] = useState('FV');
  const [emissionDate, setEmissionDate] = useState(getColombiaDate());
  const [notes, setNotes] = useState('');

  // Cart adjustments
  const [discountValue, setDiscountValue] = useState(0);
  const [discountIsPercent, setDiscountIsPercent] = useState(false);
  const [includeIVA, setIncludeIVA] = useState(false);

  // Payment (step 3)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceStatus>('paid');
  const [mixedCash, setMixedCash] = useState(0);
  const [mixedTransfer, setMixedTransfer] = useState(0);
  const [mixedNequi, setMixedNequi] = useState(0);
  const [mixedDaviplata, setMixedDaviplata] = useState(0);

  // Garantía (step 3)
  const [warrantyEnabled, setWarrantyEnabled] = useState(false);
  const [warrantyMonths, setWarrantyMonths] = useState(6);
  const [warrantyCategory, setWarrantyCategory] = useState<'electrodomesticos' | 'dispositivos'>('dispositivos');

  // Submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // Unit ID dialog
  const [unitIdDialogOpen, setUnitIdDialogOpen] = useState(false);
  const [currentItemIndex, setCurrentItemIndex] = useState<number | null>(null);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [unitIdNotes, setUnitIdNotes] = useState<{ [id: string]: string }>({});

  // Price edit modal
  const [priceEditOpen, setPriceEditOpen] = useState(false);
  const [priceEditIndex, setPriceEditIndex] = useState<number | null>(null);
  const [priceEditInput, setPriceEditInput] = useState('');

  // Price info modal
  const [priceInfoOpen, setPriceInfoOpen] = useState(false);
  const [priceInfoData, setPriceInfoData] = useState<{
    name: string; price1: number; price2: number; finalPrice: number; currentCost: number;
  } | null>(null);

  // Mobile view toggle (Step 2: catalog vs cart)
  const [mobileView, setMobileView] = useState<'catalog' | 'cart'>('catalog');

  // Barcode scanner
  const [barcodeBuffer, setBarcodeBuffer] = useState('');
  const barcodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const blocker = useBlocker(() => !shouldProceedRef.current && cart.length > 0);

  // ─── Load data ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      const [prods, depts, customers] = await Promise.all([
        getAllProducts(),
        getDepartments(),
        getCustomers(),
      ]);
      setAllProducts(prods);
      setDepartments(Array.isArray(depts) ? depts : []);
      setCreditCustomers(customers);
    };
    load();
  }, []);

  // ─── Catalog DB search ────────────────────────────────────────────────────

  const fetchCatalogProducts = useCallback(async (search: string, dept: string, page: number) => {
    setIsCatalogLoading(true);
    try {
      const company = getCurrentCompany();
      let query = supabase
        .from('products')
        .select('id, code, name, price1, price2, final_price, current_cost, stock, use_unit_ids, registered_ids, category', { count: 'exact' })
        .eq('company', company)
        .order('name');

      if (search.trim()) {
        query = query.or(`name.ilike.%${search.trim()}%,code.ilike.%${search.trim()}%`);
      }
      if (dept !== 'all') {
        query = query.eq('category', dept);
      }

      const from = (page - 1) * CATALOG_PER_PAGE;
      query = query.range(from, from + CATALOG_PER_PAGE - 1);

      const { data, count, error } = await query;
      if (!error && data) {
        setCatalogProducts(data);
        setCatalogTotalCount(count ?? 0);
      }
    } finally {
      setIsCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    if (catalogTab !== 'catalog') return;
    if (catalogDebounceRef.current) clearTimeout(catalogDebounceRef.current);
    const delay = catalogSearchInput.trim() ? 400 : 0;
    catalogDebounceRef.current = setTimeout(() => {
      setCatalogSearch(catalogSearchInput);
      fetchCatalogProducts(catalogSearchInput, selectedDept, catalogPage);
    }, delay);
    return () => { if (catalogDebounceRef.current) clearTimeout(catalogDebounceRef.current); };
  }, [catalogSearchInput, selectedDept, catalogPage, catalogTab, fetchCatalogProducts]);

  useEffect(() => {
    setSerie(invoiceType === 'credit' ? 'FC' : 'FV');
  }, [invoiceType]);

  useEffect(() => {
    if (invoiceType === 'credit' && selectedCreditCustomer) {
      analyzeCreditStatus();
      getCreditNotesByCustomer(selectedCreditCustomer.document).then(cns => {
        setAvailableCreditNotes(cns);
        setSelectedCreditNoteId(cns.length > 0 ? cns[0].id : '');
        setApplyBalance(false);
      });
    }
  }, [selectedCreditCustomer, cart, invoiceType]);

  // ─── Barcode scanner ───────────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      if (barcodeTimeoutRef.current) clearTimeout(barcodeTimeoutRef.current);

      if (e.key === 'Enter' && barcodeBuffer.length > 0) {
        const code = barcodeBuffer.trim();
        setBarcodeBuffer('');
        const cleanCode = code.replace(/A/g, '');
        let productCode = cleanCode;
        let scannedUnitId: string | null = null;

        if (/^\d{9}$/.test(cleanCode)) {
          productCode = cleanCode.substring(0, 5);
          scannedUnitId = cleanCode.substring(5, 9);
        } else if (/^\d{5}$/.test(cleanCode)) {
          productCode = cleanCode;
        } else if (cleanCode.includes('-')) {
          const parts = cleanCode.split('-');
          if (parts.length === 2) { productCode = parts[0]; scannedUnitId = parts[1]; }
        }

        const product = allProducts.find(p => {
          const numericCode = p.code?.replace(/[^0-9]/g, '');
          return numericCode === productCode || p.code === code;
        });

        if (product) {
          addProductToCart(product);
          if (scannedUnitId) toast.info(`Escaneado: ${product.name} (ID: ${scannedUnitId})`);
        } else {
          toast.error('Producto no encontrado');
        }
        return;
      }

      if (e.key.length === 1) {
        setBarcodeBuffer(prev => prev + e.key);
        barcodeTimeoutRef.current = setTimeout(() => setBarcodeBuffer(''), 100);
      }
    };

    window.addEventListener('keypress', handleKeyPress);
    return () => {
      window.removeEventListener('keypress', handleKeyPress);
      if (barcodeTimeoutRef.current) clearTimeout(barcodeTimeoutRef.current);
    };
  }, [barcodeBuffer, allProducts, cart]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerInputRef.current && !customerInputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ─── Calculations ─────────────────────────────────────────────────────────

  const calculateSubtotal = () => cart.reduce((s, i) => s + i.total, 0);

  const calculateDiscount = () => {
    const sub = calculateSubtotal();
    if (discountIsPercent) return sub * (Math.min(discountValue, 100) / 100);
    return Math.min(discountValue, sub);
  };

  const calculateIVAAmount = () => {
    if (!includeIVA) return 0;
    return (calculateSubtotal() - calculateDiscount()) * 0.19;
  };

  const calculateTotal = () => calculateSubtotal() - calculateDiscount() + calculateIVAAmount();

  const calculateDueDate = () => {
    const base = new Date(emissionDate + 'T00:00:00');
    base.setDate(base.getDate() + parseInt(paymentTerm || '30', 10));
    return base.toISOString().split('T')[0];
  };

  // ─── Cart operations ───────────────────────────────────────────────────────

  const addProductToCart = async (product: any) => {
    const price = invoiceType === 'credit'
      ? (product.price2 || product.final_price || 0)
      : (product.final_price || 0);

    const priceFields = {
      price1: product.price1 ?? 0,
      price2: product.price2 ?? 0,
      finalPrice: product.final_price ?? 0,
      currentCost: product.current_cost ?? 0,
    };

    if (product.use_unit_ids) {
      // Always add as a separate line item; filter out IDs already confirmed by other items of the same product
      const { getAvailableIds } = await import('../lib/unit-ids-utils');
      const allAvailableIds = getAvailableIds(product.registered_ids || []);
      const confirmedIds = cart
        .filter(i => i.productId === product.id)
        .flatMap(i => i.unitIds || []);
      const availableIds = allAvailableIds.filter(({ id }) => !confirmedIds.includes(id));

      if (availableIds.length === 0) {
        toast.error(`Sin unidades disponibles: ${product.name}`);
        return;
      }
      setCart(prev => [...prev, {
        productId: product.id,
        productName: product.name,
        productCode: product.code,
        quantity: 1,
        price,
        total: price,
        useUnitIds: true,
        unitIds: [],
        availableIds,
        ...priceFields,
      }]);
      toast.success(`${product.name} agregado — asigna las IDs únicas`);
      if (window.innerWidth < 1024) setMobileView('cart');
      return;
    }

    // Non-unit-id product: merge with existing item
    const existingIndex = cart.findIndex(i => i.productId === product.id && !i.useUnitIds);
    if (existingIndex >= 0) {
      setCart(prev => prev.map((item, i) => {
        if (i !== existingIndex) return item;
        const newQty = item.quantity + 1;
        return { ...item, quantity: newQty, total: item.price * newQty };
      }));
      return;
    }

    setCart(prev => [...prev, {
      productId: product.id,
      productName: product.name,
      productCode: product.code,
      quantity: 1,
      price,
      total: price,
      useUnitIds: false,
      ...priceFields,
    }]);
    toast.success(`${product.name} agregado`);
    if (window.innerWidth < 1024) setMobileView('cart');
  };

  const removeFromCart = (index: number) => setCart(prev => prev.filter((_, i) => i !== index));

  const updateCartQty = (index: number, qty: number) => {
    if (qty < 1) return;
    setCart(prev => prev.map((item, i) =>
      i === index ? { ...item, quantity: qty, total: item.price * qty } : item
    ));
  };

  const updateCartPrice = (index: number, price: number) => {
    if (price < 0) return;
    setCart(prev => prev.map((item, i) =>
      i === index ? { ...item, price, total: price * item.quantity } : item
    ));
  };

  const openPriceEdit = (index: number) => {
    setPriceEditIndex(index);
    setPriceEditInput(String(cart[index].price));
    setPriceEditOpen(true);
  };

  const confirmPriceEdit = () => {
    if (priceEditIndex === null) return;
    const newPrice = parseFloat(priceEditInput.replace(/[^0-9.]/g, ''));
    if (isNaN(newPrice) || newPrice < 0) {
      toast.error('Ingresa un precio válido');
      return;
    }
    updateCartPrice(priceEditIndex, newPrice);
    setPriceEditOpen(false);
    toast.success('Precio actualizado');
  };

  const openPriceInfoFromCart = (index: number) => {
    const item = cart[index];
    setPriceInfoData({
      name: item.productName,
      price1: item.price1 ?? 0,
      price2: item.price2 ?? 0,
      finalPrice: item.finalPrice ?? item.price,
      currentCost: item.currentCost ?? 0,
    });
    setPriceInfoOpen(true);
  };

  const openPriceInfoFromCatalog = (product: any) => {
    setPriceInfoData({
      name: product.name,
      price1: product.price1 ?? 0,
      price2: product.price2 ?? 0,
      finalPrice: product.final_price ?? 0,
      currentCost: product.current_cost ?? 0,
    });
    setPriceInfoOpen(true);
  };

  const isAdmin = getCurrentUser()?.role === 'admin';

  // ─── Customer search (regular) ────────────────────────────────────────────

  const triggerCustomerSearch = useCallback((name: string) => {
    if (customerSearchTimeout.current) clearTimeout(customerSearchTimeout.current);
    if (!name.trim() || name.trim().length < 2) {
      setCustomerSuggestions([]); setShowSuggestions(false); setCustomerFound(null); return;
    }
    customerSearchTimeout.current = setTimeout(async () => {
      setIsSearchingCustomer(true);
      try {
        const suggestions = await searchInvoiceCustomers(name);
        setCustomerSuggestions(suggestions);
        setShowSuggestions(suggestions.length > 0);
        const exact = await getInvoiceCustomerByName(name);
        setCustomerFound(!!exact);
        setShowRegisterCustomer(!exact);
      } catch {
        // silent
      } finally {
        setIsSearchingCustomer(false);
      }
    }, 500);
  }, []);

  const handleCustomerNameChange = (value: string) => {
    setCustomerName(value);
    if (invoiceType === 'regular') triggerCustomerSearch(value);
  };

  const handleSelectSuggestion = (c: InvoiceCustomer) => {
    setCustomerName(c.name);
    setCustomerDocument(c.document || '');
    setCustomerSuggestions([]); setShowSuggestions(false);
    setCustomerFound(true); setShowRegisterCustomer(false);
  };

  const handleRegisterCustomer = async () => {
    if (!customerName.trim()) return;
    setRegisteringCustomer(true);
    try {
      const result = await addInvoiceCustomer({ name: customerName.trim(), document: customerDocument || undefined });
      if (result) { toast.success(`Cliente "${customerName}" registrado`); setCustomerFound(true); setShowRegisterCustomer(false); }
      else toast.error('Error al registrar cliente');
    } catch { toast.error('Error al registrar cliente'); }
    finally { setRegisteringCustomer(false); }
  };

  // ─── Agenda handlers ──────────────────────────────────────────────────────

  const openAgenda = async () => {
    setAgendaOpen(true);
    setAgendaSearch('');
    setAgendaShowNew(false);
    setAgendaNewName('');
    setAgendaNewDoc('');
    setAgendaNewPhone('');
    setAgendaNewAddress('');
    setAgendaLoading(true);
    try {
      const results = await searchInvoiceCustomersByQuery('');
      setAgendaResults(results);
    } finally {
      setAgendaLoading(false);
    }
  };

  const handleAgendaSearch = (query: string) => {
    setAgendaSearch(query);
    if (agendaDebounce.current) clearTimeout(agendaDebounce.current);
    agendaDebounce.current = setTimeout(async () => {
      setAgendaLoading(true);
      try {
        const results = await searchInvoiceCustomersByQuery(query);
        setAgendaResults(results);
      } finally {
        setAgendaLoading(false);
      }
    }, 300);
  };

  const handleAgendaSelect = (c: InvoiceCustomer) => {
    setCustomerName(c.name);
    setCustomerDocument(c.document || '');
    setCustomerPhone((c as any).phone || '');
    setCustomerAddress((c as any).address || '');
    setIsConsumerFinal(false);
    setCustomerFound(true);
    setShowRegisterCustomer(false);
    setAgendaOpen(false);
    toast.success(`Cliente "${c.name}" seleccionado`);
  };

  const handleAgendaSaveNew = async () => {
    if (!agendaNewName.trim()) { toast.error('Ingresa el nombre del cliente'); return; }
    setAgendaSaving(true);
    try {
      const result = await addInvoiceCustomer({
        name: agendaNewName.trim(),
        document: agendaNewDoc || undefined,
        phone: agendaNewPhone || undefined,
        address: agendaNewAddress || undefined,
      } as any);
      if (result) {
        toast.success(`Cliente "${agendaNewName}" guardado en agenda`);
        handleAgendaSelect(result);
      } else {
        toast.error('Error al guardar cliente');
      }
    } catch { toast.error('Error al guardar cliente'); }
    finally { setAgendaSaving(false); }
  };

  // ─── Credit analysis ───────────────────────────────────────────────────────

  const analyzeCreditStatus = async () => {
    if (!selectedCreditCustomer) return;
    try {
      const allInvoices = await getInvoices();
      const customerInvoices = allInvoices.filter(
        inv => inv.customer_document === selectedCreditCustomer.document && inv.is_credit && inv.status === 'pending'
      );
      const totalDebt = customerInvoices.reduce((sum, inv) => sum + (inv.credit_balance || 0), 0);
      const creditLimit = selectedCreditCustomer.credit_limit ?? 0;
      const usedCredit = totalDebt;
      const availableCredit = creditLimit - usedCredit;
      const invoiceTotal = calculateTotal();
      const creditAfterSale = availableCredit - invoiceTotal;

      const today = new Date();
      let maxOverdueDays = 0;
      customerInvoices.forEach(inv => {
        if (inv.due_date) {
          const diff = Math.floor((today.getTime() - new Date(inv.due_date).getTime()) / 86400000);
          if (diff > maxOverdueDays) maxOverdueDays = diff;
        }
      });

      setCreditAnalysis({ usedCredit, availableCredit, creditAfterSale, hasEnoughCredit: creditAfterSale >= 0, overdueDays: maxOverdueDays, totalDebt });
      setWarningData({ overdueDays: maxOverdueDays, totalDebt });
    } catch { /* silent */ }
  };

  // ─── Product catalog filtering ────────────────────────────────────────────

  const getPagedProducts = () => {
    if (catalogTab === 'frequent') {
      return allProducts.filter(p => (p.stock ?? 0) > 0).slice(0, CATALOG_PER_PAGE);
    }
    return catalogProducts;
  };

  const getTotalPages = () => Math.ceil(catalogTotalCount / CATALOG_PER_PAGE);

  // ─── Navigation between steps ─────────────────────────────────────────────

  const handleContinueToPayment = () => {
    if (cart.length === 0) { toast.error('Agrega al menos un producto'); return; }
    if (invoiceType === 'credit' && !selectedCreditCustomer) { toast.error('Selecciona un cliente para la factura a crédito'); return; }
    for (const item of cart) {
      if (item.useUnitIds && (!item.unitIds || item.unitIds.length === 0)) {
        toast.error(`Asigná al menos una ID para ${item.productName}`); return;
      }
    }
    setStep(3);
  };

  const handleContinueToSummary = () => {
    if (invoiceType === 'regular' && invoiceStatus === 'paid' && paymentMethod === 'mixed') {
      const total = calculateTotal();
      const paid = mixedCash + mixedTransfer + mixedNequi + mixedDaviplata;
      if (Math.abs(paid - total) > 1) {
        toast.error(`Total pagado (${formatCOP(paid)}) no coincide con ${formatCOP(total)}`); return;
      }
    }
    setStep(4);
  };

  const handleFinalSubmit = async () => {
    if (invoiceType === 'credit' && selectedCreditCustomer) {
      if (selectedCreditCustomer.blocked) { setShowWarningModal(true); return; }
      if (creditAnalysis.overdueDays > 0) { setShowWarningModal(true); return; }
      if (!creditAnalysis.hasEnoughCredit) { setShowCreditLimitModal(true); return; }
    }
    await createInvoice();
  };

  // ─── Invoice creation ─────────────────────────────────────────────────────

  const createInvoice = async () => {
    setIsValidating(true);
    const validation = await canCreateInvoice();
    setIsValidating(false);

    if (!validation.canCreate) {
      toast.error(validation.message || 'No se puede crear factura en este momento', {
        duration: 8000,
        action: { label: 'Ir a Cierres', onClick: () => navigate('/sistema/cierres') },
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const user = getCurrentUser();
      const company = getCurrentCompany();
      const subtotal = calculateSubtotal();
      const tax = calculateIVAAmount();
      const total = calculateTotal();
      const itemsData = cart.map(item => ({
        productId: item.productId,
        productName: item.productName,
        productCode: item.productCode,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
        useUnitIds: item.useUnitIds,
        unitIds: item.unitIds,
        unitIdNotes: item.unitIdNotes,
      }));

      let invoiceData: any;

      const sharedFields = {
        serie,
        emission_date: emissionDate,
        notes: notes || undefined,
        discount_value: discountValue,
        discount_is_percent: discountIsPercent,
        include_iva: includeIVA,
        warranty_enabled: warrantyEnabled,
        warranty_months: warrantyEnabled ? warrantyMonths : null,
        warranty_category: warrantyEnabled ? warrantyCategory : null,
      };

      if (invoiceType === 'regular') {
        const paymentData: any = {};
        if (invoiceStatus === 'paid') {
          if (paymentMethod === 'mixed') {
            paymentData.payment_method = 'mixed';
            paymentData.payment_cash = mixedCash;
            paymentData.payment_transfer = mixedTransfer;
            paymentData.payment_other = mixedNequi + mixedDaviplata;
            paymentData.payment_note = `Nequi: ${formatCOP(mixedNequi)}, Daviplata: ${formatCOP(mixedDaviplata)}`;
          } else {
            paymentData.payment_method = PAYMENT_LABELS[paymentMethod];
            if (paymentMethod === 'cash') paymentData.payment_cash = total;
            else if (paymentMethod === 'transfer') paymentData.payment_transfer = total;
            else paymentData.payment_other = total;
          }
        }
        invoiceData = {
          type: 'regular' as const,
          customer_name: isConsumerFinal ? 'Consumidor Final' : (customerName || undefined),
          customer_document: customerDocument || undefined,
          customer_doc_type: docType || undefined,
          customer_phone: customerPhone || undefined,
          customer_address: customerAddress || undefined,
          items: itemsData,
          subtotal,
          tax,
          total,
          status: invoiceStatus,
          attended_by: user?.username || 'Usuario',
          ...sharedFields,
          ...paymentData,
        };
      } else {
        invoiceData = {
          type: 'credit' as const,
          is_credit: true,
          customer_id: selectedCreditCustomer!.id,
          customer_name: selectedCreditCustomer!.name,
          customer_document: selectedCreditCustomer!.document,
          items: itemsData,
          subtotal,
          tax,
          total,
          credit_balance: total,
          status: 'pending' as const,
          payment_method: null,
          payment_cash: 0,
          payment_transfer: 0,
          payment_other: 0,
          due_date: calculateDueDate(),
          payment_term_days: parseInt(paymentTerm || '30', 10),
          attended_by: user?.username || 'Usuario',
          ...sharedFields,
        };
      }

      const invoice = await addInvoice(invoiceData);
      if (!invoice) { toast.error('Error al crear la factura'); setIsSubmitting(false); return; }

      // Save common products
      const commonItems = cart.filter(i => i.productId.startsWith('common-'));
      if (commonItems.length > 0) {
        await supabase.from('common_products').insert(
          commonItems.map(item => ({
            company,
            invoice_id: invoice.id,
            invoice_number: invoice.number,
            product_name: item.productName.replace('[COMÚN] ', ''),
            price: item.price,
            quantity: item.quantity,
            total: item.total,
            created_by: user?.username || 'Usuario',
          }))
        );
      }

      // Apply credit note balance
      if (invoiceType === 'credit' && applyBalance && selectedCreditNoteId && selectedCreditCustomer) {
        const cn = availableCreditNotes.find(n => n.id === selectedCreditNoteId);
        if (cn) {
          const amountToApply = Math.min(cn.balance_remaining, total);
          await addCreditPayment({
            invoice_id: invoice.id,
            customer_document: selectedCreditCustomer.document,
            date: getColombiaDate(),
            amount: amountToApply,
            payment_method: 'nota_credito',
            notes: `Saldo a favor de Nota Crédito ${cn.number}`,
            registered_by: user?.username || 'Sistema',
          });
          await applyCreditNoteBalance(cn.id, amountToApply);
        }
      }

      const taskId = addTask({
        type: invoiceType === 'credit' ? 'credit_invoice' : 'invoice',
        message: `Procesando factura #${invoice.number}...`,
        data: { invoiceId: invoice.id, invoiceNumber: invoice.number },
      });

      localStorage.setItem('lastCreatedInvoice', JSON.stringify(invoice));
      shouldProceedRef.current = true;
      navigate('/sistema/facturacion');

      processInventory(invoice, cart, invoiceType, invoiceStatus, taskId);
    } catch (error) {
      console.error('Error creating invoice:', error);
      toast.error('Error al crear la factura');
      setIsSubmitting(false);
    }
  };

  const processInventory = async (invoice: any, items: CartItem[], type: InvoiceType, status: string, taskId: string) => {
    try {
      updateTask(taskId, { status: 'processing', progress: 10 });
      const company = getCurrentCompany();
      const productGroups = new Map<string, CartItem[]>();
      for (const item of items) {
        if (item.productId.startsWith('common-')) continue;
        if (!productGroups.has(item.productId)) productGroups.set(item.productId, []);
        productGroups.get(item.productId)!.push(item);
      }
      updateTask(taskId, { progress: 30 });

      const productIds = Array.from(productGroups.keys());
      const { data: prods } = await supabase
        .from('products').select('id, stock, registered_ids').in('id', productIds).eq('company', company);
      if (!prods) throw new Error('Error al obtener productos');

      updateTask(taskId, { progress: 50 });
      const productsMap = new Map(prods.map((p: any) => [p.id, p]));
      const productUpdates: any[] = [];
      const allMovements: any[] = [];

      for (const [productId, groupItems] of productGroups) {
        const current = productsMap.get(productId) as any;
        if (!current) continue;
        const totalQty = groupItems.reduce((s, i) => s + i.quantity, 0);
        const newStock = current.stock - totalQty;
        let newRegisteredIds = current.registered_ids;

        for (const item of groupItems) {
          if (item.useUnitIds && item.unitIds && item.unitIds.length > 0) {
            if (type === 'regular' && status === 'paid') {
              const { markIdsAsSold } = await import('../lib/unit-ids-utils');
              newRegisteredIds = markIdsAsSold(newRegisteredIds, item.unitIds);
            } else {
              const { disableIds } = await import('../lib/unit-ids-utils');
              newRegisteredIds = disableIds(newRegisteredIds, item.unitIds, invoice.id);
            }
          }
        }

        productUpdates.push({ id: productId, stock: newStock, registered_ids: newRegisteredIds, company });

        if (type === 'regular' && status === 'paid') {
          for (const item of groupItems) {
            allMovements.push({
              type: 'exit',
              product_id: item.productId,
              product_name: item.productName,
              quantity: item.quantity,
              reason: `Venta regular - Factura ${invoice.number}`,
              reference: invoice.number,
              user_name: getCurrentUser()?.username || 'Usuario',
              unit_ids: item.useUnitIds ? item.unitIds : [],
              date: new Date().toISOString(),
              company,
            });
          }
        }
      }

      updateTask(taskId, { progress: 70 });
      await Promise.all(productUpdates.map(u =>
        supabase.from('products').update({ stock: u.stock, registered_ids: u.registered_ids }).eq('id', u.id).eq('company', u.company)
      ));
      if (allMovements.length > 0) await supabase.from('movements').insert(allMovements);

      updateTask(taskId, { status: 'completed', progress: 100, message: `Factura #${invoice.number} procesada exitosamente` });
      toast.success(`Factura #${invoice.number} creada exitosamente`);
    } catch (error) {
      console.error('Error processing inventory:', error);
      updateTask(taskId, { status: 'error', progress: 0, message: `Error procesando factura #${invoice.number}`, error: String(error) });
    }
  };

  const handleCreditLimitExceededConfirm = async () => {
    if (!selectedCreditCustomer) return;
    try {
      setIsSubmitting(true);
      const newLimit = creditAnalysis.usedCredit + calculateTotal();
      await updateCustomer(selectedCreditCustomer.id, { credit_limit: newLimit });
      await addCreditHistory({
        customer_document: selectedCreditCustomer.document,
        event_type: 'credit_limit_change',
        description: `Límite aumentado a ${formatCOP(newLimit)} por factura que excede el límite`,
        amount: newLimit,
        registered_by: getCurrentUser()?.username || 'Sistema',
      });
      setSelectedCreditCustomer({ ...selectedCreditCustomer, credit_limit: newLimit });
      setShowCreditLimitModal(false);
      await createInvoice();
    } catch {
      toast.error('Error al actualizar límite de crédito');
      setIsSubmitting(false);
    }
  };

  const handleUnitIdsConfirm = () => {
    if (currentItemIndex === null) return;
    const item = cart[currentItemIndex];
    if (selectedUnitIds.length === 0) { toast.error('Selecciona al menos una ID'); return; }
    const notes: { [id: string]: string } = {};
    selectedUnitIds.forEach(id => { if (unitIdNotes[id]) notes[id] = unitIdNotes[id]; });
    const newQty = selectedUnitIds.length;
    setCart(prev => prev.map((ci, i) => {
      if (i === currentItemIndex) {
        return { ...ci, unitIds: selectedUnitIds, unitIdNotes: notes, quantity: newQty, total: ci.price * newQty };
      }
      // Remove the newly confirmed IDs from other items' availableIds for the same product
      if (ci.productId === item.productId && ci.useUnitIds) {
        return { ...ci, availableIds: (ci.availableIds || []).filter(({ id }) => !selectedUnitIds.includes(id)) };
      }
      return ci;
    }));
    setUnitIdDialogOpen(false);
    toast.success(`${newQty} ID${newQty !== 1 ? 's' : ''} asignada${newQty !== 1 ? 's' : ''} para ${item.productName}`);
  };

  // ─── Step 1 → 2 validation ─────────────────────────────────────────────────

  const handleContinueToCart = () => {
    if (invoiceType === 'credit' && !selectedCreditCustomer) {
      toast.error('Selecciona un cliente para la factura a crédito');
      return;
    }
    setStep(2);
  };

  // ─── Computed helpers ─────────────────────────────────────────────────────

  const currentStepDisplay = step;

  const filteredCreditCustomers = creditCustomers.filter(c =>
    c.name?.toLowerCase().includes(creditSearch.toLowerCase()) ||
    c.document?.toLowerCase().includes(creditSearch.toLowerCase())
  );

  const pagedProducts = getPagedProducts();
  const totalPages = getTotalPages();

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">

      {/* Navigation blocker dialog */}
      {blocker.state === 'blocked' && (
        <Dialog open>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>¿Salir sin guardar?</DialogTitle>
              <DialogDescription>Tienes productos en el carrito que se perderán.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => blocker.reset?.()}>Cancelar</Button>
              <Button variant="destructive" onClick={() => blocker.proceed?.()}>Salir de todos modos</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400 min-w-0">
            <button
              onClick={() => navigate('/sistema/facturacion')}
              className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors flex items-center gap-1 flex-shrink-0">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Facturación</span>
            </button>
            <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 hidden sm:block" />
            <span className="text-zinc-900 dark:text-zinc-100 font-medium truncate hidden sm:block">Nueva Factura</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-emerald-600 border-emerald-300 dark:border-emerald-700 dark:text-emerald-400 gap-1 text-xs px-2 py-0.5">
              <Scan className="w-3 h-3" />
              <span className="hidden sm:inline">Lector activo</span>
            </Badge>
            <span className="text-xs text-zinc-400 dark:text-zinc-500 hidden sm:block">{getCurrentUser()?.username}</span>
          </div>
        </div>
      </div>

      {/* ── Step wizard ───────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 sm:px-6 py-3 sm:py-5">
        <div className="flex items-center">
          {STEPS.map((s, idx) => {
            const isActive = currentStepDisplay === s.n;
            const isDone = currentStepDisplay > s.n;
            return (
              <div key={s.n} className="flex items-center flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold flex-shrink-0 transition-colors
                    ${isActive ? 'bg-emerald-600 text-white' : isDone ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500'}`}>
                    {isDone ? <Check className="w-3.5 h-3.5" /> : s.n}
                  </div>
                  <div className="min-w-0 hidden sm:block">
                    <p className={`text-sm font-medium truncate ${isActive ? 'text-zinc-900 dark:text-zinc-100' : isDone ? 'text-zinc-600 dark:text-zinc-400' : 'text-zinc-400 dark:text-zinc-600'}`}>{s.title}</p>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate hidden md:block">{s.sub}</p>
                  </div>
                  {/* Mobile: only show title for active step */}
                  <div className="min-w-0 sm:hidden">
                    {isActive && <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">{s.title}</p>}
                  </div>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-2 sm:mx-3 ${isDone ? 'bg-emerald-300 dark:bg-emerald-700' : 'bg-zinc-200 dark:bg-zinc-700'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 1 — Información del cliente y datos de la factura
      ════════════════════════════════════════════════════════════════════════ */}
      {step === 1 && (
        <div className="p-3 sm:p-6 flex justify-center">
          <div className="w-full max-w-3xl space-y-4">

            {/* Tipo de factura selector en tarjeta compacta */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
              <Label className="text-xs text-zinc-500 mb-2 block">Tipo de comprobante</Label>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { value: 'regular', label: 'Factura de Venta', icon: Receipt },
                  { value: 'credit', label: 'Factura a Crédito', icon: CreditCard },
                ] as const).map(({ value, label, icon: Icon }) => (
                  <button key={value} onClick={() => setInvoiceType(value)}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${invoiceType === value ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'}`}>
                    <Icon className={`w-5 h-5 flex-shrink-0 ${invoiceType === value ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400'}`} />
                    <span className={`text-sm font-medium ${invoiceType === value ? 'text-emerald-700 dark:text-emerald-300' : 'text-zinc-700 dark:text-zinc-300'}`}>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* ── Cliente ────────────────────────────────────────────────────── */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                  <User className="w-4 h-4 text-zinc-400" />
                  {invoiceType === 'credit' ? 'Cliente (requerido)' : 'Cliente (opcional)'}
                </h2>

                {invoiceType === 'regular' ? (
                  <div className="space-y-3">
                    <div ref={customerInputRef} className="relative">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                          <Input
                            placeholder="Buscar cliente (NIT, CC o nombre)"
                            value={customerName}
                            onChange={e => handleCustomerNameChange(e.target.value)}
                            className="pl-9 h-9"
                          />
                          {isSearchingCustomer && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-zinc-400" />
                          )}
                        </div>
                        
                      </div>
                      {showSuggestions && customerSuggestions.length > 0 && (
                        <div className="absolute z-50 top-full left-0 right-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg mt-1 max-h-44 overflow-y-auto">
                          {customerSuggestions.map((c, i) => (
                            <button key={i} className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors" onClick={() => handleSelectSuggestion(c)}>
                              <p className="font-medium text-zinc-900 dark:text-zinc-100">{c.name}</p>
                              {c.document && <p className="text-xs text-zinc-400">{c.document}</p>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-zinc-500 mb-1 block">Tipo de documento</Label>
                        <Select value={docType} onValueChange={setDocType}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Seleccionar" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cc">Cédula (CC)</SelectItem>
                            <SelectItem value="nit">NIT</SelectItem>
                            <SelectItem value="ce">Cédula Extranjería</SelectItem>
                            <SelectItem value="pasaporte">Pasaporte</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-zinc-500 mb-1 block">Número de documento</Label>
                        <Input className="h-9 text-sm" placeholder="Número" value={customerDocument} onChange={e => setCustomerDocument(e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-zinc-500 mb-1 block">Teléfono</Label>
                        <Input className="h-9 text-sm" placeholder="Contacto" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs text-zinc-500 mb-1 block">Dirección</Label>
                        <Input className="h-9 text-sm" placeholder="Dirección" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 pt-1">
                      <button
                        onClick={() => setIsConsumerFinal(!isConsumerFinal)}
                        className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${isConsumerFinal ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isConsumerFinal ? 'left-[18px]' : 'left-0.5'}`} />
                      </button>
                      <span className="text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer flex-1" onClick={() => setIsConsumerFinal(!isConsumerFinal)}>
                        Consumidor final
                      </span>
                      <button
                        onClick={openAgenda}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors"
                        title="Buscar cliente en agenda">
                        <BookUser className="w-3.5 h-3.5" />
                        Agenda
                      </button>
                    </div>
                    {showRegisterCustomer && customerName.trim().length >= 2 && customerFound === false && (
                      <Button size="sm" variant="outline" onClick={handleRegisterCustomer} disabled={registeringCustomer}
                        className="w-full text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950">
                        {registeringCustomer ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <UserPlus className="w-3.5 h-3.5 mr-2" />}
                        Registrar "{customerName}"
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                      <Input
                        placeholder="Buscar cliente (NIT, CC o nombre)"
                        value={creditSearch}
                        onChange={e => { setCreditSearch(e.target.value); setShowCreditDropdown(true); }}
                        onFocus={() => setShowCreditDropdown(true)}
                        className="pl-9 h-9 text-sm"
                      />
                      {showCreditDropdown && creditSearch.length >= 2 && filteredCreditCustomers.length > 0 && (
                        <div className="absolute z-50 top-full left-0 right-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg mt-1 max-h-44 overflow-y-auto">
                          {filteredCreditCustomers.slice(0, 10).map((c, i) => (
                            <button key={i} className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                              onClick={() => { setSelectedCreditCustomer(c); setCreditSearch(c.name); setShowCreditDropdown(false); }}>
                              <p className="font-medium text-zinc-900 dark:text-zinc-100">{c.name}</p>
                              <p className="text-xs text-zinc-400">{c.document}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {selectedCreditCustomer && (
                      <div className={`p-3 rounded-lg border ${creditAnalysis.overdueDays > 0 || !creditAnalysis.hasEnoughCredit ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30' : 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{selectedCreditCustomer.name}</p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">{selectedCreditCustomer.document}</p>
                          </div>
                          <button onClick={() => { setSelectedCreditCustomer(null); setCreditSearch(''); }} className="text-zinc-400 hover:text-zinc-600 mt-0.5">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        {selectedCreditCustomer.credit_limit && (
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs pt-2 border-t border-zinc-200 dark:border-zinc-700">
                            <div>
                              <p className="text-zinc-400">Cupo disponible</p>
                              <p className={`font-bold ${creditAnalysis.availableCredit < 0 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                {formatCOP(creditAnalysis.availableCredit)}
                              </p>
                            </div>
                            {creditAnalysis.overdueDays > 0 && (
                              <div>
                                <p className="text-zinc-400">Días de mora</p>
                                <p className="font-bold text-red-500">{creditAnalysis.overdueDays} días</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <Label className="text-xs text-zinc-500 mb-1 block">Plazo de pago (días)</Label>
                      <Input className="h-9 text-sm" type="number" min="1" value={paymentTerm} onChange={e => setPaymentTerm(e.target.value)} />
                    </div>

                    {availableCreditNotes.length > 0 && (
                      <div className="flex items-center gap-2.5 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                        <button onClick={() => setApplyBalance(!applyBalance)}
                          className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${applyBalance ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
                          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${applyBalance ? 'left-[18px]' : 'left-0.5'}`} />
                        </button>
                        <span className="text-xs text-zinc-600 dark:text-zinc-400">Aplicar saldo a favor disponible</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Datos de la factura ──────────────────────────────────────────── */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-zinc-400" />
                  Datos de la factura
                </h2>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-zinc-500 mb-1 block">Serie</Label>
                      <Input className="h-9 text-sm" value={serie} onChange={e => setSerie(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs text-zinc-500 mb-1 block">Número</Label>
                      <Input className="h-9 text-sm bg-zinc-50 dark:bg-zinc-800 text-zinc-400" value="000000" readOnly />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-zinc-500 mb-1 block">Fecha emisión</Label>
                      <Input className="h-9 text-sm" type="date" value={emissionDate} onChange={e => setEmissionDate(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs text-zinc-500 mb-1 block">Vencimiento</Label>
                      <Input
                        className={`h-9 text-sm ${invoiceType !== 'credit' ? 'bg-zinc-50 dark:bg-zinc-800 text-zinc-400' : ''}`}
                        type="date"
                        value={invoiceType === 'credit' ? calculateDueDate() : emissionDate}
                        readOnly
                        onChange={() => {}}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-zinc-500 mb-1 block">Vendedor</Label>
                      <Input className="h-9 text-sm bg-zinc-50 dark:bg-zinc-800" value={getCurrentUser()?.username || ''} readOnly />
                    </div>
                    <div>
                      <Label className="text-xs text-zinc-500 mb-1 block">Moneda</Label>
                      <Input className="h-9 text-xs bg-zinc-50 dark:bg-zinc-800" value="COP - Peso Colombiano" readOnly />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-zinc-500 mb-1 block">Notas</Label>
                    <textarea
                      className="w-full h-[80px] px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-zinc-400"
                      placeholder="Observaciones (opcional)..."
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Continuar button */}
            <Button
              onClick={handleContinueToCart}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium h-11">
              Continuar con el carrito
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 2 — Catálogo + Carrito
      ════════════════════════════════════════════════════════════════════════ */}
      {step === 2 && (
        <div className="p-2 sm:p-4 lg:p-6">
          {/* Mobile tab switcher */}
          <div className="flex lg:hidden mb-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setMobileView('catalog')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5 ${mobileView === 'catalog' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 dark:text-zinc-400'}`}>
              <Package className="w-3.5 h-3.5" />
              Catálogo
            </button>
            <button
              onClick={() => setMobileView('cart')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5 ${mobileView === 'cart' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 dark:text-zinc-400'}`}>
              <Receipt className="w-3.5 h-3.5" />
              Carrito
              {cart.length > 0 && (
                <span className="min-w-[16px] h-4 px-1 bg-emerald-500 text-white text-[9px] rounded-full font-bold flex items-center justify-center">{cart.length}</span>
              )}
            </button>
          </div>

          <div className="flex flex-col lg:flex-row gap-2 sm:gap-4 lg:gap-6 items-start">

            {/* ── Catálogo (izquierda) ──────────────────────────────────────────── */}
            <div className={`${mobileView === 'cart' ? 'hidden lg:block' : 'block'} flex-1 min-w-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden`}>

              {/* Tabs + search — header compacto */}
              <div className="border-b border-zinc-200 dark:border-zinc-700">
                {/* Sub-tabs */}
                <div className="flex px-3 sm:px-5">
                  {(['catalog', 'frequent'] as const).map(tab => (
                    <button key={tab}
                      onClick={() => { setCatalogTab(tab); setCatalogPage(1); }}
                      className={`py-2.5 sm:py-3.5 text-xs sm:text-sm font-medium border-b-2 mr-4 sm:mr-6 -mb-px transition-colors whitespace-nowrap ${catalogTab === tab ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}>
                      {tab === 'catalog' ? 'Catálogo' : 'Frecuentes'}
                    </button>
                  ))}
                </div>
                {/* Search bar — compacto en mobile */}
                <div className="px-2 sm:px-3 pb-2 pt-1 flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
                    <Input
                      placeholder="Código o nombre..."
                      className="pl-8 h-8 text-xs sm:text-sm"
                      value={catalogSearchInput}
                      onChange={e => { setCatalogSearchInput(e.target.value); setCatalogPage(1); }}
                    />
                  </div>
                  <Select value={selectedDept} onValueChange={v => { setSelectedDept(v); setCatalogPage(1); }}>
                    <SelectTrigger className="h-8 w-[110px] sm:w-36 text-xs shrink-0">
                      <Filter className="w-3 h-3 mr-1 text-zinc-400 shrink-0" />
                      <SelectValue placeholder="Dpto." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {departments.map(d => (
                        <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button className="h-8 w-8 shrink-0 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-500 hover:border-emerald-400 hover:text-emerald-600 transition-colors" title="Escanear código">
                    <Scan className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Product list */}
              {isCatalogLoading ? (
                <div className="text-center py-10 text-zinc-400 dark:text-zinc-600">
                  <Loader2 className="w-7 h-7 mx-auto mb-2 animate-spin opacity-40" />
                  <p className="text-xs sm:text-sm">Cargando productos...</p>
                </div>
              ) : pagedProducts.length === 0 ? (
                <div className="text-center py-10 text-zinc-400 dark:text-zinc-600">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-xs sm:text-sm">No se encontraron productos</p>
                </div>
              ) : (
                <>
                  {/* MOBILE: lista horizontal compacta (< sm) */}
                  <div className="sm:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
                    {pagedProducts.map((product: any) => {
                      const finalPrice = invoiceType === 'credit'
                        ? (product.price2 || product.final_price || 0)
                        : (product.final_price || 0);
                      const cartCount = cart.filter(i => i.productId === product.id).length;
                      const outOfStock = (product.stock ?? 0) <= 0 && !product.use_unit_ids;
                      return (
                        <div key={product.id}
                          className={`flex items-center gap-2 px-3 py-2 transition-colors ${outOfStock ? 'opacity-50' : 'active:bg-zinc-50 dark:active:bg-zinc-800/60'}`}>
                          {/* Left: info */}
                          <div className="flex-1 min-w-0" onClick={() => !outOfStock ? addProductToCart(product) : undefined}>
                            <div className="flex items-center gap-1 mb-0.5">
                              <span className="text-[9px] font-mono text-zinc-400 shrink-0">{product.code}</span>
                              {cartCount > 0 && (
                                <span className="inline-flex items-center px-1 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-[8px] font-bold">×{cartCount}</span>
                              )}
                              {product.use_unit_ids && (
                                <span className="inline-flex items-center gap-0.5 px-1 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 text-[8px] font-bold"><Hash className="w-2 h-2" />ID</span>
                              )}
                            </div>
                            <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 leading-tight truncate">{product.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[9px] text-zinc-400">P1 <span className="text-zinc-500">{formatCOP(product.price1 ?? 0)}</span></span>
                              <span className="text-zinc-300 dark:text-zinc-600">·</span>
                              <span className="text-[9px] text-zinc-400">P2 <span className="text-zinc-500">{formatCOP(product.price2 ?? 0)}</span></span>
                              {isAdmin && (product.current_cost ?? 0) > 0 && (
                                <>
                                  <span className="text-zinc-300 dark:text-zinc-600">·</span>
                                  <span className="text-[9px] text-amber-500">C {formatCOP(product.current_cost)}</span>
                                </>
                              )}
                            </div>
                          </div>
                          {/* Right: price + actions */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="text-right">
                              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 leading-none">{formatCOP(finalPrice)}</p>
                              <p className="text-[9px] text-zinc-400 leading-none mt-0.5">
                                {outOfStock ? <span className="text-red-400">Sin stock</span> : `Stk:${product.stock}`}
                              </p>
                            </div>
                            <button
                              onClick={e => { e.stopPropagation(); openPriceInfoFromCatalog(product); }}
                              className="w-7 h-7 flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-emerald-600 hover:border-emerald-400 transition-colors">
                              <Info className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); if (!outOfStock) addProductToCart(product); }}
                              disabled={outOfStock}
                              className={`w-7 h-7 flex items-center justify-center rounded-lg border-2 transition-all font-bold text-base ${outOfStock ? 'border-zinc-200 dark:border-zinc-700 text-zinc-300 cursor-not-allowed' : 'border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white active:scale-95'}`}>
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* DESKTOP: grid de tarjetas (sm+) */}
                  <div className="hidden sm:grid sm:grid-cols-2 gap-3 p-5">
                    {pagedProducts.map((product: any) => {
                      const cartCount = cart.filter(i => i.productId === product.id).length;
                      const outOfStock = (product.stock ?? 0) <= 0;
                      return (
                        <div key={product.id}
                          className={`relative border rounded-xl p-3 flex flex-col gap-2 transition-all cursor-pointer ${outOfStock && !product.use_unit_ids ? 'border-zinc-200 dark:border-zinc-700 opacity-60' : 'border-zinc-200 dark:border-zinc-700 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}
                          onClick={() => !outOfStock || product.use_unit_ids ? addProductToCart(product) : undefined}>
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-zinc-400 font-mono">{product.code}</p>
                              <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 leading-snug line-clamp-2">{product.name}</p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                              {cartCount > 0 && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold leading-none">×{cartCount}</span>
                              )}
                              {product.use_unit_ids && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 text-[9px] font-bold leading-none">
                                  <Hash className="w-2.5 h-2.5" />ID
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <span className="inline-flex flex-col items-center px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                              <span className="text-[9px] font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 leading-none mb-0.5">P1</span>
                              <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 leading-none">{formatCOP(product.price1 ?? 0)}</span>
                            </span>
                            <span className="inline-flex flex-col items-center px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                              <span className="text-[9px] font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 leading-none mb-0.5">P2</span>
                              <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 leading-none">{formatCOP(product.price2 ?? 0)}</span>
                            </span>
                            <span className="inline-flex flex-col items-center px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700">
                              <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-500 leading-none mb-0.5">Final</span>
                              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 leading-none">{formatCOP(product.final_price ?? 0)}</span>
                            </span>
                            {isAdmin && (product.current_cost ?? 0) > 0 && (
                              <span className="inline-flex flex-col items-center px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700">
                                <span className="text-[9px] font-bold uppercase tracking-wide text-amber-500 leading-none mb-0.5">Costo</span>
                                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 leading-none">{formatCOP(product.current_cost)}</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <p className="text-[11px] text-zinc-400">
                              {outOfStock ? <span className="text-red-400">Sin stock</span> : `Stock: ${product.stock}`}
                            </p>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={e => { e.stopPropagation(); openPriceInfoFromCatalog(product); }}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400 text-[10px] font-medium transition-colors">
                                <Info className="w-3 h-3" />
                                Detalles
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); addProductToCart(product); }}
                                disabled={outOfStock && !product.use_unit_ids}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all flex-shrink-0 ${outOfStock && !product.use_unit_ids ? 'border border-zinc-200 dark:border-zinc-700 text-zinc-300 cursor-not-allowed' : 'border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white'}`}>
                                <Plus className="w-3 h-3" />
                                Agregar
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Pagination */}
              {catalogTab === 'catalog' && (
                <div className="px-3 py-2 sm:px-5 sm:py-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setCatalogPage(p => Math.max(1, p - 1))}
                    disabled={catalogPage === 1 || isCatalogLoading}
                    className="h-7 px-2.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    ← Ant.
                  </button>
                  <span className="text-[10px] sm:text-xs text-zinc-400 text-center">
                    {isCatalogLoading ? 'Buscando...' : `${catalogPage} / ${Math.max(1, getTotalPages())} · ${catalogTotalCount} prod.`}
                  </span>
                  <button
                    onClick={() => setCatalogPage(p => Math.min(getTotalPages(), p + 1))}
                    disabled={catalogPage >= getTotalPages() || isCatalogLoading}
                    className="h-7 px-2.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    Sig. →
                  </button>
                </div>
              )}
            </div>

            {/* ── Carrito (derecha) ─────────────────────────────────────────────── */}
            <div className={`${mobileView === 'catalog' ? 'hidden lg:flex' : 'flex'} w-full lg:w-[500px] xl:w-[560px] flex-shrink-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 sm:p-5 flex-col lg:sticky lg:top-4`}>

              {/* Resumen del cliente */}
              {(invoiceType === 'credit' ? selectedCreditCustomer?.name : (isConsumerFinal ? 'Consumidor Final' : customerName)) && (
                <div className="mb-3 flex items-center gap-2 px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                  <User className="w-3 h-3 text-zinc-400 flex-shrink-0" />
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 truncate">
                    {invoiceType === 'credit' ? selectedCreditCustomer?.name : (isConsumerFinal ? 'Consumidor Final' : customerName)}
                  </p>
                  <button onClick={() => setStep(1)} className="ml-auto text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline flex-shrink-0">Editar</button>
                </div>
              )}

              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Carrito{cart.length > 0 && <span className="ml-1.5 px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-[10px] rounded-full font-bold">{cart.length}</span>}
                </h2>
                {cart.length > 0 && (
                  <button onClick={() => setCart([])} className="text-zinc-400 hover:text-red-500 transition-colors" title="Limpiar carrito">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Cart items */}
              <div className="flex-1 space-y-0 max-h-[52vh] lg:max-h-[560px] overflow-y-auto min-h-[80px]">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-20 text-zinc-300 dark:text-zinc-600">
                    <Package className="w-7 h-7 mb-1" />
                    <p className="text-xs">Agrega productos desde el catálogo</p>
                  </div>
                ) : (
                  cart.map((item, i) => (
                    <div key={i} className="py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                      <div className="flex gap-2">
                        {/* Sin el icono cuadrado en mobile — va directo al texto */}
                        <div className="hidden sm:flex w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 items-center justify-center flex-shrink-0">
                          <Package className="w-4 h-4 text-zinc-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{item.productName}</p>
                          <p className="text-[10px] text-zinc-400 font-mono">{item.productCode}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            {item.useUnitIds ? (
                              <>
                                <button
                                  onClick={() => {
                                    const ids = item.unitIds || [];
                                    if (ids.length === 0) { removeFromCart(i); return; }
                                    const newIds = ids.slice(0, -1);
                                    setCart(prev => prev.map((ci, idx) => idx === i
                                      ? { ...ci, unitIds: newIds, quantity: Math.max(1, newIds.length), total: ci.price * Math.max(1, newIds.length) }
                                      : ci));
                                  }}
                                  className="w-5 h-5 sm:w-6 sm:h-6 rounded border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-500 hover:border-zinc-400 text-xs font-bold">−</button>
                                <span className="text-xs font-semibold w-5 text-center">{item.unitIds?.length ?? item.quantity}</span>
                                <button
                                  onClick={() => { setCurrentItemIndex(i); setSelectedUnitIds(item.unitIds || []); setUnitIdNotes(item.unitIdNotes || {}); setUnitIdDialogOpen(true); }}
                                  className="w-5 h-5 sm:w-6 sm:h-6 rounded border border-amber-300 dark:border-amber-600 flex items-center justify-center text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-xs font-bold">+</button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => updateCartQty(i, item.quantity - 1)} className="w-5 h-5 sm:w-6 sm:h-6 rounded border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-500 hover:border-zinc-400 text-xs font-bold">−</button>
                                <span className="text-xs font-semibold w-5 text-center">{item.quantity}</span>
                                <button onClick={() => updateCartQty(i, item.quantity + 1)} className="w-5 h-5 sm:w-6 sm:h-6 rounded border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-500 hover:border-zinc-400 text-xs font-bold">+</button>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 flex flex-col items-end justify-between">
                          <div className="flex items-center gap-1 mb-1">
                            <button
                              onClick={e => { e.stopPropagation(); openPriceInfoFromCart(i); }}
                              className="w-6 h-6 flex items-center justify-center rounded border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:border-emerald-400 hover:text-emerald-600 transition-colors">
                              <Info className="w-3 h-3" />
                            </button>
                            {!item.useUnitIds && (
                              <button
                                onClick={() => openPriceEdit(i)}
                                className="w-6 h-6 flex items-center justify-center rounded border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:border-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">
                                <Pencil className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCOP(item.total)}</p>
                          <p className="text-[10px] text-zinc-400">×{item.useUnitIds ? (item.unitIds?.length ?? item.quantity) : item.quantity}</p>
                          <button onClick={() => removeFromCart(i)} className="mt-1 text-zinc-300 hover:text-red-500 transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {item.useUnitIds && (
                        <div className="mt-1.5 ml-0 sm:ml-[44px]">
                          {item.unitIds && item.unitIds.length > 0 ? (
                            <div className="flex flex-col gap-1.5">
                              <div className="flex flex-wrap gap-1">
                                {item.unitIds.map(uid => (
                                  <span key={uid} className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-mono text-xs leading-tight">
                                    <Hash className="w-3 h-3 mr-1 opacity-60" />{uid}
                                  </span>
                                ))}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => openPriceEdit(i)}
                                  className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 transition-colors">
                                  <Pencil className="w-3 h-3" />
                                  Precio
                                </button>
                                <button
                                  onClick={() => { setCurrentItemIndex(i); setSelectedUnitIds(item.unitIds || []); setUnitIdNotes(item.unitIdNotes || {}); setUnitIdDialogOpen(true); }}
                                  className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium transition-colors text-left">
                                  <Hash className="w-3 h-3" />
                                  Gestionar IDs ({item.unitIds.length} asignada{item.unitIds.length !== 1 ? 's' : ''})
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openPriceEdit(i)}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-300 transition-colors flex-shrink-0">
                                <Pencil className="w-3.5 h-3.5" />
                                Precio
                              </button>
                              <button
                                onClick={() => { setCurrentItemIndex(i); setSelectedUnitIds([]); setUnitIdNotes({}); setUnitIdDialogOpen(true); }}
                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 text-xs font-semibold hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Asignar IDs únicas
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Totals */}
              <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700 space-y-2">
                <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-400">
                  <span>Subtotal</span>
                  <span>{formatCOP(calculateSubtotal())}</span>
                </div>

                {/* Discount */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400 flex-shrink-0">Descuento</span>
                  <div className="flex items-center gap-1 ml-auto">
                    <Input
                      className="h-7 w-20 text-xs text-right"
                      type="number" min="0"
                      value={discountValue || ''}
                      onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                    />
                    <button
                      onClick={() => setDiscountIsPercent(!discountIsPercent)}
                      className={`h-7 px-2 rounded border text-xs font-medium transition-colors ${discountIsPercent ? 'bg-emerald-100 dark:bg-emerald-900 border-emerald-400 text-emerald-700 dark:text-emerald-300' : 'border-zinc-200 dark:border-zinc-700 text-zinc-500'}`}>
                      {discountIsPercent ? '%' : '$'}
                    </button>
                  </div>
                </div>
                {calculateDiscount() > 0 && (
                  <div className="flex justify-between text-sm text-red-500">
                    <span>- Descuento</span>
                    <span>-{formatCOP(calculateDiscount())}</span>
                  </div>
                )}

                {/* IVA */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setIncludeIVA(!includeIVA)}
                      className={`relative w-8 h-4 rounded-full transition-colors flex-shrink-0 ${includeIVA ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
                      <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${includeIVA ? 'left-[18px]' : 'left-0.5'}`} />
                    </button>
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">IVA (19%)</span>
                  </div>
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">{formatCOP(calculateIVAAmount())}</span>
                </div>

                <div className="flex justify-between text-base font-bold border-t border-zinc-200 dark:border-zinc-700 pt-2 mt-1">
                  <span className="text-zinc-900 dark:text-zinc-100">TOTAL</span>
                  <span className="text-emerald-600 dark:text-emerald-400">{formatCOP(calculateTotal())}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <Button
                  onClick={handleContinueToPayment}
                  disabled={cart.length === 0}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium h-11">
                  Continuar a Pago
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="w-full h-10 text-zinc-600 dark:text-zinc-300 border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Volver a información
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 3 — Pago
      ════════════════════════════════════════════════════════════════════════ */}
      {step === 3 && (
        <div className="p-6 flex justify-center">
          <div className="w-full max-w-2xl space-y-4">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-5">
                {invoiceType === 'credit' ? 'Confirmar factura a crédito' : 'Seleccionar método de pago'}
              </h2>

              {invoiceType === 'regular' ? (
                <div className="space-y-6">
                  {/* Invoice status */}
                  <div>
                    <Label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3 block">Estado de la factura</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {(['paid', 'pending_confirmation'] as const).map(s => (
                        <button key={s} onClick={() => setInvoiceStatus(s)}
                          className={`p-4 rounded-xl border-2 flex items-center gap-3 transition-all ${invoiceStatus === s ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'}`}>
                          {s === 'paid'
                            ? <CheckCircle className={`w-5 h-5 ${invoiceStatus === s ? 'text-emerald-500' : 'text-zinc-400'}`} />
                            : <Receipt className={`w-5 h-5 ${invoiceStatus === s ? 'text-emerald-500' : 'text-zinc-400'}`} />
                          }
                          <div className="text-left">
                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{s === 'paid' ? 'Pago inmediato' : 'En confirmación'}</p>
                            <p className="text-xs text-zinc-500">{s === 'paid' ? 'Se descuenta stock ahora' : 'Confirmar pago luego'}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {invoiceStatus === 'paid' && (
                    <div>
                      <Label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3 block">Método de pago</Label>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                        {(Object.entries(PAYMENT_LABELS) as [PaymentMethod, string][]).map(([m, label]) => (
                          <button key={m} onClick={() => setPaymentMethod(m)}
                            className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 text-xs transition-all ${paymentMethod === m ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300' : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'}`}>
                            {m === 'cash' ? <Banknote className="w-5 h-5" />
                              : m === 'transfer' ? <Landmark className="w-5 h-5" />
                              : m === 'nequi' ? <Smartphone className="w-5 h-5" />
                              : m === 'daviplata' ? <Smartphone className="w-5 h-5" />
                              : <DollarSign className="w-5 h-5" />}
                            <span className="font-medium">{label}</span>
                          </button>
                        ))}
                      </div>

                      {paymentMethod === 'mixed' && (
                        <div className="mt-4 grid grid-cols-2 gap-3 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                          {[
                            { label: 'Efectivo', value: mixedCash, setter: setMixedCash },
                            { label: 'Transferencia', value: mixedTransfer, setter: setMixedTransfer },
                            { label: 'Nequi', value: mixedNequi, setter: setMixedNequi },
                            { label: 'Daviplata', value: mixedDaviplata, setter: setMixedDaviplata },
                          ].map(({ label, value, setter }) => (
                            <div key={label}>
                              <Label className="text-xs text-zinc-500 mb-1 block">{label}</Label>
                              <Input
                                type="number" min="0" className="h-9 text-sm"
                                value={value || ''}
                                onChange={e => setter(parseFloat(e.target.value) || 0)}
                                placeholder="0"
                              />
                            </div>
                          ))}
                          <div className="col-span-2 flex justify-between text-sm pt-2 border-t border-zinc-200 dark:border-zinc-600">
                            <span className="text-zinc-500">Total pagado</span>
                            <span className={`font-semibold ${Math.abs((mixedCash + mixedTransfer + mixedNequi + mixedDaviplata) - calculateTotal()) > 1 ? 'text-red-500' : 'text-emerald-600'}`}>
                              {formatCOP(mixedCash + mixedTransfer + mixedNequi + mixedDaviplata)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Credit: confirmation details */
                <div className="space-y-3">
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                    <p className="text-xs text-zinc-400 mb-1">Cliente</p>
                    <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{selectedCreditCustomer?.name}</p>
                    <p className="text-sm text-zinc-500">{selectedCreditCustomer?.document}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                      <p className="text-xs text-zinc-400 mb-1">Plazo</p>
                      <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{paymentTerm} días</p>
                    </div>
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                      <p className="text-xs text-zinc-400 mb-1">Vencimiento</p>
                      <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{calculateDueDate()}</p>
                    </div>
                  </div>
                  {availableCreditNotes.length > 0 && applyBalance && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800">
                      <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">Nota crédito a aplicar</p>
                      <Select value={selectedCreditNoteId} onValueChange={setSelectedCreditNoteId}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableCreditNotes.map(cn => (
                            <SelectItem key={cn.id} value={cn.id}>NC {cn.number} · {formatCOP(cn.balance_remaining)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

              {/* Garantía */}
              <div className="mt-6 border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setWarrantyEnabled(v => !v)}
                  className={`w-full flex items-center justify-between p-4 transition-colors ${warrantyEnabled ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${warrantyEnabled ? 'bg-amber-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
                      <span className="text-white text-lg">🛡️</span>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Aplicar Garantía</p>
                      <p className="text-xs text-zinc-500">Incluir garantía en la factura</p>
                    </div>
                  </div>
                  <div className={`w-11 h-6 rounded-full transition-colors relative ${warrantyEnabled ? 'bg-amber-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${warrantyEnabled ? 'left-5' : 'left-0.5'}`} />
                  </div>
                </button>

                {warrantyEnabled && (
                  <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 space-y-4 bg-white dark:bg-zinc-900">
                    {/* Categoría */}
                    <div>
                      <Label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2 block">Categoría del producto</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { value: 'dispositivos', label: 'Dispositivos', emoji: '📱' },
                          { value: 'electrodomesticos', label: 'Electrodomésticos', emoji: '🏠' },
                        ] as const).map(cat => (
                          <button
                            key={cat.value}
                            type="button"
                            onClick={() => setWarrantyCategory(cat.value)}
                            className={`p-3 rounded-xl border-2 flex items-center gap-2 transition-all ${warrantyCategory === cat.value ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30' : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'}`}
                          >
                            <span className="text-xl">{cat.emoji}</span>
                            <span className={`text-sm font-medium ${warrantyCategory === cat.value ? 'text-amber-700 dark:text-amber-300' : 'text-zinc-700 dark:text-zinc-300'}`}>{cat.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Meses */}
                    <div>
                      <Label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2 block">
                        Duración: <span className="font-bold text-amber-600 dark:text-amber-400">{warrantyMonths} {warrantyMonths === 1 ? 'mes' : 'meses'}</span>
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {[1, 2, 3, 6, 9, 12, 18, 24, 36].map(m => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setWarrantyMonths(m)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${warrantyMonths === m ? 'border-amber-500 bg-amber-500 text-white' : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-amber-300'}`}
                          >
                            {m}m
                          </button>
                        ))}
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="36"
                        value={warrantyMonths}
                        onChange={e => setWarrantyMonths(parseInt(e.target.value))}
                        className="w-full mt-3 accent-amber-500"
                      />
                      <div className="flex justify-between text-[10px] text-zinc-400 mt-1">
                        <span>1 mes</span>
                        <span>36 meses</span>
                      </div>
                    </div>

                    {/* Resumen garantía */}
                    <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800">
                      <span className="text-2xl">🛡️</span>
                      <div>
                        <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                          Garantía: {warrantyMonths} {warrantyMonths === 1 ? 'mes' : 'meses'}
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          {warrantyCategory === 'dispositivos' ? 'Dispositivos electrónicos' : 'Electrodomésticos'} · Se imprime en la factura
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Order summary */}
              <div className="mt-4 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Subtotal</span>
                  <span className="text-zinc-900 dark:text-zinc-100">{formatCOP(calculateSubtotal())}</span>
                </div>
                {calculateDiscount() > 0 && (
                  <div className="flex justify-between text-sm text-red-500">
                    <span>Descuento</span>
                    <span>-{formatCOP(calculateDiscount())}</span>
                  </div>
                )}
                {includeIVA && (
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">IVA (19%)</span>
                    <span className="text-zinc-900 dark:text-zinc-100">{formatCOP(calculateIVAAmount())}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold border-t border-zinc-200 dark:border-zinc-600 pt-2">
                  <span className="text-zinc-900 dark:text-zinc-100">TOTAL</span>
                  <span className="text-emerald-600 dark:text-emerald-400 text-lg">{formatCOP(calculateTotal())}</span>
                </div>
              </div>

              <div className="mt-5 flex gap-3">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Volver
                </Button>
                <Button onClick={handleContinueToSummary} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                  Continuar
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 4 — Resumen
      ════════════════════════════════════════════════════════════════════════ */}
      {step === 4 && (
        <div className="p-6 flex justify-center">
          <div className="w-full max-w-2xl">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-5">Resumen de la factura</h2>

              {/* Customer */}
              {(customerName || selectedCreditCustomer || isConsumerFinal) && (
                <div className="mb-4 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                  <p className="text-xs text-zinc-400 mb-0.5">Cliente</p>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {isConsumerFinal ? 'Consumidor Final' : (selectedCreditCustomer?.name || customerName)}
                  </p>
                  {(customerDocument || selectedCreditCustomer?.document) && (
                    <p className="text-xs text-zinc-400">{customerDocument || selectedCreditCustomer?.document}</p>
                  )}
                </div>
              )}

              {/* Items list */}
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800 mb-5">
                {cart.map((item, i) => (
                  <div key={i} className="py-3 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.productName}</p>
                      <p className="text-xs text-zinc-400">{item.productCode} · ×{item.quantity}</p>
                      {item.unitIds && item.unitIds.length > 0 && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                          IDs: {item.unitIds.join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{formatCOP(item.total)}</p>
                      <p className="text-xs text-zinc-400">{formatCOP(item.price)} c/u</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl space-y-2 mb-5">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Subtotal</span>
                  <span>{formatCOP(calculateSubtotal())}</span>
                </div>
                {calculateDiscount() > 0 && (
                  <div className="flex justify-between text-sm text-red-500">
                    <span>Descuento</span><span>-{formatCOP(calculateDiscount())}</span>
                  </div>
                )}
                {includeIVA && (
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">IVA (19%)</span><span>{formatCOP(calculateIVAAmount())}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t border-zinc-200 dark:border-zinc-600 pt-2">
                  <span>TOTAL</span>
                  <span className="text-emerald-600 dark:text-emerald-400">{formatCOP(calculateTotal())}</span>
                </div>
              </div>

              {/* Garantía en resumen */}
              {warrantyEnabled && (
                <div className="mb-4 flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800">
                  <span className="text-2xl">🛡️</span>
                  <div>
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                      Garantía: {warrantyMonths} {warrantyMonths === 1 ? 'mes' : 'meses'}
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {warrantyCategory === 'dispositivos' ? 'Dispositivos electrónicos' : 'Electrodomésticos'}
                    </p>
                  </div>
                </div>
              )}

              {/* Invoice meta */}
              <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                  <p className="text-xs text-zinc-400 mb-0.5">Tipo de factura</p>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {invoiceType === 'credit' ? 'A Crédito' : 'Venta Regular'}
                  </p>
                </div>
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                  <p className="text-xs text-zinc-400 mb-0.5">
                    {invoiceType === 'regular' ? (invoiceStatus === 'paid' ? 'Método de pago' : 'Estado') : 'Vencimiento'}
                  </p>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {invoiceType === 'regular'
                      ? (invoiceStatus === 'paid' ? PAYMENT_LABELS[paymentMethod] : 'En Confirmación')
                      : calculateDueDate()}
                  </p>
                </div>
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                  <p className="text-xs text-zinc-400 mb-0.5">Fecha de emisión</p>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">{emissionDate}</p>
                </div>
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                  <p className="text-xs text-zinc-400 mb-0.5">Serie</p>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">{serie}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(3)} disabled={isSubmitting} className="flex-1">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Volver
                </Button>
                <Button
                  onClick={handleFinalSubmit}
                  disabled={isSubmitting || isValidating}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                  {isSubmitting || isValidating ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{isValidating ? 'Validando...' : 'Creando...'}</>
                  ) : (
                    <><CheckCircle className="w-4 h-4 mr-2" />Emitir Factura</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Agenda de clientes dialog ────────────────────────────────────────── */}
      <Dialog open={agendaOpen} onOpenChange={open => { setAgendaOpen(open); if (!open) setAgendaShowNew(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookUser className="w-4 h-4 text-emerald-500" />
              Agenda de clientes
            </DialogTitle>
            <DialogDescription>Busca por nombre o cédula, o registra un nuevo cliente.</DialogDescription>
          </DialogHeader>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            <Input
              placeholder="Buscar por nombre o cédula..."
              className="pl-9 h-9"
              value={agendaSearch}
              onChange={e => handleAgendaSearch(e.target.value)}
              autoFocus
            />
          </div>

          {/* Results */}
          <div className="max-h-64 overflow-y-auto space-y-1">
            {agendaLoading ? (
              <div className="flex items-center justify-center py-8 text-zinc-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                <span className="text-sm">Buscando...</span>
              </div>
            ) : agendaResults.length === 0 ? (
              <div className="text-center py-8 text-zinc-400">
                <User className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No se encontraron clientes</p>
              </div>
            ) : (
              agendaResults.map(c => (
                <button
                  key={c.id}
                  onClick={() => handleAgendaSelect(c)}
                  className="w-full text-left px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{c.name}</p>
                      {c.document && <p className="text-xs text-zinc-400 font-mono">{c.document}</p>}
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-300 dark:text-zinc-600 flex-shrink-0" />
                  </div>
                </button>
              ))
            )}
          </div>

          {/* New customer form */}
          {agendaShowNew ? (
            <div className="space-y-3 pt-2 border-t border-zinc-200 dark:border-zinc-700">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Nuevo cliente</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <Label className="text-xs text-zinc-500 mb-1 block">Nombre *</Label>
                  <Input className="h-9 text-sm" placeholder="Nombre completo" value={agendaNewName} onChange={e => setAgendaNewName(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-zinc-500 mb-1 block">Cédula / NIT</Label>
                  <Input className="h-9 text-sm" placeholder="Documento" value={agendaNewDoc} onChange={e => setAgendaNewDoc(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-zinc-500 mb-1 block">Teléfono</Label>
                  <Input className="h-9 text-sm" placeholder="Contacto" value={agendaNewPhone} onChange={e => setAgendaNewPhone(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-zinc-500 mb-1 block">Dirección</Label>
                  <Input className="h-9 text-sm" placeholder="Dirección" value={agendaNewAddress} onChange={e => setAgendaNewAddress(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setAgendaShowNew(false)} className="flex-1">Cancelar</Button>
                <Button size="sm" onClick={handleAgendaSaveNew} disabled={agendaSaving} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                  {agendaSaving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <UserPlus className="w-3.5 h-3.5 mr-1" />}
                  Guardar y seleccionar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between pt-2 border-t border-zinc-200 dark:border-zinc-700">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setAgendaShowNew(true); setAgendaNewName(agendaSearch); }}
                className="text-emerald-600 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30">
                <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                Nuevo cliente
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAgendaOpen(false)}>Cerrar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Price info dialog ────────────────────────────────────────────────── */}
      <Dialog open={priceInfoOpen} onOpenChange={setPriceInfoOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="w-4 h-4 text-emerald-500" />
              Precios del producto
            </DialogTitle>
            {priceInfoData && (
              <DialogDescription className="text-xs leading-snug">
                {priceInfoData.name}
              </DialogDescription>
            )}
          </DialogHeader>
          {priceInfoData && (
            <div className="space-y-2 py-1">
              <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                <span className="text-sm text-zinc-500">Precio 1</span>
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{formatCOP(priceInfoData.price1)}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                <span className="text-sm text-zinc-500">Precio 2</span>
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{formatCOP(priceInfoData.price2)}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Precio Final</span>
                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{formatCOP(priceInfoData.finalPrice)}</span>
              </div>
              {isAdmin && (
                <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <span className="text-sm font-medium text-amber-700 dark:text-amber-400">Costo Actual</span>
                  <span className="text-sm font-bold text-amber-700 dark:text-amber-400">{formatCOP(priceInfoData.currentCost)}</span>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPriceInfoOpen(false)} className="w-full">Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Price edit dialog ─────────────────────────────────────────────────── */}
      <Dialog open={priceEditOpen} onOpenChange={setPriceEditOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Editar precio de venta</DialogTitle>
            {priceEditIndex !== null && cart[priceEditIndex] && (
              <DialogDescription>
                {cart[priceEditIndex].productName}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-zinc-500 mb-1.5 block">Nuevo precio unitario (COP)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400 pointer-events-none">$</span>
                <Input
                  type="number"
                  min="0"
                  step="100"
                  value={priceEditInput}
                  onChange={e => setPriceEditInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && confirmPriceEdit()}
                  className="pl-6 h-10 text-sm"
                  autoFocus
                />
              </div>
              {priceEditIndex !== null && cart[priceEditIndex] && (() => {
                const item = cart[priceEditIndex];
                const options = [
                  { label: 'Precio 1', value: item.price1 ?? 0, color: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60' },
                  { label: 'Precio 2', value: item.price2 ?? 0, color: 'bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/60' },
                  { label: 'Precio Final', value: item.finalPrice ?? item.price, color: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60' },
                ];
                return (
                  <div className="mt-3 flex flex-col gap-1.5">
                    <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide">Precios disponibles</span>
                    <div className="flex gap-2 flex-wrap">
                      {options.map(opt => (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => setPriceEditInput(String(opt.value))}
                          className={`flex flex-col items-start px-2.5 py-1.5 rounded-lg border text-left transition-colors cursor-pointer ${opt.color} ${String(priceEditInput) === String(opt.value) ? 'ring-2 ring-offset-1 ring-current' : ''}`}
                        >
                          <span className="text-[9px] font-semibold uppercase tracking-wide opacity-70 leading-none mb-0.5">{opt.label}</span>
                          <span className="text-[12px] font-bold leading-none">{formatCOP(opt.value)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPriceEditOpen(false)}>Cancelar</Button>
            <Button onClick={confirmPriceEdit} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Unit ID dialog ────────────────────────────────────────────────────── */}
      <Dialog open={unitIdDialogOpen} onOpenChange={open => {
        setUnitIdDialogOpen(open);
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Asignar IDs de unidad</DialogTitle>
            {currentItemIndex !== null && cart[currentItemIndex] && (
              <DialogDescription>
                Seleccioná las unidades a vender de <strong>{cart[currentItemIndex].productName}</strong>. La cantidad en el carrito se actualizará automáticamente.
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="max-h-56 overflow-y-auto space-y-1.5">
            {currentItemIndex !== null && (() => {
              const currentItem = cart[currentItemIndex];
              if (!currentItem) return null;
              // Exclude IDs confirmed by OTHER items of the same product
              const otherConfirmedIds = cart
                .filter((ci, idx) => idx !== currentItemIndex && ci.productId === currentItem.productId)
                .flatMap(ci => ci.unitIds || []);
              const visibleIds = (currentItem.availableIds || []).filter(({ id }) => !otherConfirmedIds.includes(id));
              return visibleIds.map(({ id, note }) => {
                const isSelected = selectedUnitIds.includes(id);
                return (
                  <button key={id}
                    onClick={() => setSelectedUnitIds(prev => isSelected ? prev.filter(x => x !== id) : [...prev, id])}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors
                      ${isSelected ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs">{id}</span>
                      {isSelected && <Check className="w-4 h-4 text-emerald-500" />}
                    </div>
                    {note && <p className="text-xs text-zinc-400 mt-0.5">{note}</p>}
                  </button>
                );
              });
            })()}
          </div>
          <p className="text-xs text-zinc-500 text-center">
            {selectedUnitIds.length} unidad{selectedUnitIds.length !== 1 ? 'es' : ''} seleccionada{selectedUnitIds.length !== 1 ? 's' : ''}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setUnitIdDialogOpen(false);
            }}>Cancelar</Button>
            <Button onClick={handleUnitIdsConfirm} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Credit modals ─────────────────────────────────────────────────────── */}
      {showWarningModal && selectedCreditCustomer && (
        <CreditWarningModal
          isOpen={showWarningModal}
          onClose={() => setShowWarningModal(false)}
          onProceed={async () => { setShowWarningModal(false); await createInvoice(); }}
          overdueDays={warningData.overdueDays}
          totalDebt={warningData.totalDebt}
          customerName={selectedCreditCustomer.name}
          isBlocked={selectedCreditCustomer.blocked ?? false}
        />
      )}

      {showCreditLimitModal && selectedCreditCustomer && (
        <CreditLimitExceededModal
          isOpen={showCreditLimitModal}
          onClose={() => setShowCreditLimitModal(false)}
          onConfirm={handleCreditLimitExceededConfirm}
          customerName={selectedCreditCustomer.name}
          currentLimit={selectedCreditCustomer.credit_limit ?? 0}
          requiredAmount={calculateTotal()}
          usedCredit={creditAnalysis.usedCredit}
        />
      )}
    </div>
  );
}
