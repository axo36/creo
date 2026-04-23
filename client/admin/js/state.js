/* state.js */
export const state = {
  session: null, profile: null,
  currentPage: 'transferts',
  currentLang: localStorage.getItem('creo_lang') || 'fr',
  fileView: 'grid', fileFilter: 'all', fileSort: 'date-desc',
  transferFilter: 'all', transferSort: 'date-desc',
  files: [], devices: [], sharedFiles: [], syncRules: [], syncLog: [],
  currentDeviceId: null,          // jamais auto — toujours manuel
  notifSettings: { done:true, error:true, start:false, device:true },
  pendingFiles: [], activeUploads: {}, _uid: 100,
};
export function nextUid() { return 'up_' + (state._uid++); }
