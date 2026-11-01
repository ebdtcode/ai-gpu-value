/**
 * Polite HTTP helpers for the price fetchers.
 *
 * Every retailer request goes through fetchPage, which refuses paths the
 * site's robots.txt disallows for all agents, waits between requests, and
 * retries transient failures.
 *
 * Transport is the system curl binary rather than Node's fetch. Both
 * retailers sit behind bot management that serves Node's TLS stack a
 * challenge page while serving curl normally. If a run is challenged anyway
 * (typical from datacenter addresses), the error names it so the run fails
 * loudly instead of recording nothing. No challenge solving is attempted.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

/** A browser-shaped agent string that still names this job and a contact page. */
const USER_AGENT =
  process.env.PRICECHECK_USER_AGENT ||
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 aigpuvalue-pricecheck/1.0 (+https://aigpuvalue.com/contact)';
const CONTACT = 'pricecheck@aigpuvalue.com';

const MIN_DELAY_MS = 2500;
const TIMEOUT_S = 30;
const MAX_ATTEMPTS = 3;
const MAX_BODY_BYTES = 50 * 1024 * 1024;

let lastRequestAt = 0;
const robotsCache = new Map<string, string[]>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttle(): Promise<void> {
  const wait = lastRequestAt + MIN_DELAY_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

/** Parse the Disallow rules that apply to all user agents. */
export function parseRobots(text: string): string[] {
  const rules: string[] = [];
  let applies = false;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const [key, ...rest] = line.split(':');
    const value = rest.join(':').trim();
    const k = key.toLowerCase();
    if (k === 'user-agent') {
      applies = value === '*';
    } else if (k === 'disallow' && applies && value) {
      rules.push(value);
    }
  }
  return rules;
}

function ruleToRegex(rule: string): RegExp {
  const escaped = rule
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  const anchored = escaped.endsWith('\\$') ? `${escaped.slice(0, -2)}$` : escaped;
  return new RegExp(`^${anchored}`);
}

/** True when any wildcard-agent Disallow rule matches the path and query. */
export function isDisallowed(rules: string[], pathWithQuery: string): boolean {
  return rules.some((rule) => {
    if (rule.startsWith('/') || rule.startsWith('*')) return ruleToRegex(rule).test(pathWithQuery);
    return pathWithQuery.includes(rule);
  });
}

export class RobotsDisallowedError extends Error {}
export class BotChallengeError extends Error {}

interface CurlResponse {
  status: number;
  body: string;
}

async function curl(url: string): Promise<CurlResponse> {
  const args = [
    '--silent',
    '--show-error',
    '--location',
    '--http1.1',
    '--compressed',
    '--max-time',
    String(TIMEOUT_S),
    '--user-agent',
    USER_AGENT,
    '--header',
    `From: ${CONTACT}`,
    '--header',
    'Accept: text/html,application/xhtml+xml',
    '--header',
    'Accept-Language: en-US,en;q=0.9',
    '--write-out',
    '\n__HTTP_STATUS__%{http_code}',
    url,
  ];
  const { stdout } = await run('curl', args, { maxBuffer: MAX_BODY_BYTES });
  const marker = stdout.lastIndexOf('\n__HTTP_STATUS__');
  if (marker === -1) throw new Error('curl returned no status');
  return {
    status: Number.parseInt(stdout.slice(marker + '\n__HTTP_STATUS__'.length), 10),
    body: stdout.slice(0, marker),
  };
}

async function robotsFor(origin: string): Promise<string[]> {
  const cached = robotsCache.get(origin);
  if (cached) return cached;
  let rules: string[] = [];
  try {
    await throttle();
    const res = await curl(`${origin}/robots.txt`);
    if (res.status === 200) rules = parseRobots(res.body);
  } catch {
    // No robots file reachable: treat as no restrictions.
  }
  robotsCache.set(origin, rules);
  return rules;
}

function looksLikeChallenge(status: number, body: string): boolean {
  if (status !== 403 && status !== 503 && status !== 429) return false;
  return /just a moment|cf-chl|challenge-platform|areyouahuman|are you a human|access denied|captcha/i.test(body);
}

/** Fetch an HTML page politely. Throws on robots disallow, challenge, or persistent failure. */
export async function fetchPage(url: string): Promise<string> {
  const parsed = new URL(url);
  const rules = await robotsFor(parsed.origin);
  const pathWithQuery = parsed.pathname + parsed.search;
  if (isDisallowed(rules, pathWithQuery)) {
    throw new RobotsDisallowedError(`robots.txt disallows ${pathWithQuery} on ${parsed.host}`);
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await throttle();
    try {
      const res = await curl(url);
      if (looksLikeChallenge(res.status, res.body)) {
        throw new BotChallengeError(`${parsed.host} answered with a bot challenge (HTTP ${res.status})`);
      }
      if (res.status === 429 || res.status >= 500) {
        throw new Error(`HTTP ${res.status}`);
      }
      if (res.status !== 200) {
        throw new Error(`HTTP ${res.status} (not retried)`);
      }
      return res.body;
    } catch (error) {
      lastError = error;
      if (error instanceof BotChallengeError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('not retried')) break;
      if (attempt < MAX_ATTEMPTS) await sleep(attempt * 5000);
    }
  }
  throw new Error(`Failed to fetch ${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

export function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}
