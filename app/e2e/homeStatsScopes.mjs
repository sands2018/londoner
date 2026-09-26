import assert from 'node:assert/strict';
import {existsSync, mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const browsers = fileURLToPath(new URL('../.playwright-browsers', import.meta.url));
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync(browsers)) process.env.PLAYWRIGHT_BROWSERS_PATH = browsers;
const {chromium, devices, expect} = await import('@playwright/test');
const browser = await chromium.launch();
const base = process.env.HOME_STATS_URL ?? 'http://localhost:5173';
const url = new URL(base);
if (url.pathname === '/') url.pathname = '/londoner/';
url.hash = 'roulette';
const output = fileURLToPath(new URL('../test-results/home-stats', import.meta.url));
mkdirSync(output, {recursive: true});
const errors = [];
const key = 'londoner.homeStatsScopes';
const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 20, 31, 0];
const custom = [1, 2, 3, 4, 5, 10, 20];
const classic = ['8', '13', '21', '40', '60', '100', '全部'];
const fibonacci = ['8', '13', '21', '34', '55', '89', '144', '全部'];

async function frame(page) {
  const f = await (await page.waitForSelector('#londoner-viewport')).contentFrame();
  await f.locator('.summary-grid .scope-row').waitFor();
  return f;
}

async function setup({width, height, mobile = false, iphone = false}) {
  const context = await browser.newContext({
    viewport: {width, height}, isMobile: mobile, hasTouch: mobile,
    userAgent: mobile ? devices[iphone ? 'iPhone 13' : 'Pixel 7'].userAgent : undefined,
  });
  // New isolated browser contexts only: neither credentials nor real user data are used.
  await context.route('https://**/rest/v1/rpc/**', route => route.fulfill({
    contentType: 'application/json', body: route.request().url().endsWith('londoner_check_access') ? 'false' : '[]',
  }));
  await context.addInitScript(({numbers, mobile}) => {
    if (sessionStorage.getItem('homeStatsE2eSeed')) return;
    sessionStorage.setItem('homeStatsE2eSeed', '1');
    localStorage.setItem('londoner.currentNumbers', JSON.stringify(numbers));
    localStorage.setItem('londoner.windowMode', 'classic');
    localStorage.setItem('londoner.simulatorDesktopMode', mobile ? '0' : '1');
    localStorage.setItem('londoner.summaryGridCollapsed', '0');
  }, {numbers, mobile});
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url.href);
  return {context, page, f: await frame(page)};
}

async function scopes(f, expected) {
  await expect(f.locator('.summary-grid .scope-row button')).toHaveText(expected);
}

async function openConfig(f) {
  await f.locator('.digit-other').click();
  const config = f.locator('.config-screen');
  await expect(config.locator('.config-screen-main > .tabs > button')).toHaveText(['打法', '区间', '桌子', '其它']);
  await config.getByRole('button', {name: '区间', exact: true}).click();
  await expect(config.getByRole('heading')).toHaveText(['统计窗口', '首页基础数据区间']);
  await expect(config.locator('.home-stats-config')).toBeVisible();
  return config;
}

async function expectCustomFields(config) {
  const fields = config.locator('.home-stats-interval-fields input');
  await expect(fields).toHaveCount(8);
  await expect(config.locator('.home-stats-interval-fields input:not([readonly])')).toHaveCount(7);
  const all = fields.last();
  await expect(all).toHaveValue('全部');
  await expect(all).toHaveAttribute('readonly', '');
  await expect(all).not.toBeEditable();
  await expect(config.locator('.home-stats-hint')).toHaveCount(0);
}

async function selectOther(config) {
  await config.getByRole('button', {name: '其它', exact: true}).click();
  await expect(config.getByRole('heading', {name: '统计窗口', exact: true})).toHaveCount(0);
  await expect(config.getByRole('heading', {name: '首页基础数据区间', exact: true})).toHaveCount(0);
  await expect(config.getByRole('heading', {name: '快照', exact: true})).toBeVisible();
  await expect(config.getByRole('heading', {name: '显示', exact: true})).toBeVisible();
}

