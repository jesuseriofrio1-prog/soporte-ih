import * as ExcelJS from 'exceljs';
import { mapEstadoRocket, inferTipoEntrega, type EstadoSoporte } from './rocket-estado.map';

/**
 * Fila cruda de Rocket tras parsear el Excel (26 columnas en el orden
 * reportado por Rocket → Pedidos → Resumen Excel).
 */
export interface RocketRow {
  /** Fila en el Excel (base 1, incluye header). Útil para reportar errores. */
  rowNumber: number;
  tracking: string | null;      // A
  estado: string;               // B
  transportadora: string | null;// C
  productoNombre: string;       // F
  unidades: number;             // G
  precio: number;               // H
  observaciones: string | null; // I
  clienteNombre: string;        // J
  direccion: string;            // K
  ciudadRaw: string | null;     // L  "GUAYAQUIL, Guayas"
  telefono: string;             // M
  email: string | null;         // N
  externalOrderId: string;      // O  ← ID PEDIDO
  fechaPedido: string | null;   // S  "13-04-2026"
  shopifyOrderId: string | null;// V
  esCarrito: boolean;           // W
}

/**
 * Row normalizada lista para upsertear en nuestro modelo de pedidos.
 * producto_id queda sin resolver hasta que el service matchea el nombre.
 */
export interface ParsedRow extends RocketRow {
  estadoMapped: EstadoSoporte | null;
  aplazado: boolean;
  skip: boolean;
  tipoEntrega: 'DOMICILIO' | 'AGENCIA';
  ciudad: string | null;
  provincia: string | null;
}

const EXPECTED_HEADERS = [
  'TRACKING', 'ESTADO', 'TRANSPORTADORA', 'ENVIO', 'CÓDIGO',
  'PRODUCTOS', 'UD', 'PRECIO', 'OBSERVACIONES',
  'NOMBRE COMPLETO', 'DIRECCIÓN', 'CIUDAD', 'TELF', 'EMAIL',
  'ID PEDIDO',
];

/** Descompone `"GUAYAQUIL, Guayas"` → `{ ciudad: 'GUAYAQUIL', provincia: 'Guayas' }`. */
function splitCiudad(raw: string | null): { ciudad: string | null; provincia: string | null } {
  if (!raw) return { ciudad: null, provincia: null };
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) return { ciudad: parts[0], provincia: parts.slice(1).join(', ') };
  return { ciudad: parts[0] ?? null, provincia: null };
}

/** Convierte un cell value de exceljs a string, manejando hyperlinks, fórmulas y números. */
function cellString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object' && value !== null) {
    const v = value as Record<string, unknown>;
    // Hyperlink cell: { text, hyperlink }. text puede ser número o string.
    if (v.text !== undefined && v.text !== null) {
      return typeof v.text === 'string' ? v.text.trim() : String(v.text);
    }
    // Formula cell: { formula, result }
    if (v.result !== undefined && v.result !== null) {
      return typeof v.result === 'string' ? v.result.trim() : String(v.result);
    }
    // Rich text cell: { richText: [{ text }, ...] }
    if (Array.isArray(v.richText)) {
      return v.richText
        .map((r) => (typeof r === 'object' && r !== null ? (r as { text?: string }).text ?? '' : ''))
        .join('')
        .trim() || null;
    }
  }
  return String(value).trim();
}

function cellNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = parseFloat(value.replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof value === 'object' && value !== null) {
    const v = value as Record<string, unknown>;
    if (typeof v.result === 'number') return v.result;
  }
  return 0;
}

function cellBool(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'boolean') return value;
  const s = String(value).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'sí' || s === 'si';
}

export interface ParseError {
  rowNumber: number;
  message: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: ParseError[];
  skippedByEstado: { rowNumber: number; estado: string; externalOrderId: string }[];
}

/**
 * Parsea un Excel de Rocket (buffer) y devuelve filas normalizadas.
 * Valida headers básicos; si difieren, lanza error (el exportador de
 * Rocket podría haber cambiado).
 */
