# Component Behavior Specification

> **Tech stack**: React 18 + HeroUI + Zustand + TanStack Query v5 + Recharts  
> **Design target**: Desktop-first (min 1280px), accessible, keyboard-operable  
> **HeroUI version**: assumed latest (v2.x, NextUI-based)

---

## Table of Contents

1. [Auth Pages — Login & Register](#1-auth-pages--login--register)
2. [Upload Page](#2-upload-page)
3. [Bills History Page](#3-bills-history-page)
4. [Predictions Page](#4-predictions-page)
5. [Analysis Page](#5-analysis-page)
6. [Export Modal (shared)](#6-export-modal-shared)
7. [Layout & Navigation](#7-layout--navigation)
8. [Shared Patterns — Toasts, Modals, Empty States](#8-shared-patterns--toasts-modals-empty-states)

---

## 1. Auth Pages — Login & Register

### 1.1 Login Page (`/login`)

#### Layout

- Centered card (max-width: 400px) vertically and horizontally centered on the viewport.
- Card contains: App logo/title, page heading "Sign in", form fields, submit button, register link.
- No navigation bar — public route.

#### Form Fields

| Field    | HeroUI Component | Type     | Required | Autocomplete         |
|----------|-----------------|----------|----------|----------------------|
| Username | `Input`         | `text`   | Yes      | `username`           |
| Password | `Input`         | `password` | Yes   | `current-password`   |

#### Validation Timing

- **On submit only** — do not validate on blur or keystroke for login (avoids premature error noise).
- If a field is empty on submit: show inline error "This field is required" immediately below the input.
- Server error (401): show inline error below the password field: "Incorrect username or password."
- Server error (other): show toast (see §8.2).

#### Submit Button States

| State       | Label          | HeroUI props                    | Notes                         |
|-------------|----------------|---------------------------------|-------------------------------|
| Default     | "Sign in"      | `color="primary"`               |                               |
| Loading     | "Signing in…"  | `isLoading={true}` + spinner    | Disable both fields + button  |
| Error       | "Sign in"      | `color="primary"` (reset)       | Re-enable fields after error  |

#### Input States (HeroUI `Input`)

| State       | HeroUI props                                   |
|-------------|------------------------------------------------|
| Default     | none                                           |
| Focus       | Default HeroUI ring (do not suppress)          |
| Error       | `isInvalid={true}` + `errorMessage="<text>"`   |
| Disabled    | `isDisabled={true}` (during loading)           |

#### Redirect Behavior

- If user is already authenticated (Zustand `accessToken` is not null) and navigates to `/login`: redirect immediately to `/`.
- On successful login: redirect to `/`.

#### Register Link

- Rendered as `<Link>` below the submit button: "Don't have an account? Register"
- Navigates to `/register`.

---

### 1.2 Register Page (`/register`)

#### Layout

- Same centered card layout as Login (max-width: 440px — slightly wider for extra field).
- Fields: Username, Email, Password, Confirm Password.
- Password strength indicator below the Password field.
- Submit button, login link.

#### Form Fields

| Field            | HeroUI Component | Type       | Required | Autocomplete         |
|------------------|-----------------|------------|----------|----------------------|
| Username         | `Input`         | `text`     | Yes      | `username`           |
| Email            | `Input`         | `email`    | Yes      | `email`              |
| Password         | `Input`         | `password` | Yes      | `new-password`       |
| Confirm Password | `Input`         | `password` | Yes      | `new-password`       |

#### Validation Timing

- **Password field**: validate on blur AND on keystroke after first blur (progressive feedback).
- **Confirm Password field**: validate on blur and re-validate on every keystroke after first blur.
- **Username / Email**: validate on blur only.
- On submit: validate all fields before calling API.

#### Password Strength Indicator

- Positioned immediately below the Password input field, always visible while Password field has content.
- Four strength levels with both color AND text label (never color alone — accessibility requirement):

| Level    | Condition                                      | Color (HeroUI)   | Label text          |
|----------|------------------------------------------------|------------------|---------------------|
| Weak     | <8 chars                                       | `danger` (red)   | "Weak — too short"  |
| Fair     | ≥8 chars, 1 rule met                           | `warning` (amber)| "Fair"              |
| Good     | ≥8 chars, 2 rules met (upper + lower, or digit)| `primary` (blue) | "Good"              |
| Strong   | ≥8 chars, all 3 rules met (upper, lower, digit)| `success` (green)| "Strong"            |

- Render as a horizontal progress bar (HeroUI `Progress`) + label string.
- Rules checked: uppercase letter, lowercase letter, digit.
- `aria-label="Password strength: Strong"` on the progress element.

#### Confirm Password Validation

| State                            | Error message                              |
|----------------------------------|--------------------------------------------|
| Empty on submit                  | "Please confirm your password"             |
| Does not match Password field    | "Passwords do not match"                   |
| Matches Password field           | No error                                   |

#### Field-level Error Messages

| Field    | Condition              | Error message                                      |
|----------|------------------------|----------------------------------------------------|
| Username | Empty                  | "Username is required"                             |
| Username | Server conflict 409    | "This username is already taken"                   |
| Email    | Empty                  | "Email is required"                                |
| Email    | Invalid format         | "Enter a valid email address"                      |
| Email    | Server conflict 409    | "An account with this email already exists"        |
| Password | <8 chars               | "Password must be at least 8 characters"           |
| Password | Missing rule           | "Password must include uppercase, lowercase, and a number" |

#### Submit Button States

| State       | Label              | HeroUI props                    | Notes                         |
|-------------|--------------------|---------------------------------|-------------------------------|
| Default     | "Create account"   | `color="primary"`               |                               |
| Loading     | "Creating account…"| `isLoading={true}`              | Disable all fields + button   |
| Error       | "Create account"   | reset                           | Re-enable after server error  |

#### Post-Registration Behavior

- On success (201): redirect to `/login` with a success toast: "Account created — please sign in."
- Do NOT auto-login after registration. User must log in explicitly.

#### Login Link

- "Already have an account? Sign in" — navigates to `/login`.

---

## 2. Upload Page

### 2.1 Page Layout

- Two-column layout on desktop: left column = upload zone + resource selector, right column = parsed result preview (visible after parsing succeeds).
- Mobile / narrow: single column, preview appears below the upload zone.

### 2.2 Resource Type Selector

- HeroUI `Select` (dropdown) or `RadioGroup` with chip-style options.
- Options: Electricity, Gas, Water.
- Default: none selected (user must choose before upload is enabled).
- Positioned above the drop zone.
- ARIA: `aria-label="Resource type"`, each option labeled.
- If user attempts to drop/upload a file without selecting a resource type: show inline error "Please select a resource type before uploading."

### 2.3 Drag-and-Drop Zone

Implemented via a styled `<div>` with `role="region"` and `aria-label="File upload zone"`. Accepts PDF, JPEG, PNG (max 20 MB).

#### States

| State          | Visual                                                        | Behavior                                       |
|----------------|---------------------------------------------------------------|------------------------------------------------|
| **Idle**       | Dashed border, upload icon, label "Drag a PDF or image here, or click to browse" | Cursor: default. Click opens file picker.     |
| **Drag-over**  | Solid primary-color border, background tinted primary/10%, label "Drop to upload" | Cursor: copy.                                 |
| **File-accepted** | Solid success border, file name + size shown, "Remove" (×) button | File queued; upload begins automatically or waits for explicit trigger. |
| **File-rejected** | Solid danger border, error icon, rejection reason shown     | "Only PDF, JPEG, or PNG files are accepted" or "File exceeds 20 MB limit." |
| **Uploading / Parsing** | Loading spinner centered, label "Uploading…" then "Parsing bill with AI — this may take up to 15 seconds" | Zone is non-interactive (disabled). Cancel button available. |
| **Parse error** | Danger border, error message, "Try again" button            | Re-enables the zone for a new file. Toast also shown. |

#### Accepted File Types

- Accept attribute: `application/pdf,image/jpeg,image/png`
- Client-side rejection for wrong type or size >20 MB before any API call.

#### File-accepted display

```
┌─────────────────────────────────────────┐
│  📄 electricity-bill-march.pdf  1.2 MB  │  [× Remove]
└─────────────────────────────────────────┘
```

#### Upload initiation

- Upload starts automatically when a valid file is dropped or selected AND a resource type is already chosen.
- If resource type is not yet chosen: file is accepted/previewed but upload is blocked until resource type is selected.

### 2.4 Upload + Parsing Progress

#### Progress States

| Phase              | UI indicator                                          | Message                                               |
|--------------------|-------------------------------------------------------|-------------------------------------------------------|
| Uploading file     | HeroUI `Progress` (indeterminate) + spinner           | "Uploading file…"                                     |
| Parsing with LLM   | Spinner (persists) + progress bar removed             | "Parsing bill with AI — this may take up to 15 seconds" |
| Parse complete     | Progress hidden, preview card appears                 | —                                                     |
| Parse failed       | Error state with message from API (RFC 7807 `detail`) | "Parsing failed: <detail>. Please try a clearer scan or enter data manually." |

- Do not show percentage for indeterminate operations.
- The "15 seconds" estimate is a UX hint — do not use a countdown (unreliable).

### 2.5 Parsed-Data Preview Card

Appears in the right column (or below drop zone on narrow layouts) after a successful parse. The card shows the extracted fields before the user confirms saving.

#### Field Layout

```
┌──────────────────────────────────────────────────────┐
│  Parsed bill — please review before saving           │
├────────────────────┬─────────────────────────────────┤
│  Resource type     │  Electricity                    │
│  Bill date         │  2024-03-01                     │
│  Period            │  2024-02-01 → 2024-02-28        │
│  Consumed          │  320.5 kWh                      │
│  Amount paid       │  €89.74                         │
│  Currency          │  EUR                            │
├────────────────────┴─────────────────────────────────┤
│  [Discard]                           [Save bill]     │
└──────────────────────────────────────────────────────┘
```

#### Editable vs Read-only

- All fields are **read-only** in the preview (display-mode).
- No inline editing. If data is wrong, user clicks "Discard" and re-uploads a better scan.
- Rationale: inline editing of parsed data increases error surface and undermines the LLM workflow.

#### Confirm / Discard Button States

| Button   | State           | HeroUI props                    | Behavior                           |
|----------|-----------------|---------------------------------|------------------------------------|
| Discard  | Default         | `variant="flat"` `color="default"` | Clears preview, resets drop zone to Idle |
| Discard  | Loading (never) | —                               | Discard is instant (local only)    |
| Save bill | Default        | `color="primary"`               | POSTs to `/api/v1/bills/upload` confirm endpoint |
| Save bill | Loading        | `isLoading={true}`              | Disable both buttons               |
| Save bill | Error          | reset                           | Show toast with API error detail   |
| Save bill | Success        | —                               | Show success toast, navigate to `/bills` |

---

## 3. Bills History Page

### 3.1 Filter Bar

Positioned above the data table. Contains:

1. **Resource type filter chips** (HeroUI `Chip` group, multi-select):
   - "All", "Electricity", "Gas", "Water"
   - Default: "All" selected.
   - Applied state: chip uses `color="primary"` variant.
   - Cleared state: chip uses `variant="flat"` default color.
   - ARIA: `role="group"` on container, `aria-label="Filter by resource type"`, each chip has `aria-pressed`.

2. **Date range pickers**:
   - Two HeroUI `DatePicker` inputs: "From" and "To".
   - Default: empty (show all).
   - Invalid range (from > to): inline error "Start date must be before end date."
   - Applied state: inputs show the selected dates with a subtle primary underline or border.
   - "Clear filters" button (`variant="light"` `color="primary"`) appears only when any filter is active.

#### Filter Application Timing

- Changes to chips apply immediately (React Query re-fetch).
- Date pickers apply on blur or when user presses Enter/selects a date from picker.
- "Clear filters" resets all filters at once.

### 3.2 Data Table

HeroUI `Table` with sortable columns.

#### Columns

| Column         | Sortable | Default sort | Notes                            |
|----------------|----------|--------------|----------------------------------|
| Resource type  | No       | —            | Icon + label (Electricity/Gas/Water) |
| Bill date      | Yes      | Desc (newest first) | Date formatted: "Mar 1, 2024" |
| Period         | No       | —            | "Feb 1–28, 2024"                |
| Consumed       | Yes      | —            | "320.5 kWh" / "18.0 m³"        |
| Amount paid    | Yes      | —            | "€89.74"                         |
| Actions        | No       | —            | Delete icon button               |

#### Row Interaction

- Row is clickable (cursor: pointer, hover: row background tinted).
- Click anywhere on a row (except the Delete button) opens the Bill Detail Modal.
- Keyboard: Tab to row, Enter/Space opens modal.

#### Sorting

- Sortable column headers show a sort icon (↑↓ neutral, ↑ ascending, ↓ descending).
- Only one sort active at a time. Click same column to toggle direction; click different column to re-sort.
- `aria-sort="ascending"` / `"descending"` / `"none"` on column `<th>` elements.

#### Empty State

When no bills match the active filters:
- Centered in the table body area.
- Illustration (optional) + heading: "No bills found" + subtext: "Try adjusting your filters or upload a new bill."
- "Upload a bill" CTA button (links to `/upload`).

When no bills exist at all (first visit):
- Heading: "No bills yet" + "Upload your first bill to get started."
- CTA: "Upload a bill."

#### Pagination

- HeroUI `Pagination` at the bottom of the table.
- Default page size: 20 rows.
- Show: "Showing 1–20 of 47 bills."
- When fewer than 20 results, pagination is hidden.

#### Delete Button

- Trash icon button (`variant="light"` `color="danger"`) per row.
- Click opens an inline confirmation popover (NOT a full modal):
  ```
  "Delete this bill? This cannot be undone."  [Cancel] [Delete]
  ```
- On confirm: optimistic removal from table, POST to soft-delete endpoint, revert on error with toast.
- Keyboard: Tab to button, Enter activates, Escape closes popover.

### 3.3 Bill Detail Modal

Opens when a table row is clicked.

#### Modal Layout

```
┌────────────────────────────────────────────┐
│  Electricity Bill — March 1, 2024      [×] │
├────────────────────────────────────────────┤
│  Period:       Feb 1 – Feb 28, 2024        │
│  Consumed:     320.5 kWh                   │
│  Amount paid:  €89.74 (EUR)               │
│  Uploaded:     2024-03-05                  │
├────────────────────────────────────────────┤
│  [Delete bill]                  [Close]    │
└────────────────────────────────────────────┘
```

- HeroUI `Modal` with `size="md"`.
- `aria-labelledby` pointing to modal title.
- Focus trap inside modal while open.
- Escape key closes modal.
- Close button (`aria-label="Close bill details"`).

#### Delete from Modal

- "Delete bill" button (`color="danger"` `variant="flat"`).
- Click → confirmation step appears inside the modal body (replaces content):
  ```
  "Are you sure you want to delete this bill? This action cannot be undone."
  [Cancel] [Yes, delete]
  ```
- On confirm: close modal, remove row from table (optimistic), show success toast.
- On error: keep modal open, show error toast, re-enable delete button.

---

## 4. Predictions Page

### 4.1 Horizon Selector

- HeroUI `ButtonGroup` with 3 options: "1 month", "2 months", "3 months".
- Default: "1 month" selected.
- Selected state: `color="primary"` variant.
- Unselected: `variant="flat"` default color.
- Changing selection triggers a React Query re-fetch for all resource predictions with the new horizon.
- ARIA: `role="group"` with `aria-label="Prediction horizon"`, each button has `aria-pressed`.

### 4.2 Prediction Cards

Three cards displayed in a row (one per resource: Electricity, Gas, Water). Each card is independent — it can be in a different state.

#### Card States

| State             | Content                                                         | Notes                              |
|-------------------|-----------------------------------------------------------------|------------------------------------|
| **Loading**       | Skeleton loader (2 lines + bar placeholder)                     | Show while fetching prediction     |
| **Data available**| Predicted value, confidence range, chart                        | See §4.3                           |
| **Insufficient data** | Warning icon + explanation + guidance                       | See §4.4                           |
| **API error**     | Error icon + "Could not load prediction" + "Retry" button       | Call React Query `refetch()`       |

#### Card: Data Available

```
┌──────────────────────────────────────┐
│  ⚡ Electricity — 1 month            │
│                                      │
│  Predicted: 310 kWh                  │
│  Cost:      €86.80                   │
│                                      │
│  Confidence range:                   │
│  ── [270]────────●────────[350] ──   │
│       Low         Prediction   High  │
│                                      │
│  Model: linear-regression v1.0       │
└──────────────────────────────────────┘
```

- The confidence range is visualized as a horizontal range bar (not color-only — include numeric labels).
- "Low" / "High" labels bracket the bar.
- Model version shown in muted text at the bottom.

#### Card: Insufficient Data

```
┌──────────────────────────────────────┐
│  🔥 Gas — 1 month                    │
│                                      │
│  ⚠ Not enough data                  │
│                                      │
│  You need 3 gas bills to generate    │
│  predictions. You have 1.            │
│  Upload 2 more gas bills to unlock   │
│  this prediction.                    │
│                                      │
│  [Upload a bill]                     │
└──────────────────────────────────────┘
```

- `bills_needed` count comes from the API 409 response body.
- "Upload a bill" links to `/upload` with `?resource=gas` pre-filled.
- No chart or confidence range is shown in this state.

---

## 5. Analysis Page

### 5.1 Global Filter Bar

Sticky at the top of the page content area (below the main nav).

#### Controls

1. **Date range**: Two `DatePicker` inputs ("From", "To"). Default: last 12 months from today.
2. **Resource type toggle** (HeroUI `Chip` group):
   - Options: "All", "Electricity", "Gas", "Water".
   - Default: "All".
   - Single-select (showing one resource highlights that resource across all charts).
3. **"Export Full Report"** button (`variant="bordered"` `color="primary"`): opens the Export Modal (§6) pre-filled with current filter state.

#### Filter Application

- Changing date range: re-fetch analytics summary after blur/date-select.
- Changing resource toggle: immediately re-render charts (data already loaded, toggle is a display filter client-side unless the server needs it).

### 5.2 Charts

Six charts displayed in a responsive grid (2 columns on desktop ≥1280px, 1 column on narrow).

#### Chart Container Pattern

Each chart lives in a HeroUI `Card` with:
- Title at the top left (e.g., "Consumption over time").
- **PNG export icon button** (`📥` or download icon, `size="sm"` `variant="light"`) at top right.
  - `aria-label="Export chart as PNG"`.
  - Uses Recharts `ref` → `canvas.toBlob` to trigger download.
- Chart body (Recharts component).
- Empty state (see below) overlays the chart area when insufficient data.

#### Chart Definitions

| # | Title                     | Recharts type       | X-axis    | Y-axis / series                                 |
|---|---------------------------|---------------------|-----------|-------------------------------------------------|
| 1 | Consumption over time     | `LineChart`         | Month     | One `Line` per resource type (color + dash-style) |
| 2 | Monthly cost              | `BarChart` stacked  | Month     | One `Bar` per resource (color + pattern if needed) |
| 3 | Price per unit trend      | `LineChart`         | Month     | One `Line` per resource                          |
| 4 | Year-over-year comparison | `BarChart` grouped  | Resource  | Two `Bar`s: current year (solid), previous year (hatched/outline) |
| 5 | Cumulative cost YTD       | `AreaChart`         | Month     | Single `Area` for running total                  |
| 6 | Consumption heatmap       | Custom calendar grid | Month/cell| Color intensity = consumption level             |

#### Legend Behavior

- All charts with multiple series use a `<Legend>` component.
- Legend items are interactive: click to **toggle** that series visibility.
- Toggled-off state: series line/bar hidden; legend item shown with 50% opacity and strikethrough label.
- ARIA: `role="list"` on legend container, each item `role="listitem"` with `aria-pressed` to reflect visible/hidden state.

#### Heatmap (Chart 6) Resource Toggle

- Separate pill selector above the heatmap: "Electricity" | "Gas" | "Water".
- Default: Electricity.
- Switching changes which resource's data is displayed without refetching (all data is in the analytics summary payload).
- `aria-label="Heatmap resource type"`.

#### Chart Empty State

Displayed when fewer than 2 data points are available for a chart:

```
┌──────────────────────────────────────┐
│  Consumption over time               │  [📥]
│                                      │
│  (chart illustration)                │
│                                      │
│  Not enough data yet                 │
│  Upload more bills to see this chart │
│                                      │
│  [Upload a bill]                     │
└──────────────────────────────────────┘
```

- Empty state replaces chart canvas, keeps card title and export button (export button disabled with `aria-disabled="true"` in empty state).

#### PNG Export Behavior

1. User clicks the download icon.
2. Button shows a brief loading spinner (canvas rendering is synchronous but may take a tick).
3. Browser downloads `<chart-title>-<date>.png`.
4. On error (canvas not available): show toast "Export failed — please try again."

---

## 6. Export Modal (shared)

Used from Bills History page and Analysis page.

### 6.1 Modal Layout

```
┌──────────────────────────────────────────┐
│  Export PDF Report                   [×] │
├──────────────────────────────────────────┤
│  Date range                              │
│  From: [DatePicker]   To: [DatePicker]   │
│                                          │
│  Resource types                          │
│  [☑ Electricity] [☑ Gas] [☑ Water]      │
│                                          │
│  [Inline error area — see §6.2]          │
├──────────────────────────────────────────┤
│  [Cancel]                  [Export PDF]  │
└──────────────────────────────────────────┘
```

- HeroUI `Modal` `size="sm"`.
- Resource type: multi-select checkboxes (HeroUI `CheckboxGroup`), all checked by default.
- At least one resource must be selected; if all unchecked, "Export PDF" is disabled and inline error shows: "Select at least one resource type."

### 6.2 Date Range Validation (>24 months)

- Validated client-side before API call.
- Error is **inline** below the date pickers (not a toast): "Date range cannot exceed 24 months. Please narrow your selection."
- The error disappears as soon as the range is corrected.
- "Export PDF" button is disabled while the error is visible.

### 6.3 Export Button States

| State           | Label          | HeroUI props                    | Behavior                                          |
|-----------------|----------------|---------------------------------|---------------------------------------------------|
| Default         | "Export PDF"   | `color="primary"`               |                                                   |
| Loading         | "Generating…"  | `isLoading={true}`              | Disable Cancel; show spinner in button            |
| Success         | "Export PDF"   | —                               | Modal closes; browser triggers file download; toast: "Report downloaded." |
| Error (server)  | "Export PDF"   | reset                           | Modal stays open; toast: "Export failed — <detail>." |
| Error (400 range) | "Export PDF" | disabled until range fixed      | Inline error shown; button grayed out             |

### 6.4 Download Mechanism

- Backend returns `StreamingResponse` with `Content-Disposition: attachment`.
- Frontend uses a hidden `<a href="..." download>` element to trigger the native browser download.
- Filename: `report-<YYYY-MM-DD>.pdf` derived client-side from the generation date.

---

## 7. Layout & Navigation

### 7.1 Navbar

Present on all protected routes. Not shown on `/login` or `/register`.

#### Structure

```
┌─────────────────────────────────────────────────────────────┐
│ [🏠 Resource Tracker]  Dashboard  Bills  Predictions  Analysis │  [👤 username]  [Logout] │
└─────────────────────────────────────────────────────────────┘
```

- App name/logo: links to `/`.
- Nav links: Dashboard (`/`), Bills (`/bills`), Predictions (`/predictions`), Analysis (`/analysis`).
- Upload is accessible via the Dashboard CTA and the nav (optional secondary link or inside the Bills section).
- Active link: `color="primary"` or underline indicator.
- Username display: non-interactive, shows `user.username` from Zustand store.
- Logout button: `variant="flat"` `color="danger"`. On click: calls `POST /auth/logout`, clears Zustand store, redirects to `/login`.

#### Logout Loading State

- Logout button shows spinner briefly while the API call completes.
- Even if API call fails, clear local auth state and redirect. Do not block logout on server error.

### 7.2 ProtectedRoute

- Wraps all routes except `/login` and `/register`.
- If `accessToken` is null: renders `<Navigate to="/login" replace />`.
- Does not show a loading state — by the time the route renders, Zustand is already hydrated (in-memory).

---

## 8. Shared Patterns — Toasts, Modals, Empty States

### 8.1 Toast Notifications

- Rendered via HeroUI toast system (or a compatible notification library if HeroUI does not include toasts natively).
- Positioning: top-right corner.
- Auto-dismiss: 5 seconds for success, 8 seconds for error.
- Manual dismiss: × button on each toast.
- Maximum visible at once: 3. Queue additional.

#### Toast Types

| Type    | Color             | Icon             | When used                                  |
|---------|-------------------|------------------|--------------------------------------------|
| Success | `success` (green) | ✓ checkmark      | Save confirmed, logout successful, etc.    |
| Error   | `danger` (red)    | ✗ exclamation    | API failures, unexpected errors            |
| Info    | `primary` (blue)  | ℹ                | Informational messages (e.g., "Report downloaded") |

- Error toasts use the RFC 7807 `detail` field from the API response as the message body when available.
- Never expose stack traces or internal error codes in toasts.

### 8.2 Confirmation Dialogs

Two patterns — use based on context:

1. **Inline popover** (for table row delete): less disruptive, stays close to the action target.
2. **Modal confirmation** (for bill detail delete): full modal when already inside a modal context.

Both must include: clear consequence statement, Cancel button, Destructive confirm button (`color="danger"`).

### 8.3 Loading States

- **Skeleton loaders**: use for card content, table rows (3–5 skeleton rows).
- **Spinners**: use for button loading states and full-page transitions.
- **Page-level loading**: wrap page content in a React Suspense boundary or React Query `isLoading` check; show a centered spinner with `aria-label="Loading"`.
- **Error boundaries**: catch unexpected render errors; show: "Something went wrong. Refresh the page or contact support."

### 8.4 Session Expiry

- Axios interceptor catches 401, attempts silent token refresh.
- If refresh also returns 401 (refresh token expired): clear Zustand store and redirect to `/login` with toast: "Your session expired. Please sign in again."
- This toast must be rendered on the login page (pass via navigation state or a simple flag).
