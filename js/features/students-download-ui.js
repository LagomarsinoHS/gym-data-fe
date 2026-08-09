/**
 * Coach — Mis alumnos: export / download (toolbar + per-athlete menu).
 * Markup: #students-download, .student-row-download
 * API: POST /users/coach/training-program/export (binary xlsx | pdf | zip)
 * Body: { athleteIds, locale, format: 'xlsx' | 'pdf' }
 */
import { exportCoachTrainingProgram } from '../api/users.js';
import { getLang, ui } from '../utils/labels.js';
import { store, getAthleteSessions } from './coach-athletes-store.js';

let downloadWrap;
let downloadBtn;
let downloadMenu;
let downloadAllExcelBtn;
let downloadAllPdfBtn;

export function initStudentsDownloadUi() {
  downloadWrap = document.getElementById('students-download');
  downloadBtn = document.getElementById('students-download-btn');
  downloadMenu = document.getElementById('students-download-menu');
  downloadAllExcelBtn = document.getElementById('students-download-all-excel');
  downloadAllPdfBtn = document.getElementById('students-download-all-pdf');

  downloadBtn?.addEventListener('click', e => {
    e.stopPropagation();
    toggleDownloadMenu();
  });
  downloadAllExcelBtn?.addEventListener('click', () => onDownloadAll('xlsx'));
  downloadAllPdfBtn?.addEventListener('click', () => onDownloadAll('pdf'));

  document.addEventListener('click', e => {
    const openAthleteMenu = document.querySelector('.student-row-download.is-open');
    if (openAthleteMenu && !openAthleteMenu.contains(e.target)) {
      closeAthleteDownloadMenus();
    }
    if (!downloadWrap?.classList.contains('is-open')) return;
    if (downloadWrap.contains(e.target)) return;
    closeDownloadMenu();
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (document.querySelector('.student-row-download.is-open')) {
      e.stopImmediatePropagation();
      closeAthleteDownloadMenus();
      return;
    }
    if (downloadWrap?.classList.contains('is-open')) {
      e.stopImmediatePropagation();
      closeDownloadMenu();
    }
  });

  syncDownloadAllState();
}

export function syncDownloadAllState() {
  const enabled = store.athletesLoaded && hasDownloadablePlans();
  if (downloadBtn) {
    downloadBtn.disabled = false;
    downloadBtn.removeAttribute('title');
  }
  for (const btn of [downloadAllExcelBtn, downloadAllPdfBtn]) {
    if (!btn) continue;
    btn.disabled = !enabled;
    btn.setAttribute('aria-disabled', enabled ? 'false' : 'true');
    btn.title = enabled ? '' : ui('studentsDownloadAllDisabled');
    btn.classList.toggle('is-disabled', !enabled);
  }
}

export function createAthleteDownloadMenu(athleteId) {
  const wrap = document.createElement('div');
  wrap.className = 'student-row-download';
  const canDownload = athleteHasDownloadablePlan(athleteId);

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'student-row-download-trigger';
  trigger.textContent = '⏬';
  trigger.setAttribute('aria-label', ui('studentsDownloadPlan'));
  trigger.title = ui('studentsDownloadPlan');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.addEventListener('click', e => {
    e.stopPropagation();
    toggleAthleteDownloadMenu(wrap);
  });

  const menu = document.createElement('div');
  menu.className = 'student-row-download-menu';
  menu.setAttribute('role', 'menu');
  menu.hidden = true;

  const excelBtn = createDownloadMenuItem({
    label: ui('studentsDownloadExcel'),
    enabled: canDownload,
    onClick: btn => onDownloadAthlete(athleteId, btn, 'xlsx'),
  });

  const pdfBtn = createDownloadMenuItem({
    label: ui('studentsDownloadPdf'),
    enabled: canDownload,
    onClick: btn => onDownloadAthlete(athleteId, btn, 'pdf'),
  });

  menu.append(excelBtn, pdfBtn);
  wrap.append(trigger, menu);
  return wrap;
}

function createDownloadMenuItem({ label, enabled, onClick }) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'student-row-download-item';
  btn.setAttribute('role', 'menuitem');
  btn.disabled = !enabled;
  btn.setAttribute('aria-disabled', enabled ? 'false' : 'true');
  btn.classList.toggle('is-disabled', !enabled);
  btn.title = enabled ? label : ui('studentsDownloadAllDisabled');

  const labelEl = document.createElement('span');
  labelEl.className = 'student-row-download-item-label';
  labelEl.textContent = label;
  btn.append(labelEl);

  if (enabled) {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      onClick(btn);
    });
  }

  return btn;
}

