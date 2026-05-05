---
name: kura-booking
description: 使用 e-pai-ke.com (E排客) 進行餐廳預約管理、叫號查詢、登入及取消訂位。適用於藏壽司等使用 E排客 系統的餐廳。
---

# E-Pai-Ke (E排客) Skill

本 Skill 用於透過 Playwright 腳本自動化操作 E排客 (e-pai-ke.com) 進行餐廳的預約、查詢及取消。

## [重要規範 (MUST READ)]
1. **單一預約限制**：同一帳號在同一家分店**絕對只能擁有一筆**有效預約。
    - **換日操作流程**：若要更改預約日期（例如從 5/7 改為 5/10），**必須先執行 `cancel.js` 取消現有預約**。
    - **禁止盲目嘗試**：不要在未取消舊預約的情況下嘗試執行 `book.js` 進行新日期的預約，這會觸發腳本內的重複判定邏輯並停止。

## 帳號資訊參考
- 登入資訊記載於 `.env` 檔案中的 `E_PAI_KE_EMAIL` 與 `E_PAI_KE_PASSWORD`。

## 操作流程 (Playwright 腳本)

本技能完全依賴 Playwright 腳本執行。**禁止使用標準瀏覽器工具 (browser_navigate 等) 手動操作**，因為該網站在內建工具下極不穩定且容易逾時。

### 1. 預約腳本 (`scripts/book.js`)
**使用方法：**
```bash
# 語法: node ~/.hermes/skills/kura-booking/scripts/book.js <店名或ID> <日期> <時間> <人數>
# 範例: 預約 土城金城店，7 號，18:30，2 位
node ~/.hermes/skills/kura-booking/scripts/book.js 土城金城店 7 18_30 2
```
- **參數說明**：
    - `店名或ID`: 支援映射（如「土城金城店」）或直接輸入 ID（如 `90510`）。
    - `日期`: 該月的日期數字（如 `7`）。
    - `時間`: 格式為 `HH_MM`（如 `18_30`），腳本會自動轉換為系統要求的格式。

### 2. 取消腳本 (`scripts/cancel.js`)
**使用方法：**
```bash
# 語法: node ~/.hermes/skills/kura-booking/scripts/cancel.js "<日期片段1>" "<日期片段2>"
# 範例: 精確取消 5月 7號 的預約
node ~/.hermes/skills/kura-booking/scripts/cancel.js "05月" "07"
```

---

## 避坑指南 (Pitfalls)
1. **放棄手動操作**: 不要嘗試使用 `browser_navigate` 或 `browser_click` 手動預約，系統會因背景數據載入緩慢而逾時。**一律使用腳本**。
2. **Shop ID 優先級**: 優先查閱 `references/` 或腳本內建的 `FAVORITE_SHOPS` 映射，避免重複搜尋。
3. **重複預約攔截**: 腳本會自動偵測「已完成候位」狀態。若看到此錯誤，代表你必須先執行取消腳本。

## 關鍵技術細節 (Lessons Learned)
1. **延遲載入 (10s)**: 開啟預約彈窗後必須等待 10 秒，否則日期/時段數據不會加載。此邏輯已內建於 `book.js`。
2. **時段 ID 格式**: 系統 ID 為 `#hour_HH_min_MM`。腳本已處理格式轉換。
3. **兩階段取消**: 取消必須點擊 `#delOK` 確認按鈕。此邏輯已內建於 `cancel.js`。
4. **UI 元素拆分**: 月份與日期在 DOM 中是分開的，取消時應使用多關鍵字匹配。

## 錯誤偵測
- **日期不可選**: 日曆標籤帶有 `dateNo` 類別即代表額滿。
- **時段缺失**: 若點擊日期後 10 秒仍無時段按鈕，代表該日已完全額滿。
