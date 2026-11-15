import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Company accounts. Each person signs in with the code the company gives them.
 * Codes live in the app itself, so they keep honest people out of the wrong view —
 * they are not security: anyone who opens the app's files can read them.
 */
export type AccountRole = 'technician' | 'engineer' | 'manager' | 'dev';

export interface Account {
  id: string;
  name: string;
  role: AccountRole;
  code: string;
}

export const ACCOUNTS: Account[] = [
  { id: 'hamid', name: 'Hamid Kalam', role: 'technician', code: '1234' },
  { id: 'anas', name: 'Anas Mohamed', role: 'engineer', code: '7777' },
  { id: 'mohannad', name: 'Mohannad', role: 'manager', code: '5555' },
  { id: 'dev', name: 'Developer', role: 'dev', code: '17937' },
];

export const ROLE_NAME: Record<AccountRole, string> = {
  technician: 'Technician',
  engineer: 'Site engineer',
  manager: 'Project manager',
  dev: 'Developer mode',
};

export const firstName = (a: Account) => a.name.split(' ')[0];
export const initials = (a: Account) =>
  a.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

/** The account a typed code opens, or null */
export const accountFor = (code: string) => ACCOUNTS.find((a) => a.code === code) ?? null;
/** True while the digits typed so far could still become a longer code (the 5-digit developer code) */
export const couldGrow = (code: string) => ACCOUNTS.some((a) => a.code.length > code.length && a.code.startsWith(code));

/** Technicians appear in the site team so the engineer can give them tasks */
export const TEAM_ACCOUNTS = ACCOUNTS.filter((a) => a.role === 'technician');
export const sameName = (a: string, b: string) => a.trim().toLowerCase().replace(/\s+/g, ' ') === b.trim().toLowerCase().replace(/\s+/g, ' ');

/* ---------- who is signed in on this device ---------- */

interface AuthState {
  accountId: string | null;
  signIn: (id: string) => void;
  signOut: () => void;
}

/** Kept for this browser tab only: closing the app asks for the code again */
export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      accountId: null,
      signIn: (accountId) => set({ accountId }),
      signOut: () => set({ accountId: null }),
    }),
    { name: 'firestone-session', storage: createJSONStorage(() => sessionStorage) },
  ),
);

export const useAccount = () => {
  const id = useAuth((s) => s.accountId);
  return ACCOUNTS.find((a) => a.id === id) ?? null;
};
