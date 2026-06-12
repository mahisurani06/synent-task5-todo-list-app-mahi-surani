/**
 * TaskFlow — script.js
 * Premium To-Do List Application
 * Author: Mahi | Synent Technologies Web Development Internship
 *
 * Modules:
 *   1. State & Storage
 *   2. Render
 *   3. Actions (add / toggle / delete / clear)
 *   4. Statistics
 *   5. UI helpers (toast, date, hamburger)
 *   6. Event bindings
 *   7. Init
 */

'use strict';

/* ═══════════════════════════════════════════════
   1. STATE & STORAGE
   ─────────────────────────────────────────────
   Tasks are stored in localStorage as JSON.
   Each task: { id, text, completed, createdAt }
════════════════════════════════════════════════ */

const STORAGE_KEY = 'taskflow_tasks_v1';

/** Load tasks from localStorage. Returns an array. */
function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Persist the current tasks array to localStorage. */
function saveTasks(tasks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (e) {
    console.warn('TaskFlow: could not save to localStorage', e);
  }
}

/** Generate a unique ID (timestamp + random suffix). */
function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/* ═══════════════════════════════════════════════
   2. RENDER
   ─────────────────────────────────────────────
   Build the task list DOM from state.
════════════════════════════════════════════════ */

const taskListEl  = document.getElementById('task-list');
const emptyState  = document.getElementById('empty-state');

/**
 * Render all tasks.
 * Re-renders the entire list each time — fast enough for this scale.
 */
function renderTasks(tasks) {
  taskListEl.innerHTML = '';

  if (tasks.length === 0) {
    emptyState.removeAttribute('hidden');
    return;
  }

  emptyState.setAttribute('hidden', '');

  tasks.forEach((task, index) => {
    const li = buildTaskCard(task, index);
    taskListEl.appendChild(li);
  });
}

/**
 * Build a single task card <li> element.
 * @param {Object} task
 * @param {number} index
 * @returns {HTMLLIElement}
 */
function buildTaskCard(task, index) {
  const li = document.createElement('li');
  li.className = 'task-card' + (task.completed ? ' completed' : '');
  li.dataset.id = task.id;

  // Stagger the entrance animation
  li.style.animationDelay = `${index * 40}ms`;

  // ── Checkbox ──
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'task-checkbox';
  checkbox.checked = task.completed;
  checkbox.setAttribute('aria-label', `Mark "${task.text}" as ${task.completed ? 'incomplete' : 'complete'}`);

  checkbox.addEventListener('change', () => toggleTask(task.id));

  // ── Text ──
  const span = document.createElement('span');
  span.className = 'task-text';
  span.textContent = task.text;

  // ── Delete button ──
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-btn';
  deleteBtn.setAttribute('aria-label', `Delete task: ${task.text}`);
  deleteBtn.innerHTML = `
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M2 2l11 11M13 2L2 13" stroke="currentColor" stroke-width="1.8"
        stroke-linecap="round"/>
    </svg>
  `;

  deleteBtn.addEventListener('click', () => deleteTask(task.id, li));

  li.appendChild(checkbox);
  li.appendChild(span);
  li.appendChild(deleteBtn);

  return li;
}

/* ═══════════════════════════════════════════════
   3. ACTIONS
════════════════════════════════════════════════ */

/**
 * Add a new task from the input field.
 */
function addTask() {
  const input = document.getElementById('task-input');
  const text = input.value.trim();

  if (!text) {
    showToast('Type something first — your task can\'t be empty.', true);
    input.focus();
    return;
  }

  if (text.length > 120) {
    showToast('Keep it under 120 characters, please.', true);
    return;
  }

  const tasks = loadTasks();

  const newTask = {
    id:        uid(),
    text:      text,
    completed: false,
    createdAt: Date.now(),
  };

  tasks.unshift(newTask); // Add to top of list
  saveTasks(tasks);

  input.value = '';
  input.focus();

  renderTasks(tasks);
  updateStats(tasks);
  showToast(`"${truncate(text, 40)}" added.`);
  animateAddButton();
}

/**
 * Toggle the completed state of a task by ID.
 * @param {string} id
 */
function toggleTask(id) {
  const tasks = loadTasks();
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  task.completed = !task.completed;
  saveTasks(tasks);

  // Update the card class without full re-render for a smoother feel
  const cardEl = taskListEl.querySelector(`[data-id="${id}"]`);
  if (cardEl) {
    cardEl.classList.toggle('completed', task.completed);
    const textEl = cardEl.querySelector('.task-text');
    if (textEl) textEl.style.transition = 'all 0.25s ease';
    const checkboxEl = cardEl.querySelector('.task-checkbox');
    if (checkboxEl) checkboxEl.setAttribute('aria-label',
      `Mark "${task.text}" as ${task.completed ? 'incomplete' : 'complete'}`);
  }

  updateStats(tasks);
}

/**
 * Delete a task with exit animation.
 * @param {string} id
 * @param {HTMLLIElement} cardEl
 */
