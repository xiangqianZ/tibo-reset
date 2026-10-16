import { test, expect, type Page } from '@playwright/test';

function detail(page: Page, mobile: boolean) {
  return mobile ? page.getByRole('dialog', { name: '每日更新详情', exact: true }) : page.getByRole('complementary', { name: '选中日期的更新详情' });
}

test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('displays the official account and 28 unverified slots without invented dates or releases', async ({ page }) => {
  const errors: string[] = [], failures: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => failures.push(request.url()));
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('28 天更新日历');
  await expect(page.locator('.publisher-handle')).toHaveText('@thsottiaux');
  await expect(page.locator('.calendar-day')).toHaveCount(28);
  await expect(page.locator('.calendar-day.unverified')).toHaveCount(28);
  await expect(page.locator('.calendar-day.completed, .calendar-day.today, .calendar-day.upcoming')).toHaveCount(0);
  await expect(page.getByText('起始日期待核实', { exact: true })).toBeVisible();
  await expect(page.getByText('官方公告待核实', { exact: true })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await expect(page.locator('.weekdays')).toHaveCount(0);
  await expect(page.locator('.overview-count')).toHaveText(['—', '—', '—']);
  await expect(page.locator('.hero-visual img')).toHaveJSProperty('naturalWidth', 460);
  await expect(page.getByText('演示计划', { exact: true })).toHaveCount(0);
  await page.waitForLoadState('networkidle');
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
});

test('has no share, navigation, view switching or decorative sections below the calendar', async ({ page }) => {
  await expect(page.getByRole('banner').getByRole('button')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /分享|关于|首页/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /分享|复制|关于|计划说明|上一条|下一条|列表视图|日历视图|回到|演示今日/ })).toHaveCount(0);
  await expect(page.locator('.week-journey, .closing-note, .site-footer, .mobile-daily-card, .share-dialog, .about-dialog')).toHaveCount(0);
  await expect(page.locator('main > :last-child')).toHaveClass('content-layout');
  await expect(page.locator('a[href^="http"]')).toHaveCount(0);
});

test('selecting days opens the correct details and does not invent change lists', async ({ page, isMobile }) => {
  for (const day of [1, 12, 28]) {
    await page.locator(`[data-day="${day}"]`).click();
    const panel = detail(page, isMobile);
    await expect(panel.getByRole('heading', { level: 3 })).toHaveText(`第 ${day} 天`);
    await expect(panel.getByRole('heading', { name: '当日公告待核实', exact: true })).toBeVisible();
    await expect(panel.locator('.status-badge')).toHaveText('待核实');
    await expect(panel.locator('.detail-changes')).toHaveCount(0);
    await expect(page.locator('.calendar-day.selected')).toHaveAttribute('data-day', String(day));
    if (isMobile) {
      await panel.getByRole('button', { name: '关闭详情' }).click();
      await expect(panel).not.toBeVisible();
    }
  }
});

test('empty categories are disabled while all days remain accessible', async ({ page }) => {
  const filters = page.getByRole('group', { name: '按更新类型筛选' });
  for (const label of ['全局重置', '重置卡', '功能更新']) await expect(filters.getByRole('button', { name: label, exact: true })).toBeDisabled();
  await expect(filters.getByRole('button', { name: '全部', exact: true })).toBeEnabled();
  await expect(page.locator('.calendar-day:not(:disabled)')).toHaveCount(28);
});

test('mobile details close with Escape and return focus to the selected day', async ({ page, isMobile }) => {
  if (isMobile) {
    const button = page.locator('[data-day="12"]');
    await button.click();
    await expect(detail(page, true)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(detail(page, true)).not.toBeVisible();
    await expect(button).toBeFocused();
  } else {
    await page.locator('[data-day="12"]').focus();
    await page.keyboard.press('Enter');
    await expect(detail(page, false).getByRole('heading', { level: 3 })).toHaveText('第 12 天');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
});

test('layout fits narrow and wide screens without horizontal overflow', async ({ page, isMobile }) => {
  const widths = isMobile ? [320, 375, 390, 430] : [768, 1024, 1440];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 844 });
    const measurements = await page.evaluate(() => ({ actual: document.documentElement.scrollWidth, available: window.innerWidth }));
    expect(measurements.actual, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(measurements.available);
    await expect(page.locator('.calendar-day')).toHaveCount(28);
    const button = await page.locator('[data-day="12"]').boundingBox();
    expect(button!.width).toBeGreaterThan(25);
    expect(button!.height).toBeGreaterThan(44);
  }
});
