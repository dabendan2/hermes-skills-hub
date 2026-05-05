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
const TIME_HH_MM = process.argv[4];
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
        console.log(`Attempting reservation for ${SHOP_INPUT} (${SHOP_ID}) on day ${DATE_DAY} at ${TIME_HH_MM} for ${PEOPLE_COUNT} people.`);

        // Login
        await page.goto('https://e-pai-ke.com/login', { waitUntil: 'networkidle' });
        await page.fill('input[placeholder="電子郵件"]', process.env.E_PAI_KE_EMAIL);
        await page.fill('input[placeholder="密碼"]', process.env.E_PAI_KE_PASSWORD);
        await page.click('button:has-text("登入")');
        await page.waitForTimeout(5000);

        // Navigate to Shop
        await page.goto(`https://e-pai-ke.com/shop/${SHOP_ID}`, { waitUntil: 'networkidle' });
        
        const bodyText = await page.innerText('body');
        if (bodyText.includes('已完成候位')) {
            console.log('ERROR: Already have an active reservation for this shop.');
            await takeScreenshot('duplicate_reservation');
            process.exit(0);
        }

        await page.click('a.bookbtn:has-text("預約")');
        await page.waitForTimeout(10000);
        
        await page.click('#reserve_date');
        await page.waitForTimeout(3000);

        // Select Date
        const dateSelected = await page.evaluate((day) => {
            const d = Array.from(document.querySelectorAll('.ui-datepicker-calendar a')).find(a => a.innerText.trim() === day);
            if (d) { d.click(); return true; }
            return false;
        }, DATE_DAY);

        if (!dateSelected) throw new Error(`Date ${DATE_DAY} not available.`);
        await page.waitForTimeout(8000);

        // Select Time (Website uses #hour_HH_min_MM)
        const timeId = `hour_${TIME_HH_MM.replace('_', '_min_')}`;
        const timeSelector = `#${timeId}`;
        
        if (!await page.$(timeSelector)) {
            const available = await page.evaluate(() => Array.from(document.querySelectorAll('[id^="hour_"]')).map(el => el.id));
            throw new Error(`Time slot ${timeId} not found. Available slots: ${available.join(', ')}`);
        }
        await page.click(timeSelector);
        await page.waitForTimeout(3000);

        // Select People
        await page.evaluate((count) => {
            const li = document.querySelector(`#optArea li[data-sub="${count}"]`);
            if (li) li.click();
            const input = document.querySelector('#optArea input[name="shop_reserve_category_value_1"]');
            if (input) input.value = count;
        }, PEOPLE_COUNT);
        await page.waitForTimeout(2000);
        
        // Confirmations
        await page.click('#orderOK');
        await page.waitForTimeout(5000);
        await page.click('#orderOK');
        await page.waitForTimeout(10000);
        
        await takeScreenshot('booking_result');
        console.log('Booking process completed successfully.');

    } catch (error) {
        console.error('Booking failed:', error.message);
        await takeScreenshot('booking_error');
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
