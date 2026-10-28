
// MyCal Spring Boot assignment metadata bridge
// Temporary mock user for development/testing only.
// Authentication will eventually determine the user automatically.
const MOCK_USER_ID = 1;
const API_BASE = `http://localhost:8080/api/users/${MOCK_USER_ID}/assignments`;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const type = message?.type;
  if (type !== "MYCAL_SAVE_METADATA" && type !== "MYCAL_GET_METADATA") return false;

  const { courseId, assignmentId } = message;
  if (!/^\d+$/.test(String(courseId)) || !/^\d+$/.test(String(assignmentId))) {
    sendResponse({ ok: false, error: "Invalid Canvas assignment identifiers" });
    return false;
  }

  const url = `${API_BASE}/${courseId}/${assignmentId}`;

  (async () => {
    try {
      const response = type === "MYCAL_SAVE_METADATA"
        ? await fetch(url, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(message.metadata)
          })
        : await fetch(url, { method: "GET" });

      if (type === "MYCAL_GET_METADATA" && response.status === 404) {
        sendResponse({ ok: true, data: null });
        return;
      }

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      sendResponse({ ok: true, data: await response.json() });
    } catch (error) {
      sendResponse({ ok: false, error: error.message });
    }
  })();

  return true;
});


// Local individual reminders (no Spring Boot dependency)
const REMINDER_PREFIX = "mycal_reminder_";
const ALARM_PREFIX = "mycal_alarm_";

const validId = value => /^\d+$/.test(String(value));

const reminderKey = (canvasUserId, courseId, assignmentId) =>
  `${REMINDER_PREFIX}${canvasUserId}_${courseId}_${assignmentId}`;

const alarmKey = (canvasUserId, courseId, assignmentId) =>
  `${ALARM_PREFIX}${canvasUserId}_${courseId}_${assignmentId}`;

function getReminderTimestamp(reminder) {
  if (reminder.mode === "test") return Date.now() + 60_000;

  if (reminder.mode === "custom") {
    if (!reminder.customAt) {
      throw new Error("Select a custom reminder date and time.");
    }
    return new Date(reminder.customAt).getTime();
  }

  if (!reminder.dueAt) {
    throw new Error("This Canvas assignment has no due date. Choose Custom instead.");
  }

  const date = new Date(reminder.dueAt);
  if (!Number.isFinite(date.getTime())) {
    throw new Error("Invalid Canvas due date.");
  }

  if (reminder.mode === "morning") {
    date.setHours(9, 0, 0, 0);
  } else if (reminder.mode === "day-before") {
    date.setDate(date.getDate() - 1);
    date.setHours(9, 0, 0, 0);
  } else if (reminder.mode === "hour-before") {
    date.setTime(date.getTime() - 60 * 60_000);
  } else {
    throw new Error("Unknown reminder timing option.");
  }

  return date.getTime();
}

async function updateReminder(reminder) {
  if (
    !reminder ||
    !validId(reminder.canvasUserId) ||
    !validId(reminder.courseId) ||
    !validId(reminder.assignmentId)
  ) {
    throw new Error("Invalid Canvas user or assignment identifiers.");
  }

  const key = reminderKey(
    reminder.canvasUserId,
    reminder.courseId,
    reminder.assignmentId
  );

  const alarm = alarmKey(
    reminder.canvasUserId,
    reminder.courseId,
    reminder.assignmentId
  );

  if (!reminder.enabled) {
    await chrome.alarms.clear(alarm);
    await chrome.storage.local.remove(key);
    return { enabled: false };
  }

  const scheduledAt = getReminderTimestamp(reminder);

  if (!Number.isFinite(scheduledAt) || scheduledAt <= Date.now()) {
    throw new Error("Reminder time must be in the future.");
  }

  const saved = { ...reminder, scheduledAt };

  await chrome.storage.local.set({ [key]: saved });
  await chrome.alarms.create(alarm, { when: scheduledAt });

  return { enabled: true, scheduledAt };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "MYCAL_SAVE_REMINDER") return false;

  updateReminder(message.reminder)
    .then(data => sendResponse({ ok: true, data }))
    .catch(error => sendResponse({ ok: false, error: error.message }));

  return true;
});


