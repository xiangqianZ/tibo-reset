import { createPlan, getShanghaiDate, type Category, type DayContent } from '../plan-model';

export const planConfig = {
  // 未核实计划起始日期，不沿用之前的演示日期。
  startDate: null as string | null,
  publisher: {
    name: 'tibo',
    handle: '@thsottiaux',
    url: 'https://x.com/thsottiaux',
  },
};

export const categories: Record<Category, { label: string; description: string }> = {
  reset: { label: '全局重置', description: '统一重置安排' },
  card: { label: '重置卡', description: '重置卡相关公告' },
  update: { label: '功能更新', description: '已发布的功能与变更' },
};

// 仅录入有原始来源和发布时间的官方公告。未核实的日期不填充猜测内容。
// published = 已发布；scheduled = 官方已预告；unverified = 未核实。
export const verifiedContent: Partial<Record<number, DayContent>> = {};

const content: DayContent[] = Array.from({ length: 28 }, (_, index) => verifiedContent[index + 1] ?? {
  category: null,
  title: '当日公告待核实',
  summary: '核实官方发布后，展示当天的重置安排和更新内容。',
  changes: [],
  publicationStatus: 'unverified',
  sources: [],
});

export const planDays = createPlan(planConfig.startDate, content);
export const referenceDate = getShanghaiDate();
