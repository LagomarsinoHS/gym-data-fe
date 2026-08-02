/**
 * Coach — Mis alumnos: export / download (toolbar + per-athlete menu).
 * Markup: #students-download, .student-row-download
 * API: POST /users/coach/training-program/export (binary xlsx | zip)
 */
import { exportCoachTrainingProgram } from '../api/users.js';
import { getLang, ui } from '../utils/labels.js';
import { store, getAthleteSessions } from './coach-athletes-store.js';

let downloadWrap;
let downloadBtn;
let downloadMenu;
let downloadAllBtn;

export function initStudentsDownloadUi() {
  downloadWrap = document.getElementById('students-download');
  downloadBtn = document.getElementById('students-download-btn');
  downloadMenu = document.getElementById('students-download-menu');
  downloadAllBtn = document.getElementById('students-download-all');

  downloadBtn?.addEventListener('click', e => {
    e.stopPropagation();
    toggleDownloadMenu();
  });
  downloadAllBtn?.addEventListener('click', onDownloadAll);

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
  if (!downloadAllBtn) return;
  downloadAllBtn.disabled = !enabled;
  downloadAllBtn.setAttribute('aria-disabled', enabled ? 'false' : 'true');
  downloadAllBtn.title = enabled ? '' : ui('studentsDownloadAllDisabled');
  downloadAllBtn.classList.toggle('is-disabled', !enabled);
}

export function createAthleteDownloadMenu(athleteId) {
  const wrap = document.createElement('div');
  wrap.className = 'student-row-download';
  const canExcel = athleteHasDownloadablePlan(athleteId);

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

  const excelBtn = document.createElement('button');
  excelBtn.type = 'button';
  excelBtn.className = 'student-row-download-item';
  excelBtn.setAttribute('role', 'menuitem');
  excelBtn.disabled = !canExcel;
  excelBtn.setAttribute('aria-disabled', canExcel ? 'false' : 'true');
  excelBtn.classList.toggle('is-disabled', !canExcel);
  excelBtn.title = canExcel ? ui('studentsDownloadExcel') : ui('studentsDownloadAllDisabled');

  const excelLabel = document.createElement('span');
  excelLabel.className = 'student-row-download-item-label';
  excelLabel.textContent = ui('studentsDownloadExcel');
  excelBtn.append(excelLabel);

  if (canExcel) {
    excelBtn.addEventListener('click', e => {
      e.stopPropagation();
      onDownloadAthleteExcel(athleteId, excelBtn);
    });
  }

  const pdfBtn = document.createElement('button');
  pdfBtn.type = 'button';
  pdfBtn.className = 'student-row-download-item is-disabled';
  pdfBtn.setAttribute('role', 'menuitem');
  pdfBtn.disabled = true;
  pdfBtn.setAttribute('aria-disabled', 'true');
  pdfBtn.title = ui('studentsDownloadPdfSoon');

  const pdfLabel = document.createElement('span');
  pdfLabel.className = 'student-row-download-item-label';
  pdfLabel.textContent = ui('studentsDownloadPdf');

  const pdfHint = document.createElement('span');
  pdfHint.className = 'student-row-download-item-hint';
  pdfHint.textContent = ui('studentsDownloadPdfSoon');
  pdfBtn.append(pdfLabel, pdfHint);

  menu.append(excelBtn, pdfBtn);
  wrap.append(trigger, menu);
  return wrap;
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

function fallbackExportFilename(contentType, athleteIds) {
  const isZip = String(contentType || '').includes('zip');
  if (isZip) return 'Pautas de entrenamientos.zip';
  return athleteIds.length === 1 ? 'training-program.xlsx' : 'training-programs.xlsx';
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

async function runTrainingProgramExport(athleteIds, triggerBtn) {
  if (triggerBtn?.disabled || triggerBtn?.dataset.busy === '1') return;
  if (triggerBtn) {
    triggerBtn.dataset.busy = '1';
    triggerBtn.disabled = true;
  }
  try {
    const { blob, filename, contentType } = await exportCoachTrainingProgram(
      athleteIds,
      getLang(),
    );
    triggerBlobDownload(blob, filename || fallbackExportFilename(contentType, athleteIds));
  } catch (err) {
    console.error(err);
    window.alert(ui('studentsDownloadFail'));
  } finally {
    if (triggerBtn) {
      delete triggerBtn.dataset.busy;
      if (triggerBtn === downloadAllBtn) syncDownloadAllState();
      else triggerBtn.disabled = false;
    }
  }
}

function onDownloadAll() {
  if (downloadAllBtn?.disabled || !hasDownloadablePlans()) return;
  closeDownloadMenu();
  void runTrainingProgramExport([], downloadAllBtn);
}

function onDownloadAthleteExcel(athleteId, excelBtn) {
  if (!athleteHasDownloadablePlan(athleteId)) return;
  closeAthleteDownloadMenus();
  void runTrainingProgramExport([String(athleteId)], excelBtn);
}