function deleteTask(id, cardEl) {
  // Play exit animation first
  cardEl.classList.add('removing');

  cardEl.addEventListener('animationend', () => {
    const tasks = loadTasks().filter(t => t.id !== id);
    saveTasks(tasks);
    renderTasks(tasks);
    updateStats(tasks);
  }, { once: true });
}

/**
 * Clear all completed tasks at once.
 */
function clearCompleted() {
  const tasks = loadTasks();
  const remaining = tasks.filter(t => !t.completed);
  const removed = tasks.length - remaining.length;

  if (removed === 0) {
    showToast('No completed tasks to clear.', true);
    return;
  }

  saveTasks(remaining);
  renderTasks(remaining);
  updateStats(remaining);
  showToast(`${removed} completed task${removed > 1 ? 's' : ''} cleared.`);
}

/* ═══════════════════════════════════════════════
   4. STATISTICS
   ─────────────────────────────────────────────
   Animate counter values for a premium feel.
════════════════════════════════════════════════ */

const statTotalEl   = document.getElementById('stat-total');
const statDoneEl    = document.getElementById('stat-done');
const statPendingEl = document.getElementById('stat-pending');

/**
 * Update the three stat counters.
 * @param {Array} tasks
 */
function updateStats(tasks) {
  const total   = tasks.length;
  const done    = tasks.filter(t => t.completed).length;
  const pending = total - done;

  animateCounter(statTotalEl,   parseInt(statTotalEl.textContent)   || 0, total);
  animateCounter(statDoneEl,    parseInt(statDoneEl.textContent)    || 0, done);
  animateCounter(statPendingEl, parseInt(statPendingEl.textContent) || 0, pending);
}

/**
 * Animate a number counter from `from` to `to`.
 * @param {HTMLElement} el
 * @param {number} from
 * @param {number} to
 */
function animateCounter(el, from, to) {
  if (from === to) return;

  const duration = 350;
  const startTime = performance.now();

  function step(now) {
    const elapsed  = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(from + (to - from) * eased);

    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = to;
  }

  requestAnimationFrame(step);
}

/* ═══════════════════════════════════════════════
   5. UI HELPERS
════════════════════════════════════════════════ */

let toastTimer = null;

/**
 * Show a transient toast message.
 * @param {string} message
 * @param {boolean} isError
 */
function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.add('show');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2800);
}

/** Flash the Add button with a pop animation on success. */
function animateAddButton() {
  const btn = document.getElementById('add-btn');
  btn.classList.remove('pop');
  // Force reflow to restart animation
  void btn.offsetWidth;
  btn.classList.add('pop');
}

/** Truncate a string to `max` chars with ellipsis. */
function truncate(str, max) {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

/** Render today's date in the dashboard header. */
function renderDate() {
  const el = document.getElementById('dashboard-date');
  const now = new Date();
  el.textContent = now.toLocaleDateString('en-US', {
    weekday: 'short',
    month:   'short',
    day:     'numeric',
  });
}

/* ═══════════════════════════════════════════════
   6. EVENT BINDINGS
════════════════════════════════════════════════ */

function bindEvents() {
  // Add button click
  document.getElementById('add-btn').addEventListener('click', addTask);

  // Enter key in input
  document.getElementById('task-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addTask();
  });

  // Clear completed button
  document.getElementById('clear-btn').addEventListener('click', clearCompleted);

  // Mobile hamburger
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobile-menu');

  hamburger.addEventListener('click', () => {
    const isOpen = !mobileMenu.hidden;
    mobileMenu.hidden = isOpen;
    hamburger.setAttribute('aria-expanded', String(!isOpen));

    // Animate hamburger to X
    const spans = hamburger.querySelectorAll('span');
    if (!isOpen) {
      spans[0].style.transform = 'translateY(7px) rotate(45deg)';
      spans[1].style.opacity   = '0';
      spans[2].style.transform = 'translateY(-7px) rotate(-45deg)';
    } else {
      spans.forEach(s => {
        s.style.transform = '';
        s.style.opacity   = '';
      });
    }
  });

  // Close mobile menu when a link is clicked
  mobileMenu.querySelectorAll('.mobile-link').forEach(link => {
    link.addEventListener('click', () => {
      mobileMenu.hidden = true;
      hamburger.setAttribute('aria-expanded', 'false');
      hamburger.querySelectorAll('span').forEach(s => {
        s.style.transform = '';
        s.style.opacity   = '';
      });
    });
  });
}

/* ═══════════════════════════════════════════════
   7. INIT
════════════════════════════════════════════════ */

function init() {
  renderDate();
  bindEvents();

  const tasks = loadTasks();
  renderTasks(tasks);
  updateStats(tasks);

  // Focus input on load (desktop only)
  if (window.innerWidth > 640) {
    document.getElementById('task-input').focus();
  }
}

// Kick everything off once the DOM is ready
document.addEventListener('DOMContentLoaded', init);
