// frontend/src/ui/AdminUI.js
// Drives admin.html: sign-in, question bank CRUD, and user admin-flag toggling.
// Every request here hits the Node backend's /api/admin/* routes, which
// require both a valid JWT and isAdmin === true on that user.

const API_BASE = window.QUIZNEST_API_BASE || 'http://localhost:4000/api';

let token = localStorage.getItem('quiznest_token') || null;

const els = {
  authStatus: document.getElementById('admin-auth-status'),
  username: document.getElementById('admin-username'),
  password: document.getElementById('admin-password'),
  loginBtn: document.getElementById('admin-login-btn'),
  newQuestionBtn: document.getElementById('new-question-btn'),
  generateBtn: document.getElementById('generate-questions-btn'),
  generateCategory: document.getElementById('generate-category'),
  generateCount: document.getElementById('generate-count'),
  generateStatus: document.getElementById('generate-status'),
  formWrapper: document.getElementById('question-form-wrapper'),
  editId: document.getElementById('edit-question-id'),
  category: document.getElementById('q-category'),
  difficulty: document.getElementById('q-difficulty'),
  text: document.getElementById('q-text'),
  opt0: document.getElementById('q-opt-0'),
  opt1: document.getElementById('q-opt-1'),
  opt2: document.getElementById('q-opt-2'),
  opt3: document.getElementById('q-opt-3'),
  correctIndex: document.getElementById('q-correct-index'),
  saveBtn: document.getElementById('save-question-btn'),
  cancelBtn: document.getElementById('cancel-question-btn'),
  questionsBody: document.getElementById('questions-table-body'),
  usersBody: document.getElementById('users-table-body'),
};

async function apiRequest(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

async function login() {
  try {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: els.username.value.trim(), password: els.password.value }),
    });
    token = data.token;
    localStorage.setItem('quiznest_token', token);
    els.authStatus.textContent = `Signed in as ${data.user.username}. Loading admin data…`;
    els.authStatus.className = 'text-[11px] text-neon-green mt-2';
    await refreshAll();
  } catch (err) {
    els.authStatus.textContent = err.message;
    els.authStatus.className = 'text-[11px] text-neon-crimson mt-2';
  }
}

els.loginBtn.addEventListener('click', login);

/* -------------------------------------------------------------------------- */
/* Question form                                                             */
/* -------------------------------------------------------------------------- */
function resetForm() {
  els.editId.value = '';
  els.category.value = 'programming';
  els.difficulty.value = 'medium';
  els.text.value = '';
  els.opt0.value = '';
  els.opt1.value = '';
  els.opt2.value = '';
  els.opt3.value = '';
  els.correctIndex.value = '';
}

els.newQuestionBtn.addEventListener('click', () => {
  resetForm();
  els.formWrapper.classList.remove('hidden');
});

els.generateBtn.addEventListener('click', async () => {
  const category = els.generateCategory.value;
  const count = Number(els.generateCount.value) || 10;

  els.generateStatus.textContent = `Generating ${count} questions for "${category}"…`;
  els.generateBtn.disabled = true;

  try {
    const data = await apiRequest('/admin/generate-questions', {
      method: 'POST',
      body: JSON.stringify({ category, count }),
    });
    els.generateStatus.textContent = `✓ Added ${data.insertedCount} questions (mode: ${data.mode}).`;
    els.generateStatus.className = 'text-[11px] text-neon-green mb-3';
    await loadQuestions();
  } catch (err) {
    els.generateStatus.textContent = `Failed: ${err.message}`;
    els.generateStatus.className = 'text-[11px] text-neon-crimson mb-3';
  } finally {
    els.generateBtn.disabled = false;
  }
});

els.cancelBtn.addEventListener('click', () => {
  els.formWrapper.classList.add('hidden');
});

