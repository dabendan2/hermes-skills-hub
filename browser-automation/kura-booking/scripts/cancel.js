const { chromium } = require('playwright');
const path = require('path');

const SEARCH_PARTS = process.argv.slice(2);

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 1000 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    try {
        await page.goto('https://e-pai-ke.com/login', { waitUntil: 'networkidle' });
        await page.fill('input[placeholder="電子郵件"]', process.env.E_PAI_KE_EMAIL);
        await page.fill('input[placeholder="密碼"]', process.env.E_PAI_KE_PASSWORD);
        await page.click('button:has-text("登入")');
        await page.waitForTimeout(5000);

        await page.goto('https://e-pai-ke.com/reservationA', { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000);

        // Find the card that contains the target parts
        const cancelResult = await page.evaluate((parts) => {
            const allDivs = Array.from(document.querySelectorAll('div, li, section'));
            for (const div of allDivs) {
                // We look for a small enough container that contains the date info
                if (div.innerText && parts.every(p => div.innerText.includes(p))) {
                    // Find a button or link with cancelBtn class nearby
                    // Check descendants first
                    let btn = div.querySelector('.cancelBtn') || div.querySelector('button, a');
                    if (btn && (btn.innerText.includes('取消') || btn.classList.contains('cancelBtn'))) {
                        btn.click();
                        return { success: true, method: 'descendant' };
                    }
                    // Check siblings or parent's descendants
                    let parent = div.parentElement;
                    for (let i = 0; i < 3; i++) { // search up to 3 levels
                        if (!parent) break;
                        btn = parent.querySelector('.cancelBtn');
                        if (btn) {
                            btn.click();
                            return { success: true, method: 'ancestor-search' };
                        }
                        parent = parent.parentElement;
                    }
                }
            }
            return { success: false };
        }, SEARCH_PARTS);

        if (cancelResult.success) {
            console.log(`Cancel button found via ${cancelResult.method}. Handling confirmation...`);
            await page.waitForTimeout(2000);
            
            // Handle native alert
            page.on('dialog', async dialog => {
                console.log(`Alert: ${dialog.message()}`);
                await dialog.accept();
            });

            // Handle custom modal
            const confirmBtn = await page.$('button:has-text("確認"), button:has-text("OK"), .confirmBtn');
            if (confirmBtn) {
                await confirmBtn.click();
                console.log('Confirmed in modal.');
            }
            
            await page.waitForTimeout(5000);
            const screenshotPath = path.resolve(process.cwd(), 'final_cancellation.png');
            await page.screenshot({ path: screenshotPath });
            console.log(`MEDIA:${screenshotPath}`);
            console.log('Cancellation process finished.');
        } else {
            console.log('Target reservation not found.');
        }

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await browser.close();
    }
})();
