import { Moon, Sun } from 'lucide-react';
import { resolveTheme, useUi } from '../store/ui';

const base = import.meta.env.BASE_URL;
export const brandUrl = (file: string) => `${base}brand/${file}`;

/** Company mark (triangle) with a light-ink variant that swaps in for the dark theme */
export function Logo({ className = '', alt = 'Firestone' }: { className?: string; alt?: string }) {
  return (
    <span className={`logo ${className}`}>
      <img className="logo__img logo__img--light" src={brandUrl('mark.png')} alt={alt} draggable={false} />
      <img className="logo__img logo__img--dark" src={brandUrl('mark-dark.png')} alt="" aria-hidden draggable={false} />
    </span>
  );
}

/** The company name set in type: FIRE in the logo green, STONE in ink */
export function BrandName({ className = '' }: { className?: string }) {
  return (
    <span className={`brand-name ${className}`} aria-hidden>
      <span className="brand-name__fire">FIRE</span>STONE
    </span>
  );
}

/** Mark with FIRESTONE written below it (stack) or beside it (row) */
export function Lockup({ layout = 'stack', className = '' }: { layout?: 'stack' | 'row'; className?: string }) {
  return (
    <span className={`lockup lockup--${layout} ${className}`}>
      <Logo className="lockup__mark" />
      <BrandName className="lockup__name" />
    </span>
  );
}

/** Flips between light and dark; the three-way choice (incl. "match device") lives in Settings */
export function ThemeToggle({ className = 'icon-btn', label }: { className?: string; label?: boolean }) {
  const theme = useUi((s) => s.theme);
  const setTheme = useUi((s) => s.setTheme);
  const dark = resolveTheme(theme) === 'dark';
  const next = dark ? 'light' : 'dark';
  return (
    <button type="button" className={className} onClick={() => setTheme(next)} aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}>
      {dark ? <Sun aria-hidden /> : <Moon aria-hidden />}
      {label && (dark ? 'Light mode' : 'Dark mode')}
    </button>
  );
}
