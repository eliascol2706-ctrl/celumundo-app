import { useEffect, useState, useRef } from "react";
import {
  Plus,
  Search,
  ArrowUp,
  ArrowDown,
  Filter,
  X,
  Printer,
  Download,
  DollarSign,
  Tag,
  Hash,
  Edit,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  PackageX,
} from "lucide-react";
import {
  getMovements,
  getAllProducts,
  addMovement,
  getCurrentUser,
  updateProduct,
  searchProductsForInvoice,
  supabase,
  type Movement,
  type Product,
} from "../lib/supabase";
import { 
  extractIds, 
  generateMultipleUnitIds, 
  createNotesMap,
  convertToIdsWithNotes,
  type UnitIdWithNote 
} from "../lib/unit-ids-utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";
import { formatCOP } from "../lib/currency";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import JsBarcode from "jsbarcode";
import { includesIgnoreAccents } from "../lib/string-utils";
import { printLabels } from "../lib/label-printer";
import { isPrintingAvailable } from "../lib/platform-detector";
import { getPrinterConfig, printDirect } from "../lib/printer-config";

interface MovementItem {
  productId: string;
  productName: string;
  productCode: string;
  quantity: number;
  currentCost: number;
  newCost?: number;
  useUnitIds: boolean;
  unitIds: string[];
  unitIdNotes: { [id: string]: string }; // Notas adicionales para cada ID
  availableIds?: string[]; // Para salidas: IDs disponibles del producto
}

