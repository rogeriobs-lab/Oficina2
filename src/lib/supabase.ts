import { createClient } from '@supabase/supabase-js';

export type Client = {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  user_id: string | null;
  created_at: string;
};

export type Vehicle = {
  id: string;
  client_id: string;
  plate: string;
  brand: string;
  model: string;
  year: number | null;
  notes: string | null;
  created_at: string;
};

export type ServiceOrder = {
  id: string;
  vehicle_id: string;
  client_id: string;
  order_date: string;
  mileage: number | null;
  status: string;
  created_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  item_type: 'servico' | 'peca';
  description: string;
  price: number;
  created_at: string;
};

export type VehicleWithClient = Vehicle & {
  clients: Pick<Client, 'id' | 'name' | 'phone'>;
};

export type ServiceOrderWithDetails = ServiceOrder & {
  vehicles: Pick<Vehicle, 'id' | 'plate' | 'brand' | 'model' | 'year'>;
  clients: Pick<Client, 'id' | 'name'>;
  order_items: OrderItem[];
};

// Helper to format URL with https:// if missing
export const formatSupabaseUrl = (urlStr: string): string => {
  let cleaned = (urlStr || '').trim();
  if (cleaned && !cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = `https://${cleaned}`;
  }
  return cleaned;
};

// Check if a URL string is valid
const isValidUrl = (urlStr: string): boolean => {
  if (!urlStr) return false;
  try {
    const parsed = new URL(urlStr);
    return Boolean(parsed.hostname && (parsed.protocol === 'http:' || parsed.protocol === 'https:'));
  } catch {
    return false;
  }
};

// Check if URL parameters provide credentials (e.g. when opening connection link on phone)
const checkUrlCredentials = () => {
  if (typeof window === 'undefined') return;
  try {
    const searchParams = new URLSearchParams(window.location.search);
    const hashStr = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
    const hashParams = new URLSearchParams(hashStr);

    const paramUrl = searchParams.get('supabase_url') || searchParams.get('url') || hashParams.get('supabase_url') || hashParams.get('url');
    const paramKey = searchParams.get('supabase_key') || searchParams.get('key') || hashParams.get('supabase_key') || hashParams.get('key');

    if (paramUrl && paramKey) {
      const formatted = formatSupabaseUrl(paramUrl);
      if (isValidUrl(formatted)) {
        localStorage.setItem('VITE_SUPABASE_URL', formatted);
        localStorage.setItem('VITE_SUPABASE_ANON_KEY', paramKey.trim());
        // Clean URL query string without reloading
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    }
  } catch (err) {
    console.error('Erro ao ler credenciais da URL:', err);
  }
};

// Run check on load
checkUrlCredentials();

// Check if real Supabase environment variables or localStorage overrides are available
const getEnvOrStorage = (envKey: string): string => {
  try {
    const envVal = (import.meta as any).env?.[envKey];
    if (envVal && envVal !== 'MY_APP_URL') return envVal;
    return localStorage.getItem(envKey) || '';
  } catch {
    return '';
  }
};

const rawSupabaseUrl = getEnvOrStorage('VITE_SUPABASE_URL');
const supabaseUrl = formatSupabaseUrl(rawSupabaseUrl);
const supabaseAnonKey = getEnvOrStorage('VITE_SUPABASE_ANON_KEY');

export const isRealSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  isValidUrl(supabaseUrl)
);

export const getSupabaseCredentials = () => {
  return {
    url: supabaseUrl,
    key: supabaseAnonKey,
    isCloud: isRealSupabaseConfigured,
  };
};

