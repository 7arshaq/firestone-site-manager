/**
 * Shapes of data saved by Version 1 (detailed quantities). Only used to bring a device's saved
 * Version 1 data into Version 2 — nothing else in the app reads these.
 */
import type {
  Allocation, CustomMaterial, DailyLog, DrawingMeta, Expense, MaterialTxn, Person, PhotoMeta, Settings, Site, System, Task,
} from '../../types';

export type BuildingType = 'tower' | 'villa' | 'warehouse' | 'mall' | 'school' | 'hospital' | 'hotel' | 'office' | 'labour-camp';
export type CeilingType = 'false-ceiling' | 'exposed' | 'mixed';
export type StructureType = 'concrete' | 'steel';

export interface SiteConditions {
  buildingType: BuildingType;
  structure: StructureType;
  ceiling: CeilingType;
  ceilingHeight: number;
  voidDepth: number;
  floors: number;
  basements: number;
  conditioned: boolean;
}

export interface FAScope {
  panels: number;
  loops: number;
  smoke: number;
  heat: number;
  beam: number;
  mcp: number;
  sounders: number;
  modules: number;
}

export interface FFScope {
  sprinklers: number;
  pipeMeters: number;
  hoseReels: number;
  landingValves: number;
  hydrants: number;
  alarmValves: number;
  pumpSets: number;
  extinguishers: number;
}

export type V1Site = Site & { faShare: number; conditions: SiteConditions; fa: FAScope; ff: FFScope };

export interface WorkItem {
  id: string;
  siteId: string;
  system: System;
  key: string;
  label: string;
  unit: string;
  qty: number;
  weight: number;
  baseDone: number;
}

export interface ProgressAdjustment {
  id: string;
  siteId: string;
  date: string;
  workItemId: string;
  qty: number;
  note: string;
}

export type V1Task = Omit<Task, 'scopeItemId'> & { workItemId: string | null; plannedQty: number; doneQty: number };
export type V1Photo = Omit<PhotoMeta, 'scopeItemId'> & { workItemId?: string | null };

export interface MaterialLine {
  key: string;
  system: System;
  group: string;
  name: string;
  unit: string;
  qty: number;
  basis: string;
  bulb?: string;
  custom?: boolean;
  overridden?: boolean;
}

export interface V1Data {
  sites: V1Site[];
  workItems: WorkItem[];
  people: Person[];
  tasks: V1Task[];
  allocations: Allocation[];
  logs: DailyLog[];
  txns: MaterialTxn[];
  customMaterials: CustomMaterial[];
  overrides: Record<string, Record<string, number>>;
  expenses: Expense[];
  photos: V1Photo[];
  drawings?: DrawingMeta[];
  adjustments?: ProgressAdjustment[];
  settings: Settings;
  initialised: boolean;
  sampleLoaded: boolean;
}
