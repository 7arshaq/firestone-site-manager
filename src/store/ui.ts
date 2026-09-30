import { useEffect } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemePref = 'system' | 'light' | 'dark';

interface UiPrefs {
  theme: ThemePref;
  boldCursor: boolean;
  setTheme: (t: ThemePref) => void;
  setBoldCursor: (b: boolean) => void;
}

/** Per-device display preferences (not part of backups). Key is read by the inline script in index.html. */
export const useUi = create<UiPrefs>()(
  persist(
    (set) => ({
      theme: 'system',
      boldCursor: true,
      setTheme: (theme) => set({ theme }),
      setBoldCursor: (boldCursor) => set({ boldCursor }),
    }),
    { name: 'riser-ui', storage: createJSONStorage(() => localStorage) },
  ),
);

const media = () => window.matchMedia('(prefers-color-scheme: dark)');

export const resolveTheme = (pref: ThemePref): 'light' | 'dark' =>
  pref === 'system' ? (media().matches ? 'dark' : 'light') : pref;

export function useResolvedTheme() {
  const theme = useUi((s) => s.theme);
  return typeof window === 'undefined' ? 'light' : resolveTheme(theme);
}

/** Keeps <html data-theme / data-cursor> and the browser chrome colour in sync with the preference */
export function useApplyTheme() {
  const theme = useUi((s) => s.theme);
  const boldCursor = useUi((s) => s.boldCursor);
  useEffect(() => {
    const apply = () => {
      const resolved = resolveTheme(theme);
      const root = document.documentElement;
      root.dataset.theme = resolved;
      root.dataset.cursor = boldCursor ? 'bold' : 'system';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#0f1114' : '#ffffff');
    };
    apply();
    if (theme !== 'system') return;
    const m = media();
    m.addEventListener('change', apply);
    return () => m.removeEventListener('change', apply);
  }, [theme, boldCursor]);
}
