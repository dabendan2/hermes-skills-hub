---
name: kura-booking
description: 使用 e-pai-ke.com (E排客) 進行餐廳預約管理、叫號查詢、登入及取消訂位。適用於藏壽司等使用 E排客 系統的餐廳。
---

# E-Pai-Ke (E排客) Skill

# E-Pai-Ke (E排客) Skill

## [重要規範 (MUST READ)]
1. **單一預約限制**：同一帳號在同一家分店**絕對只能擁有一筆**有效預約。
    - **換日操作流程**：若要更改預約日期（例如從 5/7 改為 5/10），**必須先執行 `cancel.js` 取消現有預約**。
    - **禁止盲目嘗試**：不要在未取消舊預約的情況下嘗試執行 `book.js` 進行新日期的預約，這會觸發技能中的「重複判定邏輯」並導致任務停止。

## 瀏覽器工具手動取消 (Manual Cancellation Workflow)
當腳本失效或需要手動撤銷預約時，請遵循以下步驟：
1. **進入清單**：導航至 `https://e-pai-ke.com/reservationA`。
2. **定位預約**：在「即將用餐」分頁中，找到目標日期的預約卡片。
3. **觸發取消**：點擊該卡片右側的「取消」按鈕（`.cancelBtn`）。
4. **兩階段確認 (關鍵)**：
    - 點擊後會彈出一個確認 Modal。
    - **必須點擊** 該 Modal 中綠色的「**確認取消**」按鈕，其 ID 為 `#delOK`。
5. **成功提示**：隨後會出現「成功取消」的綠色勾勾 Modal，點擊「關閉」即可返回並確認列表已清空。
6. **最終驗證**：刷新頁面確認列表顯示「尚無任何預約或候位資訊」，且左側選單預約數為 0。

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
### 取消預約腳本 (Parameterized Cancel Script)

本技能附帶一個參數化取消腳本，位於 `scripts/cancel.js`。

**使用方法：**
```bash
# 語法: node ~/.hermes/skills/kura-booking/scripts/cancel.js "<日期字串>"
# 範例: 取消 5月 7號 的預約
node ~/.hermes/skills/kura-booking/scripts/cancel.js "05月 07"
```

**參數說明：**
- `<日期字串>`: 必須與 E排客 介面上顯示的日期格式一致（例如 "05月 07"）。腳本會搜尋包含該字串的預約項目並點擊對應的取消按鈕。

---

### 預約腳本 (Parameterized Script)

本技能附帶一個參數化腳本，位於 `scripts/book.js`。

**環境準備：**
初次使用前，請在腳本目錄執行：
```bash
cd ~/.hermes/skills/kura-booking/scripts/ && npm install playwright
```

**使用方法：**
```bash
# 語法: node ~/.hermes/skills/kura-booking/scripts/book.js <SHOP_ID> <日期> <時間> <人數>
# 範例: 預約 90510 分店，7 號，18:30，2 位
node ~/.hermes/skills/kura-booking/scripts/book.js 90510 7 18_30 2
```

---

## 避坑指南 (Pitfalls)
1. **不要搜尋舊檔案**: 當任務是執行預約時，**優先使用 `book.js` 直接操作**。不要花費時間在 `clawhub` (hermes-skills-hub) 或本地目錄中搜尋過往的 log 或截圖檔案，除非預約本身失敗需要調試。
2. **Shop ID 優先級**: 優先查閱 `references/` 或記憶中的 Shop ID，不要每次都重新搜尋分店，以實現「最快路徑優先」。
3. **低 RAM 穩定性**: 在 2GB RAM 環境下，避免同時開啟多個瀏覽器分頁。

**參數說明：**
- `SHOP_ID`: 分店 ID (例如土城金城店為 90510)。
- `日期`: 該月的日期數字 (例如 7)。
- `時間`: 格式為 `HH_MM` (例如 `18_30`, `11_00`)。
- `人數`: 數字 (例如 2)。

**環境變數：**
腳本會自動從環境中讀取 `E_PAI_KE_EMAIL` 與 `E_PAI_KE_PASSWORD`。

---

## 取消預約 (Cancellation)
**重要原則**：除非使用者明確要求「取消所有」，否則應優先使用參數化腳本指定日期取消，避免誤刪其他行程。

使用 `scripts/cancel.js` 時，建議傳入多個關鍵字以精確匹配（例如月份與日期）：
```bash
node ~/.hermes/skills/kura-booking/scripts/cancel.js "05月" "07"
```

---

## 關鍵技術細節 (Lessons Learned)
0. **重複預約限制**: **同一帳號在同一家分店只能擁有一筆有效的預約**。
    - **快速判定**: 在分店頁面（`shop/[ID]`）右側側邊欄，若已存在預約，原本綠色的「預約」按鈕會消失，取而代之的是灰色文字「**已完成候位**」。
    - **詳情提取**: 若偵測到重複，應嘗試從側邊欄抓取現有預約的時間/人數，告知使用者具體資訊而非僅顯示錯誤。
2. **兩階段取消確認**: 點擊 `cancelBtn` 後，系統會彈出一個 Modal。必須點擊綠色的「確認取消」按鈕（其 ID 通常為 `#delOK`，類別為 `.btn.link-btn`）才能真正完成取消。
3. **店鋪記憶化**: 在 `scripts/book.js` 中維護一個 `FAVORITE_SHOPS` 對照表（店名 -> ID），可提升預約效率並降低使用者記憶負擔。
4. **UI 元素拆分**: E排客的 UI 常將日期拆分為不同元素（如 `05月` 與 `07` 分開）。在進行 DOM 搜尋或取消匹配時，應使用「多關鍵字同時存在」的判定邏輯，而非單一字串匹配。
3. **Vision 輔助除錯**: 若腳本找不到按鈕，應使用 `vision_analyze` 觀察截圖，確認元素是否被拆分、是否在不同分頁（如「即將用餐」vs「已取消」）、或是否出現了驗證碼/警告彈窗。
4. **延遲載入機制**: 開啟預約彈窗後，**必須等待約 10 秒**再點擊日期選擇器 (`#reserve_date`)。

## 錯誤偵測
- **日期不可選**: 檢查日曆 `<a>` 標籤是否帶有 `dateNo` 類別且點擊後無反應。
- **時段缺失**: 若點擊日期後 10 秒內 `#future_reserve_button` 仍為空，代表該日已完全額滿。
- **重複預約**: 系統會提示「每個帳號每次僅能預約一筆」，需先取消舊預約。腳本應檢查是否出現 `alert` 或特定錯誤文字。
