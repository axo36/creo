/* settings.js */
import { supabase } from './supabase.js';
import { state }    from './state.js';
import { uiToast }  from './utils.js';

/* ── Traductions ── */
const LANGS = {
  fr: {
    plan_free:'Gratuit', plan_pro:'Pro', plan_business:'Business',
    save:'✓ Enregistrer', saved:'✓ Profil sauvegardé !',
    pw_changed:'✓ Mot de passe modifié !', pw_min:'Min 6 caractères.',
    pw_mismatch:'Les mots de passe ne correspondent pas.',
    avatar_updated:'✓ Avatar mis à jour !', avatar_removed:'Avatar supprimé.',
    lang_saved:'✓ Langue sauvegardée', notif_saved:'✓ Notifications sauvegardées',
    network_saved:'✓ Réseau appliqué', cache_cleared:'✓ Cache vidé',
    code_changed:'✓ Code client changé — tous tes fichiers ont été mis à jour.',
    code_min:'Le code doit faire au moins 4 caractères.',
    code_taken:'Ce code est déjà utilisé.',
    pseudo_taken:'Pseudo déjà pris.', pseudo_min:'Pseudo trop court (min 3 car.)',
    name_required:'Prénom et nom requis.',
    // UI labels
    nav_transfers:'Transferts', nav_devices:'Appareils', nav_files:'Fichiers',
    nav_recover:'Récupérer', nav_settings:'Paramètres', nav_analytics:'Analytiques',
    nav_admin:'Administration',
    topbar_transfers:'TRANSFERTS', topbar_devices:'APPAREILS', topbar_files:'FICHIERS',
    topbar_recover:'RÉCUPÉRER', topbar_settings:'PARAMÈTRES', topbar_analytics:'ANALYTIQUES',
    topbar_admin:'ADMINISTRATION',
    bc_transfers:'// envoyer · recevoir', bc_devices:'// mes appareils',
    bc_files:'// tous mes fichiers', bc_recover:'// code · user · express',
    bc_settings:'// compte', bc_analytics:'// statistiques', bc_admin:'// gestion du site',
    btn_send:'⬆ Envoyer', btn_add:'＋ Ajouter', btn_upload:'⬆ Uploader',
    btn_refresh:'↺ Actualiser', btn_save:'✓ Sauvegarder', btn_export:'↓ Exporter CSV',
    stat_week:'cette semaine', stat_storage:'Stockage utilisé', stat_online:'en ligne',
    stat_speed:'réseau', stat_total:'Envoyés cette semaine', stat_devices:'Appareils en ligne',
    upload_title:'Glisse tes fichiers ici ou clique pour choisir',
    upload_sub:'Tous formats · Max 50 MB · Stocké 7 jours · Forfait free 1 GB',
    in_progress:'En cours', new_transfer:'＋ Nouveau',
    history:'Historique', days_7:'7 jours',
    filter_all:'Tous', filter_public:'Liens publics', filter_device:'Vers appareils',
    filter_received:'Reçus', filter_errors:'Erreurs',
    sort_newest:'Plus récent', sort_oldest:'Plus ancien', sort_largest:'Plus grand',
    sort_smallest:'Plus petit', sort_name:'Nom A→Z',
    th_file:'Fichier', th_dest:'Destination', th_status:'Statut',
    th_date:'Date', th_share:'Partager', th_action:'Action',
    section_principal:'Principal', section_account:'Compte',
    logout:'⎋  Déconnexion',
    notif_title:'Notifications', notif_read_all:'Tout lire',
    modal_send_title:'Envoyer vers…', modal_cancel:'Annuler', modal_confirm:'⬆ Envoyer',
    modal_dest_label:'Destination', modal_public:'🌐 Lien public (code + lien + QR)',
    settings_profile:'Profil', settings_security:'Sécurité', settings_lang:'Langue',
    settings_notif:'Notifications', settings_network:'Réseau', settings_plan:'Forfait',
    settings_photo:'Photo de profil', settings_avatar_label:'Avatar',
    settings_avatar_sub:'PNG, JPG, WEBP · max 2 MB',
    settings_change:'Changer', settings_remove:'Supprimer',
    settings_personal:'Informations personnelles',
    settings_client_code:'Code client', settings_plan_label:'Forfait',
    settings_firstname:'Prénom', settings_lastname:'Nom',
    settings_email:'Email', settings_username:'Nom d\'utilisateur',
    settings_storage_used:'Stockage utilisé',
    settings_change_pw:'Changer le mot de passe',
    settings_new_pw:'Nouveau mot de passe', settings_confirm_pw:'Confirmer',
    settings_change_code:'Changer le code client',
    settings_code_desc:'Ton code client est utilisé comme identifiant de partage.',
    settings_new_code:'Nouveau code', settings_btn_change:'Changer',
    settings_current_code:'Code actuel',
    settings_session:'Session active',
    settings_danger:'Zone de danger', settings_signout_all:'Déconnecter partout',
    settings_signout_desc:'Révoquer toutes les sessions',
    settings_lang_title:'Langue de l\'interface',
    settings_lang_desc:'Sauvegardée dans ton profil et synchronisée sur tous tes appareils.',
    settings_notif_transfers:'Transferts',
    notif_upload_done:'Upload terminé', notif_upload_done_desc:'Notification quand un fichier est uploadé',
    notif_upload_err:'Erreur d\'upload', notif_upload_err_desc:'Notification en cas d\'échec',
    notif_upload_start:'Démarrage upload', notif_upload_start_desc:'Notification au début de l\'envoi',
    notif_devices_title:'Appareils',
    notif_new_device:'Nouvel appareil', notif_new_device_desc:'Quand tu te connectes depuis un nouvel appareil',
    btn_save_notif:'✓ Sauvegarder',
    net_title:'Connexion & Upload',
    net_notify_recv:'Notifier après réception', net_notify_recv_desc:'Affiche une notification quand un fichier est bien reçu',
    net_bg_upload:'Upload en arrière-plan', net_bg_upload_desc:'Continue l\'envoi si tu changes de page',
    net_max_size:'Taille max d\'upload', net_max_size_desc:'Limite la taille des fichiers envoyés (0 = illimité)',
    net_info_title:'Informations réseau',
    btn_apply_net:'Appliquer',
    plan_title:'Forfait & stockage',
    cache_title:'Cache', cache_local:'Cache local',
    btn_clear_cache:'Vider',
    danger_zone:'Zone de danger', reset_settings:'Réinitialiser les paramètres', reset_settings_desc:'Remettre par défaut',
    btn_reset:'Réinitialiser',
    recover_code_title:'Code de partage', recover_code_desc:'6 caractères — sans compte requis',
    recover_code_placeholder:'AB12CD', recover_code_btn:'Récupérer',
    recover_link_title:'Lien direct', recover_link_desc:'Lien CREO ou externe — télécharge directement',
    recover_link_placeholder:'https://…', recover_link_btn:'Ouvrir',
    recover_send_title:'Envoyer à un utilisateur CREO',
    recover_send_desc:'Partage un fichier directement vers un autre compte.',
    recover_choose_file:'Choisir un fichier uploadé',
    recover_send_btn:'Envoyer →',
    recover_received:'Fichiers reçus', recover_received_sub:'accepter ou refuser',
    recover_express:'Fichiers Express', recover_express_sub:'envoyés depuis Express',
    more_nav:'Navigation', more_logout:'⎋ Déconnexion',
  },
  en: {
    plan_free:'Free', plan_pro:'Pro', plan_business:'Business',
    save:'✓ Save', saved:'✓ Profile saved!',
    pw_changed:'✓ Password changed!', pw_min:'Min 6 characters.',
    pw_mismatch:'Passwords do not match.',
    avatar_updated:'✓ Avatar updated!', avatar_removed:'Avatar removed.',
    lang_saved:'✓ Language saved', notif_saved:'✓ Notifications saved',
    network_saved:'✓ Network settings applied', cache_cleared:'✓ Cache cleared',
    code_changed:'✓ Client code changed — all your files updated.',
    code_min:'Code must be at least 4 characters.',
    code_taken:'This code is already in use.',
    pseudo_taken:'Username already taken.', pseudo_min:'Username too short (min 3 chars)',
    name_required:'First and last name required.',
    nav_transfers:'Transfers', nav_devices:'Devices', nav_files:'Files',
    nav_recover:'Recover', nav_settings:'Settings', nav_analytics:'Analytics',
    nav_admin:'Administration',
    topbar_transfers:'TRANSFERS', topbar_devices:'DEVICES', topbar_files:'FILES',
    topbar_recover:'RECOVER', topbar_settings:'SETTINGS', topbar_analytics:'ANALYTICS',
    topbar_admin:'ADMINISTRATION',
    bc_transfers:'// send · receive', bc_devices:'// my devices',
    bc_files:'// all my files', bc_recover:'// code · user · express',
    bc_settings:'// account', bc_analytics:'// statistics', bc_admin:'// site management',
    btn_send:'⬆ Send', btn_add:'＋ Add', btn_upload:'⬆ Upload',
    btn_refresh:'↺ Refresh', btn_save:'✓ Save', btn_export:'↓ Export CSV',
    stat_week:'this week', stat_storage:'Storage used', stat_online:'online',
    stat_speed:'network', stat_total:'Sent this week', stat_devices:'Devices online',
    upload_title:'Drop files here or click to choose',
    upload_sub:'All formats · Max 50 MB · Stored 7 days · Free plan 1 GB',
    in_progress:'In progress', new_transfer:'＋ New',
    history:'History', days_7:'7 days',
    filter_all:'All', filter_public:'Public links', filter_device:'To devices',
    filter_received:'Received', filter_errors:'Errors',
    sort_newest:'Newest', sort_oldest:'Oldest', sort_largest:'Largest',
    sort_smallest:'Smallest', sort_name:'Name A→Z',
    th_file:'File', th_dest:'Destination', th_status:'Status',
    th_date:'Date', th_share:'Share', th_action:'Action',
    section_principal:'Main', section_account:'Account',
    logout:'⎋  Sign out',
    notif_title:'Notifications', notif_read_all:'Mark all read',
    modal_send_title:'Send to…', modal_cancel:'Cancel', modal_confirm:'⬆ Send',
    modal_dest_label:'Destination', modal_public:'🌐 Public link (code + link + QR)',
    settings_profile:'Profile', settings_security:'Security', settings_lang:'Language',
    settings_notif:'Notifications', settings_network:'Network', settings_plan:'Plan',
    settings_photo:'Profile photo', settings_avatar_label:'Avatar',
    settings_avatar_sub:'PNG, JPG, WEBP · max 2 MB',
    settings_change:'Change', settings_remove:'Remove',
    settings_personal:'Personal information',
    settings_client_code:'Client code', settings_plan_label:'Plan',
    settings_firstname:'First name', settings_lastname:'Last name',
    settings_email:'Email', settings_username:'Username',
    settings_storage_used:'Storage used',
    settings_change_pw:'Change password',
    settings_new_pw:'New password', settings_confirm_pw:'Confirm',
    settings_change_code:'Change client code',
    settings_code_desc:'Your client code is used as your sharing identifier.',
    settings_new_code:'New code', settings_btn_change:'Change',
    settings_current_code:'Current code',
    settings_session:'Active session',
    settings_danger:'Danger zone', settings_signout_all:'Sign out everywhere',
    settings_signout_desc:'Revoke all sessions',
    settings_lang_title:'Interface language',
    settings_lang_desc:'Saved in your profile and synced across all your devices.',
    settings_notif_transfers:'Transfers',
    notif_upload_done:'Upload complete', notif_upload_done_desc:'Notification when a file is uploaded',
    notif_upload_err:'Upload error', notif_upload_err_desc:'Notification on failure',
    notif_upload_start:'Upload start', notif_upload_start_desc:'Notification when upload begins',
    notif_devices_title:'Devices',
    notif_new_device:'New device', notif_new_device_desc:'When you connect from a new device',
    btn_save_notif:'✓ Save',
    net_title:'Connection & Upload',
    net_notify_recv:'Notify after reception', net_notify_recv_desc:'Shows a notification when a file is received',
    net_bg_upload:'Background upload', net_bg_upload_desc:'Continue upload if you change page',
    net_max_size:'Max upload size', net_max_size_desc:'Limit the size of sent files (0 = unlimited)',
    net_info_title:'Network information',
    btn_apply_net:'Apply',
    plan_title:'Plan & storage',
    cache_title:'Cache', cache_local:'Local cache',
    btn_clear_cache:'Clear',
    danger_zone:'Danger zone', reset_settings:'Reset settings', reset_settings_desc:'Restore defaults',
    btn_reset:'Reset',
    recover_code_title:'Share code', recover_code_desc:'6 characters — no account required',
    recover_code_placeholder:'AB12CD', recover_code_btn:'Retrieve',
    recover_link_title:'Direct link', recover_link_desc:'CREO or external link — downloads directly',
    recover_link_placeholder:'https://…', recover_link_btn:'Open',
    recover_send_title:'Send to a CREO user',
    recover_send_desc:'Share a file directly to another account.',
    recover_choose_file:'Choose an uploaded file',
    recover_send_btn:'Send →',
    recover_received:'Received files', recover_received_sub:'accept or decline',
    recover_express:'Express files', recover_express_sub:'sent from Express',
    more_nav:'Navigation', more_logout:'⎋ Sign out',
  },
  es: {
    plan_free:'Gratis', plan_pro:'Pro', plan_business:'Empresa',
    save:'✓ Guardar', saved:'✓ ¡Perfil guardado!',
    pw_changed:'✓ ¡Contraseña cambiada!', pw_min:'Mín. 6 caracteres.',
    pw_mismatch:'Las contraseñas no coinciden.',
    avatar_updated:'✓ ¡Avatar actualizado!', avatar_removed:'Avatar eliminado.',
    lang_saved:'✓ Idioma guardado', notif_saved:'✓ Notificaciones guardadas',
    network_saved:'✓ Red aplicada', cache_cleared:'✓ Caché vaciada',
    code_changed:'✓ Código de cliente cambiado.',
    code_min:'El código debe tener al menos 4 caracteres.',
    code_taken:'Este código ya está en uso.',
    pseudo_taken:'Nombre de usuario ya tomado.', pseudo_min:'Demasiado corto (mín 3 car.)',
    name_required:'Nombre y apellido requeridos.',
    nav_transfers:'Transferencias', nav_devices:'Dispositivos', nav_files:'Archivos',
    nav_recover:'Recuperar', nav_settings:'Ajustes', nav_analytics:'Analíticas',
    nav_admin:'Administración',
    topbar_transfers:'TRANSFERENCIAS', topbar_devices:'DISPOSITIVOS', topbar_files:'ARCHIVOS',
    topbar_recover:'RECUPERAR', topbar_settings:'AJUSTES', topbar_analytics:'ANALÍTICAS',
    topbar_admin:'ADMINISTRACIÓN',
    bc_transfers:'// enviar · recibir', bc_devices:'// mis dispositivos',
    bc_files:'// todos mis archivos', bc_recover:'// código · usuario · express',
    bc_settings:'// cuenta', bc_analytics:'// estadísticas', bc_admin:'// gestión del sitio',
    btn_send:'⬆ Enviar', btn_add:'＋ Añadir', btn_upload:'⬆ Subir',
    btn_refresh:'↺ Actualizar', btn_save:'✓ Guardar', btn_export:'↓ Exportar CSV',
    stat_week:'esta semana', stat_total:'Enviados esta semana', stat_devices:'Dispositivos en línea',
    upload_title:'Arrastra archivos aquí o haz clic para elegir',
    upload_sub:'Todos los formatos · Máx 50 MB · Almacenado 7 días',
    in_progress:'En curso', new_transfer:'＋ Nuevo',
    history:'Historial', days_7:'7 días',
    filter_all:'Todos', filter_public:'Links públicos', filter_device:'A dispositivos',
    filter_received:'Recibidos', filter_errors:'Errores',
    logout:'⎋  Cerrar sesión',
    notif_title:'Notificaciones', notif_read_all:'Marcar todo',
    modal_send_title:'Enviar a…', modal_cancel:'Cancelar', modal_confirm:'⬆ Enviar',
    section_principal:'Principal', section_account:'Cuenta',
    more_logout:'⎋ Cerrar sesión',
    recover_code_title:'Código de compartir', recover_code_btn:'Recuperar',
    recover_link_title:'Link directo', recover_link_btn:'Abrir',
    recover_send_title:'Enviar a un usuario CREO', recover_send_btn:'Enviar →',
    recover_received:'Archivos recibidos', recover_express:'Archivos Express',
  },
  de: {
    plan_free:'Kostenlos', plan_pro:'Pro', plan_business:'Business',
    save:'✓ Speichern', saved:'✓ Profil gespeichert!',
    pw_changed:'✓ Passwort geändert!', pw_min:'Mind. 6 Zeichen.',
    pw_mismatch:'Passwörter stimmen nicht überein.',
    avatar_updated:'✓ Avatar aktualisiert!', avatar_removed:'Avatar entfernt.',
    lang_saved:'✓ Sprache gespeichert', notif_saved:'✓ Benachrichtigungen gespeichert',
    network_saved:'✓ Netzwerk angewendet', cache_cleared:'✓ Cache geleert',
    code_changed:'✓ Kundencode geändert.',
    code_min:'Code muss mindestens 4 Zeichen haben.',
    code_taken:'Dieser Code wird bereits verwendet.',
    pseudo_taken:'Benutzername bereits vergeben.', pseudo_min:'Zu kurz (min 3 Zeichen)',
    name_required:'Vor- und Nachname erforderlich.',
    nav_transfers:'Transfers', nav_devices:'Geräte', nav_files:'Dateien',
    nav_recover:'Abrufen', nav_settings:'Einstellungen', nav_analytics:'Analytik',
    nav_admin:'Administration',
    topbar_transfers:'TRANSFERS', topbar_devices:'GERÄTE', topbar_files:'DATEIEN',
    topbar_recover:'ABRUFEN', topbar_settings:'EINSTELLUNGEN', topbar_analytics:'ANALYTIK',
    topbar_admin:'ADMINISTRATION',
    btn_send:'⬆ Senden', btn_add:'＋ Hinzufügen', btn_upload:'⬆ Hochladen',
    logout:'⎋  Abmelden',
    notif_title:'Benachrichtigungen', notif_read_all:'Alle gelesen',
    modal_send_title:'Senden an…', modal_cancel:'Abbrechen', modal_confirm:'⬆ Senden',
    section_principal:'Hauptmenü', section_account:'Konto',
    more_logout:'⎋ Abmelden',
    recover_code_title:'Freigabecode', recover_code_btn:'Abrufen',
    recover_link_title:'Direktlink', recover_link_btn:'Öffnen',
    recover_send_title:'An CREO-Benutzer senden', recover_send_btn:'Senden →',
    recover_received:'Empfangene Dateien', recover_express:'Express-Dateien',
  },
  pt: {
    plan_free:'Gratuito', plan_pro:'Pro', plan_business:'Empresa',
    save:'✓ Salvar', saved:'✓ Perfil salvo!',
    pw_changed:'✓ Senha alterada!', pw_min:'Mín. 6 caracteres.',
    pw_mismatch:'As senhas não coincidem.',
    avatar_updated:'✓ Avatar atualizado!', avatar_removed:'Avatar removido.',
    lang_saved:'✓ Idioma salvo', notif_saved:'✓ Notificações salvas',
    network_saved:'✓ Rede aplicada', cache_cleared:'✓ Cache limpo',
    code_changed:'✓ Código de cliente alterado.',
    code_min:'O código deve ter pelo menos 4 caracteres.',
    code_taken:'Este código já está em uso.',
    pseudo_taken:'Nome de usuário já em uso.', pseudo_min:'Muito curto (mín 3 car.)',
    name_required:'Nome e sobrenome obrigatórios.',
    nav_transfers:'Transferências', nav_devices:'Dispositivos', nav_files:'Arquivos',
    nav_recover:'Recuperar', nav_settings:'Configurações', nav_analytics:'Analíticos',
    nav_admin:'Administração',
    btn_send:'⬆ Enviar', btn_add:'＋ Adicionar',
    logout:'⎋  Sair',
    notif_title:'Notificações', notif_read_all:'Marcar tudo',
    modal_send_title:'Enviar para…', modal_cancel:'Cancelar', modal_confirm:'⬆ Enviar',
    section_principal:'Principal', section_account:'Conta',
    more_logout:'⎋ Sair',
    recover_code_title:'Código de compartilhamento', recover_code_btn:'Recuperar',
    recover_link_title:'Link direto', recover_link_btn:'Abrir',
    recover_send_title:'Enviar para um usuário CREO', recover_send_btn:'Enviar →',
    recover_received:'Arquivos recebidos', recover_express:'Arquivos Express',
  },
  ja: {
    plan_free:'無料', plan_pro:'プロ', plan_business:'ビジネス',
    save:'✓ 保存', saved:'✓ プロフィール保存完了！',
    pw_changed:'✓ パスワード変更完了！', pw_min:'6文字以上必要です。',
    pw_mismatch:'パスワードが一致しません。',
    avatar_updated:'✓ アバター更新完了！', avatar_removed:'アバターを削除しました。',
    lang_saved:'✓ 言語を保存しました', notif_saved:'✓ 通知を保存しました',
    network_saved:'✓ ネットワーク設定を適用しました', cache_cleared:'✓ キャッシュを消去しました',
    code_changed:'✓ クライアントコードが変更されました。',
    code_min:'コードは4文字以上必要です。',
    code_taken:'このコードはすでに使用されています。',
    pseudo_taken:'このユーザー名は使用中です。', pseudo_min:'短すぎます（3文字以上）',
    name_required:'名前と苗字は必須です。',
    nav_transfers:'転送', nav_devices:'デバイス', nav_files:'ファイル',
    nav_recover:'受け取る', nav_settings:'設定', nav_analytics:'分析',
    nav_admin:'管理',
    topbar_transfers:'転送', topbar_devices:'デバイス', topbar_files:'ファイル',
    topbar_recover:'受け取る', topbar_settings:'設定', topbar_analytics:'分析',
    topbar_admin:'管理',
    btn_send:'⬆ 送信', btn_add:'＋ 追加',
    logout:'⎋  ログアウト',
    notif_title:'通知', notif_read_all:'既読にする',
    modal_send_title:'送信先…', modal_cancel:'キャンセル', modal_confirm:'⬆ 送信',
    section_principal:'メイン', section_account:'アカウント',
    more_logout:'⎋ ログアウト',
    recover_code_title:'共有コード', recover_code_btn:'取得',
    recover_link_title:'直接リンク', recover_link_btn:'開く',
    recover_send_title:'CREOユーザーに送信', recover_send_btn:'送信 →',
    recover_received:'受信ファイル', recover_express:'Expressファイル',
  },
};


  en: {
    plan_free:'Free', plan_pro:'Pro', plan_business:'Business',
    save:'✓ Save', saved:'✓ Profile saved!',
    pw_changed:'✓ Password changed!', pw_min:'Min 6 characters.',
    pw_mismatch:'Passwords do not match.',
    avatar_updated:'✓ Avatar updated!', avatar_removed:'Avatar removed.',
    lang_saved:'✓ Language saved', notif_saved:'✓ Notifications saved',
    network_saved:'✓ Network settings applied', cache_cleared:'✓ Cache cleared',
    code_changed:'✓ Client code changed — all your files updated.',
    code_min:'Code must be at least 4 characters.',
    code_taken:'This code is already in use.',
    pseudo_taken:'Username already taken.', pseudo_min:'Username too short (min 3 chars)',
    name_required:'First and last name required.',
  },
  es: {
    plan_free:'Gratis', plan_pro:'Pro', plan_business:'Empresa',
    save:'✓ Guardar', saved:'✓ ¡Perfil guardado!',
    pw_changed:'✓ ¡Contraseña cambiada!', pw_min:'Mín. 6 caracteres.',
    pw_mismatch:'Las contraseñas no coinciden.',
    avatar_updated:'✓ ¡Avatar actualizado!', avatar_removed:'Avatar eliminado.',
    lang_saved:'✓ Idioma guardado', notif_saved:'✓ Notificaciones guardadas',
    network_saved:'✓ Red aplicada', cache_cleared:'✓ Caché vaciada',
    code_changed:'✓ Código de cliente cambiado.',
    code_min:'El código debe tener al menos 4 caracteres.',
    code_taken:'Este código ya está en uso.',
    pseudo_taken:'Nombre de usuario ya tomado.', pseudo_min:'Demasiado corto (mín 3 car.)',
    name_required:'Nombre y apellido requeridos.',
  },
  de: {
    plan_free:'Kostenlos', plan_pro:'Pro', plan_business:'Business',
    save:'✓ Speichern', saved:'✓ Profil gespeichert!',
    pw_changed:'✓ Passwort geändert!', pw_min:'Mind. 6 Zeichen.',
    pw_mismatch:'Passwörter stimmen nicht überein.',
    avatar_updated:'✓ Avatar aktualisiert!', avatar_removed:'Avatar entfernt.',
    lang_saved:'✓ Sprache gespeichert', notif_saved:'✓ Benachrichtigungen gespeichert',
    network_saved:'✓ Netzwerk angewendet', cache_cleared:'✓ Cache geleert',
    code_changed:'✓ Kundencode geändert.',
    code_min:'Code muss mindestens 4 Zeichen haben.',
    code_taken:'Dieser Code wird bereits verwendet.',
    pseudo_taken:'Benutzername bereits vergeben.', pseudo_min:'Zu kurz (min 3 Zeichen)',
    name_required:'Vor- und Nachname erforderlich.',
  },
  pt: {
    plan_free:'Gratuito', plan_pro:'Pro', plan_business:'Empresa',
    save:'✓ Salvar', saved:'✓ Perfil salvo!',
    pw_changed:'✓ Senha alterada!', pw_min:'Mín. 6 caracteres.',
    pw_mismatch:'As senhas não coincidem.',
    avatar_updated:'✓ Avatar atualizado!', avatar_removed:'Avatar removido.',
    lang_saved:'✓ Idioma salvo', notif_saved:'✓ Notificações salvas',
    network_saved:'✓ Rede aplicada', cache_cleared:'✓ Cache limpo',
    code_changed:'✓ Código de cliente alterado.',
    code_min:'O código deve ter pelo menos 4 caracteres.',
    code_taken:'Este código já está em uso.',
    pseudo_taken:'Nome de usuário já em uso.', pseudo_min:'Muito curto (mín 3 car.)',
    name_required:'Nome e sobrenome obrigatórios.',
  },
  ja: {
    plan_free:'無料', plan_pro:'プロ', plan_business:'ビジネス',
    save:'✓ 保存', saved:'✓ プロフィール保存完了！',
    pw_changed:'✓ パスワード変更完了！', pw_min:'6文字以上必要です。',
    pw_mismatch:'パスワードが一致しません。',
    avatar_updated:'✓ アバター更新完了！', avatar_removed:'アバターを削除しました。',
    lang_saved:'✓ 言語を保存しました', notif_saved:'✓ 通知を保存しました',
    network_saved:'✓ ネットワーク設定を適用しました', cache_cleared:'✓ キャッシュを消去しました',
    code_changed:'✓ クライアントコードが変更されました。',
    code_min:'コードは4文字以上必要です。',
    code_taken:'このコードはすでに使用されています。',
    pseudo_taken:'このユーザー名は使用中です。', pseudo_min:'短すぎます（3文字以上）',
    name_required:'名前と苗字は必須です。',
  },
};

