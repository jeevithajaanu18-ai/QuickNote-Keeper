// ===== QuickNote Keeper — script.js =====

(() => {
  'use strict';

  // ── Constants ──
  const STORAGE_KEY = 'quicknote_keeper_notes';
  const NOTE_COLORS = [
    'linear-gradient(135deg,#7c5cfc,#a78bfa)',
    'linear-gradient(135deg,#06b6d4,#22d3ee)',
    'linear-gradient(135deg,#f59e0b,#fbbf24)',
    'linear-gradient(135deg,#ec4899,#f472b6)',
    'linear-gradient(135deg,#10b981,#34d399)',
    'linear-gradient(135deg,#8b5cf6,#c084fc)',
  ];

  // ── DOM References ──
  const titleInput     = document.getElementById('note-title-input');
  const bodyInput      = document.getElementById('note-body-input');
  const addBtn         = document.getElementById('add-note-btn');
  const charCount      = document.getElementById('char-count');
  const searchInput    = document.getElementById('search-input');
  const clearAllBtn    = document.getElementById('clear-all-btn');
  const notesContainer = document.getElementById('notes-container');
  const emptyState     = document.getElementById('empty-state');
  const countBadge     = document.getElementById('note-count-badge');

  // Modal
  const modalOverlay   = document.getElementById('confirm-modal');
  const modalTitle     = document.getElementById('modal-title');
  const modalMessage   = document.getElementById('modal-message');
  const modalCancel    = document.getElementById('modal-cancel-btn');
  const modalConfirm   = document.getElementById('modal-confirm-btn');

  // Toast
  const toast = document.getElementById('toast');

  // ── State ──
  let notes = [];
  let pendingAction = null; // callback held by confirm modal
  let toastTimer = null;

  // ── Helpers ──
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function formatDate(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' · ' +
      d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  function pickColor(index) {
    return NOTE_COLORS[index % NOTE_COLORS.length];
  }

  // ── Local Storage ──
  function loadNotes() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      notes = raw ? JSON.parse(raw) : [];
    } catch {
      notes = [];
    }
  }

  function saveNotes() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }

  // ── Toast ──
  function showToast(message, type = 'default') {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = 'toast';
    if (type === 'danger')  toast.classList.add('toast-danger');
    if (type === 'success') toast.classList.add('toast-success');

    // Force reflow so transition re-triggers if already visible
    void toast.offsetWidth;
    toast.classList.add('visible');

    toastTimer = setTimeout(() => {
      toast.classList.remove('visible');
    }, 2600);
  }

  // ── Confirm Modal ──
  function showModal(title, message, onConfirm) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    pendingAction = onConfirm;
    modalOverlay.classList.remove('hidden');
  }

  function hideModal() {
    modalOverlay.classList.add('hidden');
    pendingAction = null;
  }

  modalCancel.addEventListener('click', hideModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) hideModal();
  });
  modalConfirm.addEventListener('click', () => {
    if (pendingAction) pendingAction();
    hideModal();
  });

  // ── Render ──
  function updateBadge() {
    const len = notes.length;
    countBadge.textContent = len === 1 ? '1 note' : `${len} notes`;
  }

  function toggleEmpty(filteredLen) {
    const count = filteredLen !== undefined ? filteredLen : notes.length;
    emptyState.classList.toggle('hidden', count > 0);
  }

  function createNoteElement(note, index) {
    const card = document.createElement('div');
    card.className = 'note-card';
    card.dataset.id = note.id;
    card.style.setProperty('--stripe-color', pickColor(index));
    card.style.animationDelay = `${index * 0.06}s`;

    card.innerHTML = `
      <div class="note-title">${escapeHtml(note.title || 'Untitled')}</div>
      <div class="note-body">${escapeHtml(note.body)}</div>
      <div class="note-meta">
        <span class="note-date">${formatDate(note.createdAt)}</span>
        <button class="note-delete-btn" title="Delete note" aria-label="Delete note">🗑️</button>
      </div>
    `;

    // Delete button
    card.querySelector('.note-delete-btn').addEventListener('click', () => {
      deleteNote(note.id, card);
    });

    return card;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function renderNotes(filter = '') {
    notesContainer.innerHTML = '';
    const term = filter.trim().toLowerCase();

    const filtered = term
      ? notes.filter(n =>
          n.title.toLowerCase().includes(term) ||
          n.body.toLowerCase().includes(term)
        )
      : notes;

    filtered.forEach((note, i) => {
      notesContainer.appendChild(createNoteElement(note, i));
    });

    updateBadge();
    toggleEmpty(filtered.length);
  }

  // ── CRUD ──
  function addNote() {
    const title = titleInput.value.trim();
    const body  = bodyInput.value.trim();
    if (!body && !title) return;

    const note = {
      id: generateId(),
      title,
      body,
      createdAt: Date.now(),
    };

    notes.unshift(note);
    saveNotes();

    // Reset inputs
    titleInput.value = '';
    bodyInput.value  = '';
    updateAddBtn();
    updateCharCount();

    renderNotes(searchInput.value);
    showToast('Note added!', 'success');
    titleInput.focus();
  }

  function deleteNote(id, cardEl) {
    // Animate out
    cardEl.classList.add('removing');
    cardEl.addEventListener('animationend', () => {
      notes = notes.filter(n => n.id !== id);
      saveNotes();
      renderNotes(searchInput.value);
      showToast('Note deleted', 'danger');
    }, { once: true });
  }

  function clearAllNotes() {
    if (notes.length === 0) return;
    showModal(
      'Delete all notes?',
      `This will permanently remove ${notes.length} note${notes.length > 1 ? 's' : ''}.`,
      () => {
        notes = [];
        saveNotes();
        renderNotes();
        showToast('All notes cleared', 'danger');
      }
    );
  }

  // ── Input Handling ──
  function updateAddBtn() {
    const hasContent = titleInput.value.trim() || bodyInput.value.trim();
    addBtn.disabled = !hasContent;
  }

  function updateCharCount() {
    const len = bodyInput.value.length;
    charCount.textContent = `${len} character${len !== 1 ? 's' : ''}`;
  }

  titleInput.addEventListener('input', updateAddBtn);
  bodyInput.addEventListener('input', () => {
    updateAddBtn();
    updateCharCount();
  });

  // Submit on Enter in title (if body has content)
  titleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      bodyInput.focus();
    }
  });

  // Ctrl/Cmd + Enter to add note from textarea
  bodyInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!addBtn.disabled) addNote();
    }
  });

  addBtn.addEventListener('click', addNote);
  clearAllBtn.addEventListener('click', clearAllNotes);

  // ── Search (debounced) ──
  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      renderNotes(searchInput.value);
    }, 200);
  });

  // ── Init ──
  loadNotes();
  renderNotes();
  updateCharCount();
})();
