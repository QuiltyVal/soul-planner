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

  // --- XP per heat level ---
  function getXpForHeat(heat) {
    if (heat > 0.75) return 100;
    if (heat > 0.5) return 75;
    if (heat > 0.25) return 50;
    return 25;
  }

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

  // --- Tab-specific status messages ---
  const TAB_MESSAGES = {
    active: 'SOULS AWAIT JUDGMENT IN PURGATORY...',
    heaven: 'WELL DONE, PURE SOUL! ASCENSION COMPLETE!',
    cemetery: 'REST IN PEACE, LOST TASKS...',
    reports: 'REVIEWING THE HARVEST OF SOULS...',
  };

  // --- Accolades / Badges ---
  const ACCOLADES = [
    { id: 'first_ascend', icon: '💀', name: 'First Blood', desc: 'Ascend your first soul', check: (s) => s.totalAscended >= 1 },
    { id: 'fire_starter', icon: '🔥', name: 'Fire Starter', desc: 'Ascend 5 souls', check: (s) => s.totalAscended >= 5 },
    { id: 'scroll_master', icon: '📜', name: 'Scroll Master', desc: 'Ascend 10 souls', check: (s) => s.totalAscended >= 10 },
    { id: 'time_keeper', icon: '⌛', name: 'Time Keeper', desc: 'Keep a soul alive 24h', check: (s) => s.score >= 50 },
    { id: 'sword_wielder', icon: '⚔️', name: 'Sword Wielder', desc: 'Reach 100 XP', check: (s) => s.score >= 100 },
    { id: 'crown_bearer', icon: '👑', name: 'Crown Bearer', desc: 'Reach 200 XP', check: (s) => s.score >= 200 },
    { id: 'moon_walker', icon: '🌑', name: 'Moon Walker', desc: 'Resurrect a soul', check: (s) => s.totalResurrected >= 1 },
    { id: 'star_lord', icon: '🌟', name: 'Star Lord', desc: 'Reach 500 XP', check: (s) => s.score >= 500 },
  ];

  // --- Rank System ---
  function getRank(score) {
    if (score >= 500) return 'SOUL REAPER MASTER';
    if (score >= 200) return 'ARCH SOUL WARDEN';
    if (score >= 100) return 'SOUL WARDEN';
    if (score >= 50) return 'APPRENTICE REAPER';
    if (score >= 20) return 'SOUL NOVICE';
    return 'LOST SOUL';
  }

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
    statusMessage: $('#statusMessage'),
    // Reports
    totalAscended: $('#totalAscended'),
    totalSacrificed: $('#totalSacrificed'),
    decayChart: $('#decayChart'),
    accoladesGrid: $('#accoladesGrid'),
    rankDisplay: $('#rankDisplay'),
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
    DOM.angelBubble.classList.add('visible');
    angelTimeout = setTimeout(() => {
      DOM.angelBubble.classList.remove('visible');
    }, CONFIG.BUBBLE_DURATION);
  }

  function showDevil(message) {
    clearTimeout(devilTimeout);
    DOM.devilMessage.textContent = message;
    DOM.devilBubble.classList.add('visible');
    devilTimeout = setTimeout(() => {
      DOM.devilBubble.classList.remove('visible');
    }, CONFIG.BUBBLE_DURATION);
  }

  // --- Score ---
  function updateScore(delta) {
    score += delta;
    DOM.scoreValue.textContent = score;
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

    // Update status bar message
    const msg = TAB_MESSAGES[tabName] || '';
    if (msg && DOM.statusMessage) {
      DOM.statusMessage.textContent = msg;
    }
  }

  // --- Temperature / Heat System ---
  function getHeatLevel(task) {
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
    if (heat > 0.75) return 'BURNING';
    if (heat > 0.5) return 'WARM';
    if (heat > 0.25) return 'COLD';
    return 'DYING';
  }

  function getHeatColor(heat) {
    if (heat > 0.75) return '#00cc44';
    if (heat > 0.5) return '#ff9933';
    if (heat > 0.25) return '#3399ff';
    return '#ff3333';
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
    const heat = getHeatLevel(task);
    const heatPercent = Math.round(heat * 100);
    const heatEmoji = getHeatEmoji(heat);
    const heatLabel = getHeatLabel(heat);
    const heatColor = getHeatColor(heat);
    const xp = getXpForHeat(heat);

    // Time display
    let timerText = '';
    if (isActive) {
      const msLeft = CONFIG.PURGATORY_MS - elapsed;
      timerText = `${timeLeft(msLeft)} left`;
    } else {
      const msLeft = CONFIG.DEATH_MS - elapsed;
      timerText = `${timeLeft(msLeft)} to death`;
    }

    const card = document.createElement('div');
    card.className = 'task-card';
    card.dataset.id = task.id;

    card.innerHTML = `
      <span class="heat-emoji">${heatEmoji}</span>
      <div style="flex:1;">
        <div class="task-name">${escapeHtml(task.title)}</div>
        <div class="task-heat-gauge">
          <div class="heat-track">
            <div class="heat-fill" style="width: ${heatPercent}%; background: ${heatColor};"></div>
          </div>
          <span class="heat-label" style="color: ${heatColor};">${heatLabel}</span>
        </div>
        <div class="task-meta">${timerText} · Updated ${timeAgo(elapsed)}</div>
      </div>
      <span class="xp-badge">+${xp} XP</span>
      <div class="task-actions">
        <button class="task-btn complete-btn" data-action="complete" title="Ascend">ASCEND</button>
        <button class="task-btn touch-btn" data-action="touch" title="Touch">🔄</button>
        <button class="task-btn kill-btn" data-action="kill" title="Doom">DOOM</button>
      </div>
    `;

    card.querySelector('[data-action="touch"]').addEventListener('click', () => touchTask(task.id));
    card.querySelector('[data-action="complete"]').addEventListener('click', () => completeTask(task.id, card));
    card.querySelector('[data-action="kill"]').addEventListener('click', () => killTask(task.id, card));

    return card;
  }

  function createTombstone(task) {
    const stone = document.createElement('div');
    stone.className = 'tombstone';
    stone.innerHTML = `
      <div class="tomb-name">${escapeHtml(task.title)}</div>
      <div class="tomb-date">${formatDate(task.diedAt || task.createdAt)}</div>
      <div class="tombstone-base"></div>
      <button class="resurrect-btn" title="Resurrect">↺ RESURRECT</button>
    `;
    stone.querySelector('.resurrect-btn').addEventListener('click', () => resurrectTask(task.id));
    return stone;
  }

  function createCloud(task) {
    const cloud = document.createElement('div');
    cloud.className = 'cloud-card';
    cloud.innerHTML = `
      <span class="cloud-name">${escapeHtml(task.title)}</span>
      <span class="cloud-date">${formatDate(task.completedAt)}</span>
      <span class="xp-badge">+${CONFIG.POINTS_COMPLETE * 10} XP</span>
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
    renderReports();
    renderScore();
    updateCounts();
  }

  function renderActiveTasks() {
    const activeTasks = tasks.filter(t => t.status === 'active');
    DOM.activeTasks.innerHTML = '';
    if (activeTasks.length === 0) {
      DOM.activeEmpty.style.display = '';
      DOM.activeTasks.appendChild(DOM.activeEmpty);
      return;
    }
    DOM.activeEmpty.style.display = 'none';
    activeTasks.sort((a, b) => a.lastUpdatedAt - b.lastUpdatedAt);
    activeTasks.forEach(t => DOM.activeTasks.appendChild(createTaskCard(t)));
  }

  function renderPurgatoryTasks() {
    const purgatoryTasks = tasks.filter(t => t.status === 'purgatory');
    DOM.purgatoryTasks.innerHTML = '';
    if (purgatoryTasks.length === 0) {
      if (DOM.purgatoryEmpty) {
        DOM.purgatoryEmpty.style.display = 'none';
      }
      return;
    }
    purgatoryTasks.sort((a, b) => a.lastUpdatedAt - b.lastUpdatedAt);
    purgatoryTasks.forEach(t => DOM.purgatoryTasks.appendChild(createTaskCard(t)));
  }

  function renderCemetery() {
    const deadTasks = tasks.filter(t => t.status === 'dead');
    DOM.cemeteryGrid.innerHTML = '';
    if (deadTasks.length === 0) {
      DOM.cemeteryEmpty.style.display = '';
      DOM.cemeteryGrid.appendChild(DOM.cemeteryEmpty);
      return;
    }
    DOM.cemeteryEmpty.style.display = 'none';
    deadTasks.sort((a, b) => (b.diedAt || 0) - (a.diedAt || 0));
    deadTasks.forEach(t => DOM.cemeteryGrid.appendChild(createTombstone(t)));
  }

  function renderHeaven() {
    const completedTasks = tasks.filter(t => t.status === 'completed');
    DOM.heavenGrid.innerHTML = '';
    if (completedTasks.length === 0) {
      DOM.heavenEmpty.style.display = '';
      DOM.heavenGrid.appendChild(DOM.heavenEmpty);
      return;
    }
    DOM.heavenEmpty.style.display = 'none';
    completedTasks.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
    completedTasks.forEach(t => DOM.heavenGrid.appendChild(createCloud(t)));
  }

  // --- Reports Rendering ---
  function renderReports() {
    const totalAscended = tasks.filter(t => t.status === 'completed').length;
    const totalSacrificed = tasks.filter(t => t.status === 'dead').length;
    const totalResurrected = tasks.filter(t => t.resurrectedAt).length;

    // Stats
    if (DOM.totalAscended) DOM.totalAscended.textContent = totalAscended;
    if (DOM.totalSacrificed) DOM.totalSacrificed.textContent = totalSacrificed;

    // Rank
    if (DOM.rankDisplay) {
      DOM.rankDisplay.textContent = `RANK: ${getRank(score)}`;
    }

    // Decay Velocity Chart (last 7 days of deaths)
    if (DOM.decayChart) {
      DOM.decayChart.innerHTML = '';
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      let maxDeaths = 1;

      // Count deaths per day for last 7 days
      const deathsPerDay = [];
      for (let i = 6; i >= 0; i--) {
        const dayStart = now - (i * dayMs);
        const dayEnd = dayStart + dayMs;
        const count = tasks.filter(t =>
          t.status === 'dead' && t.diedAt && t.diedAt >= dayStart && t.diedAt < dayEnd
        ).length;
        deathsPerDay.push(count);
        if (count > maxDeaths) maxDeaths = count;
      }

      deathsPerDay.forEach((count, i) => {
        const bar = document.createElement('div');
        bar.className = 'decay-bar';
        const h = Math.max(8, (count / maxDeaths) * 80);
        const hue = count === 0 ? 120 : Math.max(0, 120 - (count / maxDeaths) * 120);
        bar.style.height = h + 'px';
        bar.style.background = `hsl(${hue}, 70%, 50%)`;
        bar.title = `${count} deaths`;
        DOM.decayChart.appendChild(bar);
      });
    }

    // Accolades
    if (DOM.accoladesGrid) {
      DOM.accoladesGrid.innerHTML = '';
      const stats = { totalAscended, totalSacrificed, totalResurrected, score };

      ACCOLADES.forEach(acc => {
        const unlocked = acc.check(stats);
        const el = document.createElement('div');
        el.className = `accolade ${unlocked ? '' : 'locked'}`;
        el.title = acc.desc;
        el.innerHTML = `
          <span class="accolade-icon">${unlocked ? acc.icon : '🔒'}</span>
          <span class="accolade-name">${acc.name}</span>
        `;
        DOM.accoladesGrid.appendChild(el);
      });
    }
  }

  function updateCounts() {
    const active = tasks.filter(t => t.status === 'active').length;
    const purgatory = tasks.filter(t => t.status === 'purgatory').length;
    const dead = tasks.filter(t => t.status === 'dead').length;
    const completed = tasks.filter(t => t.status === 'completed').length;

    // Update tab labels with counts
    DOM.tabBtns.forEach(btn => {
      const tab = btn.dataset.tab;
      const label = btn.querySelector('.tab-label');
      if (!label) return;
      if (tab === 'active') {
        label.textContent = (active + purgatory) > 0 ? `Purgatory (${active + purgatory})` : 'Purgatory';
      } else if (tab === 'heaven') {
        label.textContent = completed > 0 ? `Ascended (${completed})` : 'Ascended';
      } else if (tab === 'cemetery') {
        label.textContent = dead > 0 ? `Cemetery (${dead})` : 'Cemetery';
      }
    });

    // Update status bar
    if (DOM.statusMessage) {
      if (active + purgatory === 0 && dead === 0 && completed === 0) {
        DOM.statusMessage.textContent = 'PURGATORY IS EMPTY! SUMMON A TASK TO BEGIN THE TORMENT!';
      }
    }
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

    if (cardEl) {
      cardEl.style.opacity = '0.5';
      cardEl.style.transform = 'translateY(-20px)';
      cardEl.style.transition = 'all 0.4s ease';
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
    }, cardEl ? 400 : 0);
  }

  function killTask(id, cardEl) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    if (cardEl) {
      cardEl.style.opacity = '0.3';
      cardEl.style.transform = 'translateX(20px)';
      cardEl.style.transition = 'all 0.4s ease';
    }

    setTimeout(() => {
      task.status = 'dead';
      task.diedAt = Date.now();
      task.deathCount = (task.deathCount || 0) + 1;
      updateScore(CONFIG.POINTS_DEATH);
      save();
      renderAll();

      showDevil(randomFrom(DEVIL_MESSAGES.taskDead));
    }, cardEl ? 400 : 0);
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
