// ---------- Shared state (sessionStorage-backed) ----------

function loadResults() {
  const raw = sessionStorage.getItem('jh_results');
  return raw ? JSON.parse(raw) : { jobs: [], courses: [] };
}
function saveResults(data) {
  sessionStorage.setItem('jh_results', JSON.stringify(data));
}
function getDrafts() {
  const raw = sessionStorage.getItem('jh_drafts');
  return raw ? JSON.parse(raw) : {};
}
function saveDrafts(drafts) {
  sessionStorage.setItem('jh_drafts', JSON.stringify(drafts));
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function bandOf(score) {
  if (score >= 70) return { label: 'Strong match', cls: 'band-strong' };
  if (score >= 40) return { label: 'Possible match', cls: 'band-possible' };
  return { label: 'Limited match', cls: 'band-limited' };
}

function showAlert(containerId, message, kind) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `<div class="alert alert-${kind}">${escapeHtml(message)}</div>`;
}
function clearAlert(containerId) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = '';
}

// ---------- Toasts ----------

function showToast(message, kind = 'error') {
  const container = document.getElementById('toast-container');
  if (!container) { console.warn(message); return; }
  const toast = document.createElement('div');
  toast.className = `toast toast-${kind}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

// ---------- Theme ----------

function initTheme() {
  const saved = localStorage.getItem('jh_theme');
  if (saved === 'light') document.documentElement.setAttribute('data-theme', 'light');
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.addEventListener('click', toggleTheme);
}
function toggleTheme() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  if (isLight) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('jh_theme', 'dark');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('jh_theme', 'light');
  }
}

// ---------- Tip ticker (empty state) ----------

const CAREER_TIPS = [
  "Tailor your target role field — broader terms like \"AI Engineer\" surface more matches than narrow ones.",
  "The location field affects scoring directly — on-site roles outside it get capped at a low score.",
  "Open a role's card to see exactly which skills matched and which are missing before drafting.",
  "Every draft is reviewed for unsupported claims before it reaches you — nothing sends itself.",
  "The skill coverage chart shows your strongest skills across every matched role, not just one.",
];

let tipInterval = null;
function startTipTicker() {
  const area = document.getElementById('tip-ticker-area');
  if (!area) return;
  let i = 0;
  area.innerHTML = `
    <div class="tip-ticker">
      <div class="tip-label">CAREER TIP</div>
      ${CAREER_TIPS.map((t, idx) => `<div class="tip-item${idx === 0 ? ' active' : ''}">${escapeHtml(t)}</div>`).join('')}
    </div>
  `;
  const items = area.querySelectorAll('.tip-item');
  clearInterval(tipInterval);
  tipInterval = setInterval(() => {
    items[i].classList.remove('active');
    i = (i + 1) % items.length;
    items[i].classList.add('active');
  }, 4500);
}
function stopTipTicker() {
  clearInterval(tipInterval);
  const area = document.getElementById('tip-ticker-area');
  if (area) area.innerHTML = '';
}

// ---------- Score ring ----------

function scoreRingSvg(score, bandCls) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const target = c - (Math.max(0, Math.min(100, score)) / 100) * c;
  return `
    <svg class="score-ring" width="40" height="40" viewBox="0 0 40 40">
      <circle class="ring-track" cx="20" cy="20" r="${r}" fill="none"></circle>
      <circle class="ring-fill ${bandCls}" cx="20" cy="20" r="${r}" fill="none"
        stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${c.toFixed(2)}"
        data-target-offset="${target.toFixed(2)}"></circle>
      <text x="20" y="24" text-anchor="middle" class="ring-text mono">${score}</text>
    </svg>
  `;
}

function animateRings(scope) {
  const rings = scope.querySelectorAll('.ring-fill');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    rings.forEach(r => { r.style.strokeDashoffset = r.dataset.targetOffset; });
  }));
}

function fadeInRows(scope, selector) {
  const rows = scope.querySelectorAll(selector);
  rows.forEach(row => row.classList.add('enter'));
  requestAnimationFrame(() => requestAnimationFrame(() => {
    rows.forEach((row, i) => {
      row.style.transitionDelay = `${Math.min(i * 40, 400)}ms`;
      row.classList.remove('enter');
    });
  }));
}

// ============================================================
// HOME PAGE
// ============================================================

let selectedFile = null;
const filters = { minScore: 0, levels: new Set(), sources: new Set() };

function initHomePage() {
  const uploadZone = document.getElementById('upload-zone');
  const cvInput = document.getElementById('cv-input');
  if (!uploadZone) return;

  uploadZone.addEventListener('click', () => cvInput.click());
  uploadZone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') cvInput.click(); });
  cvInput.addEventListener('change', () => {
    if (cvInput.files.length) {
      selectedFile = cvInput.files[0];
      uploadZone.classList.add('has-file');
      document.getElementById('upload-label').innerHTML =
        `<div class="filename">${escapeHtml(selectedFile.name)}</div><div class="hint">Click to change</div>`;
    }
  });

  document.getElementById('search-btn').addEventListener('click', runSearch);
  document.getElementById('score-slider').addEventListener('input', (e) => {
    filters.minScore = parseInt(e.target.value, 10);
    document.getElementById('score-val').textContent = filters.minScore;
    renderJobs();
  });

  const saved = loadResults();
  if (saved.jobs && saved.jobs.length) {
    renderAll(saved);
  } else {
    startTipTicker();
  }
}

async function runSearch() {
  clearAlert('search-alert');

  if (!selectedFile) { showAlert('search-alert', 'Upload a CV to continue.', 'error'); return; }
  const role = document.getElementById('role-input').value.trim();
  if (!role) { showAlert('search-alert', 'Enter a target role to continue.', 'error'); return; }
  const location = document.getElementById('location-input').value.trim();

  const btn = document.getElementById('search-btn');
  const spinner = document.getElementById('search-spinner');
  const spinnerMsg = document.getElementById('spinner-msg');
  btn.disabled = true;
  spinner.style.display = 'flex';
  spinnerMsg.textContent = 'Reading CV and searching job sources...';

  const form = new FormData();
  form.append('cv', selectedFile);
  form.append('role', role);
  form.append('location', location);

  try {
    spinnerMsg.textContent = 'Scoring roles against the CV — this can take a minute...';
    const resp = await fetch('/api/search', { method: 'POST', body: form });
    const data = await resp.json();

    if (!resp.ok) {
      showAlert('search-alert', data.error || 'Something went wrong. Please try again.', 'error');
      showToast(data.error || 'Search failed.', 'error');
      return;
    }

    if (!data.jobs.length) {
      const kw = (data.keywords || []).join(', ');
      showAlert('search-alert',
        `No open roles matched: ${kw}. These sources lean toward software and technology roles, so some fields return little. Try a broader or more common title.`,
        'warning');
    } else {
      showToast(`Scored ${data.jobs.length} roles.`, 'success');
    }

    saveResults(data);
    saveDrafts({});
    renderAll(data);
  } catch (err) {
    showAlert('search-alert', 'Could not reach the server. Is it still running?', 'error');
    showToast('Could not reach the server. Is it still running?', 'error');
  } finally {
    btn.disabled = false;
    spinner.style.display = 'none';
  }
}

function renderAll(data) {
  const jobs = data.jobs || [];
  const courses = data.courses || [];

  stopTipTicker();

  const levels = [...new Set(jobs.map(j => j.score.experience_level))].sort();
  const sources = [...new Set(jobs.map(j => j.job.source))].sort();

  document.getElementById('filters-block').style.display = jobs.length ? 'block' : 'none';
  renderChipGroup('level-chips', levels, filters.levels);
  renderChipGroup('source-chips', sources, filters.sources);

  renderStats(jobs);
  renderSkillChart(jobs);
  renderJobs();
  renderCourses(courses);
}

function renderChipGroup(containerId, options, selectedSet) {
  const el = document.getElementById(containerId);
  el.innerHTML = options.map(opt => `
    <button class="chip" data-value="${escapeHtml(opt)}">${escapeHtml(opt)}</button>
  `).join('');
  el.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const val = chip.dataset.value;
      if (selectedSet.has(val)) { selectedSet.delete(val); chip.classList.remove('selected'); }
      else { selectedSet.add(val); chip.classList.add('selected'); }
      renderJobs();
    });
  });
}

function renderStats(jobs) {
  const area = document.getElementById('results-area');
  if (!jobs.length) {
    area.innerHTML = '<div class="empty-state">No roles scored yet. Fill in the candidate profile on the left and select <b>Find matching roles</b>.</div>';
    return;
  }
  const scores = jobs.map(j => j.score.fit_score);
  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const strong = scores.filter(s => s >= 70).length;

  area.innerHTML = `
    <div class="stats-row">
      <div class="stat"><div class="num mono">${jobs.length}</div><div class="label">Roles reviewed</div></div>
      <div class="stat"><div class="num mono">${avg}</div><div class="label">Average fit</div></div>
      <div class="stat"><div class="num mono">${strong}</div><div class="label">Strong matches</div></div>
    </div>
    <div id="skill-chart-area"></div>
    <div class="results-summary" id="results-summary"></div>
    <div id="job-list"></div>
  `;
}

function renderSkillChart(jobs) {
  const area = document.getElementById('skill-chart-area');
  if (!area) return;
  if (!jobs.length) { area.innerHTML = ''; return; }

  const counts = {};
  jobs.forEach(j => (j.score.matched_skills || []).forEach(s => {
    const key = s.trim();
    if (!key) return;
    counts[key] = (counts[key] || 0) + 1;
  }));
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!top.length) { area.innerHTML = ''; return; }
  const max = top[0][1];

  area.innerHTML = `
    <div class="skill-chart-card">
      <h2 style="font-size:1.1rem; margin-bottom:0.9rem;">Skill coverage across matched roles</h2>
      ${top.map(([skill, count]) => `
        <div class="skill-bar-row">
          <div class="skill-bar-label" title="${escapeHtml(skill)}">${escapeHtml(skill)}</div>
          <div class="skill-bar-track"><div class="skill-bar-fill" data-target="${Math.round(count / max * 100)}"></div></div>
          <div class="skill-bar-count mono">${count}</div>
        </div>
      `).join('')}
    </div>
  `;

  requestAnimationFrame(() => requestAnimationFrame(() => {
    area.querySelectorAll('.skill-bar-fill').forEach(el => {
      el.style.width = el.dataset.target + '%';
    });
  }));
}

function renderJobs() {
  const data = loadResults();
  const jobs = data.jobs || [];
  if (!jobs.length) return;

  const filtered = jobs.filter(j =>
    j.score.fit_score >= filters.minScore &&
    (filters.sources.size === 0 || filters.sources.has(j.job.source)) &&
    (filters.levels.size === 0 || filters.levels.has(j.score.experience_level))
  );

  const summary = document.getElementById('results-summary');
  if (summary) summary.textContent = `Showing ${filtered.length} of ${jobs.length} roles`;

  // The single highest-scoring job in the FULL unfiltered set gets the top-pick badge,
  // so it stays consistent regardless of which filters are active.
  const topJobId = jobs.length
    ? jobs.reduce((best, j) => (j.score.fit_score > best.score.fit_score ? j : best), jobs[0]).job.id
    : null;

  const drafts = getDrafts();
  const list = document.getElementById('job-list');
  if (!list) return;

  list.innerHTML = filtered.map(item => {
    const { job, score } = item;
    const band = bandOf(score.fit_score);
    const isTop = job.id === topJobId && score.fit_score >= 70;
    const draft = drafts[job.id];
    const skillsRow = (arr) => (arr && arr.length ? escapeHtml(arr.join(', ')) : 'None');

    return `
      <div class="job-row ${band.cls}${isTop ? ' top-pick' : ''}" data-job-id="${escapeHtml(job.id)}">
        <div class="job-head" tabindex="0" role="button">
          ${scoreRingSvg(score.fit_score, band.cls)}
          <div class="job-title-block">
            <div class="job-title">${escapeHtml(job.title)}, ${escapeHtml(job.company)}${isTop ? ' <span class="top-pick-badge">★ Top pick</span>' : ''}</div>
            <div class="job-meta">${escapeHtml(job.posted_relative)} · ${escapeHtml(score.experience_level)} (${escapeHtml(score.experience_required)}) · ${escapeHtml(job.source)}</div>
          </div>
          <svg class="job-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg>
        </div>
        <div class="job-body">
          <div class="job-cols">
            <div class="job-col-main">
              <div class="field-label">Matched skills</div>
              <div class="skill-text">${skillsRow(score.matched_skills)}</div>
              <div class="field-label">Missing skills</div>
              <div class="skill-text">${skillsRow(score.missing_skills)}</div>
              ${score.red_flags && score.red_flags.length ? `<div class="alert alert-warning">${escapeHtml(score.red_flags.join(', '))}</div>` : ''}
              <div class="reasoning">${escapeHtml(score.reasoning)}</div>
              <a class="open-link" href="${job.url}" target="_blank" rel="noopener">Open posting ↗</a>
            </div>
            <div class="job-col-side">
              ${draft
                ? `<div class="draft-status"><span class="tag ${draft.status}">${draft.status.charAt(0).toUpperCase() + draft.status.slice(1)}</span></div>`
                : `<button class="btn btn-ghost btn-small draft-btn" data-job-id="${escapeHtml(job.id)}">Draft proposal</button>`
              }
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  fadeInRows(list, '.job-row');
  animateRings(list);

  list.querySelectorAll('.job-head').forEach(head => {
    const toggle = () => head.closest('.job-row').classList.toggle('open');
    head.addEventListener('click', toggle);
    head.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  });

  list.querySelectorAll('.draft-btn').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); draftProposal(btn.dataset.jobId, btn); });
  });
}

