import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { createStore, get, set, del } from 'idb-keyval';
import type {
  Allocation, Attendance, CustomMaterial, DailyLog, Expense, MaterialTxn, Person, PhotoMeta,
  Settings, Site, Task, WorkItem,
} from '../types';
import { syncWorkItems } from '../lib/scope';
import { uid } from '../lib/util';
import { deleteManyPhotoBlobs, deletePhotoBlobs } from './photos';

const db = createStore('riser-db', 'state');
const idbStorage: StateStorage = {
  getItem: async (name) => (await get<string>(name, db)) ?? null,
  setItem: (name, value) => set(name, value, db),
  removeItem: (name) => del(name, db),
};

export interface Data {
  sites: Site[];
  workItems: WorkItem[];
  people: Person[];
  tasks: Task[];
  allocations: Allocation[];
  logs: DailyLog[];
  txns: MaterialTxn[];
  customMaterials: CustomMaterial[];
  overrides: Record<string, Record<string, number>>;
  expenses: Expense[];
  photos: PhotoMeta[];
  settings: Settings;
  initialised: boolean;
  sampleLoaded: boolean;
}

export const emptyData = (): Data => ({
  sites: [],
  workItems: [],
  people: [],
  tasks: [],
  allocations: [],
  logs: [],
  txns: [],
  customMaterials: [],
  overrides: {},
  expenses: [],
  photos: [],
  settings: { companyName: 'Firestone', engineerName: 'Site Engineer', engineerPhone: '', engineerPin: '' },
  initialised: false,
  sampleLoaded: false,
});

interface Actions {
  replaceAll: (data: Data) => void;
  clearAll: () => Promise<void>;

  addSite: (site: Omit<Site, 'id' | 'createdAt'>) => string;
  updateSite: (id: string, patch: Partial<Site>) => void;
  deleteSite: (id: string) => Promise<void>;

  updateWorkItem: (id: string, patch: Partial<WorkItem>) => void;
  addWorkItem: (item: Omit<WorkItem, 'id' | 'key'>) => void;
  deleteWorkItem: (id: string) => void;

  savePerson: (p: Omit<Person, 'id'> & { id?: string }) => string;
  deletePerson: (id: string) => void;

  addTask: (t: Omit<Task, 'id' | 'updatedAt'>) => string;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  carryOver: (siteId: string, from: string, to: string) => number;

  setAllocation: (date: string, personId: string, siteId: string | null, attendance?: Attendance) => void;
  copyAllocations: (from: string, to: string) => number;

  saveLog: (siteId: string, date: string, patch: Partial<DailyLog>) => void;

  addTxn: (t: Omit<MaterialTxn, 'id'>) => void;
  deleteTxn: (id: string) => void;
  setOverride: (siteId: string, key: string, qty: number | null) => void;
  addCustomMaterial: (m: Omit<CustomMaterial, 'key'>) => void;
  deleteCustomMaterial: (key: string) => void;

  saveExpense: (e: Omit<Expense, 'id'> & { id?: string }) => void;
  deleteExpense: (id: string) => void;

  addPhoto: (p: PhotoMeta) => void;
  updatePhoto: (id: string, patch: Partial<PhotoMeta>) => void;
  deletePhoto: (id: string) => Promise<void>;

  updateSettings: (patch: Partial<Settings>) => void;
}

export type Store = Data & Actions;

const stamp = () => new Date().toISOString();

