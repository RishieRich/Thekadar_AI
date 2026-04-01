# Thekedar AI -- UI Enhancement Plan (Phase 2)

This file is the single source of truth for all UI changes needed to make Thekedar AI a clean, robust, contractor-friendly SaaS product. Every section below describes exactly what to change, where to change it, and why. An AI copilot or developer should be able to read this file top to bottom and implement each item directly.

**Target users:** Indian labour contractors (age 30-55), mostly using Android phones (360-412px screens), comfortable with WhatsApp-style apps, read Hinglish, may have poor eyesight or rough hands (large fingers).

**Current stack:** Single-file React app (`src/App.jsx` ~2150 lines), CSS in `src/app.css` (~1200 lines), Vite build.

---

## Table of Contents

1. [Login Screen](#1-login-screen)
2. [Sidebar Navigation (Desktop)](#2-sidebar-navigation-desktop)
3. [Bottom Navigation (Mobile)](#3-bottom-navigation-mobile)
4. [Page Header & Toolbar](#4-page-header--toolbar)
5. [Dashboard Screen](#5-dashboard-screen)
6. [Setup Screen (Sites & Workers)](#6-setup-screen-sites--workers)
7. [Attendance Screen](#7-attendance-screen)
8. [Payroll Screen](#8-payroll-screen)
9. [Invoice Screen](#9-invoice-screen)
10. [Chat Screen](#10-chat-screen)
11. [Global Components & Patterns](#11-global-components--patterns)
12. [Typography & Colors](#12-typography--colors)
13. [Animations & Micro-interactions](#13-animations--micro-interactions)
14. [Accessibility & Touch Targets](#14-accessibility--touch-targets)
15. [Performance & Loading States](#15-performance--loading-states)

---

## 1. Login Screen

**File:** `src/App.jsx` (LoginPage component, ~lines 348-451) and `src/app.css`

### Current State
- Two-column layout: left has marketing copy, right has PIN card
- On mobile, columns stack (PIN card on top, copy below)
- PIN inputs are 60x68px boxes, font 30px
- Error shown in a status pill with shake animation
- No branding icon, just "TK" text badge

### Changes Needed

#### 1.1 -- Add a real logo or strong brand mark
- Replace the plain "TK" text badge with an SVG icon (a hardhat or construction helmet silhouette in the green gradient). If SVG creation is not possible, use a larger, bolder "TK" with a subtle construction-themed background pattern (diagonal stripes) inside the badge circle
- Increase badge size from 54px to 72px on the login page specifically
- Add a subtle glow/shadow behind the badge: `box-shadow: 0 8px 32px rgba(0, 230, 118, 0.25)`

#### 1.2 -- Make PIN inputs bigger for thick fingers
- Increase PIN box size from 60x68px to 72x76px on mobile
- Increase font from 30px to 38px
- Add more gap between boxes: 16px instead of current spacing
- On very small screens (<360px), keep 60x68px but increase gap to 12px

#### 1.3 -- Add a language hint
- Below the subtitle "Ask the admin for your contractor PIN...", add a second line in Hindi (Roman script): "Apna 4-digit PIN dalein"
- Style: same as subtitle, slightly smaller (13px), color muted

#### 1.4 -- Improve error feedback
- When wrong PIN is entered, in addition to the shake animation:
  - Flash the PIN boxes border to red (#d45d50) for 1.5 seconds, then fade back
  - Show error message in both Hindi and English: "Galat PIN. Wrong PIN -- try again."
  - Add a subtle vibration using `navigator.vibrate(200)` if supported (mobile haptic feedback)

#### 1.5 -- Add "Forgot PIN?" helper text
- Below the status pill, add small muted text: "PIN yaad nahi? Apne admin se contact karein."
- This is not a link -- just informational text so the contractor knows what to do
- Style: 12px, muted color, margin-top 16px

#### 1.6 -- Remove marketing copy on mobile
- On screens < 760px, hide the entire `.login-copy` section completely (`display: none`)
- The contractor on mobile should see ONLY the PIN card centered on screen -- no scrolling needed
- This makes login a one-screen, zero-scroll experience on phone

#### 1.7 -- Auto-focus and keyboard behavior
- When the login page loads, auto-focus the first PIN box (already done, keep it)
- After wrong PIN + shake, auto-focus first box (already done, keep it)
- Add `enterkeyhint="done"` to the last PIN input for mobile keyboards

---

## 2. Sidebar Navigation (Desktop)

**File:** `src/App.jsx` (~lines 1986-2024) and `src/app.css`

### Current State
- 290px wide, sticky, full height
- Uses numbered icons ("01", "02", etc.) as nav icons
- Has a "Daily recommended flow" tip box
- Sign out button at bottom

### Changes Needed

#### 2.1 -- Replace number icons with meaningful symbols
- Replace "01", "02", etc. with Unicode/emoji symbols that contractors instantly recognize:
  - Dashboard: use a small grid/chart symbol or the text "DB" in a colored circle
  - Setup: gear/wrench symbol
  - Attendance: calendar/checkmark symbol
  - Payroll: rupee sign symbol
  - Invoice: document/receipt symbol
  - AI Chat: message bubble symbol
- Implementation: use simple SVG inline icons (16x16px) or styled spans with recognizable Unicode characters. Do NOT use an icon library -- keep it zero-dependency
- Each icon should be inside a 36x36px rounded square (border-radius 10px) with a light background matching the section color

#### 2.2 -- Show active tab with a stronger indicator
- Current: light green background on active
- Change to: solid left border (3px, accent-strong green) + light green background + slightly bolder text
- The left border acts as a clear "you are here" marker

#### 2.3 -- Add contractor name and business name to sidebar header
- Below the "TK" badge, show:
  - Business name (bold, 15px): e.g., "Rajesh Contractors"
  - Owner name (muted, 13px): e.g., "Rajesh Mehta"
- This is already available from the bootstrap API data
- Adds a personal touch and confirms "you are logged into the right account"

#### 2.4 -- Simplify the tip box
- The "Daily recommended flow" box is useful but wordy
- Shorten to just 3 short lines:
  - "1. Haziri lagao (Attendance)"
  - "2. Payroll check karo"
  - "3. Invoice download karo"
- Keep it in Hinglish since that is the user's language
- Reduce padding and font size slightly to save sidebar space

#### 2.5 -- Make sign out more visible
- Current sign out is a plain ghost button at the bottom
- Change to: red-tinted text ("Sign out" with a small exit/door icon), add a subtle top separator line
- Add confirmation: clicking sign out should show a small inline "Sure? Yes / No" instead of navigating immediately. Do NOT use window.confirm() -- use an inline toggle

---

## 3. Bottom Navigation (Mobile)

**File:** `src/App.jsx` (~lines 2090-2143) and `src/app.css`

### Current State
- Shows at < 960px, fixed bottom, 64px tall
- 4 main tabs: Dashboard (DB), Attendance (AT), Payroll (PY), Chat (AI)
- 5th tab "More" opens a slide-up sheet with Invoice, Setup, Sign out
- Icons are plain text ("DB", "AT", etc.)
- Labels are 10px uppercase

### Changes Needed

#### 3.1 -- Increase touch target size
- Each tab button minimum height: 56px (keep current), but ensure minimum width is 64px
- Add padding: 8px 4px for breathing room
- The "More" dots should be larger -- currently too small for finger taps

#### 3.2 -- Use recognizable mini-icons instead of text codes
- Replace "DB", "AT", "PY", "AI" text with small recognizable symbols:
  - Dashboard: 4-square grid
  - Haziri: checkmark in a circle
  - Payroll: rupee sign
  - Chat: speech bubble
  - More: three dots (already correct)
- Use styled `<span>` elements with simple CSS shapes or Unicode, no external icon libraries
- Icon size: 22px, with 4px gap to label below

#### 3.3 -- Add active tab indicator dot
- Below the active tab icon, show a small 6px solid green dot (border-radius 50%)
- This gives a clear visual marker beyond just color change
- Animate the dot appearing with a subtle scale-up (transform: scale(0) to scale(1), 200ms)

#### 3.4 -- Improve the "More" sheet
- Current sheet slides up with 3 buttons
- Add the contractor's business name at the top of the sheet as a header: "Rajesh Contractors"
- Group items with subtle separators:
  - Invoice (with document icon)
  - Setup (with gear icon)
  - Separator line
  - Sign out (with exit icon, red text)
- Add a visible "close" affordance: either a small "X" button in top-right or a drag handle bar (40px wide, 4px tall, rounded, centered at top)
- Tapping the backdrop should also close the sheet (already works, keep it)

#### 3.5 -- Safe area handling
- Add `padding-bottom: env(safe-area-inset-bottom)` to the bottom nav
- This prevents the nav from being hidden behind the gesture bar on newer iPhones and Android phones with gesture navigation
- Also add this padding to the "More" sheet

---

## 4. Page Header & Toolbar

**File:** `src/App.jsx` (~lines 2032-2073) and `src/app.css`

### Current State
- Eyebrow text ("Current month only"), large title (34px), subtitle
- Right side: month lock pill, site filter pills, reload button, help button
- On mobile, stacks vertically

### Changes Needed

#### 4.1 -- Reduce title size on mobile
- 34px is too large on a 375px screen -- it pushes content below the fold
- On mobile (<960px): reduce title to 24px, eyebrow to 10px, subtitle to 13px
- This saves ~40px of vertical space above the content

#### 4.2 -- Make site filter a dropdown on mobile
- The horizontal pill row works on desktop but overflows awkwardly on mobile
- On mobile (<960px): replace the pill row with a single dropdown `<select>`:
  - Shows: "All sites" or selected site name
  - Styled to match the app (green border on focus, 16px border-radius, full width)
  - Saves horizontal space and avoids horizontal scroll in the header area
- On desktop (>=960px): keep the pill row as-is

#### 4.3 -- Move month lock pill into the eyebrow area
- Currently the month lock pill sits in the toolbar area and takes up space
- Move it inline with the eyebrow text: "Current month only -- APRIL 2026"
- Style the month name in bold/accent color so it stands out
- This frees up toolbar space for the filter and action buttons

#### 4.4 -- Make help button more discoverable
- The "i" button with hover popover is invisible on mobile (no hover)
- On mobile: change to a tappable button that shows/hides the help text inline (toggle)
- When tapped, the help text slides down below the header with a subtle animation
- Second tap collapses it
- Add a small question mark icon instead of plain "i"

---

## 5. Dashboard Screen

**File:** `src/App.jsx` (~lines 863-974) and `src/app.css`

### Current State
- Hero panel with month info and action pills
- 4 metric cards (Workers, Gross, Net, Invoice)
- Site performance panel + Quick signals panel (2-column split)

### Changes Needed

#### 5.1 -- Simplify the hero panel
- The hero panel has too much text for a contractor who opens the app daily
- Reduce to: just the month name in large text + 3 key pills (workers count, present today, absent today)
- Remove the long explanatory subtitle -- the contractor already knows what the app does after day 1
- This saves ~80px vertical space on mobile

#### 5.2 -- Make metric cards more scannable
- Current cards show number + description text
- Change to:
  - Large number on top (keep monospace, 32px)
  - Short label below (e.g., "Gross Wages", "Net Payable")
  - Add a small trend indicator or icon to the left of the number
  - Use distinct subtle background tints per card:
    - Workers: light blue tint
    - Gross: light green tint
    - Net: light yellow tint
    - Invoice: light purple tint
- This helps the contractor's eye jump to the right card instantly

#### 5.3 -- Reorder cards for contractor priority
- Current order: Workers, Gross, Net, Invoice
- Change to: Present Today (most important daily), Net Payable, Gross Wages, Invoice Total
- "Present Today" is what the contractor checks first every morning -- make it card #1 with the biggest font

#### 5.4 -- Add a "Mark Today's Attendance" call-to-action
- Below the metric cards (or inside the hero panel), add a prominent button:
  - Text: "Aaj ki haziri lagao" (with arrow icon)
  - Style: full-width on mobile, primary green gradient, 52px height
  - Clicking it navigates to the Attendance tab
- This is the #1 daily action -- make it impossible to miss

#### 5.5 -- Collapse site performance on mobile
- The site performance panel takes a lot of vertical space on mobile
- On mobile: show it collapsed by default, with a "Show site details" toggle to expand
- Show only the site names with worker counts in collapsed view (one line per site)

#### 5.6 -- Add "Last updated" timestamp
- Show a small muted timestamp at the bottom of the dashboard: "Last synced: 2 min ago"
- This gives the contractor confidence that the data is fresh
- Update this on every successful API call

---

## 6. Setup Screen (Sites & Workers)

**File:** `src/App.jsx` (~lines 976-1562) and `src/app.css`

### Current State
- Company profile form (16 fields in 2-column grid)
- Sites section (add/edit form + list)
- Workers section (quick add card + single worker form + search + table)
- Bulk import section (CSV upload)

### Changes Needed

#### 6.1 -- Group company form into collapsible sections
- 16 fields at once is overwhelming for a contractor
- Split into 3 collapsible sections:
  - **Business Info** (Business Name, Owner Name, Phone, Email, Address) -- open by default
  - **Registration Numbers** (GSTIN, CLRA, PF Registration, ESI Registration) -- collapsed by default
  - **Rate Settings** (Service Charge, GST, PF rates, ESI rates, PF cap, ESI threshold, OT multiplier) -- collapsed by default
- Each section has a header bar that toggles open/closed with a chevron arrow
- Contractor fills Business Info on day 1 and rarely touches the others
- This reduces visual noise by 60%

#### 6.2 -- Add inline validation to form fields
- Currently no validation is shown until form submission
- Add real-time validation:
  - Phone: show red border + "10 digit number chahiye" if not 10 digits
  - GSTIN: show red border if not 15 characters
  - Email: basic format check
  - Daily Wage: show warning if below 300 or above 2000 ("Rate check karo")
  - PF/ESI rates: show warning if they look unusual (e.g., PF > 15%)
- Show validation message directly below the field in 12px red text
- Green checkmark icon appears on valid fields (after user has typed and moved away)

#### 6.3 -- Improve the Quick Add card
- The quick add textarea for pasting names is powerful but not intuitive
- Add a clearer example placeholder:
  ```
  Example:
  Ramesh Kumar
  Sunil Yadav
  Amit Sharma
  ```
- Add a line count display: "3 names entered" below the textarea
- After pasting, immediately show a preview list below:
  - "Ramesh Kumar -- Fitter -- Rs 600 -- Tema India"
  - "Sunil Yadav -- Fitter -- Rs 600 -- Tema India"
- Let the contractor see and verify before hitting "Add"

#### 6.4 -- Make the workers table mobile-friendly
- Current table has min-width 920px and horizontal scrolls on mobile
- On mobile (<960px): switch from table view to card view
  - Each worker shown as a card:
    - Name (bold, 16px) + Role badge
    - Site name + Daily wage (monospace)
    - UAN / ESI numbers (small, muted)
    - Edit / Delete buttons (right-aligned)
  - Cards stacked vertically with 8px gap
- This eliminates horizontal scrolling entirely on mobile
- Keep the table view on desktop -- it works well there

#### 6.5 -- Add worker count summary
- At the top of the workers section, show: "12 workers (8 active, 4 inactive)"
- Show per-site breakdown: "Tema India: 5 | Sudhir Bros: 3 | Unassigned: 4"
- Helps contractor see the overview without scrolling through the table

#### 6.6 -- Improve delete confirmation
- Currently uses `window.confirm()` which looks ugly and generic
- Replace with an inline confirmation:
  - When delete is clicked, the row/card changes to red-tinted background
  - Shows: "Delete Ramesh Kumar? Haan / Nahi"
  - "Haan" button is red, "Nahi" is ghost
  - Auto-cancel after 5 seconds if no action taken
- Same pattern for site deletion

#### 6.7 -- Simplify CSV import
- Move the bulk import section into a collapsible area (collapsed by default)
- Label it: "CSV se workers load karo (advanced)"
- Most contractors will use Quick Add or manual entry -- CSV is for power users

---

## 7. Attendance Screen

**File:** `src/App.jsx` (~lines 1564-1718) and `src/app.css`

### Current State
- **Today Board:** Grid of worker cards with status buttons (P/A/HD/OT/WO)
- **Month Register:** Full calendar table with 31 columns, sticky header + first 2 columns
- Status colors: Green (P), Red (A), Orange (HD), Blue (OT), Gray (WO)
- Correction mode toggle for past dates

### Changes Needed

#### 7.1 -- Make Today Board the primary focus
- The Today Board is the #1 daily-use feature -- make it take up the full screen on mobile
- Move the Month Register to a separate tab/toggle within the Attendance screen:
  - Two toggle buttons at top: "Aaj ki haziri" (active) | "Poora mahina"
  - Default: "Aaj ki haziri" selected
  - This prevents the contractor from getting overwhelmed by the full month grid

#### 7.2 -- Increase status button size on Today Board
- Current status button: 96px min-width
- Change to: full card width button, 52px height, 18px font
- The entire card should feel like one big tap target
- Worker name and role at top, full-width status button at bottom
- Status should show both the code AND the Hindi label:
  - "P -- Haazir"
  - "A -- Chutti"
  - "HD -- Aadha din"
  - "OT -- Overtime"
  - "WO -- Weekly off"

#### 7.3 -- Add swipe gesture for status change
- In addition to tap-to-cycle, allow left/right swipe on Today Board cards:
  - Swipe right: mark Present (most common action)
  - Swipe left: mark Absent
  - This makes bulk attendance marking faster on mobile
- Show a subtle directional hint on first use: "Swipe right = Present"
- Implementation: use touch events (touchstart, touchmove, touchend) -- no library needed

#### 7.4 -- Add "Mark all Present" shortcut
- At the top of the Today Board, add a button: "Sabko present karo"
- This marks ALL workers as Present in one tap
- Show a confirmation: "15 workers ko present mark karein? Haan / Nahi"
- After confirming, the contractor can then change individual workers who are absent
- This saves 15+ taps daily since most workers are usually present

#### 7.5 -- Add attendance summary bar at top
- Above the Today Board cards, show a live summary bar:
  - "P: 12 | A: 2 | HD: 1 | OT: 0 | Remaining: 0"
  - Updates in real-time as the contractor marks attendance
  - Color-coded to match status colors
  - On mobile: make this a single-row horizontal scroll or compact 2-row layout

#### 7.6 -- Improve Month Register readability
- Current cells are 42x40px with a single letter -- hard to read on mobile
- Increase cell size to 48x44px
- Use color-filled cells with white text (instead of colored text on white)
- Today's column: add a thicker top border (3px green) as a clear "today" marker
- Add alternating row backgrounds (very subtle, every other row slightly darker) for easier tracking across 31 columns

#### 7.7 -- Add attendance auto-save indicator
- When the contractor taps a status, the API call happens silently
- Add a brief "Saved" toast/indicator:
  - Small green checkmark that appears near the card for 1.5 seconds, then fades
  - If save fails: show red "X" + "Save fail -- retry" with a retry button
- This gives the contractor confidence that their tap was registered

#### 7.8 -- Group workers by site
- On the Today Board, group workers under site headers:
  - "Tema India (5 workers)"
  - Worker cards for that site
  - "Sudhir Brothers (3 workers)"
  - Worker cards for that site
- This helps contractors who visit one site at a time -- they mark attendance site by site
- Add a collapse/expand toggle per site group

---

## 8. Payroll Screen

**File:** `src/App.jsx` (~lines 1720-1789) and `src/app.css`

### Current State
- Single table with 12 columns
- Sticky header, horizontal scroll on mobile
- Download Excel button
- Currency values in monospace font

### Changes Needed

#### 8.1 -- Switch to card view on mobile
- On mobile (<960px): show each worker's payroll as a card instead of a table row
- Card layout:
  ```
  +---------------------------------+
  | Ramesh Kumar         Fitter     |
  | Tema India           Rs 600/day |
  |---------------------------------|
  | Present: 22  |  Absent: 4      |
  | Half day: 1  |  OT: 2          |
  |---------------------------------|
  | Basic:    Rs 13,200             |
  | OT Pay:   Rs 300               |
  | Gross:    Rs 13,500             |
  | PF:       -Rs 1,800            |
  | ESI:      -Rs 101              |
  |---------------------------------|
  | NET:      Rs 11,599            |
  +---------------------------------+
  ```
- NET should be the most prominent number (bold, 20px, green)
- PF and ESI lines should be in red/danger color to show they are deductions
- Keep table view on desktop -- works fine there

#### 8.2 -- Add a totals summary at top
- Before the table/cards, show a summary panel:
  - Total workers: 15
  - Total gross: Rs 2,15,400
  - Total deductions: Rs 28,320
  - Total net payable: Rs 1,87,080
- Use the same metric card style as Dashboard
- Helps contractor see the big picture before diving into per-worker details

#### 8.3 -- Highlight workers with zero attendance
- Workers with 0 present days: show their row/card with a muted/grayed-out style
- Add a note: "Koi haziri nahi is mahine" below their name
- This helps identify inactive workers quickly

#### 8.4 -- Add search/filter
- Add a search bar at the top (same as Today Board) to filter workers by name
- Add a sort dropdown: Sort by Name / Net Pay (highest) / Net Pay (lowest) / Site
- Contractors often want to find one specific worker's payslip

#### 8.5 -- Improve Download Excel button
- Current: ghost button labeled "Download Excel"
- Change to: primary green button, wider, with a download icon
- Text: "Excel Download karo"
- After clicking, show a brief "Downloading..." state, then "Downloaded!" for 2 seconds
- Position: fixed at bottom of screen on mobile (like a sticky footer action bar) so it is always reachable without scrolling

---

## 9. Invoice Screen

**File:** `src/App.jsx` (~lines 1791-1873) and `src/app.css`

### Current State
- Two-column layout: left has line items, right has total + registrations + actions
- Download PDF and WhatsApp share buttons
- Shows: Gross, PF employer, ESI employer, Service charge, Sub-total, GST, Total

### Changes Needed

#### 9.1 -- Make invoice look like an actual invoice
- Restructure the layout to look like a printed invoice:
  - Top section: Company logo/name (left) + Invoice number/date (right)
  - "From" section: Contractor's business details
  - "To" section: Client name (from site filter or "All sites")
  - Line items table: Description, Amount -- with proper borders and alignment
  - Subtotal, GST, Grand Total -- right-aligned, bold
  - Footer: Registration numbers (GSTIN, PF, ESI, CLRA)
- White background card with slight shadow to give a "paper" feel
- This makes the invoice screen look professional and builds contractor confidence

#### 9.2 -- Add invoice number
- Auto-generate an invoice number: "INV-{YYYYMM}-{tenantShortCode}"
- Example: "INV-202604-RJC"
- Show prominently in top-right of the invoice card
- This is important for record-keeping

#### 9.3 -- Improve Download and Share buttons
- **Download PDF:** Primary green button, full-width on mobile, text: "PDF Download karo"
- **WhatsApp Share:** Green WhatsApp-branded button (WhatsApp green #25D366), text: "WhatsApp pe bhejo"
- Both buttons should be 52px height on mobile with large text (16px)
- Place them in a sticky footer bar on mobile so they are always visible
- After download: show "PDF ready!" confirmation for 2 seconds

#### 9.4 -- Show missing registration warnings
- If GSTIN is not set: show a yellow warning banner at the top: "GSTIN set nahi hai. Setup mein jaakar set karo."
- Same for PF Registration, ESI Registration
- Make the warning text tappable -- clicking it navigates to the Setup screen
- This prevents contractors from downloading incomplete invoices

#### 9.5 -- Stack layout on mobile
- On mobile, the 2-column layout wastes space
- Stack everything vertically:
  1. Invoice summary (line items)
  2. Grand total (big, prominent)
  3. Registration numbers
  4. Action buttons (sticky footer)

---

## 10. Chat Screen

**File:** `src/App.jsx` (~lines 1875-1967) and `src/app.css`

### Current State
- Two-column: left is chat interface, right is context info
- Chat history scrollable (max 420px height)
- Quick suggestion chips after assistant replies
- Textarea input (min-height 108px)
- Typing indicator with 3 dots

### Changes Needed

#### 10.1 -- Make chat full-screen on mobile
- On mobile (<960px): hide the right context panel completely
- Chat should take full screen width and full available height
- Chat history should fill the space between header and input (use flex-grow)
- Input area fixed at bottom of the chat area, above the bottom nav

#### 10.2 -- Reduce input area size
- Current textarea min-height 108px is too tall on mobile -- it eats into chat history
- Change to: single-line input (44px height) that grows as user types (up to 3 lines max)
- Add a round send button (44px circle) to the right of the input
- Layout: `[input field]  [send button]` -- inline, like WhatsApp

#### 10.3 -- Improve message bubbles
- Current messages are plain boxes
- Change to WhatsApp-style bubbles:
  - User messages: right-aligned, green background (rgba(0, 230, 118, 0.15)), rounded corners with right tail
  - Assistant messages: left-aligned, white background, rounded corners with left tail
  - Add small timestamp below each message (just time: "2:45 PM")
  - Max-width 85% of chat area to prevent full-width messages

#### 10.4 -- Better suggestion chips
- Current chips show 3 preset questions -- they are useful
- Make them more visible: add a subtle scroll animation or highlight glow on first appearance
- Add more contextual suggestions based on the current tab:
  - If coming from Attendance: "Aaj kitne log aaye?", "Sabki haziri bata"
  - If coming from Payroll: "Sabse zyada tankhwah kisko milegi?", "PF ka total batao"
  - If coming from Invoice: "Invoice total kitna hai?", "GST kitna laga?"
- Chips should wrap to 2 rows if needed, not overflow horizontally

#### 10.5 -- Add voice input button (future-ready placeholder)
- Next to the send button, add a microphone icon button
- On tap: show a tooltip "Coming soon -- jaldi aayega!"
- This plants the seed for voice-to-text in Phase 3 and signals the app is evolving
- Style: ghost button, muted gray, 44px circle

#### 10.6 -- Show connection status
- If the GROQ API key is not configured or the API is unreachable:
  - Show a red banner at top of chat: "AI chat abhi kaam nahi kar raha. Admin se bolo GROQ API key set kare."
  - Disable the input field and send button
- If connected: show a subtle green dot + "AI ready" text in the chat header area

#### 10.7 -- Scroll to bottom on new messages
- Auto-scroll to the latest message when a new assistant response arrives
- Add a "scroll to bottom" floating button if the user has scrolled up to read old messages
- The button shows a down-arrow icon and disappears when user scrolls to bottom

---

## 11. Global Components & Patterns

### 11.1 -- Replace all window.confirm() with inline confirmations
- Every delete, bulk action, and destructive operation currently uses browser `window.confirm()`
- Replace ALL of them with styled inline confirmation UI:
  - The element being acted on gets a colored overlay/background
  - Text: "[Action] -- Pakka? Haan / Nahi" (in Hinglish)
  - Haan = primary/danger style, Nahi = ghost style
  - Auto-dismiss after 8 seconds if no action
  - For mobile: make both buttons at least 44px height

### 11.2 -- Add toast notifications
- Create a simple toast notification system (no library needed):
  - Position: top-center on desktop, bottom-center on mobile (above bottom nav)
  - Types: success (green), error (red), info (blue), warning (yellow)
  - Auto-dismiss after 3 seconds
  - Show max 1 toast at a time (new one replaces old)
- Use toasts for:
  - "Worker added successfully" / "Worker jod diya"
  - "Attendance saved" / "Haziri save ho gayi"
  - "Settings updated" / "Settings update ho gaye"
  - "Download started" / "Download shuru ho gaya"
  - Error states: "Save fail -- retry karo"

### 11.3 -- Add empty state illustrations
- Current empty states are plain text with dashed borders
- Improve with:
  - A simple line illustration or large icon (construction helmet, clipboard, etc.) -- use Unicode or CSS shapes
  - Descriptive text in Hinglish
  - A call-to-action button
  - Examples:
    - No workers: "Koi worker nahi hai. Pehle Setup mein jaake workers add karo." + "Setup kholein" button
    - No attendance: "Aaj ki haziri abhi nahi lagayi. Shuru karo!" + "Haziri lagao" button
    - No chat history: "AI se kuch bhi pucho -- Hindi ya English mein!" + suggestion chips

### 11.4 -- Consistent loading states
- Replace the single global spinner with contextual loading:
  - Buttons: show a small spinner inside the button + disable it. Text changes to "Saving..." / "Loading..."
  - Tables: show skeleton rows (animated gray rectangles) while data loads
  - Cards: show skeleton cards
  - Chat: keep the typing dots (already good)
- Never show a blank screen while loading

### 11.5 -- Add pull-to-refresh on mobile
- On mobile, allow pull-to-refresh gesture on the main content area
- Triggers a data reload from the API
- Show a small refresh indicator at the top
- Implementation: use touchstart/touchmove/touchend events, detect downward pull > 60px

---

## 12. Typography & Colors

### 12.1 -- Increase base font size on mobile
- Current body font is inherited from DM Sans at default browser size (16px)
- On mobile (<960px): ensure minimum font size is 15px for body text, 13px for secondary text
- Input fields: minimum 16px font (prevents iOS zoom on focus)
- This is critical for readability on phone screens

### 12.2 -- Add Hindi/Devanagari font fallback
- Some contractors may see Devanagari text from the AI chat
- Add "Noto Sans Devanagari" as a fallback in the font stack:
  ```css
  font-family: "DM Sans", "Noto Sans Devanagari", sans-serif;
  ```
- Load via Google Fonts alongside existing fonts (add to index.html)

### 12.3 -- Improve color contrast for status indicators
- Current status colors against white/light backgrounds:
  - P (Green #00b85a): good contrast
  - A (Red #d45d50): good contrast
  - HD (Orange #d59b29): borderline -- darken to #b8860b for better contrast
  - OT (Blue #2d89d0): good contrast
  - WO (Gray): check contrast -- ensure it meets WCAG AA (4.5:1 ratio)
- All status text on colored backgrounds should be white (#fff) for readability

### 12.4 -- Use rupee symbol consistently
- Ensure all currency displays use the Rs or rupee symbol prefix
- Format: "Rs 1,42,500" (Indian comma format with space after Rs)
- Never show bare numbers for currency values
- Verify the `formatCurrency` function in `shared/payroll.js` handles this correctly

---

## 13. Animations & Micro-interactions

### 13.1 -- Add subtle page transitions
- When switching tabs, add a simple fade-in (opacity 0 to 1, 200ms ease)
- No slide animations -- they feel slow. Just a quick fade

### 13.2 -- Button press feedback
- On mobile, buttons should show a brief scale-down on press:
  ```css
  button:active { transform: scale(0.96); }
  ```
- This gives tactile feedback even before haptic vibration

### 13.3 -- Attendance status change animation
- When a status button changes (e.g., P to A):
  - Brief color cross-fade (200ms)
  - Subtle bounce (transform: scale(1.05) then scale(1), 300ms ease-out)
- This makes the tap feel responsive and confirms the change happened

### 13.4 -- Card hover states (desktop only)
- On desktop, cards should have a subtle lift on hover:
  ```css
  .card:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }
  ```
- Transition: 200ms ease
- Do NOT apply on touch devices (use `@media (hover: hover)`)

### 13.5 -- Skeleton loading animation
- For loading states, use a shimmer effect:
  - Background: linear gradient moving left to right
  - Gray base color with lighter shimmer passing through
  - Animation: 1.5s ease infinite

---

## 14. Accessibility & Touch Targets

### 14.1 -- Minimum touch target sizes
- Every interactive element (button, link, tab, attendance cell) must be at least 44x44px
- If the visual element is smaller (e.g., an icon), extend the clickable area with padding
- Apply to: attendance chips (currently 42x40px -- increase to 48x48px), nav tabs, action buttons

### 14.2 -- Focus ring visibility
- Current focus: 2px green outline, 4px offset -- good
- Ensure focus rings show on ALL interactive elements, not just buttons
- Check: dropdown selects, attendance chips, nav items, toggle buttons

### 14.3 -- Screen reader labels
- Add `aria-label` to all icon-only buttons:
  - Help button: `aria-label="Help"`
  - Reload button: `aria-label="Reload data"`
  - More menu: `aria-label="More options"`
  - Send chat: `aria-label="Send message"`
  - Delete worker: `aria-label="Delete worker"`
- Add `role="status"` to the attendance summary bar and toast notifications

### 14.4 -- Color-blind safe design
- Attendance statuses already use letters (P, A, HD, OT, WO) alongside colors -- good
- Ensure the status buttons on Today Board always show the letter code, not just color
- Consider adding subtle patterns to colored cells for full color-blind safety:
  - P: solid fill
  - A: diagonal stripes
  - HD: dots
  - OT: horizontal stripes
  - WO: crosshatch
- This is a nice-to-have but important for inclusive design

---

## 15. Performance & Loading States

### 15.1 -- Lazy load heavy screens
- The Setup screen with its forms, tables, and CSV import is heavy
- On initial load, only render the active tab's content
- Other tabs should be rendered on first visit, then kept in memory
- This reduces initial render time

### 15.2 -- Debounce search inputs
- Worker search on Setup and Today Board fires on every keystroke
- Add a 250ms debounce to prevent excessive filtering on slow phones
- Implementation: use a simple `setTimeout` / `clearTimeout` pattern

### 15.3 -- Optimize attendance grid rendering
- The month register renders up to 31 * N cells (where N = number of workers)
- For 72 demo workers, that is 2,232 cells
- Consider:
  - Virtualize rows: only render rows visible in the viewport (use IntersectionObserver)
  - OR: paginate the table (20 workers per page)
  - OR: at minimum, use `React.memo` on individual row components to prevent unnecessary re-renders

### 15.4 -- Add offline indicator
- When the network is unavailable (service worker mode):
  - Show a yellow banner: "Offline mode -- data may not be latest"
  - Disable API-dependent features (chat, save buttons)
  - Allow read-only viewing of cached data
- When network returns: auto-dismiss the banner + sync pending changes

---

## Implementation Priority

Implement these changes in this order for maximum impact:

### Batch 1 -- Critical UX (do first)
1. Section 7.1 -- Today Board as primary attendance view (daily use feature)
2. Section 7.4 -- "Mark all Present" shortcut (saves most time daily)
3. Section 7.2 -- Bigger status buttons with Hindi labels
4. Section 5.4 -- "Aaj ki haziri lagao" CTA on Dashboard
5. Section 11.1 -- Replace window.confirm() everywhere
6. Section 11.2 -- Toast notifications

### Batch 2 -- Mobile Polish (do second)
7. Section 1.6 -- Remove login copy on mobile
8. Section 3.2 -- Recognizable mobile nav icons
9. Section 3.3 -- Active tab indicator dot
10. Section 4.1 -- Reduce header title size on mobile
11. Section 4.2 -- Site filter dropdown on mobile
12. Section 8.1 -- Payroll card view on mobile
13. Section 10.1 -- Full-screen chat on mobile
14. Section 10.2 -- WhatsApp-style chat input
15. Section 3.5 -- Safe area handling for bottom nav

### Batch 3 -- Visual Quality (do third)
16. Section 12.1 -- Increase font sizes on mobile
17. Section 10.3 -- WhatsApp-style message bubbles
18. Section 5.2 -- Colored metric cards
19. Section 13.1 -- Page transition fade
20. Section 13.2 -- Button press feedback
21. Section 13.3 -- Attendance status animation
22. Section 7.7 -- Auto-save indicator
23. Section 14.1 -- Touch target sizes

### Batch 4 -- Professional Features (do fourth)
24. Section 6.1 -- Collapsible company form sections
25. Section 6.4 -- Workers card view on mobile
26. Section 6.6 -- Inline delete confirmations
27. Section 9.1 -- Professional invoice layout
28. Section 9.4 -- Missing registration warnings
29. Section 7.5 -- Live attendance summary bar
30. Section 7.8 -- Group workers by site

### Batch 5 -- Polish & Extras (do last)
31. Section 2.1 -- Sidebar nav icons
32. Section 2.3 -- Contractor name in sidebar
33. Section 10.4 -- Contextual chat suggestions
34. Section 11.3 -- Better empty states
35. Section 11.4 -- Skeleton loading states
36. Section 15.2 -- Debounce search
37. Section 12.2 -- Devanagari font fallback
38. Section 14.4 -- Color-blind safe patterns
39. Section 10.5 -- Voice input placeholder

---

## Files to Modify

| File | What changes |
|------|-------------|
| `src/App.jsx` | All component changes, new inline confirmations, toast system, layout restructuring |
| `src/app.css` | New styles for cards, bubbles, animations, mobile breakpoints, skeleton loaders |
| `index.html` | Add Noto Sans Devanagari font import |
| `public/manifest.json` | No changes needed |

---

## Rules for Implementation

1. **Do NOT create new component files.** All changes go in `src/App.jsx` and `src/app.css` as per the project rule (get it working first, refactor later).
2. **Do NOT add any npm packages.** All animations, toasts, skeletons, swipe gestures must be pure CSS and vanilla JS/React.
3. **Do NOT change any API endpoints or data structures.** This is a UI-only enhancement plan.
4. **Do NOT modify `server.mjs`, `groq.mjs`, `shared/payroll.js`, or `server/store.mjs`.** Backend is out of scope.
5. **Do NOT remove any existing functionality.** Only add, improve, or restructure.
6. **Test every change at 375px width** (iPhone SE) to ensure mobile usability.
7. **Keep all user-facing text in Hinglish** (Roman Hindi) for contractor friendliness.
8. **Preserve the existing green color scheme** -- accent (#00e676), accent-strong (#00b85a). Do not introduce new brand colors.
9. **Breakpoint is 960px** -- below this is mobile, above is desktop. Do not add new breakpoints unless specified in a section above.
