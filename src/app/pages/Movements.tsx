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
} from "lucide-react";
import {
  getMovements,
  getProducts,
  addMovement,
  getCurrentUser,
  updateProduct,
  type Movement,
  type Product,
} from "../lib/supabase";
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
import JsBarcode from "jsbarcode";
import { includesIgnoreAccents } from "../lib/string-utils";

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

export function Movements() {
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

  // Prevenir doble clic
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados para búsqueda y filtros de productos
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [productSortFilter, setProductSortFilter] = useState<"price-desc" | "price-asc" | "stock-asc" | "stock-desc">("price-desc");
  const [productSearchDialogOpen, setProductSearchDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

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
    loadProducts();
  }, []);

  const loadMovements = async () => {
    const data = await getMovements();
    setMovements(
      data.sort(
        (a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    );
  };

  const loadProducts = async () => {
    const data = await getProducts();
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

  // Generar siguiente ID única para un producto
  const generateNextUnitId = (registeredIds: string[]): string => {
    if (registeredIds.length === 0) {
      return "0001";
    }
    
    // Ordenar y encontrar el último número
    const numbers = registeredIds
      .map(id => parseInt(id))
      .filter(n => !isNaN(n))
      .sort((a, b) => a - b);
    
    const lastNumber = numbers[numbers.length - 1] || 0;
    const nextNumber = lastNumber + 1;
    
    return nextNumber.toString().padStart(4, "0");
  };

  // Generar múltiples IDs únicas
  const generateMultipleUnitIds = (registeredIds: string[], count: number): string[] => {
    const newIds: string[] = [];
    let currentIds = [...registeredIds];
    
    for (let i = 0; i < count; i++) {
      const nextId = generateNextUnitId(currentIds);
      newIds.push(nextId);
      currentIds.push(nextId);
    }
    
    return newIds;
  };

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
      availableIds: product.use_unit_ids ? (product.registered_ids || []) : undefined,
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
    setUnitIdNotes({...movementItems[index].unitIdNotes});
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
        const product = products.find((p) => p.id === item.productId);
        if (!product) continue;

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
            // Agregar nuevas IDs
            updatedIds = [...updatedIds, ...item.unitIds];
          } else {
            // Remover IDs vendidas/salidas
            updatedIds = updatedIds.filter(id => !item.unitIds.includes(id));
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
          unit_ids: item.unitIds,
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
      loadProducts();
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

  const handlePrint = () => {
    if (printRef.current) {
      const printContent = printRef.current.innerHTML;
      const originalContent = document.body.innerHTML;

      document.body.innerHTML = printContent;
      window.print();
      document.body.innerHTML = originalContent;
      window.location.reload();
    }
  };

  const handleDownloadPDF = () => {
    if (!completedMovement) return;

    const doc = new jsPDF();
    const receipt = completedMovement;

    // Título
    doc.setFontSize(16);
    doc.text("CELUMUNDO VIP", 105, 20, { align: "center" });
    doc.setFontSize(12);
    doc.text(
      `COMPROBANTE DE ${receipt.type === "entry" ? "ENTRADA" : "SALIDA"}`,
      105,
      26,
      { align: "center" },
    );
    doc.line(10, 30, 200, 30);

    // Información del movimiento
    doc.setFontSize(10);
    doc.text(`Referencia: ${receipt.reference}`, 10, 40);
    doc.text(`Fecha: ${receipt.date}`, 10, 46);
    doc.text(`Usuario: ${receipt.user}`, 10, 52);
    doc.text(`Motivo: ${receipt.reason}`, 10, 58);
    doc.line(10, 62, 200, 62);

    // Encabezado de productos
    doc.setFontSize(10);
    doc.text("PRODUCTOS", 105, 70, { align: "center" });
    doc.line(10, 74, 200, 74);

    // Detalles de productos
    let y = 80;
    receipt.items.forEach((item: any) => {
      doc.text(`${item.productCode} - ${item.productName}`, 10, y);
      doc.text(`  Cantidad: ${item.quantity}`, 10, y + 6);
      doc.text(`  Costo: ${formatCOP(item.finalCost)}`, 10, y + 12);
      
      // Mostrar IDs si existen
      if (item.unitIds && item.unitIds.length > 0) {
        doc.text(`  IDs: ${item.unitIds.join(", ")}`, 10, y + 18);
        y += 18;
      }
      
      if (
        receipt.type === "entry" &&
        item.newCost !== undefined &&
        item.newCost !== item.currentCost
      ) {
        doc.text(
          `  (Costo anterior: ${formatCOP(item.currentCost)})`,
          10,
          y + 6,
        );
        y += 6;
      }
      
      y += 18;
    });

    // Totales
    doc.line(10, y + 10, 200, y + 10);
    doc.text(`Total Productos: ${receipt.items.length}`, 10, y + 20);
    doc.text(
      `Total Unidades: ${receipt.items.reduce((sum: number, item: any) => sum + item.quantity, 0)}`,
      10,
      y + 26,
    );

    // Descargar PDF
    doc.save(
      `${completedMovement.type === "entry" ? "Entrada" : "Salida"}-${completedMovement.reference}.pdf`,
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
  const handlePrintLabels = () => {
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
        const barcodeId = `barcode-${itemIndex}-${i}`;

        const labelHTML = `
          <div class="label">
            <div class="label-product-name">${item.productName}</div>
            <div class="label-barcode-container">
              <svg id="${barcodeId}"></svg>
            </div>
            <div class="label-numeric-code">${cleanDisplayCode}</div>
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

    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    iframe.style.left = "-9999px";
    iframe.style.top = "-9999px";
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) {
      toast.error("Error al crear ventana de impresión");
      return;
    }

    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Etiquetas</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
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
              max-height: 3.5mm !important; 
              overflow: hidden !important; 
              line-height: 1.1 !important; 
              word-wrap: break-word !important; 
              width: 100% !important; 
              margin-bottom: 0.3mm !important; 
              padding-top: 0mm;
              margin-top: 0mm;
            }
            
            .label-barcode-container { 
              width: 100% !important; 
              height: 13mm !important; 
              display: flex !important; 
              justify-content: center !important; 
              align-items: center !important; 
              flex-shrink: 0 !important;
              margin: 0.5mm 0 !important; 
              padding: 0 !important;
              overflow: visible !important;
            }
            
            .label-barcode-container svg { 
              display: block !important;
              max-width: 28mm !important; 
              height: auto !important; 
            }
            
            .label-numeric-code { 
              font-size: 7pt !important; 
              font-weight: bold !important; 
              text-align: center !important; 
              letter-spacing: 0.2px !important; 
              line-height: 1 !important; 
              margin: 0.3mm 0 !important; 
              font-family: 'Courier New', monospace !important;
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
              
              .label-barcode-container svg,
              .label-barcode-container svg * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
              }
              
              .label-barcode-container svg rect[fill="#000000"],
              .label-barcode-container svg rect[fill="black"] {
                fill: #000000 !important;
              }
            }
          </style>
        </head>
        <body>
          ${labelsHTML}
          <script>
            function initPrint() {
              if (typeof JsBarcode === 'undefined') {
                setTimeout(initPrint, 50);
                return;
              }
              
              try {
                ${completedMovement.items
                  .map((item: any, itemIndex: number) => {
                    const qty = labelQuantities[itemIndex] || 0;
                    let code = "";

                    for (let i = 0; i < qty; i++) {
                      let displayCode = item.productCode;
                      if (item.useUnitIds && item.unitIds && item.unitIds[i]) {
                        // Remover la "A" final del código base antes de agregar la ID
                        const baseCode = item.productCode.slice(0, -1);
                        displayCode = `${baseCode}-${item.unitIds[i]}A`;
                      }
                      const numericCode = displayCode.replace(/[^0-9]/g, "");

                      code += `
                      (function() {
                        var elem = document.getElementById("barcode-${itemIndex}-${i}");
                        if (elem) {
                          JsBarcode(elem, "${numericCode}", {
                            format: "CODE128",
                            width: 2,
                            height: 50,
                            displayValue: false,
                            margin: 8,
                            background: "#ffffff",
                            lineColor: "#000000"
                          });
                        }
                      })();
                    `;
                    }

                    return code;
                  })
                  .join("")}
                
                setTimeout(function() {
                  window.print();
                  
                  window.onafterprint = function() {
                    setTimeout(function() {
                      try {
                        parent.document.body.removeChild(parent.document.querySelector('iframe'));
                      } catch(e) {}
                    }, 500);
                  };
                  
                  setTimeout(function() {
                    try {
                      parent.document.body.removeChild(parent.document.querySelector('iframe'));
                    } catch(e) {}
                  }, 5000);
                }, 250);
                
              } catch(e) {
                console.error('Error:', e);
                alert('Error generando etiquetas: ' + e.message);
              }
            }
            
            if (document.readyState === 'complete') {
              initPrint();
            } else {
              window.addEventListener('load', initPrint);
            }
          </script>
        </body>
      </html>
    `);
    iframeDoc.close();

    toast.success("Preparando etiquetas para impresión...");
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
                          {movement.unit_ids.slice(0, 3).map((id) => (
                            <span
                              key={id}
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
                  </tr>
                ))}
                {paginatedMovements.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
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
                            : "Buscar Producto"
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
                                  {item.unitIds.map((id) => (
                                    <div key={id} className="flex flex-col gap-0.5">
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
                                      {item.unitIds.map((id) => (
                                        <div key={id} className="flex flex-col gap-0.5">
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
                {formData.type === "entry" && movementItems[currentItemIndex].unitIds.map((id) => (
                  <div 
                    key={id}
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
                {formData.type === "exit" && movementItems[currentItemIndex].availableIds?.map((id) => (
                  <div 
                    key={id}
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
                                  {item.unitIds.map((id: string) => (
                                    <span
                                      key={id}
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
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
            {completedMovement && completedMovement.type === "entry" && (
              <Button onClick={handleOpenLabelDialog}>
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
                Object.values(labelQuantities).reduce((sum, qty) => sum + qty, 0) === 0
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
              Usa el buscador y filtros para encontrar el producto que deseas agregar al movimiento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Buscador */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Buscar por nombre o código..."
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
                {getFilteredAndSortedProducts().length > 0 ? (
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
              {getFilteredAndSortedProducts().length > 0 && (
                <span>
                  Mostrando {getFilteredAndSortedProducts().length} de {products.length} productos
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
              }}
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
