import type { Data } from '../store/store';

/** Identifies the built-in sample records exactly, so they can be removed without touching the user's own data. */
const SAMPLE_SITES = new Set([
  'AUH-118|Reem Island Residential Tower C',
  'AUH-121|KEZAD Logistics Warehouse W-14',
  'AUH-121|KIZAD Logistics Warehouse W-14',
  'AUH-124|Musaffah M-40 Labour Accommodation',
  'AUH-127|Yas West Villas — Cluster 6',
  'AAN-032|Tawam Clinic Extension',
  'DXB-057|Dubai South Office Block B3',
  'AUH-131|Saadiyat School Campus — Block A',
  'RUW-009|Ruwais Retail Mall Extension',
]);

const SAMPLE_PEOPLE = new Set([
  'E-1021|Rajesh Kumar', 'E-1034|Joel Santos', 'E-1040|Mohammed Aslam', 'E-1102|Anil Thomas', 'E-1108|Imran Khan',
  'E-1115|Sajid Ali', 'E-1121|Nikhil Menon', 'E-1130|Ramesh Bhandari', 'E-1133|Arjun Nair', 'E-1139|Mark dela Cruz',
  'E-1142|Tariq Mahmood', 'E-1150|Vinod Pillai', 'E-1157|Kiran Joseph', 'E-1203|Suresh Thapa', 'E-1207|Bilal Hussain',
  'E-1211|Deepak Rai', 'E-1216|Faisal Rahman', 'E-1220|Manoj Yadav', 'E-1224|Harun Mia', 'E-1229|Rahul Das',
  'E-1233|Asif Iqbal', 'E-1238|Prakash Gurung',
]);

/** Returns the data with every sample site (and everything attached to it) and every sample person removed. */
export function withoutSample(d: Data): { data: Data; removedPhotoIds: string[] } {
  const siteIds = new Set(d.sites.filter((s) => SAMPLE_SITES.has(`${s.code}|${s.name}`)).map((s) => s.id));
  const peopleIds = new Set(d.people.filter((p) => SAMPLE_PEOPLE.has(`${p.empNo}|${p.name}`)).map((p) => p.id));
  const keepSite = <T extends { siteId: string | null }>(x: T) => !x.siteId || !siteIds.has(x.siteId);
  const overrides = { ...d.overrides };
  siteIds.forEach((id) => delete overrides[id]);
  return {
    removedPhotoIds: d.photos.filter((p) => siteIds.has(p.siteId)).map((p) => p.id),
    data: {
      ...d,
      sites: d.sites.filter((s) => !siteIds.has(s.id)),
      workItems: d.workItems.filter(keepSite),
      tasks: d.tasks.filter(keepSite).map((t) => ({ ...t, assignees: t.assignees.filter((a) => !peopleIds.has(a)) })),
      logs: d.logs.filter(keepSite),
      txns: d.txns.filter(keepSite),
      customMaterials: d.customMaterials.filter(keepSite),
      expenses: d.expenses.filter(keepSite),
      photos: d.photos.filter(keepSite),
      adjustments: (d.adjustments ?? []).filter(keepSite),
      people: d.people.filter((p) => !peopleIds.has(p.id)),
      allocations: d.allocations
        .filter((a) => !peopleIds.has(a.personId))
        .map((a) => (a.siteId && siteIds.has(a.siteId) ? { ...a, siteId: null } : a)),
      overrides,
      sampleLoaded: false,
    },
  };
}
