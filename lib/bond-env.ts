export type BondEnv = 'production' | 'staging' | 'dev' | 'squad-a' | 'squad-b' | 'squad-c';

export const DEFAULT_BOND_ENV: BondEnv = 'production';

export const BOND_ENV_OPTIONS: Array<{ id: BondEnv; label: string; baseUrl: string }> = [
  {
    id: 'production',
    label: 'Production',
    baseUrl: 'https://public.api.bondsports.co/v1',
  },
  {
    id: 'staging',
    label: 'Staging',
    baseUrl: 'https://public.api.stage.bondsports.co',
  },
  {
    id: 'dev',
    label: 'Dev',
    baseUrl: 'https://public.api.dev.bondsports.co/public-api',
  },
  {
    id: 'squad-a',
    label: 'Squad A',
    baseUrl: 'https://public.api.squad-a.bondsports.co',
  },
  {
    id: 'squad-b',
    label: 'Squad B',
    baseUrl: 'https://public.api.squad-b.bondsports.co',
  },
  {
    id: 'squad-c',
    label: 'Squad C',
    baseUrl: 'https://public.api.squad-c.bondsports.co',
  },
];

const BOND_ENV_BASE_URLS: Record<BondEnv, string> = BOND_ENV_OPTIONS.reduce(
  (acc, option) => ({ ...acc, [option.id]: option.baseUrl }),
  {} as Record<BondEnv, string>,
);

export function isBondEnv(value: unknown): value is BondEnv {
  return typeof value === 'string' && value in BOND_ENV_BASE_URLS;
}

export function resolveBondEnv(value: unknown): BondEnv {
  return isBondEnv(value) ? value : DEFAULT_BOND_ENV;
}

export function getBondBaseUrl(env: BondEnv = DEFAULT_BOND_ENV): string {
  return BOND_ENV_BASE_URLS[env];
}
