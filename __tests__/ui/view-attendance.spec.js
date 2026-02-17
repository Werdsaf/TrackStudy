// __tests__/ui/view-attendance.spec.js
const { test, expect } = require('@playwright/test');

test.describe('UI Tests: View Attendance', () => {
  test('Просмотр посещаемости с фильтрацией по подгруппе', async ({ page }) => {
    // 1. Авторизация
    await page.goto('http://localhost:3000');
    await page.fill('#email', 'MAleks2007@yandex.ru');
    await page.fill('#password', '226226');
    await page.click('button[type="submit"]');
    await page.waitForNavigation();

    // 2. Перейти на просмотр
    await page.click('text=Просмотр');
    await page.waitForLoadState('networkidle');

    // 3. Выбрать группу (предположим, что есть группа ID=1)
    await page.selectOption('#group-select', '1');
    await page.waitForTimeout(500);

    // 4. Фильтр по подгруппе "1"
    await page.fill('#subgroup-filter', '1');
    await page.waitForTimeout(500);

    // 5. Проверить, что в таблице только студенты подгруппы 1
    const rows = await page.locator('table#attendance-table tbody tr').count();
    expect(rows).toBeGreaterThan(0);

    // Пример: проверяем, что в строках есть "(1)"
    const rowTexts = await page.locator('table#attendance-table tbody tr td:first-child').allInnerTexts();
    for (const text of rowTexts) {
      expect(text).toMatch(/\(1\)/);
    }

    // 6. Проверить итоговую статистику справа
    const upCount = await page.locator('#up-count').innerText();
    const npCount = await page.locator('#np-count').innerText();
    const bCount = await page.locator('#b-count').innerText();
    expect(parseInt(upCount) >= 0).toBe(true);
    expect(parseInt(npCount) >= 0).toBe(true);
    expect(parseInt(bCount) >= 0).toBe(true);

    console.log('[TEST] UI View Attendance (filter by subgroup): SUCCESS');
  });
});

test.afterAll(() => {
  console.log('\n📊 Итог: Все UI-тесты для просмотра посещаемости пройдены.\n');
});