async function fillValues(config, values) {
  for (let i = 0; i < 7; i++) {
    await config.getByRole('textbox', {name: `第 ${i + 1} 个区间`, exact: true}).fill(String(values[i] ?? ''));
  }
}

async function expectValues(config, values) {
  await expectCustomFields(config);
  for (let i = 0; i < 7; i++) {
    await expect(config.getByRole('textbox', {name: `第 ${i + 1} 个区间`, exact: true})).toHaveValue(String(values[i] ?? ''));
  }
}

async function expectBoundedScopeRow(f, label, mobile = false) {
  const row = f.locator('.summary-grid .home-stats-custom-scopes');
  const geometry = await row.evaluate(el => {
    const style = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    const scale = box.width / el.offsetWidth;
    return {
      width: el.clientWidth, scrollWidth: el.scrollWidth,
      gap: parseFloat(style.columnGap),
      padding: parseFloat(style.paddingLeft) + parseFloat(style.paddingRight),
      start: (el.firstElementChild.getBoundingClientRect().left - box.left) / scale + el.scrollLeft,
      expectedStart: parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft),
      buttons: [...el.querySelectorAll('button')].map(button => ({
        left: button.offsetLeft, width: parseFloat(getComputedStyle(button).width), text: button.textContent,
      })),
    };
  });
  assert.ok(Math.abs(geometry.start - geometry.expectedStart) <= 1.5, `${label}: buttons should start at the left edge`);
  for (let i = 0; i < geometry.buttons.length; i++) {
    const current = geometry.buttons[i];
    assert.ok(current.width >= 43.5 && current.width <= 56.5, `${label}: ${current.text} width is outside 44–56px: ${current.width}`);
    if (i > 0) {
      const previous = geometry.buttons[i - 1];
      assert.ok(Math.abs(current.left - previous.left - previous.width - geometry.gap) <= 1.5, `${label}: buttons should keep their normal gap`);
    }
  }
  const minWidth = geometry.buttons.length * 44 + (geometry.buttons.length - 1) * geometry.gap + geometry.padding;
  if (minWidth > geometry.width + 1) {
    assert.ok(geometry.scrollWidth > geometry.width, `${label}: crowded buttons should scroll within their row`);
  } else {
    assert.ok(geometry.scrollWidth <= geometry.width + 1, `${label}: fitting buttons should not create horizontal overflow`);
  }
  if (mobile) {
    for (const button of await row.locator('button').all()) {
      const box = await button.boundingBox();
      assert.ok(box.width >= 43.5 && box.height >= 43.5, `${label}: button touch target is too small: ${JSON.stringify(box)}`);
    }
  }
  return geometry;
}

async function save(config) {
  await config.locator('.config-actions').getByRole('button', {name: '确定', exact: true}).click();
  await expect(config).toHaveCount(0);
}

async function stored(f) {
  return f.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
}

async function expectStats(f, scope, expected) {
  const summary = f.locator('.summary-grid');
  const button = summary.locator('.scope-row').getByRole('button', {name: String(scope), exact: true});
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(summary.locator('.panel-head > span')).toHaveText(`最近 ${scope} 个`);
  await expect(summary.locator('.panel-head > strong')).toHaveText(`0: ${expected.zero}`);
  await expect(summary.locator('.ratio-grid .segmented-stat-item strong')).toHaveText(expected.ratios.map(String));
}

