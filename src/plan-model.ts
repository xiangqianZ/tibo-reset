export type Category = 'reset' | 'card' | 'update';
export type DayStatus = 'completed' | 'today' | 'upcoming' | 'unverified';
export type PublicationStatus = 'published' | 'scheduled' | 'unverified';

export interface PublicationSource {
  url: string;
  publishedAt: string;
  title: string;
}

export interface DayContent {
  category: Category | null;
  title: string;
  summary: string;
  changes: string[];
  publicationStatus: PublicationStatus;
  sources?: PublicationSource[];
}

export interface PlanDay extends DayContent {
  day: number;
  date: string | null;
}

const DAY_MS = 86_400_000;

export function parseDate(date: string): Date {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`Invalid date: ${date}`);
  }
  return parsed;
}

export function addDays(date: string, amount: number): string {
  return new Date(parseDate(date).getTime() + amount * DAY_MS).toISOString().slice(0, 10);
}

export function createPlan(startDate: string | null, content: DayContent[]): PlanDay[] {
  if (content.length !== 28) throw new Error('The plan must contain exactly 28 days.');
  for (const entry of content) {
    if (entry.publicationStatus === 'unverified') continue;
    if (!entry.category || !entry.sources?.length) throw new Error('Verified announcements require a category and original sources.');
    for (const source of entry.sources) {
      let url: URL;
      try { url = new URL(source.url); } catch { throw new Error('Announcement sources require a valid HTTPS URL.'); }
      if (url.protocol !== 'https:') throw new Error('Announcement sources require a valid HTTPS URL.');
      if (!source.publishedAt || Number.isNaN(Date.parse(source.publishedAt))) throw new Error('Announcement sources require a publication date.');
    }
  }
  return content.map((entry, index) => ({ ...entry, day: index + 1, date: startDate ? addDays(startDate, index) : null }));
}

export function getStatus(date: string | null, referenceDate: string, publicationStatus: PublicationStatus = 'unverified'): DayStatus {
  if (!date || publicationStatus === 'unverified') return 'unverified';
  if (publicationStatus === 'scheduled') return 'upcoming';
  if (date === referenceDate) return 'today';
  return date < referenceDate ? 'completed' : 'upcoming';
}

export function getProgress(days: PlanDay[], referenceDate: string) {
  const elapsed = days.filter((day) => day.date && day.date <= referenceDate).length;
  return { elapsed, total: days.length, percent: Math.round((elapsed / days.length) * 100) };
}

export function getCalendarCells(days: PlanDay[]): (PlanDay | null)[] {
  if (!days.length) return [];
  const offset = days[0].date ? (parseDate(days[0].date).getUTCDay() + 6) % 7 : 0;
  const cells: (PlanDay | null)[] = [...Array<null>(offset).fill(null), ...days];
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function getShanghaiDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (name: string) => parts.find((item) => item.type === name)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function formatDate(date: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'UTC', ...options }).format(parseDate(date));
}