function t(key) {
  const lang = state.currentLang || 'fr';
  return (LANGS[lang] || LANGS.fr)[key] || LANGS.fr[key] || key;
}

/* ── Forfaits ── */
const PLANS = {
  free:     { label:'Gratuit / Free',   storage:1,  color:'var(--green)',  price:'0€' },
  pro:      { label:'Pro',              storage:50, color:'var(--blue2)',  price:'4.99€/mois' },
  business: { label:'Business',         storage:500,color:'var(--amber)',  price:'19.99€/mois' },
};

export function renderSettings() {
  _set('settings-code', state.profile?.client_code || '—');
  const plan = PLANS[state.profile?.type] || PLANS.free;
  const planEl = document.getElementById('settings-plan');
  if (planEl) { planEl.textContent = plan.label; planEl.style.color = plan.color; }

  _val('s-firstname', state.profile?.first_name || '');
  _val('s-lastname',  state.profile?.last_name  || '');
  _val('s-email',     state.profile?.email || state.session?.user?.email || '');
  _val('s-username',  state.profile?.username || '');
  _set('s-session-email', state.session?.user?.email || '');

  // Stockage max selon forfait
  const maxGB = PLANS[state.profile?.type]?.storage || 1;
  const usedB = state.files.filter(f=>f.status==='done').reduce((s,f)=>s+(f.size_bytes||0),0);
  const usedGB = (usedB/1e9).toFixed(3);
  const usedPct = Math.min(100, Math.round(usedB/(maxGB*1e9)*100));
  const storEl = document.getElementById('storage-bar-section');
  if (storEl) {
    const color = usedPct>=90?'var(--red)':usedPct>=70?'var(--amber)':'var(--green)';
    storEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;margin-bottom:5px;font-size:.8rem;">
        <span style="color:var(--t2);">Stockage utilisé</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:.72rem;color:${color};">${usedGB} GB / ${maxGB} GB (${usedPct}%)</span>
      </div>
      <div style="height:6px;background:var(--d5);border-radius:99px;overflow:hidden;">
        <div style="width:${usedPct}%;height:100%;background:${color};border-radius:99px;transition:width .5s;"></div>
      </div>
      ${usedPct>=90?`<div style="font-size:.75rem;color:var(--red);margin-top:5px;">⚠ Stockage presque plein — <a href="#" onclick="window.creo.openUpgrade()" style="color:var(--blue2);">Passer à Pro</a></div>`:''}`;
  }

  // Avatar
  const av = state.profile?.avatar_url;
  const avEl = document.getElementById('settings-avatar');
  if (avEl) {
    if (av) avEl.innerHTML = `<img src="${av}" alt=""><div class="avatar-overlay">📷</div>`;
    else    avEl.innerHTML = `<span id="settings-avatar-initials">${initials()}</span><div class="avatar-overlay">📷</div>`;
  }

  // Lang buttons
  document.querySelectorAll('.lang-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.lang === state.currentLang)
  );

  // Bouton save
  const saveBtn = document.getElementById('btn-save-profile');
  if (saveBtn) saveBtn.textContent = t('save');

  // Plan section upgrade
  renderPlanSection();
}

function renderPlanSection() {
  const planSection = document.getElementById('plan-upgrade-section');
  if (!planSection) return;
  const current = state.profile?.type || 'free';
  const currentPlan = PLANS[current] || PLANS.free;

  planSection.innerHTML = `
    <div style="margin-bottom:1.2rem;">
      <div style="font-size:.82rem;color:var(--t2);margin-bottom:.8rem;">
        Forfait actuel : <strong style="color:${currentPlan.color};">${currentPlan.label}</strong>
        · Stockage : ${currentPlan.storage} GB
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;" id="plan-cards-grid">
      ${Object.entries(PLANS).map(([key, p]) => {
        const isCurrent = key === current;
        return `<div style="background:${isCurrent?'rgba(26,111,255,.08)':'var(--d3)'};border:1px solid ${isCurrent?'rgba(26,111,255,.3)':'var(--b2)'};border-radius:var(--r-xl);padding:1.2rem;text-align:center;">
          <div style="font-family:'JetBrains Mono',monospace;font-size:.62rem;color:var(--t3);text-transform:uppercase;margin-bottom:.4rem;">${p.label}</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.8rem;color:${p.color};line-height:1;margin-bottom:.3rem;">${p.storage} GB</div>
          <div style="font-size:.75rem;color:var(--t3);margin-bottom:.8rem;">${p.price}</div>
          ${isCurrent
            ? `<span style="font-family:'JetBrains Mono',monospace;font-size:.6rem;color:${p.color};border:1px solid ${p.color};padding:3px 10px;border-radius:99px;">Actuel</span>`
            : `<button class="btn btn-primary btn-sm" onclick="window.creo.upgradePlan('${key}')">Choisir</button>`}
        </div>`;
      }).join('')}
    </div>
    <div style="font-size:.74rem;color:var(--t3);margin-top:.8rem;text-align:center;">Toutes les données sont stockées sur Supabase. Le forfait Free est entièrement fonctionnel.</div>`;
}

export async function upgradePlan(planKey) {
  if (!PLANS[planKey]) return;
  const plan = PLANS[planKey];
  if (!confirm(`Passer au forfait ${plan.label} (${plan.price}) ?`)) return;
  const { error } = await supabase.from('profiles').update({ type: planKey }).eq('id', state.session.user.id);
  if (error) { uiToast('error', error.message); return; }
  state.profile.type = planKey;
  renderSettings();
  uiToast('success', `✓ Forfait ${plan.label} activé !`);
}

export async function saveProfile() {
  const btn   = document.getElementById('btn-save-profile');
  const first = document.getElementById('s-firstname').value.trim();
  const last  = document.getElementById('s-lastname').value.trim();
  const uname = document.getElementById('s-username').value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!first || !last) return uiToast('warning', t('name_required'));
  if (uname && uname.length < 3) return uiToast('warning', t('pseudo_min'));
  btn.classList.add('btn-loading');
  const { error } = await supabase.from('profiles').update({
    first_name: first, last_name: last, username: uname || state.profile.username,
  }).eq('id', state.session.user.id);
  btn.classList.remove('btn-loading');
  if (error) return uiToast('error', error.message.includes('username') ? t('pseudo_taken') : error.message);
  state.profile = { ...state.profile, first_name: first, last_name: last, username: uname || state.profile.username };
  uiToast('success', t('saved'));
}

/* ── Changer le code client — migre tous les fichiers ── */
export async function changeClientCode() {
  const input = document.getElementById('s-new-code');
  const newCode = (input?.value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (newCode.length < 4) { uiToast('warning', t('code_min')); return; }
  if (newCode === state.profile.client_code) { uiToast('info', 'Même code, rien à changer.'); return; }

  // Vérifier unicité
  const { data: existing } = await supabase.from('profiles').select('id').eq('client_code', newCode).maybeSingle();
  if (existing) { uiToast('error', t('code_taken')); return; }

  const btn = document.getElementById('btn-change-code');
  btn?.classList.add('btn-loading');

  // Mettre à jour le profil
  const { error } = await supabase.from('profiles').update({ client_code: newCode }).eq('id', state.session.user.id);
  if (error) { btn?.classList.remove('btn-loading'); uiToast('error', error.message); return; }

  // Mettre à jour les share_codes de tous les fichiers qui utilisaient l'ancien code
  // (On ne migre pas les codes individuels, on met juste à jour le code profil)
  state.profile.client_code = newCode;
  btn?.classList.remove('btn-loading');
  if (input) input.value = '';
  renderSettings();
  uiToast('success', t('code_changed'));
}

export async function changePassword() {
  const np  = document.getElementById('s-pw-new').value;
  const cp  = document.getElementById('s-pw-confirm').value;
  if (!np || np.length < 6) return uiToast('warning', t('pw_min'));
  if (np !== cp)             return uiToast('error', t('pw_mismatch'));
  const btn = document.getElementById('btn-change-pw');
  btn.classList.add('btn-loading');
  const { error } = await supabase.auth.updateUser({ password: np });
  btn.classList.remove('btn-loading');
  if (error) return uiToast('error', error.message);
  uiToast('success', t('pw_changed'));
  document.getElementById('s-pw-new').value = '';
  document.getElementById('s-pw-confirm').value = '';
}

export async function uploadAvatar(file) {
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { uiToast('error', 'Max 2 MB'); return; }
  const prog = document.getElementById('avatar-prog');
  const fill = document.getElementById('avatar-prog-fill');
  if (prog) prog.style.display = 'block';
  if (fill) fill.style.width = '30%';
  const ext  = file.name.split('.').pop();
  const path = `${state.session.user.id}/avatar.${ext}`;
  await supabase.storage.from('avatars').remove([path]);
  if (fill) fill.style.width = '60%';
  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
  if (error) { if (prog) prog.style.display = 'none'; uiToast('error', error.message); return; }
  if (fill) fill.style.width = '90%';
  const { data: ud } = supabase.storage.from('avatars').getPublicUrl(path);
  const url = ud.publicUrl + '?t=' + Date.now();
  await supabase.from('profiles').update({ avatar_url: url }).eq('id', state.session.user.id);
  state.profile.avatar_url = url;
  if (fill) { fill.style.width = '100%'; setTimeout(() => { prog.style.display = 'none'; fill.style.width = '0%'; }, 600); }
  uiToast('success', t('avatar_updated'));
}

export async function removeAvatar() {
  await supabase.from('profiles').update({ avatar_url: null }).eq('id', state.session.user.id);
  state.profile.avatar_url = null;
  uiToast('success', t('avatar_removed'));
}

export async function setLang(lang) {
  state.currentLang = lang;
  localStorage.setItem('creo_lang', lang);
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
  await supabase.from('profiles').update({ lang }).eq('id', state.session.user.id);
  uiToast('success', t('lang_saved'));
  renderSettings();
  applyTranslations();
}

/* ── Applique les traductions sur tous les éléments data-i18n ── */
export function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const val = t(key);
    if (val && val !== key) el.textContent = val;
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const key = el.dataset.i18nPh;
    const val = t(key);
    if (val && val !== key) el.placeholder = val;
  });
  // Mettre à jour le META de navigation dans app.js
  if (window._updateNavMeta) window._updateNavMeta();
}

export async function saveNotifSettings() {
  state.notifSettings.done   = document.getElementById('notif-done')?.classList.contains('on')  ?? true;
  state.notifSettings.error  = document.getElementById('notif-error')?.classList.contains('on') ?? true;
  state.notifSettings.start  = document.getElementById('notif-start')?.classList.contains('on') ?? false;
  state.notifSettings.device = document.getElementById('notif-device')?.classList.contains('on') ?? true;
  await supabase.from('profiles').update({ notif_settings: JSON.stringify(state.notifSettings) }).eq('id', state.session.user.id);
  uiToast('success', t('notif_saved'));
}

export function applyNotifToggles() {
  ['done','error','start','device'].forEach(k => {
    const el = document.getElementById('notif-' + k);
    if (el && state.notifSettings[k]) el.classList.add('on');
    else if (el)                      el.classList.remove('on');
  });
}

export function switchSettingsTab(tabId) {
  document.querySelectorAll('.s-nav-item').forEach(i => i.classList.remove('active'));
  document.querySelectorAll('.settings-panel').forEach(p => p.style.display = 'none');
  document.querySelector(`[data-tab="${tabId}"]`)?.classList.add('active');
  const p = document.getElementById(tabId);
  if (p) p.style.display = 'block';
}

function _set(id, v)  { const el = document.getElementById(id); if (el) el.textContent = v; }
function _val(id, v)  { const el = document.getElementById(id); if (el) el.value = v; }
function capitalize(s){ return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
function initials() {
  const name = state.profile?.first_name && state.profile?.last_name
    ? `${state.profile.first_name} ${state.profile.last_name}`
    : state.profile?.username || state.session?.user?.email?.split('@')[0] || '?';
  return name.split(' ').map(w => w[0] || '').slice(0, 2).join('').toUpperCase() || '?';
}