els.saveBtn.addEventListener('click', async () => {
  const payload = {
    category: els.category.value,
    difficulty: els.difficulty.value,
    questionText: els.text.value.trim(),
    options: [els.opt0.value, els.opt1.value, els.opt2.value, els.opt3.value].map((o) => o.trim()),
    correctOptionIndex: Number(els.correctIndex.value),
  };

  try {
    if (els.editId.value) {
      await apiRequest(`/admin/questions/${els.editId.value}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      await apiRequest('/admin/questions', { method: 'POST', body: JSON.stringify(payload) });
    }
    els.formWrapper.classList.add('hidden');
    await loadQuestions();
  } catch (err) {
    alert(`Failed to save question: ${err.message}`);
  }
});

function editQuestion(question) {
  els.editId.value = question._id;
  els.category.value = question.category;
  els.difficulty.value = question.difficulty || 'medium';
  els.text.value = question.questionText;
  [els.opt0, els.opt1, els.opt2, els.opt3].forEach((el, i) => {
    el.value = question.options[i] || '';
  });
  els.correctIndex.value = question.correctOptionIndex;
  els.formWrapper.classList.remove('hidden');
}

async function deleteQuestion(id) {
  if (!confirm('Delete this question permanently?')) return;
  try {
    await apiRequest(`/admin/questions/${id}`, { method: 'DELETE' });
    await loadQuestions();
  } catch (err) {
    alert(`Failed to delete: ${err.message}`);
  }
}

async function loadQuestions() {
  const { questions } = await apiRequest('/admin/questions');
  els.questionsBody.innerHTML = questions
    .map(
      (q) => `
      <tr data-id="${q._id}">
        <td class="py-2 pr-3 text-neon-cyan">${q.category}</td>
        <td class="py-2 pr-3 max-w-xs truncate">${escapeHtml(q.questionText)}</td>
        <td class="py-2 pr-3 text-neon-green">${escapeHtml(q.options[q.correctOptionIndex] || '')}</td>
        <td class="py-2 pr-3 text-white/50">${q.difficulty || 'medium'}</td>
        <td class="py-2 pr-3 whitespace-nowrap">
          <button class="edit-btn text-neon-amber hover:underline mr-2">Edit</button>
          <button class="delete-btn text-neon-crimson hover:underline">Delete</button>
        </td>
      </tr>`
    )
    .join('');

  els.questionsBody.querySelectorAll('tr').forEach((row) => {
    const id = row.dataset.id;
    const question = questions.find((q) => q._id === id);
    row.querySelector('.edit-btn').addEventListener('click', () => editQuestion(question));
    row.querySelector('.delete-btn').addEventListener('click', () => deleteQuestion(id));
  });
}

/* -------------------------------------------------------------------------- */
/* User management                                                            */
/* -------------------------------------------------------------------------- */
async function toggleAdmin(userId, currentValue) {
  try {
    await apiRequest(`/admin/users/${userId}/admin`, {
      method: 'PUT',
      body: JSON.stringify({ isAdmin: !currentValue }),
    });
    await loadUsers();
  } catch (err) {
    alert(`Failed to update user: ${err.message}`);
  }
}

async function loadUsers() {
  const { users } = await apiRequest('/admin/users');
  els.usersBody.innerHTML = users
    .map(
      (u) => `
      <tr data-id="${u._id}">
        <td class="py-2 pr-3">${escapeHtml(u.username)}</td>
        <td class="py-2 pr-3 text-neon-cyan">${u.xp}</td>
        <td class="py-2 pr-3">${u.level}</td>
        <td class="py-2 pr-3 text-white/50">${(u.badges || []).length}</td>
        <td class="py-2 pr-3">${u.isAdmin ? '✅' : '—'}</td>
        <td class="py-2 pr-3">
          <button class="toggle-admin-btn text-xs px-2 py-1 rounded bg-white/5 border border-white/10 hover:border-neon-cyan">
            ${u.isAdmin ? 'Revoke' : 'Grant'} Admin
          </button>
        </td>
      </tr>`
    )
    .join('');

  els.usersBody.querySelectorAll('tr').forEach((row) => {
    const id = row.dataset.id;
    const user = users.find((u) => u._id === id);
    row.querySelector('.toggle-admin-btn').addEventListener('click', () => toggleAdmin(id, user.isAdmin));
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function refreshAll() {
  await Promise.all([loadQuestions(), loadUsers()]);
}

// Attempt to auto-load if a token already exists from a previous session.
if (token) {
  els.authStatus.textContent = 'Restoring session…';
  refreshAll().catch(() => {
    els.authStatus.textContent = 'Session expired or not an admin — please sign in again.';
    els.authStatus.className = 'text-[11px] text-neon-amber mt-2';
  });
}
