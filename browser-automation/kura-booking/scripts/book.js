const { chromium } = require('playwright');
const path = require('path');

// Usage: node book.js <SHOP_ID> <DATE_DAY> <TIME_HH_MM> <PEOPLE_COUNT>
const SHOP_ID = process.argv[2];
const DATE_DAY = process.argv[3];
const TIME_HH_MM = process.argv[4];
const PEOPLE_COUNT = process.argv[5];

if (!SHOP_ID || !DATE_DAY || !TIME_HH_MM || !PEOPLE_COUNT) {
    console.error('Usage: node book.js <SHOP_ID> <DATE_DAY> <TIME_HH_MM> <PEOPLE_COUNT>');
    console.error('Example: node book.js 90510 7 18_30 2');
    process.exit(1);
}

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 1000 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    // Helper for screenshot
    const takeScreenshot = async (name) => {
        const screenshotPath = path.resolve(process.cwd(), `${name}.png`);
        await page.screenshot({ path: screenshotPath });
        console.log(`MEDIA:${screenshotPath}`);
    };

    try {
        console.log(`Starting booking for Shop:${SHOP_ID}, Date:${DATE_DAY}, Time:${TIME_HH_MM}, People:${PEOPLE_COUNT}`);

        // 1. Login
        await page.goto('https://e-pai-ke.com/login', { waitUntil: 'networkidle' });
        
        const email = process.env.E_PAI_KE_EMAIL;
        const password = process.env.E_PAI_KE_PASSWORD;

        if (!email || !password) {
            throw new Error('E_PAI_KE_EMAIL or E_PAI_KE_PASSWORD environment variables are not set.');
        }

        await page.fill('input[placeholder="電子郵件"]', email);
        await page.fill('input[placeholder="密碼"]', password);
        await page.click('button:has-text("登入")');
        await page.waitForTimeout(5000);

        // 2. Navigate to Shop
        await page.goto(`https://e-pai-ke.com/shop/${SHOP_ID}`, { waitUntil: 'networkidle' });
        
        // 2.1 Duplicate Check
        const sidebarText = await page.innerText('body');
        if (sidebarText.includes('已完成候位')) {
            console.log('ERROR: Already have an active reservation for this shop (Detected "已完成候位").');
            await takeScreenshot('duplicate_reservation');
            process.exit(1);
        }

        await page.click('a.bookbtn:has-text("預約")');
        
        // 3. Wait for background data (10s as per skill requirement)
        console.log('Waiting 10s for background data...');
        await page.waitForTimeout(10000);
        
        await page.click('#reserve_date');
        await page.waitForTimeout(3000);

        // 4. Select Date
        console.log(`Selecting date: ${DATE_DAY}`);
        const dateSelected = await page.evaluate((day) => {
            const d = Array.from(document.querySelectorAll('.ui-datepicker-calendar a')).find(a => a.innerText.trim() === day);
            if (d) {
                d.click();
                return true;
            }
            return false;
        }, DATE_DAY);

        if (!dateSelected) {
            throw new Error(`Date ${DATE_DAY} not found or not clickable.`);
        }
        await page.waitForTimeout(5000);

        // 5. Select Time
        const timeSelector = `#hour_${TIME_HH_MM}`;
        console.log(`Selecting time: ${TIME_HH_MM} (${timeSelector})`);
        const timeExists = await page.$(timeSelector);
        if (!timeExists) {
            await takeScreenshot('time_not_found');
            throw new Error(`Time slot ${TIME_HH_MM} not found.`);
        }
        await page.click(timeSelector);
        await page.waitForTimeout(3000);

        // 6. Select People
        console.log(`Selecting people count: ${PEOPLE_COUNT}`);
        await page.evaluate((count) => {
            const li = document.querySelector(`#optArea li[data-sub="${count}"]`);
            if (li) li.click();
            const input = document.querySelector('#optArea input[name="shop_reserve_category_value_1"]');
            if (input) input.value = count;
        }, PEOPLE_COUNT);
        await page.waitForTimeout(2000);
        
        // 7. First Confirmation
        await page.click('#orderOK');
        await page.waitForTimeout(5000);
        
        // 8. Final Confirmation
        await page.click('#orderOK');
        console.log('Submitted final confirmation. Waiting for result...');
        await page.waitForTimeout(10000);
        
        await takeScreenshot('booking_final_result');
        console.log('Booking process completed.');

    } catch (error) {
        console.error('Booking failed:', error.message);
        await takeScreenshot('error_state');
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