try {
  const desktop = await setup({width: 1440, height: 900});
  let {f} = desktop;
  await scopes(f, classic);
  let config = await openConfig(f);
  await expect(config.getByRole('switch', {name: '使用默认'})).toHaveAttribute('aria-checked', 'true');
  await expect(config.locator('.home-stats-interval-fields')).toHaveCount(0);
  await expect(config.locator('.home-stats-hint')).toHaveCount(0);
  await config.getByText('斐波那契数字序列', {exact: true}).click();
  await save(config);
  await scopes(f, fibonacci);
  config = await openConfig(f);
  await config.getByText('传统数字序列', {exact: true}).click();
  await save(config);
  await scopes(f, classic);

  config = await openConfig(f);
  await config.getByRole('switch', {name: '使用默认'}).click();
  await expectCustomFields(config);
  await fillValues(config, custom);
  await save(config);
  await scopes(f, [...custom.map(String), '全部']);
  assert.deepEqual(await stored(f), {useDefault: false, values: custom});

  // Hand-counted tails, independent of the implementation: last 3 = [20, 31, 0].
  // Ratio order is red, black, odd, even, big, small. Zero belongs to none of them.
  await expectStats(f, 1, {zero: 1, ratios: [0, 0, 0, 0, 0, 0]});
  await expectStats(f, 3, {zero: 1, ratios: [0, 2, 1, 1, 2, 0]});
  await expectStats(f, 5, {zero: 1, ratios: [1, 3, 2, 2, 2, 2]});
  await expectStats(f, 20, {zero: 1, ratios: [5, 6, 6, 5, 2, 9]});
  await expectStats(f, '全部', {zero: 1, ratios: [5, 6, 6, 5, 2, 9]});

  // Custom scopes are independent of the global statistics-window setting.
  config = await openConfig(f);
  await config.getByText('斐波那契数字序列', {exact: true}).click();
  await save(config);
  await scopes(f, [...custom.map(String), '全部']);
  config = await openConfig(f);
  await config.getByRole('switch', {name: '使用默认'}).click();
  await save(config);
  await scopes(f, fibonacci);
  config = await openConfig(f);
  await config.getByRole('switch', {name: '使用默认'}).click();
  for (let i = 0; i < custom.length; i++) await expect(config.getByRole('textbox', {name: `第 ${i + 1} 个区间`, exact: true})).toHaveValue(String(custom[i]));
  await save(config);

  // Each tab saves only its own settings. Invalid interval drafts must neither
  // block saving Other nor accidentally change the active window/custom scopes.
  config = await openConfig(f);
  await fillValues(config, [0, 2, 3, 4, 5, 10, 20]);
  await config.getByText('传统数字序列', {exact: true}).click();
  await expect(config.locator('.config-actions').getByRole('button', {name: '确定', exact: true})).toBeDisabled();
  await selectOther(config);
  await config.getByText('最远项变暗显示', {exact: true}).click();
  await expect(config.locator('.config-actions').getByRole('button', {name: '确定', exact: true})).toBeEnabled();
  await save(config);
  assert.deepEqual(await stored(f), {useDefault: false, values: custom});
  assert.equal(await f.evaluate(() => localStorage.getItem('londoner.windowMode')), 'fibonacci');
  assert.equal(await f.evaluate(() => localStorage.getItem('londoner.threeNumberHighlightMode')), 'dim');
  await scopes(f, [...custom.map(String), '全部']);

  config = await openConfig(f);
  await expectCustomFields(config);
  for (let i = 0; i < custom.length; i++) await expect(config.getByRole('textbox', {name: `第 ${i + 1} 个区间`, exact: true})).toHaveValue(String(custom[i]));
  await expect(config.getByRole('radio', {name: '斐波那契数字序列'})).toBeChecked();
  await selectOther(config);
  await config.getByText('最远项高亮显示', {exact: true}).click();
  await config.getByRole('button', {name: '区间', exact: true}).click();
  await config.getByText('传统数字序列', {exact: true}).click();
  await save(config);
  assert.equal(await f.evaluate(() => localStorage.getItem('londoner.windowMode')), 'classic');
  assert.equal(await f.evaluate(() => localStorage.getItem('londoner.threeNumberHighlightMode')), 'dim');
  assert.deepEqual(await stored(f), {useDefault: false, values: custom});

  // Both dismissal routes discard drafts, including a changed toggle.
  for (const dismiss of ['取消', 'close']) {
    config = await openConfig(f);
    await fillValues(config, [2, 4, 6, 8, 10, 12, 14]);
    await config.getByRole('switch', {name: '使用默认'}).click();
    if (dismiss === 'close') await config.locator('.close-button').click();
    else await config.locator('.config-actions').getByRole('button', {name: dismiss, exact: true}).click();
    await expect(config).toHaveCount(0);
    await scopes(f, [...custom.map(String), '全部']);
    assert.deepEqual(await stored(f), {useDefault: false, values: custom});
  }

  config = await openConfig(f);
  const saveButton = config.locator('.config-actions').getByRole('button', {name: '确定', exact: true});
  const invalidCases = [
    ['', 2, 3, 4, 5, 10, 20], [0, 2, 3, 4, 5, 10, 20], [-1, 2, 3, 4, 5, 10, 20],
    [1, 2, '', 4, 5, '', ''],
    ['1.5', 2, 3, 4, 5, 10, 20], [1, 2, 3, 4, 5, 10, 10], [1, 2, 3, 4, 5, 10, 9],
    [1, 2, 3, 4, 5, 10, '9007199254740992'],
  ];
  for (const values of invalidCases) {
    await fillValues(config, values);
    await expect(saveButton).toBeDisabled();
    await expect(config.locator('.home-stats-config [role="alert"]')).toBeVisible();
    await expect(config.locator('.home-stats-interval-fields input[aria-invalid="true"]')).toHaveCount(1);
    assert.deepEqual(await stored(f), {useDefault: false, values: custom});
  }
  await fillValues(config, custom);
  await expect(saveButton).toBeEnabled();
  await save(config);
  await desktop.page.reload();
  f = await frame(desktop.page);
  await scopes(f, [...custom.map(String), '全部']);
  config = await openConfig(f);
  await expect(config.getByRole('switch', {name: '使用默认'})).toHaveAttribute('aria-checked', 'false');
  for (let i = 0; i < custom.length; i++) await expect(config.getByRole('textbox', {name: `第 ${i + 1} 个区间`, exact: true})).toHaveValue(String(custom[i]));
  await desktop.page.screenshot({path: `${output}/desktop-config.png`});
  await config.locator('.close-button').click();

  // Trailing empty fields remove only those buttons. Removing the selected
  // interval falls back to the first retained value, and never keeps stale counts.
  await expectStats(f, 20, {zero: 1, ratios: [5, 6, 6, 5, 2, 9]});
  const five = custom.slice(0, 5);
  config = await openConfig(f);
  await fillValues(config, five);
  await save(config);
  await scopes(f, [...five.map(String), '全部']);
  assert.deepEqual(await stored(f), {useDefault: false, values: five});
  await expect(f.locator('.summary-grid .scope-row button[aria-pressed="true"]')).toHaveText('1');
  await expectStats(f, 1, {zero: 1, ratios: [0, 0, 0, 0, 0, 0]});
  await expectBoundedScopeRow(f, 'desktop five intervals');
  await desktop.page.reload();
  f = await frame(desktop.page);
  await scopes(f, [...five.map(String), '全部']);
  config = await openConfig(f);
  await expectValues(config, five);
  await desktop.page.screenshot({path: `${output}/desktop-trailing-empty-config.png`});
  await config.locator('.close-button').click();

  await expectStats(f, 5, {zero: 1, ratios: [1, 3, 2, 2, 2, 2]});
  config = await openConfig(f);
  await fillValues(config, []);
  await expect(config.locator('.home-stats-config [role="alert"]')).toHaveCount(0);
  await save(config);
  await scopes(f, ['全部']);
  assert.deepEqual(await stored(f), {useDefault: false, values: []});
  await expect(f.locator('.summary-grid .scope-row button[aria-pressed="true"]')).toHaveText('全部');
  await expectStats(f, '全部', {zero: 1, ratios: [5, 6, 6, 5, 2, 9]});
  await expectBoundedScopeRow(f, 'desktop no numeric intervals');
  await desktop.page.reload();
  f = await frame(desktop.page);
  await scopes(f, ['全部']);
  config = await openConfig(f);
  await expectValues(config, []);
  // An intentionally empty custom list survives a round-trip through defaults.
  await config.getByRole('switch', {name: '使用默认'}).click();
  await save(config);
  await scopes(f, classic);
  assert.deepEqual(await stored(f), {useDefault: true, values: []});
  config = await openConfig(f);
  await config.getByRole('switch', {name: '使用默认'}).click();
  await expectValues(config, []);
  await save(config);
  await scopes(f, ['全部']);
  assert.deepEqual(await stored(f), {useDefault: false, values: []});
  await desktop.context.close();
  console.log('Desktop: interval tab, readonly All, default sequences, custom statistics, trailing/all-empty fields, removed-selection fallback, validation, cancel/close, independent tab saving and persistence passed.');

  for (const size of [
    {name: 'small', width: 320, height: 600},
    {name: 'android', width: 360, height: 780},
    {name: 'iphone', width: 440, height: 956, iphone: true},
  ]) {
    const {context, page, f} = await setup({...size, mobile: true});
    await scopes(f, classic);
    const config = await openConfig(f);
    const toggle = config.getByRole('switch', {name: '使用默认'});
    await toggle.click();
    await expectCustomFields(config);
    const large = [1, 2, 3, 10000, 100000, 1000000, 9007199254740991];
    await fillValues(config, large);
    const card = config.locator('.home-stats-config');
    assert.ok(await card.evaluate(el => el.scrollWidth <= el.clientWidth + 1), `${size.name}: custom-settings card horizontal overflow`);
    const cardBox = await card.boundingBox();
    assert.ok(cardBox.x >= -1 && cardBox.x + cardBox.width <= size.width + 1, `${size.name}: card outside viewport`);
    for (const input of await card.locator('input').all()) {
      const box = await input.boundingBox();
      assert.ok(box.width >= 43.5 && box.height >= 43.5, `${size.name}: input is too small: ${JSON.stringify(box)}`);
      await input.click();
      await expect(input).toBeFocused();
    }
    await page.screenshot({path: `${output}/${size.name}-config.png`});
    await save(config);
    await scopes(f, [...large.map(String), '全部']);
    const row = f.locator('.summary-grid .home-stats-custom-scopes');
    assert.ok(await f.locator('.app-shell').evaluate(el => el.scrollWidth <= el.clientWidth + 1), `${size.name}: page horizontal overflow`);
    const geometry = await expectBoundedScopeRow(f, `${size.name} large intervals`, true);
    for (const value of large) {
      await expect(row.getByRole('button', {name: String(value), exact: true})).toHaveAttribute('title', String(value));
    }
    await expectStats(f, 3, {zero: 1, ratios: [0, 2, 1, 1, 2, 0]});
    await expectStats(f, '全部', {zero: 1, ratios: [5, 6, 6, 5, 2, 9]});
    if (geometry.scrollWidth > geometry.width + 1) {
      assert.ok(await row.evaluate(el => el.scrollLeft > 0), `${size.name}: the row should scroll to reach All`);
    }
    await page.screenshot({path: `${output}/${size.name}-summary.png`});
    await page.reload();
    const reloaded = await frame(page);
    await scopes(reloaded, [...large.map(String), '全部']);

    let optionalConfig = await openConfig(reloaded);
    await fillValues(optionalConfig, five);
    await save(optionalConfig);
    await scopes(reloaded, [...five.map(String), '全部']);
    await expectBoundedScopeRow(reloaded, `${size.name} five intervals`, true);
    await page.screenshot({path: `${output}/${size.name}-five-intervals.png`});
    await expectStats(reloaded, 5, {zero: 1, ratios: [1, 3, 2, 2, 2, 2]});
    optionalConfig = await openConfig(reloaded);
    await expectValues(optionalConfig, five);
    await fillValues(optionalConfig, []);
    await save(optionalConfig);
    await scopes(reloaded, ['全部']);
    await expect(reloaded.locator('.summary-grid .scope-row button[aria-pressed="true"]')).toHaveText('全部');
    await expectStats(reloaded, '全部', {zero: 1, ratios: [5, 6, 6, 5, 2, 9]});
    await expectBoundedScopeRow(reloaded, `${size.name} no numeric intervals`, true);
    await page.screenshot({path: `${output}/${size.name}-all-only.png`});
    await page.reload();
    const emptyReload = await frame(page);
    await scopes(emptyReload, ['全部']);
    assert.deepEqual(await stored(emptyReload), {useDefault: false, values: []});
    optionalConfig = await openConfig(emptyReload);
    await expectValues(optionalConfig, []);
    await optionalConfig.locator('.close-button').click();
    await context.close();
    console.log(`${size.name}: interval tab, seven editable fields plus readonly All, optional trailing fields, All-only state, custom scopes, statistics, scroll layout and refresh passed.`);
  }
  assert.deepEqual(errors, [], 'Browser runtime errors');
} finally {
  await browser.close();
}
