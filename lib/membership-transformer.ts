import {
  Membership,
  MembershipPageConfig,
  MembershipCategory,
  CategoryOverride,
  TransformedMembership,
  MembershipPageData,
} from '@/types/membership';

/**
 * Transform raw API memberships into display-ready data
 */
export function transformMemberships(
  raw: Membership[],
  config: MembershipPageConfig
): MembershipPageData {
  const now = new Date();

  let filtered = raw.filter((m) => {
    if (config.membership_ids_include && config.membership_ids_include.length > 0) {
      if (!config.membership_ids_include.includes(m.id)) return false;
    }
    if (config.membership_ids_exclude && config.membership_ids_exclude.length > 0) {
      if (config.membership_ids_exclude.includes(m.id)) return false;
    }
    if (!config.include_not_open_for_registration) {
      const regStart = new Date(m.registrationStartDate);
      const regEnd = new Date(m.registrationEndDate);
      if (now < regStart || now > regEnd) return false;
    }
    return true;
  });

  const transformed: TransformedMembership[] = filtered.map((m) =>
    transformSingle(m, config)
  );

  transformed.sort((a, b) => a.price - b.price);

  const categories = Array.from(
    new Set(transformed.map((m) => m.category))
  ) as MembershipCategory[];

  const categoryLabels = buildCategoryLabels(categories, config.category_overrides);

  const prices = transformed.map((m) => m.price).filter((p) => p > 0);
  const ages = transformed.flatMap((m) => [m.minAge, m.maxAge]);
  const seasons = transformed
    .map((m) => ({ start: m.seasonStart, end: m.seasonEnd }))
    .filter((s) => s.start && s.end);

  const latestRegEnd = transformed
    .map((m) => m.registrationEndDate)
    .filter(Boolean)
    .sort()
    .pop();

  return {
    memberships: transformed,
    categories,
    categoryLabels,
    seasonDateRange: seasons.length > 0
      ? { start: seasons[0].start, end: seasons[0].end }
      : null,
    registrationDeadline: latestRegEnd || null,
    ageRange: ages.length > 0
      ? { min: Math.min(...ages), max: Math.max(...ages) }
      : null,
    priceRange: prices.length > 0
      ? { min: Math.min(...prices), max: Math.max(...prices) }
      : null,
    isTaxInclusive: transformed.length > 0 && transformed[0].isTaxInclusive,
    totalCount: transformed.length,
  };
}

function transformSingle(
  m: Membership,
  config: MembershipPageConfig
): TransformedMembership {
  const price = m.package.parentProduct.currPrice?.price ?? 0;
  const currency = m.package.parentProduct.currPrice?.currency ?? 'USD';
  const isTaxInclusive = m.package.parentProduct.isTaxInclusive;

  const overrideMatch = matchCategoryOverride(m, config.category_overrides);
  const category = overrideMatch
    ? overrideMatch.key as MembershipCategory
    : resolveCategory(m.customerTypes);
  const memberCount = parseMemberCount(m.name, m.description);
  const displayName = stripOrgPrefix(m.name, config.organization_name);

  const pricePerPerson = memberCount > 1 ? Math.round(price / memberCount) : null;

  const now = new Date();
  const regStart = new Date(m.registrationStartDate);
  const regEnd = new Date(m.registrationEndDate);
  const registrationOpen = now >= regStart && now <= regEnd;

  const membershipSlug = m.name.replace(/\s+/g, '-');
  const registrationUrl = buildRegistrationUrl(
    config.registration_link_template,
    config.organization_slug || '',
    membershipSlug,
    m.id
  );

  const dependentProducts = m.package.parentProduct.dependentProducts || [];

  return {
    id: m.id,
    name: m.name,
    displayName,
    category,
    memberCount,
    minAge: m.minAgeYears,
    maxAge: m.maxAgeYears,
    price,
    priceFormatted: formatCurrency(price, currency),
    pricePerPerson,
    pricePerPersonFormatted: pricePerPerson
      ? `${formatCurrency(pricePerPerson, currency)} / person`
      : null,
    currency,
    isTaxInclusive,
    registrationOpen,
    registrationUrl,
    seasonStart: m.startDate,
    seasonEnd: m.endDate,
    registrationStartDate: m.registrationStartDate,
    registrationEndDate: m.registrationEndDate,
    hasDependentProducts: dependentProducts.length > 0,
    dependentProductNames: dependentProducts.map((dp) => dp.name),
    badgeLabel: memberCount === 1 ? 'Person' : 'People',
    badgeStyle: overrideMatch
      ? { bg: overrideMatch.badgeBg, color: overrideMatch.badgeColor }
      : undefined,
  };
}

function matchCategoryOverride(
  m: Membership,
  overrides: CategoryOverride[] | null
): CategoryOverride | null {
  if (!overrides || overrides.length === 0) return null;

  for (const override of overrides) {
    let matches = false;

    if (override.minAge != null && m.minAgeYears >= override.minAge) {
      matches = true;
    }
    if (override.maxAge != null && m.maxAgeYears <= override.maxAge) {
      matches = true;
    }
    if (override.nameContains && m.name.toLowerCase().includes(override.nameContains.toLowerCase())) {
      matches = true;
    }

    if (matches) return override;
  }

  return null;
}

function buildCategoryLabels(
  categories: MembershipCategory[],
  overrides: CategoryOverride[] | null
): Record<string, string> {
  const labels: Record<string, string> = {
    all: 'All Plans',
    family: 'Family',
    individual: 'Individual',
  };

  if (overrides) {
    for (const o of overrides) {
      labels[o.key] = o.label;
    }
  }

  return labels;
}

function resolveCategory(customerTypes: string[]): MembershipCategory {
  if (customerTypes.includes('senior')) return 'senior';
  if (customerTypes.includes('family')) return 'family';
  return 'individual';
}

function parseMemberCount(name: string, description: string): number {
  // Try extracting from description first (e.g. "2 Person")
  const descMatch = description.match(/(\d+)\s*person/i);
  if (descMatch) return parseInt(descMatch[1], 10);

  // Try from name
  const nameMatch = name.match(/(\d+)\s*person/i);
  if (nameMatch) return parseInt(nameMatch[1], 10);

  // "Couple" = 2
  if (/couple/i.test(name) || /couple/i.test(description)) return 2;

  // "Individual" = 1
  if (/individual/i.test(name) || /individual/i.test(description)) return 1;

  return 1;
}

function stripOrgPrefix(name: string, orgName: string | null): string {
  if (!orgName) return name;

  // Common patterns: "White Marsh Swim Club 2 Person Membership" -> "2 Person Membership"
  // Try removing facility/club name prefix
  const prefixes = [
    /^white\s+marsh\s+swim\s+club\s+/i,
    /^senior\s+citizen\s+/i,
  ];

  let display = name;
  for (const prefix of prefixes) {
    display = display.replace(prefix, '');
  }

  // If the result still has "Senior Citizen", clean it up for display
  display = display.replace(/^senior\s+citizen\s+/i, 'Senior ');

  // Capitalize first letter
  if (display.length > 0) {
    display = display.charAt(0).toUpperCase() + display.slice(1);
  }

  return display;
}

function buildRegistrationUrl(
  template: string,
  orgSlug: string,
  membershipSlug: string,
  membershipId: number
): string {
  return template
    .replace('{orgSlug}', orgSlug)
    .replace('{membershipSlug}', membershipSlug)
    .replace('{membershipId}', String(membershipId));
}

function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
