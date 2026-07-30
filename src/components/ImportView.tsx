import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase, type Client, type Vehicle } from '../lib/supabase';
import { theme } from '../lib/theme';
import {
  Upload,
  Clipboard,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Database,
  FileSpreadsheet,
  Users,
  Car,
  ChevronRight,
  HelpCircle,
  RefreshCw,
  ClipboardList,
} from 'lucide-react';

type ImportType = 'clients' | 'vehicles' | 'orders';

interface ColumnMapping {
  dbField: string;
  label: string;
  required: boolean;
  mappedIndex: number; // -1 means not mapped
}

export default function ImportView() {
  const [importType, setImportType] = useState<ImportType>('clients');
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [inputText, setInputText] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    successCount: number;
    failedCount: number;
    errors: string[];
  } | null>(null);

  // Initial column definitions for mapping
  const getInitialMappings = (type: ImportType): ColumnMapping[] => {
    if (type === 'clients') {
      return [
        { dbField: 'name', label: 'Nome do Cliente', required: true, mappedIndex: -1 },
        { dbField: 'phone', label: 'Telefone / WhatsApp', required: false, mappedIndex: -1 },
        { dbField: 'notes', label: 'Observações / Notas', required: false, mappedIndex: -1 },
      ];
    } else if (type === 'vehicles') {
      return [
        { dbField: 'plate', label: 'Placa do Veículo', required: true, mappedIndex: -1 },
        { dbField: 'brand', label: 'Marca (ex: Toyota)', required: true, mappedIndex: -1 },
        { dbField: 'model', label: 'Modelo (ex: Corolla)', required: true, mappedIndex: -1 },
        { dbField: 'year', label: 'Ano de Fabricação', required: false, mappedIndex: -1 },
        { dbField: 'client_identifier', label: 'Proprietário (Nome ou Telefone)', required: true, mappedIndex: -1 },
        { dbField: 'notes', label: 'Observações do Veículo', required: false, mappedIndex: -1 },
      ];
    } else {
      return [
        { dbField: 'plate', label: 'Placa do Veículo', required: true, mappedIndex: -1 },
        { dbField: 'order_date', label: 'Data da O.S. (Ex: 15/05/2024)', required: true, mappedIndex: -1 },
        { dbField: 'service_description', label: 'Descrição do Serviço / Item', required: true, mappedIndex: -1 },
        { dbField: 'price', label: 'Valor (R$)', required: false, mappedIndex: -1 },
        { dbField: 'mileage', label: 'Quilometragem (Km)', required: false, mappedIndex: -1 },
        { dbField: 'status', label: 'Status (Aberta/Fechada)', required: false, mappedIndex: -1 },
      ];
    }
  };

  // Auto-map headers to database fields
  const autoMapHeaders = (detectedHeaders: string[], type: ImportType): ColumnMapping[] => {
    const initialMaps = getInitialMappings(type);
    return initialMaps.map((map) => {
      const matchIndex = detectedHeaders.findIndex((header) => {
        const h = header.toLowerCase().trim();
        const label = map.label.toLowerCase();
        const field = map.dbField.toLowerCase();
        return (
          h === field ||
          h.includes(field) ||
          h === label ||
          h.includes(label) ||
          (field === 'name' && (h === 'nome' || h === 'cliente' || h === 'nome cliente' || h === 'razao social' || h === 'fantasia' || h === 'nome do cliente')) ||
          (field === 'phone' && (h === 'tel' || h === 'cel' || h === 'telefone' || h === 'celular' || h === 'whatsapp' || h === 'fone' || h === 'contato')) ||
          (field === 'plate' && (h === 'placa' || h === 'placas' || h === 'veiculo_placa')) ||
          (field === 'brand' && (h === 'marca' || h === 'fabricante' || h === 'montadora')) ||
          (field === 'model' && (h === 'modelo' || h === 'veiculo' || h === 'carro')) ||
          (field === 'year' && (h === 'ano' || h === 'modelo ano' || h === 'ano/modelo' || h === 'ano fab')) ||
          (field === 'client_identifier' && (h === 'proprietario' || h === 'dono' || h === 'cliente_id' || h === 'cliente' || h === 'nome cliente')) ||
          (field === 'order_date' && (h.includes('data') || h.includes('dt') || h === 'data_os')) ||
          (field === 'service_description' && (h.includes('servico') || h.includes('desc') || h.includes('item') || h.includes('trabalho') || h.includes('manutencao'))) ||
          (field === 'price' && (h.includes('valor') || h.includes('preco') || h.includes('total') || h === 'r$')) ||
          (field === 'mileage' && (h.includes('km') || h.includes('quilometragem') || h.includes('horimetro'))) ||
          (field === 'notes' && (h === 'obs' || h === 'observacoes' || h === 'notas' || h === 'observacao'))
        );
      });
      return { ...map, mappedIndex: matchIndex };
    });
  };

  // Safe CSV/TSV Parser
  const parseDelimitedText = (text: string) => {
    if (!text.trim()) return;

    // Detect delimiter: tab for spreadsheet copy-paste, otherwise semicolon or comma
    let delimiter = '\t';
    const firstLine = text.split('\n')[0];
    if (!firstLine.includes('\t')) {
      if (firstLine.includes(';')) delimiter = ';';
      else if (firstLine.includes(',')) delimiter = ',';
    }

    // Split rows and handle potential quotes
    const rawLines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const parsedRows: string[][] = [];

    rawLines.forEach((line) => {
      let tokens: string[] = [];
      if (delimiter === '\t') {
        tokens = line.split('\t');
      } else {
        // Simple quote-aware split
        let currentToken = '';
        let insideQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            insideQuotes = !insideQuotes;
          } else if (char === delimiter && !insideQuotes) {
            tokens.push(currentToken.trim().replace(/^"|"$/g, ''));
            currentToken = '';
          } else {
            currentToken += char;
          }
        }
        tokens.push(currentToken.trim().replace(/^"|"$/g, ''));
      }
      parsedRows.push(tokens);
    });

    if (parsedRows.length === 0) return;

    const detectedHeaders = parsedRows[0].map((h, i) => h.trim() || `Coluna ${i + 1}`);
    const dataRows = parsedRows.slice(1);

    setHeaders(detectedHeaders);
    setRows(dataRows);
    setMappings(autoMapHeaders(detectedHeaders, importType));
    setStep(3);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const buffer = event.target?.result as ArrayBuffer;
          const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
          
          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            alert('O arquivo Excel parece estar vazio.');
            return;
          }

          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });

          if (!jsonRows || jsonRows.length === 0) {
            alert('Nenhum dado encontrado na primeira aba da planilha.');
            return;
          }

          // Format rows into string arrays
          const formattedRows: string[][] = jsonRows
            .map((row) =>
              row.map((cell) => {
                if (cell === null || cell === undefined) return '';
                if (cell instanceof Date) {
                  const day = String(cell.getDate()).padStart(2, '0');
                  const month = String(cell.getMonth() + 1).padStart(2, '0');
                  const year = cell.getFullYear();
                  return `${day}/${month}/${year}`;
                }
                return String(cell).trim();
              })
            )
            .filter((row) => row.some((cell) => cell.length > 0));

          if (formattedRows.length === 0) {
            alert('A planilha não contém dados válidos.');
            return;
          }

          const detectedHeaders = formattedRows[0].map((h, i) => h.trim() || `Coluna ${i + 1}`);
          const dataRows = formattedRows.slice(1);

          setHeaders(detectedHeaders);
          setRows(dataRows);
          setMappings(autoMapHeaders(detectedHeaders, importType));
          setStep(3);
        } catch (err) {
          console.error('Erro ao ler arquivo Excel:', err);
          alert('Ocorreu um erro ao processar a planilha do Excel. Certifique-se de que o arquivo não está protegido ou corrompido.');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        // Check if user accidentally uploaded a binary file renamed as .csv
        if (text.startsWith('PK\x03\x04') || text.includes('[Content_Types].xml')) {
          alert('Este arquivo é uma planilha Excel (.xlsx). Por favor, selecione-o garantindo a extensão .xlsx');
          return;
        }
        setInputText(text);
        parseDelimitedText(text);
      };
      reader.readAsText(file, 'UTF-8');
    }
  };

  const handleMappingChange = (dbField: string, colIndex: number) => {
    setMappings((prev) =>
      prev.map((m) => {
        if (m.dbField === dbField) {
          return { ...m, mappedIndex: colIndex };
        }
        // If another field was mapped to this column, unmap it to prevent duplicates (optional but safe)
        if (m.mappedIndex === colIndex && colIndex !== -1) {
          return { ...m, mappedIndex: -1 };
        }
        return m;
      })
    );
  };

  const executeImport = async () => {
    setImporting(true);
    setImportResult(null);

    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    try {
      // Find indexes
      const getMappedValue = (row: string[], fieldName: string) => {
        const mapping = mappings.find((m) => m.dbField === fieldName);
        if (!mapping || mapping.mappedIndex === -1) return null;
        return row[mapping.mappedIndex] || null;
      };

      if (importType === 'clients') {
        const clientsToInsert: Partial<Client>[] = [];

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const name = getMappedValue(row, 'name');
          if (!name) {
            failedCount++;
            errors.push(`Linha ${i + 2}: Nome do cliente é obrigatório e está em branco.`);
            continue;
          }

          clientsToInsert.push({
            name: name.trim(),
            phone: getMappedValue(row, 'phone')?.trim() || null,
            notes: getMappedValue(row, 'notes')?.trim() || null,
          });
        }

        // Insert in batches or individually to handle mock DB safely
        for (const client of clientsToInsert) {
          try {
            const { error } = await supabase.from('clients').insert(client);
            if (error) throw error;
            successCount++;
          } catch (err) {
            failedCount++;
            errors.push(`Erro ao importar "${client.name}": ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
          }
        }
      } else if (importType === 'vehicles') {
        // Importing vehicles
        // For vehicles, we also need client_id. We'll pre-fetch all clients to match them,
        // and if a client doesn't exist, we'll dynamically create it!
        const { data: existingClients } = await supabase.from('clients').select('*');
        const clientsMap = new Map<string, string>(); // Name/Phone -> ID
        (existingClients || []).forEach((c: Client) => {
          clientsMap.set(c.name.toLowerCase().trim(), c.id);
          if (c.phone) {
            clientsMap.set(c.phone.trim(), c.id);
          }
        });

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const plate = getMappedValue(row, 'plate');
          const brand = getMappedValue(row, 'brand');
          const model = getMappedValue(row, 'model');
          const clientIdent = getMappedValue(row, 'client_identifier');

          if (!plate || !brand || !model || !clientIdent) {
            failedCount++;
            const missing = [];
            if (!plate) missing.push('Placa');
            if (!brand) missing.push('Marca');
            if (!model) missing.push('Modelo');
            if (!clientIdent) missing.push('Proprietário');
            errors.push(`Linha ${i + 2}: Dados obrigatórios ausentes (${missing.join(', ')}).`);
            continue;
          }

          // Resolve or create client
          let clientId = '';
          const clientKey = clientIdent.toLowerCase().trim();
          if (clientsMap.has(clientKey)) {
            clientId = clientsMap.get(clientKey)!;
          } else {
            // Create a new client on the fly!
            try {
              const newClientPayload = {
                name: clientIdent.trim(),
                phone: null,
                notes: 'Cadastrado automaticamente via importador de veículos.',
              };
              const { data: newClient, error: clientErr } = await supabase
                .from('clients')
                .insert(newClientPayload)
                .select()
                .single();

              if (clientErr) throw clientErr;

              if (newClient) {
                clientId = newClient.id;
                clientsMap.set(clientKey, clientId);
              } else {
                const { data: allClients } = await supabase.from('clients').select('*');
                const matched = (allClients || []).find((c: Client) => c.name === newClientPayload.name);
                if (matched) {
                  clientId = matched.id;
                  clientsMap.set(clientKey, clientId);
                } else {
                  throw new Error('Falha ao obter ID do novo cliente');
                }
              }
            } catch (err) {
              failedCount++;
              errors.push(`Linha ${i + 2} (Placa ${plate}): Não foi possível criar o proprietário "${clientIdent}".`);
              continue;
            }
          }

          // Insert vehicle
          const yearRaw = getMappedValue(row, 'year');
          let year: number | null = null;
          if (yearRaw) {
            const parsedYear = parseInt(yearRaw.replace(/\D/g, ''), 10);
            if (!isNaN(parsedYear)) year = parsedYear;
          }

          const vehiclePayload = {
            plate: plate.trim().toUpperCase(),
            brand: brand.trim(),
            model: model.trim(),
            year,
            client_id: clientId,
            notes: getMappedValue(row, 'notes')?.trim() || null,
          };

          try {
            const { error: vehicleErr } = await supabase.from('vehicles').insert(vehiclePayload);
            if (vehicleErr) throw vehicleErr;
            successCount++;
          } catch (err) {
            failedCount++;
            errors.push(`Erro ao importar veículo "${plate}": ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
          }
        }
      } else {
        // Importing service orders
        const { data: existingVehicles } = await supabase.from('vehicles').select('*, clients(*)');
        const vehiclesMap = new Map<string, { id: string; client_id: string }>();
        (existingVehicles || []).forEach((v: any) => {
          vehiclesMap.set(v.plate.toUpperCase().trim(), { id: v.id, client_id: v.client_id });
        });

        const { data: existingClients } = await supabase.from('clients').select('*');
        let defaultClientId = existingClients && existingClients.length > 0 ? existingClients[0].id : '';

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const plateRaw = getMappedValue(row, 'plate');
          const dateRaw = getMappedValue(row, 'order_date');
          const serviceDesc = getMappedValue(row, 'service_description');
          const priceRaw = getMappedValue(row, 'price');
          const mileageRaw = getMappedValue(row, 'mileage');
          const statusRaw = getMappedValue(row, 'status');

          if (!plateRaw || !serviceDesc) {
            failedCount++;
            errors.push(`Linha ${i + 2}: Placa do veículo e Descrição do serviço são obrigatórias.`);
            continue;
          }

          const plateClean = plateRaw.trim().toUpperCase();

          let vehicleInfo = vehiclesMap.get(plateClean);
          if (!vehicleInfo) {
            try {
              if (!defaultClientId) {
                const { data: newC } = await supabase
                  .from('clients')
                  .insert({
                    name: 'Cliente Importado (Access)',
                    notes: 'Criado via importação de ordens de serviço',
                  })
                  .select('id')
                  .single();
                if (newC) defaultClientId = newC.id;
              }

              const { data: newV, error: vErr } = await supabase
                .from('vehicles')
                .insert({
                  plate: plateClean,
                  brand: 'Veículo',
                  model: 'Importado',
                  client_id: defaultClientId,
                  notes: 'Cadastrado automaticamente via importador de O.S.',
                })
                .select('id, client_id')
                .single();

              if (vErr) throw vErr;
              if (newV) {
                vehicleInfo = { id: newV.id, client_id: newV.client_id };
                vehiclesMap.set(plateClean, vehicleInfo);
              } else {
                throw new Error('Falha ao registrar novo veículo');
              }
            } catch (vErr) {
              failedCount++;
              errors.push(`Linha ${i + 2} (Placa ${plateClean}): Não foi possível localizar ou cadastrar o veículo.`);
              continue;
            }
          }

          let orderDate = new Date().toISOString().split('T')[0];
          if (dateRaw && dateRaw.trim()) {
            const cleanD = dateRaw.trim();
            if (cleanD.includes('/')) {
              const parts = cleanD.split('/');
              if (parts.length === 3) {
                const day = parts[0].padStart(2, '0');
                const month = parts[1].padStart(2, '0');
                const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
                orderDate = `${year}-${month}-${day}`;
              }
            } else if (cleanD.length === 10) {
              orderDate = cleanD;
            }
          }

          let price = 0;
          if (priceRaw) {
            const cleanPrice = priceRaw.replace('R$', '').replace(/\s/g, '').replace('.', '').replace(',', '.');
            const parsedPrice = parseFloat(cleanPrice);
            if (!isNaN(parsedPrice)) price = parsedPrice;
          }

          let mileage: number | null = null;
          if (mileageRaw) {
            const parsedKm = parseInt(mileageRaw.replace(/\D/g, ''), 10);
            if (!isNaN(parsedKm)) mileage = parsedKm;
          }

          let status = 'fechada';
          if (statusRaw) {
            const sLower = statusRaw.toLowerCase();
            if (sLower.includes('abert') || sLower.includes('pendent')) {
              status = 'aberta';
            }
          }

          try {
            const { data: newOrder, error: orderErr } = await supabase
              .from('service_orders')
              .insert({
                vehicle_id: vehicleInfo.id,
                client_id: vehicleInfo.client_id,
                order_date: orderDate,
                mileage,
                status,
              })
              .select('id')
              .single();

            if (orderErr) throw orderErr;

            if (newOrder && newOrder.id) {
              const { error: itemErr } = await supabase.from('order_items').insert({
                order_id: newOrder.id,
                item_type: 'servico',
                description: serviceDesc.trim(),
                price,
              });
              if (itemErr) throw itemErr;
            }

            successCount++;
          } catch (err) {
            failedCount++;
            errors.push(`Erro ao importar O.S. para "${plateClean}": ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
          }
        }
      }

      setImportResult({
        successCount,
        failedCount,
        errors,
      });
      setStep(4);
    } catch (err) {
      console.error(err);
      errors.push(`Erro crítico na importação: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      setImportResult({ successCount, failedCount, errors });
      setStep(4);
    } finally {
      setImporting(false);
    }
  };

  const resetImporter = () => {
    setInputText('');
    setHeaders([]);
    setRows([]);
    setMappings([]);
    setImportResult(null);
    setStep(1);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Importador de Dados</h1>
        <p className="text-slate-500 mt-1">Traga os dados do seu banco de dados Microsoft Access, planilhas Excel ou arquivos CSV.</p>
      </div>

      {/* Steps Indicator */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 md:gap-2">
        {[
          { label: 'Tipo de Dado', num: 1 },
          { label: 'Colar ou Carregar', num: 2 },
          { label: 'Mapear Colunas', num: 3 },
          { label: 'Resultado', num: 4 },
        ].map((s) => (
          <div key={s.num} className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${
                step === s.num
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/10'
                  : step > s.num
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {s.num}
            </div>
            <span
              className={`text-xs font-bold ${
                step === s.num ? 'text-slate-900' : 'text-slate-400'
              }`}
            >
              {s.label}
            </span>
            {s.num < 4 && <ChevronRight className="w-4 h-4 text-slate-300 hidden md:block" />}
          </div>
        ))}
      </div>

      {/* Step Contents */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 md:p-8 shadow-sm">
        {step === 1 && (
          <div className="space-y-8 animate-fade-in">
            <div className="text-center max-w-xl mx-auto space-y-2">
              <Database className="w-12 h-12 text-sky-500 mx-auto" />
              <h2 className="text-xl font-extrabold text-slate-800">O que você gostaria de importar hoje?</h2>
              <p className="text-sm text-slate-500">Selecione a categoria correspondente à tabela que você exportou do Microsoft Access.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto">
              <button
                onClick={() => {
                  setImportType('clients');
                  setStep(2);
                }}
                className="group relative bg-slate-50 hover:bg-sky-50/50 border border-slate-100 hover:border-sky-200 rounded-2xl p-6 text-left transition-all cursor-pointer shadow-sm hover:shadow-md"
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-sky-500 text-white shadow-md shadow-sky-500/10 mb-4 group-hover:scale-110 transition-transform">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-base font-extrabold text-slate-800 group-hover:text-sky-700 transition-colors">Tabela de Clientes</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">Importe nomes, telefones e notas de contatos.</p>
                <div className="absolute bottom-6 right-6 text-sky-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRight className="w-5 h-5" />
                </div>
              </button>

              <button
                onClick={() => {
                  setImportType('vehicles');
                  setStep(2);
                }}
                className="group relative bg-slate-50 hover:bg-emerald-50/50 border border-slate-100 hover:border-emerald-200 rounded-2xl p-6 text-left transition-all cursor-pointer shadow-sm hover:shadow-md"
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500 text-white shadow-md shadow-emerald-500/10 mb-4 group-hover:scale-110 transition-transform">
                  <Car className="w-6 h-6" />
                </div>
                <h3 className="text-base font-extrabold text-slate-800 group-hover:text-emerald-700 transition-colors">Tabela de Veículos</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">Importe placas, marcas, modelos, anos de fabricação e proprietário.</p>
                <div className="absolute bottom-6 right-6 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRight className="w-5 h-5" />
                </div>
              </button>

              <button
                onClick={() => {
                  setImportType('orders');
                  setStep(2);
                }}
                className="group relative bg-slate-50 hover:bg-amber-50/50 border border-slate-100 hover:border-amber-200 rounded-2xl p-6 text-left transition-all cursor-pointer shadow-sm hover:shadow-md"
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500 text-white shadow-md shadow-amber-500/10 mb-4 group-hover:scale-110 transition-transform">
                  <ClipboardList className="w-6 h-6" />
                </div>
                <h3 className="text-base font-extrabold text-slate-800 group-hover:text-amber-700 transition-colors">Tabela de Serviços</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">Importe histórico de serviços, datas, placas, valores e itens.</p>
                <div className="absolute bottom-6 right-6 text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRight className="w-5 h-5" />
                </div>
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  Carregar {importType === 'clients' ? 'Clientes' : importType === 'vehicles' ? 'Veículos' : 'Ordens de Serviço'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Escolha uma das duas formas práticas abaixo para trazer seus dados.</p>
              </div>
              <button
                onClick={() => setStep(1)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
              >
                Voltar
              </button>
            </div>

            {/* Instruction Banner */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex gap-3 text-left">
              <HelpCircle className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-extrabold text-slate-700">Dica Prática para Microsoft Access / Excel</h4>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  No Access ou Excel, você pode simplesmente <strong>selecionar todas as colunas e linhas que deseja</strong>, copiar com <strong>Ctrl + C</strong>, e <strong>colar diretamente</strong> na caixa de texto abaixo. Nosso sistema identificará as colunas automaticamente!
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Box A: Upload Excel or CSV */}
              <div className="border border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-center bg-slate-50/50 hover:bg-slate-50 transition-colors group">
                <FileSpreadsheet className="w-10 h-10 text-slate-400 mb-3 group-hover:text-emerald-500 transition-colors" />
                <h4 className="text-xs font-extrabold text-slate-700">Enviar arquivo Excel ou CSV</h4>
                <p className="text-[11px] text-slate-400 max-w-xs mt-1">Selecione a planilha do Excel (.xlsx, .xls) ou arquivo CSV/TXT.</p>
                <label className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-extrabold transition-all cursor-pointer shadow-sm">
                  Selecionar Planilha Excel
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,.txt"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>

              {/* Box B: Copy Paste */}
              <div className="flex flex-col space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700">
                  <Clipboard className="w-4 h-4 text-slate-400" />
                  <span>Colar Linhas Copiadas</span>
                </div>
                <textarea
                  placeholder="Cole as colunas aqui... (Exemplo: Nome [tab] Telefone [tab] Obs)"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="block w-full h-36 p-3 bg-white border border-gray-200 rounded-xl text-xs font-mono focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all outline-none resize-none"
                />
                <button
                  disabled={!inputText.trim()}
                  onClick={() => parseDelimitedText(inputText)}
                  className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-600/10 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  Continuar com Dados Colados
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Mapeamento de Colunas</h3>
                <p className="text-xs text-slate-400 mt-0.5">Associe cada campo do sistema com a coluna correspondente da sua planilha.</p>
              </div>
              <button
                onClick={() => setStep(2)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
              >
                Voltar
              </button>
            </div>

            {/* Headers Mapping Box */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-slate-50 border border-slate-100 rounded-xl p-5">
              <div className="space-y-4">
                <h4 className="text-xs font-extrabold text-slate-700 tracking-wider uppercase">Campos do Sistema</h4>
                <div className="space-y-3.5">
                  {mappings.map((map) => (
                    <div key={map.dbField} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white border border-gray-100 rounded-lg p-3 shadow-xs">
                      <div>
                        <span className="text-xs font-extrabold text-slate-800">
                          {map.label}
                          {map.required && <span className="text-rose-500 ml-1">*</span>}
                        </span>
                        <p className="text-[10px] text-slate-400">{map.required ? 'Obrigatório' : 'Opcional'}</p>
                      </div>

                      <select
                        value={map.mappedIndex}
                        onChange={(e) => handleMappingChange(map.dbField, parseInt(e.target.value, 10))}
                        className="text-xs bg-slate-50 border border-gray-200 rounded-lg p-2 text-slate-700 outline-none focus:border-sky-500 font-medium"
                      >
                        <option value={-1}>-- Selecionar Coluna --</option>
                        {headers.map((h, idx) => (
                          <option key={idx} value={idx}>
                            {h} (Ex: "{rows[0]?.[idx] || ''}")
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Data Preview */}
              <div className="flex flex-col space-y-3">
                <h4 className="text-xs font-extrabold text-slate-700 tracking-wider uppercase">Pré-visualização dos Dados</h4>
                <div className="flex-1 overflow-auto border border-slate-200 rounded-lg bg-white h-full max-h-80 shadow-inner">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700 sticky top-0">
                        {headers.map((h, idx) => (
                          <th key={idx} className="p-2 border-r border-slate-200 whitespace-nowrap min-w-[100px]">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 5).map((row, rIdx) => (
                        <tr key={rIdx} className="border-b border-slate-100 text-slate-600 hover:bg-slate-50">
                          {headers.map((_, cIdx) => (
                            <td key={cIdx} className="p-2 border-r border-slate-100 truncate max-w-[200px]">
                              {row[cIdx] || <span className="text-slate-300">vazio</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-slate-400 font-medium text-right">
                  Mostrando {Math.min(5, rows.length)} de {rows.length} linhas importadas.
                </p>
              </div>
            </div>

            {/* Warning if required mappings are missing */}
            {mappings.some((m) => m.required && m.mappedIndex === -1) && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3.5 flex gap-2.5 text-xs text-left">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <h5 className="font-extrabold">Campos Obrigatórios Pendentes</h5>
                  <p className="mt-0.5 opacity-90">Por favor, mapeie todos os campos obrigatórios marcados com asterisco (*) para prosseguir.</p>
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={resetImporter}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                disabled={importing || mappings.some((m) => m.required && m.mappedIndex === -1)}
                onClick={executeImport}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/10 transition-all cursor-pointer flex items-center gap-2"
              >
                {importing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Confirmar e Importar ({rows.length} registros)
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 4 && importResult && (
          <div className="space-y-6 animate-fade-in text-center py-4">
            <div className="max-w-md mx-auto space-y-3">
              {importResult.failedCount === 0 ? (
                <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto" />
              ) : (
                <AlertTriangle className="w-14 h-14 text-amber-500 mx-auto" />
              )}
              <h2 className="text-xl font-extrabold text-slate-800">Importação Concluída!</h2>
              <p className="text-sm text-slate-500">O processamento dos seus registros foi finalizado com os seguintes resultados:</p>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto bg-slate-50 border border-slate-100 rounded-xl p-4">
              <div className="text-center p-3 bg-white rounded-lg border border-gray-100">
                <span className="text-2xl font-black text-emerald-600">{importResult.successCount}</span>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Com Sucesso</p>
              </div>
              <div className="text-center p-3 bg-white rounded-lg border border-gray-100">
                <span className={`text-2xl font-black ${importResult.failedCount > 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                  {importResult.failedCount}
                </span>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Falhas / Avisos</p>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="max-w-xl mx-auto border border-rose-100 rounded-xl bg-rose-50/50 p-4 text-left">
                <h4 className="text-xs font-extrabold text-rose-800">Relatório de Detalhes / Erros</h4>
                <div className="mt-2 text-[11px] text-rose-700 font-mono space-y-1.5 max-h-32 overflow-y-auto pr-2">
                  {importResult.errors.map((err, idx) => (
                    <div key={idx} className="flex gap-2">
                      <span className="shrink-0">•</span>
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 flex justify-center gap-3">
              <button
                onClick={resetImporter}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Nova Importação
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
