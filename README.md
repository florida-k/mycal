# MyCal — Canvas Calendar Power Tool

**Plan beyond the due date.** MyCal is a Chrome extension that enhances the Canvas Calendar with personal planning tools, helping students turn official course deadlines into actionable plans without modifying Canvas data.

Developed as part of the **University of Florida WiCSE Shadowing Program**, with mentorship from a software engineer at **American Express**.

> **Status:** Working prototype / active development (October 2026). Built and tested against UF's Canvas instance; not yet a published Chrome Web Store extension.

## Why MyCal?

Canvas Calendar is useful for seeing course assignments and their due dates, but a due date alone doesn't tell students **how important an assignment is, how long it might take, or when they want to work on it**.

MyCal adds a personal planning layer directly to the existing Canvas Calendar. **Canvas remains the source of truth** for courses, assignments, and official deadlines; **MyCal owns** student-defined planning metadata and personal tasks.

## Features

### Assignment planning
- **Priority levels:** Mark Canvas assignments as Low, Medium, or High priority, with visual indicators in the calendar.
- **Estimated effort:** Plan time in minutes or hours for individual assignments.
- **Notes:** Record study plans or other assignment-specific details.
- **Inline editor:** Open an assignment's MyCal editor from its calendar entry.
- **Workload summary:** Review upcoming assignments, priorities, and estimated workload for the next seven days.

### Personal organization
- **Personal tasks:** Create, edit, complete, and delete to-dos, with optional due dates, priority, and time estimates.
- **Calendar controls:** Compact calendar selection and controls for showing previously unchecked calendars.
- **Appearance themes:** Choose among Forest, Ocean, Lavender, Rose, and Amber accent colors; preferences are saved locally.

### Desktop reminders
- **Per-assignment reminders:** Choose 9 AM on the due date, 9 AM the day before, one hour before, or a custom date and time.
- **Demo mode:** Schedule a test notification for approximately one minute later.
- **Chrome notifications:** Use Chrome alarms to schedule notifications and open the corresponding Canvas assignment when a notification is clicked.

Reminders currently use **Chrome extension local storage**, not the Spring Boot database. Chrome must be running for dependable notification delivery, and system notification permissions must allow Chrome alerts. Changes to an instructor's due date do not yet automatically reschedule an existing reminder.

## Tech stack

| Layer | Technologies |
| --- | --- |
| Extension | JavaScript, HTML, CSS, Chrome Extension Manifest V3 |
| Canvas integration | Canvas REST API, existing authenticated Canvas session |
| Extension APIs | `chrome.storage.local`, `chrome.alarms`, `chrome.notifications` |
| Backend | Java, Spring Boot, Spring Data JPA |
| Database | PostgreSQL |
| Development | Git, GitHub, VS Code |

## Architecture

```text
Canvas Calendar (UF Canvas)
         |
         | Canvas REST API (authenticated browser session)
         v
Chrome extension — content scripts
  |  Calendar enhancements, editor, tasks, themes
  |  Local preferences and reminders --> chrome.storage.local
  |
  +--> background.js (Manifest V3 service worker)
          |  Assignment metadata GET / PUT
          v
      Spring Boot API (localhost:8080)
          |
          v
      PostgreSQL

background.js --> Chrome alarms --> desktop notifications
```

**Assignment identity:** MyCal associates metadata and reminders using the **Canvas course ID + assignment ID**, rather than assignment titles. This avoids collisions when different courses or assignments share similar names.

The extension currently uses a local backend for assignment metadata and falls back to Chrome storage when the backend is unavailable. Personal tasks, themes, and reminders are currently local-first.

## Repository layout

The repository is currently organized around the Chrome extension files at the root and a separate Spring Boot directory:

```text
canvas-calendar/
├── manifest.json              # Chrome extension configuration
├── content.js                 # Canvas API integration and assignment editor
├── background.js              # Backend bridge and reminder scheduling
├── mycal-sidebar.js           # Calendar/sidebar enhancements
├── mycal-sidebar.css
├── mycal-editor.css
├── mycal-tasks.js              # Personal task list
├── mycal-tasks.css
├── mycal-theme.js              # Accent theme preferences
├── mycal-theme.css
├── mycal-reminders.css         # Reminder editor styling
├── popup.html
├── popup.js
├── icons/
│   └── icon128.png
└── backend/                   # Spring Boot application
```

