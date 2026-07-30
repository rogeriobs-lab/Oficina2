import React, { useEffect, useState, useCallback } from 'react';
import { supabase, type Vehicle, type Client } from '@/src/lib/supabase';
import { theme } from '@/src/lib/theme';
import { LoadingState, ErrorState, EmptyState } from './States';
import { Plus, Search, Car, User, StickyNote, Pencil, X, AlertCircle, FileSpreadsheet } from 'lucide-react';

type VehicleRow = Vehicle & { clients: Pick<Client, 'name'> };

interface VehiclesViewProps {
  onNavigate?: (view: string) => void;
}

export default function VehiclesView({ onNavigate }: VehiclesViewProps) {
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [editingVehicle, setEditingVehicle] = useState<VehicleRow | null>(null);

  const [formPlate, setFormPlate] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formYear, setFormYear] = useState('');
  const [formClientId, setFormClientId] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [vehiclesRes, clientsRes] = await Promise.all([
        supabase.from('vehicles').select('*, clients(name)').order('plate'),
        supabase.from('clients').select('*').order('name'),
      ]);
      if (vehiclesRes.error) throw vehiclesRes.error;
      if (clientsRes.error) throw clientsRes.error;
      setVehicles((vehiclesRes.data ?? []) as VehicleRow[]);
      setClients(clientsRes.data ?? []);
    } catch (err: any) {
      const msg = err?.message || err?.details || (typeof err === 'string' ? err : 'Erro ao carregar veículos');
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openAddModal = () => {
    setEditingVehicle(null);
    setFormPlate('');
    setFormBrand('');
    setFormModel('');
    setFormYear('');
    setFormClientId(clients[0]?.id ?? '');
    setFormNotes('');
    setFormError(null);
    setModalVisible(true);
  };

  const openEditModal = (vehicle: VehicleRow) => {
    setEditingVehicle(vehicle);
    setFormPlate(vehicle.plate);
    setFormBrand(vehicle.brand);
    setFormModel(vehicle.model);
    setFormYear(vehicle.year ? String(vehicle.year) : '');
    setFormClientId(vehicle.client_id);
    setFormNotes(vehicle.notes ?? '');
    setFormError(null);
    setModalVisible(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPlate.trim()) {
      setFormError('Informe a placa do veículo');
      return;
    }
    if (!formClientId) {
      setFormError('Selecione o proprietário');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        plate: formPlate.trim().toUpperCase(),
        brand: formBrand.trim() || 'Não informada',
        model: formModel.trim() || 'Não informado',
        year: formYear ? parseInt(formYear, 10) : null,
        client_id: formClientId,
        notes: formNotes.trim() || null,
      };
      if (editingVehicle) {
        const { error } = await supabase.from('vehicles').update(payload).eq('id', editingVehicle.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('vehicles').insert(payload);
        if (error) throw error;
      }
      setModalVisible(false);
      loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const closeModal = () => {
    setModalVisible(false);
    setFormPlate('');
    setFormBrand('');
    setFormModel('');
    setFormYear('');
    setFormClientId('');
    setFormNotes('');
    setFormError(null);
    setEditingVehicle(null);
  };

  const filtered = vehicles.filter(
    (v) =>
      v.plate.toLowerCase().includes(search.toLowerCase()) ||
      v.brand.toLowerCase().includes(search.toLowerCase()) ||
      v.model.toLowerCase().includes(search.toLowerCase()) ||
      v.clients?.name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Veículos</h1>
          <p className="text-slate-500 mt-1">Frota de veículos dos clientes</p>
        </div>
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {onNavigate && (
            <button
              onClick={() => onNavigate('import')}
              className="inline-flex items-center justify-center p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition-all cursor-pointer border border-emerald-200 shadow-xs"
              title="Importar dados do Access"
            >
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            </button>
          )}
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-white text-xs sm:text-sm rounded-xl font-bold shadow-md hover:opacity-90 transition-all cursor-pointer"
            style={{ backgroundColor: theme.secondary }}
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            Novo Veículo
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por placa, marca, modelo do carro ou cliente proprietário..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-100 transition-all outline-none"
          />
        </div>
        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl shrink-0 self-end sm:self-auto">
          {filtered.length} veículo(s)
        </span>
      </div>

      {/* Cards List */}
      {filtered.length === 0 ? (
        <EmptyState message={search ? 'Nenhum veículo encontrado com os dados digitados' : 'Nenhum veículo cadastrado. Clique em "Novo Veículo" para começar.'} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filtered.map((vehicle) => (
            <div
              key={vehicle.id}
              className="group relative bg-white border border-slate-200/80 rounded-2xl p-5 hover:shadow-md hover:border-amber-400/80 transition-all flex flex-col justify-between gap-4"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  {/* Plate Badge styled like Mercosul plate */}
                  <div className="inline-flex flex-col border border-slate-900 rounded-lg bg-white min-w-[105px] text-center overflow-hidden shadow-xs shrink-0 font-mono border-2">
                    <div className="bg-blue-700 text-[8px] font-black text-white px-2 py-0.5 tracking-widest uppercase flex items-center justify-between">
                      <span>BRASIL</span>
                      <span className="text-amber-300 font-extrabold text-[7px]">BR</span>
                    </div>
                    <span className="text-base font-black text-slate-950 px-3 py-0.5 tracking-wider font-mono">
                      {vehicle.plate}
                    </span>
                  </div>

                  <button
                    onClick={() => openEditModal(vehicle)}
                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                    title="Editar veículo"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <h3 className="font-black text-base text-slate-900 group-hover:text-amber-700 transition-colors leading-snug">
                      {vehicle.brand} {vehicle.model}
                    </h3>
                    {vehicle.year && (
                      <p className="text-xs text-slate-400 font-bold mt-0.5">Ano Fabricação / Modelo: {vehicle.year}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <User className="w-4 h-4 text-sky-600 shrink-0" />
                    <span className="truncate">{vehicle.clients?.name ?? 'Sem proprietário'}</span>
                  </div>

                  {vehicle.notes && (
                    <div className="flex items-start gap-2 text-xs text-slate-600 bg-amber-50/60 p-2.5 rounded-xl border border-amber-100/80">
                      <StickyNote className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <p className="line-clamp-2 leading-relaxed text-slate-700 font-medium">
                        {vehicle.notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalVisible && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-gray-100 overflow-hidden animate-scale-up">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-xl font-bold text-slate-900">
                {editingVehicle ? 'Editar Veículo' : 'Novo Veículo'}
              </h2>
              <button
                onClick={closeModal}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {clients.length === 0 ? (
              <div className="p-6 text-center space-y-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-50 text-amber-600 mx-auto">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-slate-800">Nenhum cliente cadastrado</h3>
                <p className="text-sm text-slate-500">
                  Para cadastrar um veículo, você precisa cadastrar o proprietário (cliente) primeiro.
                </p>
                <button
                  onClick={closeModal}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-all"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <form onSubmit={handleSave} className="p-6 space-y-4">
                {formError && (
                  <div className="flex items-start gap-3 p-4 bg-red-50 rounded-xl border border-red-100">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700 font-medium">{formError}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Placa *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: BRA2E19"
                      value={formPlate}
                      maxLength={8}
                      onChange={(e) => setFormPlate(e.target.value.toUpperCase())}
                      className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:bg-white focus:border-emerald-500 transition-all outline-none font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Ano
                    </label>
                    <input
                      type="number"
                      placeholder="Ex: 2021"
                      value={formYear}
                      onChange={(e) => setFormYear(e.target.value)}
                      className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:bg-white focus:border-emerald-500 transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Marca *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Toyota"
                      value={formBrand}
                      onChange={(e) => setFormBrand(e.target.value)}
                      className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:bg-white focus:border-emerald-500 transition-all outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Modelo *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Corolla"
                      value={formModel}
                      onChange={(e) => setFormModel(e.target.value)}
                      className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:bg-white focus:border-emerald-500 transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Cliente Proprietário *
                  </label>
                  <select
                    value={formClientId}
                    required
                    onChange={(e) => setFormClientId(e.target.value)}
                    className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:bg-white focus:border-emerald-500 transition-all outline-none cursor-pointer"
                  >
                    <option value="" disabled>Selecionar proprietário...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Observações
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Notas, observações sobre o carro..."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:bg-white focus:border-emerald-500 transition-all outline-none resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-2.5 text-white rounded-xl text-sm font-bold shadow-md hover:opacity-90 transition-all cursor-pointer flex items-center justify-center"
                    style={{ backgroundColor: theme.secondary }}
                  >
                    {saving ? 'Salvando...' : editingVehicle ? 'Salvar' : 'Cadastrar'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
