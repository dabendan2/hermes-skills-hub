const { chromium } = require('playwright');
const path = require('path');

// Usage: node cancel.js <DATE_STRING>
// Example: node cancel.js "05月 07"
const TARGET_DATE = process.argv[2];

if (!TARGET_DATE) {
    console.error('Usage: node cancel.js <DATE_STRING>');
    console.error('Example: node cancel.js "05月 07"');
    process.exit(1);
}

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
        console.log(`Searching for reservation on: ${TARGET_DATE}`);

        // 1. Login
        await page.goto('https://e-pai-ke.com/login', { waitUntil: 'networkidle' });
        await page.fill('input[placeholder="電子郵件"]', process.env.E_PAI_KE_EMAIL);
        await page.fill('input[placeholder="密碼"]', process.env.E_PAI_KE_PASSWORD);
        await page.click('button:has-text("登入")');
        await page.waitForTimeout(5000);

        // 2. Go to Reservations page
        await page.goto('https://e-pai-ke.com/reservationA', { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000);

        // 3. Find specific card and its cancel button
        const cancelBtnSelector = await page.evaluate((targetDate) => {
            // Find all reservation cards
            const cards = Array.from(document.querySelectorAll('.reservation-card, .res-card, .item-card')); // Adjusting for common classes
            // If the above generic classes don't work, we search for the text container
            const allElements = Array.from(document.querySelectorAll('div, section, li'));
            
            for (const el of allElements) {
                if (el.innerText && el.innerText.includes(targetDate)) {
                    // Find the nearest cancel button within this container or its siblings
                    const parent = el.closest('.reservation-card') || el.parentElement;
                    const btn = parent.querySelector('.cancelBtn') || parent.parentElement.querySelector('.cancelBtn');
                    if (btn) {
                        // Return a unique identifier or just click it here
                        btn.click();
                        return true;
                    }
                }
            }
            return false;
        }, TARGET_DATE);

        if (cancelBtnSelector) {
            console.log(`Found and clicked cancel button for ${TARGET_DATE}.`);
            await page.waitForTimeout(2000);
            
            // Handle confirmation
            const confirmBtn = await page.$('button:has-text("確認"), button:has-text("OK"), .confirmBtn');
            if (confirmBtn) {
                await confirmBtn.click();
                console.log('Confirmed cancellation.');
            }
            
            await page.waitForTimeout(5000);
            await takeScreenshot(`cancelled_${TARGET_DATE.replace(/ /g, '_')}`);
            console.log(`SUCCESS: Reservation for ${TARGET_DATE} processed.`);
        } else {
            console.log(`ERROR: No reservation found for date: ${TARGET_DATE}`);
            await takeScreenshot('cancel_failed_not_found');
        }

    } catch (error) {
        console.error('Cancellation failed:', error.message);
    } finally {
        await browser.close();
    }
})();
