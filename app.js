/* ============================================
   SOUL PLANNER — Core Application Logic
   ============================================ */

(function () {
  'use strict';

  // --- Configuration ---
  const CONFIG = {
    PURGATORY_MS: 24 * 60 * 60 * 1000,   // 24 hours
    DEATH_MS: 48 * 60 * 60 * 1000,        // 48 hours
    POINTS_COMPLETE: 10,
    POINTS_DEATH: -5,
    POINTS_RESURRECT: -2,                 // small cost to resurrect
    LIFECYCLE_CHECK_INTERVAL: 60 * 1000,  // every minute
    BUBBLE_DURATION: 5000,
    WARN_COOL_THRESHOLD: 0.5,             // angel warns at 50% heat
    WARN_COLD_THRESHOLD: 0.25,            // angel warns urgently at 25% heat
    STORAGE_KEY_TASKS: 'soul_planner_tasks',
    STORAGE_KEY_SCORE: 'soul_planner_score',
  };

  // --- Angel & Devil Messages ---
  const ANGEL_MESSAGES = {
    welcome: [
      "Welcome back, brave soul! Let's conquer today! 🌟",
      "A new day, new chances! Let's do this! ✨",
      "Your tasks await, champion! 💪",
    ],
    taskAdded: [
      "Great initiative! You've got this! 🌈",
      "A new quest begins! I believe in you! ⭐",
      "Wonderful! Another step towards greatness! 🌟",
    ],
    taskCompleted: [
      "AMAZING! You're on fire! 🔥🔥🔥",
      "Incredible work! The heavens rejoice! 👼✨",
      "You're a legend! Keep going! 🏆",
      "Another soul saved! Magnificent! 🌟",
      "Outstanding! You make me so proud! 💫",
    ],
    encouragement: [
      "Come on, you can do it! Don't let them slip! 💪",
      "Your tasks need you! Show them love! 🌟",
      "A little effort goes a long way! ✨",
      "Don't give up! You're stronger than this! 💫",
    ],
    coolingDown: [
      "Hey! Your task is cooling down! Give it some love! 🥶",
      "Brrr... a task is getting cold! Warm it up! ❄️",
      "One of your tasks needs attention! It's fading! 💨",
      "Don't let it freeze! Touch your task! 🌡️",
    ],
    almostDead: [
      "URGENT! Your task is about to die! Save it NOW! 🚨",
      "It's barely alive! Quick, touch it or complete it! 💔",
      "Last chance! Your task is freezing to death! 🥶💀",
    ],
    resurrected: [
      "A second chance! Don't waste it this time! 🌅",
      "Back from the dead! Make it count! ✨",
      "Resurrection! Now go finish it! 💪",
    ],
    taskTouched: [
      "Nice! You kept it alive! 🌱",
      "Good save! That one almost slipped! 😅",
      "Smart move, keeping things fresh! ⭐",
    ],
  };

  const DEVIL_MESSAGES = {
    welcome: [
      "Oh, you're back... Let's see how long your tasks survive 😈",
      "Tick tock... your tasks are waiting to die 💀",
      "I smell neglected tasks... delicious 🔥",
    ],
    taskDying: [
      "Ooh, that task is looking sickly... 💀",
      "Another one heading to the graveyard? 😈",
      "I can almost taste it... let it dieeee 🪦",
      "Your task is fading, and I love it 😏",
    ],
    taskDead: [
      "HAHAHA! Another one bites the dust! 💀⚰️",
      "Rest in pieces! That task is MINE now! 😈",
      "To the cemetery it goes! *evil laugh* 🪦",
      "Dead. Gone. Forgotten. Just how I like it. 💀",
    ],
    taskCompleted: [
      "Ugh, you actually did it. How boring. 😤",
      "Fine, take your points. Whatever. 🙄",
      "The angel gets another one. Disgusting. 😒",
    ],
    idle: [
      "Getting lazy, are we? I'm counting... 😈",
      "Your tasks grow weaker with every passing hour... 💀",
      "Don't mind me, just waiting for the next funeral 🪦",
    ],
    resurrected: [
      "Back again?! I'll get you next time... 😤",
      "You can't cheat death forever! 💀",
      "Fine, take it back. It'll die again anyway 😈",
    ],
    coolingDown: [
      "Yesss... let it cool... let it die... 🥶😈",
      "I can feel it getting colder... delicious 💀",
      "Neglect is my favorite flavor 😏",
    ],
  };

  // --- State ---
  let tasks = [];
  let score = 0;
  let angelTimeout = null;
  let devilTimeout = null;
  let warnedTasks = new Set(); // track which tasks have been warned about

  // --- DOM References ---
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const DOM = {
    scoreValue: $('#scoreValue'),
    tabNav: $('#tabNav'),
    tabBtns: $$('.tab-btn'),
    tabContents: $$('.tab-content'),
    activeTasks: $('#activeTasks'),
    purgatoryTasks: $('#purgatoryTasks'),
    cemeteryGrid: $('#cemeteryGrid'),
    heavenGrid: $('#heavenGrid'),
    activeCount: $('#activeCount'),
    purgatoryCount: $('#purgatoryCount'),
    cemeteryCount: $('#cemeteryCount'),
    heavenCount: $('#heavenCount'),
    activeEmpty: $('#activeEmpty'),
    purgatoryEmpty: $('#purgatoryEmpty'),
    cemeteryEmpty: $('#cemeteryEmpty'),
    heavenEmpty: $('#heavenEmpty'),
    taskInput: $('#taskInput'),
    addBtn: $('#addBtn'),
    angelBubble: $('#angelBubble'),
    angelMessage: $('#angelMessage'),
    devilBubble: $('#devilBubble'),
    devilMessage: $('#devilMessage'),
  };

  // --- Helpers ---
  function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  function timeAgo(ms) {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function timeLeft(ms) {
    if (ms <= 0) return 'Now!';
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }

  function formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  // --- Storage ---
  function save() {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY_TASKS, JSON.stringify(tasks));
      localStorage.setItem(CONFIG.STORAGE_KEY_SCORE, JSON.stringify(score));
    } catch (e) {
      console.warn('Could not save to localStorage:', e);
    }
  }

  function load() {
    try {
      const savedTasks = localStorage.getItem(CONFIG.STORAGE_KEY_TASKS);
      const savedScore = localStorage.getItem(CONFIG.STORAGE_KEY_SCORE);
      if (savedTasks) tasks = JSON.parse(savedTasks);
      if (savedScore) score = JSON.parse(savedScore);
    } catch (e) {
      console.warn('Could not load from localStorage:', e);
    }
  }

  // --- Angel & Devil Speech ---
  function showAngel(message) {
    clearTimeout(angelTimeout);
    DOM.angelMessage.textContent = message;
    DOM.angelBubble.classList.add('show');
    angelTimeout = setTimeout(() => {
      DOM.angelBubble.classList.remove('show');
    }, CONFIG.BUBBLE_DURATION);
  }

  function showDevil(message) {
    clearTimeout(devilTimeout);
    DOM.devilMessage.textContent = message;
    DOM.devilBubble.classList.add('show');
    devilTimeout = setTimeout(() => {
      DOM.devilBubble.classList.remove('show');
    }, CONFIG.BUBBLE_DURATION);
  }

  // --- Score ---
  function updateScore(delta) {
    score += delta;
    DOM.scoreValue.textContent = score;
    // Animation class
    const cls = delta > 0 ? 'score-up' : 'score-down';
    DOM.scoreValue.classList.add(cls);
    setTimeout(() => DOM.scoreValue.classList.remove(cls), 600);
    save();
  }

  function renderScore() {
    DOM.scoreValue.textContent = score;
  }

  // --- Tab Switching ---
  function switchTab(tabName) {
    DOM.tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    DOM.tabContents.forEach(tc => {
      tc.classList.toggle('active', tc.id === `tab-${tabName}`);
    });
  }

  // --- Temperature / Heat System ---
  function getHeatLevel(task) {
    // Returns 0.0 (frozen/dead) to 1.0 (just updated/hot)
    const now = Date.now();
    const elapsed = now - task.lastUpdatedAt;
    const totalLifespan = CONFIG.DEATH_MS;
    return Math.max(0, Math.min(1, 1 - (elapsed / totalLifespan)));
  }

  function getHeatEmoji(heat) {
    if (heat > 0.75) return '🔥';
    if (heat > 0.5) return '🌡️';
    if (heat > 0.25) return '🥶';
    return '💀';
  }

  function getHeatLabel(heat) {
    if (heat > 0.75) return 'Hot';
    if (heat > 0.5) return 'Warm';
    if (heat > 0.25) return 'Cold';
    return 'Freezing';
  }

  function getHeatColor(heat) {
    // Returns CSS color based on heat
    if (heat > 0.75) return '#22c55e';
    if (heat > 0.5) return '#f59e0b';
    if (heat > 0.25) return '#3b82f6';
    return '#ef4444';
  }

  // --- Task Lifecycle Check ---
  function checkLifecycle() {
    const now = Date.now();
    let changed = false;
    let somethingDied = false;
    let somethingPurgatory = false;

    tasks.forEach(task => {
      if (task.status === 'completed' || task.status === 'dead') return;

      const elapsed = now - task.lastUpdatedAt;
      const heat = getHeatLevel(task);

      // Proactive angel warnings based on heat
      if (task.status === 'active') {
        if (heat <= CONFIG.WARN_COLD_THRESHOLD && !warnedTasks.has(task.id + '_cold')) {
          warnedTasks.add(task.id + '_cold');
          showAngel(randomFrom(ANGEL_MESSAGES.almostDead));
          setTimeout(() => showDevil(randomFrom(DEVIL_MESSAGES.coolingDown)), 2000);
        } else if (heat <= CONFIG.WARN_COOL_THRESHOLD && !warnedTasks.has(task.id + '_cool')) {
          warnedTasks.add(task.id + '_cool');
          showAngel(randomFrom(ANGEL_MESSAGES.coolingDown));
        }
      }

      if (task.status === 'active' && elapsed >= CONFIG.PURGATORY_MS) {
        task.status = 'purgatory';
        task.purgatoryAt = now;
        changed = true;
        somethingPurgatory = true;
      }

      if ((task.status === 'purgatory') && elapsed >= CONFIG.DEATH_MS) {
        task.status = 'dead';
        task.diedAt = now;
        task.deathCount = (task.deathCount || 0) + 1;
        changed = true;
        somethingDied = true;
        updateScore(CONFIG.POINTS_DEATH);
        // Clean up warnings for this task
        warnedTasks.delete(task.id + '_cool');
        warnedTasks.delete(task.id + '_cold');
      }
    });

    if (changed) {
      save();
      renderAll();
    }

    if (somethingDied) {
      showDevil(randomFrom(DEVIL_MESSAGES.taskDead));
    } else if (somethingPurgatory) {
      showDevil(randomFrom(DEVIL_MESSAGES.taskDying));
      setTimeout(() => {
        showAngel(randomFrom(ANGEL_MESSAGES.encouragement));
      }, 2000);
    }
  }

  // --- Render Functions ---
  function createTaskCard(task) {
    const now = Date.now();
    const elapsed = now - task.lastUpdatedAt;
    const isActive = task.status === 'active';
    const isPurgatory = task.status === 'purgatory';
    const heat = getHeatLevel(task);
    const heatPercent = Math.round(heat * 100);
    const heatEmoji = getHeatEmoji(heat);
    const heatLabel = getHeatLabel(heat);
    const heatColor = getHeatColor(heat);

    const card = document.createElement('div');
    card.className = `task-card ${isActive ? 'card-active' : 'card-purgatory'}`;
    card.dataset.id = task.id;

    // Death count badge
    const deathBadge = task.deathCount ? `<span class="death-badge" title="Died ${task.deathCount} time(s)">💀×${task.deathCount}</span>` : '';

    // Time display
    let timerText = '';
    let timerClass = '';
    if (isActive) {
      const msLeft = CONFIG.PURGATORY_MS - elapsed;
      timerText = `⏱ ${timeLeft(msLeft)} left`;
      if (msLeft < CONFIG.PURGATORY_MS * 0.3) timerClass = 'danger';
      else if (msLeft < CONFIG.PURGATORY_MS * 0.6) timerClass = 'warning';
    } else {
      const msLeft = CONFIG.DEATH_MS - elapsed;
      timerText = `💀 ${timeLeft(msLeft)} to death`;
      timerClass = msLeft < (CONFIG.DEATH_MS - CONFIG.PURGATORY_MS) * 0.5 ? 'danger' : 'warning';
    }

    card.innerHTML = `
      <div class="task-status-icon">${heatEmoji}</div>
      <div class="task-info">
        <div class="task-title">${escapeHtml(task.title)} ${deathBadge}</div>
        <div class="task-heat-gauge">
          <div class="heat-track">
            <div class="heat-fill" style="width: ${heatPercent}%; background: ${heatColor}; box-shadow: 0 0 8px ${heatColor};"></div>
          </div>
          <span class="heat-label" style="color: ${heatColor};">${heatLabel} ${heatPercent}%</span>
        </div>
        <div class="task-meta">
          <span class="task-timer ${timerClass}">${timerText}</span>
          <span>Updated ${timeAgo(elapsed)}</span>
        </div>
      </div>
      <div class="task-actions">
        <button class="task-action-btn btn-touch" title="Keep Alive (Touch)" data-action="touch">🔄</button>
        <button class="task-action-btn btn-complete" title="Complete" data-action="complete">✅</button>
        <button class="task-action-btn btn-delete" title="Kill" data-action="delete">💀</button>
      </div>
      <div class="task-progress-bar" style="width: ${heatPercent}%; background: ${heatColor}; box-shadow: 0 0 6px ${heatColor};"></div>
    `;

    // Event listeners
    card.querySelector('[data-action="touch"]').addEventListener('click', () => touchTask(task.id));
    card.querySelector('[data-action="complete"]').addEventListener('click', () => completeTask(task.id, card));
    card.querySelector('[data-action="delete"]').addEventListener('click', () => killTask(task.id, card));

    return card;
  }

  function createTombstone(task) {
    const stone = document.createElement('div');
    stone.className = 'tombstone';
    const deathTally = task.deathCount > 1 ? `<div class="tombstone-tally">Deaths: ${'☠️'.repeat(Math.min(task.deathCount, 5))} ${task.deathCount > 5 ? '+' + (task.deathCount - 5) : ''}</div>` : '';
    stone.innerHTML = `
      <div class="tombstone-rip">R.I.P.</div>
      <div class="tombstone-name">${escapeHtml(task.title)}</div>
      <div class="tombstone-date">${formatDate(task.createdAt)} — ${formatDate(task.diedAt)}</div>
      ${deathTally}
      <div class="tombstone-points">${CONFIG.POINTS_DEATH} pts</div>
      <button class="resurrect-btn" title="Resurrect this task">🔄 Resurrect</button>
    `;
    stone.querySelector('.resurrect-btn').addEventListener('click', () => resurrectTask(task.id));
    return stone;
  }

  function createCloud(task) {
    const cloud = document.createElement('div');
    cloud.className = 'cloud';
    cloud.innerHTML = `
      <div class="cloud-halo">✨</div>
      <div class="cloud-name">${escapeHtml(task.title)}</div>
      <div class="cloud-date">Ascended ${formatDate(task.completedAt)}</div>
      <div class="cloud-points">+${CONFIG.POINTS_COMPLETE} pts</div>
    `;
    return cloud;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderAll() {
    renderActiveTasks();
    renderPurgatoryTasks();
    renderCemetery();
    renderHeaven();
    renderScore();
    updateCounts();
  }

  function renderActiveTasks() {
    const activeTasks = tasks.filter(t => t.status === 'active');
    DOM.activeTasks.innerHTML = '';
    if (activeTasks.length === 0) {
      DOM.activeTasks.appendChild(DOM.activeEmpty.cloneNode(true));
      return;
    }
    // Sort by most urgent first
    activeTasks.sort((a, b) => a.lastUpdatedAt - b.lastUpdatedAt);
    activeTasks.forEach(t => DOM.activeTasks.appendChild(createTaskCard(t)));
  }

  function renderPurgatoryTasks() {
    const purgatoryTasks = tasks.filter(t => t.status === 'purgatory');
    DOM.purgatoryTasks.innerHTML = '';
    if (purgatoryTasks.length === 0) {
      DOM.purgatoryTasks.appendChild(DOM.purgatoryEmpty.cloneNode(true));
      return;
    }
    purgatoryTasks.sort((a, b) => a.lastUpdatedAt - b.lastUpdatedAt);
    purgatoryTasks.forEach(t => DOM.purgatoryTasks.appendChild(createTaskCard(t)));
  }

  function renderCemetery() {
    const deadTasks = tasks.filter(t => t.status === 'dead');
    DOM.cemeteryGrid.innerHTML = '';
    if (deadTasks.length === 0) {
      DOM.cemeteryGrid.appendChild(DOM.cemeteryEmpty.cloneNode(true));
      return;
    }
    deadTasks.sort((a, b) => (b.diedAt || 0) - (a.diedAt || 0));
    deadTasks.forEach(t => DOM.cemeteryGrid.appendChild(createTombstone(t)));
  }

  function renderHeaven() {
    const completedTasks = tasks.filter(t => t.status === 'completed');
    DOM.heavenGrid.innerHTML = '';
    if (completedTasks.length === 0) {
      DOM.heavenGrid.appendChild(DOM.heavenEmpty.cloneNode(true));
      return;
    }
    completedTasks.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
    completedTasks.forEach(t => DOM.heavenGrid.appendChild(createCloud(t)));
  }

  function updateCounts() {
    const active = tasks.filter(t => t.status === 'active').length;
    const purgatory = tasks.filter(t => t.status === 'purgatory').length;
    const dead = tasks.filter(t => t.status === 'dead').length;
    const completed = tasks.filter(t => t.status === 'completed').length;

    DOM.activeCount.textContent = active;
    DOM.purgatoryCount.textContent = purgatory;
    DOM.cemeteryCount.textContent = dead;
    DOM.heavenCount.textContent = completed;
  }

  // --- Task Actions ---
  function addTask(title) {
    title = title.trim();
    if (!title) return;

    const now = Date.now();
    const task = {
      id: generateId(),
      title,
      createdAt: now,
      lastUpdatedAt: now,
      status: 'active',
    };

    tasks.push(task);
    save();
    renderAll();

    showAngel(randomFrom(ANGEL_MESSAGES.taskAdded));

    DOM.taskInput.value = '';
    DOM.taskInput.focus();
  }

  function touchTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const wasInPurgatory = task.status === 'purgatory';

    task.lastUpdatedAt = Date.now();
    task.status = 'active';
    // Reset warnings for this task
    warnedTasks.delete(task.id + '_cool');
    warnedTasks.delete(task.id + '_cold');
    save();
    renderAll();

    if (wasInPurgatory) {
      showAngel(randomFrom(ANGEL_MESSAGES.taskTouched));
      showDevil("Nooo! I almost had it! 😡");
    } else {
      showAngel(randomFrom(ANGEL_MESSAGES.taskTouched));
    }
  }

  function completeTask(id, cardEl) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    // Animate
    if (cardEl) {
      cardEl.classList.add('task-ascending');
    }

    setTimeout(() => {
      task.status = 'completed';
      task.completedAt = Date.now();
      updateScore(CONFIG.POINTS_COMPLETE);
      save();
      renderAll();

      showAngel(randomFrom(ANGEL_MESSAGES.taskCompleted));
      setTimeout(() => {
        showDevil(randomFrom(DEVIL_MESSAGES.taskCompleted));
      }, 1500);
    }, cardEl ? 600 : 0);
  }

  function killTask(id, cardEl) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    if (cardEl) {
      cardEl.classList.add('task-dying');
    }

    setTimeout(() => {
      task.status = 'dead';
      task.diedAt = Date.now();
      updateScore(CONFIG.POINTS_DEATH);
      save();
      renderAll();

      showDevil(randomFrom(DEVIL_MESSAGES.taskDead));
    }, cardEl ? 600 : 0);
  }

  function resurrectTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task || task.status !== 'dead') return;

    task.status = 'active';
    task.lastUpdatedAt = Date.now();
    task.resurrectedAt = Date.now();
    updateScore(CONFIG.POINTS_RESURRECT);
    save();
    renderAll();

    showAngel(randomFrom(ANGEL_MESSAGES.resurrected));
    setTimeout(() => {
      showDevil(randomFrom(DEVIL_MESSAGES.resurrected));
    }, 1500);
  }

  // --- Event Listeners ---
  function initEvents() {
    // Tab navigation
    DOM.tabNav.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;
      switchTab(btn.dataset.tab);
    });

    // Add task
    DOM.addBtn.addEventListener('click', () => {
      addTask(DOM.taskInput.value);
    });

    DOM.taskInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        addTask(DOM.taskInput.value);
      }
    });

    // Angel & Devil click for random messages
    $('#angelAvatar').addEventListener('click', () => {
      showAngel(randomFrom(ANGEL_MESSAGES.encouragement));
    });

    $('#devilAvatar').addEventListener('click', () => {
      showDevil(randomFrom(DEVIL_MESSAGES.idle));
    });
  }

  // --- Initialization ---
  function init() {
    load();
    renderAll();
    initEvents();

    // Welcome messages
    setTimeout(() => {
      showAngel(randomFrom(ANGEL_MESSAGES.welcome));
    }, 500);
    setTimeout(() => {
      showDevil(randomFrom(DEVIL_MESSAGES.welcome));
    }, 2000);

    // Lifecycle check
    checkLifecycle();
    setInterval(checkLifecycle, CONFIG.LIFECYCLE_CHECK_INTERVAL);

    // Update timers every 30 seconds
    setInterval(() => {
      renderActiveTasks();
      renderPurgatoryTasks();
    }, 30000);
  }

  // Start
  init();

})();
