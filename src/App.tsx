import { useRef, useState } from 'react';
import { CalendarDays, Check, Clock3, RotateCcw, Sparkles, Ticket, X } from 'lucide-react';
import { categories, planConfig, planDays, referenceDate } from './data/plan';
import { formatDate, getCalendarCells, getProgress, getStatus, type Category, type PlanDay } from './plan-model';

type Filter = Category | 'all';
const categoryOrder: Category[] = ['reset', 'card', 'update'];
const weekdays = ['一', '二', '三', '四', '五', '六', '日'];
const statusLabels = { completed: '已发布', today: '今日发布', upcoming: '已预告', unverified: '待核实' };
const calendarCells = getCalendarCells(planDays);
const publishedDays = planDays.filter((day) => day.publicationStatus === 'published');
const initialDay = publishedDays.at(-1) ?? planDays[0];
const progress = getProgress(planDays, referenceDate);
const firstDate = planDays[0].date;
const lastDate = planDays.at(-1)!.date;
const shortDate = (date: string) => date.slice(5).replace('-', '.');
const counts = Object.fromEntries(categoryOrder.map((category) => [
  category,
  planDays.filter((day) => day.category === category && day.publicationStatus !== 'unverified').length,
])) as Record<Category, number>;
const hasVerifiedContent = planDays.some((day) => day.publicationStatus !== 'unverified');

function CategoryIcon({ category, size = 18 }: { category: Category; size?: number }) {
  const Icon = { reset: RotateCcw, card: Ticket, update: Sparkles }[category];
  return <Icon size={size} strokeWidth={1.8} aria-hidden="true" />;
}

function BrandMark() {
  return <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path d="M16 4v24M4 16h24M7.5 7.5l17 17M7.5 24.5l17-17" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    <circle cx="16" cy="16" r="4" fill="var(--paper)" />
  </svg>;
}

function DayDetails({ day }: { day: PlanDay }) {
  const status = getStatus(day.date, referenceDate, day.publicationStatus);

  return <div className={`day-details ${day.category ?? 'unverified'}`} key={day.day}>
    <div className="detail-overline"><span>当日公告</span><span>DAY {String(day.day).padStart(2, '0')}</span></div>
    <div className="detail-date-row">
      <h3>{day.date ? formatDate(day.date, { month: 'long', day: 'numeric' }) : `第 ${day.day} 天`}
        {day.date && <span>{formatDate(day.date, { weekday: 'short' })}</span>}
      </h3>
      <span className={`status-badge ${status}`}>
        {status === 'upcoming' || status === 'unverified' ? <Clock3 size={11} /> : <Check size={11} />}
        {statusLabels[status]}
      </span>
    </div>
    <div className={`detail-icon ${day.category ?? 'unverified'}`} aria-hidden="true">
      {day.category ? <CategoryIcon category={day.category} size={30} /> : <CalendarDays size={30} strokeWidth={1.4} />}
    </div>
    {day.category && <span className={`category-label ${day.category}`}><CategoryIcon category={day.category} size={13} />{categories[day.category].label}</span>}
    <h4 className="detail-title">{day.title}</h4>
    <p className="detail-summary">{day.summary}</p>
    {day.changes.length > 0 && <ul className="detail-changes">
      {day.changes.map((change) => <li key={change}><Check size={13} /><span>{change}</span></li>)}
    </ul>}
    <div className="detail-source">
      <span>来源：{planConfig.publisher.handle}</span>
      {day.sources?.length ? <span>{day.sources.length} 条原始公告</span> : <span>尚未核实</span>}
    </div>
  </div>;
}

