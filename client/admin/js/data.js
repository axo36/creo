/* data.js */
import { supabase } from './supabase.js';
import { state } from './state.js';

export async function loadFiles(){
  const{data}=await supabase.from('files').select('*').eq('user_id',state.session.user.id).order('created_at',{ascending:false});
  state.files=data||[];
}
export async function loadDevices(){
  const{data}=await supabase.from('devices').select('*').eq('user_id',state.session.user.id).order('last_seen',{ascending:false});
  state.devices=data||[];
}
export async function loadSharedFiles(){
  // Requête simple sans join FK (évite le 400 si la relation n'est pas déclarée dans Supabase)
  const{data,error}=await supabase.from('shared_files')
    .select('*')
    .eq('to_user_id',state.session.user.id)
    .order('created_at',{ascending:false});
  if(error||!data?.length){state.sharedFiles=[];return;}

  // Enrichir avec les profils des expéditeurs
  const senderIds=[...new Set(data.map(f=>f.from_user_id).filter(Boolean))];
  let profilesMap={};
  if(senderIds.length){
    const{data:profiles}=await supabase.from('profiles')
      .select('id,username,first_name,last_name')
      .in('id',senderIds);
    (profiles||[]).forEach(p=>{profilesMap[p.id]=p;});
  }
  state.sharedFiles=data.map(f=>({...f,sender:profilesMap[f.from_user_id]||null}));
}
export async function loadSyncRules(){
  const{data}=await supabase.from('sync_rules').select('*').eq('user_id',state.session.user.id).order('created_at',{ascending:false});
  state.syncRules=data||[];
}
export async function loadSyncLog(){
  const{data}=await supabase.from('sync_log').select('*').eq('user_id',state.session.user.id).order('created_at',{ascending:false}).limit(20);
  state.syncLog=data||[];
}
export function setupRealtime(onFiles,onDevices,onShared){
  // Files
  supabase.channel('rt-files').on('postgres_changes',{event:'*',schema:'public',table:'files',filter:`user_id=eq.${state.session.user.id}`},async()=>{await loadFiles();onFiles();}).subscribe();
  // Devices
  supabase.channel('rt-devices').on('postgres_changes',{event:'*',schema:'public',table:'devices',filter:`user_id=eq.${state.session.user.id}`},async()=>{await loadDevices();onDevices();}).subscribe();
  // Shared files reçus en temps réel
  supabase.channel('rt-shared').on('postgres_changes',{event:'INSERT',schema:'public',table:'shared_files',filter:`to_user_id=eq.${state.session.user.id}`},async(payload)=>{
    await loadSharedFiles();
    onShared(payload.new);
  }).subscribe();
}
