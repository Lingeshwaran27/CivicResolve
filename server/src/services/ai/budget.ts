/**
 * Client-side request budget for a free-tier LLM API.
 *
 * Free tiers (e.g. Gemini via AI Studio) limit requests per minute (RPM) and per day (RPD),
 * with daily quotas resetting at midnight Pacific time. We enforce our own, slightly lower,
 * limits so we never hit a hard 429, and we honour server-provided cooldowns when we do.
 */
export interface BudgetSnapshot {
  rpm: number;
  rpd: number;
  usedLastMinute: number;
  usedToday: number;
  remainingToday: number;
  cooldownUntil: string | null;
}

const MINUTE_MS = 60_000;

function pacificDayKey(now: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export class RequestBudget {
  private readonly recent: number[] = [];
  private dayKey: string;
  private usedToday = 0;
  private cooldownUntil = 0;

  constructor(
    private readonly rpm: number,
    private readonly rpd: number,
    private readonly clock: () => number = Date.now,
  ) {
    this.dayKey = pacificDayKey(clock());
  }

  private roll(now: number): void {
    const key = pacificDayKey(now);
    if (key !== this.dayKey) {
      this.dayKey = key;
      this.usedToday = 0;
    }
    while (this.recent.length > 0 && now - this.recent[0]! >= MINUTE_MS) this.recent.shift();
  }

  /** Reserve one request if the budget allows it. Returns false when we must not call the API. */
  tryAcquire(): boolean {
    const now = this.clock();
    this.roll(now);
    if (now < this.cooldownUntil) return false;
    if (this.usedToday >= this.rpd) return false;
    if (this.recent.length >= this.rpm) return false;
    this.recent.push(now);
    this.usedToday += 1;
    return true;
  }

  /** Back off after a 429/5xx. Defaults to 60s, capped at 15 minutes. */
  cooldown(ms = MINUTE_MS): void {
    const bounded = Math.min(Math.max(ms, 5_000), 15 * MINUTE_MS);
    this.cooldownUntil = Math.max(this.cooldownUntil, this.clock() + bounded);
  }

  /** Mark the daily quota as exhausted (provider said so) until the next Pacific midnight. */
  exhaustForToday(): void {
    this.usedToday = this.rpd;
  }

  snapshot(): BudgetSnapshot {
    const now = this.clock();
    this.roll(now);
    return {
      rpm: this.rpm,
      rpd: this.rpd,
      usedLastMinute: this.recent.length,
      usedToday: this.usedToday,
      remainingToday: Math.max(this.rpd - this.usedToday, 0),
      cooldownUntil: now < this.cooldownUntil ? new Date(this.cooldownUntil).toISOString() : null,
    };
  }
}
