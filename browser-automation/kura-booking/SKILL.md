---
name: kura-booking
description: 使用 e-pai-ke.com (E排客) 進行餐廳預約管理、叫號查詢、登入及取消訂位。適用於藏壽司等使用 E排客 系統的餐廳。
---

# E-Pai-Ke (E排客) Skill

本 Skill 用於自動化操作 E排客 (e-pai-ke.com) 進行餐廳的登入、尋找、查詢及預約管理。

## 帳號資訊參考
- 登入資訊通常記載於 `.env` 檔案中的 `E_PAI_KE_EMAIL` 與 `E_PAI_KE_PASSWORD`。

## 關鍵技術細節 (Lessons Learned)
1. **延遲載入機制**: 開啟預約彈窗後，**必須等待約 10 秒**再點擊日期選擇器 (`#reserve_date`)。若過快點擊，日期選擇器可能無法正確載入可用日期，或導致點擊日期後無法彈出時間格。
2. **日期選取判定**: 
    - `dateOk`: 代表該日為營業日。
    - `dateNo`: 代表該日線上預約已額滿。
    - **強制點擊**: 即使標記為 `dateNo`，有時透過 JavaScript `click()` 仍能觸發系統重整狀態，但在真正額滿時點擊將不會顯示時間格。
3. **時間與人數選取**:
    - **時間格**: 時間格通常在點擊日期後 3-5 秒載入，ID 格式為 `#hour_HH_min_MM` (例如 `#hour_18_min_30`)。
    - **人數下拉選單**: E排客使用自定義的 `<ul>` 列表模擬下拉選單。需點擊 `.div-select` 開啟後，選取對應的 `li[data-sub="N"]`。
4. **兩段式確認**: 
    - 第一次點擊「內容確認」 (`#orderOK`) 是提交選取的時段與人數。
    - 第二次點擊「內容確認」是在摘要頁面進行最終提交。

## 尋找店鋪 (Finding Shop)
1. **直接搜尋**: 
   可以使用搜尋 URL 直接尋找目標店家：`https://e-pai-ke.com/search?keyword=` + `encodeURIComponent('店家全名')`。
2. **獲取 Shop ID**: 
   導航至搜尋結果後，點擊對應店家。網址格式為 `https://e-pai-ke.com/shop/[ID]`。建議將常用店家的 ID 記錄在 `E_PAI_KE_FAVORITE_SHOPS` 記憶中。
3. **分店關鍵字**: 藏壽司分店名通常包含路名（如「土城金城路店」），建議輸入完整名稱以提高精確度。

## 操作流程 (Playwright 腳本)

推薦使用 Playwright 進行操作，因其對延遲載入與自定義 UI 元素有較好的控制力。

### 預約腳本範例 (`kura_booking.cjs`)
```javascript
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    // 1. 登入 (從環境變數讀取)
    await page.goto('https://e-pai-ke.com/login', { waitUntil: 'networkidle' });
    await page.fill('input[placeholder="電子郵件"]', process.env.E_PAI_KE_EMAIL);
    await page.fill('input[placeholder="密碼"]', process.env.E_PAI_KE_PASSWORD);
    await page.click('button:has-text("登入")');
    await page.waitForTimeout(5000);

    // 2. 導航至特定分店 (以土城金城店為例)
    await page.goto('https://e-pai-ke.com/shop/90510', { waitUntil: 'networkidle' });
    
    // 2.1 快速檢查是否有重複預約 (已完成候位 字串判定)
    const sidebarText = await page.innerText('body');
    if (sidebarText.includes('已完成候位')) {
        console.log('ERROR: Already have an active reservation for this shop (Detected "已完成候位").');
        await page.screenshot({ path: 'duplicate_detected.png' });
        process.exit(1);
    }

    await page.click('a.bookbtn:has-text("預約")');
    
    // 3. 關鍵：等待數據載入後再開啟日期選擇器
    console.log('Waiting 10s for background data...');
    await page.waitForTimeout(10000);
    await page.click('#reserve_date');
    await page.waitForTimeout(3000);

    // 4. 選取日期 (例如 7號)
    await page.evaluate(() => {
        const d = Array.from(document.querySelectorAll('.ui-datepicker-calendar a')).find(a => a.innerText.trim() === '7');
        if (d) d.click();
    });
    await page.waitForTimeout(5000); // 等待時間格彈出

    // 5. 選取時間 (例如 18:30)
    await page.click('#hour_18_min_30');
    await page.waitForTimeout(3000);

    // 6. 選取人數 (例如 2位)
    await page.evaluate(() => {
        const li2 = document.querySelector('#optArea li[data-sub="2"]');
        if (li2) li2.click();
        const input = document.querySelector('#optArea input[name="shop_reserve_category_value_1"]');
        if (input) input.value = "2";
    });
    await page.waitForTimeout(2000);
    
    // 7. 第一次確認
    await page.click('#orderOK');
    await page.waitForTimeout(5000);
    
    // 8. 最終確認提交
    await page.click('#orderOK');
    await page.waitForTimeout(10000);
    
    await page.screenshot({ path: 'booking_result.png' });
    console.log('Booking finished.');

  } catch (error) {
    console.error('Booking failed:', error);
  } finally {
    await browser.close();
  }
## 關鍵技術細節 (Lessons Learned)
0. **重複預約限制**: **同一帳號在同一家分店只能擁有一筆有效的預約**。
    - **快速判定**: 在分店頁面（`shop/[ID]`）右側側邊欄，若已存在預約，原本綠色的「預約」按鈕會消失，取而代之的是灰色文字「**已完成候位**」。
    - **預約清單**: 導航至 `https://e-pai-ke.com/reservationA` 檢查是否有「指定時間預約」狀態的項目。
1. **延遲載入機制**: 開啟預約彈窗後，**必須等待約 10 秒**再點擊日期選擇器 (`#reserve_date`)。

## 錯誤偵測
- **日期不可選**: 檢查日曆 `<a>` 標籤是否帶有 `dateNo` 類別且點擊後無反應。
- **時段缺失**: 若點擊日期後 10 秒內 `#future_reserve_button` 仍為空，代表該日已完全額滿。
- **重複預約**: 系統會提示「每個帳號每次僅能預約一筆」，需先取消舊預約。腳本應檢查是否出現 `alert` 或特定錯誤文字。
