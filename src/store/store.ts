import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { createStore, get, set, del } from 'idb-keyval';
import type {
  Allocation, Attendance, CustomMaterial, DailyLog, DrawingMeta, Expense, MaterialTxn, Person, PhotoMeta,
  ScopeItem, ScopeKind, Settings, Site, System, Task,
} from '../types';
import { today, uid } from '../lib/util';
import { deleteManyPhotoBlobs, deletePhotoBlobs } from './photos';
import { deleteDrawingBlob, deleteManyDrawingBlobs } from './drawings';
import { withoutSample } from './v1/sample-keys';
import { upgradeFromV1 } from './v1/upgrade';
import type { V1Data } from './v1/types';

const db = createStore('riser-db', 'state');
const idbStorage: StateStorage = {
  getItem: async (name) => (await get<string>(name, db)) ?? null,
  setItem: (name, value) => set(name, value, db),
  removeItem: (name) => del(name, db),
};

export interface Data {
  sites: Site[];
  scopeItems: ScopeItem[];
  people: Person[];
  tasks: Task[];
  allocations: Allocation[];
  logs: DailyLog[];
  txns: MaterialTxn[];
  customMaterials: CustomMaterial[];
  expenses: Expense[];
  photos: PhotoMeta[];
  drawings: DrawingMeta[];
  settings: Settings;
  initialised: boolean;
  sampleLoaded: boolean;
}

