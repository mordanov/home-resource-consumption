# Feature Specification: Home Resource Consumption Tracker

**Feature Branch**: `001-resource-consumption-tracker`
**Created**: 2026-06-05
**Status**: Draft
**Input**: User description: "Home Resource Consumption Tracker with Bill Parsing & ML Forecasting"

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Secure Account Access (Priority: P1)

A household member needs a private, password-protected account to keep their utility data confidential. They register once with a username and password, then log in on subsequent visits. Their session stays alive across browser refreshes and is safely ended when they log out.

**Why this priority**: Without authentication, no other feature can be safely scoped to a single household. Everything else builds on top of this.

**Independent Test**: Can be tested by completing registration, logging in, refreshing the page to confirm session persistence, and logging out to confirm session termination.

**Acceptance Scenarios**:

1. **Given** no account exists, **When** a user registers with a valid username, email, and password, **Then** an account is created and the user is directed to the dashboard.
2. **Given** an existing account, **When** the user logs in with correct credentials, **Then** they reach the dashboard and their session persists across browser refresh.
3. **Given** a logged-in session, **When** the user logs out, **Then** they are redirected to the login page and cannot access protected pages without logging in again.
4. **Given** an existing username or email, **When** a new registration uses that same username or email, **Then** registration is rejected with a clear conflict message.
5. **Given** a wrong password attempt, **When** the user submits incorrect credentials, **Then** access is denied without revealing whether the username or password was wrong.

---

### User Story 2 — Upload and Parse a Utility Bill (Priority: P1)

A household member uploads a PDF or photo of a utility bill (electricity, gas, or water). The system reads the bill automatically, extracts the consumption period, quantity used, and amount paid, then saves a structured record. The user can review the extracted values before confirming.

**Why this priority**: Ingesting bill data is the core value proposition; prediction and analysis are only possible once bills exist.

**Independent Test**: Can be tested by uploading a sample bill, reviewing the extracted fields in a preview, confirming the save, and verifying the record appears in the bill history.

**Acceptance Scenarios**:

1. **Given** a logged-in user, **When** they upload a valid electricity bill PDF and select resource type "Electricity", **Then** the system extracts period start/end, consumption amount, and amount paid, and displays them for review.
2. **Given** a parsed bill preview, **When** the user confirms the save, **Then** the bill is stored and visible in the bill history scoped to that user only.
3. **Given** an uploaded file whose content cannot be parsed, **When** extraction fails, **Then** the user receives a clear error explaining what went wrong and is prompted to try again or enter data manually.
4. **Given** a file exceeding the maximum upload size, **When** the user tries to upload it, **Then** the upload is rejected before processing with a message stating the size limit.
5. **Given** user A's bills exist, **When** user B queries bill history, **Then** user B sees only their own records — never user A's.

---

### User Story 3 — Browse and Manage Bill History (Priority: P2)

A household member wants to review all past bills, filter them by resource type or date range, and delete incorrect entries.

**Why this priority**: Bill history is the reference layer needed for trust-building and data correction before predictions are useful.

**Independent Test**: Can be tested by seeding several bills for different resource types and date ranges, then filtering, sorting, and soft-deleting a record.

**Acceptance Scenarios**:

1. **Given** multiple bills exist, **When** the user opens the bills page, **Then** bills are listed in reverse-chronological order with pagination.
2. **Given** the bill list, **When** the user filters by resource type "Gas", **Then** only gas bills are shown.
3. **Given** the bill list, **When** the user filters by a date range, **Then** only bills whose bill date falls within that range are shown.
4. **Given** a bill row, **When** the user clicks it, **Then** a detail view opens showing all extracted fields.
5. **Given** a bill the user wants to remove, **When** they delete it, **Then** the bill disappears from the list but the record is retained in the system for audit purposes.

---

### User Story 4 — View Consumption Forecasts (Priority: P2)

A household member wants to see predicted consumption and estimated cost for the next 1, 2, or 3 months for each resource type, so they can plan their household budget.

**Why this priority**: Forecasting is a differentiating feature, but requires a minimum data history to be meaningful.

**Independent Test**: Can be tested by seeding at least 3 historical bills per resource type and verifying a prediction response with consumption figure, cost estimate, and confidence range.

**Acceptance Scenarios**:

1. **Given** at least 3 bills for electricity, **When** the user requests a 1-month prediction for electricity, **Then** the system returns a predicted consumption figure, estimated cost, and a confidence interval.
2. **Given** fewer than 3 bills for a resource type, **When** the user requests a prediction for that type, **Then** the system explains how many more bills are needed before a prediction can be generated.
3. **Given** a prediction result, **When** the user changes the forecast horizon to 3 months, **Then** the system returns updated predictions for each of the 3 upcoming months.

