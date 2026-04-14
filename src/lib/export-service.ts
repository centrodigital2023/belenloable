/**
 * Unified export service for nursing notes.
 * Generates PDF (via browser print), Word (.doc HTML), and Excel (.csv) documents
 * with Hogar Belén corporate branding.
 */

const CORPORATE_HEADER = `
  <div style="font-family: Arial, sans-serif; padding: 0 40px;">
    <div style="display: flex; align-items: center; border-bottom: 3px solid #1a56db; padding-bottom: 12px; margin-bottom: 20px;">
      <div style="flex: 1;">
        <h1 style="margin: 0; color: #1a56db; font-size: 22px;">Hogar Belén</h1>
        <p style="margin: 2px 0 0; color: #555; font-size: 12px;">Centro Residencial Geriátrico</p>
      </div>
      <div style="text-align: right; color: #555; font-size: 11px;">
        <p style="margin: 0;">www.hogarbelen.com</p>
        <p style="margin: 2px 0 0;">Generado: ${new Date().toLocaleString('es-CO')}</p>
      </div>
    </div>
`;

const CORPORATE_FOOTER = `
    <div style="border-top: 1px solid #ddd; margin-top: 40px; padding-top: 10px; text-align: center; color: #888; font-size: 10px;">
      <p style="margin: 0;">Hogar Belén – Documento confidencial de uso exclusivo del equipo de salud.</p>
      <p style="margin: 2px 0 0;">Este documento fue generado automáticamente y debe ser revisado por el profesional responsable.</p>
    </div>
  </div>
`;

/**
 * Exports the note as a PDF via the browser's print dialog.
 * Opens an invisible iframe with styled content and triggers window.print().
 */
export function exportToPDF(noteContent: string, title: string): void {
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (!printWindow) return;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <title>${title}</title>
      <style>
        body { margin: 20px; font-size: 13px; color: #222; }
        pre { white-space: pre-wrap; word-wrap: break-word; font-family: Arial, sans-serif; line-height: 1.6; }
        @media print {
          body { margin: 0; }
          button { display: none; }
        }
      </style>
    </head>
    <body>
      ${CORPORATE_HEADER}
        <pre>${escapeHtml(noteContent)}</pre>
      ${CORPORATE_FOOTER}
      <script>
        window.onload = function() { window.print(); };
      <\/script>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

/**
 * Exports the note as a Word-compatible .doc file (HTML-based).
 */
export function exportToWord(noteContent: string, title: string): void {
  const htmlContent = `
    <!DOCTYPE html>
    <html xmlns:o="urn:schemas-microsoft-com:office:office" 
          xmlns:w="urn:schemas-microsoft-com:office:word"
          xmlns="http://www.w3.org/TR/REC-html40" lang="es">
    <head>
      <meta charset="UTF-8" />
      <title>${title}</title>
      <!--[if gte mso 9]>
      <xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml>
      <![endif]-->
      <style>
        body { font-family: Arial, sans-serif; font-size: 12pt; color: #222; margin: 2cm; }
        h1 { color: #1a56db; font-size: 18pt; }
        pre { white-space: pre-wrap; word-wrap: break-word; font-size: 11pt; line-height: 1.6; }
        .footer { border-top: 1pt solid #aaa; margin-top: 40pt; padding-top: 8pt; font-size: 9pt; color: #777; text-align: center; }
      </style>
    </head>
    <body>
      ${CORPORATE_HEADER}
        <pre>${escapeHtml(noteContent)}</pre>
      ${CORPORATE_FOOTER}
    </body>
    </html>
  `;

  const blob = new Blob([htmlContent], { type: 'application/msword;charset=utf-8' });
  downloadBlob(blob, `${sanitizeFilename(title)}.doc`);
}

/**
 * Exports the note as a CSV file compatible with Excel.
 */
export function exportToExcel(noteContent: string, title: string, metadata: Record<string, string> = {}): void {
  const rows: string[][] = [
    ['Hogar Belén – Nota de Enfermería'],
    ['Título', title],
    ['Fecha de generación', new Date().toLocaleString('es-CO')],
    ...Object.entries(metadata).map(([k, v]) => [k, v]),
    [],
    ['Nota'],
    [noteContent],
  ];

  const csvContent = rows
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    )
    .join('\r\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `${sanitizeFilename(title)}.csv`);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ _-]/g, '_').trim();
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
