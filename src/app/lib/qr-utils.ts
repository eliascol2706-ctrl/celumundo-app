// QR code generation utility — uses qrcode browser bundle (SVG output, no canvas needed)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — no @types/qrcode, placed manually
import QRCode from 'qrcode';

/** Returns an SVG string for the given text, suitable for embedding directly in HTML. */
export async function generateQRSVG(
  text: string,
  size = 120,
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H' = 'M'
): Promise<string> {
  try {
    const svg: string = await QRCode.toString(text, {
      type: 'svg',
      width: size,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel,
    });
    return svg;
  } catch {
    return '';
  }
}

const PUBLIC_BASE_URL = 'https://celumundo-app.vercel.app';

/** Returns the public invoice URL for the given invoice number. */
export function getPublicInvoiceURL(invoiceNumber: string | number): string {
  return `${PUBLIC_BASE_URL}/factura/${invoiceNumber}`;
}
