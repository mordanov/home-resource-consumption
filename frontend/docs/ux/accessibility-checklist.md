# Accessibility Checklist

> **Standard**: WCAG 2.1 Level AA baseline  
> **Scope**: All seven protected routes + two public auth routes  
> **Stack**: React 18, HeroUI (NextUI), Recharts

---

## Table of Contents

1. [Global Requirements (all routes)](#1-global-requirements-all-routes)
2. [/login — Login Page](#2-login--login-page)
3. [/register — Register Page](#3-register--register-page)
4. [/ — Dashboard (Home)](#4---dashboard-home)
5. [/upload — Upload Page](#5-upload--upload-page)
6. [/bills — Bills History Page](#6-bills--bills-history-page)
7. [/predictions — Predictions Page](#7-predictions--predictions-page)
8. [/analysis — Analysis Page](#8-analysis--analysis-page)
9. [Export Modal (shared)](#9-export-modal-shared)
10. [Color Contrast Targets](#10-color-contrast-targets)

---

## 1. Global Requirements (all routes)

### Keyboard Operability

- [ ] All interactive controls are reachable via Tab.
- [ ] Tab order follows reading order (top-to-bottom, left-to-right).
- [ ] No keyboard trap (focus cannot become stuck in a component); exception: intentional modal focus trap with Escape to dismiss.
- [ ] Skip-to-content link as the first focusable element on every page: `<a href="#main-content" class="sr-only focus:not-sr-only">Skip to main content</a>`.
- [ ] Main content area has `id="main-content"` and `tabindex="-1"` (so skip link focus lands correctly).

### Focus Indicators

- [ ] Visible focus ring on every interactive element when focused via keyboard.
- [ ] Focus ring specification: `outline: 2px solid var(--heroui-primary)` (or equivalent), `outline-offset: 2px`. Never `outline: none` without a visible replacement.
- [ ] HeroUI default focus styles must not be suppressed by global CSS resets.

### Semantic HTML

- [ ] Page uses landmark roles: `<header>` (nav), `<main>`, `<footer>` where applicable.
- [ ] Headings follow a logical hierarchy: one `<h1>` per page, subheadings as `<h2>` / `<h3>`.
- [ ] Lists use `<ul>` / `<ol>` / `<li>` not `<div>` chains.
- [ ] Buttons use `<button>` (not `<div onClick>`); links use `<a href>` (not `<button>`).

### Color Independence

- [ ] No information is conveyed by color alone. Every color-coded state also has a label, icon, or pattern.
- [ ] Trend indicators use an arrow glyph + text label (e.g., "↑ +12%" not just a green value).
- [ ] Error states use an icon (⚠ or ✗) in addition to red color.

### Images and Icons

- [ ] Decorative images: `alt=""` (empty string).
- [ ] Informative icons: accompanied by visible or `aria-label` text.
- [ ] SVG icons: `aria-hidden="true"` when next to a visible label; `role="img"` + `aria-label` when standalone.

### Forms (global)

- [ ] Every input has a `<label>` (visible or `aria-label`/`aria-labelledby`).
- [ ] Error messages use `aria-describedby` linking input to its error element.
- [ ] Required fields: `aria-required="true"` (HeroUI `isRequired` prop) or `required` attribute.
- [ ] Error states: `aria-invalid="true"` on the input element when in error state (HeroUI `isInvalid` prop handles this).

---

## 2. `/login` — Login Page

### Tab Order

1. Skip-to-content link
2. Username input
3. Password input
4. "Sign in" button
5. "Register" link

### ARIA Requirements

- [ ] Page `<h1>`: "Sign in"
- [ ] Username `<Input>`: `label="Username"` (HeroUI renders visible label + links it via `htmlFor`/`id`).
- [ ] Password `<Input>`: `label="Password"` + `type="password"`.
- [ ] Error message for username field: `id="username-error"`, input has `aria-describedby="username-error"` + `aria-invalid="true"` when error visible.
- [ ] Error message for password field: `id="password-error"`, input has `aria-describedby="password-error"` + `aria-invalid="true"` when error visible.
- [ ] Submit button: `type="submit"` so Enter in any field submits the form.
- [ ] Loading state: `aria-busy="true"` on the form element during API call; spinner has `aria-label="Signing in"`.

### Non-color Indicators

- [ ] Field error: red border + error icon + error text (not red border alone).
- [ ] Loading: spinner visible, button label changes to "Signing in…" (not spinner alone).

---

## 3. `/register` — Register Page

### Tab Order

1. Skip-to-content link
2. Username input
3. Email input
4. Password input
5. Password strength indicator (non-interactive, skip with Tab)
6. Confirm Password input
7. "Create account" button
8. "Sign in" link

### ARIA Requirements

- [ ] Page `<h1>`: "Create account"
- [ ] Username `<Input>`: `label="Username"`, `isRequired`.
- [ ] Email `<Input>`: `label="Email"`, `type="email"`, `isRequired`.
- [ ] Password `<Input>`: `label="Password"`, `type="password"`, `isRequired`, `aria-describedby="password-strength password-error"`.
- [ ] Password strength indicator: `role="status"` (live region) + `aria-label="Password strength: <level>"`. The text content updates as user types.
- [ ] Confirm Password `<Input>`: `label="Confirm password"`, `type="password"`, `isRequired`, `aria-describedby="confirm-error"`.
- [ ] All error messages: linked via `aria-describedby`, fields have `aria-invalid="true"` when error is active.
- [ ] Submit button: `type="submit"`, loading state announces "Creating account" via aria-label change.

### Non-color Indicators

- [ ] Password strength uses BOTH color AND text label (Weak/Fair/Good/Strong).
- [ ] All field errors show icon + text, not just color change.

---

## 4. `/` — Dashboard (Home)

### Tab Order

1. Skip-to-content link
2. Navigation links (app title, Dashboard, Bills, Predictions, Analysis)
3. Username display (non-interactive)
4. Logout button
5. Summary cards (Electricity, Gas, Water) — each card's CTA if present
6. "Upload Bill" CTA button
7. Chart legend items (if interactive toggles)
8. Chart controls

### ARIA Requirements

- [ ] Navigation bar: `<nav aria-label="Main navigation">`.
- [ ] Active nav link: `aria-current="page"`.
- [ ] Summary cards: `role="region"` with `aria-label="Electricity summary"` etc., or each card is a `<section>`.
- [ ] Trend arrows: `aria-label="Trend: up 12%" or "Trend: down 5%"` — never just ↑ without a label.
- [ ] Dashboard chart: `role="img"` with `aria-label="Consumption over time chart — electricity, gas, and water over the last 12 months"` as a fallback for screen readers unable to interpret Recharts SVG.
- [ ] "Upload Bill" button: clear label, `type="button"`.

### Non-color Indicators

- [ ] Trend arrows always show ↑/↓ glyph + percentage text (e.g., "↑ 12% vs last month").
- [ ] Resource type icons (⚡🔥💧) accompany resource type labels in cards.

---

## 5. `/upload` — Upload Page

### Tab Order

1. Skip-to-content + nav
2. Page `<h1>`: "Upload a bill"
3. Resource type selector (`Select` or `RadioGroup`)
4. Drop zone (focusable `<div role="button">` or `<button>`)
5. File browse button (if separate from drop zone)
6. (After file accepted) "Remove file" (×) button
7. (After parse success) Preview card fields (non-interactive, Tab skips)
8. Discard button
9. Save bill button

### ARIA Requirements

- [ ] Drop zone element:
  - `role="button"` (or `<button>`) if clickable.
  - `aria-label="File upload zone — drag a PDF or image here, or press Enter to browse"`.
  - `aria-describedby="upload-instructions"` pointing to the helper text.
  - `aria-disabled="true"` during upload/parsing.
- [ ] File input (`<input type="file">`):
  - Hidden visually but accessible: `aria-label="Upload bill file"` or linked to a visible label.
  - Not `display:none` (use `opacity:0; position:absolute` to keep it accessible).
- [ ] Resource type selector: `aria-label="Resource type"`, `aria-required="true"`.
- [ ] Progress indicator during parsing:
  - `role="status"` (live region, polite).
  - Text content: "Uploading file…" then "Parsing bill with AI — this may take up to 15 seconds."
  - Screen reader reads the update without interrupting.
- [ ] Parse error: `role="alert"` on the error message element (assertive live region).
- [ ] Preview card: `role="region"` `aria-label="Parsed bill preview"`.
- [ ] Confirm/Discard buttons: `type="button"`, clear labels.
- [ ] Save bill loading: `aria-busy="true"` + spinner with `aria-label="Saving bill"`.

### Non-color Indicators

- [ ] File-rejected state: error icon (✗) + rejection reason text (not red border alone).
- [ ] Parse error state: error icon + error message + "Try again" button (not just red highlight).

### Drag-and-Drop Keyboard Equivalent

- [ ] Pressing Enter or Space on the focused drop zone opens the file picker.
- [ ] Drop zone keyboard behavior is identical to click behavior.
- [ ] Mouse drag-and-drop is an enhancement, not the only path.

---

## 6. `/bills` — Bills History Page

### Tab Order

1. Skip-to-content + nav
2. Page heading (non-interactive `<h1>`)
3. Resource type filter chips (each chip is a `<button>` or `role="button"`)
4. Date "From" picker
5. Date "To" picker
6. "Clear filters" button (when visible)
7. Table column sort headers (sortable columns are `<th>` with `<button>` inside or `role="columnheader" tabindex="0"`)
8. Table rows (Tab through rows or use arrow keys if implementing grid navigation)
9. Delete buttons per row
10. Pagination controls
11. (When modal open) Bill detail modal — focus trapped inside

### ARIA Requirements

- [ ] Filter chip group: `role="group"` `aria-label="Filter by resource type"`. Each chip: `role="button"` `aria-pressed="true|false"`.
- [ ] Date range section: `<fieldset>` `<legend>Date range</legend>` wrapping both pickers.
- [ ] Table:
  - `<table>` or `role="grid"`.
  - `<caption>` or `aria-label="Bills history"`.
  - Sortable columns: `aria-sort="ascending"` / `"descending"` / `"none"` on `<th>`.
  - Sort button inside `<th>`: `aria-label="Sort by Amount paid ascending"` (updated to reflect current direction).
- [ ] Delete button (per row): `aria-label="Delete bill from March 1, 2024"` (include bill date for screen readers).
- [ ] Confirmation popover: `role="dialog"` `aria-modal="true"` `aria-labelledby` pointing to confirmation heading. Focus moves into popover on open.
- [ ] Pagination: `<nav aria-label="Bills pagination">`. Current page: `aria-current="page"`.
- [ ] Bill detail modal: `role="dialog"` `aria-modal="true"` `aria-labelledby="modal-title"`. Focus trap + Escape to close.

### Non-color Indicators

- [ ] Resource type in table: icon (⚡🔥💧) + text label in each row (not icon alone).
- [ ] Sort direction: arrow glyph (↑↓) + updated `aria-sort` attribute.

---

## 7. `/predictions` — Predictions Page

### Tab Order

1. Skip-to-content + nav
2. Page heading
3. Horizon selector buttons (ButtonGroup)
4. Prediction cards (Tab order: Electricity → Gas → Water, then within each card any interactive elements)
5. "Upload a bill" link (inside Insufficient Data cards)
6. "Retry" button (inside error cards)

### ARIA Requirements

- [ ] Horizon selector `ButtonGroup`: `role="group"` `aria-label="Prediction horizon"`. Each button: `aria-pressed="true|false"`.
- [ ] Prediction card region: `role="region"` `aria-label="Electricity prediction"` etc.
- [ ] Confidence interval display:
  - The range bar must have `aria-label="Confidence range: 270 to 350 kWh"` (screen reader reads both numeric bounds).
  - Do NOT rely on the visual bar alone — announce the numeric values.
  - Text fallback: "Confidence range: 270 – 350 kWh" rendered as visible text alongside the bar.
- [ ] Insufficient data state:
  - `role="status"` or `role="region"` with `aria-label="Insufficient data for Gas prediction"`.
  - Message text clearly states how many more bills are needed (from API response).
- [ ] Loading state: `aria-busy="true"` on the card region; skeleton loader has `aria-hidden="true"` (decorative).
- [ ] Error state: `role="alert"` on error message. "Retry" button: `aria-label="Retry Gas prediction"` (not just "Retry" without context).

### Non-color Indicators

- [ ] Insufficient data: ⚠ icon + text message (not yellow border alone).
- [ ] Confidence range bar: numeric labels on both ends + text summary below.

---

## 8. `/analysis` — Analysis Page

### Tab Order

1. Skip-to-content + nav
2. Page heading
3. Global filter: Date "From" picker
4. Global filter: Date "To" picker
5. Resource type toggle chips
6. "Export Full Report" button
7. Charts (for each chart card):
   a. Chart title (non-interactive)
   b. PNG export icon button
   c. Legend items (if interactive toggles)
   d. Heatmap resource selector (Chart 6 only)

### ARIA Requirements

- [ ] Global filter bar: `role="search"` or `<section aria-label="Filter analysis data">`.
- [ ] Date range: `<fieldset>` `<legend>Date range</legend>`.
- [ ] Resource type toggle group: `role="group"` `aria-label="Filter by resource type"`. Chips: `aria-pressed`.
- [ ] Each chart card: `role="region"` `aria-labelledby` pointing to chart title heading.
- [ ] Chart canvas (Recharts SVG): wrap in a container with `role="img"` `aria-label="[Chart description including key data]"` as a screen-reader fallback. Example: `aria-label="Consumption over time — electricity 320 kWh, gas 18 m³, water 12 m³ for March 2024 (showing last 12 months)"`. This label should update when the filter changes.
- [ ] PNG export button: `aria-label="Export Consumption over time chart as PNG"` (unique per chart).
- [ ] Legend toggle items: `role="list"` container; each item `role="listitem"`. Interactive toggles: `role="button"` `aria-pressed="true|false"` `aria-label="Toggle Electricity series"`.
- [ ] Heatmap cells: if interactive (hover for tooltip), each cell should have `aria-label="March 2024: 320 kWh"`.
- [ ] Empty state per chart: `role="status"` with descriptive text.
- [ ] "Export Full Report" button: `aria-label="Export full report as PDF with current filters"`.

### Non-color Indicators

- [ ] Chart series: each resource uses a unique **color + line-dash combination** (electricity: solid, gas: dashed, water: dotted) AND a unique icon in the legend.
- [ ] Heatmap: intensity levels labeled with legend showing numeric ranges (not color scale alone).
- [ ] Empty chart state: icon + text (not just greyed-out area).

### Chart Keyboard Interaction

- [ ] PNG export button reachable by keyboard without entering the chart canvas.
- [ ] Legend toggles reachable and operable by keyboard (Enter/Space to toggle).
- [ ] Recharts tooltips: ensure tooltip content is announced by a live region when the chart is navigated by keyboard (or accept that chart data is conveyed via `aria-label` fallback and tooltip is mouse-only enhancement).

---

## 9. Export Modal (shared)

### Tab Order (inside modal — focus trapped)

1. Modal close button (×)
2. Date "From" picker
3. Date "To" picker
4. Electricity checkbox
5. Gas checkbox
6. Water checkbox
7. Cancel button
8. "Export PDF" button

### ARIA Requirements

- [ ] `role="dialog"` `aria-modal="true"` `aria-labelledby="export-modal-title"`.
- [ ] Focus moves to the first focusable element (or modal heading) when modal opens.
- [ ] Escape key closes the modal without submitting.
- [ ] Date range error (>24 months): `role="alert"` on the error message element so screen readers announce it immediately when it appears.
- [ ] "Export PDF" disabled state: `aria-disabled="true"` (not just visually grayed out) when validation error is present.
- [ ] Checkbox group: `role="group"` `aria-label="Resource types"`. Each checkbox: HeroUI `Checkbox` with visible label.
- [ ] Loading state: `aria-busy="true"` on the modal; spinner has `aria-label="Generating PDF report"`.
- [ ] On success: modal closes; success toast `role="status"` announced.
- [ ] Close button: `aria-label="Close export modal"`.

### Non-color Indicators

- [ ] Validation error: ⚠ icon + text message inline (not red highlight alone).
- [ ] Disabled "Export PDF" button: visually dimmed + `aria-disabled` + `title` or `aria-describedby` pointing to the reason.

---

## 10. Color Contrast Targets

All contrast ratios measured against WCAG 2.1 AA minimum (4.5:1 for normal text, 3:1 for large text and UI components).

### Text Contrast

| Context                          | Target   | Notes                                       |
|----------------------------------|----------|---------------------------------------------|
| Body text on white background    | ≥ 4.5:1  | HeroUI default foreground                   |
| Muted/helper text                | ≥ 4.5:1  | Do not use HeroUI's lowest-opacity gray if it fails |
| Card title text                  | ≥ 4.5:1  |                                             |
| Error messages                   | ≥ 4.5:1  | Red text on white must pass                 |
| Success messages                 | ≥ 4.5:1  | Green text on white must pass               |

### Chart Colors

Charts must use a palette where every series color meets 3:1 contrast against the chart background AND can be distinguished without relying on color alone (use dash styles or symbols).

Recommended accessible series palette (verify in implementation):

| Resource    | Color (suggestion) | Dash style  | Legend icon  |
|-------------|-------------------|-------------|--------------|
| Electricity | `#0070F3` (blue)  | Solid       | ⚡           |
| Gas         | `#F5A623` (amber) | Dashed      | 🔥 (or flame icon) |
| Water       | `#10B981` (teal)  | Dotted      | 💧 (or drop icon)  |

- Verify each color achieves ≥ 3:1 contrast against white chart background.
- If a color fails, darken it — do not lighten.

### Interactive Controls

| Component                        | Target   |
|----------------------------------|----------|
| Button text on button background | ≥ 4.5:1  |
| Input placeholder text           | ≥ 4.5:1  |
| Focus ring against background    | ≥ 3:1    |
| Disabled button text             | ≥ 4.5:1  (use opacity carefully — dimming can fail contrast) |

### Status Colors

| Status     | Color used in    | Text contrast check required? |
|------------|------------------|-------------------------------|
| Error      | Error messages, input borders | Yes — text on white ≥ 4.5:1 |
| Success    | Success toast, strength indicator | Yes — text on white ≥ 4.5:1 |
| Warning    | Insufficient-data card, strength indicator | Yes |
| Primary    | Buttons, active chips, links | Yes |

### Heatmap

- [ ] Heatmap color scale must include at least 4 distinct intensity levels.
- [ ] Each level labeled with a numeric range in the legend.
- [ ] Minimum contrast of each heatmap cell label (if text rendered on cell) against the cell background: ≥ 4.5:1.
- [ ] Empty/zero cells must be visually distinct from non-zero cells (use different fill, not just lighter shade that may fail contrast).
