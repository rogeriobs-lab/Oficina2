import { formatCurrency, formatDate, formatPhone } from './theme';

type PdfOrder = {
  id: string;
  order_date: string;
  mileage: number | null;
  status: string;
  clients: { name: string; phone: string | null };
  vehicles: { plate: string; brand: string; model: string; year: number | null };
  order_items: { item_type: 'servico' | 'peca'; description: string; price: number }[];
};

const buildOrderHtml = (order: PdfOrder, customOrderNum?: string): string => {
  const servicos = order.order_items.filter((i) => i.item_type === 'servico');
  const pecas = order.order_items.filter((i) => i.item_type === 'peca');
  const totalServicos = servicos.reduce((s, i) => s + Number(i.price), 0);
  const totalPecas = pecas.reduce((s, i) => s + Number(i.price), 0);
  const total = totalServicos + totalPecas;
  const numDisplay = customOrderNum ? `#${customOrderNum}` : '';

  const itemRows = (items: typeof order.order_items) =>
    items
      .map(
        (item) => `
        <tr>
          <td>${item.description}</td>
          <td class="price">${formatCurrency(Number(item.price))}</td>
        </tr>`,
      )
      .join('');

  const sectionTable = (title: string, items: typeof order.order_items, subtotal: number) => `
    <h2>${title}</h2>
    <table>
      <thead>
        <tr><th>Descrição</th><th>Valor</th></tr>
      </thead>
      <tbody>
        ${itemRows(items) || '<tr><td colspan="2" class="empty">—</td></tr>'}
        <tr class="subtotal">
          <td>Subtotal</td>
          <td class="price">${formatCurrency(subtotal)}</td>
        </tr>
      </tbody>
    </table>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Serviço ${numDisplay}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1A2332; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0F4C81; padding-bottom: 16px; margin-bottom: 24px; }
    .header h1 { font-size: 22px; color: #0F4C81; }
    .header .status { font-size: 13px; font-weight: 600; padding: 4px 14px; border-radius: 20px; background: #E8F5E9; color: #2E7D32; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    .info-card { background: #F5F7FA; border-radius: 10px; padding: 14px 16px; }
    .info-label { font-size: 11px; color: #8E9BAF; font-weight: 500; text-transform: uppercase; margin-bottom: 4px; }
    .info-value { font-size: 15px; font-weight: 600; color: #1A2332; }
    .info-sub { font-size: 13px; color: #5A6B85; margin-top: 2px; }
    h2 { font-size: 14px; color: #0F4C81; margin-bottom: 8px; margin-top: 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th { text-align: left; font-size: 12px; color: #5A6B85; font-weight: 600; padding: 8px 12px; border-bottom: 2px solid #E1E7EF; }
    td { font-size: 14px; padding: 10px 12px; border-bottom: 1px solid #E1E7EF; }
    td.price { text-align: right; font-weight: 600; white-space: nowrap; }
    tr.subtotal td { font-weight: 600; background: #EEF2F7; border-bottom: none; font-size: 13px; }
    td.empty { text-align: center; color: #8E9BAF; }
    .total-box { margin-top: 20px; background: #0F4C81; border-radius: 12px; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center; }
    .total-label { font-size: 16px; font-weight: 600; color: rgba(255,255,255,0.85); }
    .total-value { font-size: 26px; font-weight: 700; color: #fff; }
    .footer { margin-top: 32px; text-align: center; font-size: 11px; color: #8E9BAF; }
    @media print { body { padding: 20px; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Serviço ${numDisplay}</h1>
      <p style="font-size:13px;color:#5A6B85;margin-top:4px">Data: ${formatDate(order.order_date)}</p>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-card">
      <div class="info-label">Cliente</div>
      <div class="info-value">${order.clients?.name ?? '—'}</div>
      ${order.clients?.phone ? `<div class="info-sub">${formatPhone(order.clients.phone)}</div>` : ''}
    </div>
    <div class="info-card">
      <div class="info-label">Veículo</div>
      <div class="info-value">${order.vehicles?.brand ?? ''} ${order.vehicles?.model ?? ''}${order.vehicles?.year ? ` (${order.vehicles.year})` : ''}</div>
      <div class="info-sub">${order.vehicles?.plate ?? '—'}</div>
    </div>
    ${order.mileage != null ? `<div class="info-card"><div class="info-label">Quilometragem</div><div class="info-value">${order.mileage.toLocaleString('pt-BR')} km</div></div>` : ''}
  </div>

  ${sectionTable('Serviços', servicos, totalServicos)}
  ${sectionTable('Peças', pecas, totalPecas)}

  <div class="total-box">
    <div class="total-label">Total Geral</div>
    <div class="total-value">${formatCurrency(total)}</div>
  </div>

  <div class="footer">Documento gerado em ${new Date().toLocaleString('pt-BR')}</div>

  <script>
    window.onload = () => { window.print(); };
  </script>
</body>
</html>`;
};

export const exportOrderToPdf = (order: PdfOrder, customOrderNum?: string): void => {
  const html = buildOrderHtml(order, customOrderNum);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    const a = document.createElement('a');
    a.href = url;
    a.download = `servico-${customOrderNum || order.id.slice(0, 8)}.html`;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};
