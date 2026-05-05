const { chromium } = require('playwright');

/**
 * Reusable script to check Kura Sushi (E-Pai-Ke) availability.
 * Usage: node kura_check_availability.cjs [shop_id] [day] [time] [people]
 */

(async () => {
  const shopId = process.argv[2] || '90510'; // Default: Tucheng Jincheng
  const targetDay = process.argv[3] || '7';
  const targetTime = process.argv[4] || '18:30';
  const peopleCount = process.argv[5] || '2';

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    // 1. Login (Uses environment variables if present, or placeholder)
    const email = process.env.E_PAI_KE_EMAIL;
    const password = process.env.E_PAI_KE_PASSWORD;

    if (email && password) {
        await page.goto('https://e-pai-ke.com/login', { waitUntil: 'networkidle' });
        await page.fill('input[placeholder="電子郵件"]', email);
        await page.fill('input[placeholder="密碼"]', password);
        await page.click('button:has-text("登入")');
        await page.waitForTimeout(3000);
    }

    // 2. Navigate to Shop
    await page.goto(`https://e-pai-ke.com/shop/${shopId}`, { waitUntil: 'networkidle' });
    
    // 2.1 Fast duplicate detection
    const bodyText = await page.innerText('body');
    if (bodyText.includes('已完成候位')) {
        console.log(`ERROR: Already have an active reservation for shop ${shopId} (Detected "已完成候位").`);
        await page.screenshot({ path: 'duplicate_detected.png' });
        process.exit(1);
    }

    // 3. Open Modal
    const resBtn = page.locator('a.bookbtn:has-text("預約")').first();
    if (!await resBtn.isVisible()) {
        console.log(`ERROR: Reservation button not found for shop ${shopId}.`);
        process.exit(1);
    }
    await resBtn.click();
    await page.waitForTimeout(2000);
    
    // 4. Trigger Date Picker
    await page.click('#reserve_date');
    await page.waitForTimeout(2000);

    // 5. Select Day
    const isDayAvailable = await page.evaluate((day) => {
        const td = Array.from(document.querySelectorAll('.ui-datepicker-calendar td'))
            .find(td => {
                const a = td.querySelector('a');
                return a && a.innerText.trim() === day;
            });
        if (td && !td.classList.contains('ui-state-disabled')) {
            const a = td.querySelector('a');
            a.click();
            return true;
        }
        return false;
    }, targetDay);

    if (!isDayAvailable) {
        console.log(`STATUS: Day ${targetDay} is FULL or Locked.`);
        await page.screenshot({ path: 'check_failed_date.png' });
        process.exit(0);
    }
    await page.waitForTimeout(2000);

    // 6. Check Time
    const times = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('button, .time_item, .time_btn'))
            .map(el => el.innerText.trim())
            .filter(t => t.match(/^\d{2}:\d{2}$/));
    });

    if (times.includes(targetTime)) {
        console.log(`STATUS: AVAILABLE! Found ${targetTime} for ${peopleCount} people.`);
        await page.screenshot({ path: 'check_success.png' });
    } else {
        console.log(`STATUS: FULL. ${targetTime} not found. Available times: ${times.join(', ')}`);
        await page.screenshot({ path: 'check_failed_time.png' });
    }

  } catch (error) {
    console.error('CRITICAL ERROR:', error.message);
  } finally {
    await browser.close();
  }
})();