export const emptyData = (): Data => ({
  sites: [],
  scopeItems: [],
  people: [],
  tasks: [],
  allocations: [],
  logs: [],
  txns: [],
  customMaterials: [],
  expenses: [],
  photos: [],
  drawings: [],
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

  addScopeItems: (siteId: string, list: NewScopeItem[]) => void;
  updateScopeItem: (id: string, patch: Partial<Omit<ScopeItem, 'id' | 'siteId'>>) => void;
  setScopeDone: (id: string, date: string | null) => void;
  deleteScopeItem: (id: string) => void;

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
  addCustomMaterial: (m: Omit<CustomMaterial, 'key'>) => void;
  updateCustomMaterial: (key: string, patch: Partial<Omit<CustomMaterial, 'key' | 'siteId'>>) => void;
  deleteCustomMaterial: (key: string) => void;

  saveExpense: (e: Omit<Expense, 'id'> & { id?: string }) => void;
  deleteExpense: (id: string) => void;

  addPhoto: (p: PhotoMeta) => void;
  updatePhoto: (id: string, patch: Partial<PhotoMeta>) => void;
  deletePhoto: (id: string) => Promise<void>;

  addDrawings: (list: DrawingMeta[]) => void;
  deleteDrawing: (id: string) => Promise<void>;

  updateSettings: (patch: Partial<Settings>) => void;
}

export type Store = Data & Actions;

export interface NewScopeItem {
  text: string;
  system: System | null;
  kind: ScopeKind;
  addedOn?: string;
}

const stamp = () => new Date().toISOString();

/**
 * Keeps a scope item's "done" in step with the tasks that work on it: finishing a task finishes its item;
 * re-opening the task re-opens the item when no other finished task covers it.
 */
function linkDone(items: ScopeItem[], tasks: Task[], prev?: Task, next?: Task): ScopeItem[] {
  let out = items;
  if (prev?.scopeItemId && prev.status === 'done' && (!next || next.status !== 'done' || next.scopeItemId !== prev.scopeItemId)) {
    const still = tasks.some((t) => t.id !== prev.id && t.scopeItemId === prev.scopeItemId && t.status === 'done');
    if (!still) out = out.map((i) => (i.id === prev.scopeItemId && i.doneOn === prev.date ? { ...i, doneOn: null } : i));
  }
  if (next?.scopeItemId && next.status === 'done' && (!prev || prev.status !== 'done' || prev.scopeItemId !== next.scopeItemId)) {
    out = out.map((i) => (i.id === next.scopeItemId && !i.doneOn ? { ...i, doneOn: next.date } : i));
  }
  return out;
}

export const useStore = create<Store>()(
  persist(
    (setState, getState) => ({
      ...emptyData(),

      replaceAll: (data) => setState({ ...data, initialised: true }),
      clearAll: async () => {
        const ids = getState().photos.map((p) => p.id);
        await deleteManyPhotoBlobs(ids);
        await deleteManyDrawingBlobs(getState().drawings.map((d) => d.id));
        const settings = getState().settings;
        setState({ ...emptyData(), settings, initialised: true, sampleLoaded: false });
      },

      addSite: (input) => {
        const site: Site = { ...input, id: uid(), createdAt: stamp() };
        setState((s) => ({ sites: [...s.sites, site] }));
        return site.id;
      },
      updateSite: (id, patch) => setState((s) => ({ sites: s.sites.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      deleteSite: async (id) => {
        const photoIds = getState().photos.filter((p) => p.siteId === id).map((p) => p.id);
        await deleteManyPhotoBlobs(photoIds);
        await deleteManyDrawingBlobs(getState().drawings.filter((d) => d.siteId === id).map((d) => d.id));
        setState((s) => {
          return {
            sites: s.sites.filter((x) => x.id !== id),
            scopeItems: s.scopeItems.filter((x) => x.siteId !== id),
            tasks: s.tasks.filter((x) => x.siteId !== id),
            allocations: s.allocations.map((a) => (a.siteId === id ? { ...a, siteId: null } : a)),
            logs: s.logs.filter((x) => x.siteId !== id),
            txns: s.txns.filter((x) => x.siteId !== id),
            customMaterials: s.customMaterials.filter((x) => x.siteId !== id),
            expenses: s.expenses.filter((x) => x.siteId !== id),
            photos: s.photos.filter((x) => x.siteId !== id),
            drawings: s.drawings.filter((x) => x.siteId !== id),
          };
        });
      },

      addScopeItems: (siteId, list) =>
        setState((s) => {
          let order = Math.max(-1, ...s.scopeItems.filter((i) => i.siteId === siteId).map((i) => i.order));
          const fresh = list
            .filter((x) => x.text.trim())
            .map((x) => ({ id: uid(), siteId, text: x.text.trim(), system: x.system, kind: x.kind, addedOn: x.addedOn ?? today(), doneOn: null, order: ++order }));
          return { scopeItems: [...s.scopeItems, ...fresh] };
        }),
      updateScopeItem: (id, patch) => setState((s) => ({ scopeItems: s.scopeItems.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
      setScopeDone: (id, date) => setState((s) => ({ scopeItems: s.scopeItems.map((i) => (i.id === id ? { ...i, doneOn: date } : i)) })),
      deleteScopeItem: (id) =>
        setState((s) => ({
          scopeItems: s.scopeItems.filter((i) => i.id !== id),
          tasks: s.tasks.map((t) => (t.scopeItemId === id ? { ...t, scopeItemId: null } : t)),
          photos: s.photos.map((p) => (p.scopeItemId === id ? { ...p, scopeItemId: null } : p)),
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
        setState((s) => {
          const task = { ...t, id, updatedAt: stamp() };
          const tasks = [...s.tasks, task];
          return { tasks, scopeItems: linkDone(s.scopeItems, tasks, undefined, task) };
        });
        return id;
      },
      updateTask: (id, patch) =>
        setState((s) => {
          const prev = s.tasks.find((t) => t.id === id);
          const tasks = s.tasks.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: stamp() } : t));
          return { tasks, scopeItems: linkDone(s.scopeItems, tasks, prev, tasks.find((t) => t.id === id)) };
        }),
      deleteTask: (id) =>
        setState((s) => {
          const prev = s.tasks.find((t) => t.id === id);
          const tasks = s.tasks.filter((t) => t.id !== id);
          return { tasks, scopeItems: linkDone(s.scopeItems, tasks, prev, undefined) };
        }),
      carryOver: (siteId, from, to) => {
        const open = getState().tasks.filter((t) => t.siteId === siteId && t.date === from && t.status !== 'done');
        const already = new Set(
          getState().tasks.filter((t) => t.siteId === siteId && t.date === to).map((t) => `${t.scopeItemId}|${t.title}`),
        );
        const fresh = open
          .filter((t) => !already.has(`${t.scopeItemId}|${t.title}`))
          .map((t) => ({
            ...t,
            id: uid(),
            date: to,
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
      addCustomMaterial: (m) =>
        setState((s) => ({ customMaterials: [...s.customMaterials, { ...m, key: `custom.${uid()}` }] })),
      updateCustomMaterial: (key, patch) =>
        setState((s) => ({ customMaterials: s.customMaterials.map((m) => (m.key === key ? { ...m, ...patch } : m)) })),
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

      addDrawings: (list) => setState((s) => ({ drawings: [...s.drawings, ...list] })),
      deleteDrawing: async (id) => {
        await deleteDrawingBlob(id);
        setState((s) => ({ drawings: s.drawings.filter((d) => d.id !== id) }));
      },

      updateSettings: (patch) => setState((s) => ({ settings: { ...s.settings, ...patch } })),
    }),
    {
      name: 'riser-data',
      version: 5,
      migrate: async (persisted, version) => {
        if (!persisted || version >= 5) return persisted as Store;
        // keep an untouched copy of the older data on this device before converting it
        try {
          await set('riser-data-before-v2', JSON.stringify({ state: persisted, version, savedAt: new Date().toISOString() }), db);
        } catch {
          /* convert anyway — the copy is only a safety net */
        }
        let s = persisted as V1Data;
        // v2: company branding — replace the old placeholder company name
        if (version < 2 && s.settings?.companyName === 'Fire Safety Contracting LLC') s.settings.companyName = 'Firestone';
        // v3: drawings, and the app no longer ships with sample sites — take them out, keep everything the user added
        if (version < 3) {
          s = { ...s, drawings: s.drawings ?? [] };
          if (s.sampleLoaded) {
            const { data, removedPhotoIds } = withoutSample(s);
            s = data;
            if (removedPhotoIds.length) void deleteManyPhotoBlobs(removedPhotoIds);
          }
        }
        // v4: dated progress adjustments (highlighted-drawing updates)
        if (version < 4) s = { ...s, drawings: s.drawings ?? [], adjustments: s.adjustments ?? [] };
        // v5 = Version 2 of the app: the scope is a to-do list instead of device quantities
        return upgradeFromV1(s) as unknown as Store;
      },
      storage: createJSONStorage(() => idbStorage),
      // First start on this device: only once loading has finished and nothing was saved before.
      // (Deciding this anywhere else can race the load and save an empty app over real data.)
      onRehydrateStorage: () => (state, error) => {
        if (!error && state && !state.initialised) state.replaceAll({ ...emptyData(), initialised: true });
      },
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
