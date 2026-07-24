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

// Check if real Supabase environment variables are available
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

const isRealSupabaseConfigured = supabaseUrl && supabaseAnonKey;

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

// Seed initial data to make the app beautiful on first load if it's empty
const seedDatabase = () => {
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
export const supabase = isRealSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (mockSupabase as any);
