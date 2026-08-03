import React, { useEffect, useState, useCallback } from 'react';
import { supabase, consolidateDuplicateVehicles, type Vehicle, type Client } from '@/src/lib/supabase';
import { theme } from '@/src/lib/theme';
import { LoadingState, ErrorState, EmptyState } from './States';
import { Plus, Search, Car, User, StickyNote, Pencil, X, AlertCircle, FileSpreadsheet, ChevronLeft, ChevronRight, ClipboardList, ChevronDown, Check, Loader2, Layers } from 'lucide-react';

type VehicleRow = Vehicle & { clients?: { name: string } | Array<{ name: string }> | null };

interface VehiclesViewProps {
  onNavigate?: (view: string, params?: any, currentViewSaveParams?: any) => void;
  params?: any;
}

export default function VehiclesView({ onNavigate, params }: VehiclesViewProps) {
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchInput, setSearchInput] = useState(params?.searchInput ?? params?.search ?? '');
  const [search, setSearch] = useState(params?.search ?? params?.searchInput ?? '');
  const [editingVehicle, setEditingVehicle] = useState<VehicleRow | null>(null);
  const [page, setPage] = useState(params?.page ?? 1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    if (params) {
      if (params.searchInput !== undefined) setSearchInput(params.searchInput);
      if (params.search !== undefined) setSearch(params.search);
      if (params.page !== undefined) setPage(params.page);
    }
  }, [params]);

  const [formPlate, setFormPlate] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formYear, setFormYear] = useState('');
  const [formClientId, setFormClientId] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [clientSearchText, setClientSearchText] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [isSearchingClients, setIsSearchingClients] = useState(false);
  const [isConsolidating, setIsConsolidating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handleConsolidateVehicles = async () => {
    setIsConsolidating(true);
    setNotice(null);
    try {
      const res = await consolidateDuplicateVehicles();
      if (res.mergedCount > 0) {
        setNotice(res.message);
      } else {
        setNotice('Nenhuma placa duplicada encontrada no banco de dados.');
      }
      await loadData();
    } catch (err) {
      console.error('Erro ao consolidar veículos:', err);
    } finally {
      setIsConsolidating(false);
    }
  };

  const searchClientsDB = async (searchTerm: string) => {
    const rawTerm = searchTerm.trim();
    if (!rawTerm) return;
    setIsSearchingClients(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, phone')
        .or(`name.ilike.%${rawTerm}%,phone.ilike.%${rawTerm}%`)
        .order('name')
        .limit(100);

      if (error) {
        console.error('Erro ao buscar clientes no banco:', error);
      } else if (data) {
        setClients((prev) => {
          const existingIds = new Set(prev.map((c) => c.id));
          const newClients = data.filter((c) => !existingIds.has(c.id));
          return [...prev, ...newClients];
        });
      }
    } catch (err) {
      console.error('Exceção ao buscar clientes:', err);
    } finally {
      setIsSearchingClients(false);
    }
  };

  const isValidOwnerName = (name: string | null | undefined): boolean => {
    if (!name) return false;
    const clean = name.trim();
    return (
      clean !== '' &&
      clean !== '-' &&
      clean !== ' - ' &&
      clean !== '--' &&
      clean.toLowerCase() !== 'sem nome' &&
      clean.toLowerCase() !== 'sem proprietário'
    );
  };

  const getVehicleOwnerName = useCallback(
    (vehicle: VehicleRow) => {
      let name: string | undefined;
      if (vehicle.clients) {
        if (Array.isArray(vehicle.clients) && vehicle.clients.length > 0) {
          name = (vehicle.clients[0] as any)?.name;
        } else if (typeof vehicle.clients === 'object' && 'name' in vehicle.clients) {
          name = (vehicle.clients as any).name;
        }
      }
      if (!isValidOwnerName(name) && vehicle.client_id) {
        const found = clients.find((c) => c.id === vehicle.client_id);
        if (found?.name && isValidOwnerName(found.name)) {
          name = found.name;
        }
      }
      if (!isValidOwnerName(name)) {
        return 'Sem proprietário';
      }
      return name!;
    },
    [clients]
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const from = (page - 1) * pageSize;
      const to = page * pageSize - 1;

      let vehiclesQuery = supabase
        .from('vehicles')
        .select('*, clients(name)', { count: 'estimated' })
        .order('plate');

      if (search.trim()) {
        const term = `%${search.trim()}%`;
        vehiclesQuery = vehiclesQuery.or(`plate.ilike.${term},brand.ilike.${term},model.ilike.${term},notes.ilike.${term}`);
      }

      const [vehiclesRes, clientsRes] = await Promise.all([
        vehiclesQuery.range(from, to),
        supabase.from('clients').select('id, name, phone').order('name').limit(1000),
      ]);

      if (vehiclesRes.error) throw vehiclesRes.error;
      if (clientsRes.error) console.warn('Erro ao carregar lista de clientes para seleção:', clientsRes.error);

      const loadedClients = (clientsRes.data ?? []) as Client[];
      setClients(loadedClients);

      const rawVehicles = (vehiclesRes.data ?? []) as VehicleRow[];
      const uniqueVehicles: VehicleRow[] = [];
      const seenIds = new Set<string>();
      const seenPlates = new Set<string>();

      for (const v of rawVehicles) {
        if (!v || seenIds.has(v.id)) continue;
        const cleanP = (v.plate || '').replace(/[^A-Z0-9]/g, '').toUpperCase();
        if (cleanP && seenPlates.has(cleanP)) continue;

        seenIds.add(v.id);
        if (cleanP) seenPlates.add(cleanP);
        uniqueVehicles.push(v);
      }

      // Check if any vehicle is missing a valid owner name, and attempt to resolve from service_orders
      const missingVehicles = uniqueVehicles.filter((v) => {
        let name: string | undefined;
        if (v.clients) {
          if (Array.isArray(v.clients) && v.clients.length > 0) {
            name = (v.clients[0] as any)?.name;
          } else if (typeof v.clients === 'object' && 'name' in v.clients) {
            name = (v.clients as any).name;
          }
        }
        if (!isValidOwnerName(name) && v.client_id) {
          const found = loadedClients.find((c) => c.id === v.client_id);
          if (found?.name && isValidOwnerName(found.name)) name = found.name;
        }
        return !isValidOwnerName(name);
      });

      if (missingVehicles.length > 0) {
        const missingIds = missingVehicles.map((v) => v.id);
        const { data: orderData } = await supabase
          .from('service_orders')
          .select('vehicle_id, client_id, clients(id, name)')
          .in('vehicle_id', missingIds)
          .not('client_id', 'is', null);

        if (orderData && orderData.length > 0) {
          const orderMap = new Map<string, { client_id: string; name: string }>();
          for (const item of orderData) {
            if (item.vehicle_id && item.client_id) {
              const cObj = Array.isArray(item.clients) ? item.clients[0] : item.clients;
              const name = (cObj as any)?.name;
              if (isValidOwnerName(name)) {
                orderMap.set(item.vehicle_id, { client_id: item.client_id, name });
              }
            }
          }

          for (const v of missingVehicles) {
            const found = orderMap.get(v.id);
            if (found) {
              v.client_id = found.client_id;
              v.clients = { name: found.name };
              supabase.from('vehicles').update({ client_id: found.client_id }).eq('id', v.id).then();
            }
          }
        }
      }

      setVehicles(uniqueVehicles);
      setTotalCount(uniqueVehicles.length < rawVehicles.length ? uniqueVehicles.length : (vehiclesRes.count ?? rawVehicles.length));
    } catch (err: any) {
      const msg = err?.message || err?.details || (typeof err === 'string' ? err : 'Erro ao carregar veículos');
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'instant' });
  };

  const openAddModal = () => {
    setEditingVehicle(null);
    setFormPlate('');
    setFormBrand('');
    setFormModel('');
    setFormYear('');
    setFormClientId(clients[0]?.id ?? '');
    setFormNotes('');
    setFormError(null);
    setClientSearchText('');
    setIsClientDropdownOpen(false);
    setModalVisible(true);
    scrollToTop();
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
    setClientSearchText('');
    setIsClientDropdownOpen(false);
    setModalVisible(true);
    scrollToTop();
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
      const cleanTargetPlate = formPlate.replace(/[^A-Z0-9]/g, '').toUpperCase();

      // Check for duplicate plate directly querying database
      const { data: existingPlates, error: checkError } = await supabase
        .from('vehicles')
        .select('id, plate, clients(name)')
        .ilike('plate', `%${cleanTargetPlate}%`);

      if (checkError) throw checkError;

      if (existingPlates && existingPlates.length > 0) {
        const duplicate = existingPlates.find((v: any) => {
          const cleanP = (v.plate || '').replace(/[^A-Z0-9]/g, '').toUpperCase();
          if (cleanP !== cleanTargetPlate) return false;
          if (editingVehicle && v.id === editingVehicle.id) return false;
          return true;
        });

        if (duplicate) {
          const clientRel = (duplicate as any).clients;
          const ownerName = Array.isArray(clientRel) ? clientRel[0]?.name : clientRel?.name;
          setFormError(
            `A placa "${formPlate.trim().toUpperCase()}" já está cadastrada no sistema${
              ownerName ? ` (Proprietário: ${ownerName})` : ''
            }. Não é possível cadastrar a mesma placa duplicada.`
          );
          setSaving(false);
          return;
        }
      }

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
    setClientSearchText('');
    setIsClientDropdownOpen(false);
  };

  const normalizeStr = (str?: string | null) =>
    (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  const selectedClient = clients.find((c) => c.id === formClientId);

  const filteredClients = clients.filter((c) => {
    if (!clientSearchText.trim()) return true;
    const query = normalizeStr(clientSearchText);
    const words = query.split(/\s+/).filter(Boolean);

    const cName = normalizeStr(c.name);
    const cPhoneDigits = (c.phone || '').replace(/\D/g, '');
    const queryDigits = clientSearchText.replace(/\D/g, '');

    const nameMatch = words.length > 0 && words.every((w) => cName.includes(w));
    const phoneMatch =
      (queryDigits.length >= 3 && cPhoneDigits.includes(queryDigits)) ||
      normalizeStr(c.phone).includes(query);

    return nameMatch || phoneMatch;
  });

  const filtered = vehicles.filter((v) => {
    const s = search.toLowerCase();
    const ownerName = getVehicleOwnerName(v).toLowerCase();
    return (
      v.plate.toLowerCase().includes(s) ||
      v.brand.toLowerCase().includes(s) ||
      v.model.toLowerCase().includes(s) ||
      ownerName.includes(s)
    );
  });

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  return (
    <div className="space-y-6 relative">
      {/* Add / Edit Modal - Positioned at top for instant visibility */}
      {modalVisible && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-start justify-center z-50 p-4 pt-6 sm:pt-12 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-scale-up my-auto sm:my-0">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-900">
                {editingVehicle ? 'Editar Veículo' : 'Novo Veículo'}
              </h2>
              <button
                onClick={closeModal}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
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
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-all cursor-pointer"
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
                      autoFocus
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

                <div className="space-y-1 relative">
                  <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Cliente Proprietário *</span>
                    {clients.length > 0 && (
                      <span className="text-xs font-normal text-slate-400">
                        {clients.length} cadastrado(s)
                      </span>
                    )}
                  </label>

                  {/* Trigger button */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsClientDropdownOpen((prev) => !prev)}
                      className={`w-full text-left px-3.5 py-2.5 bg-gray-50 border rounded-xl text-sm flex items-center justify-between transition-all cursor-pointer ${
                        isClientDropdownOpen ? 'bg-white border-emerald-500 ring-2 ring-emerald-500/10' : 'border-gray-200 hover:bg-gray-100/80'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <User className="w-4 h-4 text-slate-400 shrink-0" />
                        {selectedClient && isValidOwnerName(selectedClient.name) ? (
                          <div className="truncate">
                            <span className="font-semibold text-slate-900">{selectedClient.name}</span>
                            {selectedClient.phone && (
                              <span className="text-xs text-slate-500 ml-2 font-normal">({selectedClient.phone})</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">Selecione o proprietário...</span>
                        )}
                      </div>
                      <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isClientDropdownOpen ? 'rotate-180 text-emerald-600' : ''}`} />
                    </button>

                    {/* Backdrop to close dropdown when clicking outside */}
                    {isClientDropdownOpen && (
                      <div
                        className="fixed inset-0 z-20"
                        onClick={() => setIsClientDropdownOpen(false)}
                      />
                    )}

                    {/* Dropdown panel */}
                    {isClientDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden animate-scale-up">
                        {/* Search input header */}
                        <div className="p-2.5 border-b border-slate-100 bg-slate-50/80 flex items-center gap-2">
                          <div className="relative flex-1 flex items-center">
                            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 shrink-0 pointer-events-none" />
                            <input
                              type="text"
                              value={clientSearchText}
                              onChange={(e) => setClientSearchText(e.target.value)}
                              onKeyDown={async (e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  await searchClientsDB(clientSearchText);
                                } else if (e.key === 'Escape') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setIsClientDropdownOpen(false);
                                }
                              }}
                              placeholder="Digite nome ou telefone..."
                              className="w-full text-xs bg-white border border-slate-200 rounded-lg pl-8 pr-7 py-1.5 text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                              autoFocus
                            />
                            {clientSearchText && (
                              <button
                                type="button"
                                onClick={() => setClientSearchText('')}
                                className="absolute right-2 p-0.5 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
                                title="Limpar busca"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => searchClientsDB(clientSearchText)}
                            disabled={isSearchingClients}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
                          >
                            {isSearchingClients ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Search className="w-3.5 h-3.5" />
                            )}
                            <span>Buscar</span>
                          </button>
                        </div>

                        {/* Search Status Header */}
                        <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                          {isSearchingClients ? (
                            <span className="flex items-center gap-1.5 font-medium text-emerald-700">
                              <Loader2 className="w-3 h-3 animate-spin" /> Buscando no banco de dados...
                            </span>
                          ) : (
                            <span>
                              {filteredClients.length === 1
                                ? '1 cliente encontrado'
                                : `${filteredClients.length} clientes encontrados`}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400">Pressione Enter para buscar</span>
                        </div>

                        {/* Scrollable list of clients */}
                        <div className="max-h-56 overflow-y-auto p-1 divide-y divide-slate-50">
                          {filteredClients.length === 0 && !isSearchingClients ? (
                            <div className="p-4 text-center text-xs text-slate-500">
                              <p className="font-medium text-slate-700 mb-1">
                                Nenhum cliente encontrado com &quot;{clientSearchText}&quot;
                              </p>
                              <p className="text-[11px] text-slate-400 mb-2">
                                Verifique a grafia ou pesquise apenas parte do nome.
                              </p>
                              {clientSearchText.trim() && (
                                <button
                                  type="button"
                                  onClick={() => searchClientsDB(clientSearchText)}
                                  className="text-emerald-600 hover:text-emerald-700 font-semibold underline text-xs cursor-pointer inline-flex items-center gap-1"
                                >
                                  <Search className="w-3 h-3" /> Buscar no servidor
                                </button>
                              )}
                            </div>
                          ) : (
                            filteredClients.map((c) => {
                              const isSelected = c.id === formClientId;
                              return (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => {
                                    setFormClientId(c.id);
                                    setIsClientDropdownOpen(false);
                                    setClientSearchText('');
                                  }}
                                  className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
                                    isSelected ? 'bg-emerald-50/90 text-emerald-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-[11px] ${
                                      isSelected ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-100 text-slate-600'
                                    }`}>
                                      {c.name ? c.name.charAt(0).toUpperCase() : 'C'}
                                    </div>
                                    <div className="truncate">
                                      <div className="truncate font-semibold">{c.name}</div>
                                      {c.phone && (
                                        <div className="text-[10px] text-slate-400 font-normal">{c.phone}</div>
                                      )}
                                    </div>
                                  </div>
                                  {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 ml-1" />}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Veículos</h1>
          <p className="text-slate-500 mt-1">Frota de veículos dos clientes</p>
        </div>
        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={handleConsolidateVehicles}
            disabled={isConsolidating}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs sm:text-sm rounded-xl font-bold transition-all cursor-pointer border border-slate-200 shadow-xs"
            title="Agrupar e apagar placas duplicadas no banco de dados"
          >
            {isConsolidating ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
            ) : (
              <Layers className="w-4 h-4 text-slate-600" />
            )}
            <span>Consolidar Duplicados</span>
          </button>
          {onNavigate && (
            <button
              onClick={() => onNavigate('import', undefined, { searchInput, search, page })}
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

      {notice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-900 text-sm font-semibold animate-fade-in shadow-xs">
          <div className="flex items-center gap-2.5">
            <Check className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
          <button
            onClick={() => setNotice(null)}
            className="p-1 hover:bg-emerald-100 rounded-lg text-emerald-700 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}


      {/* Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(searchInput.trim());
          }}
          className="flex gap-2 flex-1 w-full"
        >
          <div className="relative flex-1">
            <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Digite a placa, marca ou modelo e pressione Enter para buscar..."
              value={searchInput}
              onChange={(e) => {
                const val = e.target.value;
                setSearchInput(val);
                if (val === '' && search !== '') {
                  setSearch('');
                  setPage(1);
                }
              }}
              className="block w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-100 transition-all outline-none"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setSearch('');
                  setPage(1);
                }}
                className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition-colors cursor-pointer"
                title="Limpar pesquisa"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl transition-colors flex items-center gap-2 cursor-pointer shadow-xs shrink-0"
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">Buscar</span>
          </button>
        </form>
        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl shrink-0 self-end sm:self-auto">
          {filtered.length} veículo(s)
        </span>
      </div>

      {/* Cards List */}
      {filtered.length === 0 ? (
        <EmptyState message={search ? 'Nenhum veículo encontrado com os dados digitados' : 'Nenhum veículo cadastrado. Clique em "Novo Veículo" para começar.'} />
      ) : (
        <div className="space-y-6">
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

                    {getVehicleOwnerName(vehicle) !== 'Sem proprietário' ? (
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <User className="w-4 h-4 text-sky-600 shrink-0" />
                        <span className="truncate">{getVehicleOwnerName(vehicle)}</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openEditModal(vehicle)}
                        className="flex items-center justify-between gap-2 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 p-2.5 rounded-xl border border-amber-200/80 transition-all w-full cursor-pointer group/btn"
                        title="Clique para vincular o proprietário deste veículo"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <User className="w-4 h-4 text-amber-600 shrink-0" />
                          <span className="truncate font-bold">Sem proprietário (Clique para vincular)</span>
                        </div>
                        <Pencil className="w-3.5 h-3.5 text-amber-600 shrink-0 opacity-70 group-hover/btn:opacity-100" />
                      </button>
                    )}

                    {vehicle.notes && (
                      <div className="flex items-start gap-2.5 text-xs text-slate-700 bg-amber-50/80 p-3 rounded-xl border border-amber-200/80">
                        <StickyNote className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <span className="font-bold text-amber-900 block text-[11px] uppercase tracking-wider mb-0.5">
                            OBSERVAÇÕES:
                          </span>
                          <p className="whitespace-pre-wrap break-words leading-relaxed font-medium text-slate-800">
                            {vehicle.notes}
                          </p>
                        </div>
                      </div>
                    )}

                    {onNavigate && (
                      <button
                        onClick={() => onNavigate('orders', { searchInput: vehicle.plate, search: vehicle.plate, page: 1 }, { searchInput, search, page })}
                        className="w-full mt-2 py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <ClipboardList className="w-3.5 h-3.5 text-amber-700" />
                        <span>Ver Serviços desta Placa</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Bar */}
          {Math.ceil(totalCount / pageSize) > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <p className="text-xs text-slate-500 font-medium">
                Página <strong className="text-slate-800">{page}</strong> de <strong className="text-slate-800">{Math.ceil(totalCount / pageSize)}</strong> ({totalCount} veículos no total)
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Anterior</span>
                </button>
                <span className="text-xs font-bold px-2 text-slate-600">
                  {page} / {Math.ceil(totalCount / pageSize)}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(Math.ceil(totalCount / pageSize), p + 1))}
                  disabled={page >= Math.ceil(totalCount / pageSize)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <span>Próxima</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}


    </div>
  );
}