// Deliver scheduled desktop notifications.
chrome.alarms.onAlarm.addListener(async alarm => {
  if (!alarm.name.startsWith(ALARM_PREFIX)) return;

  const ids = alarm.name
    .slice(ALARM_PREFIX.length)
    .match(/^(\d+)_(\d+)_(\d+)$/);

  if (!ids) return;

  const [, canvasUserId, courseId, assignmentId] = ids;
  const key = reminderKey(canvasUserId, courseId, assignmentId);

  const saved = await chrome.storage.local.get(key);
  const reminder = saved[key];

  if (!reminder?.enabled) return;
  if (String(reminder.canvasUserId) !== canvasUserId) return;

  try {
    await chrome.notifications.create(alarm.name, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon128.png"),
      title: "MyCal Assignment Reminder",
      message: reminder.mode === "test"
        ? `Test reminder: ${reminder.title}`
        : `${reminder.title} — ${
            reminder.dueAt
              ? `Due ${new Date(reminder.dueAt).toLocaleString()}`
              : "Reminder time!"
          }`,
      priority: 2
    });

    // One-time alarm; clear preference after successful delivery.
    await chrome.storage.local.remove(key);
  } catch (error) {
    console.error("MyCal notification failed:", error);
  }
});


// Open the Canvas assignment when a notification is clicked.
chrome.notifications.onClicked.addListener(async notificationId => {
  if (!notificationId.startsWith(ALARM_PREFIX)) return;

  const ids = notificationId
    .slice(ALARM_PREFIX.length)
    .match(/^(\d+)_(\d+)_(\d+)$/);

  if (!ids) return;

  const [, canvasUserId, courseId, assignmentId] = ids;

  await chrome.tabs.create({
    url: `https://ufl.instructure.com/courses/${courseId}/assignments/${assignmentId}`
  });

  await chrome.notifications.clear(notificationId);
});


// Restore saved reminders when Chrome starts or the extension updates.
async function restoreReminders() {
  const saved = await chrome.storage.local.get(null);

  for (const [key, reminder] of Object.entries(saved)) {
    if (!key.startsWith(REMINDER_PREFIX) || !reminder?.enabled) {
      continue;
    }

    if (
      !validId(reminder.canvasUserId) ||
      !validId(reminder.courseId) ||
      !validId(reminder.assignmentId)
    ) {
      continue;
    }

    if (
      !Number.isFinite(reminder.scheduledAt) ||
      reminder.scheduledAt <= Date.now()
    ) {
      continue;
    }

    const expectedKey = reminderKey(
      reminder.canvasUserId,
      reminder.courseId,
      reminder.assignmentId
    );

    if (key !== expectedKey) continue;

    await chrome.alarms.create(
      alarmKey(
        reminder.canvasUserId,
        reminder.courseId,
        reminder.assignmentId
      ),
      { when: reminder.scheduledAt }
    );
  }
}


// Clear legacy alarms that don't include a Canvas user ID.
// Preserve their storage records for manual migration if needed.
async function clearLegacyAlarms() {
  const alarms = await chrome.alarms.getAll();

  for (const alarm of alarms) {
    if (
      alarm.name.startsWith(ALARM_PREFIX) &&
      /^(\d+)_(\d+)$/.test(alarm.name.slice(ALARM_PREFIX.length))
    ) {
      await chrome.alarms.clear(alarm.name);
    }
  }
}

async function initializeReminders() {
  await clearLegacyAlarms();
  await restoreReminders();
}

chrome.runtime.onStartup.addListener(() =>
  initializeReminders().catch(console.error)
);

chrome.runtime.onInstalled.addListener(() =>
  initializeReminders().catch(console.error)
);
