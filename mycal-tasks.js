
(() => {
  "use strict";

  if (window.__mycalTasksLoaded) return;
  window.__mycalTasksLoaded = true;

  const STORAGE_KEY = "mycal_personal_tasks";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  }[c]));

  let editingId = null;

  async function getTasks() {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return Array.isArray(result[STORAGE_KEY])
      ? result[STORAGE_KEY]
      : [];
  }

  async function saveTasks(tasks) {
    await chrome.storage.local.set({ [STORAGE_KEY]: tasks });
  }

  function renderTasks(tasks) {
    const panel = document.getElementById("mycal-tasks-panel");
    if (!panel) return;

    const list = panel.querySelector("#mycal-task-list");
    const count = panel.querySelector("#mycal-task-count");

    count.textContent = `${tasks.filter(t => !t.completed).length} active`;

    const sorted = [...tasks].sort((a, b) =>
      Number(a.completed) - Number(b.completed) ||
      String(a.dueDate || "9999").localeCompare(
        String(b.dueDate || "9999")
      )
    );

    list.innerHTML = sorted.length
      ? sorted.map(task => `
        <li class="mycal-task-item ${task.completed ? "is-complete" : ""}">
          <input type="checkbox"
            data-action="toggle"
            data-id="${esc(task.id)}"
            ${task.completed ? "checked" : ""}>

          <div class="mycal-task-info">
            <strong>${esc(task.title)}</strong>
            <span>
              ${esc(task.dueDate || "No due date")}
              · ${esc(task.priority)} priority
              ${task.estimatedMinutes ? `· ${task.estimatedMinutes} min` : ""}
            </span>
          </div>

          <button type="button" data-action="edit"
            data-id="${esc(task.id)}">Edit</button>
          <button type="button" data-action="delete"
            data-id="${esc(task.id)}">×</button>
        </li>
      `).join("")
      : '<li class="mycal-task-empty">No personal tasks yet.</li>';
  }

  async function refreshTasks() {
    renderTasks(await getTasks());
  }

  function resetForm(panel) {
    panel.querySelector("#mycal-task-form").reset();
    editingId = null;
    panel.querySelector("#mycal-task-submit").textContent = "Save Task";
    panel.querySelector("#mycal-task-cancel").hidden = true;
  }

  function mount() {
    const sidebar = document.getElementById("mycal-sidebar-panel");
    if (!sidebar) return false;

    if (document.getElementById("mycal-tasks-panel")) return true;

    const card = document.createElement("div");
    card.id = "mycal-tasks-panel";
    card.className = "mycal-card";

    card.innerHTML = `
      <div class="mycal-heading">
        <span>✓ My Tasks</span>
        <span class="mycal-pill" id="mycal-task-count">0 active</span>
      </div>

      <p class="mycal-muted">
        Plan responsibilities beyond Canvas assignments.
      </p>

      <ul id="mycal-task-list" class="mycal-task-items"></ul>

      <button type="button" class="mycal-action"
        id="mycal-add-task">+ Add Personal Task</button>

      <form id="mycal-task-form" hidden>
        <label>
          Task title
          <input name="title" type="text" maxlength="150"
            placeholder="What do you need to do?" required>
        </label>

        <label>
          Due date
          <input name="dueDate" type="date">
        </label>

        <label>
          Priority
          <select name="priority">
            <option value="LOW">Low</option>
            <option value="MEDIUM" selected>Medium</option>
            <option value="HIGH">High</option>
          </select>
        </label>

        <label>
          Estimated time (minutes)
          <input name="estimatedMinutes" type="number"
            min="0" step="1" placeholder="Optional">
        </label>

        <div class="mycal-task-form-actions">
          <button type="submit" id="mycal-task-submit">
            Save Task
          </button>
          <button type="button" id="mycal-task-cancel" hidden>
            Cancel
          </button>
        </div>
      </form>
    `;

    sidebar.appendChild(card);

    const form = card.querySelector("#mycal-task-form");
    const addButton = card.querySelector("#mycal-add-task");
    const cancelButton = card.querySelector("#mycal-task-cancel");

    addButton.addEventListener("click", () => {
      resetForm(card);
      form.hidden = false;
      cancelButton.hidden = false;
      addButton.hidden = true;
    });

    cancelButton.addEventListener("click", () => {
      resetForm(card);
      form.hidden = true;
      addButton.hidden = false;
    });

    form.addEventListener("submit", async event => {
      event.preventDefault();

      const data = new FormData(form);
      const title = String(data.get("title") || "").trim();
      if (!title) return;

      const tasks = await getTasks();
      const previous = tasks.find(t => t.id === editingId);

      const rawMinutes = String(data.get("estimatedMinutes") || "");
      const estimatedMinutes = rawMinutes === ""
        ? null
        : Number(rawMinutes);

      if (estimatedMinutes !== null &&
          (!Number.isSafeInteger(estimatedMinutes) || estimatedMinutes < 0)) {
        alert("Please enter a valid estimated time.");
        return;
      }

      const task = {
        id: editingId || crypto.randomUUID(),
        title,
        dueDate: String(data.get("dueDate") || ""),
        priority: String(data.get("priority") || "MEDIUM"),
        estimatedMinutes,
        completed: previous?.completed || false,
        createdAt: previous?.createdAt || new Date().toISOString()
      };

      if (editingId) {
        const index = tasks.findIndex(t => t.id === editingId);
        if (index >= 0) tasks[index] = task;
      } else {
        tasks.push(task);
      }

      await saveTasks(tasks);
      resetForm(card);
      form.hidden = true;
      addButton.hidden = false;
      await refreshTasks();
    });

    card.querySelector("#mycal-task-list")
      .addEventListener("click", async event => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;

        const { action, id } = button.dataset;
        const tasks = await getTasks();
        const task = tasks.find(t => t.id === id);
        if (!task) return;

        if (action === "delete") {
          if (!confirm(`Delete "${task.title}"?`)) return;
          await saveTasks(tasks.filter(t => t.id !== id));
          await refreshTasks();
        }

        if (action === "edit") {
          editingId = id;
          form.elements.title.value = task.title;
          form.elements.dueDate.value = task.dueDate || "";
          form.elements.priority.value = task.priority;
          form.elements.estimatedMinutes.value =
            task.estimatedMinutes ?? "";

          form.hidden = false;
          addButton.hidden = true;
          cancelButton.hidden = false;
          card.querySelector("#mycal-task-submit").textContent = "Update Task";
        }
      });

    card.querySelector("#mycal-task-list")
      .addEventListener("change", async event => {
        const input = event.target.closest('input[data-action="toggle"]');
        if (!input) return;

        const tasks = await getTasks();
        const task = tasks.find(t => t.id === input.dataset.id);
        if (!task) return;

        task.completed = input.checked;
        await saveTasks(tasks);
        await refreshTasks();
      });

    refreshTasks();
    return true;
  }

  // The Canvas sidebar may be inserted asynchronously.
  const timer = setInterval(() => {
    if (mount()) clearInterval(timer);
  }, 500);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[STORAGE_KEY]) {
      refreshTasks();
    }
  });

  // Your existing sidebar refresh replaces its children.
  // Reattach the task card if Canvas/MyCal rerenders it.
  const observer = new MutationObserver(() => {
    const sidebar = document.getElementById("mycal-sidebar-panel");
    if (sidebar && !document.getElementById("mycal-tasks-panel")) {
      mount();
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
