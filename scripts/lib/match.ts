/**
 * Maps retailer product titles to catalog GPUs.
 *
 * Each catalog slug has a search query (used by sources that search per GPU),
 * a pattern the normalized title must match, and an optional pattern it must
 * not match. Global exclusions drop listings that are not bare graphics cards.
 */

export interface MatchRule {
  slug: string;
  query: string;
  pattern: RegExp;
  exclude?: RegExp;
}

/** Listings that are never a plain graphics card at a comparable price. */
const GLOBAL_EXCLUDE =
  /\b(laptop|notebook|gaming pc|desktop pc|prebuilt|system|workstation|water ?block|backplate|bracket|cable|riser|adapter|cooler|fan kit|bundle|combo|mining|refurbished|renewed|open box|openbox|used|for parts|dock|enclosure|egpu|external)\b/;

function nvidia(model: string, body: RegExp, exclude?: RegExp): Omit<MatchRule, 'slug'> {
  return { query: `rtx ${model}`, pattern: body, exclude };
}

const RULES: Record<string, Omit<MatchRule, 'slug'>> = {
  'rtx-5090': nvidia('5090', /\b5090\b/),
  'rtx-5080': nvidia('5080', /\b5080\b/),
  'rtx-5070-ti': nvidia('5070 ti', /\b5070\s*ti\b/),
  'rtx-5070': nvidia('5070', /\b5070\b(?!\s*ti)/),
  'rtx-4090': nvidia('4090', /\b4090\b/),
  'rtx-4080-super': nvidia('4080 super', /\b4080\s*super\b/),
  'rtx-4080': nvidia('4080', /\b4080\b(?!\s*super)/),
  'rtx-4070-ti-super': nvidia('4070 ti super', /\b4070\s*ti\s*super\b/),
  'rtx-4070-ti': nvidia('4070 ti', /\b4070\s*ti\b(?!\s*super)/),
  'rtx-4070-super': nvidia('4070 super', /\b4070\s*super\b/),
  'rtx-4070': nvidia('4070', /\b4070\b(?!\s*(ti|super))/),
  'rtx-4060-ti-16gb': nvidia('4060 ti 16gb', /\b4060\s*ti\b.*\b16\s*gb?\b|\b16\s*gb?\b.*\b4060\s*ti\b/),
  'rtx-4060-ti-8gb': nvidia('4060 ti 8gb', /\b4060\s*ti\b/, /\b16\s*gb?\b/),
  'rtx-4060': nvidia('4060', /\b4060\b(?!\s*ti)/),
  'rtx-3090-ti': nvidia('3090 ti', /\b3090\s*ti\b/),
  'rtx-3090': nvidia('3090', /\b3090\b(?!\s*ti)/),
  'rtx-3080-ti': nvidia('3080 ti', /\b3080\s*ti\b/),
  'rtx-3080-12gb': nvidia('3080 12gb', /\b3080\b(?!\s*ti).*\b12\s*gb?\b|\b12\s*gb?\b.*\b3080\b(?!\s*ti)/),
  'rtx-3080-10gb': nvidia('3080 10gb', /\b3080\b(?!\s*ti)/, /\b12\s*gb?\b/),
  'rtx-3070-ti': nvidia('3070 ti', /\b3070\s*ti\b/),
  'rtx-3070': nvidia('3070', /\b3070\b(?!\s*ti)/),
  'rtx-3060-ti': nvidia('3060 ti', /\b3060\s*ti\b/),
  'rtx-3060-12gb': nvidia('3060 12gb', /\b3060\b(?!\s*ti)/, /\b8\s*gb?\b/),
  'rx-7900-xtx': { query: 'rx 7900 xtx', pattern: /\b7900\s*xtx\b/ },
  'rx-7900-xt': { query: 'rx 7900 xt', pattern: /\b7900\s*xt\b(?!x)/ },
  'rx-7900-gre': { query: 'rx 7900 gre', pattern: /\b7900\s*gre\b/ },
  'rx-7800-xt': { query: 'rx 7800 xt', pattern: /\b7800\s*xt\b/ },
  'rx-7700-xt': { query: 'rx 7700 xt', pattern: /\b7700\s*xt\b/ },
  'rx-7600-xt': { query: 'rx 7600 xt', pattern: /\b7600\s*xt\b/ },
  'rx-7600': { query: 'rx 7600', pattern: /\b7600\b(?!\s*xt)/ },
  'arc-a770-16gb': { query: 'arc a770', pattern: /\ba770\b/, exclude: /\b8\s*gb?\b/ },
  'arc-a750': { query: 'arc a750', pattern: /\ba750\b/ },
};

export const MATCH_RULES: MatchRule[] = Object.entries(RULES).map(([slug, rule]) => ({ slug, ...rule }));

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[‐-―]/g, '-')
    .replace(/[^a-z0-9.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Return the catalog slug a retailer title belongs to, or null.
 * When two rules match (for example a title naming both the 8GB and 16GB
 * variant), the result is null rather than a guess.
 */
export function matchTitle(title: string): string | null {
  const normalized = normalizeTitle(title);
  if (GLOBAL_EXCLUDE.test(normalized)) return null;
  const hits = MATCH_RULES.filter(
    (rule) => rule.pattern.test(normalized) && !(rule.exclude && rule.exclude.test(normalized))
  );
  return hits.length === 1 ? hits[0].slug : null;
}

export function ruleFor(slug: string): MatchRule | undefined {
  return MATCH_RULES.find((rule) => rule.slug === slug);
}
