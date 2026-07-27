import React, { useEffect, useState, useCallback } from 'react';
import { supabase, type Client } from '@/src/lib/supabase';
import { theme, formatPhone } from '@/src/lib/theme';
import { LoadingState, ErrorState, EmptyState } from './States';
import { Plus, Search, User, Phone, StickyNote, Pencil, X, AlertCircle, FileSpreadsheet } from 'lucide-react';

interface ClientsViewProps {
  onNavigate?: (view: string) => void;
}

export default function ClientsView({ onNavigate }: ClientsViewProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadClients = useCallback(async () => {
    try {
      setError(null);
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      setClients(data ?? []);
    } catch (err: any) {
      const msg = err?.message || err?.details || (typeof err === 'string' ? err : 'Erro ao carregar clientes');
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormPhone(formatPhone(e.target.value));
  };

  const openAddModal = () => {
    setEditingClient(null);
    setFormName('');
    setFormPhone('');
    setFormNotes('');
    setFormError(null);
    setModalVisible(true);
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setFormName(client.name);
    setFormPhone(formatPhone(client.phone));
    setFormNotes(client.notes ?? '');
    setFormError(null);
    setModalVisible(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('Informe o nome do cliente');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: formName.trim(),
        phone: formPhone.trim() || null,
        notes: formNotes.trim() || null,
      };
      if (editingClient) {
        const { error } = await supabase.from('clients').update(payload).eq('id', editingClient.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('clients').insert(payload);
        if (error) throw error;
      }
      setModalVisible(false);
      loadClients();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const closeModal = () => {
    setModalVisible(false);
    setFormName('');
    setFormPhone('');
    setFormNotes('');
    setFormError(null);
    setEditingClient(null);
  };

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone ?? '').includes(search)
  );

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={loadClients} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Clientes</h1>
          <p className="text-slate-500 mt-1">Cadastro de clientes e contatos</p>
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
            style={{ backgroundColor: theme.primary }}
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            Novo Cliente
          </button>
        </div>
      </div>

      {/* Search Input */}
      {/* Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar cliente por nome ou número de telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all outline-none"
          />
        </div>
        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl shrink-0 self-end sm:self-auto">
          {filtered.length} cliente(s)
        </span>
      </div>

      {/* Cards List */}
      {filtered.length === 0 ? (
        <EmptyState message={search ? 'Nenhum cliente encontrado com estes termos' : 'Nenhum cliente cadastrado. Clique em "Novo Cliente" para começar.'} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filtered.map((client) => {
            const rawPhone = client.phone ? client.phone.replace(/\D/g, '') : '';
            const formattedPhone = rawPhone ? (rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`) : '';
            const waUrl = formattedPhone ? `https://wa.me/${formattedPhone}` : '';

            return (
              <div
                key={client.id}
                className="group relative bg-white border border-slate-200/80 rounded-2xl p-5 hover:shadow-md hover:border-sky-300/80 transition-all flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-sky-50 border border-sky-100 text-sky-700 font-black text-sm uppercase shrink-0 shadow-2xs">
                        {client.name ? client.name.charAt(0) : 'C'}
                      </div>
                      <div>
                        <h3 className="font-extrabold text-base text-slate-900 leading-tight group-hover:text-sky-700 transition-colors">
                          {client.name}
                        </h3>
                        <p className="text-[11px] text-slate-400 font-medium">Cliente registrado</p>
                      </div>
                    </div>

                    <button
                      onClick={() => openEditModal(client)}
                      className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                      title="Editar cliente"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2 pt-1 border-t border-slate-100">
                    {client.phone && (
                      <div className="flex items-center justify-between text-xs text-slate-600 font-semibold bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-sky-600" />
                          <span>{formatPhone(client.phone)}</span>
                        </div>
                        {waUrl && (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 hover:bg-emerald-200 px-2 py-0.5 rounded-lg transition-colors"
                          >
                            WhatsApp
                          </a>
                        )}
                      </div>
                    )}

                    {client.notes && (
                      <div className="flex items-start gap-2 text-xs text-slate-600 bg-amber-50/60 p-2.5 rounded-xl border border-amber-100/80">
                        <StickyNote className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <p className="line-clamp-2 leading-relaxed text-slate-700 font-medium">
                          {client.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalVisible && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-gray-100 overflow-hidden animate-scale-up">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-xl font-bold text-slate-900">
                {editingClient ? 'Editar Cliente' : 'Novo Cliente'}
              </h2>
              <button
                onClick={closeModal}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {formError && (
                <div className="flex items-start gap-3 p-4 bg-red-50 rounded-xl border border-red-100">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 font-medium">{formError}</p>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Nome *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Silva"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:bg-white focus:border-sky-500 transition-all outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Telefone
                </label>
                <input
                  type="text"
                  placeholder="Ex: (11) 98765-4321"
                  value={formPhone}
                  onChange={handlePhoneChange}
                  className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:bg-white focus:border-sky-500 transition-all outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Observações
                </label>
                <textarea
                  rows={3}
                  placeholder="Notas, observações sobre o cliente..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:bg-white focus:border-sky-500 transition-all outline-none resize-none"
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
                  style={{ backgroundColor: theme.primary }}
                >
                  {saving ? 'Salvando...' : editingClient ? 'Salvar' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