export default function App() {
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedDay, setSelectedDay] = useState(initialDay);
  const detailDialog = useRef<HTMLDialogElement>(null);

  function selectDay(day: PlanDay) {
    setSelectedDay(day);
    if (window.matchMedia('(max-width: 760px)').matches && !detailDialog.current?.open) {
      detailDialog.current?.showModal();
    }
  }

  function changeFilter(nextFilter: Filter) {
    setFilter(nextFilter);
    if (nextFilter !== 'all' && selectedDay.category !== nextFilter) {
      const matching = planDays.filter((day) => day.category === nextFilter);
      if (matching.length) setSelectedDay(matching.at(-1)!);
    }
  }

  return <>
    <a className="skip-link" href="#renewal-calendar">跳到更新日历</a>
    <header className="site-header">
      <div className="header-inner">
        <div className="brand"><span className="brand-icon"><BrandMark /></span><span className="brand-name">tibo<span className="brand-period">.</span></span><span className="brand-divider" /><span className="brand-caption">更新日历</span></div>
        <span className="publisher-handle">{planConfig.publisher.handle}</span>
      </div>
    </header>

    <main className="page-shell">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <div className="eyebrow"><span />28 DAYS OF UPDATES</div>
          <h1 id="hero-title">28 天<span className="hero-accent">更新日历<svg viewBox="0 0 132 14" preserveAspectRatio="none" aria-hidden="true"><path d="M4 9C37 1 87 1 128 6" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" /></svg></span></h1>
          <p className="hero-description">全局重置 · 重置卡 · 功能更新</p>
          <div className="hero-meta"><span className="plan-date"><CalendarDays size={14} />{firstDate && lastDate ? `${shortDate(firstDate)} — ${shortDate(lastDate)}` : '起始日期待核实'}</span>{!hasVerifiedContent && <span className="verification-badge">官方公告待核实</span>}</div>
        </div>
        <div className="hero-visual"><img src="./renewal.svg" alt="28 天重置与更新插画" width="460" height="260" /></div>
      </section>

      <section className="overview" aria-label="已核实的更新分类">
        {categoryOrder.map((category) => <div className={`overview-card ${category}`} key={category}>
          <span className="overview-icon"><CategoryIcon category={category} size={24} /></span>
          <div className="overview-copy"><h2>{categories[category].label}</h2><p>{categories[category].description}</p></div>
          <span className="overview-count"><strong>{hasVerifiedContent ? String(counts[category]).padStart(2, '0') : '—'}</strong>{hasVerifiedContent && <span>天</span>}</span>
        </div>)}
      </section>

      <div className="content-layout" id="renewal-calendar">
        <section className="calendar-panel" aria-labelledby="calendar-title">
          <div className="calendar-header"><h2 id="calendar-title">更新日历</h2><span>28 DAYS</span></div>
          {firstDate && <div className="progress-section">
            <div className="progress-label"><span>计划进度</span><span><strong>{progress.elapsed}</strong> / 28 天</span></div>
            <div className="progress-track" role="progressbar" aria-valuenow={progress.elapsed} aria-valuemin={0} aria-valuemax={28} aria-label="28 天计划进度"><span style={{ width: `${progress.percent}%` }} /></div>
          </div>}
          <div className="filter-group" role="group" aria-label="按更新类型筛选">
            <button className={`filter-button ${filter === 'all' ? 'active' : ''}`} aria-pressed={filter === 'all'} onClick={() => changeFilter('all')}>全部</button>
            {categoryOrder.map((category) => <button
              className={`filter-button ${category} ${filter === category ? 'active' : ''}`}
              key={category}
              aria-pressed={filter === category}
              disabled={counts[category] === 0}
              onClick={() => changeFilter(category)}
            ><span className="filter-dot" />{categories[category].label}</button>)}
          </div>
          <div className="month-label"><span>{firstDate && lastDate ? `${formatDate(firstDate, { year: 'numeric', month: 'long' })} — ${formatDate(lastDate, { month: 'long' })}` : '28 天计划'}</span><span>点击查看当日公告</span></div>
          <div className="calendar-view" role="group" aria-label="28 天更新日历">
            {firstDate && <div className="weekdays" aria-hidden="true">{weekdays.map((weekday, index) => <span className={index > 4 ? 'weekend' : ''} key={weekday}>周{weekday}</span>)}</div>}
            <div className="calendar-grid">
              {calendarCells.map((day, index) => {
                if (!day) return <div key={`empty-${index}`} className="calendar-empty" />;
                const status = getStatus(day.date, referenceDate, day.publicationStatus);
                const matches = filter === 'all' || day.category === filter;
                return <button
                  key={day.day}
                  data-day={day.day}
                  className={`calendar-day ${day.category ?? 'unverified'} ${status} ${selectedDay.day === day.day ? 'selected' : ''} ${!matches ? 'filtered-out' : ''}`}
                  aria-label={`${day.date ? `${formatDate(day.date, { month: 'long', day: 'numeric' })}，` : ''}第 ${day.day} 天，${day.category ? `${categories[day.category].label}，` : ''}${statusLabels[status]}`}
                  aria-pressed={selectedDay.day === day.day}
                  disabled={!matches}
                  onClick={() => selectDay(day)}
                >
                  <span className="day-top"><span className="day-number">{day.date ? Number(day.date.slice(-2)) : String(day.day).padStart(2, '0')}{day.date?.endsWith('-01') && <span className="next-month">{Number(day.date.slice(5, 7))}月</span>}</span>{day.date === referenceDate && <span className="today-indicator">今</span>}</span>
                  <span className="day-category">{day.category ? <><CategoryIcon category={day.category} size={12} /><span>{categories[day.category].label}</span></> : '待核实'}</span>
                  <span className="day-sequence">DAY {String(day.day).padStart(2, '0')}{status === 'completed' && <Check size={10} />}</span>
                </button>;
              })}
            </div>
          </div>
          <div className="calendar-legend"><span><Check size={11} />已发布</span><span><Clock3 size={10} />已预告</span><span><span className="legend-unverified" />待核实</span></div>
        </section>

        <aside className="detail-panel" aria-label="选中日期的更新详情" aria-live="polite"><DayDetails day={selectedDay} /></aside>
      </div>
    </main>

    <dialog
      ref={detailDialog}
      className="day-sheet"
      aria-label="每日更新详情"
      onClick={(event) => { if (event.target === event.currentTarget) detailDialog.current?.close(); }}
    >
      <div className="sheet-handle" />
      <button className="icon-button dialog-close" aria-label="关闭详情" onClick={() => detailDialog.current?.close()}><X size={20} /></button>
      <DayDetails day={selectedDay} />
    </dialog>
  </>;
}
