# E-Pai-Ke CSS Selectors

## Authentication
- Email Input: `input[placeholder="電子郵件"]`
- Password Input: `input[placeholder="密碼"]`
- Login Button: `button:has-text("登入")`

## Branch Page
- Reservation Button: `a.bookbtn:has-text("預約")`
- Current Queue Number: `.shop_status_box .now_no`

## Booking Modal
- Date Input Trigger: `input#reserve_date`
- Calendar: `.ui-datepicker-calendar`
- Date Link (Ok): `a.dateOk`
- Disabled Date (Full): `td.ui-state-disabled`
- Time Slot ID: `#hour_HH_min_MM` (e.g. `#hour_18_min_30`)
- People Selection Container: `#optArea`
- People Dropdown Toggle: `.div-select`
- People Dropdown List Item: `li[data-sub="X"]` (e.g. `li[data-sub="2"]`)
- People Hidden Input: `input[name="shop_reserve_category_value_1"]`
- Confirm Button (All steps): `#orderOK`
- Final Submit Button: `button:has-text("確認預約")` or `button:has-text("確定")`
