---
name: taiwan-hospital-registration-cgmh
description: Automate doctor schedule checks and appointment booking at Chang Gung Memorial Hospital (CGMH) branches.
---

# Taiwan Hospital Registration (CGMH)

Automate checking doctor schedules and booking appointments across the Chang Gung Memorial Hospital (CGMH) network (Linkou, Taipei, Tucheng, Keelung, etc.).

## Trigger
- User asks for doctor availability or "掛號" (registration) at any Chang Gung branch.
- Checking for "額滿" (full) status or specific time slots (上午/下午/晚間).

## Workflow
1. **Starting Point**: Navigate to the central registration portal: `https://register.cgmh.org.tw/`.
2. **Hospital Selection**: Identify the target branch from the list. Common branch codes:
   - `V`: Tucheng Hospital (土城醫院)
   - `3`: Linkou Chang Gung (林口長庚)
   - `1`: Taipei Chang Gung (台北長庚)
   - `2`: Keelung Chang Gung (基隆長庚)
   - `5`: Taoyuan Chang Gung (桃園長庚)
3. **Department Search**:
   - Use the `textbox` to type the department name (e.g., \"耳鼻喉科\", \"內科\").
   - Click \"查詢\" to filter results.
4. **Schedule Analysis**:
   - Access the department week view (e.g., `/Department_WEEK/V/V3500A`).
   - Parse the schedule table. Status keywords:
     - `額滿`: Full.
     - `初診可掛`: Full for existing patients, but open for new patients.
     - `停診`: Canceled.
     - `超過掛號開放時間`: Registration closed for the current session.
5. **Progress Checking**:
   - Navigate to `https://register.cgmh.org.tw/Progress/{HospitalCode}`.
   - For Tucheng (V) ENT (耳鼻喉科), you often need to select "其它專科" (Other Specialties) in the first dropdown to find the department.
   - Use `browser_console` to select specialties and sessions if `browser_click` fails (see Technical Tips).

6. **Appointment Query/Cancellation**:
   - Navigate to `https://register.cgmh.org.tw/Query/{HospitalCode}`.
   - **Cross-Session Context**: Proactively use `session_search` to retrieve the user's Patient ID and Birthday if they aren't in the current history.
   - **Captcha handling**: Use `browser_vision` to read the verification code and `browser_type` it into the field.
7. **Report Generation**: Provide a concise table or list of available doctors, their codes, and sessions (Morning/Afternoon/Night), or current consultation progress.

## Technical Tips
- **Reliable Selectors**: If dropdowns or buttons don't respond, use `browser_console`:
  ```javascript
  const selects = document.querySelectorAll('select');
  // selects[1] is usually Dept, selects[2] is usually Session
  selects[1].value = "TargetValue"; 
  selects[1].dispatchEvent(new Event('change'));
  selects[2].value = "TargetValue";
  selects[2].dispatchEvent(new Event('change'));
  
  // Find button by text if selector fails
  const btn = Array.from(document.querySelectorAll('button, input[type="button"]'))
    .find(b => b.textContent.includes('送出查詢') || b.value.includes('送出查詢'));
  if (btn) btn.click();
  ```
- **Dynamic Progress Tracking**: Users often request status updates every few minutes when their number is approaching. Proactively mention the distance to their number (e.g., \"差 3 位\") and advice on travel/arrival time based on jumping speed.
- **Auto-Refresh Logic**: If requested multiple times, keep the browser tab open to the progress page to minimize reload time.

## Pitfalls
- **Bot Detection**: Avoid searching via Google/DuckDuckGo for deep links, as CGMH and search engines often trigger CAPTCHAs/blocks for the agent. Start from the root portal.
- **Dynamic IDs**: Interactive element IDs change frequently on this site; always refresh the snapshot before clicking or typing.
- **Age Restrictions**: Note that pediatric departments (兒童專科) are usually restricted to patients 17 and under.

## Verification
- Confirm the specific date and session (上午/下午/晚間) match the user's request.
- Ensure the "超過掛號開放時間" status is clearly communicated if the user is asking for a session that has already started.
