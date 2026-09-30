import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from './store';
import { materialAlerts, progressDelta, type SiteProgress } from '../lib/progress';
import { crewOn } from '../lib/notes';
import type { Site } from '../types';
import { today } from '../lib/util';
import { gridRef } from '../components/UaeMap';

export interface SiteSummary {
  site: Site;
  progress: SiteProgress;
  delta: number;
  deltaFA: number | null;
  deltaFF: number | null;
  crew: number;
  blocked: number;
  tasksToday: number;
  alerts: number;
  ref: string;
}

export function useSummaries(date = today()): SiteSummary[] {
  const d = useStore(
    useShallow((s) => ({
      sites: s.sites,
      workItems: s.workItems,
      tasks: s.tasks,
      allocations: s.allocations,
      people: s.people,
      txns: s.txns,
      overrides: s.overrides,
      customMaterials: s.customMaterials,
    })),
  );
  return useMemo(
    () =>
      d.sites.map((site) => {
        const pd = progressDelta(site, d, date);
        const tasks = d.tasks.filter((t) => t.siteId === site.id && t.date === date);
        return {
          site,
          progress: pd.now,
          delta: pd.overall,
          deltaFA: pd.FA,
          deltaFF: pd.FF,
          crew: crewOn(d, site.id, date).length,
          blocked: tasks.filter((t) => t.status === 'blocked').length,
          tasksToday: tasks.length,
          alerts: site.status === 'completed' ? 0 : materialAlerts(site, d).length,
          ref: gridRef(site.lat, site.lng),
        };
      }),
    [d, date],
  );
}

export function useSite(id: string | undefined) {
  return useStore((s) => s.sites.find((x) => x.id === id));
}
