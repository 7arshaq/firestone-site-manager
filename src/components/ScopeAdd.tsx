import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { ScopeKind, System } from '../types';
import type { NewScopeItem } from '../store/store';
import { Seg, toast } from './ui';

type Sys = System | 'general';

/**
 * Type scope work as sentences — one item per line. Enter adds; Shift+Enter starts a new line;
 * pasting a list adds every line as its own item.
 */
export default function ScopeAdd({
  systems,
  onAdd,
  defaultKind = 'scope',
  compact,
  placeholder,
}: {
  systems: System[];
  onAdd: (items: NewScopeItem[]) => void;
  defaultKind?: ScopeKind;
  compact?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState('');
  const [sys, setSys] = useState<Sys>(systems[0] ?? 'general');
  const [kind, setKind] = useState<ScopeKind>(defaultKind);
  const lines = text.split('\n').map((l) => l.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, '').trim()).filter(Boolean);

  const add = () => {
    if (!lines.length) return toast('Type the work first');
    onAdd(lines.map((l) => ({ text: l, system: sys === 'general' ? null : sys, kind })));
    toast(lines.length === 1 ? 'Added to the scope list' : `${lines.length} items added to the scope list`);
    setText('');
  };

  return (
    <div className={`scope-add ${compact ? 'scope-add--compact' : ''}`}>
      <textarea
        className="textarea scope-add__text"
        rows={compact ? 2 : 3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            add();
          }
        }}
        placeholder={placeholder ?? 'Type the work, one item per line — e.g. "Install smoke detectors in Block B corridors, L1–L3"'}
        aria-label="New scope items, one per line"
      />
      <div className="scope-add__bar">
        <Seg
          label="System"
          value={sys}
          onChange={setSys}
          options={[...systems.map((s) => ({ value: s as Sys, label: s })), { value: 'general' as Sys, label: 'General' }]}
        />
        <select className="select input--sm scope-add__kind" value={kind} onChange={(e) => setKind(e.target.value as ScopeKind)} aria-label="Type of work">
          <option value="scope">Original scope</option>
          <option value="variation">Variation</option>
          <option value="found">Found on site</option>
        </select>
        <button className="btn btn--sm btn--primary" onClick={add} disabled={!lines.length}>
          <Plus /> {lines.length > 1 ? `Add ${lines.length} items` : 'Add'}
        </button>
      </div>
    </div>
  );
}
