---
name: kura-booking
description: 使用 e-pai-ke.com (E排客) 進行餐廳預約管理、叫號查詢、登入及取消訂位。適用於藏壽司等使用 E排客 系統的餐廳。
---

# E-Pai-Ke (E排客) Skill

本 Skill 用於透過 Playwright 腳本自動化操作 E排客 (e-pai-ke.com) 進行各分店餐廳的預約、查詢及取消。

## [重要規範 (MUST READ)]
1. **單一預約限制**：同一帳號在同一家分店**絕對只能擁有一筆**有效預約。
    - **換日/更改預約流程**：若要更改同一分店的預約日期或時間，**必須先執行 `cancel.js` 取消現有預約**，否則系統會阻擋新預約。
    - **禁止盲目嘗試**：不要在未取消舊預約的情況下執行 `book.js`，這會觸發腳本內的重複判定邏輯並自動停止任務。

## 帳號資訊參考
- 登入資訊記載於 `.env` 檔案中的 `E_PAI_KE_EMAIL` 與 `E_PAI_KE_PASSWORD`。

## 操作流程 (Playwright 腳本)

本技能完全依賴 Playwright 腳本執行。**禁止使用標準瀏覽器工具 (browser_navigate 等) 手動操作**，因為該網站在內建工具下極不穩定且容易逾時。

### 1. 預約腳本 (`scripts/book.js`)
**使用方法：**
```bash
# 語法: node ~/.hermes/skills/kura-booking/scripts/book.js <店名或ID> <日期數字> <時間_格式> <人數>
# 範例: 預約 指定分店，15 號，12:30，2 位
node ~/.hermes/skills/kura-booking/scripts/book.js <SHOP_ID_OR_NAME> 15 12_30 2
```
- **參數說明**：
    - `店名或ID`: 支援腳本內建映射或直接輸入網址中的分店 ID（如 `90510`）。若店名不在映射中，請先透過搜尋獲取 ID。
    - `日期數字`: 僅輸入日期數字（如 `7`, `15`, `28`）。
    - `時間_格式`: 格式為 `HH_MM`（如 `18_30`），腳本會自動處理內部 ID 轉換。

### 2. 取消預約腳本 (`scripts/cancel.js`)
**使用方法：**
```bash
# 語法: node ~/.hermes/skills/kura-booking/scripts/cancel.js "<月份字串>" "<日期數字>"
# 範例: 取消 X月 Y號 的預約
node ~/.hermes/skills/kura-booking/scripts/cancel.js "06月" "15"
```
- **參數說明**：
    - 腳本會比對預約清單中包含這兩個片段的卡片並執行取消。

---

## 避坑指南 (Pitfalls)
1. **不要搜尋特定測試檔案**: 執行任務時，優先使用腳本直接操作。不要花時間搜尋過往對話中提到的特定日期截圖或 log 檔案。
2. **獲取 Shop ID**: 若不知道目標分店 ID，應先導航至 `https://e-pai-ke.com/search?keyword=店名` 獲取 URL 中的 ID 數字，再填入腳本。
3. **重複預約攔截**: 腳本內建「已完成候位」狀態偵測。若任務失敗並提示重複，應立即引導使用者（或自行呼叫腳本）進行取消。

## 關鍵技術細節 (Lessons Learned)
1. **延遲載入 (10s)**: 開啟預約彈窗後必須等待至少 10 秒，否則時段數據不會加載。
2. **時段 ID 格式**: 內部 ID 格式為 `#hour_HH_min_MM`。腳本已自動將輸入的 `18_30` 轉換為正確格式。
3. **取消確認**: 取消操作包含兩階段，必須點擊彈窗中的綠色確認按鈕 (`#delOK`)。
4. **UI 元素拆分**: 月份（如 `05月`）與日期（如 `07`）在 HTML 結構中通常是分離的，精確取消時需同時匹配兩者。