A dedicated `extension/` directory and further modularization are planned; the structure above reflects the current prototype.

## Getting started

### Prerequisites

- Google Chrome with access to the UF Canvas instance
- A UF Canvas account with an active authenticated session
- For backend persistence: Java, a compatible JDK for the Spring Boot project, Maven (or the project's Maven wrapper), and PostgreSQL

### Run the Chrome extension

1. Clone the repository:

   ```bash
   git clone https://github.com/florida-k/mycal.git
   cd mycal
   ```

2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose the directory containing `manifest.json` (currently the repository root).
5. Open **https://ufl.instructure.com/calendar** while signed into Canvas.
6. Click a MyCal pencil/edit control on a calendar assignment to open its planner.

> **Note:** The current manifest targets `https://ufl.instructure.com/*`. Supporting other Canvas institutions requires updating the matching host configuration and validating the integration against their Canvas environments.

### Run the backend (optional for local-first features)

The Spring Boot backend handles assignment planning metadata. Local tasks, themes, and Chrome reminders can be explored without the backend running.

1. Configure a local PostgreSQL database (the development database has been named `canvas_calendar`).
2. Configure database connection credentials using the Spring Boot project's existing application configuration or environment variables.
3. Start the backend from `backend/` using the project's Maven setup.
4. Verify `http://localhost:8080/api/health` responds.

The extension's background service worker sends assignment metadata requests to:

```text
GET /api/assignments/{courseId}/{assignmentId}
PUT /api/assignments/{courseId}/{assignmentId}
```

**Do not commit database passwords or local secrets.** Backend configuration details may vary by development machine.

### Test desktop reminders

1. Ensure Chrome notifications are permitted in your operating system's notification settings.
2. Open a Canvas assignment's MyCal editor and enable its reminder.
3. Choose **Test in 1 minute**, enter an estimated effort if required by the current editor, and save.
4. Keep Chrome running and wait for the notification.
5. Click the notification to open the assignment in Canvas.

The extension must include the icon at `icons/icon128.png`; a missing or invalid icon can cause Chrome notification creation to fail.

## Development journey

- **Kickoff and planning (September 2026):** Identified the gap between Canvas due dates and students' personal planning needs; defined the initial extension-first scope and longer-term architecture.
- **Canvas integration:** Retrieved active courses and assignments through the Canvas API and associated calendar events with their Canvas identifiers.
- **Assignment planning MVP:** Added priority, effort estimates, notes, calendar indicators, and workload summaries.
- **Midterm milestone (October 2026):** Demonstrated the extension and its connection to a Spring Boot/PostgreSQL metadata service, including saving and retrieving assignment plans.
- **Post-midterm iteration:** Added a personal task list, customizable accent themes, and individual desktop assignment reminders.

## Roadmap

- [x] Canvas course and assignment retrieval
- [x] Assignment priority, estimated time, and notes
- [x] Calendar indicators and seven-day workload summary
- [x] Spring Boot assignment metadata GET/PUT integration
- [x] Personal tasks with local persistence
- [x] Accent theme customization
- [x] Individual Chrome desktop reminders
- [ ] Persist personal tasks and reminder preferences in the backend
- [ ] Introduce a user-aware data model and authentication
- [ ] Automatically reconcile reminders when Canvas due dates change
- [ ] Expand task organization with status, subtasks, or categories
- [ ] Improve tests, error handling, and cross-environment support
- [ ] Refactor extension source into clearer modules/directories

## Scope and limitations

MyCal is an **independent student project**, not an official Canvas feature or an American Express product. It currently targets UF Canvas and is under active development. Assignment data comes from Canvas; MyCal does not change official Canvas assignment deadlines. Chrome local storage is browser/profile-specific and is not a substitute for authenticated multi-device synchronization.

## Acknowledgments

Created for the **WiCSE Shadowing Program** at the **University of Florida**, with technical guidance and mentorship from a software engineer at **American Express**.
