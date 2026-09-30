import type { ExpenseCategory } from '../types';

export const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  transport: 'Transport', fuel: 'Fuel', food: 'Food & water', tools: 'Tools & consumables',
  'local-purchase': 'Local purchase', overtime: 'Overtime', permits: 'Permits & fees',
  accommodation: 'Accommodation', other: 'Other',
};
