import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/src/lib/supabase';
import { theme, formatDate, formatCurrency } from '@/src/lib/theme';
import { computeOrderNumbers } from '@/src/lib/orderUtils';
import { LoadingState, ErrorState, EmptyState } from './States';
import { Plus, Search, ClipboardList, Gauge, Calendar, ChevronRight, FileSpreadsheet } from 'lucide-react';

type OrderRow = {
  id: string;
  order_date: string;
  mileage: number | null;
  status: string;
  clients: { name: string };
  vehicles: { plate: string; brand: string; model: string; year: number | null };
  order_items: { price: number }[];
};

interface OrdersViewProps {
  onNavigate: (viewName: string, params?: any) => void;
}

export default function OrdersView({ onNavigate }: OrdersViewProps) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todas' | 'aberta' | 'fechada'>('todas');

  const loadOrders = useCallback(async () => {
    try {
      setError(null);
      const { data, error } = await supabase
        .from('service_orders')
        .select('id, order_date, mileage, status, clients(name), vehicles(plate, brand, model, year), order_items(price)')
        .order('order_date', { ascending: false });
      if (error) throw error;
      setOrders((data ?? []) as unknown as OrderRow[]);
    } catch (err: any) {
      const msg = err?.message || err?.details || (typeof err === 'string' ? err : 'Erro ao carregar ordens de serviço');
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const filtered = orders.filter((o) => {
    const matchSearch =
      o.clients?.name?.toLowerCase().includes(search.toLowerCase()) ||
      o.vehicles?.plate?.toLowerCase().includes(search.toLowerCase()) ||
      o.vehicles?.model?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'todas' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={loadOrders} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Serviços</h1>
          <p className="text-slate-500 mt-1">Histórico e controle de atendimentos e manutenções</p>
        </div>
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => onNavigate('import')}
            className="inline-flex items-center justify-center p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition-all cursor-pointer border border-emerald-200 shadow-xs"
            title="Importar Serviços do Access"
          >
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
          </button>
          <button
            onClick={() => onNavigate('order-new')}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-white text-xs sm:text-sm rounded-xl font-bold shadow-md hover:opacity-90 transition-all cursor-pointer"
            style={{ backgroundColor: theme.accent }}
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            Novo Serviço
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3.5">
        <div className="relative">
          <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por cliente, modelo ou placa do veículo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all outline-none"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Filtrar por Status:</span>
            {(['todas', 'aberta', 'fechada'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  statusFilter === f
                    ? 'bg-slate-950 text-white border-slate-950 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {f === 'todas' ? 'Todos os Atendimentos' : f === 'aberta' ? 'Em Aberto' : 'Concluídos / Fechados'}
              </button>
            ))}
          </div>

          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            {filtered.length} serviço(s)
          </span>
        </div>
      </div>

      {/* Orders List */}
      {filtered.length === 0 ? (
        <EmptyState
          message={
            search || statusFilter !== 'todas'
              ? 'Nenhum serviço encontrado para os filtros selecionados'
              : 'Nenhum serviço cadastrado ainda. Clique em "Novo Serviço" para começar.'
          }
        />
      ) : (
        <div className="space-y-3.5">
          {(() => {
            const orderNumMap = computeOrderNumbers(orders);
            return filtered.map((order) => {
              const totalValue = (order.order_items ?? []).reduce((sum, item) => sum + Number(item.price), 0);
              const orderNum = orderNumMap.get(order.id) || order.id.slice(0, 8);
              const isOpen = order.status === 'aberta';

              return (
                <div
                  key={order.id}
                  onClick={() => onNavigate('order-details', { id: order.id })}
                  className="group bg-white border border-slate-200/80 rounded-2xl p-5 hover:shadow-md hover:border-sky-300/80 transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100/80 shrink-0 group-hover:scale-105 transition-transform">
                      <ClipboardList className="w-6 h-6" />
                    </div>

                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-mono text-xs font-bold text-sky-800 bg-sky-50 border border-sky-200/80 px-2.5 py-0.5 rounded-lg shadow-2xs">
                          #{orderNum}
                        </span>
                        <h3 className="font-bold text-base text-slate-900 group-hover:text-sky-700 transition-colors leading-tight truncate">
                          {order.clients?.name ?? 'Cliente não informado'}
                        </h3>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                            isOpen
                              ? 'bg-amber-100/90 text-amber-900 border border-amber-200'
                              : 'bg-emerald-100/90 text-emerald-900 border border-emerald-200'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                          {isOpen ? 'Em Aberto' : 'Concluído'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs font-medium text-slate-600 flex-wrap">
                        <span>
                          {order.vehicles?.brand} {order.vehicles?.model}
                          {order.vehicles?.year ? ` (${order.vehicles.year})` : ''}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="font-mono font-bold uppercase text-[11px] bg-slate-900 text-white px-2 py-0.5 rounded-md tracking-wider">
                          {order.vehicles?.plate ?? '—'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5 text-xs text-slate-400 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>Data: {formatDate(order.order_date)}</span>
                        </div>
                        {order.mileage != null && (
                          <div className="flex items-center gap-1.5">
                            <Gauge className="w-3.5 h-3.5 text-slate-400" />
                            <span>{order.mileage.toLocaleString('pt-BR')} km</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 border-slate-100 pt-3 md:pt-0 shrink-0">
                    <div className="md:text-right">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Valor Total</p>
                      <p className="text-xl font-black text-slate-950 mt-0.5">
                        {formatCurrency(totalValue)}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-transform hidden md:block" />
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}
    </div>
  );
}