async function draftProposal(jobId, btnEl) {
  btnEl.disabled = true;
  btnEl.textContent = 'Drafting...';
  try {
    const resp = await fetch('/api/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: jobId }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      btnEl.disabled = false;
      btnEl.textContent = 'Draft proposal';
      showToast(data.error || 'Could not draft this proposal. Please try again.', 'error');
      return;
    }

    const results = loadResults();
    const item = (results.jobs || []).find(j => j.job.id === jobId);

    const drafts = getDrafts();
    drafts[jobId] = {
      job: item.job,
      draft: data.draft,
      review: data.review,
      status: 'pending',
    };
    saveDrafts(drafts);
    showToast('Draft ready. Review it on the Drafts page.', 'success');
    renderJobs();
  } catch (err) {
    btnEl.disabled = false;
    btnEl.textContent = 'Draft proposal';
    showToast('Could not reach the server. Is it still running?', 'error');
  }
}

function renderCourses(courses) {
  const area = document.getElementById('courses-area');
  if (!courses || !courses.length) { area.innerHTML = ''; return; }

  area.innerHTML = `
    <div class="courses-section">
      <h2>Courses to strengthen this CV</h2>
      ${courses.map(c => `
        <div class="course-row">
          <div class="course-title"><a href="${c.search_url}" target="_blank" rel="noopener">${escapeHtml(c.title)} ↗</a></div>
          <div class="course-meta">${escapeHtml(c.provider)} · ${escapeHtml(c.time_to_complete)}</div>
          <div class="course-content">${escapeHtml(c.content)}</div>
          <div class="field-label">Impact on this CV</div>
          <div class="course-impact">${escapeHtml(c.impact)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

// ============================================================
// DRAFTS PAGE
// ============================================================

function renderDraftsPage() {
  const drafts = getDrafts();
  const entries = Object.entries(drafts);

  const pending = entries.filter(([, d]) => d.status === 'pending');
  const approved = entries.filter(([, d]) => d.status === 'approved');
  const rejected = entries.filter(([, d]) => d.status === 'rejected');

  const pendingArea = document.getElementById('pending-area');
  if (!pending.length) {
    pendingArea.innerHTML = '<div class="alert alert-info">No pending drafts. Go to Home, score some roles, and select Draft proposal.</div>';
  } else {
    pendingArea.innerHTML = pending.map(([jobId, d]) => `
      <div class="draft-card" data-job-id="${escapeHtml(jobId)}">
        <h3>${escapeHtml(d.job.title)} — ${escapeHtml(d.job.company)}</h3>
        ${d.review.unsupported_claims && d.review.unsupported_claims.length
          ? `<div class="alert alert-warning">Possible unsupported claims: ${escapeHtml(d.review.unsupported_claims.join(', '))}</div>` : ''}
        ${d.review.generic_phrases && d.review.generic_phrases.length
          ? `<div class="field-label" style="margin-top:0.5rem;">Generic phrases flagged: ${escapeHtml(d.review.generic_phrases.join(', '))}</div>` : ''}
        <textarea class="draft-text">${escapeHtml(d.draft)}</textarea>
        <div class="draft-actions">
          <button class="btn btn-small approve-btn" style="width:auto;">Approve</button>
          <button class="btn btn-ghost btn-small reject-btn">Reject</button>
        </div>
      </div>
    `).join('');

    pendingArea.querySelectorAll('.approve-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.draft-card');
        const jobId = card.dataset.jobId;
        const text = card.querySelector('.draft-text').value;
        const d = getDrafts();
        d[jobId].draft = text;
        d[jobId].status = 'approved';
        saveDrafts(d);
        showToast('Draft approved.', 'success');
        renderDraftsPage();
      });
    });
    pendingArea.querySelectorAll('.reject-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.draft-card');
        const jobId = card.dataset.jobId;
        const d = getDrafts();
        d[jobId].status = 'rejected';
        saveDrafts(d);
        showToast('Draft rejected.', 'warning');
        renderDraftsPage();
      });
    });
  }

  const approvedArea = document.getElementById('approved-area');
  approvedArea.innerHTML = approved.length
    ? approved.map(([, d]) => `
      <div class="draft-card">
        <h3>${escapeHtml(d.job.title)} — ${escapeHtml(d.job.company)}</h3>
        <div class="skill-text" style="white-space:pre-wrap;">${escapeHtml(d.draft)}</div>
        <a class="open-link" href="${d.job.url}" target="_blank" rel="noopener">Open job posting ↗</a>
      </div>
    `).join('')
    : '<div class="empty-state">None yet.</div>';

  const rejectedArea = document.getElementById('rejected-area');
  rejectedArea.innerHTML = rejected.length
    ? rejected.map(([, d]) => `<div class="skill-text">• ${escapeHtml(d.job.title)} — ${escapeHtml(d.job.company)}</div>`).join('')
    : '<div class="empty-state">None yet.</div>';
}

// ---------- Boot ----------
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initHomePage();
});