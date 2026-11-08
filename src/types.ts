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
  startDate: string;
  targetDate: string;
  notes: string;
  createdAt: string;
}

export type ScopeKind = 'scope' | 'variation' | 'found';

/**
 * One line of the site's scope, written as a sentence — a to-do item.
 * kind: `scope` = original scope, `variation` = instructed change, `found` = pending work found on site later.
 */
export interface ScopeItem {
  id: string;
  siteId: string;
  text: string;
  /** null = general work, not FA or FF */
  system: System | null;
  kind: ScopeKind;
  addedOn: string;
  /** date it was finished; null while pending */
  doneOn: string | null;
  /** position in the list (lower first) */
  order: number;
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
  /** the scope list item this task works on, if any */
  scopeItemId: string | null;
  title: string;
  location: string;
  assignees: string[];
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

/** in = delivered to site, out = used / issued, return = sent back to store, request = asked for, not yet delivered */
export type MaterialMove = 'in' | 'out' | 'return' | 'request';

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

/** A material the site needs, typed in by the engineer */
export interface CustomMaterial {
  key: string;
  siteId: string;
  /** null = general (not FA or FF) */
  system: System | null;
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
  /** the scope list item this photo shows, if any */
  scopeItemId: string | null;
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

/** A drawing file kept with a site (PDF or image); the bytes live in IndexedDB */
export interface DrawingMeta {
  id: string;
  siteId: string;
  name: string;
  kind: 'pdf' | 'image';
  size: number;
  pages: number;
  addedAt: string;
  /** 'markup' = a highlighted progress drawing (Version 1) */
  tag?: 'markup';
}
