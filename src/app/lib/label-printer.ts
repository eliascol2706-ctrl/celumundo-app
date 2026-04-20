// Servicio de impresión de etiquetas directa

import { getPrinterConfig, printDirect } from './printer-config';
import { formatCOP } from './currency';

interface LabelOptions {
  productName: string;
  productCode: string;
  price: number;
  quantity?: number;
  useUnitIds?: boolean;
  unitIds?: Array<{ id: string; note?: string }>;
}

// Generar HTML para una etiqueta individual
const generateSingleLabelHTML = (
  productName: string,
  productCode: string,
  price: number,
  unitId?: string,
  note?: string
): string => {
  const displayName = productName.length > 30 ? productName.substring(0, 30) + '...' : productName;
  const displayCode = unitId ? `${productCode}-${unitId}` : productCode;
  const noteDisplay = note && note.length > 0 ? note.substring(note.length - 4) : '';

  return `
    <div style="
      width: 100mm;
      height: 50mm;
      padding: 3mm;
      border: 1px solid #000;
      page-break-after: always;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      font-family: Arial, sans-serif;
    ">
      <!-- Nombre del producto -->
      <div style="
        font-size: 12pt;
        font-weight: bold;
        text-align: center;
        margin-bottom: 2mm;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      ">
        ${displayName}
      </div>

      <!-- Código de barras simulado (texto grande) -->
      <div style="
        text-align: center;
        margin: 2mm 0;
        flex-grow: 1;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          font-family: 'Courier New', monospace;
          font-size: 24pt;
          font-weight: bold;
          letter-spacing: 3px;
          border: 2px solid #000;
          padding: 5mm;
          background: linear-gradient(to right,
            #000 0%, #000 10%, #fff 10%, #fff 20%,
            #000 20%, #000 30%, #fff 30%, #fff 40%,
            #000 40%, #000 50%, #fff 50%, #fff 60%,
            #000 60%, #000 70%, #fff 70%, #fff 80%,
            #000 80%, #000 90%, #fff 90%, #fff 100%
          );
          background-size: 100% 8mm;
          background-repeat: no-repeat;
          background-position: center;
        ">
          ${displayCode}
        </div>
      </div>

      <!-- Precio y nota -->
      <div style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 2mm;
        border-top: 2px solid #000;
        padding-top: 2mm;
      ">
        <div style="
          font-size: 18pt;
          font-weight: bold;
        ">
          ${formatCOP(price)}
        </div>
        ${noteDisplay ? `
        <div style="
          font-size: 10pt;
          color: #666;
          font-style: italic;
        ">
          ${noteDisplay}
        </div>
        ` : ''}
      </div>
    </div>
  `;
};

// Generar HTML para múltiples etiquetas
const generateLabelsHTML = (options: LabelOptions): string => {
  const labels: string[] = [];

  if (options.useUnitIds && options.unitIds && options.unitIds.length > 0) {
    // Imprimir una etiqueta por cada ID única
    options.unitIds.forEach((unitId) => {
      labels.push(
        generateSingleLabelHTML(
          options.productName,
          options.productCode,
          options.price,
          unitId.id,
          unitId.note
        )
      );
    });
  } else {
    // Imprimir la cantidad especificada de etiquetas
    const quantity = options.quantity || 1;
    for (let i = 0; i < quantity; i++) {
      labels.push(
        generateSingleLabelHTML(
          options.productName,
          options.productCode,
          options.price
        )
      );
    }
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page {
            size: 100mm 50mm;
            margin: 0;
          }
          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            margin: 0;
            padding: 0;
          }
        </style>
      </head>
      <body>
        ${labels.join('')}
      </body>
    </html>
  `;
};

// Imprimir etiquetas directamente
export const printLabels = async (options: LabelOptions): Promise<boolean> => {
  try {
    const config = await getPrinterConfig();

    if (!config.labels) {
      throw new Error('No se ha configurado una impresora de etiquetas. Ve a Configuración para configurarla.');
    }

    const html = generateLabelsHTML(options);

    const success = await printDirect(config.labels, html, 'label');

    if (!success) {
      throw new Error('Error al enviar las etiquetas a la impresora');
    }

    return true;
  } catch (error) {
    console.error('Error al imprimir etiquetas:', error);
    throw error;
  }
};

// Función auxiliar para imprimir etiquetas de movimiento (entrada de productos)
export const printMovementLabels = async (
  productName: string,
  productCode: string,
  price: number,
  quantity: number,
  useUnitIds: boolean,
  unitIds?: Array<{ id: string; note?: string }>
): Promise<boolean> => {
  return printLabels({
    productName,
    productCode,
    price,
    quantity,
    useUnitIds,
    unitIds,
  });
};
