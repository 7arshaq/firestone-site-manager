export type System = 'FA' | 'FF';

export type Emirate =
  | 'Abu Dhabi'
  | 'Dubai'
  | 'Sharjah'
  | 'Ajman'
  | 'Umm Al Quwain'
  | 'Ras Al Khaimah'
  | 'Fujairah';

export type SiteStatus = 'active' | 'on-hold' | 'snagging' | 'completed';

export type BuildingType =
  | 'tower'
  | 'villa'
  | 'warehouse'
  | 'mall'
  | 'school'
  | 'hospital'
  | 'hotel'
  | 'office'
  | 'labour-camp';

export type CeilingType = 'false-ceiling' | 'exposed' | 'mixed';
export type StructureType = 'concrete' | 'steel';

export interface SiteConditions {
  buildingType: BuildingType;
  structure: StructureType;
  ceiling: CeilingType;
  /** clear height to slab / roof, metres */
  ceilingHeight: number;
  /** false-ceiling void depth, metres */
  voidDepth: number;
  floors: number;
  basements: number;
  /** building is air-conditioned (affects sprinkler temperature rating) */
  conditioned: boolean;
}

/** Fire alarm quantities from the approved drawings / BOQ */
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

/** Fire fighting quantities from the approved drawings / BOQ */
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

export interface Site {
  id: string;
  code: string;
  name: string;
  client: string;
  contractor: string;
  consultant: string;
  emirate: Emirate;
  area: string;
  lat: number;
  lng: number;
  status: SiteStatus;
  systems: System[];
  /** share of FA in overall progress when both systems are in scope, 0–100 */
  faShare: number;
  startDate: string;
  targetDate: string;
  conditions: SiteConditions;
  fa: FAScope;
  ff: FFScope;
  notes: string;
  createdAt: string;
}

/** A measurable piece of scope. Progress = done / qty, weighted. */
export interface WorkItem {
  id: string;
  siteId: string;
  system: System;
  key: string;
  label: string;
  unit: string;
  qty: number;
  weight: number;
  /** progress already achieved before tracking started */
  baseDone: number;
}

export type Role = 'foreman' | 'technician' | 'helper';
export type Trade = 'FA' | 'FF' | 'both';

export interface Person {
  id: string;
  name: string;
  role: Role;
  trade: Trade;
  phone: string;
  empNo: string;
  pin: string;
  active: boolean;
}

export type TaskStatus = 'planned' | 'in-progress' | 'done' | 'blocked';

export interface Task {
  id: string;
  siteId: string;
  date: string;
  workItemId: string | null;
  title: string;
  location: string;
  assignees: string[];
  plannedQty: number;
  doneQty: number;
  status: TaskStatus;
  blockReason: string;
  note: string;
  updatedBy: string;
  updatedAt: string;
}

export type Attendance = 'present' | 'absent' | 'leave' | 'off';

export interface Allocation {
  id: string;
  date: string;
  personId: string;
  siteId: string | null;
  attendance: Attendance;
}

export interface DailyLog {
  id: string;
  siteId: string;
  date: string;
  summary: string;
  issues: string;
  nextPlan: string;
  inspections: string;
}

export type MaterialMove = 'in' | 'out' | 'return';

export interface MaterialTxn {
  id: string;
  siteId: string;
  date: string;
  key: string;
  type: MaterialMove;
  qty: number;
  ref: string;
  note: string;
}

export interface CustomMaterial {
  key: string;
  siteId: string;
  system: System;
  name: string;
  unit: string;
  qty: number;
}

export type ExpenseCategory =
  | 'transport'
  | 'fuel'
  | 'food'
  | 'tools'
  | 'local-purchase'
  | 'overtime'
  | 'permits'
  | 'accommodation'
  | 'other';

export interface Expense {
  id: string;
  siteId: string | null;
  date: string;
  category: ExpenseCategory;
  amount: number;
  note: string;
  paidBy: string;
}

export interface PhotoMeta {
  id: string;
  siteId: string;
  date: string;
  caption: string;
  tag: string;
  workItemId: string | null;
  width: number;
  height: number;
  createdAt: string;
}

export interface Settings {
  companyName: string;
  engineerName: string;
  engineerPhone: string;
  engineerPin: string;
}

export interface MaterialLine {
  key: string;
  system: System;
  group: string;
  name: string;
  unit: string;
  qty: number;
  /** plain-language reason, shown in the table */
  basis: string;
  /** sprinkler bulb colour for temperature-rated heads */
  bulb?: string;
  custom?: boolean;
  overridden?: boolean;
}