export const generateQuickConnectUrl = () => {
  const { url, key } = getSupabaseCredentials();
  if (!url || !key) return '';
  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}?url=${encodeURIComponent(url)}&key=${encodeURIComponent(key)}`;
};

export const saveSupabaseCredentials = (url: string, key: string) => {
  const formattedUrl = formatSupabaseUrl(url);
  if (formattedUrl && key.trim()) {
    localStorage.setItem('VITE_SUPABASE_URL', formattedUrl);
    localStorage.setItem('VITE_SUPABASE_ANON_KEY', key.trim());
  } else {
    localStorage.removeItem('VITE_SUPABASE_URL');
    localStorage.removeItem('VITE_SUPABASE_ANON_KEY');
  }
  window.location.reload();
};

export const resetSupabaseCredentials = () => {
  localStorage.removeItem('VITE_SUPABASE_URL');
  localStorage.removeItem('VITE_SUPABASE_ANON_KEY');
  window.location.reload();
};

export const syncLocalToSupabase = async (): Promise<{ count: number }> => {
  if (!isRealSupabaseConfigured) {
    throw new Error('Supabase não está configurado. Insira a URL e a Chave Anon antes de sincronizar.');
  }

  const clients = getStorageItem<Client[]>('oficinapro_clients', []);
  const vehicles = getStorageItem<Vehicle[]>('oficinapro_vehicles', []);
  const orders = getStorageItem<ServiceOrder[]>('oficinapro_service_orders', []);
  const items = getStorageItem<OrderItem[]>('oficinapro_order_items', []);

  let totalCount = 0;

  if (clients.length > 0) {
    const { error } = await supabase.from('clients').upsert(clients);
    if (error) console.error('Erro ao sincronizar clientes:', error);
    else totalCount += clients.length;
  }

  if (vehicles.length > 0) {
    const { error } = await supabase.from('vehicles').upsert(vehicles);
    if (error) console.error('Erro ao sincronizar veículos:', error);
    else totalCount += vehicles.length;
  }

  if (orders.length > 0) {
    const { error } = await supabase.from('service_orders').upsert(orders);
    if (error) console.error('Erro ao sincronizar ordens:', error);
    else totalCount += orders.length;
  }

  if (items.length > 0) {
    const { error } = await supabase.from('order_items').upsert(items);
    if (error) console.error('Erro ao sincronizar itens:', error);
    else totalCount += items.length;
  }

  return { count: totalCount };
};

export const exportAllDataBackup = async () => {
  let clientsData: Client[] = [];
  let vehiclesData: Vehicle[] = [];
  let ordersData: ServiceOrder[] = [];
  let itemsData: OrderItem[] = [];

  // If connected to real Supabase cloud, fetch real data from the database
  if (isRealSupabaseConfigured) {
    try {
      const [cRes, vRes, oRes, iRes] = await Promise.all([
        supabase.from('clients').select('*'),
        supabase.from('vehicles').select('*'),
        supabase.from('service_orders').select('*'),
        supabase.from('order_items').select('*'),
      ]);
      if (cRes.data) clientsData = cRes.data;
      if (vRes.data) vehiclesData = vRes.data;
      if (oRes.data) ordersData = oRes.data;
      if (iRes.data) itemsData = iRes.data;
    } catch (e) {
      console.error('Erro ao buscar dados do Supabase para backup:', e);
    }
  }

  // Fallback or fill from localStorage if cloud had no records
  if (clientsData.length === 0 && vehiclesData.length === 0) {
    clientsData = getStorageItem<Client[]>('oficinapro_clients', []);
    vehiclesData = getStorageItem<Vehicle[]>('oficinapro_vehicles', []);
    ordersData = getStorageItem<ServiceOrder[]>('oficinapro_service_orders', []);
    itemsData = getStorageItem<OrderItem[]>('oficinapro_order_items', []);
  }

  const backup = {
    system: 'OficinaPro Backup',
    exportedAt: new Date().toISOString(),
    clients: clientsData,
    vehicles: vehiclesData,
    orders: ordersData,
    items: itemsData,
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup_oficinapro_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const exportSqlBackup = async () => {
  let clientsData: Client[] = [];
  let vehiclesData: Vehicle[] = [];
  let ordersData: ServiceOrder[] = [];
  let itemsData: OrderItem[] = [];

  if (isRealSupabaseConfigured) {
    try {
      const [cRes, vRes, oRes, iRes] = await Promise.all([
        supabase.from('clients').select('*'),
        supabase.from('vehicles').select('*'),
        supabase.from('service_orders').select('*'),
        supabase.from('order_items').select('*'),
      ]);
      if (cRes.data) clientsData = cRes.data;
      if (vRes.data) vehiclesData = vRes.data;
      if (oRes.data) ordersData = oRes.data;
      if (iRes.data) itemsData = iRes.data;
    } catch (e) {
      console.error('Erro ao buscar do Supabase para SQL:', e);
    }
  }

  if (clientsData.length === 0 && vehiclesData.length === 0) {
    clientsData = getStorageItem<Client[]>('oficinapro_clients', []);
    vehiclesData = getStorageItem<Vehicle[]>('oficinapro_vehicles', []);
    ordersData = getStorageItem<ServiceOrder[]>('oficinapro_service_orders', []);
    itemsData = getStorageItem<OrderItem[]>('oficinapro_order_items', []);
  }

  const escapeSql = (val: string | null | undefined): string => {
    if (val === null || val === undefined) return 'NULL';
    return `'${String(val).replace(/'/g, "''")}'`;
  };

  let sql = `-- SCRIPT DE RESTAURAÇÃO/BACKUP DE DADOS OFICINAPRO\n-- GERADO EM: ${new Date().toLocaleString('pt-BR')}\n\n`;

  // Clients
  sql += `-- TABELA DE CLIENTES (${clientsData.length} registros)\n`;
  clientsData.forEach((c) => {
    sql += `INSERT INTO public.clients (id, name, phone, notes, created_at) VALUES ('${c.id}', ${escapeSql(c.name)}, ${escapeSql(c.phone)}, ${escapeSql(c.notes)}, '${c.created_at}') ON CONFLICT (id) DO NOTHING;\n`;
  });
  sql += '\n';

  // Vehicles
  sql += `-- TABELA DE VEÍCULOS (${vehiclesData.length} registros)\n`;
  vehiclesData.forEach((v) => {
    sql += `INSERT INTO public.vehicles (id, client_id, plate, brand, model, year, notes, created_at) VALUES ('${v.id}', '${v.client_id}', ${escapeSql(v.plate)}, ${escapeSql(v.brand)}, ${escapeSql(v.model)}, ${v.year || 'NULL'}, ${escapeSql(v.notes)}, '${v.created_at}') ON CONFLICT (id) DO NOTHING;\n`;
  });
  sql += '\n';

  // Orders
  sql += `-- TABELA DE ORDENS DE SERVIÇO (${ordersData.length} registros)\n`;
  ordersData.forEach((o) => {
    sql += `INSERT INTO public.service_orders (id, client_id, vehicle_id, order_date, mileage, status, created_at) VALUES ('${o.id}', '${o.client_id}', '${o.vehicle_id}', '${o.order_date}', ${o.mileage || 'NULL'}, '${o.status}', '${o.created_at}') ON CONFLICT (id) DO NOTHING;\n`;
  });
  sql += '\n';

  // Items
  sql += `-- TABELA DE ITENS/PEÇAS DA ORDEM (${itemsData.length} registros)\n`;
  itemsData.forEach((i) => {
    sql += `INSERT INTO public.order_items (id, order_id, item_type, description, price, created_at) VALUES ('${i.id}', '${i.order_id}', '${i.item_type}', ${escapeSql(i.description)}, ${i.price || 0}, '${i.created_at}') ON CONFLICT (id) DO NOTHING;\n`;
  });

  const blob = new Blob([sql], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup_oficinapro_${new Date().toISOString().split('T')[0]}.sql`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const importDataBackup = async (jsonData: any) => {
  if (!jsonData || typeof jsonData !== 'object') {
    throw new Error('Arquivo JSON inválido.');
  }

  // Save to local storage
  if (Array.isArray(jsonData.clients)) {
    setStorageItem('oficinapro_clients', jsonData.clients);
  }
  if (Array.isArray(jsonData.vehicles)) {
    setStorageItem('oficinapro_vehicles', jsonData.vehicles);
  }
  if (Array.isArray(jsonData.orders)) {
    setStorageItem('oficinapro_service_orders', jsonData.orders);
  }
  if (Array.isArray(jsonData.items)) {
    setStorageItem('oficinapro_order_items', jsonData.items);
  }

  localStorage.setItem('oficinapro_initialized', 'true');

  // If connected to Supabase, offer sync to Supabase
  if (isRealSupabaseConfigured) {
    try {
      if (Array.isArray(jsonData.clients) && jsonData.clients.length > 0) {
        await supabase.from('clients').upsert(jsonData.clients);
      }
      if (Array.isArray(jsonData.vehicles) && jsonData.vehicles.length > 0) {
        await supabase.from('vehicles').upsert(jsonData.vehicles);
      }
      if (Array.isArray(jsonData.orders) && jsonData.orders.length > 0) {
        await supabase.from('service_orders').upsert(jsonData.orders);
      }
      if (Array.isArray(jsonData.items) && jsonData.items.length > 0) {
        await supabase.from('order_items').upsert(jsonData.items);
      }
    } catch (e) {
      console.error('Erro ao sincronizar backup importado para o Supabase:', e);
    }
  }
};

// --- LOCAL STORAGE DATABASE BACKEND FOR OFFLINE FALLBACK ---
const getStorageItem = <T>(key: string, defaultValue: T): T => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch {
    return defaultValue;
  }
};

const setStorageItem = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Error saving to localStorage', e);
  }
};

// Seed initial data to make the app beautiful on first load if it has never been initialized
const seedDatabase = () => {
  const isInitialized = localStorage.getItem('oficinapro_initialized');
  if (!isInitialized) {
    localStorage.setItem('oficinapro_initialized', 'true');
    const clients = getStorageItem<Client[]>('oficinapro_clients', []);
    if (clients.length === 0) {
      const initialClients: Client[] = [
        {
          id: 'c1',
          name: 'Carlos Silva',
          phone: '(11) 98765-4321',
          notes: 'Cliente antigo, prefere peças originais.',
          user_id: null,
          created_at: new Date().toISOString(),
        },
        {
          id: 'c2',
          name: 'Mariana Costa',
          phone: '(21) 99888-7766',
          notes: 'Ligar antes de executar qualquer serviço extra.',
          user_id: null,
          created_at: new Date().toISOString(),
        },
      ];
      const initialVehicles: Vehicle[] = [
        {
          id: 'v1',
          client_id: 'c1',
          plate: 'BRA2E19',
          brand: 'Toyota',
          model: 'Corolla',
          year: 2021,
          notes: 'Todas as revisões feitas em concessionária.',
          created_at: new Date().toISOString(),
        },
        {
          id: 'v2',
          client_id: 'c2',
          plate: 'FLM4H22',
          brand: 'Honda',
          model: 'Civic',
          year: 2019,
          notes: 'Barulho na suspensão dianteira.',
          created_at: new Date().toISOString(),
        },
      ];
      const initialOrders: ServiceOrder[] = [
        {
          id: 'o1',
          vehicle_id: 'v1',
          client_id: 'c1',
          order_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          mileage: 45000,
          status: 'fechada',
          created_at: new Date().toISOString(),
        },
        {
          id: 'o2',
          vehicle_id: 'v2',
          client_id: 'c2',
          order_date: new Date().toISOString().split('T')[0],
          mileage: 62000,
          status: 'aberta',
          created_at: new Date().toISOString(),
        },
      ];
      const initialItems: OrderItem[] = [
        {
          id: 'i1',
          order_id: 'o1',
          item_type: 'servico',
          description: 'Revisão de 45.000 km',
          price: 350.0,
          created_at: new Date().toISOString(),
        },
        {
          id: 'i2',
          order_id: 'o1',
          item_type: 'peca',
          description: 'Filtro de óleo e óleo sintético',
          price: 180.0,
          created_at: new Date().toISOString(),
        },
        {
          id: 'i3',
          order_id: 'o2',
          item_type: 'servico',
          description: 'Diagnóstico de barulho na suspensão',
          price: 120.0,
          created_at: new Date().toISOString(),
        },
      ];

      setStorageItem('oficinapro_clients', initialClients);
      setStorageItem('oficinapro_vehicles', initialVehicles);
      setStorageItem('oficinapro_service_orders', initialOrders);
      setStorageItem('oficinapro_order_items', initialItems);
    }
  }
};

if (typeof window !== 'undefined') {
  seedDatabase();
}

// Fluent Mock Supabase Query Builder
class MockSupabaseQueryBuilder<T = any> implements PromiseLike<any> {
  private tableName: string;
  private action: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private payload: any = null;
  private filters: { column: string; value: any }[] = [];
  private sortColumn: string | null = null;
  private sortAscending: boolean = true;
  private isSingle: boolean = false;
  private countMode: string | null = null;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(fields?: string, options?: { count?: string; head?: boolean }) {
    if (this.action !== 'insert' && this.action !== 'update') {
      this.action = 'select';
    }
    if (options?.count) {
      this.countMode = options.count;
    }
    return this;
  }

  insert(payload: any) {
    this.action = 'insert';
    this.payload = payload;
    return this;
  }

  update(payload: any) {
    this.action = 'update';
    this.payload = payload;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ column, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.sortColumn = column;
    this.sortAscending = options?.ascending !== false;
    return this;
  }

  maybeSingle() {
    this.isSingle = true;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  private execute() {
    const storageKey = `oficinapro_${this.tableName}`;
    let data = getStorageItem<any[]>(storageKey, []);

    if (this.action === 'select') {
      // Filter based on eq
      for (const filter of this.filters) {
        data = data.filter((item) => item[filter.column] === filter.value);
      }

      // Populate joins
      if (this.tableName === 'vehicles') {
        const clients = getStorageItem<Client[]>('oficinapro_clients', []);
        data = data.map((v) => {
          const client = clients.find((c) => c.id === v.client_id) || { id: '', name: '—', phone: '—' };
          return {
            ...v,
            clients: { id: client.id, name: client.name, phone: client.phone },
          };
        });
      } else if (this.tableName === 'service_orders') {
        const clients = getStorageItem<Client[]>('oficinapro_clients', []);
        const vehicles = getStorageItem<Vehicle[]>('oficinapro_vehicles', []);
        const items = getStorageItem<OrderItem[]>('oficinapro_order_items', []);

        data = data.map((o) => {
          const client = clients.find((c) => c.id === o.client_id) || { id: '', name: '—', phone: '—' };
          const vehicle = vehicles.find((v) => v.id === o.vehicle_id) || {
            id: '',
            plate: '—',
            brand: '—',
            model: '—',
            year: null,
          };
          const orderItems = items.filter((i) => i.order_id === o.id);

          return {
            ...o,
            clients: { id: client.id, name: client.name, phone: client.phone },
            vehicles: {
              id: vehicle.id,
              plate: vehicle.plate,
              brand: vehicle.brand,
              model: vehicle.model,
              year: vehicle.year,
            },
            order_items: orderItems,
          };
        });
      }

      // Sort
      if (this.sortColumn) {
        const col = this.sortColumn;
        data.sort((a, b) => {
          const valA = a[col];
          const valB = b[col];
          if (typeof valA === 'string' && typeof valB === 'string') {
            return this.sortAscending ? valA.localeCompare(valB) : valB.localeCompare(valA);
          }
          return this.sortAscending ? (valA > valB ? 1 : -1) : valA < valB ? 1 : -1;
        });
      }

      const totalCount = data.length;

      if (this.isSingle) {
        return { data: data[0] || null, error: null, count: totalCount };
      }

      return { data, error: null, count: totalCount };
    }

    if (this.action === 'insert') {
      const newItems = Array.isArray(this.payload) ? this.payload : [this.payload];
      const inserted: any[] = [];

      for (const item of newItems) {
        const newItem = {
          id: Math.random().toString(36).substring(2, 11),
          created_at: new Date().toISOString(),
          ...item,
        };
        data.push(newItem);
        inserted.push(newItem);
      }

      setStorageItem(storageKey, data);
      const resData = Array.isArray(this.payload) ? inserted : inserted[0];
      return { data: resData, error: null };
    }

    if (this.action === 'update') {
      // Find items to update
      let updatedCount = 0;
      const updatedData = data.map((item) => {
        let matches = true;
        for (const filter of this.filters) {
          if (item[filter.column] !== filter.value) {
            matches = false;
            break;
          }
        }
        if (matches) {
          updatedCount++;
          return { ...item, ...this.payload };
        }
        return item;
      });

      setStorageItem(storageKey, updatedData);
      return { data: this.payload, error: null, count: updatedCount };
    }

    if (this.action === 'delete') {
      const initialLength = data.length;
      const filteredData = data.filter((item) => {
        let matches = true;
        for (const filter of this.filters) {
          if (item[filter.column] !== filter.value) {
            matches = false;
            break;
          }
        }
        return !matches; // Keep items that don't match filters
      });

      setStorageItem(storageKey, filteredData);
      return { data: null, error: null, count: initialLength - filteredData.length };
    }

    return { data: null, error: null };
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    const result = this.execute();
    return Promise.resolve(result).then(onfulfilled, onrejected);
  }
}

// Simulated Supabase Client
const listeners: ((event: string, session: any) => void)[] = [];

const getMockSession = () => {
  const user = localStorage.getItem('oficinapro_user') ? JSON.parse(localStorage.getItem('oficinapro_user')!) : null;
  return user ? { access_token: 'mock-token', token_type: 'bearer', expires_in: 3600, user } : null;
};

const notifyListeners = (event: string) => {
  const session = getMockSession();
  listeners.forEach((listener) => {
    try {
      listener(event, session);
    } catch (e) {
      console.error(e);
    }
  });
};

const mockSupabase = {
  from(tableName: string) {
    return new MockSupabaseQueryBuilder(tableName);
  },
  auth: {
    getUser() {
      const user = localStorage.getItem('oficinapro_user') ? JSON.parse(localStorage.getItem('oficinapro_user')!) : null;
      return Promise.resolve({ data: { user }, error: null });
    },
    getSession() {
      return Promise.resolve({ data: { session: getMockSession() }, error: null });
    },
    onAuthStateChange(callback: (event: string, session: any) => void) {
      listeners.push(callback);
      // Call once initially
      const session = getMockSession();
      setTimeout(() => callback('INITIAL_SESSION', session), 0);
      return {
        data: {
          subscription: {
            unsubscribe() {
              const idx = listeners.indexOf(callback);
              if (idx !== -1) listeners.splice(idx, 1);
            },
          },
        },
      };
    },
    signUp(credentials: any) {
      const user = { id: Math.random().toString(36).substring(2, 11), email: credentials.email };
      setStorageItem('oficinapro_user', user);
      notifyListeners('SIGNED_IN');
      return Promise.resolve({ data: { user, session: getMockSession() }, error: null });
    },
    signInWithPassword(credentials: any) {
      const user = { id: 'user1', email: credentials.email };
      setStorageItem('oficinapro_user', user);
      notifyListeners('SIGNED_IN');
      return Promise.resolve({ data: { user, session: getMockSession() }, error: null });
    },
    signOut() {
      localStorage.removeItem('oficinapro_user');
      notifyListeners('SIGNED_OUT');
      return Promise.resolve({ error: null });
    },
  },
};

// Export actual or mock based on availability
let realClient: any = null;
if (isRealSupabaseConfigured) {
  try {
    realClient = createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.error('Erro ao conectar ao Supabase:', err);
    realClient = null;
  }
}

export const supabase = realClient || (mockSupabase as any);

export const clearAllDatabaseData = async (): Promise<{ success: boolean; message: string }> => {
  try {
    if (isRealSupabaseConfigured) {
      // In real Supabase, delete records in order to respect foreign keys
      await supabase.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('service_orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('vehicles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('clients').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }

    // Always clear local storage mock store keys
    localStorage.removeItem('oficinapro_order_items');
    localStorage.removeItem('oficinapro_service_orders');
    localStorage.removeItem('oficinapro_vehicles');
    localStorage.removeItem('oficinapro_clients');

    return {
      success: true,
      message: 'Todos os registros de clientes, veículos e serviços/O.S. foram excluídos com sucesso.',
    };
  } catch (err) {
    console.error('Erro ao apagar dados do banco:', err);
    return {
      success: false,
      message: `Erro ao apagar dados: ${err instanceof Error ? err.message : 'Erro desconhecido'}`,
    };
  }
};
