/* ══ state.js — état global partagé ══ */

export const state = {
  session:         null,
  profile:         null,
  currentPage:     'transferts',
  currentLang:     localStorage.getItem('creo_lang') || 'fr',
  fileView:        'grid',
  fileFilter:      'all',
  fileSort:        'date-desc',
  transferFilter:  'all',
  transferSort:    'date-desc',
  files:           [],
  devices:         [],
  syncRules:       [],
  syncLog:         [],
  currentDeviceId: localStorage.getItem('creo_device_id') || null,
  notifSettings:   { done: true, error: true, start: false, device: true },
  pendingFiles:    [],
  activeUploads:   {},
  _uid:            100,
};

export function nextUid() {
  return 'up_' + (state._uid++);
}
