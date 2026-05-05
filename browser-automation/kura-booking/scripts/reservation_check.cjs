const { chromium } = require('playwright');
const fs = require('fs');

/**
 * Boilerplate for checking/booking E-Pai-Ke reservations.
 * Usage: node reservation_check.cjs <branch_id> <day> <time> <people>
 */

(async () => {
  const [,, branchId, day, targetTime, peopleCount] = process.argv;
  if (!branchId || !day) {
    console.log('Usage: node reservation_check.cjs <branch_id> <day> <time> <people>');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await context.newPage();

  try {
    // 1. Login
    await page.goto('https://e-pai-ke.com/login');
    await page.fill('input[placeholder="電子郵件"]', process.env.E_PAI_KE_EMAIL);
    await page.fill('input[placeholder="密碼"]', process.env.E_PAI_KE_PASSWORD);
    await page.click('button:has-text("登入")');
    await page.waitForTimeout(3000);

    // 2. Branch Page
    await page.goto(`https://e-pai-ke.com/shop/${branchId}`);

    // Fast duplicate detection
    const bodyText = await page.innerText('body');
    if (bodyText.includes('已完成候位')) {
        console.log(`ERROR: Already have an active reservation for shop ${branchId} (Detected "已完成候位").`);
        await page.screenshot({ path: 'duplicate_detected.png' });
        process.exit(1);
    }

    await page.click('a.bookbtn:has-text("預約")');
    await page.waitForTimeout(2000);

    // 3. Date Selection with Indicator
    await page.click('#reserve_date');
    await page.waitForTimeout(2000);
    await page.evaluate((d) => {
        const a = Array.from(document.querySelectorAll('.ui-datepicker-calendar a')).find(el => el.innerText.trim() === d);
        if (a) {
            a.style.border = '4px solid red';
            a.click();
        }
    }, day);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'date_selected.png' });

    // 4. Time Check
    const times = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('#future_reserve_button button'))
            .map(b => ({ text: b.innerText.trim(), disabled: b.classList.contains('dateNo') }));
    });
    console.log('Available slots:', JSON.stringify(times));

    if (targetTime && times.some(t => t.text === targetTime && !t.disabled)) {
        console.log(`Time ${targetTime} is available.`);
        // Booking logic continues...
    }

  } catch (error) {
    console.error('Task failed:', error);
  } finally {
    await browser.close();
  }
})();
