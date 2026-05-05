const { chromium } = require('playwright');
const path = require('path');

// Shop Mapping
const FAVORITE_SHOPS = {
    '土城金城店': '90510',
    '中壢站前店': '90001',
    '台中三井店': '90100'
};

// Usage: node book.js <SHOP_ID_OR_NAME> <DATE_DAY> <TIME_HH_MM> <PEOPLE_COUNT>
let SHOP_INPUT = process.argv[2];
const DATE_DAY = process.argv[3];
const TIME_HH_MM = process.argv[4]; // Should handle both 18_30 or 18_min_30
const PEOPLE_COUNT = process.argv[5];

if (!SHOP_INPUT || !DATE_DAY || !TIME_HH_MM || !PEOPLE_COUNT) {
    console.error('Usage: node book.js <SHOP_ID_OR_NAME> <DATE_DAY> <TIME_HH_MM> <PEOPLE_COUNT>');
    process.exit(1);
}

const SHOP_ID = FAVORITE_SHOPS[SHOP_INPUT] || SHOP_INPUT;

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 1000 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    const takeScreenshot = async (name) => {
        const screenshotPath = path.resolve(process.cwd(), `${name}.png`);
        await page.screenshot({ path: screenshotPath });
        console.log(`MEDIA:${screenshotPath}`);
    };

    try {
        console.log(`Booking for Shop: ${SHOP_INPUT} (ID: ${SHOP_ID}), Date: ${DATE_DAY}, Time: ${TIME_HH_MM}, People: ${PEOPLE_COUNT}`);

        await page.goto('https://e-pai-ke.com/login', { waitUntil: 'networkidle' });
        await page.fill('input[placeholder="電子郵件"]', process.env.E_PAI_KE_EMAIL);
        await page.fill('input[placeholder="密碼"]', process.env.E_PAI_KE_PASSWORD);
        await page.click('button:has-text("登入")');
        await page.waitForTimeout(5000);

        await page.goto(`https://e-pai-ke.com/shop/${SHOP_ID}`, { waitUntil: 'networkidle' });
        
        const bodyText = await page.innerText('body');
        if (bodyText.includes('已完成候位')) {
            console.log('ERROR: Already have an active reservation.');
            await takeScreenshot('duplicate_reservation_details');
            process.exit(0);
        }

        await page.click('a.bookbtn:has-text("預約")');
        console.log('Waiting 10s for background data...');
        await page.waitForTimeout(10000);
        
        await page.click('#reserve_date');
        await page.waitForTimeout(3000);

        const dateSelected = await page.evaluate((day) => {
            const d = Array.from(document.querySelectorAll('.ui-datepicker-calendar a')).find(a => a.innerText.trim() === day);
            if (d) { d.click(); return true; }
            return false;
        }, DATE_DAY);

        if (!dateSelected) throw new Error(`Date ${DATE_DAY} not available.`);
        await page.waitForTimeout(8000); // Increased wait for time slots

        // Select Time - Robust handling for _min_ format
        const timeId = TIME_HH_MM.includes('_min_') ? TIME_HH_MM : TIME_HH_MM.replace('_', '_min_');
        const timeSelector = `[id^="hour_${timeId}"], #hour_${timeId}`;
        
        console.log(`Looking for time selector: ${timeSelector}`);
        const timeBtn = await page.$(timeSelector);
        if (!timeBtn) {
            await takeScreenshot('time_slots_not_loaded');
            throw new Error(`Time slot ${TIME_HH_MM} (ID: ${timeId}) not found.`);
        }
        await timeBtn.click();
        await page.waitForTimeout(3000);

        await page.evaluate((count) => {
            const li = document.querySelector(`#optArea li[data-sub="${count}"]`);
            if (li) li.click();
            const input = document.querySelector('#optArea input[name="shop_reserve_category_value_1"]');
            if (input) input.value = count;
        }, PEOPLE_COUNT);
        await page.waitForTimeout(2000);
        
        await page.click('#orderOK');
        await page.waitForTimeout(5000);
        await page.click('#orderOK');
        await page.waitForTimeout(10000);
        
        await takeScreenshot('booking_result');
        console.log('Booking process completed.');

    } catch (error) {
        console.error('Booking failed:', error.message);
        await takeScreenshot('booking_error');
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