---

### User Story 5 — Analyse Consumption Trends (Priority: P3)

A household member wants to understand their energy and water usage over time through visual charts: monthly trends, cost breakdowns, year-on-year comparisons, and a heatmap of usage intensity.

**Why this priority**: Analysis adds long-term insight but depends on a sufficient bill history already being in place.

**Independent Test**: Can be tested by seeding 12 months of bills and verifying that all six chart data sets are returned correctly aggregated.

**Acceptance Scenarios**:

1. **Given** bills spanning multiple months, **When** the user visits the analysis page, **Then** a multi-resource consumption line chart, a monthly cost stacked bar, and a price-per-unit trend chart are displayed.
2. **Given** bills spanning two calendar years, **When** the user views the year-on-year chart, **Then** the chart shows current-year vs previous-year totals per resource with a percentage change.
3. **Given** the analysis page, **When** the user changes the global date range filter, **Then** all charts update to reflect only bills within that range.
4. **Given** fewer than 2 data points for a chart, **When** the chart would render, **Then** a helpful empty-state message is shown instead of an empty or broken chart.

---

### User Story 6 — Export a Consumption Report as PDF (Priority: P3)

A household member wants to download a formatted PDF report summarising their consumption and predictions over a chosen date range, suitable for personal records or sharing with a landlord or energy adviser.

**Why this priority**: PDF export is a convenience feature for archiving and sharing; it depends on bills and predictions already existing.

**Independent Test**: Can be tested by generating a report with seeded bills across all three resource types and verifying the download is a valid, non-empty PDF file.

**Acceptance Scenarios**:

1. **Given** at least one bill exists, **When** the user requests a PDF report for a chosen date range, **Then** a PDF download starts containing a summary, per-resource consumption tables, and embedded trend charts.
2. **Given** a date range spanning more than 24 months, **When** the user requests an export, **Then** the request is rejected with a message explaining the maximum allowed window.
3. **Given** a resource type filter applied, **When** the user exports, **Then** the report contains data only for the selected resource types.

---

### Edge Cases

- What happens when a bill image is blurry or the text is not machine-readable?
- How does the system handle a bill with an ambiguous or partially missing billing period?
- What if the same bill is uploaded twice (duplicate detection)?
- How does the system behave when a user has bills for only one or two resource types?
- What happens when the forecast horizon is requested for a resource with exactly 3 bills (minimum threshold)?
- How does the system handle a PDF upload that is password-protected?
- What if the analytics endpoint is called when no bills exist at all?

---

## Requirements *(mandatory)*

### Functional Requirements

**Authentication & Access**

- **FR-001**: The system MUST allow new users to register with a unique username, email address, and password.
- **FR-002**: The system MUST validate that passwords meet a minimum strength policy (length, character variety) at registration time.
- **FR-003**: The system MUST allow registered users to log in and maintain a secure session.
- **FR-004**: The system MUST allow users to log out, terminating their active session.
- **FR-005**: The system MUST prevent access to all data-viewing and data-entry pages without an active authenticated session.
- **FR-006**: All stored bill, prediction, and usage data MUST be strictly scoped to the authenticated user — no user may access another user's records under any circumstance.

**Bill Management**

- **FR-007**: The system MUST accept uploaded utility bills in PDF and common image formats (JPEG, PNG).
- **FR-008**: The system MUST enforce a maximum file size for uploads.
- **FR-009**: The system MUST extract the following fields from each uploaded bill via automated text recognition and language processing: billing period start date, billing period end date, bill issue date, quantity of resource consumed (with unit), and total amount paid (with currency).
- **FR-010**: The system MUST display extracted bill data to the user for review before the record is permanently saved.
- **FR-011**: The system MUST persist confirmed bill records associated with the authenticated user.
- **FR-012**: The system MUST support the three resource types: electricity (billed monthly), gas (billed bi-monthly), and water (billed bi-monthly).
- **FR-013**: The system MUST provide a paginated, filterable list of all bills for the authenticated user, filterable by resource type and date range.
- **FR-014**: The system MUST allow users to view full detail for any individual bill.
- **FR-015**: The system MUST allow users to remove a bill from their history; removed records are retained internally for audit purposes and do not appear in queries.

**Forecasting**