export default function Movements() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "entry" | "exit">("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [movementItems, setMovementItems] = useState<MovementItem[]>([]);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [completedMovement, setCompletedMovement] = useState<any>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Estados para impresión de etiquetas
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [labelQuantities, setLabelQuantities] = useState<{
    [key: number]: number;
  }>({});
  const labelPrintRef = useRef<HTMLDivElement>(null);

  // Estado para selector de IDs
  const [unitIdDialogOpen, setUnitIdDialogOpen] = useState(false);
  const [currentItemIndex, setCurrentItemIndex] = useState<number | null>(null);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [unitIdNotes, setUnitIdNotes] = useState<{ [id: string]: string }>({});

  // Estados para reimpresión de etiquetas
  const [reprintDialogOpen, setReprintDialogOpen] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<Movement | null>(null);
  const [reprintSelection, setReprintSelection] = useState<'all' | 'specific'>('all');
  const [selectedIdsForReprint, setSelectedIdsForReprint] = useState<string[]>([]);
  const [reprintQuantity, setReprintQuantity] = useState<number>(1); // Para productos sin IDs únicas

  // Prevenir doble clic
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados para módulo Reinicio
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [allProductsForReset, setAllProductsForReset] = useState<Product[]>([]);
  const [resetExclusions, setResetExclusions] = useState<Set<string>>(new Set());
  const [resetStep, setResetStep] = useState<"select" | "confirm" | "done">("select");
  const [resetting, setResetting] = useState(false);
  const [resetSearchTerm, setResetSearchTerm] = useState("");
  const [resetCategoryFilter, setResetCategoryFilter] = useState<string>("all");

  // Estados para búsqueda y filtros de productos
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [productSortFilter, setProductSortFilter] = useState<"price-desc" | "price-asc" | "stock-asc" | "stock-desc">("price-desc");
  const [productSearchDialogOpen, setProductSearchDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  const [formData, setFormData] = useState({
    type: "entry" as "entry" | "exit",
    reason: "",
    reference: "",
    productId: "",
    quantity: "1",
    newCost: "",
  });

  useEffect(() => {
    loadMovements();
  }, []);

  const openResetDialog = async () => {
    setResetStep("select");
    setResetExclusions(new Set());
    setResetSearchTerm("");
    setResetCategoryFilter("all");
    const all = await getAllProducts();
    setAllProductsForReset(all.sort((a, b) => (a.name || "").localeCompare(b.name || "")));
    setShowResetDialog(true);
  };

  const executeReset = async () => {
    setResetting(true);
    try {
      const toReset = allProductsForReset.filter(p => !resetExclusions.has(p.id));
      for (const product of toReset) {
        await updateProduct(product.id, { stock: 0 });
      }
      setResetStep("done");
      toast.success(`Reinicio completado: ${toReset.length} productos reiniciados a 0`);
    } catch {
      toast.error("Error al reiniciar el inventario");
    } finally {
      setResetting(false);
    }
  };

  const loadMovements = async () => {
    const data = await getMovements();
    setMovements(
      data.sort(
        (a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    );
  };

  const loadProducts = async (searchTerm: string) => {
    const data = await searchProductsForInvoice(searchTerm);
    setProducts(data);
  };

  // Filtrar y ordenar productos para el selector
  const getFilteredAndSortedProducts = () => {
    let filtered = [...products];

    // Aplicar búsqueda
    if (productSearchTerm) {
      filtered = filtered.filter((product) =>
        includesIgnoreAccents(product.name, productSearchTerm) ||
        includesIgnoreAccents(product.code, productSearchTerm) ||
        includesIgnoreAccents(product.category, productSearchTerm)
      );
    }

    // Aplicar ordenamiento
    filtered.sort((a, b) => {
      switch (productSortFilter) {
        case "price-desc":
          return b.current_cost - a.current_cost;
        case "price-asc":
          return a.current_cost - b.current_cost;
        case "stock-asc":
          return a.stock - b.stock;
        case "stock-desc":
          return b.stock - a.stock;
        default:
          return 0;
      }
    });

    return filtered;
  };

  // Función para seleccionar producto desde el diálogo
  const handleSelectProductFromDialog = (product: Product) => {
    setSelectedProduct(product);
    setFormData({
      ...formData,
      productId: product.id,
      newCost: product.current_cost.toString(),
    });
    setProductSearchDialogOpen(false);
    setProductSearchTerm("");
    setProducts([]); // Limpiar productos al cerrar
    toast.success(`Producto seleccionado: ${product.name}`);
  };

  const filteredMovements = movements.filter((movement) => {
    const matchesSearch =
      movement.product_name
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      movement.reference
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      movement.reason.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType =
      filterType === "all" || movement.type === filterType;

    return matchesSearch && matchesType;
  });

  // Paginación
  const totalPages = Math.ceil(filteredMovements.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedMovements = filteredMovements.slice(startIndex, endIndex);

  // Reset page cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType]);

  // Búsqueda dinámica de productos cuando el usuario escribe
  useEffect(() => {
    if (!productSearchDialogOpen) {
      // Limpiar productos cuando se cierra el diálogo
      setProducts([]);
      return;
    }

    // Solo buscar si hay al menos 2 caracteres
    if (productSearchTerm.length < 2) {
      setProducts([]);
      return;
    }

    // Debounce: esperar 300ms después de que el usuario deje de escribir
    const timeoutId = setTimeout(async () => {
      setIsLoadingProducts(true);
      await loadProducts(productSearchTerm);
      setIsLoadingProducts(false);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [productSearchTerm, productSearchDialogOpen]);

  const handleAddItem = () => {
    if (!formData.productId || !selectedProduct) {
      toast.error("Selecciona un producto usando el botón de búsqueda");
      return;
    }

    const product = selectedProduct;
    const quantity = parseInt(formData.quantity) || 1;

    // Verificar que no se agregue el mismo producto dos veces
    if (movementItems.some((item) => item.productId === formData.productId)) {
      toast.error("Este producto ya está agregado");
      return;
    }

    // Si es salida y el producto usa IDs, verificar que hay suficientes IDs disponibles
    if (formData.type === "exit" && product.use_unit_ids) {
      const availableIds = product.registered_ids || [];
      if (availableIds.length < quantity) {
        toast.error(`Solo hay ${availableIds.length} unidades con ID registradas disponibles`);
        return;
      }
    }

    const newItem: MovementItem = {
      productId: product.id,
      productName: product.name,
      productCode: product.code,
      quantity: quantity,
      currentCost: product.current_cost,
      newCost: formData.newCost ? parseFloat(formData.newCost) : undefined,
      useUnitIds: product.use_unit_ids,
      unitIds: [],
      unitIdNotes: {},
      availableIds: product.use_unit_ids ? extractIds(product.registered_ids || []) : undefined,
    };

    // Si es entrada y usa IDs, generar IDs automáticamente
    if (formData.type === "entry" && product.use_unit_ids) {
      const newIds = generateMultipleUnitIds(product.registered_ids || [], quantity);
      newItem.unitIds = newIds;
      toast.success(`Se generarán las IDs: ${newIds.join(", ")}`);
    }

    // Si es salida y usa IDs, abrir selector de IDs
    if (formData.type === "exit" && product.use_unit_ids) {
      setMovementItems([...movementItems, newItem]);
      setCurrentItemIndex(movementItems.length);
      setSelectedUnitIds([]);
      setUnitIdNotes({});
      setUnitIdDialogOpen(true);
      setFormData({
        ...formData,
        productId: "",
        quantity: "1",
        newCost: "",
      });
      setSelectedProduct(null);
      return;
    }

    setMovementItems([...movementItems, newItem]);
    setFormData({
      ...formData,
      productId: "",
      quantity: "1",
      newCost: "",
    });
    setSelectedProduct(null);
    toast.success("Producto agregado al movimiento");
  };

  const handleRemoveItem = (index: number) => {
    setMovementItems(movementItems.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (
    index: number,
    field: "quantity" | "newCost",
    value: string,
  ) => {
    const updated = [...movementItems];
    const item = updated[index];
    
    if (field === "quantity") {
      const newQuantity = parseInt(value) || 1;
      
      // Si es salida y usa IDs, verificar disponibilidad
      if (formData.type === "exit" && item.useUnitIds && item.availableIds) {
        if (newQuantity > item.availableIds.length) {
          toast.error(`Solo hay ${item.availableIds.length} unidades disponibles`);
          return;
        }
        // Ajustar IDs seleccionadas
        if (newQuantity < item.unitIds.length) {
          item.unitIds = item.unitIds.slice(0, newQuantity);
        }
      }
      
      // Si es entrada y usa IDs, regenerar IDs
      if (formData.type === "entry" && item.useUnitIds) {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          const newIds = generateMultipleUnitIds(product.registered_ids || [], newQuantity);
          item.unitIds = newIds;
        }
      }
      
      updated[index].quantity = newQuantity;
    } else {
      updated[index].newCost = value ? parseFloat(value) : undefined;
    }
    setMovementItems(updated);
  };

  const handleOpenUnitIdSelector = (index: number) => {
    setCurrentItemIndex(index);
    setSelectedUnitIds([...movementItems[index].unitIds]);
    
    // Cargar notas existentes del item o crear mapa con notas del producto
    const existingNotes = movementItems[index].unitIdNotes || {};
    const product = products.find(p => p.id === movementItems[index].productId);
    const productNotesMap = product ? createNotesMap(product.registered_ids || []) : {};
    
    // Combinar notas del producto con notas existentes del item
    setUnitIdNotes({ ...productNotesMap, ...existingNotes });
    setUnitIdDialogOpen(true);
  };

  const handleSaveUnitIds = () => {
    if (currentItemIndex === null) return;
    
    const item = movementItems[currentItemIndex];
    
    // Para salidas, verificar que se seleccionaron las IDs correctas
    if (formData.type === "exit" && selectedUnitIds.length !== item.quantity) {
      toast.error(`Debes seleccionar exactamente ${item.quantity} IDs`);
      return;
    }
    
    const updated = [...movementItems];
    // Para salidas, actualizar las IDs seleccionadas
    if (formData.type === "exit") {
      updated[currentItemIndex].unitIds = selectedUnitIds;
    }
    // Para ambos casos, actualizar las notas
    updated[currentItemIndex].unitIdNotes = unitIdNotes;
    setMovementItems(updated);
    setUnitIdDialogOpen(false);
    setCurrentItemIndex(null);
    
    if (formData.type === "entry") {
      toast.success("Notas guardadas correctamente");
    } else {
      toast.success("IDs seleccionadas correctamente");
    }
  };

  const toggleUnitId = (unitId: string) => {
    const item = movementItems[currentItemIndex!];
    
    if (selectedUnitIds.includes(unitId)) {
      setSelectedUnitIds(selectedUnitIds.filter(id => id !== unitId));
    } else {
      if (selectedUnitIds.length >= item.quantity) {
        toast.error(`Solo puedes seleccionar ${item.quantity} IDs`);
        return;
      }
      setSelectedUnitIds([...selectedUnitIds, unitId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevenir doble clic
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      if (movementItems.length === 0) {
        toast.error("Agrega al menos un producto");
        return;
      }

      // Validar que productos con IDs en salidas tengan IDs seleccionadas
      for (const item of movementItems) {
        if (formData.type === "exit" && item.useUnitIds && item.unitIds.length === 0) {
          toast.error(`Debes seleccionar las IDs para ${item.productName}`);
          return;
        }
      }
      const user = getCurrentUser();
      const reference =
        formData.reference || `${formData.type.toUpperCase()}-${Date.now()}`;
      const processedItems: any[] = [];

      for (const item of movementItems) {
        // Obtener el producto actualizado directamente de la base de datos
        const { data: productData, error: productError } = await supabase
          .from('products')
          .select('*')
          .eq('id', item.productId)
          .single();

        if (productError || !productData) {
          toast.error(`Error al obtener el producto ${item.productName}`);
          continue;
        }

        const product = productData as Product;

        const newStock =
          formData.type === "entry"
            ? product.stock + item.quantity
            : product.stock - item.quantity;

        if (newStock < 0) {
          toast.error(`Stock insuficiente para ${product.name}`);
          return;
        }

        // Preparar actualizaciones del producto
        const updates: any = { stock: newStock };

        // Actualizar IDs registradas
        if (item.useUnitIds) {
          let updatedIds = [...(product.registered_ids || [])];

          if (formData.type === "entry") {
            // Agregar nuevas IDs con sus notas
            const newIdsWithNotes = item.unitIds.map(id => ({
              id,
              note: item.unitIdNotes?.[id] || ''
            }));
            updatedIds = [...updatedIds, ...newIdsWithNotes];
          } else {
            // Remover IDs vendidas/salidas
            updatedIds = updatedIds.filter(idObj => !item.unitIds.includes(idObj.id));
          }

          updates.registered_ids = updatedIds;
        }

        // Si hay nuevo costo, actualizarlo (solo en entradas)
        if (formData.type === "entry" && item.newCost !== undefined) {
          updates.old_cost = product.current_cost;
          updates.current_cost = item.newCost;
        }

        await updateProduct(product.id, updates);

        // Registrar movimiento con IDs
        await addMovement({
          type: formData.type,
          product_id: item.productId,
          product_name: item.productName,
          quantity: item.quantity,
          reason: formData.reason,
          reference: reference,
          user_name: user?.username || "Usuario",
          unit_ids: item.unitIds
        });

        processedItems.push({
          ...item,
          finalCost:
            formData.type === "entry" && item.newCost !== undefined
              ? item.newCost
              : item.currentCost,
        });
      }

      // Preparar datos para el recibo
      const receipt = {
        type: formData.type,
        reference: reference,
        reason: formData.reason,
        items: processedItems,
        date: new Date().toLocaleString("es-ES"),
        user: user?.username || "Usuario",
      };

      setCompletedMovement(receipt);
      setReceiptDialogOpen(true);

      toast.success(
        `${formData.type === "entry" ? "Entrada" : "Salida"} registrada correctamente`,
      );

      // Resetear formulario
      setIsDialogOpen(false);
      setMovementItems([]);
      setFormData({
        type: "entry",
        reason: "",
        reference: "",
        productId: "",
        quantity: "1",
        newCost: "",
      });
      setProductSearchTerm("");
      setProductSortFilter("price-desc");
      setSelectedProduct(null);

      loadMovements();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Error al registrar movimiento",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = async () => {
    // Validar plataforma
    if (!isPrintingAvailable()) {
      toast.error('La impresión solo está disponible en la aplicación de escritorio');
      return;
    }

    if (!completedMovement) return;

    try {
      const config = await getPrinterConfig();

      if (!config.pdf) {
        toast.error('No se ha configurado una impresora PDF. Ve a Configuración para configurarla.');
        return;
      }

      // Generar HTML del comprobante
      const itemsHTML = completedMovement.items.map((item: any) => {
        const idsHTML = item.unitIds && item.unitIds.length > 0
          ? `<div style="margin-top: 8px;">
              <p style="font-size: 9pt; font-weight: bold; color: #2563eb; margin-bottom: 4px;">
                IDs de las Unidades:
              </p>
              <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                ${item.unitIds.map((id: string) => `
                  <span style="display: inline-block; padding: 2px 8px; background-color: #dbeafe; color: #1e40af; border-radius: 4px; font-size: 8pt; font-family: monospace;">
                    ${id}
                  </span>
                `).join('')}
              </div>
            </div>`
          : '';

        return `
          <div style="background-color: #f3f4f6; padding: 12px; border-radius: 4px; margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div style="flex: 1;">
                <p style="font-weight: 500; margin-bottom: 4px;">
                  ${item.productCode} - ${item.productName}
                </p>
                <p style="font-size: 10pt; color: #6b7280;">
                  Cantidad: ${item.quantity} | Costo: COP ${formatCOP(item.finalCost)}
                </p>
                ${idsHTML}
              </div>
            </div>
          </div>
        `;
      }).join('');

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              @page {
                size: A4;
                margin: 20mm;
              }
              * {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              body {
                font-family: 'Arial', 'Helvetica', sans-serif;
                margin: 0;
                padding: 0;
                color: #333;
              }
              .container {
                max-width: 700px;
                margin: 0 auto;
                border: 1px solid #ddd;
                border-radius: 8px;
                padding: 30px;
              }
              .header {
                text-align: center;
                margin-bottom: 30px;
              }
              .title {
                font-size: 24pt;
                font-weight: bold;
                margin-bottom: 10px;
              }
              .subtitle {
                font-size: 16pt;
                font-weight: 600;
                color: #666;
              }
              .info-section {
                margin-bottom: 24px;
              }
              .info-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 8px;
                padding-bottom: 8px;
                border-bottom: 1px solid #e5e7eb;
              }
              .info-label {
                font-weight: 500;
              }
              .info-value {
                font-family: monospace;
              }
              .products-section {
                border-top: 2px solid #ddd;
                padding-top: 20px;
              }
              .products-title {
                font-weight: 600;
                font-size: 14pt;
                margin-bottom: 16px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="title">CELUMUNDO VIP</div>
                <div class="subtitle">
                  COMPROBANTE DE ${completedMovement.type === "entry" ? "ENTRADA" : "SALIDA"}
                </div>
              </div>

              <div class="info-section">
                <div class="info-row">
                  <span class="info-label">Referencia:</span>
                  <span class="info-value">${completedMovement.reference}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Fecha:</span>
                  <span>${completedMovement.date}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Usuario:</span>
                  <span>${completedMovement.user}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Motivo:</span>
                  <span>${completedMovement.reason}</span>
                </div>
              </div>

              <div class="products-section">
                <div class="products-title">Productos</div>
                ${itemsHTML}
              </div>
            </div>
          </body>
        </html>
      `;

      const success = await printDirect(config.pdf, html, 'pdf');

      if (!success) {
        throw new Error('Error al enviar el documento a la impresora');
      }

      toast.success('Comprobante enviado a la impresora');
    } catch (error: any) {
      console.error('Error al imprimir:', error);
      toast.error(error.message || 'Error al imprimir el comprobante');
    }
  };

  const handleDownloadPDF = () => {
    if (!completedMovement) return;

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const receipt = completedMovement;
    const pageW = doc.internal.pageSize.getWidth();
    const isEntry = receipt.type === "entry";
    const tipoLabel = isEntry ? "ENTRADA" : "SALIDA";
    const now = new Date().toLocaleString("es-CO", {
      timeZone: "America/Bogota",
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

    // ── Encabezado negro ──────────────────────────────────────
    doc.setFillColor(15, 15, 15);
    doc.rect(0, 0, pageW, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("CELUMUNDO VIP", pageW / 2, 11, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`COMPROBANTE DE ${tipoLabel}`, pageW / 2, 18, { align: "center" });
    doc.setFontSize(7.5);
    doc.text(`Generado: ${now}`, pageW / 2, 25, { align: "center" });

    // ── Info del movimiento ───────────────────────────────────
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("DATOS DEL MOVIMIENTO", 14, 40);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(14, 41.5, pageW - 14, 41.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);
    const infoItems = [
      ["Referencia", receipt.reference],
      ["Fecha", receipt.date],
      ["Usuario", receipt.user],
      ["Motivo", receipt.reason],
    ];
    infoItems.forEach(([label, value], i) => {
      const x = i % 2 === 0 ? 14 : pageW / 2 + 4;
      const y = 49 + Math.floor(i / 2) * 7;
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(`${label}:`, x, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      doc.text(String(value ?? "—"), x + 22, y);
    });

    // ── Tabla de productos ────────────────────────────────────
    const rows = receipt.items.map((item: any) => {
      const unitCost = item.finalCost ?? item.currentCost ?? 0;
      const totalCost = unitCost * item.quantity;
      const ids = item.unitIds && item.unitIds.length > 0
        ? item.unitIds.join(", ")
        : "";
      return [
        item.productCode || "—",
        item.productName + (ids ? `\nIDs: ${ids}` : ""),
        item.quantity.toString(),
        formatCOP(unitCost),
        formatCOP(totalCost),
      ];
    });

    const totalUnits: number = receipt.items.reduce((s: number, it: any) => s + it.quantity, 0);
    const totalCostInventory: number = receipt.items.reduce((s: number, it: any) => {
      const c = it.finalCost ?? it.currentCost ?? 0;
      return s + c * it.quantity;
    }, 0);

    autoTable(doc, {
      startY: 67,
      head: [[
        "Código",
        isEntry ? "Nombre del Producto" : "Nombre del Producto",
        isEntry ? "Cant. Ingresada" : "Cant. Descargada",
        "Costo Unitario",
        "Costo Total",
      ]],
      body: rows,
      styles: {
        fontSize: 8,
        cellPadding: 3,
        textColor: [0, 0, 0],
        lineColor: [200, 200, 200],
        lineWidth: 0.15,
      },
      headStyles: {
        fillColor: [15, 15, 15],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8.5,
        halign: "center",
      },
      alternateRowStyles: { fillColor: [247, 247, 247] },
      columnStyles: {
        0: { cellWidth: 28, halign: "center" },
        1: { cellWidth: "auto" },
        2: { cellWidth: 26, halign: "center" },
        3: { cellWidth: 32, halign: "right" },
        4: { cellWidth: 32, halign: "right" },
      },
      margin: { left: 14, right: 14 },
      didDrawPage: (data: any) => {
        const pageH = doc.internal.pageSize.getHeight();
        doc.setFontSize(7);
        doc.setTextColor(160, 160, 160);
        doc.setFont("helvetica", "normal");
        doc.text(`CELUMUNDO VIP — Comprobante de ${tipoLabel} — Ref: ${receipt.reference}`, 14, pageH - 6);
        doc.text(`Pág. ${data.pageNumber}`, pageW - 14, pageH - 6, { align: "right" });
      },
    });

    // ── Totales finales ───────────────────────────────────────
    const finalY: number = (doc as any).lastAutoTable.finalY + 6;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.4);
    doc.line(14, finalY, pageW - 14, finalY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text(`Total de productos distintos: ${receipt.items.length}`, 14, finalY + 7);
    doc.text(`Total de unidades ${isEntry ? "ingresadas" : "descargadas"}: ${totalUnits}`, 14, finalY + 14);
    doc.text(`Costo total del inventario movido: ${formatCOP(totalCostInventory)}`, 14, finalY + 21);

    doc.save(
      `Comprobante-${tipoLabel}-${receipt.reference}.pdf`,
    );
    toast.success("Comprobante descargado como PDF");
  };

  // Calcular estadísticas
  const stats = {
    totalEntries: movements
      .filter((m) => m.type === "entry")
      .reduce((sum, m) => sum + m.quantity, 0),
    totalExits: movements
      .filter((m) => m.type === "exit")
      .reduce((sum, m) => sum + m.quantity, 0),
  };

  // Función para abrir el diálogo de etiquetas
  const handleOpenLabelDialog = () => {
    if (!completedMovement || completedMovement.type !== "entry") {
      toast.error(
        "Las etiquetas solo se imprimen para ingresos de inventario",
      );
      return;
    }

    // Inicializar cantidades de etiquetas
    const initialQuantities: { [key: number]: number } = {};
    completedMovement.items.forEach((item: any, index: number) => {
      // Si el producto usa IDs, mostrar cada ID como etiqueta individual
      if (item.useUnitIds && item.unitIds && item.unitIds.length > 0) {
        initialQuantities[index] = item.unitIds.length;
      } else {
        initialQuantities[index] = item.quantity;
      }
    });
    setLabelQuantities(initialQuantities);
    setLabelDialogOpen(true);
  };

  // Función para imprimir etiquetas
  const handlePrintLabels = async () => {
    // Validar plataforma
    if (!isPrintingAvailable()) {
      toast.error('La impresión de etiquetas solo está disponible en la aplicación de escritorio');
      return;
    }

    if (!completedMovement) return;

    let labelsHTML = "";
    let pageLabels: string[] = [];

    completedMovement.items.forEach((item: any, itemIndex: number) => {
      const qty = labelQuantities[itemIndex] || 0;
      const product = products.find(p => p.id === item.productId);

      for (let i = 0; i < qty; i++) {
        let displayCode = item.productCode;

        // Si el producto usa IDs y tenemos IDs asignadas, usar código completo
        if (item.useUnitIds && item.unitIds && item.unitIds[i]) {
          displayCode = `${item.productCode}-${item.unitIds[i]}A`;
        }

        // Remover las letras "A" del código para impresión
        // Ejemplo: "A10001A-0001A" -> "10001-0001"
        const cleanDisplayCode = displayCode.replace(/A/g, '');

        const numericCode = displayCode.replace(/[^0-9]/g, "");

        // Obtener últimos 4 dígitos de la nota si existe
        let noteDisplay = '';
        if (item.useUnitIds && item.unitIds && item.unitIds[i] && item.unitIdNotes && item.unitIdNotes[item.unitIds[i]]) {
          const note = item.unitIdNotes[item.unitIds[i]];
          const last4Digits = note.slice(-4);
          if (last4Digits) {
            noteDisplay = last4Digits;
          }
        }

        // Generar código de barras y convertir a imagen PNG base64
        let barcodeImage = '';
        try {
          // Crear canvas temporal
          const canvas = document.createElement('canvas');

          // Generar el código de barras en el canvas
          (window as any).JsBarcode(canvas, numericCode, {
            format: "CODE128",
            width: 2,
            height: 50,
            displayValue: false,
            margin: 8,
            background: "#ffffff",
            lineColor: "#000000"
          });

          // Convertir canvas a imagen base64 PNG
          barcodeImage = canvas.toDataURL('image/png');

          console.log('Código de barras generado:', numericCode, 'Tamaño de imagen:', barcodeImage.length);
          successCount++;
        } catch (error) {
          console.error('Error generando código de barras:', error, 'Código:', numericCode);
          errorCount++;
          continue;
        }

        if (!barcodeImage || barcodeImage.length < 100) {
          console.error('Imagen de código de barras vacía o muy corta');
          errorCount++;
          continue;
        }

        const labelHTML = `
          <div class="label">
            <div class="label-product-name">${item.productName}</div>
            <div class="label-barcode-container">
              <img src="${barcodeImage}" alt="${cleanDisplayCode}" style="display: block; max-width: 28mm; height: auto;">
            </div>
            <div class="label-numeric-code">${cleanDisplayCode}</div>
            ${noteDisplay ? `<div class="label-note">${noteDisplay}</div>` : ''}
            <div class="label-reference">${completedMovement.reference.substring(0, 2).toUpperCase()}</div>
          </div>
        `;

        pageLabels.push(labelHTML);

        if (pageLabels.length === 3) {
          labelsHTML += `<div class="label-page">${pageLabels.join("")}</div>`;
          pageLabels = [];
        }
      }
    });

    if (pageLabels.length > 0) {
      while (pageLabels.length < 3) {
        pageLabels.push('<div class="label label-empty"></div>');
      }
      labelsHTML += `<div class="label-page">${pageLabels.join("")}</div>`;
    }

    // Generar HTML completo (sin scripts ya que los códigos de barras están pre-renderizados)
    const fullHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Etiquetas</title>
          <style>
            @page {
              size: 100mm 25mm;
              margin: 0;
            }

            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }

            html, body {
              margin: 0 !important;
              padding: 0 !important;
              width: 100mm !important;
              height: auto !important;
              background: white;
              overflow: visible;
            }

            body {
              font-family: Arial, sans-serif;
            }

            .label-page {
              width: 100mm !important;
              height: 25mm !important;
              display: flex !important;
              flex-direction: row !important;
              justify-content: center !important;
              align-items: center !important;
              page-break-after: always !important;
              page-break-inside: avoid !important;
              padding: 0 1mm !important;
              background: white !important;
              overflow: hidden !important;
              position: relative;
              gap: 4mm;
            }

            .label {
              width: 30mm !important;
              height: 25mm !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: flex-start !important;
              align-items: center !important;
              padding: 1.5mm 2mm !important;
              flex-shrink: 0 !important;
              position: relative !important;
              overflow: hidden !important;
            }

            .label-empty {
              visibility: hidden !important;
            }

            .label-product-name {
              font-size: 6.1pt !important;
              font-weight: bold !important;
              text-align: center !important;
              max-height: 6.5mm !important;
              overflow: hidden !important;
              line-height: 1.15 !important;
              word-wrap: break-word !important;
              width: 100% !important;
              margin-bottom: 0.5mm !important;
              padding-top: 0mm;
              margin-top: 0mm;
              font-family: Arial, Helvetica, sans-serif !important;
              display: -webkit-box !important;
              -webkit-line-clamp: 2 !important;
              -webkit-box-orient: vertical !important;
            }

            .label-barcode-container {
              width: 100% !important;
              height: 12mm !important;
              display: flex !important;
              justify-content: center !important;
              align-items: center !important;
              flex-shrink: 0 !important;
              margin: 0.3mm 0 !important;
              padding: 0 !important;
              overflow: visible !important;
            }

            .label-barcode-container img {
              display: block !important;
              max-width: 28mm !important;
              height: auto !important;
            }

            .label-numeric-code {
              font-size: 7.5pt !important;
              font-weight: 700 !important;
              text-align: center !important;
              letter-spacing: 0.3px !important;
              line-height: 1 !important;
              margin: 0.2mm 0 !important;
              font-family: Arial, Helvetica, sans-serif !important;
              color: #000000 !important;
              flex-shrink: 0 !important;
            }

            .label-note {
              font-size: 6.5pt !important;
              font-weight: 700 !important;
              text-align: center !important;
              letter-spacing: 0.2px !important;
              line-height: 1 !important;
              margin: 0.2mm 0 !important;
              font-family: Arial, Helvetica, sans-serif !important;
              color: #000000 !important;
              flex-shrink: 0 !important;
            }

            .label-reference {
              font-size: 6pt !important;
              font-weight: 700 !important;
              text-align: left !important;
              line-height: 1 !important;
              position: absolute !important;
              bottom: 1.2mm !important;
              left: 2mm !important;
              color: #000000 !important;
              text-transform: uppercase !important;
            }

            @media print {
              @page {
                size: 100mm 25mm !important;
                margin: 0 !important;
              }

              html, body {
                margin: 0 !important;
                padding: 0 !important;
                width: 100mm !important;
                height: auto !important;
                overflow: visible !important;
              }

              .label-page {
                margin: 0 !important;
                padding: 0 1mm !important;
                width: 100mm !important;
                height: 25mm !important;
                display: flex !important;
                flex-direction: row !important;
                justify-content: center !important;
                align-items: center !important;
                page-break-after: always !important;
                page-break-inside: avoid !important;
                gap: 4mm;
              }

              .label {
                width: 30mm !important;
                height: 25mm !important;
                display: flex !important;
                padding: 1.5mm 2mm !important;
              }

              .label-product-name {
                font-size: 6.1pt !important;
                font-weight: bold !important;
                text-align: center !important;
                max-height: 6.5mm !important;
                overflow: hidden !important;
                line-height: 1.15 !important;
                word-wrap: break-word !important;
                width: 100% !important;
                margin-bottom: 0.5mm !important;
                font-family: Arial, Helvetica, sans-serif !important;
                display: -webkit-box !important;
                -webkit-line-clamp: 2 !important;
                -webkit-box-orient: vertical !important;
              }

              .label-note {
                font-size: 6.5pt !important;
                font-weight: 700 !important;
                text-align: center !important;
                letter-spacing: 0.2px !important;
                line-height: 1 !important;
                margin: 0.2mm 0 !important;
                font-family: Arial, Helvetica, sans-serif !important;
                color: #000000 !important;
                flex-shrink: 0 !important;
              }
            }
          </style>
        </head>
        <body>
          ${labelsHTML}
        </body>
      </html>
    `;

    // Crear iframe oculto para impresión
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      toast.error("No se pudo crear la ventana de impresión");
      document.body.removeChild(iframe);
      return;
    }

    iframeDoc.open();
    iframeDoc.write(fullHTML);
    iframeDoc.close();

    // Cargar JsBarcode y generar códigos de barras
    const script = iframeDoc.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js';
    script.onload = () => {
      setTimeout(() => {
        const barcodes = iframeDoc.querySelectorAll('.barcode-canvas');
        barcodes.forEach((canvas: any) => {
          const code = canvas.dataset.code;
          if (code && iframe.contentWindow?.JsBarcode) {
            iframe.contentWindow.JsBarcode(canvas, code, {
              format: "CODE128",
              width: 2,
              height: 50,
              displayValue: false,
              margin: 8,
              background: "#ffffff",
              lineColor: "#000000"
            });
          }
        });

        setTimeout(() => {
          iframe.contentWindow?.print();
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 100);
        }, 300);
      }, 200);
    };
    iframeDoc.head.appendChild(script);

    setLabelDialogOpen(false);
    toast.success("Preparando impresión...");
  };

  // Función para reimprimir etiquetas de un movimiento existente
  const handleReprintLabels = async () => {
    // Validar plataforma
    if (!isPrintingAvailable()) {
      toast.error('La impresión de etiquetas solo está disponible en la aplicación de escritorio');
      return;
    }

    if (!selectedMovement) return;

    // Buscar el producto directamente en Supabase en lugar del array local
    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', selectedMovement.product_id)
      .single();

    if (error || !product) {
      toast.error("Producto no encontrado en la base de datos");
      console.error('Error buscando producto:', error);
      return;
    }

    // Verificar si el producto usa IDs únicas
    const hasUnitIds = selectedMovement.unit_ids && selectedMovement.unit_ids.length > 0;

    let idsToPrint: string[] = [];
    let quantityToPrint = 0;

    if (hasUnitIds) {
      // Producto con IDs únicas
      idsToPrint = reprintSelection === 'all'
        ? selectedMovement.unit_ids!
        : selectedIdsForReprint;

      if (idsToPrint.length === 0) {
        toast.error("No hay IDs seleccionadas para imprimir");
        return;
      }
    } else {
      // Producto sin IDs únicas - usar cantidad
      quantityToPrint = reprintQuantity;
      if (quantityToPrint <= 0) {
        toast.error("La cantidad debe ser mayor a 0");
        return;
      }
    }

    // Cargar JsBarcode dinámicamente si no está disponible
    if (typeof window.JsBarcode === 'undefined') {
      console.log('Cargando JsBarcode para reimpresión...');
      try {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
        console.log('JsBarcode cargado exitosamente');
      } catch (error) {
        console.error('Error al cargar JsBarcode:', error);
        toast.error('Error al cargar la librería de códigos de barras');
        return;
      }
    }

    // Esperar un momento para asegurar que JsBarcode esté completamente disponible
    await new Promise(resolve => setTimeout(resolve, 100));

    if (typeof window.JsBarcode === 'undefined') {
      toast.error('No se pudo cargar la librería de códigos de barras');
      return;
    }

    // Obtener las notas desde el producto (solo para productos con IDs únicas)
    let notesMap: { [id: string]: string } = {};

    if (hasUnitIds && product.registered_ids && Array.isArray(product.registered_ids)) {
      product.registered_ids.forEach((idObj: any) => {
        if (typeof idObj === 'object' && idObj.id && idObj.note) {
          notesMap[idObj.id] = idObj.note;
        }
      });
    }

    let labelsHTML = "";
    let pageLabels: string[] = [];
    let successCount = 0;
    let errorCount = 0;
    const productName = product.name || selectedMovement.product_name || 'Producto';
    const escapedProductName = productName
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    if (hasUnitIds) {
      // Generar etiquetas con IDs únicas
      for (const unitId of idsToPrint) {
        const displayCode = `${product.code}-${unitId}A`;
        const cleanDisplayCode = displayCode.replace(/A/g, '');
        const numericCode = displayCode.replace(/[^0-9]/g, "");

        let noteDisplay = '';
        if (notesMap[unitId]) {
          const note = notesMap[unitId];
          const last4Digits = note.slice(-4);
          if (last4Digits) {
            noteDisplay = last4Digits;
          }
        }

        // Generar código de barras y convertir a imagen PNG base64
        let barcodeImage = '';
        try {
          const canvas = document.createElement('canvas');
          (window as any).JsBarcode(canvas, numericCode, {
            format: "CODE128",
            width: 2,
            height: 50,
            displayValue: false,
            margin: 8,
            background: "#ffffff",
            lineColor: "#000000"
          });
          barcodeImage = canvas.toDataURL('image/png');
          console.log('Código de barras (reimpresión con IDs) generado:', numericCode, 'Tamaño:', barcodeImage.length);
          successCount++;
        } catch (error) {
          console.error('Error generando código de barras (reimpresión con IDs):', error, 'Código:', numericCode);
          errorCount++;
          continue;
        }

        if (!barcodeImage || barcodeImage.length < 100) {
          console.error('Imagen de código de barras vacía o muy corta (reimpresión con IDs)');
          errorCount++;
          continue;
        }

        const labelHTML = `
          <div class="label">
            <div class="label-product-name">${escapedProductName}</div>
            <div class="label-barcode-container">
              <img src="${barcodeImage}" alt="${cleanDisplayCode}" style="display: block; max-width: 28mm; height: auto;">
            </div>
            <div class="label-numeric-code">${cleanDisplayCode}</div>
            ${noteDisplay ? `<div class="label-note">${noteDisplay}</div>` : ''}
            <div class="label-reference">${selectedMovement.reference.substring(0, 2).toUpperCase()}</div>
          </div>
        `;

        pageLabels.push(labelHTML);

        if (pageLabels.length === 3) {
          labelsHTML += `<div class="label-page">${pageLabels.join("")}</div>`;
          pageLabels = [];
        }
      }
    } else {
      // Generar etiquetas simples sin IDs únicas
      for (let i = 0; i < quantityToPrint; i++) {
        const displayCode = product.code;
        const cleanDisplayCode = displayCode.replace(/A/g, '');
        const numericCode = displayCode.replace(/[^0-9]/g, "");

        // Generar código de barras y convertir a imagen PNG base64
        let barcodeImage = '';
        try {
          const canvas = document.createElement('canvas');
          (window as any).JsBarcode(canvas, numericCode, {
            format: "CODE128",
            width: 2,
            height: 50,
            displayValue: false,
            margin: 8,
            background: "#ffffff",
            lineColor: "#000000"
          });
          barcodeImage = canvas.toDataURL('image/png');
          console.log('Código de barras (reimpresión sin IDs) generado:', numericCode, 'Tamaño:', barcodeImage.length);
          successCount++;
        } catch (error) {
          console.error('Error generando código de barras (reimpresión sin IDs):', error);
          errorCount++;
          continue;
        }

        if (!barcodeImage || barcodeImage.length < 100) {
          console.error('Imagen de código de barras vacía o muy corta (reimpresión sin IDs)');
          errorCount++;
          continue;
        }

        const labelHTML = `
          <div class="label">
            <div class="label-product-name">${escapedProductName}</div>
            <div class="label-barcode-container">
              <img src="${barcodeImage}" alt="${cleanDisplayCode}" style="display: block; max-width: 28mm; height: auto;">
            </div>
            <div class="label-numeric-code">${cleanDisplayCode}</div>
            <div class="label-reference">${selectedMovement.reference.substring(0, 2).toUpperCase()}</div>
          </div>
        `;

        pageLabels.push(labelHTML);

        if (pageLabels.length === 3) {
          labelsHTML += `<div class="label-page">${pageLabels.join("")}</div>`;
          pageLabels = [];
        }
      }
    }

    if (pageLabels.length > 0) {
      while (pageLabels.length < 3) {
        pageLabels.push('<div class="label label-empty"></div>');
      }
      labelsHTML += `<div class="label-page">${pageLabels.join("")}</div>`;
    }

    // Generar HTML completo (sin scripts ya que los códigos de barras están pre-renderizados)
    const fullHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Etiquetas</title>
          <style>
            @page {
              size: 100mm 25mm;
              margin: 0;
            }

            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }

            html, body {
              margin: 0 !important;
              padding: 0 !important;
              width: 100mm !important;
              height: auto !important;
              background: white;
              overflow: visible;
            }

            body {
              font-family: Arial, sans-serif;
            }

            .label-page {
              width: 100mm !important;
              height: 25mm !important;
              display: flex !important;
              flex-direction: row !important;
              justify-content: center !important;
              align-items: center !important;
              page-break-after: always !important;
              page-break-inside: avoid !important;
              padding: 0 1mm !important;
              background: white !important;
              overflow: hidden !important;
              position: relative;
              gap: 4mm;
            }

            .label {
              width: 30mm !important;
              height: 25mm !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: flex-start !important;
              align-items: center !important;
              padding: 1mm 2mm 1.5mm 2mm !important;
              flex-shrink: 0 !important;
              position: relative !important;
              overflow: hidden !important;
            }

            .label-empty {
              visibility: hidden !important;
            }

            .label-product-name {
              font-size: 6.5pt !important;
              font-weight: bold !important;
              text-align: center !important;
              max-height: 6.5mm !important;
              overflow: hidden !important;
              line-height: 1.15 !important;
              word-wrap: break-word !important;
              word-break: break-word !important;
              hyphens: auto !important;
              width: 100% !important;
              margin-bottom: 0.5mm !important;
              padding: 0 !important;
              margin-top: 0mm;
              font-family: Arial, Helvetica, sans-serif !important;
              color: #000000 !important;
              background: transparent !important;
              display: block !important;
            }

            .label-barcode-container {
              width: 100% !important;
              height: 12mm !important;
              display: flex !important;
              justify-content: center !important;
              align-items: center !important;
              flex-shrink: 0 !important;
              margin: 0.3mm 0 !important;
              padding: 0 !important;
              overflow: visible !important;
            }

            .label-barcode-container img {
              display: block !important;
              max-width: 26mm !important;
              max-height: 11.5mm !important;
              height: auto !important;
            }

            .label-numeric-code {
              font-size: 7.5pt !important;
              font-weight: 700 !important;
              text-align: center !important;
              letter-spacing: 0.3px !important;
              line-height: 1 !important;
              margin: 0.2mm 0 !important;
              font-family: Arial, Helvetica, sans-serif !important;
              color: #000000 !important;
              flex-shrink: 0 !important;
            }

            .label-note {
              font-size: 6.5pt !important;
              font-weight: 700 !important;
              text-align: center !important;
              letter-spacing: 0.2px !important;
              line-height: 1 !important;
              margin: 0.2mm 0 !important;
              font-family: Arial, Helvetica, sans-serif !important;
              color: #000000 !important;
              flex-shrink: 0 !important;
            }

            .label-reference {
              font-size: 5pt !important;
              font-weight: bold !important;
              text-align: left !important;
              color: #000000 !important;
              font-family: Arial, sans-serif !important;
              position: absolute !important;
              bottom: 1.2mm !important;
              left: 2mm !important;
              margin: 0 !important;
              text-transform: uppercase !important;
            }
          </style>
        </head>
        <body>
          ${labelsHTML}
        </body>
      </html>
    `;

    // Crear iframe oculto para impresión
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      toast.error("No se pudo crear la ventana de impresión");
      document.body.removeChild(iframe);
      return;
    }

    iframeDoc.open();
    iframeDoc.write(fullHTML);
    iframeDoc.close();

    // Cargar JsBarcode y generar códigos de barras
    const script = iframeDoc.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js';
    script.onload = () => {
      setTimeout(() => {
        const barcodes = iframeDoc.querySelectorAll('.barcode-canvas');
        barcodes.forEach((canvas: any) => {
          const code = canvas.dataset.code;
          if (code && iframe.contentWindow?.JsBarcode) {
            iframe.contentWindow.JsBarcode(canvas, code, {
              format: "CODE128",
              width: 2,
              height: 50,
              displayValue: false,
              margin: 8,
              background: "#ffffff",
              lineColor: "#000000"
            });
          }
        });

        setTimeout(() => {
          iframe.contentWindow?.print();
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 100);
        }, 300);
      }, 200);
    };
    iframeDoc.head.appendChild(script);

    setReprintDialogOpen(false);
    toast.success("Preparando impresión...");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Movimientos de Inventario</h2>
          <p className="text-muted-foreground mt-1">
            Control de entradas y salidas con IDs únicas
          </p>
        </div>
        <Button onClick={() => {
          setIsDialogOpen(true);
          setProductSearchTerm("");
          setProductSortFilter("price-desc");
          setSelectedProduct(null);
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Movimiento
        </Button>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Entradas
            </CardTitle>
            <ArrowUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              +{stats.totalEntries}
            </div>
            <p className="text-xs text-gray-600 mt-1">Unidades ingresadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Salidas
            </CardTitle>
            <ArrowDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              -{stats.totalExits}
            </div>
            <p className="text-xs text-gray-600 mt-1">Unidades retiradas</p>
          </CardContent>
        </Card>
      </div>

      {/* Módulo Reinicio */}
      <Card className="border-zinc-200 dark:border-zinc-800">
        <CardContent className="pt-5 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                <RotateCcw className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
              </div>
              <div>
                <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">Reinicio de Inventario</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Establece el stock de todos los productos en 0. Puedes excluir productos específicos antes de confirmar.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={openResetDialog}
              className="border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex-shrink-0 gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Abrir Reinicio
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Buscar por producto, referencia o motivo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <Select
                value={filterType}
                onValueChange={(value: any) => setFilterType(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los movimientos</SelectItem>
                  <SelectItem value="entry">Solo entradas</SelectItem>
                  <SelectItem value="exit">Solo salidas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de movimientos */}
      <Card>
        <CardHeader>
          <CardTitle>
            Historial de Movimientos ({filteredMovements.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Fecha y Hora
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Tipo
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Producto
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">
                    Cantidad
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    IDs Unidades
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Motivo
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Referencia
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Usuario
                  </th>
                  <th className="text-center py-3 px-4 font-medium text-gray-700">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedMovements.map((movement) => (
                  <tr
                    key={movement.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-3 px-4 text-sm text-gray-700">
                      {new Date(movement.date).toLocaleString("es-ES")}
                    </td>
                    <td className="py-3 px-4">
                      <div
                        className={`flex items-center gap-2 ${
                          movement.type === "entry"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {movement.type === "entry" ? (
                          <>
                            <ArrowUp className="h-4 w-4" />
                            <span className="font-medium">Entrada</span>
                          </>
                        ) : (
                          <>
                            <ArrowDown className="h-4 w-4" />
                            <span className="font-medium">Salida</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">
                        {movement.product_name}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`font-bold ${
                          movement.type === "entry"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {movement.type === "entry" ? "+" : "-"}
                        {movement.quantity}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {movement.unit_ids && movement.unit_ids.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {movement.unit_ids.slice(0, 3).map((id, idx) => (
                            <span
                              key={`${movement.id}-${id}-${idx}`}
                              className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-mono rounded"
                            >
                              {id}
                            </span>
                          ))}
                          {movement.unit_ids.length > 3 && (
                            <span className="text-xs text-gray-500">
                              +{movement.unit_ids.length - 3} más
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700">
                      {movement.reason}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-sm text-blue-600">
                        {movement.reference}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700">
                      {movement.user_name}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {movement.type === 'entry' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedMovement(movement);
                            setReprintSelection('all');
                            setSelectedIdsForReprint([]);
                            setReprintQuantity(movement.quantity || 1);
                            setReprintDialogOpen(true);
                          }}
                          disabled={!isPrintingAvailable()}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Printer className="h-4 w-4 mr-1" />
                          Reimprimir
                        </Button>
                      ) : (
                        <span className="text-xs text-gray-400">N/A</span>
                      )}
                    </td>
                  </tr>
                ))}
                {paginatedMovements.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="py-8 text-center text-gray-500"
                    >
                      No se encontraron movimientos
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Mostrando {startIndex + 1} - {Math.min(endIndex, filteredMovements.length)} de {filteredMovements.length} movimientos
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                    if (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      return (
                        <Button
                          key={page}
                          variant={currentPage === page ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className="min-w-[40px]"
                        >
                          {page}
                        </Button>
                      );
                    } else if (page === currentPage - 2 || page === currentPage + 2) {
                      return <span key={page} className="px-2 text-gray-500">...</span>;
                    }
                    return null;
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para crear movimiento */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Movimiento de Inventario</DialogTitle>
            <DialogDescription>
              Agregue varios productos al movimiento. Las IDs únicas se gestionarán automáticamente.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-4">
              {/* Columna izquierda - Formulario */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Tipo de Movimiento</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: "entry" | "exit") =>
                      setFormData({ ...formData, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entry">
                        <div className="flex items-center gap-2">
                          <ArrowUp className="h-4 w-4 text-green-600" />
                          Entrada (Ingreso al Inventario)
                        </div>
                      </SelectItem>
                      <SelectItem value="exit">
                        <div className="flex items-center gap-2">
                          <ArrowDown className="h-4 w-4 text-red-600" />
                          Salida (Retiro del Inventario)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason">Motivo del Movimiento</Label>
                  <Textarea
                    id="reason"
                    value={formData.reason}
                    onChange={(e) =>
                      setFormData({ ...formData, reason: e.target.value })
                    }
                    placeholder="Ej: Compra a proveedor, Ajuste de inventario, etc."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reference">Referencia</Label>
                  <Input
                    id="reference"
                    value={formData.reference}
                    onChange={(e) =>
                      setFormData({ ...formData, reference: e.target.value })
                    }
                    placeholder="Ej: OC-001, Factura-123 (opcional)"
                  />
                </div>

                <div className="border-t border-border pt-4">
                  <h4 className="font-semibold mb-3">Agregar Producto</h4>

                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Producto</Label>
                      <div className="space-y-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => setProductSearchDialogOpen(true)}
                        >
                          <Search className="h-4 w-4 mr-2" />
                          {selectedProduct
                            ? `${selectedProduct.code} - ${selectedProduct.name}`
                            : "Buscar producto a ingresar o retirar"
                          }
                        </Button>
                        
                        {selectedProduct && (
                          <div className="p-3 bg-muted rounded-lg border border-border">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-medium text-sm">{selectedProduct.code}</p>
                                <p className="text-xs text-muted-foreground">{selectedProduct.name}</p>
                                <div className="flex items-center gap-3 mt-2 text-xs">
                                  <span className="text-muted-foreground">
                                    Stock: <span className="font-semibold text-foreground">{selectedProduct.stock}</span>
                                  </span>
                                  <span className="text-muted-foreground">
                                    Costo: <span className="font-semibold text-green-600">{formatCOP(selectedProduct.current_cost)}</span>
                                  </span>
                                  {selectedProduct.use_unit_ids && (
                                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">🔢 IDs Únicas</span>
                                  )}
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedProduct(null);
                                  setFormData({ ...formData, productId: "", newCost: "" });
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label htmlFor="quantity">Cantidad</Label>
                        <Input
                          id="quantity"
                          type="number"
                          min="1"
                          value={formData.quantity}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              quantity: e.target.value,
                            })
                          }
                        />
                      </div>

                      {formData.type === "entry" && formData.productId && (
                        <div className="space-y-2">
                          <Label
                            htmlFor="newCost"
                            className="flex items-center gap-1"
                          >
                            <DollarSign className="h-3 w-3" />
                            Nuevo Costo
                          </Label>
                          <Input
                            id="newCost"
                            type="number"
                            step="0.01"
                            value={formData.newCost}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                newCost: e.target.value,
                              })
                            }
                            placeholder="Opcional"
                          />
                        </div>
                      )}
                    </div>

                    <Button
                      type="button"
                      onClick={handleAddItem}
                      className="w-full"
                      disabled={!formData.productId}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar Producto
                    </Button>
                  </div>
                </div>
              </div>

              {/* Columna derecha - Lista de productos */}
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-semibold mb-3">
                    Productos Agregados ({movementItems.length})
                  </h4>

                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {movementItems.map((item, index) => (
                      <div
                        key={index}
                        className="p-3 bg-background rounded border border-border"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="font-medium text-sm">
                              {item.productCode}
                              {item.useUnitIds && (
                                <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                  IDs Únicas
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.productName}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveItem(index)}
                          >
                            <X className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label
                              htmlFor={`qty-${index}`}
                              className="text-xs text-muted-foreground"
                            >
                              Cantidad
                            </Label>
                            <Input
                              id={`qty-${index}`}
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) =>
                                handleUpdateItem(index, "quantity", e.target.value)
                              }
                              className="h-8 text-sm"
                            />
                          </div>

                          {formData.type === "entry" && (
                            <div>
                              <Label
                                htmlFor={`cost-${index}`}
                                className="text-xs text-muted-foreground"
                              >
                                Nuevo Costo
                              </Label>
                              <Input
                                id={`cost-${index}`}
                                type="number"
                                step="0.01"
                                value={item.newCost || ""}
                                onChange={(e) =>
                                  handleUpdateItem(index, "newCost", e.target.value)
                                }
                                placeholder={formatCOP(item.currentCost)}
                                className="h-8 text-sm"
                              />
                            </div>
                          )}
                        </div>

                        {/* Mostrar IDs generadas o selector */}
                        {item.useUnitIds && (
                          <div className="mt-2">
                            {formData.type === "entry" && item.unitIds.length > 0 && (
                              <div className="text-xs space-y-2">
                                <div className="flex items-center justify-between">
                                  <p className="font-medium text-emerald-600 dark:text-emerald-400">
                                    IDs generadas automáticamente:
                                  </p>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleOpenUnitIdSelector(index)}
                                    className="h-6 text-xs"
                                  >
                                    <Edit className="h-3 w-3 mr-1" />
                                    Agregar Notas
                                  </Button>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {item.unitIds.map((id, idx) => (
                                    <div key={`entry-${index}-${id}-${idx}`} className="flex flex-col gap-0.5">
                                      <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 font-mono rounded border border-emerald-300 dark:border-emerald-700">
                                        {id}
                                      </span>
                                      {item.unitIdNotes[id] && (
                                        <span className="px-2 py-0.5 text-[10px] text-muted-foreground bg-muted rounded truncate max-w-[80px]" title={item.unitIdNotes[id]}>
                                          {item.unitIdNotes[id]}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {formData.type === "exit" && (
                              <div className="text-xs space-y-2">
                                {item.unitIds.length > 0 ? (
                                  <>
                                    <p className="font-medium text-blue-600 dark:text-blue-400 mb-1">
                                      IDs seleccionadas:
                                    </p>
                                    <div className="flex flex-wrap gap-1 mb-2">
                                      {item.unitIds.map((id, idx) => (
                                        <div key={`exit-${index}-${id}-${idx}`} className="flex flex-col gap-0.5">
                                          <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 font-mono rounded border border-blue-300 dark:border-blue-700">
                                            {id}
                                          </span>
                                          {item.unitIdNotes[id] && (
                                            <span className="px-2 py-0.5 text-[10px] text-muted-foreground bg-muted rounded truncate max-w-[80px]" title={item.unitIdNotes[id]}>
                                              {item.unitIdNotes[id]}
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </>
                                ) : (
                                  <p className="text-red-600 dark:text-red-400 font-medium mb-2">
                                    ⚠️ Debes seleccionar las IDs
                                  </p>
                                )}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenUnitIdSelector(index)}
                                  className="w-full"
                                >
                                  <Hash className="h-3 w-3 mr-1" />
                                  {item.unitIds.length > 0 ? "Editar IDs / Notas" : "Seleccionar IDs"}
                                </Button>
                              </div>
                            )}
                          </div>
                        )}

                        {formData.type === "entry" && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            <p>Costo actual: {formatCOP(item.currentCost)}</p>
                            {item.newCost && item.newCost !== item.currentCost && (
                              <p className="text-green-600 font-medium">
                                → Nuevo costo: {formatCOP(item.newCost)}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}

                    {movementItems.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No hay productos agregados
                      </p>
                    )}
                  </div>

                  {movementItems.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">Total Productos:</span>
                        <span className="font-bold">{movementItems.length}</span>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="font-medium">Total Unidades:</span>
                        <span className="font-bold">
                          {movementItems.reduce((sum, item) => sum + item.quantity, 0)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="border-t border-border pt-4 mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  setProductSearchTerm("");
                  setProductSortFilter("price-desc");
                  setSelectedProduct(null);
                }}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || movementItems.length === 0}>
                {isSubmitting ? (
                  'Procesando...'
                ) : formData.type === "entry" ? (
                  <>
                    <ArrowUp className="h-4 w-4 mr-2" />
                    Registrar Entrada
                  </>
                ) : (
                  <>
                    <ArrowDown className="h-4 w-4 mr-2" />
                    Registrar Salida
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de selector de IDs únicas */}
      <Dialog open={unitIdDialogOpen} onOpenChange={setUnitIdDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              {formData.type === "entry" ? "Agregar Notas a IDs" : "Seleccionar IDs de Unidades"}
            </DialogTitle>
            <DialogDescription>
              {formData.type === "entry" 
                ? "Agrega información adicional opcional a cada ID generada automáticamente."
                : `Selecciona exactamente ${currentItemIndex !== null && movementItems[currentItemIndex]?.quantity} IDs para esta salida y opcionalmente agrega información adicional.`
              }
            </DialogDescription>
          </DialogHeader>

          {currentItemIndex !== null && movementItems[currentItemIndex] && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="bg-muted p-3 rounded">
                <p className="font-medium">{movementItems[currentItemIndex].productName}</p>
                {formData.type === "exit" && (
                  <p className="text-sm text-muted-foreground">
                    Seleccionadas: {selectedUnitIds.length} / {movementItems[currentItemIndex].quantity}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                {/* Para ENTRADAS: Mostrar IDs generadas para agregar notas */}
                {formData.type === "entry" && movementItems[currentItemIndex].unitIds.map((id, idx) => (
                  <div
                    key={`entry-dialog-${id}-${idx}`}
                    className="flex items-center gap-2 p-3 rounded border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                  >
                    {/* ID */}
                    <div className="flex items-center justify-center w-20 py-2 rounded font-mono text-sm font-bold bg-emerald-500 text-white">
                      {id}
                    </div>

                    {/* Campo de nota adicional */}
                    <div className="flex-1 flex items-center gap-2">
                      <Edit className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <Input
                        type="text"
                        placeholder="Información adicional (opcional)"
                        value={unitIdNotes[id] || ""}
                        onChange={(e) => setUnitIdNotes({...unitIdNotes, [id]: e.target.value})}
                        className="text-sm h-8 bg-background"
                      />
                    </div>
                  </div>
                ))}

                {/* Para SALIDAS: Selector de IDs con notas opcionales */}
                {formData.type === "exit" && movementItems[currentItemIndex].availableIds?.map((id, idx) => (
                  <div
                    key={`exit-dialog-${id}-${idx}`}
                    className={`flex items-center gap-2 p-3 rounded border-2 transition-all ${
                      selectedUnitIds.includes(id)
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                        : "border-border bg-card hover:border-muted-foreground/30"
                    }`}
                  >
                    {/* Checkbox y ID */}
                    <button
                      type="button"
                      onClick={() => toggleUnitId(id)}
                      className={`flex items-center justify-center w-20 py-2 rounded font-mono text-sm font-bold transition-all ${
                        selectedUnitIds.includes(id)
                          ? "bg-emerald-500 text-white"
                          : "bg-muted text-foreground hover:bg-muted-foreground/10"
                      }`}
                    >
                      {id}
                    </button>
                    
                    {/* Campo de nota adicional */}
                    {selectedUnitIds.includes(id) && (
                      <div className="flex-1 flex items-center gap-2">
                        <Edit className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <Input
                          type="text"
                          placeholder="Información adicional (opcional)"
                          value={unitIdNotes[id] || ""}
                          onChange={(e) => setUnitIdNotes({...unitIdNotes, [id]: e.target.value})}
                          className="text-sm h-8 bg-background"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setUnitIdDialogOpen(false);
                setCurrentItemIndex(null);
              }}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleSaveUnitIds}>
              {formData.type === "entry" ? "Guardar Notas" : "Confirmar Selección"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de comprobante */}
      <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Comprobante de Movimiento</DialogTitle>
            <DialogDescription>
              El movimiento se ha registrado exitosamente.
            </DialogDescription>
          </DialogHeader>

          {/* Advertencia cuando está en web */}
          {!isPrintingAvailable() && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <div className="text-red-600 dark:text-red-400 mt-0.5">⚠️</div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900 dark:text-red-100 mb-1">
                    Impresión No Disponible
                  </p>
                  <p className="text-xs text-red-800 dark:text-red-200">
                    La impresión solo está disponible en la aplicación de escritorio. Puedes descargar el PDF desde el navegador.
                  </p>
                </div>
              </div>
            </div>
          )}

          {completedMovement && (
            <div ref={printRef} className="py-4">
              <div className="border border-border rounded-lg p-6 bg-background">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold">CELUMUNDO VIP</h2>
                  <p className="text-lg font-semibold text-muted-foreground">
                    COMPROBANTE DE{" "}
                    {completedMovement.type === "entry" ? "ENTRADA" : "SALIDA"}
                  </p>
                </div>

                <div className="space-y-2 mb-6">
                  <div className="flex justify-between">
                    <span className="font-medium">Referencia:</span>
                    <span className="font-mono">{completedMovement.reference}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Fecha:</span>
                    <span>{completedMovement.date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Usuario:</span>
                    <span>{completedMovement.user}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Motivo:</span>
                    <span>{completedMovement.reason}</span>
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <h4 className="font-semibold mb-3">Productos</h4>
                  <div className="space-y-3">
                    {completedMovement.items.map((item: any, index: number) => (
                      <div key={index} className="bg-muted p-3 rounded">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium">
                              {item.productCode} - {item.productName}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Cantidad: {item.quantity} | Costo:{" "}
                              {formatCOP(item.finalCost)}
                            </p>
                            {item.unitIds && item.unitIds.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs font-medium text-blue-600 mb-1">
                                  IDs de las Unidades:
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {item.unitIds.map((id: string, idIdx: number) => (
                                    <span
                                      key={`receipt-${index}-${id}-${idIdx}`}
                                      className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-mono rounded"
                                    >
                                      {id}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {completedMovement.type === "entry" &&
                              item.newCost !== undefined &&
                              item.newCost !== item.currentCost && (
                                <p className="text-xs text-green-600 mt-1">
                                  Costo actualizado: {formatCOP(item.currentCost)} →{" "}
                                  {formatCOP(item.newCost)}
                                </p>
                              )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-border mt-6 pt-4">
                  <div className="flex justify-between font-semibold">
                    <span>Total Productos:</span>
                    <span>{completedMovement.items.length}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Total Unidades:</span>
                    <span>
                      {completedMovement.items.reduce(
                        (sum: number, item: any) => sum + item.quantity,
                        0,
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReceiptDialogOpen(false)}
            >
              Cerrar
            </Button>
            <Button variant="outline" onClick={handleDownloadPDF}>
              <Download className="h-4 w-4 mr-2" />
              Descargar PDF
            </Button>
            <Button onClick={handlePrint} disabled={!isPrintingAvailable()}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
            {completedMovement && completedMovement.type === "entry" && (
              <Button onClick={handleOpenLabelDialog} disabled={!isPrintingAvailable()}>
                <Tag className="h-4 w-4 mr-2" />
                Imprimir Etiquetas
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de etiquetas */}
      <Dialog open={labelDialogOpen} onOpenChange={setLabelDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Imprimir Etiquetas con IDs Únicas</DialogTitle>
            <DialogDescription>
              Configure la cantidad de etiquetas para cada producto. Las etiquetas mostrarán el código completo con ID única.
            </DialogDescription>
          </DialogHeader>

          {/* Advertencia cuando está en web */}
          {!isPrintingAvailable() && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <div className="text-red-600 dark:text-red-400 mt-0.5">⚠️</div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900 dark:text-red-100 mb-1">
                    Impresión No Disponible
                  </p>
                  <p className="text-xs text-red-800 dark:text-red-200">
                    La impresión de etiquetas solo está disponible en la aplicación de escritorio.
                  </p>
                </div>
              </div>
            </div>
          )}

          {completedMovement && (
            <div className="space-y-4">
              <div className="space-y-3">
                {completedMovement.items.map((item: any, index: number) => {
                  const product = products.find((p) => p.id === item.productId);
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/50"
                    >
                      <div className="flex-1">
                        <p className="font-medium">
                          {item.productCode} - {item.productName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Precio Final: {formatCOP(product?.final_price || item.finalCost)}
                        </p>
                        {item.useUnitIds && item.unitIds && item.unitIds.length > 0 && (
                          <p className="text-xs text-blue-600 mt-1">
                            Con IDs: {item.unitIds.join(", ")}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <Label
                          htmlFor={`label-qty-${index}`}
                          className="text-sm whitespace-nowrap"
                        >
                          Etiquetas:
                        </Label>
                        <Input
                          id={`label-qty-${index}`}
                          type="number"
                          min="0"
                          value={labelQuantities[index] || 0}
                          onChange={(e) => {
                            const newQuantities = { ...labelQuantities };
                            newQuantities[index] = parseInt(e.target.value) || 0;
                            setLabelQuantities(newQuantities);
                          }}
                          className="w-20"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  📋 Total de etiquetas a imprimir:{" "}
                  {Object.values(labelQuantities).reduce((sum, qty) => sum + qty, 0)}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  ℹ️ Las etiquetas con IDs únicas mostrarán el código completo (ej: A10001-0001A)
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLabelDialogOpen(false)}
            >
              Cerrar
            </Button>
            <Button
              onClick={handlePrintLabels}
              disabled={
                Object.values(labelQuantities).reduce((sum, qty) => sum + qty, 0) === 0 ||
                !isPrintingAvailable()
              }
            >
              <Printer className="h-4 w-4 mr-2" />
              Imprimir Etiquetas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para buscar y seleccionar producto */}
      <Dialog open={productSearchDialogOpen} onOpenChange={setProductSearchDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Buscar Producto</DialogTitle>
            <DialogDescription>
              Escribe el nombre o código del producto que deseas ingresar o retirar del inventario.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Buscador */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Escribe para buscar productos (mínimo 2 caracteres)..."
                value={productSearchTerm}
                onChange={(e) => setProductSearchTerm(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>

            {/* Filtros de ordenamiento */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <Select
                value={productSortFilter}
                onValueChange={(value: any) => setProductSortFilter(value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="price-desc">Mayor a Menor (PRECIO)</SelectItem>
                  <SelectItem value="price-asc">Menor a Mayor (PRECIO)</SelectItem>
                  <SelectItem value="stock-asc">Stock Menor a Mayor</SelectItem>
                  <SelectItem value="stock-desc">Stock Mayor a Menor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Lista de productos */}
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="max-h-[50vh] overflow-y-auto">
                {isLoadingProducts ? (
                  <div className="py-12 text-center">
                    <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                    <p className="text-muted-foreground">Buscando productos...</p>
                  </div>
                ) : productSearchTerm.length < 2 ? (
                  <div className="py-12 text-center">
                    <Search className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-muted-foreground font-medium">Escribe para buscar productos</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Ingresa el nombre o código del producto que deseas agregar
                    </p>
                  </div>
                ) : getFilteredAndSortedProducts().length > 0 ? (
                  <div className="divide-y divide-border">
                    {getFilteredAndSortedProducts().map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleSelectProductFromDialog(product)}
                        className="w-full p-4 text-left hover:bg-muted transition-colors flex items-center justify-between gap-4"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-mono font-bold text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                              {product.code}
                            </span>
                            {product.use_unit_ids && (
                              <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                                🔢 IDs Únicas
                              </span>
                            )}
                          </div>
                          <p className="font-medium text-base truncate">{product.name}</p>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Stock</p>
                            <p className={`font-bold text-lg ${
                              product.stock <= 5
                                ? "text-red-600"
                                : product.stock <= 10
                                ? "text-yellow-600"
                                : "text-green-600"
                            }`}>
                              {product.stock}
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Costo</p>
                            <p className="font-bold text-lg text-green-600">
                              {formatCOP(product.current_cost)}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <p className="text-muted-foreground">No se encontraron productos</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Intenta con otro término de búsqueda
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Contador de resultados */}
            <div className="text-sm text-muted-foreground text-center">
              {!isLoadingProducts && productSearchTerm.length >= 2 && getFilteredAndSortedProducts().length > 0 && (
                <span>
                  Mostrando {getFilteredAndSortedProducts().length} resultado{getFilteredAndSortedProducts().length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setProductSearchDialogOpen(false);
                setProductSearchTerm("");
                setProducts([]); // Limpiar productos al cerrar
              }}
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Reimpresión de Etiquetas */}
      <Dialog open={reprintDialogOpen} onOpenChange={setReprintDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Reimprimir Etiquetas</DialogTitle>
            <DialogDescription>
              Seleccione qué etiquetas desea reimprimir del movimiento
            </DialogDescription>
          </DialogHeader>

          {/* Advertencia cuando está en web */}
          {!isPrintingAvailable() && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <div className="text-red-600 dark:text-red-400 mt-0.5">⚠️</div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900 dark:text-red-100 mb-1">
                    Impresión No Disponible
                  </p>
                  <p className="text-xs text-red-800 dark:text-red-200">
                    La impresión de etiquetas solo está disponible en la aplicación de escritorio.
                  </p>
                </div>
              </div>
            </div>
          )}

          {selectedMovement && (
            <div className="space-y-4">
              {/* Información del movimiento */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Producto</p>
                <p className="font-semibold">{selectedMovement.product_name}</p>
                <p className="text-sm text-gray-600 mt-2">Referencia</p>
                <p className="font-mono text-sm">{selectedMovement.reference}</p>
                {selectedMovement.unit_ids && selectedMovement.unit_ids.length > 0 ? (
                  <>
                    <p className="text-sm text-gray-600 mt-2">Total de IDs</p>
                    <p className="font-semibold">{selectedMovement.unit_ids.length}</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-600 mt-2">Cantidad</p>
                    <p className="font-semibold">{selectedMovement.quantity}</p>
                  </>
                )}
              </div>

              {selectedMovement.unit_ids && selectedMovement.unit_ids.length > 0 ? (
                <>
                  {/* Selector de modo de impresión para productos CON IDs únicas */}
                  <div className="space-y-3">
                    <Label>Opciones de impresión</Label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="reprint-all"
                          name="reprint-mode"
                          checked={reprintSelection === 'all'}
                          onChange={() => setReprintSelection('all')}
                          className="w-4 h-4 text-blue-600"
                        />
                        <Label htmlFor="reprint-all" className="cursor-pointer">
                          Imprimir todas las IDs ({selectedMovement.unit_ids.length} etiquetas)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="reprint-specific"
                          name="reprint-mode"
                          checked={reprintSelection === 'specific'}
                          onChange={() => setReprintSelection('specific')}
                          className="w-4 h-4 text-blue-600"
                        />
                        <Label htmlFor="reprint-specific" className="cursor-pointer">
                          Seleccionar IDs específicas
                        </Label>
                      </div>
                    </div>
                  </div>

                  {/* Lista de IDs para selección específica */}
                  {reprintSelection === 'specific' && (
                    <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3">
                      <Label className="text-sm font-semibold">Seleccione las IDs a reimprimir:</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedMovement.unit_ids.map((unitId, idx) => {
                          // Obtener nota del producto actual
                          const product = products.find(p => p.id === selectedMovement.product_id);
                          let noteDisplay = '';
                          if (product?.registered_ids && Array.isArray(product.registered_ids)) {
                            const idObj = product.registered_ids.find((obj: any) => obj.id === unitId);
                            if (idObj && idObj.note) {
                              noteDisplay = idObj.note.slice(-4);
                            }
                          }

                          return (
                            <div key={`reprint-${selectedMovement.id}-${unitId}-${idx}`} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`id-${unitId}`}
                                checked={selectedIdsForReprint.includes(unitId)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedIdsForReprint([...selectedIdsForReprint, unitId]);
                                  } else {
                                    setSelectedIdsForReprint(selectedIdsForReprint.filter(id => id !== unitId));
                                  }
                                }}
                                className="w-4 h-4 text-blue-600"
                              />
                              <Label htmlFor={`id-${unitId}`} className="cursor-pointer font-mono text-sm">
                                {unitId}
                                {noteDisplay && (
                                  <span className="ml-2 text-xs text-gray-500">
                                    ({noteDisplay})
                                  </span>
                                )}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                      {selectedIdsForReprint.length > 0 && (
                        <p className="text-sm text-gray-600 mt-2">
                          {selectedIdsForReprint.length} ID(s) seleccionada(s)
                        </p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Selector de cantidad para productos SIN IDs únicas */}
                  <div className="space-y-3">
                    <Label htmlFor="reprint-quantity">Cantidad de etiquetas a imprimir</Label>
                    <Input
                      id="reprint-quantity"
                      type="number"
                      min="1"
                      max="100"
                      value={reprintQuantity}
                      onChange={(e) => setReprintQuantity(parseInt(e.target.value) || 1)}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500">
                      Se imprimirán {reprintQuantity} etiqueta(s) con el código del producto
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReprintDialogOpen(false);
                setSelectedIdsForReprint([]);
                setReprintSelection('all');
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleReprintLabels}
              disabled={
                (selectedMovement?.unit_ids && selectedMovement.unit_ids.length > 0 && reprintSelection === 'specific' && selectedIdsForReprint.length === 0) ||
                (!selectedMovement?.unit_ids && reprintQuantity <= 0) ||
                !isPrintingAvailable()
              }
            >
              <Printer className="h-4 w-4 mr-2" />
              Imprimir Etiquetas
              {selectedMovement && selectedMovement.unit_ids && selectedMovement.unit_ids.length > 0
                ? (reprintSelection === 'all'
                    ? ` (${selectedMovement.unit_ids.length})`
                    : ` (${selectedIdsForReprint.length})`)
                : selectedMovement
                ? ` (${reprintQuantity})`
                : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal de Reinicio de Inventario ─────────────────────── */}
      <Dialog open={showResetDialog} onOpenChange={(open) => { if (!resetting) setShowResetDialog(open); }}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] flex flex-col bg-white dark:bg-zinc-950">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
              <RotateCcw className="w-5 h-5 text-zinc-500" />
              Reinicio de Inventario
            </DialogTitle>
            <DialogDescription className="text-zinc-500 dark:text-zinc-400 text-sm">
              Establece el stock en 0 para todos los productos seleccionados. Puedes excluir los que no deseas afectar.
            </DialogDescription>
          </DialogHeader>

          {/* PASO: seleccionar exclusiones */}
          {resetStep === "select" && (
            <div className="flex flex-col gap-4 overflow-hidden flex-1 min-h-0">
              <div className="flex items-center gap-3 p-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  Esta acción es <strong>irreversible</strong>. Los productos marcados con{" "}
                  <span className="font-semibold">✓</span> serán <strong>excluidos</strong> del reinicio y mantendrán su stock actual.
                </p>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <Input
                    placeholder="Buscar producto..."
                    value={resetSearchTerm}
                    onChange={(e) => setResetSearchTerm(e.target.value)}
                    className="pl-9 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
                  />
                </div>
                <Select value={resetCategoryFilter} onValueChange={setResetCategoryFilter}>
                  <SelectTrigger className="w-44 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700">
                    <SelectValue placeholder="Categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las categorías</SelectItem>
                    {Array.from(new Set(allProductsForReset.map(p => p.category).filter(Boolean))).sort().map(cat => (
                      <SelectItem key={cat} value={cat!}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 px-1">
                <span>
                  {allProductsForReset.length} productos en total —{" "}
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    {resetExclusions.size} excluidos
                  </span>
                </span>
                <div className="flex gap-3">
                  {resetCategoryFilter !== "all" && (
                    <button
                      onClick={() => {
                        const catProducts = allProductsForReset.filter(p => p.category === resetCategoryFilter);
                        const allCatExcluded = catProducts.every(p => resetExclusions.has(p.id));
                        const next = new Set(resetExclusions);
                        catProducts.forEach(p => allCatExcluded ? next.delete(p.id) : next.add(p.id));
                        setResetExclusions(next);
                      }}
                      className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline underline-offset-2"
                    >
                      {allProductsForReset.filter(p => p.category === resetCategoryFilter).every(p => resetExclusions.has(p.id))
                        ? "Incluir categoría"
                        : "Excluir categoría"}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (resetExclusions.size === allProductsForReset.length) {
                        setResetExclusions(new Set());
                      } else {
                        setResetExclusions(new Set(allProductsForReset.map(p => p.id)));
                      }
                    }}
                    className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline underline-offset-2"
                  >
                    {resetExclusions.size === allProductsForReset.length ? "Deseleccionar todos" : "Excluir todos"}
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 min-h-0 border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-100 dark:divide-zinc-800">
                {allProductsForReset
                  .filter(p => {
                    const matchSearch = !resetSearchTerm ||
                      p.name?.toLowerCase().includes(resetSearchTerm.toLowerCase()) ||
                      p.code?.toLowerCase().includes(resetSearchTerm.toLowerCase());
                    const matchCategory = resetCategoryFilter === "all" || p.category === resetCategoryFilter;
                    return matchSearch && matchCategory;
                  })
                  .map(product => {
                    const excluded = resetExclusions.has(product.id);
                    return (
                      <label
                        key={product.id}
                        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                          excluded
                            ? "bg-emerald-50 dark:bg-emerald-950/30"
                            : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={excluded}
                          onChange={() => {
                            const next = new Set(resetExclusions);
                            if (excluded) next.delete(product.id);
                            else next.add(product.id);
                            setResetExclusions(next);
                          }}
                          className="w-4 h-4 rounded accent-emerald-600"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{product.name}</p>
                          <p className="text-xs text-zinc-400 dark:text-zinc-500">{product.code || "Sin código"} · Stock actual: <span className="font-medium">{product.stock ?? 0}</span></p>
                        </div>
                        {excluded && (
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex-shrink-0">Excluido</span>
                        )}
                      </label>
                    );
                  })}
              </div>

              <DialogFooter className="flex flex-row gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowResetDialog(false)} className="flex-1 border-zinc-300 dark:border-zinc-700">
                  Cancelar
                </Button>
                <Button
                  onClick={() => setResetStep("confirm")}
                  disabled={allProductsForReset.length - resetExclusions.size === 0}
                  className="flex-1 bg-zinc-900 hover:bg-zinc-700 dark:bg-zinc-100 dark:hover:bg-zinc-300 dark:text-zinc-900 text-white gap-2"
                >
                  Continuar
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* PASO: confirmación */}
          {resetStep === "confirm" && (
            <div className="flex flex-col gap-5">
              <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                  <p className="font-semibold text-red-800 dark:text-red-300 text-sm">¿Confirmar reinicio?</p>
                </div>
                <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed pl-7">
                  Se establecerá el stock en <strong>0</strong> para{" "}
                  <strong>{allProductsForReset.length - resetExclusions.size}</strong> productos.{" "}
                  {resetExclusions.size > 0 && (
                    <>{resetExclusions.size} productos excluidos mantendrán su stock.</>
                  )}
                  {" "}Esta acción no se puede deshacer.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
                  <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{allProductsForReset.length}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Total productos</p>
                </div>
                <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 p-3">
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400">{allProductsForReset.length - resetExclusions.size}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Se reiniciarán</p>
                </div>
                <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/20 p-3">
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{resetExclusions.size}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Excluidos</p>
                </div>
              </div>

              <DialogFooter className="flex flex-row gap-2">
                <Button variant="outline" onClick={() => setResetStep("select")} disabled={resetting} className="flex-1 border-zinc-300 dark:border-zinc-700">
                  Volver
                </Button>
                <Button
                  onClick={executeReset}
                  disabled={resetting}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white gap-2"
                >
                  {resetting ? (
                    <>
                      <RotateCcw className="w-4 h-4 animate-spin" />
                      Reiniciando...
                    </>
                  ) : (
                    <>
                      <PackageX className="w-4 h-4" />
                      Confirmar Reinicio
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* PASO: completado */}
          {resetStep === "done" && (
            <div className="flex flex-col items-center gap-5 py-4">
              <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                <CheckCircle className="w-9 h-9 text-zinc-700 dark:text-zinc-300" />
              </div>
              <div className="text-center space-y-1">
                <p className="font-bold text-zinc-900 dark:text-zinc-100 text-lg">¡Reinicio completado!</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {allProductsForReset.length - resetExclusions.size} productos reiniciados a stock 0.
                  {resetExclusions.size > 0 && ` ${resetExclusions.size} excluidos sin cambios.`}
                </p>
              </div>
              <Button
                onClick={() => setShowResetDialog(false)}
                className="bg-zinc-900 hover:bg-zinc-700 dark:bg-zinc-100 dark:hover:bg-zinc-300 dark:text-zinc-900 text-white px-8"
              >
                Cerrar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