function hasDownloadablePlans() {
  return store.athletes.some(athlete =>
    getAthleteSessions(athlete).some(
      session => Array.isArray(session?.items) && session.items.length > 0,
    ),
  );
}

function athleteHasDownloadablePlan(athleteId) {
  const athlete = store.athletes.find(a => String(a?.id) === String(athleteId));
  if (!athlete) return false;
  return getAthleteSessions(athlete).some(
    session => Array.isArray(session?.items) && session.items.length > 0,
  );
}

function toggleDownloadMenu() {
  if (downloadWrap?.classList.contains('is-open')) closeDownloadMenu();
  else openDownloadMenu();
}

function openDownloadMenu() {
  if (!downloadWrap || !downloadMenu || !downloadBtn) return;
  closeAthleteDownloadMenus();
  downloadWrap.classList.add('is-open');
  downloadMenu.hidden = false;
  downloadBtn.setAttribute('aria-expanded', 'true');
}

function closeDownloadMenu() {
  if (!downloadWrap || !downloadMenu || !downloadBtn) return;
  downloadWrap.classList.remove('is-open');
  downloadMenu.hidden = true;
  downloadBtn.setAttribute('aria-expanded', 'false');
}

function closeAthleteDownloadMenus(except = null) {
  document.querySelectorAll('.student-row-download.is-open').forEach(wrap => {
    if (except && wrap === except) return;
    wrap.classList.remove('is-open');
    const menu = wrap.querySelector('.student-row-download-menu');
    const trigger = wrap.querySelector('.student-row-download-trigger');
    if (menu) menu.hidden = true;
    trigger?.setAttribute('aria-expanded', 'false');
  });
}

function toggleAthleteDownloadMenu(wrap) {
  if (!wrap) return;
  if (wrap.classList.contains('is-open')) {
    closeAthleteDownloadMenus();
    return;
  }
  closeDownloadMenu();
  closeAthleteDownloadMenus();
  const menu = wrap.querySelector('.student-row-download-menu');
  const trigger = wrap.querySelector('.student-row-download-trigger');
  wrap.classList.add('is-open');
  if (menu) menu.hidden = false;
  trigger?.setAttribute('aria-expanded', 'true');
}

function fallbackExportFilename(contentType, athleteIds, format) {
  const isZip = String(contentType || '').includes('zip');
  if (isZip) return 'Pautas de entrenamientos.zip';
  const ext = format === 'pdf' ? 'pdf' : 'xlsx';
  return athleteIds.length === 1 ? `training-program.${ext}` : `training-programs.${ext}`;
}

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'training-program.xlsx';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function runTrainingProgramExport(athleteIds, triggerBtn, format = 'xlsx') {
  if (triggerBtn?.disabled || triggerBtn?.dataset.busy === '1') return;
  if (triggerBtn) {
    triggerBtn.dataset.busy = '1';
    triggerBtn.disabled = true;
  }
  try {
    const { blob, filename, contentType } = await exportCoachTrainingProgram(
      athleteIds,
      getLang(),
      format,
    );
    triggerBlobDownload(
      blob,
      filename || fallbackExportFilename(contentType, athleteIds, format),
    );
  } catch (err) {
    console.error(err);
    window.alert(ui('studentsDownloadFail'));
  } finally {
    if (triggerBtn) {
      delete triggerBtn.dataset.busy;
      if (
        triggerBtn === downloadAllExcelBtn ||
        triggerBtn === downloadAllPdfBtn
      ) {
        syncDownloadAllState();
      } else {
        triggerBtn.disabled = false;
      }
    }
  }
}

function onDownloadAll(format = 'xlsx') {
  const triggerBtn = format === 'pdf' ? downloadAllPdfBtn : downloadAllExcelBtn;
  if (triggerBtn?.disabled || !hasDownloadablePlans()) return;
  closeDownloadMenu();
  void runTrainingProgramExport([], triggerBtn, format);
}

function onDownloadAthlete(athleteId, btn, format) {
  if (!athleteHasDownloadablePlan(athleteId)) return;
  closeAthleteDownloadMenus();
  void runTrainingProgramExport([String(athleteId)], btn, format);
}