- **FR-016**: The system MUST produce consumption and cost predictions for a user-selected resource type over a user-selected horizon of 1, 2, or 3 months.
- **FR-017**: Each prediction MUST include a central estimate and a confidence interval.
- **FR-018**: The system MUST require a minimum of 3 historical bills per resource type before generating a prediction; if the threshold is not met, it MUST return a message stating exactly how many additional bills are needed.
- **FR-019**: Prediction results MUST be stored for audit and reproducibility.

**Analysis**

- **FR-020**: The system MUST provide pre-aggregated data for the following analytical views: monthly consumption per resource, monthly cost per resource, price-per-unit trend per resource, year-on-year consumption comparison, cumulative cost for the current calendar year, and a monthly consumption intensity view.
- **FR-021**: All analytical data MUST be filterable by a date range and by resource type.
- **FR-022**: Each chart view MUST display a meaningful empty state when fewer than 2 data points exist.

**PDF Export**

- **FR-023**: The system MUST generate a downloadable PDF report containing a summary, per-resource consumption tables, embedded trend charts, and the latest predictions.
- **FR-024**: Users MUST be able to filter the report by resource type and date range before generating it.
- **FR-025**: The system MUST reject export requests spanning more than 24 months.

### Key Entities

- **User**: A registered household account. Owns all bills and predictions. Identified by username and email. Authenticated by password.
- **Bill**: A single utility invoice record. Belongs to one user and one resource type. Captures the billing period, quantity consumed, amount paid, and the source file. Supports soft deletion.
- **Prediction**: A forecast record for a specific resource type, horizon, and user. Captures the central estimate, confidence interval bounds, and the model version that produced it.
- **Session / Token**: Represents an active authenticated session. Short-lived access credentials are paired with a longer-lived, rotatable refresh credential stored server-side.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can complete registration, upload their first bill, and view the extracted data within 5 minutes of first visiting the application.
- **SC-002**: Bill upload and automated data extraction completes within 20 seconds for standard-quality PDF files under the size limit.
- **SC-003**: List, detail, and analysis pages load and display data within 1 second under normal single-user load.
- **SC-004**: Prediction results are returned within 3 seconds once the minimum bill threshold is met.
- **SC-005**: 95% of correctly formatted utility bills (clear text, standard layout) are parsed with all required fields extracted without manual correction.
- **SC-006**: A user can generate and download a PDF report covering all three resource types within 10 seconds.
- **SC-007**: No bill, prediction, or personal data belonging to one user is ever accessible to any other user — verified by explicit cross-user data-isolation tests.
- **SC-008**: The application remains fully functional after 30 consecutive days of operation without restart or manual intervention.

---

## Clarifications

### Session 2026-06-05

- Q: What scope of UX design deliverables should the Designer agent produce before frontend implementation begins? → A: Interaction state specs + accessibility checklist only (`component-behavior.md` + `accessibility-checklist.md`). Full wireframes and user-flow diagrams are deferred. The Designer agent must deliver interaction state guidance and accessibility requirements for all pages before frontend implementation of each page begins.

### UX Design Requirements (derived from clarification)

**FR-028**: The Designer agent MUST produce `docs/ux/component-behavior.md` covering interaction states for all interactive components (drag-and-drop upload zone, parsing progress, parsed-data preview and confirmation, bill table filters, prediction cards, chart controls, export modal) before the corresponding frontend page is implemented.

**FR-029**: The Designer agent MUST produce `docs/ux/accessibility-checklist.md` covering: keyboard operability for all interactive controls, visible focus indicators, screen-reader labels for form fields and chart controls, color contrast requirements for data visualisation and text, and non-color status indicators (trend arrows with labels, not color-only) for all seven pages before frontend implementation begins.

## Assumptions

- The application serves a single registered household per deployment — there is no concept of an organisation, team, or public user directory.
- Users upload scanned or photographed bills; the quality is sufficient for automated text extraction (clear focus, no heavy redactions).
- Duplicate bill detection (same period + resource type already on record) is a desirable guard but is not blocking for v1 — the user can manually delete duplicates.
- Mobile responsiveness is a "nice to have" for v1; the primary target is desktop browsers.
- The deployment environment has outbound internet access for language-model bill parsing (calls to an external AI service).
- All monetary values are in a single currency per deployment (configurable at setup); multi-currency display is out of scope for v1.
- SSO, OAuth, and social login are explicitly out of scope for v1.
- Real-time data push (WebSocket notifications) is out of scope for v1.
- CSV export is out of scope for v1; PDF is the only export format.
- The application is self-hosted; there is no SaaS multi-tenant infrastructure to consider.
- An admin panel or user management UI is out of scope for v1.
