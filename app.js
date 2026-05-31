const STORAGE_KEY = "stats-habit-tracker-v3";
const todayKey = () => new Date().toISOString().slice(0, 10);

const defaultCategories = [
  { id: "mind", name: "Mindfulness", icon: "\u2659", color: "#724bd2", label: "Meditate" },
  { id: "move", name: "Movement", icon: "\u2197", color: "#a9d94c", label: "Run" },
  { id: "water", name: "Water", icon: "\u25d6", color: "#57bdd9", label: "Water" },
  { id: "read", name: "Reading", icon: "\u25a3", color: "#d4614c", label: "Reading" },
  { id: "food", name: "Food", icon: "\u25cf", color: "#5d42b3", label: "Food" },
  { id: "study", name: "Studying", icon: "A+", color: "#35a36d", label: "Study" },
  { id: "code", name: "Coding", icon: "</>", color: "#2e70db", label: "Code" },
  { id: "sleep", name: "Sleep", icon: "\u263e", color: "#554798", label: "Sleep" }
];

const defaultState = {
  paused: false,
  sound: true,
  categories: defaultCategories,
  history: {},
  tasks: []
};

let state = loadState();
let editingId = null;
let searchTerm = "";

const refs = {
  bubbleChart: document.querySelector("#bubbleChart"),
  barChart: document.querySelector("#barChart"),
  lineChart: document.querySelector("#lineChart"),
  timeline: document.querySelector("#timeline"),
  notifyButton: document.querySelector("#notifyButton"),
  reminderPopover: document.querySelector("#reminderPopover"),
  notifyStatus: document.querySelector("#notifyStatus"),
  nextReminderList: document.querySelector("#nextReminderList"),
  enableNotificationsButton: document.querySelector("#enableNotificationsButton"),
  pauseButton: document.querySelector("#pauseButton"),
  soundButton: document.querySelector("#soundButton"),
  searchButton: document.querySelector("#searchButton"),
  searchRow: document.querySelector("#searchRow"),
  searchInput: document.querySelector("#searchInput"),
  addTaskButton: document.querySelector("#addTaskButton"),
  resetDayButton: document.querySelector("#resetDayButton"),
  todayLabel: document.querySelector("#todayLabel"),
  weeklyRange: document.querySelector("#weeklyRange"),
  completedCount: document.querySelector("#completedCount"),
  completedDelta: document.querySelector("#completedDelta"),
  habitCount: document.querySelector("#habitCount"),
  goalCount: document.querySelector("#goalCount"),
  goalDelta: document.querySelector("#goalDelta"),
  streakCount: document.querySelector("#streakCount"),
  dialog: document.querySelector("#taskDialog"),
  form: document.querySelector("#taskForm"),
  dialogTitle: document.querySelector("#dialogTitle"),
  taskName: document.querySelector("#taskName"),
  taskCategory: document.querySelector("#taskCategory"),
  newCategoryName: document.querySelector("#newCategoryName"),
  addCategoryButton: document.querySelector("#addCategoryButton"),
  categoryPreview: document.querySelector("#categoryPreview"),
  taskType: document.querySelector("#taskType"),
  taskTime: document.querySelector("#taskTime"),
  taskEndTime: document.querySelector("#taskEndTime"),
  taskInterval: document.querySelector("#taskInterval"),
  taskGoal: document.querySelector("#taskGoal"),
  timeField: document.querySelector("#timeField"),
  endTimeField: document.querySelector("#endTimeField"),
  intervalField: document.querySelector("#intervalField"),
  deleteTaskButton: document.querySelector("#deleteTaskButton"),
  closeDialog: document.querySelector("#closeDialog"),
  cancelDialog: document.querySelector("#cancelDialog"),
  toast: document.querySelector("#toast")
};

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(defaultState);
  try {
    const saved = JSON.parse(raw);
    return {
      ...structuredClone(defaultState),
      ...saved,
      categories: normalizeCategories(saved.categories),
      tasks: Array.isArray(saved.tasks) ? saved.tasks : structuredClone(defaultState.tasks),
      history: saved.history || {}
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function normalizeCategories(savedCategories) {
  const merged = [...defaultCategories];
  if (Array.isArray(savedCategories)) {
    savedCategories.forEach(category => {
      if (!category?.id || !category?.name) return;
      const existingIndex = merged.findIndex(item => item.id === category.id);
      const next = { ...category };
      if (next.id === "write") {
        next.id = "study";
        next.name = "Studying";
        next.icon = "A+";
        next.color = "#35a36d";
        next.label = "Study";
      }
      if (existingIndex >= 0) merged[existingIndex] = { ...merged[existingIndex], ...next };
      else merged.push(next);
    });
  }
  return merged.filter((category, index, list) => list.findIndex(item => item.id === category.id) === index);
}

function categoryMap() {
  return Object.fromEntries(state.categories.map(category => [category.id, category]));
}

function getCategory(categoryId) {
  const map = categoryMap();
  return map[categoryId === "write" ? "study" : categoryId] || state.categories[0] || defaultCategories[0];
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getDay() {
  const key = todayKey();
  if (!state.history[key]) state.history[key] = {};
  return state.history[key];
}

function taskDoneCount(taskId, key = todayKey()) {
  return Number(state.history[key]?.[taskId] || 0);
}

function taskComplete(task) {
  return taskDoneCount(task.id) >= Number(task.goal || 1);
}

function formatTime(value) {
  const [hourRaw, minute] = value.split(":").map(Number);
  const suffix = hourRaw >= 12 ? "PM" : "AM";
  const hour = hourRaw % 12 || 12;
  return `${hour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function readableDate() {
  const date = new Date();
  return `Today ${date.getDate()} ${date.toLocaleString(undefined, { month: "short" })}.`;
}

function weekKeys() {
  const result = [];
  const now = new Date();
  for (let index = 6; index >= 0; index -= 1) {
    const day = new Date(now);
    day.setDate(now.getDate() - index);
    result.push(day.toISOString().slice(0, 10));
  }
  return result;
}

function completionForDay(key) {
  const totalGoal = state.tasks.reduce((sum, task) => sum + Number(task.goal || 1), 0) || 1;
  const done = state.tasks.reduce((sum, task) => sum + Math.min(taskDoneCount(task.id, key), Number(task.goal || 1)), 0);
  return Math.round((done / totalGoal) * 100);
}

function render() {
  refs.todayLabel.textContent = readableDate();
  refs.pauseButton.classList.toggle("paused", state.paused);
  refs.pauseButton.textContent = state.paused ? "▶" : "Ⅱ";
  refs.soundButton.textContent = state.sound ? "◉" : "○";
  refs.soundButton.title = state.sound ? "Reminder sound is on" : "Reminder sound is off";
  renderCategoryOptions(refs.taskCategory.value || state.categories[0]?.id);
  renderTimeline();
  renderStats();
  renderReminderCenter();
  saveState();
}

function renderTimeline() {
  const terms = searchTerm.trim().toLowerCase();
  const sorted = [...state.tasks].sort(sortTimelineTasks);
  const filtered = sorted.filter(task => task.name.toLowerCase().includes(terms));
  refs.timeline.innerHTML = '<div class="time-progress" aria-hidden="true"><span></span></div>';

  if (!filtered.length) {
    refs.timeline.insertAdjacentHTML("beforeend", searchTerm.trim()
      ? '<p class="empty-state">No habits match your search.</p>'
      : '<p class="empty-state">No habits yet. Press + to add your first habit.</p>');
    updateTimeProgress();
    return;
  }

  filtered.forEach((task, index) => {
    const category = getCategory(task.category);
    const done = taskDoneCount(task.id);
    const complete = taskComplete(task);
    const row = document.createElement("div");
    row.className = `task-row ${index === 0 ? "featured" : ""} ${complete ? "complete" : ""}`;
    row.innerHTML = `
      <div class="time-label">${timelineTimeLabel(task)}</div>
      <div class="task-pill">
        <span class="task-icon" style="--accent:${category.color}">${category.icon}</span>
        <span class="task-name">${task.name}<small class="task-meta">${done}/${task.goal || 1} done</small></span>
        <button class="tick-button ${complete ? "done" : ""}" type="button" aria-label="Mark ${task.name} done">${complete ? "✓" : ""}</button>
        <button class="edit-button" type="button" aria-label="Edit ${task.name}">⋮</button>
      </div>
    `;
    row.querySelector(".tick-button").addEventListener("click", () => tickTask(task.id));
    row.querySelector(".edit-button").addEventListener("click", () => openDialog(task.id));
    refs.timeline.append(row);
  });
  updateTimeProgress();
}

function sortTimelineTasks(a, b) {
  if (a.type === "interval" && b.type !== "interval") return -1;
  if (a.type !== "interval" && b.type === "interval") return 1;
  if (a.type === "interval" && b.type === "interval") return Number(a.interval || 0) - Number(b.interval || 0);
  return minutesFromTime(a.time || "00:00") - minutesFromTime(b.time || "00:00");
}

function timelineTimeLabel(task) {
  if (task.type === "interval") return `Every ${task.interval}m`;
  const endTime = task.endTime || defaultEndTime(task.time);
  return `${formatTime(task.time)} - ${formatTime(endTime)}`;
}

function minutesFromTime(value) {
  const [hours, minutes] = (value || "00:00").split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function timeFromMinutes(totalMinutes) {
  const minutes = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function defaultEndTime(startTime) {
  return timeFromMinutes(minutesFromTime(startTime || "08:00") + 30);
}

function updateTimeProgress() {
  const progress = refs.timeline.querySelector(".time-progress span");
  if (!progress) return;
  const now = new Date();
  const dayPercent = ((now.getHours() * 60 + now.getMinutes()) / 1440) * 100;
  progress.style.height = `${Math.max(3, Math.min(dayPercent, 100))}%`;
}

function renderStats() {
  const day = getDay();
  const completed = Object.values(day).reduce((sum, count) => sum + Number(count), 0);
  const completedGoals = state.tasks.filter(task => taskComplete(task)).length;
  const streak = calculateStreak();
  const percent = completionForDay(todayKey());

  refs.completedCount.textContent = completed;
  refs.completedDelta.textContent = `+${percent}%`;
  refs.habitCount.textContent = state.tasks.length;
  refs.goalCount.textContent = completedGoals;
  refs.goalDelta.textContent = `+${Math.round((completedGoals / Math.max(state.tasks.length, 1)) * 100)}%`;
  refs.streakCount.textContent = streak;

  renderBubbles(streak);
  renderBars();
  renderLine();
}

function renderBubbles(streak) {
  const topTasks = [...state.tasks];
  refs.bubbleChart.innerHTML = "";
  if (!topTasks.length) {
    refs.bubbleChart.innerHTML = '<p class="empty-chart">Add your first habit to begin tracking activity.</p>';
    return;
  }
  topTasks.forEach((task, index) => {
    const category = getCategory(task.category);
    const complete = taskComplete(task);
    const ratio = Math.min(taskDoneCount(task.id) / Math.max(Number(task.goal || 1), 1), 1);
    const isStreakBubble = index === Math.min(2, Math.max(topTasks.length - 1, 0));
    const size = isStreakBubble ? 76 : index % 3 === 1 ? 54 : 50;
    const top = isStreakBubble ? 74 : 106 - Math.round(ratio * 58);
    const column = document.createElement("div");
    column.className = "habit-column";
    column.innerHTML = `
      <button class="habit-bubble" style="--color:${isStreakBubble ? "#d6ff3f" : category.color};--size:${isStreakBubble ? 118 : size}px;--top:${isStreakBubble ? 12 : top}px" type="button">
        ${isStreakBubble ? `<span><strong>${streak}-Day</strong><small>Streak</small></span>` : `<span class="mini-icon">${category.icon}</span>`}
      </button>
      <span class="habit-label">${activityLabel(task)}</span>
    `;
    column.querySelector(".habit-bubble").addEventListener("click", () => tickTask(task.id));
    if (complete) column.querySelector(".habit-bubble").title = "Completed today";
    refs.bubbleChart.append(column);
  });
}

function activityLabel(task) {
  if (task.category === "read") return "Reading";
  return shortName(task.name, getCategory(task.category).label);
}

function shortName(name, fallback) {
  const words = name.split(" ").filter(Boolean);
  if (!words.length) return fallback;
  if (words.length === 1) return words[0];
  return words.slice(0, 2).join(" ");
}

function renderReminderCenter() {
  if (!refs.notifyStatus || !refs.nextReminderList) return;
  const permission = "Notification" in window ? Notification.permission : "unsupported";
  const status = permission === "granted"
    ? "Laptop notifications are enabled."
    : permission === "denied"
      ? "Notifications are blocked in this browser."
      : "Click enable to allow laptop notifications.";
  refs.notifyStatus.textContent = state.paused ? `${status} Reminders are currently paused.` : status;
  refs.enableNotificationsButton.textContent = permission === "granted" ? "Notifications enabled" : "Enable laptop reminders";
  refs.enableNotificationsButton.disabled = permission === "granted";

  const nextItems = [...state.tasks]
    .sort((a, b) => nextReminderTime(a) - nextReminderTime(b))
    .slice(0, 4);
  refs.nextReminderList.innerHTML = `
    <ul>
      ${nextItems.map(task => `<li><span>${task.name}</span><span>${nextReminderLabel(task)}</span></li>`).join("")}
    </ul>
  `;
}

function nextReminderTime(task) {
  const now = new Date();
  if (task.type === "interval") {
    const intervalMs = Math.max(1, Number(task.interval || 10)) * 60 * 1000;
    return Number(task.lastIntervalAt || task.createdAt || Date.now()) + intervalMs;
  }
  const [hours, minutes] = task.time.split(":").map(Number);
  const due = new Date(now);
  due.setHours(hours, minutes, 0, 0);
  if (due <= now) due.setDate(due.getDate() + 1);
  return due.getTime();
}

function nextReminderLabel(task) {
  if (task.type === "interval") return `Every ${task.interval}m`;
  return `${formatTime(task.time)} - ${formatTime(task.endTime || defaultEndTime(task.time))}`;
}

function renderBars() {
  const keys = weekKeys();
  const values = keys.map(completionForDay);
  const min = Math.min(...values);
  const max = Math.max(...values);
  refs.weeklyRange.textContent = `From ${formatShort(keys[0])} - ${formatShort(keys[6])}`;
  document.querySelector(".legend-min").parentElement.lastChild.textContent = ` Min ${min}%`;
  document.querySelector(".legend-max").parentElement.lastChild.textContent = ` Max ${max}%`;
  refs.barChart.innerHTML = "";
  keys.forEach((key, index) => {
    const value = values[index];
    const dayNumber = new Date(`${key}T00:00`).getDate();
    const item = document.createElement("div");
    item.className = "bar-item";
    item.innerHTML = `
      <span class="bar" style="--h:${28 + value * 1.15}px;--bar-color:${value === max && max > 0 ? "var(--lime)" : "#3f3f3f"}"></span>
      <span>${dayNumber}</span>
    `;
    refs.barChart.append(item);
  });
}

function formatShort(key) {
  const date = new Date(`${key}T00:00`);
  return `${date.getDate()} ${date.toLocaleString(undefined, { month: "short" })}`;
}

function renderLine() {
  const values = weekKeys().map(completionForDay);
  const width = 720;
  const height = 100;
  const points = values.map((value, index) => {
    const x = 26 + index * ((width - 52) / 6);
    const y = height - 10 - (value / 100) * 78;
    return [x, y];
  });
  const path = points.map(([x, y], index) => `${index ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  refs.lineChart.innerHTML = `
    <path d="${path}" fill="none" stroke="#29e0ca" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>
  `;
}

function calculateStreak() {
  let streak = 0;
  const cursor = new Date();
  for (let index = 0; index < 365; index += 1) {
    const key = cursor.toISOString().slice(0, 10);
    if (completionForDay(key) > 0) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function tickTask(taskId) {
  const task = state.tasks.find(item => item.id === taskId);
  if (!task) return;
  const day = getDay();
  const current = Number(day[taskId] || 0);
  const goal = Number(task.goal || 1);
  day[taskId] = current >= goal ? 0 : current + 1;
  render();
}

function openDialog(taskId = null) {
  editingId = taskId;
  const task = state.tasks.find(item => item.id === taskId);
  refs.dialogTitle.textContent = task ? "Edit Habit" : "Add Habit";
  refs.deleteTaskButton.style.visibility = task ? "visible" : "hidden";
  renderCategoryOptions(task?.category === "write" ? "study" : task?.category || state.categories[0]?.id);
  refs.taskName.value = task?.name || "";
  refs.taskCategory.value = task?.category === "write" ? "study" : task?.category || state.categories[0]?.id;
  refs.taskType.value = task?.type || "time";
  refs.taskTime.value = task?.time || "20:00";
  refs.taskEndTime.value = task?.endTime || defaultEndTime(task?.time || "20:00");
  refs.taskInterval.value = task?.interval || 10;
  refs.taskGoal.value = task?.goal || 1;
  updateTypeFields();
  updateCategoryPreview();
  refs.dialog.showModal();
}

function closeDialog() {
  refs.dialog.close();
  editingId = null;
}

function renderCategoryOptions(selectedId) {
  if (!refs.taskCategory) return;
  const current = selectedId || refs.taskCategory.value;
  refs.taskCategory.innerHTML = state.categories
    .map(category => `<option value="${category.id}">${category.name}</option>`)
    .join("");
  refs.taskCategory.value = state.categories.some(category => category.id === current)
    ? current
    : state.categories[0]?.id || "";
}

function addCategory() {
  const name = refs.newCategoryName.value.trim();
  if (!name) return;
  const id = slugify(name);
  const existing = state.categories.find(category => category.id === id || category.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    refs.taskCategory.value = existing.id;
    refs.newCategoryName.value = "";
    updateCategoryPreview();
    showToast(`${existing.name} is already available.`);
    return;
  }
  const category = createCategory(name);
  state.categories.push(category);
  renderCategoryOptions(category.id);
  refs.taskCategory.value = category.id;
  refs.newCategoryName.value = "";
  updateCategoryPreview();
  saveState();
  showToast(`${category.name} category added.`);
}

function createCategory(name) {
  return {
    id: slugify(name),
    name,
    label: name,
    ...determineCategoryVisual(name)
  };
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `category-${Date.now()}`;
}

function determineCategoryVisual(name) {
  const lower = name.toLowerCase();
  const rules = [
    { test: /code|coding|program|develop|script|debug|software/, icon: "</>", color: "#2e70db" },
    { test: /study|learn|class|course|book|read|exam|write|writing|journal|notes/, icon: "A+", color: "#35a36d" },
    { test: /water|drink|hydrate/, icon: "\u25d6", color: "#57bdd9" },
    { test: /run|walk|gym|workout|fitness|yoga|stretch|sport/, icon: "\u2197", color: "#a9d94c" },
    { test: /meditat|mind|pray|focus|breath/, icon: "\u2659", color: "#724bd2" },
    { test: /food|meal|snack|diet|eat|fruit/, icon: "\u25cf", color: "#5d42b3" },
    { test: /sleep|rest|nap/, icon: "\u263e", color: "#554798" },
    { test: /money|finance|budget|save/, icon: "$", color: "#8d9c49" },
    { test: /clean|home|room|organize/, icon: "\u25a6", color: "#6f7d87" }
  ];
  const match = rules.find(rule => rule.test.test(lower));
  if (match) return { icon: match.icon, color: match.color };
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0].toUpperCase()).join("");
  const palette = ["#724bd2", "#2e70db", "#35a36d", "#d4614c", "#8d9c49", "#57bdd9"];
  const colorIndex = [...lower].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length;
  return { icon: initials || "+", color: palette[colorIndex] };
}

function updateCategoryPreview() {
  const typedName = refs.newCategoryName.value.trim();
  const visual = typedName ? determineCategoryVisual(typedName) : getCategory(refs.taskCategory.value);
  refs.categoryPreview.textContent = visual.icon;
  refs.categoryPreview.style.setProperty("--preview-color", visual.color);
}

function saveTask(event) {
  event.preventDefault();
  const payload = {
    name: refs.taskName.value.trim(),
    category: refs.taskCategory.value,
    type: refs.taskType.value,
    time: refs.taskTime.value || "08:00",
    endTime: refs.taskEndTime.value || defaultEndTime(refs.taskTime.value || "08:00"),
    interval: Math.max(1, Number(refs.taskInterval.value || 10)),
    goal: Math.max(1, Number(refs.taskGoal.value || 1))
  };
  if (!payload.name) return;

  if (editingId) {
    state.tasks = state.tasks.map(task => task.id === editingId ? { ...task, ...payload } : task);
  } else {
    state.tasks.push({ id: crypto.randomUUID(), ...payload, createdAt: Date.now(), lastNotified: "", lastIntervalAt: Date.now() });
  }
  closeDialog();
  render();
}

function deleteTask() {
  if (!editingId) return;
  state.tasks = state.tasks.filter(task => task.id !== editingId);
  Object.values(state.history).forEach(day => delete day[editingId]);
  closeDialog();
  render();
}

function updateTypeFields() {
  const interval = refs.taskType.value === "interval";
  refs.timeField.style.display = interval ? "none" : "grid";
  refs.endTimeField.style.display = interval ? "none" : "grid";
  refs.intervalField.style.display = interval ? "grid" : "none";
}

async function requestNotifications() {
  if (!("Notification" in window)) {
    showToast("This browser does not support desktop notifications.");
    return false;
  }
  if (Notification.permission === "granted") {
    showToast("Laptop reminders are already on.");
    return true;
  }
  const permission = await Notification.requestPermission();
  showToast(permission === "granted" ? "Laptop reminders are on." : "Notifications were not allowed.");
  return permission === "granted";
}

function checkReminders() {
  if (state.paused) return;
  const now = new Date();
  const minuteStamp = `${todayKey()}-${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  state.tasks.forEach(task => {
    let due = false;
    if (task.type === "time") {
      due = task.time === minuteStamp.slice(-5);
    } else {
      const interval = Math.max(1, Number(task.interval || 10));
      const lastIntervalAt = Number(task.lastIntervalAt || task.createdAt || Date.now());
      due = Date.now() - lastIntervalAt >= interval * 60 * 1000;
    }
    if (due && task.lastNotified !== minuteStamp) {
      task.lastNotified = minuteStamp;
      task.lastIntervalAt = Date.now();
      notifyTask(task);
    }
  });
  saveState();
}

function notifyTask(task) {
  const body = task.type === "interval" ? `Every ${task.interval} minutes` : `Scheduled for ${formatTime(task.time)}`;
  if ("Notification" in window && Notification.permission === "granted") {
    const note = new Notification(task.name, { body, tag: task.id, requireInteraction: true });
    note.onclick = () => window.focus();
  }
  if (state.sound) playPing();
  showToast(`${task.name} reminder`);
}

function playPing() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = 720;
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.45);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.5);
}

function showToast(message) {
  refs.toast.textContent = message;
  refs.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => refs.toast.classList.remove("show"), 2600);
}

function resetToday() {
  state.history[todayKey()] = {};
  render();
  showToast("Today has been reset.");
}

refs.notifyButton.addEventListener("click", () => {
  refs.reminderPopover.classList.toggle("open");
  renderReminderCenter();
});
refs.enableNotificationsButton.addEventListener("click", requestNotifications);
refs.pauseButton.addEventListener("click", () => {
  state.paused = !state.paused;
  render();
  showToast(state.paused ? "Reminders paused." : "Reminders resumed.");
});
refs.soundButton.addEventListener("click", () => {
  state.sound = !state.sound;
  render();
  showToast(state.sound ? "Reminder sound is on." : "Reminder sound is off.");
});
refs.searchButton.addEventListener("click", () => {
  refs.searchRow.classList.toggle("open");
  if (refs.searchRow.classList.contains("open")) refs.searchInput.focus();
});
refs.searchInput.addEventListener("input", event => {
  searchTerm = event.target.value;
  renderTimeline();
});
refs.addTaskButton.addEventListener("click", () => openDialog());
refs.resetDayButton.addEventListener("click", resetToday);
refs.closeDialog.addEventListener("click", closeDialog);
refs.cancelDialog.addEventListener("click", closeDialog);
refs.form.addEventListener("submit", saveTask);
refs.deleteTaskButton.addEventListener("click", deleteTask);
refs.taskType.addEventListener("change", updateTypeFields);
refs.taskCategory.addEventListener("change", updateCategoryPreview);
refs.newCategoryName.addEventListener("input", updateCategoryPreview);
refs.addCategoryButton.addEventListener("click", addCategory);

render();
checkReminders();
setInterval(checkReminders, 1000);
setInterval(render, 60000);
setInterval(updateTimeProgress, 15000);
