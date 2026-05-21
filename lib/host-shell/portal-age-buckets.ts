export interface IPortalAgeBucket {
  id: string;
  label: string;
  min: number;
  max: number;
}

export const PORTAL_AGE_BUCKETS: IPortalAgeBucket[] = [
  { id: '0-5', label: 'Ages 0–5', min: 0, max: 5 },
  { id: '6-8', label: 'Ages 6–8', min: 6, max: 8 },
  { id: '9-12', label: 'Ages 9–12', min: 9, max: 12 },
  { id: '13-17', label: 'Ages 13–17', min: 13, max: 17 },
  { id: '18-plus', label: 'Ages 18+', min: 18, max: 99 },
];

export function getPortalAgeBucketById(id: string): IPortalAgeBucket | undefined {
  return PORTAL_AGE_BUCKETS.find((bucket) => bucket.id === id);
}