export const useStore = create<Store>()(
  persist(
    (setState, getState) => ({
      ...emptyData(),

      replaceAll: (data) => setState({ ...data, initialised: true }),
      clearAll: async () => {
        const ids = getState().photos.map((p) => p.id);
        await deleteManyPhotoBlobs(ids);
        const settings = getState().settings;
        setState({ ...emptyData(), settings, initialised: true, sampleLoaded: false });
      },

      addSite: (input) => {
        const site: Site = { ...input, id: uid(), createdAt: stamp() };
        setState((s) => ({
          sites: [...s.sites, site],
          workItems: [...s.workItems, ...syncWorkItems(site, [])],
        }));
        return site.id;
      },
      updateSite: (id, patch) =>
        setState((s) => {
          const sites = s.sites.map((x) => (x.id === id ? { ...x, ...patch } : x));
          const site = sites.find((x) => x.id === id)!;
          const synced = syncWorkItems(site, s.workItems);
          return { sites, workItems: [...s.workItems.filter((w) => w.siteId !== id), ...synced] };
        }),
      deleteSite: async (id) => {
        const photoIds = getState().photos.filter((p) => p.siteId === id).map((p) => p.id);
        await deleteManyPhotoBlobs(photoIds);
        setState((s) => {
          const overrides = { ...s.overrides };
          delete overrides[id];
          return {
            sites: s.sites.filter((x) => x.id !== id),
            workItems: s.workItems.filter((x) => x.siteId !== id),
            tasks: s.tasks.filter((x) => x.siteId !== id),
            allocations: s.allocations.map((a) => (a.siteId === id ? { ...a, siteId: null } : a)),
            logs: s.logs.filter((x) => x.siteId !== id),
            txns: s.txns.filter((x) => x.siteId !== id),
            customMaterials: s.customMaterials.filter((x) => x.siteId !== id),
            expenses: s.expenses.filter((x) => x.siteId !== id),
            photos: s.photos.filter((x) => x.siteId !== id),
            overrides,
          };
        });
      },

      updateWorkItem: (id, patch) =>
        setState((s) => ({ workItems: s.workItems.map((w) => (w.id === id ? { ...w, ...patch } : w)) })),
      addWorkItem: (item) =>
        setState((s) => ({ workItems: [...s.workItems, { ...item, id: uid(), key: `custom.${uid()}` }] })),
      deleteWorkItem: (id) =>
        setState((s) => ({
          workItems: s.workItems.filter((w) => w.id !== id),
          tasks: s.tasks.map((t) => (t.workItemId === id ? { ...t, workItemId: null } : t)),
        })),

      savePerson: (p) => {
        const id = p.id ?? uid();
        setState((s) => ({
          people: s.people.some((x) => x.id === id)
            ? s.people.map((x) => (x.id === id ? { ...x, ...p, id } : x))
            : [...s.people, { ...p, id }],
        }));
        return id;
      },
      deletePerson: (id) =>
        setState((s) => ({
          people: s.people.filter((x) => x.id !== id),
          allocations: s.allocations.filter((a) => a.personId !== id),
          tasks: s.tasks.map((t) => ({ ...t, assignees: t.assignees.filter((a) => a !== id) })),
        })),

      addTask: (t) => {
        const id = uid();
        setState((s) => ({ tasks: [...s.tasks, { ...t, id, updatedAt: stamp() }] }));
        return id;
      },
      updateTask: (id, patch) =>
        setState((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: stamp() } : t)) })),
      deleteTask: (id) => setState((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
      carryOver: (siteId, from, to) => {
        const open = getState().tasks.filter((t) => t.siteId === siteId && t.date === from && t.status !== 'done');
        const already = new Set(
          getState().tasks.filter((t) => t.siteId === siteId && t.date === to).map((t) => `${t.workItemId}|${t.title}`),
        );
        const fresh = open
          .filter((t) => !already.has(`${t.workItemId}|${t.title}`))
          .map((t) => ({
            ...t,
            id: uid(),
            date: to,
            doneQty: 0,
            plannedQty: Math.max(0, t.plannedQty - t.doneQty),
            status: 'planned' as const,
            blockReason: t.status === 'blocked' ? t.blockReason : '',
            updatedAt: stamp(),
          }));
        setState((s) => ({ tasks: [...s.tasks, ...fresh] }));
        return fresh.length;
      },

      setAllocation: (date, personId, siteId, attendance) =>
        setState((s) => {
          const existing = s.allocations.find((a) => a.date === date && a.personId === personId);
          const att: Attendance = attendance ?? (siteId ? 'present' : existing?.attendance ?? 'present');
          if (existing) {
            return {
              allocations: s.allocations.map((a) =>
                a === existing ? { ...a, siteId: att === 'present' ? siteId : null, attendance: att } : a,
              ),
            };
          }
          return { allocations: [...s.allocations, { id: uid(), date, personId, siteId, attendance: att }] };
        }),
      copyAllocations: (from, to) => {
        const src = getState().allocations.filter((a) => a.date === from);
        setState((s) => ({
          allocations: [
            ...s.allocations.filter((a) => a.date !== to),
            ...src.map((a) => ({ ...a, id: uid(), date: to })),
          ],
        }));
        return src.length;
      },

      saveLog: (siteId, date, patch) =>
        setState((s) => {
          const existing = s.logs.find((l) => l.siteId === siteId && l.date === date);
          if (existing) return { logs: s.logs.map((l) => (l === existing ? { ...l, ...patch } : l)) };
          return {
            logs: [...s.logs, { id: uid(), siteId, date, summary: '', issues: '', nextPlan: '', inspections: '', ...patch }],
          };
        }),

      addTxn: (t) => setState((s) => ({ txns: [...s.txns, { ...t, id: uid() }] })),
      deleteTxn: (id) => setState((s) => ({ txns: s.txns.filter((t) => t.id !== id) })),
      setOverride: (siteId, key, qty) =>
        setState((s) => {
          const site = { ...(s.overrides[siteId] ?? {}) };
          if (qty === null) delete site[key];
          else site[key] = qty;
          return { overrides: { ...s.overrides, [siteId]: site } };
        }),
      addCustomMaterial: (m) =>
        setState((s) => ({ customMaterials: [...s.customMaterials, { ...m, key: `custom.${uid()}` }] })),
      deleteCustomMaterial: (key) =>
        setState((s) => ({
          customMaterials: s.customMaterials.filter((m) => m.key !== key),
          txns: s.txns.filter((t) => t.key !== key),
        })),

      saveExpense: (e) =>
        setState((s) => {
          const id = e.id ?? uid();
          return {
            expenses: s.expenses.some((x) => x.id === id)
              ? s.expenses.map((x) => (x.id === id ? { ...x, ...e, id } : x))
              : [...s.expenses, { ...e, id }],
          };
        }),
      deleteExpense: (id) => setState((s) => ({ expenses: s.expenses.filter((x) => x.id !== id) })),

      addPhoto: (p) => setState((s) => ({ photos: [...s.photos, p] })),
      updatePhoto: (id, patch) =>
        setState((s) => ({ photos: s.photos.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      deletePhoto: async (id) => {
        await deletePhotoBlobs(id);
        setState((s) => ({ photos: s.photos.filter((p) => p.id !== id) }));
      },

      updateSettings: (patch) => setState((s) => ({ settings: { ...s.settings, ...patch } })),
    }),
    {
      name: 'riser-data',
      version: 2,
      migrate: (persisted, version) => {
        const s = persisted as Data;
        // v2: company branding — replace the old placeholder company name
        if (version < 2 && s?.settings?.companyName === 'Fire Safety Contracting LLC') s.settings.companyName = 'Firestone';
        return s as unknown as Store;
      },
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => {
        const out: Partial<Store> = {};
        for (const k of Object.keys(emptyData()) as (keyof Data)[]) (out as Record<string, unknown>)[k] = s[k];
        return out as Data;
      },
    },
  ),
);

export const getData = (): Data => {
  const s = useStore.getState();
  const out = {} as Data;
  for (const k of Object.keys(emptyData()) as (keyof Data)[]) (out as unknown as Record<string, unknown>)[k] = s[k];
  return out;
};

/* ---------- Crew session (who is using the device right now) ---------- */

interface Session {
  crewMode: boolean;
  crewId: string | null;
  enterCrew: () => void;
  exitCrew: () => void;
  setCrew: (id: string | null) => void;
}

export const useSession = create<Session>()(
  persist(
    (setState) => ({
      crewMode: false,
      crewId: null,
      enterCrew: () => setState({ crewMode: true, crewId: null }),
      exitCrew: () => setState({ crewMode: false, crewId: null }),
      setCrew: (crewId) => setState({ crewId }),
    }),
    { name: 'riser-session', storage: createJSONStorage(() => localStorage) },
  ),
);