export async function parseRocketExcel(buffer: Buffer): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook();
  // exceljs types esperan un Buffer exacto; cast seguro porque internamente
  // sólo lee como Uint8Array.
  await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);

  const ws = wb.worksheets[0];
  if (!ws) throw new Error('El archivo no contiene hojas.');

  // Validar headers esperados (columnas A..O)
  const headerRow = ws.getRow(1);
  for (let i = 0; i < EXPECTED_HEADERS.length; i++) {
    const v = cellString(headerRow.getCell(i + 1).value);
    if (v !== EXPECTED_HEADERS[i]) {
      throw new Error(
        `Cabecera inesperada en columna ${i + 1}: se esperaba "${EXPECTED_HEADERS[i]}" pero llegó "${v}". ¿Cambió el formato de Rocket?`,
      );
    }
  }

  const rows: ParsedRow[] = [];
  const errors: ParseError[] = [];
  const skippedByEstado: ParseResult['skippedByEstado'] = [];

  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // header

    const externalOrderId = cellString(row.getCell(15).value); // O
    if (!externalOrderId) {
      errors.push({ rowNumber, message: 'Falta ID PEDIDO (columna O)' });
      return;
    }

    const estadoRaw = cellString(row.getCell(2).value) ?? '';
    const estadoMap = mapEstadoRocket(estadoRaw);

    // Si el estado no se reconoce, no bloqueamos: lo dejamos en PENDIENTE y
    // reportamos en errores para revisión.
    let estadoMapped: EstadoSoporte | null = null;
    let aplazado = false;
    let skip = false;
    if (estadoMap) {
      estadoMapped = estadoMap.estado;
      aplazado = !!estadoMap.aplazado;
      skip = !!estadoMap.skip;
    } else {
      errors.push({
        rowNumber,
        message: `Estado de Rocket no reconocido: "${estadoRaw}" (ID pedido ${externalOrderId})`,
      });
    }

    if (skip) {
      skippedByEstado.push({ rowNumber, estado: estadoRaw, externalOrderId });
      return;
    }

    const ciudadRaw = cellString(row.getCell(12).value);
    const { ciudad, provincia } = splitCiudad(ciudadRaw);

    const productoNombre = cellString(row.getCell(6).value) ?? '';
    const clienteNombre = cellString(row.getCell(10).value) ?? '';
    const direccion = cellString(row.getCell(11).value) ?? '';
    const telefono = cellString(row.getCell(13).value) ?? '';

    // Validaciones mínimas para que el pedido se pueda crear
    if (!productoNombre) {
      errors.push({ rowNumber, message: `Fila ${rowNumber} sin producto (col F), ID ${externalOrderId}` });
      return;
    }
    if (!clienteNombre) {
      errors.push({ rowNumber, message: `Fila ${rowNumber} sin nombre de cliente (col J), ID ${externalOrderId}` });
      return;
    }
    if (!telefono) {
      errors.push({ rowNumber, message: `Fila ${rowNumber} sin teléfono (col M), ID ${externalOrderId}` });
      return;
    }

    rows.push({
      rowNumber,
      tracking: cellString(row.getCell(1).value),
      estado: estadoRaw,
      transportadora: cellString(row.getCell(3).value),
      productoNombre,
      unidades: Math.max(1, Math.round(cellNumber(row.getCell(7).value))),
      precio: cellNumber(row.getCell(8).value),
      observaciones: cellString(row.getCell(9).value),
      clienteNombre,
      direccion,
      ciudadRaw,
      telefono,
      email: cellString(row.getCell(14).value),
      externalOrderId,
      fechaPedido: cellString(row.getCell(19).value), // S
      shopifyOrderId: cellString(row.getCell(22).value), // V
      esCarrito: cellBool(row.getCell(23).value),

      // Derivados
      estadoMapped: estadoMapped ?? 'PENDIENTE',
      aplazado,
      skip: false,
      tipoEntrega: inferTipoEntrega(estadoRaw),
      ciudad,
      provincia,
    });
  });

  return { rows, errors, skippedByEstado };
}
