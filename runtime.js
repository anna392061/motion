'use strict';
/* MOTION. V1 local-first data layer. Optional persistent WORKER access token is explicitly consented to by the device owner. Provider API keys never enter the browser. */
const config = {
  url: localStorage.getItem('motion_worker_url') || '',
  token: localStorage.getItem('motion_saved_worker_token') || sessionStorage.getItem('motion_session_token') || ''
};
// V1.4.5: keep an existing MOTION sync token when upgrading the same app origin.
// A token cannot be recovered if the browser has already erased it; in that case enter it once.
try {
  const priorSessionToken = sessionStorage.getItem('motion_session_token');
  const storedToken = localStorage.getItem('motion_saved_worker_token');
  if (priorSessionToken && !storedToken && localStorage.getItem('motion_remember_worker_token') !== '0') {
    localStorage.setItem('motion_saved_worker_token', priorSessionToken);
  }
  if (!config.token && localStorage.getItem('motion_saved_worker_token')) {
    config.token = localStorage.getItem('motion_saved_worker_token');
  }
} catch (e) { console.warn('Unable to migrate MOTION sync token', e); }
const muscleInsights = {
  gluteMed: {why:'单腿支撑时帮助控制骨盆与股骨，是跑步、上下台阶和单腿训练中的重要稳定肌。',movement:'它可以将大腿向外侧抬起；在脚落地的支撑阶段，还参与控制骨盆侧倾和股骨运动。',attention:'单腿 RDL 时关注骨盆是否稳定；侧向髋外展时避免身体侧弯代偿。局部酸胀不是训练有效的唯一标准。'},
  gluteMax: {why:'髋伸的主要动力肌，参与站起、登阶、跑步加速和跳跃。',movement:'髋由屈曲转向伸直时，它会产生力量；在负重动作中也参与控制股骨位置。',attention:'臀推顶端将髋伸到位而不是用腰过度后仰；RDL 先向后折髋，再驱动髋向前。'},
  hamstrings:{why:'连接髋和膝的后侧肌群；跑步时既要产生力量，也要控制摆动腿。',movement:'多数腘绳肌跨越髋、膝两个关节，参与伸髋和屈膝。',attention:'RDL 中关注髋铰链与缓慢下放；腿弯举中保持骨盆稳定。不需要刻意追求拉伸到疼痛。'},
  lats:{why:'拉动手臂向身体靠近，是引体向上、划船和攀爬相关动作的重要参与肌。',movement:'主要完成肩伸、内收和内旋，配合其他肌群完成躯干相对手臂的移动。',attention:'先建立稳定躯干和合适肩胛运动，用肘部轨迹带动动作，不必强行下压肩胛。'},
  traps:{why:'不仅负责耸肩，不同部位共同支持肩胛骨的上旋、后倾及控制。',movement:'上、中、下部纤维的作用不同；抬臂时需要协同前锯肌。',attention:'做 Y Raise 时让肩胛骨自然上旋、避免颈部用力挤压；不要刻意追求把肩胛骨向下锁死。'},
  quads:{why:'膝关节伸展的主要动力，帮助蹲起、登阶、减速和落地控制。',movement:'股四头肌在负重屈膝过程中离心控制，下蹲站起时产生伸膝力矩。',attention:'分腿蹲时保持整个脚掌稳定，让膝盖沿脚趾方向移动；允许膝盖合理向前，不必僵硬地保持小腿垂直。'},
  calves:{why:'踝关节跖屈与弹性储能的重要系统，跑步和跳跃反复使用。',movement:'小腿三头肌经跟腱向地面传递力量，站立和跑步时参与身体支撑推进。',attention:'提踵时保持踝足对线，充分控制上升和下放；跑步不必强迫主动用前脚掌蹬地。'},
  abs:{why:'与呼吸和躯干稳定有关，让髋、肩产生力量时保持身体可控。',movement:'腹肌群能够产生屈曲、旋转或抗旋转力矩，按任务需要调节躯干刚度。',attention:'负重前自然吸气扩张胸廓与腹部，维持可呼吸的腹压；避免始终把肚子用力收得很紧。'},
};
function emptyActivities(){return `<div class="empty-note"><div style="font-size:27px;margin-bottom:9px">✦</div><b>你的运动档案，从这里开始</b><p style="margin:9px 0 14px">目前还没有真实记录。点击 Sync 或导入运动文件。</p><div class="row" style="justify-content:center;flex-wrap:wrap"><button class="primary small" onclick="openSync()">↻ Sync</button><button class="soft-btn" onclick="document.querySelector('#import-file').click()">导入文件</button></div></div>`}
let databasePromise;
function openDB(){if(!('indexedDB' in window))return Promise.reject(Error('当前浏览器不支持 IndexedDB'));
 if(databasePromise)return databasePromise;
 databasePromise=new Promise((resolve,reject)=>{const req=indexedDB.open('motion-personal-v1',1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('activities'))req.result.createObjectStore('activities',{keyPath:'id'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)}).catch(e=>{databasePromise=null;throw e});return databasePromise;
}
async function listSavedActivities(){try{const db=await openDB();return await new Promise((resolve,reject)=>{const t=db.transaction('activities','readonly'),r=t.objectStore('activities').getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error)})}catch(e){console.warn('IndexedDB unavailable, using localStorage fallback',e);try{return JSON.parse(localStorage.getItem('motion_fallback_activities')||'[]')}catch{return []}}}
async function storeActivity(item){try{const db=await openDB();return await new Promise((resolve,reject)=>{const t=db.transaction('activities','readwrite');t.objectStore('activities').put(item);t.oncomplete=resolve;t.onerror=()=>reject(t.error)})}catch(e){localStorage.setItem('motion_fallback_activities',JSON.stringify(state.manual))}}
async function removeSavedActivity(id){try{const db=await openDB();await new Promise((resolve,reject)=>{const tx=db.transaction('activities','readwrite');tx.objectStore('activities').delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}catch(e){console.warn(e);localStorage.setItem('motion_fallback_activities',JSON.stringify(state.manual.filter(a=>a.id!==id)))}}
async function clearActivities(){try{const db=await openDB();await new Promise((resolve,reject)=>{const tx=db.transaction('activities','readwrite');tx.objectStore('activities').clear();tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}catch(e){console.warn(e)}localStorage.removeItem('motion_fallback_activities')}
async function hydrate(){state.manual=await listSavedActivities();render();if('serviceWorker' in navigator && window.location.protocol==='https:'){try{await navigator.serviceWorker.register('./sw.js',{scope:'./'})}catch(e){console.warn('Service worker:',e)}}}
function getStart(a){return new Date(a.start || a.date+'T12:00:00').getTime()}
function hasDuplicate(candidate){const exact=state.manual.find(a=>a.sourceKey&&candidate.sourceKey&&a.sourceKey===candidate.sourceKey);if(exact)return exact;
 return state.manual.find(a=>!(a.type==='strength'&&candidate.type==='strength'&&(!!a.log!==!!candidate.log))&&a.type===candidate.type&&a.date===candidate.date&&
  Math.abs(getStart(a)-getStart(candidate))<=5*60*1000&&
  Math.abs((a.minutes||0)-(candidate.minutes||0))<8&&
  (a.distance==null||candidate.distance==null||Math.abs(a.distance-candidate.distance)<=Math.max(0.4,candidate.distance*0.06)))
}
async function addActivity(item){if(!item||!item.type||!item.date||!Number.isFinite(item.minutes))return 'skipped';
 const old=hasDuplicate(item);if(old){let changed=false;for(const f of ['routePoints','hrSeries','altitudeSeries','paceSeries','splits','gain','cal','distance','hr']){
  const val=item[f];if((old[f]===undefined||old[f]===null||(Array.isArray(old[f])&&!old[f].length))&&val!==undefined&&val!==null){old[f]=val;changed=true}
 }if(item.routePoints?.length&&!old.route){old.route=true;changed=true}if(changed)await storeActivity(old);return 'duplicate'}
 state.manual.push(item);await storeActivity(item);return 'added';
}
async function updateActivitySport(){const a=state.manual.find(a=>a.id===state.activityID),field=document.getElementById('activity-type');if(!a||!field)return;a.type=field.value;if(a.distance){const m=a.minutes/a.distance;a.pace=Math.floor(m)+':'+String(Math.round((m%1)*60)).padStart(2,'0');a.speed=Number((a.distance/(a.minutes/60)).toFixed(1))}await storeActivity(a);showOverlay();toast('已修改运动类型')}
async function deleteSelectedActivity(){const a=state.manual.find(a=>a.id===state.activityID);if(!a||!confirm('删除「'+a.title+'」这条运动记录？'))return;state.manual=state.manual.filter(x=>x.id!==a.id);await removeSavedActivity(a.id);closeOverlay();toast('记录已删除')}
function saveConfig(){
 const urlEl=document.querySelector('#worker-url'),tokEl=document.querySelector('#worker-token');
 if(urlEl)config.url=urlEl.value.trim().replace(/\/+$/,'');
 // An empty password field must not accidentally erase an existing token.
 if(tokEl && tokEl.value.trim())config.token=tokEl.value.trim();
 const rememberEl=document.querySelector('#remember-worker-token');
 let remember=true;
 try { remember=rememberEl?rememberEl.checked:localStorage.getItem('motion_remember_worker_token')!=='0'; }
 catch(e){ remember=rememberEl?rememberEl.checked:true; }
 try{
   localStorage.setItem('motion_worker_url',config.url);
   localStorage.setItem('motion_remember_worker_token',remember?'1':'0');
   if(remember && config.token){
     localStorage.setItem('motion_saved_worker_token',config.token);
     sessionStorage.removeItem('motion_session_token');
   } else {
     localStorage.removeItem('motion_saved_worker_token');
     if(config.token)sessionStorage.setItem('motion_session_token',config.token);
     else sessionStorage.removeItem('motion_session_token');
   }
   toast(remember&&config.token?'访问口令已保存到本设备':'已保存配置；访问口令仅当前会话有效');
 }catch(e){
   try{if(config.token)sessionStorage.setItem('motion_session_token',config.token)}catch{}
   toast('设备持久化存储不可用，本次会话仍可以同步');
 }
}
function forgetWorkerToken(){
 try{localStorage.removeItem('motion_saved_worker_token');sessionStorage.removeItem('motion_session_token');localStorage.setItem('motion_remember_worker_token','0')}catch{}
 config.token='';
 const input=document.querySelector('#worker-token');if(input)input.value='';
 const check=document.querySelector('#remember-worker-token');if(check)check.checked=false;
 toast('已清除当前设备的同步访问口令');
}
function openSync(){document.querySelector('#sync-sheet')?.remove();document.querySelector('.overlay')?.remove();state.overlay=null;const e=document.createElement('div');e.className='overlay sync-sheet';e.id='sync-sheet';e.innerHTML=`<button class="backlink" onclick="closeSync()">← 返回</button><div class="micro">MANUAL SYNC</div><h1 class="page-title">Sync your movement<span style="color:var(--green)">.</span></h1><p class="sub">只在点击时读取你的运动。Apple Watch 数据需先经 Companion 上传至 Intervals.icu。</p><div class="card p20" style="margin-top:21px"><div class="sync-provider"><span class="sync-dot">◉</span><div><strong>Apple Watch</strong><small>Intervals.icu · 跑步、网球与力量</small></div><span class="pill">API</span></div><div class="sync-provider"><span class="sync-dot">↗</span><div><strong>Garmin Connect</strong><small>个人 API · 骑行</small></div><span class="pill">API</span></div><div id="sync-status" class="helper" aria-live="polite" style="margin:17px 0">${config.url?'已配置 Worker 地址。':'先在「设置」中填写 Worker 地址和访问口令。'}</div><button class="primary" style="width:100%" id="sync-run" onclick="syncNow()">↻ 开始同步</button></div><div class="card p18" style="margin-top:16px"><div class="spread"><div><b>无需连接，也可导入</b><p class="helper">GPX、TCX、FIT 运动文件</p></div><button class="soft-btn" onclick="document.querySelector('#import-file').click()">导入文件</button></div></div><div class="notice section">MOTION. 不会定时查询账户。API 密钥存储在你部署的 Cloudflare Worker Secrets 中，运动数据留在当前浏览器。</div>`;document.querySelector('.app').append(e);e.scrollTop=0}
function closeSync(){document.querySelector('#sync-sheet')?.remove();render()}
async function callWorker(path,kind='json'){if(!config.url||!config.token)throw Error('先在「设置」中填写 Worker 地址和访问口令');const res=await fetch(config.url+path,{headers:{Authorization:'Bearer '+config.token},cache:'no-store'});if(!res.ok){let msg='HTTP '+res.status;try{let j=await res.json();msg=j.error||msg}catch{}throw Error(msg)}return kind==='buffer'?res.arrayBuffer():res.json()}
function classify(raw,source){const x=String(raw.type?.typeKey||raw.type||raw.sport||raw.activityType?.typeKey||raw.activityType||'').toLowerCase();if(/run|jog|trail/.test(x))return 'run';if(/cycle|cycling|bike|ride|biking|virtualride/.test(x))return 'cycle';if(/strength|weight|gym|resistance/.test(x))return 'strength';if(/tennis|racquet/.test(x))return 'tennis';return null}
function asUTCStart(s){if(!s)return null;return String(s).replace(' ','T')}
function normalizedRecord(raw,source){const type=classify(raw,source);if(!type)return null;
 const start=asUTCStart(raw.start_date_local||raw.startTimeLocal||raw.start_date||raw.startTimeGMT||raw.startTime||raw.start_date_time||raw.timestamp);
 if(!start)return null;
 const date=start.slice(0,10);
 const seconds=Number(raw.moving_time??raw.elapsed_time??raw.duration??raw.durationInSeconds??raw.movingDuration??raw.elapsedDuration??raw.total_timer_time??0);
 const mins=seconds/60;if(!Number.isFinite(mins)||mins<=0||mins>10000)return null;
 const distM=Number(raw.distance??raw.distanceInMeters??0),d=distM>0?Number((distM/1000).toFixed(2)):null;
 const hr=Number(raw.average_heartrate??raw.averageHeartRate??raw.averageHR??raw.avgHr??raw.average_hr??0)||null;
 const gainRaw=raw.total_elevation_gain??raw.elevationGain??raw.totalAscent;const gain=gainRaw==null?null:Number(gainRaw);
 const kcalRaw=raw.calories??raw.icu_calories??raw.total_calories??raw.active_calories;const cal=kcalRaw==null?null:Number(kcalRaw);
 const ident=String(raw.id??raw.activityId??raw.activity_id??(start+'-'+raw.name));
 const item={id:source+'-'+ident,sourceKey:source+':'+ident,source:source==='intervals'?'Intervals.icu · Apple Health':'Garmin Connect',date,type,start,title:String(raw.name||raw.activityName||sport[type].zh+'运动'),minutes:Math.round(mins*10)/10,duration:seconds>=3600?`${Math.floor(seconds/3600)}:${String(Math.floor(seconds%3600/60)).padStart(2,'0')}:${String(Math.round(seconds%60)).padStart(2,'0')}`:`${Math.floor(seconds/60)}:${String(Math.round(seconds%60)).padStart(2,'0')}`,distance:d,hr,gain:Number.isFinite(gain)?gain:null,cal:Number.isFinite(cal)&&cal>=0?cal:null};
 if(d&&type==='run'){let pace=mins/d;item.pace=Math.floor(pace)+':'+String(Math.round((pace%1)*60)).padStart(2,'0')}if(d&&type==='cycle')item.speed=Number((d/(mins/60)).toFixed(1));
 if(raw.routePoints?.length)item.routePoints=raw.routePoints;
 return item;
}
async function zipFitData(arrayBuffer){
 const data=new Uint8Array(arrayBuffer),dv=new DataView(arrayBuffer);if(dv.getUint32(0,true)!==0x04034b50)throw Error('下载文件不是 Garmin ZIP');
 // ZIP central directory is the reliable place to find compressed offsets and lengths.
 let eocd=-1;for(let i=data.length-22;i>=Math.max(0,data.length-65557);i--){if(dv.getUint32(i,true)===0x06054b50){eocd=i;break}}
 if(eocd<0)throw Error('ZIP 无法定位目录');let count=dv.getUint16(eocd+10,true),offset=dv.getUint32(eocd+16,true);
 for(let n=0;n<count;n++){
  if(dv.getUint32(offset,true)!==0x02014b50)break;
  const method=dv.getUint16(offset+10,true),compressed=dv.getUint32(offset+20,true),uncompressed=dv.getUint32(offset+24,true),fnlen=dv.getUint16(offset+28,true),extralen=dv.getUint16(offset+30,true),comment=dv.getUint16(offset+32,true),local=dv.getUint32(offset+42,true),filename=new TextDecoder().decode(data.slice(offset+46,offset+46+fnlen));
  offset+=46+fnlen+extralen+comment;
  if(!filename.toLowerCase().endsWith('.fit'))continue;
  if(uncompressed>35*1024*1024)throw Error('FIT 文件过大');
  const localNameLen=dv.getUint16(local+26,true),localExtraLen=dv.getUint16(local+28,true),begin=local+30+localNameLen+localExtraLen,part=data.slice(begin,begin+compressed);
  if(method===0)return part.buffer;
  if(method===8){if(typeof DecompressionStream==='undefined')throw Error('当前浏览器不支持 ZIP 解压');const stream=new Blob([part]).stream().pipeThrough(new DecompressionStream('deflate-raw'));return await new Response(stream).arrayBuffer()}
  throw Error('不支持 ZIP 压缩方法 '+method)
 }
 throw Error('ZIP 中未发现 .fit 文件')
}
async function fetchRoute(source,originalId){
 if(source==='intervals'){
   const res=await callWorker('/sync/intervals/gpx?id='+encodeURIComponent(originalId),'buffer');
   return parseGPX(new TextDecoder().decode(res),'activity.gpx').routePoints;
 }
 const bytes=await callWorker('/sync/garmin/fit?id='+encodeURIComponent(originalId),'buffer');
 const fit=await zipFitData(bytes);return parseFITBytes(fit,'garmin.fit').routePoints;
}
// Intervals.icu streams.json is an array of {type,data}; no inferred/simulated sensor samples.
function parseIntervalStreams(raw){
 const arr=Array.isArray(raw)?raw:Array.isArray(raw?.streams)?raw.streams:[];
 const get=(name)=>{const found=arr.find(x=>String(x.type||x.name||'').toLowerCase()===name);return Array.isArray(found?.data)?found.data:[]};
 const times=get('time'),hr=get('heartrate'),distance=get('distance'),altitude=get('altitude'),velocity=get('velocity_smooth'),cadence=get('cadence');
 const x=i=>Number.isFinite(Number(times[i]))?Number(times[i]):i;
 const decimate=(v,limit=400)=>{let out=[];const step=Math.max(1,Math.ceil(v.length/limit));for(let i=0;i<v.length;i+=step){const value=Number(v[i]);if(v[i]!=null&&Number.isFinite(value))out.push([x(i),value])}return out};
 return {hrSeries:decimate(hr),altitudeSeries:decimate(altitude),speedSeries:decimate(velocity),cadenceSeries:decimate(cadence),splits:calcKmSplits(times,distance)};
}
function calcKmSplits(times,dist){
 if(!Array.isArray(dist)||dist.length<2)return [];
 const elapsed=i=>Number.isFinite(Number(times?.[i]))?Number(times[i]):i;
 const splits=[];let prevT=elapsed(0),prevD=Number(dist[0])||0,mark=Math.ceil(Math.max(0,prevD)/1000)*1000;if(mark===0)mark=1000;
 let lastCross=prevT;
 for(let i=1;i<dist.length;i++){
  const d=Number(dist[i]),t=elapsed(i);if(!Number.isFinite(d)||!Number.isFinite(t))continue;
  while(d>=mark&&prevD<mark&&splits.length<80){
   const cross=prevT+(t-prevT)*(mark-prevD)/(d-prevD);const seconds=cross-lastCross;
   if(seconds>0)splits.push({km:Math.round(mark/1000),distanceKm:1,seconds:Math.round(seconds),pace:fmtPace(seconds)});
   lastCross=cross;mark+=1000;
  }
  prevT=t;prevD=d;
 }
 const lastDistance=Number(dist.at(-1))||0,lastTime=elapsed(dist.length-1),remain=lastDistance-(mark-1000);
 if(remain>20&&lastTime>lastCross&&splits.length<80){const seconds=lastTime-lastCross,pace=seconds/(remain/1000);splits.push({km:Math.ceil(lastDistance/1000),distanceKm:Number((remain/1000).toFixed(2)),seconds:Math.round(seconds),pace:fmtPace(pace)})}
 return splits;
}
function fmtPace(sec){const n=Math.max(0,Math.round(sec));return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`}
async function enrichIntervals(item,id){
 let did=false;
 if(!item.detailChecked){
  try{const detail=await callWorker('/sync/intervals/detail?id='+encodeURIComponent(id));
   const d=normalizedRecord(detail,'intervals');if(d){for(const f of ['gain','cal','hr','distance','pace','speed','duration'])if(d[f]!=null)item[f]=d[f];if(d.minutes>0)item.minutes=d.minutes}
   item.detailChecked=true;did=true;
  }catch(e){console.info('Intervals activity detail unavailable',id,e.message)}
 }
 if(!item.streamsChecked){
  try{const data=await callWorker('/sync/intervals/streams?id='+encodeURIComponent(id));
   const streams=parseIntervalStreams(data);for(const [key,value] of Object.entries(streams))if(value?.length)item[key]=value;
   item.streamsChecked=true;did=true;
  }catch(e){console.info('Intervals streams unavailable',id,e.message)}
 }
 if(!item.routePoints?.length){
  try{const pts=await fetchRoute('intervals',id);if(pts?.length>1){item.routePoints=pts;item.route=true;did=true}}
  catch(e){console.info('Intervals route unavailable',id,e.message)}
 }
 if(did)await storeActivity(item);
 return did;
}
async function syncNow(){
 const el=document.querySelector('#sync-status'),btn=document.querySelector('#sync-run');if(!el||!btn)return;
 btn.disabled=true;btn.textContent='正在连接…';let added=0,duplicate=0,routed=0,enriched=0,errors=[];
 let capabilities={intervals:true,garmin:true};
 try{const health=await callWorker('/health');if(health.providers)capabilities=health.providers;}
 catch(e){el.textContent='连接检查失败：'+e.message;btn.disabled=false;btn.textContent='↻ 重新尝试';return;}
 const first=!state.manual.some(a=>['Garmin Connect','Intervals.icu · Apple Health'].includes(a.source));
 const oldest=dateKey(new Date(Date.now()-(first?90:21)*864e5)),today=dateKey(new Date()),toEnrich=[];
 const providers=[['intervals',`/sync/intervals?oldest=${oldest}&newest=${today}`],['garmin',`/sync/garmin?start=${oldest}&end=${today}`]].filter(([source])=>capabilities[source]);
 if(!providers.length){el.textContent='尚未配置数据来源。';btn.disabled=false;btn.textContent='↻ 重新尝试';return;}
 for(const [source,path] of providers){
  const label=source==='intervals'?'Apple Watch':'Garmin';el.textContent=label+' · 正在获取记录…';
  try{const data=await callWorker(path);const records=Array.isArray(data.activities)?data.activities:[];
   for(const row of records){const item=normalizedRecord(row,source);if(!item)continue;
    const old=hasDuplicate(item),target=old||item,ident=String(row.id??row.activityId??row.activity_id);
    if(!old){if((await addActivity(item))==='added')added++}else duplicate++;
    if(source==='intervals'&&(!target.streamsChecked||!target.detailChecked||!target.routePoints?.length))toEnrich.push({item:target,source,id:ident});
    if(source==='garmin'&&!target.routePoints?.length&&(target.type==='run'||target.type==='cycle'))toEnrich.push({item:target,source,id:ident});
   }
   if(data.warning)errors.push(label+': '+data.warning);
  }catch(e){errors.push(label+': '+e.message)}
 }
 // Re-enrich old records too; upgrades do not create duplicate activities.
 for(const task of toEnrich.slice(0,12)){
  el.textContent='正在补充运动详情 · '+task.item.title;
  if(task.source==='intervals'){
   try{if(await enrichIntervals(task.item,task.id))enriched++;if(task.item.routePoints?.length)routed++}catch(e){errors.push('运动详情：'+e.message)}
  }else try{const pts=await fetchRoute(task.source,task.id);if(pts?.length>1){task.item.routePoints=pts;task.item.route=true;await storeActivity(task.item);routed++}}catch(e){console.info('GPS route unavailable',e.message)}
 }
 render();const result=document.querySelector('#sync-status'),b=document.querySelector('#sync-run');
 if(result)result.innerHTML=`<b>同步完成 · 新增 ${added} 条</b><br>已有 ${duplicate} 条 · 更新详情 ${enriched} 条 · GPS 路线 ${routed} 条${!capabilities.garmin?'<br><small>Garmin 尚未配置。</small>':''}${errors.length?'<br><span style="color:#a33">'+errors.map(esc).join('<br>')+'</span>':''}<br><small>已存在的跑步也会补充心率曲线和分段数据；未提供的数据保持空白。</small>`;
 if(b){b.disabled=false;b.textContent='↻ 再次同步'}
}

function coordsSvg(points){const arr=points.filter(p=>Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1]));if(arr.length<2)return '';
 const lat=arr.map(p=>p[0]),lon=arr.map(p=>p[1]),loX=Math.min(...lon),hiX=Math.max(...lon),loY=Math.min(...lat),hiY=Math.max(...lat),spanX=Math.max((hiX-loX)*Math.cos(((loY+hiY)/2)*Math.PI/180),.00001),spanY=Math.max(hiY-loY,.00001),scale=Math.min(320/spanX,178/spanY);const cx=(loX+hiX)/2,cy=(loY+hiY)/2,cos=Math.cos(cy*Math.PI/180),plot=p=>[(220+(p[1]-cx)*cos*scale).toFixed(1),(115-(p[0]-cy)*scale).toFixed(1)],list=arr.map(plot),path=list.map((p,i)=>(i?'L':'M')+p.join(' ')).join(' ');
 return `<svg class="route-vector" viewBox="0 0 440 230" aria-label="从 GPS 坐标生成的真实运动路线"><defs><pattern id="mapGrid" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M26 0H0V26" fill="none" stroke="#e7d6d9" stroke-width=".6"/></pattern></defs><rect width="440" height="230" rx="16" fill="#f7f0ed"/><rect width="440" height="230" fill="url(#mapGrid)"/><path d="${path}" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="${path}" fill="none" stroke="#bd6685" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${list[0][0]}" cy="${list[0][1]}" r="6" fill="#6d9b88" stroke="white" stroke-width="3"/><circle cx="${list.at(-1)[0]}" cy="${list.at(-1)[1]}" r="6" fill="#c76583" stroke="white" stroke-width="3"/></svg>`
}
function graphSVG(points,title,unit,color='#b96182'){
 const clean=(points||[]).filter(p=>Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1]));
 if(clean.length<2)return '';
 const vals=clean.map(p=>p[1]),min=Math.min(...vals),max=Math.max(...vals),ylo=Math.floor(min-(max-min)*.15),yhi=Math.ceil(max+(max-min)*.15)||ylo+1;
 const xlo=clean[0][0],xhi=clean.at(-1)[0],W=340,H=130,m=14;
 const px=x=>m+((x-xlo)/(xhi-xlo||1))*(W-2*m),py=y=>H-m-((y-ylo)/(yhi-ylo||1))*(H-2*m);
 const path=clean.map((p,i)=>(i?'L':'M')+px(p[0]).toFixed(1)+','+py(p[1]).toFixed(1)).join(' ');
 const avg=Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
 return `<div class="card p18 section metric-chart"><div class="micro">${title}</div><p class="chart-caption">平均 ${avg} ${unit} · 范围 ${Math.round(min)}–${Math.round(max)} ${unit}</p><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}真实数据曲线"><line x1="${m}" x2="${W-m}" y1="${H-m}" y2="${H-m}" stroke="#ead7e1"/><path d="${path}" fill="none" stroke="${color}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg><div class="chart-labels"><span>开始</span><span>约 ${Math.round((xhi-xlo)/60)} 分钟</span></div></div>`;
}
function splitsHtml(splits){if(!splits?.length)return '';
 return `<section class="section"><h2 class="section-title">每公里配速</h2><div class="card p18" style="margin-top:12px"><div class="split-head"><span>公里</span><span>距离</span><span>时间</span><span>平均配速</span></div>${splits.map(s=>`<div class="split-row"><strong>${s.km}</strong><span>${s.distanceKm.toFixed(2)} km</span><span>${fmtPace(s.seconds)}</span><strong>${esc(s.pace)}/km</strong></div>`).join('')}</div></section>`;
}
function routeMapHtml(a){if(!a.routePoints||a.routePoints.length<2)return `<div class="no-route">⌁　当前运动没有可用的 GPS 轨迹<br><small>可以尝试导入 GPX / TCX / FIT 文件补充路线</small></div>`;return `<div class="map-box real-route"><div id="map-canvas" style="width:100%;height:100%;display:none"></div><div id="map-fallback">${coordsSvg(a.routePoints)}</div><span class="map-label">GPS TRACK · ${a.routePoints.length} points</span></div>`}
// Art-map mode: render real GPS points over a quiet vector basemap, never an invented illustration.
// If MapLibre or vector tiles are unavailable, preserve the lightweight Leaflet / SVG fallback.
let routeMapInstance=null;
function initializeRouteMap(){
 const el=document.getElementById('map-canvas'),fallback=document.getElementById('map-fallback');
 const act=state.manual.find(a=>a.id===state.activityID);
 if(routeMapInstance){try{routeMapInstance.remove()}catch(e){}routeMapInstance=null}
 if(!el||!act?.routePoints?.length)return;
 const points=act.routePoints.filter(p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(Number(p[0]))&&Number.isFinite(Number(p[1]))&&Math.abs(p[0])<=90&&Math.abs(p[1])<=180);
 if(points.length<2)return;
 const showFallback=()=>{if(fallback)fallback.style.display='block';el.style.display='none'};
 const showCanvas=()=>{el.style.display='block';el.style.width='100%';el.style.height='100%'};
 const coords=points.map(p=>[Number(p[1]),Number(p[0])]);
 const bbox=[Math.min(...coords.map(p=>p[0])),Math.min(...coords.map(p=>p[1])),Math.max(...coords.map(p=>p[0])),Math.max(...coords.map(p=>p[1]))];
 // Avoid a large full-world rectangle when the GPS contains a few stray points.
 const lineData={type:'Feature',properties:{},geometry:{type:'LineString',coordinates:coords}};
 function leafletFallback(){
   if(!window.L){showFallback();return}
   try{
    showCanvas();
    const m=L.map(el,{zoomControl:false,attributionControl:true,scrollWheelZoom:false,preferCanvas:true});
    routeMapInstance=m;
    const tiles=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors',maxZoom:19});
    tiles.on('load',()=>{if(fallback)fallback.style.display='none'});
    tiles.on('tileerror',showFallback);tiles.addTo(m);
    const line=L.polyline(points,{color:'#d2835d',weight:5,opacity:.98}).addTo(m);
    L.circleMarker(points[0],{radius:6,color:'#fffbf4',weight:2.5,fillColor:'#79a483',fillOpacity:1}).addTo(m);
    L.circleMarker(points.at(-1),{radius:6,color:'#fffbf4',weight:2.5,fillColor:'#d2835d',fillOpacity:1}).addTo(m);
    const fit=()=>{if(el.isConnected){m.invalidateSize({pan:false});m.fitBounds(line.getBounds(),{padding:[26,26],maxZoom:16,animate:false})}};
    requestAnimationFrame(()=>requestAnimationFrame(fit));setTimeout(fit,300);
   }catch(e){console.warn('Map fallback unavailable',e);showFallback()}
 }
 if(!window.maplibregl){leafletFallback();return}
 let m=null,loaded=false;
 try{
  showCanvas();
  m=new maplibregl.Map({
    container:el,
    style:'https://tiles.openfreemap.org/styles/positron',
    center:coords[0],zoom:12,pitch:0,bearing:0,
    antialias:true,attributionControl:false,
    dragRotate:false,scrollZoom:false,pitchWithRotate:false
  });
  routeMapInstance=m;
  m.touchZoomRotate.disableRotation();
  m.addControl(new maplibregl.AttributionControl({compact:true,customAttribution:
   '<a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a> · <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'}), 'bottom-right');
  m.on('load',()=>{
   if(!el.isConnected)return;loaded=true;
   // Remove labels and POI icons: keep calm street, park, water and rail linework.
   const style=m.getStyle();
   for(const layer of style.layers||[]){
     try{
       if(layer.type==='symbol')m.setLayoutProperty(layer.id,'visibility','none');
       else if(layer.type==='fill'&&/water|river|lake/i.test(layer.id))m.setPaintProperty(layer.id,'fill-color','#c5d9d3');
       else if(layer.type==='fill'&&/park|grass|wood|green|landcover/i.test(layer.id))m.setPaintProperty(layer.id,'fill-color','#e2eadb');
     }catch(_){}
   }
   m.addSource('motion-route',{type:'geojson',data:lineData});
   m.addLayer({id:'motion-halo',type:'line',source:'motion-route',paint:{'line-color':'#fff8ed','line-width':9,'line-opacity':.96},layout:{'line-join':'round','line-cap':'round'}});
   m.addLayer({id:'motion-trace',type:'line',source:'motion-route',paint:{'line-color':'#d77f5a','line-width':5,'line-opacity':1},layout:{'line-join':'round','line-cap':'round'}});
   m.addSource('motion-endpoints',{type:'geojson',data:{type:'FeatureCollection',features:[
     {type:'Feature',properties:{kind:'start'},geometry:{type:'Point',coordinates:coords[0]}},
     {type:'Feature',properties:{kind:'finish'},geometry:{type:'Point',coordinates:coords.at(-1)}}
   ]}});
   m.addLayer({id:'motion-endpoint-dots',type:'circle',source:'motion-endpoints',paint:{
     'circle-radius':6,'circle-color':['match',['get','kind'],'start','#7da487','#d77f5a'],
     'circle-stroke-color':'#fffaf1','circle-stroke-width':2.5
   }});
   if(fallback)fallback.style.display='none';
   m.resize();m.fitBounds([[bbox[0],bbox[1]],[bbox[2],bbox[3]]],{padding:28,maxZoom:16,duration:0});
  });
  m.on('webglcontextlost',()=>{console.warn('Map WebGL context lost');showFallback()});
  m.on('error',e=>{if(!loaded)console.warn('Vector map loading issue:',e?.error||e)});
  setTimeout(()=>{if(!loaded&&el.isConnected){try{m.remove()}catch(e){}routeMapInstance=null;showFallback();leafletFallback()}},12500);
 }catch(e){console.warn('Vector map unavailable; using fallback',e);if(m)try{m.remove()}catch(_){}routeMapInstance=null;leafletFallback()}
}

function pointDistance(a,b){const rad=Math.PI/180,R=6371000,dlat=(b[0]-a[0])*rad,dlon=(b[1]-a[1])*rad;const x=Math.sin(dlat/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(dlon/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(x)))}
function uniqueID(){return (crypto.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2))}
function parseGPX(text,name){const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.querySelector('parsererror'))throw Error('GPX XML 无法解析');const pts=[...doc.getElementsByTagName('trkpt')];if(!pts.length)throw Error('找不到 GPX 轨迹点');const arr=pts.map(n=>{const lat=Number(n.getAttribute('lat')),lon=Number(n.getAttribute('lon'));const time=n.getElementsByTagName('time')[0]?.textContent;const hrNode=[...n.getElementsByTagName('*')].find(e=>e.localName?.toLowerCase()==='hr');return {pos:[lat,lon],time:time?Date.parse(time):NaN,hr:hrNode?Number(hrNode.textContent):0}}).filter(p=>p.pos.every(Number.isFinite));return trackToActivity(arr,name,'gpx')}
function parseTCX(text,name){const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.querySelector('parsererror'))throw Error('TCX XML 无法解析');const points=[...doc.getElementsByTagName('*')].filter(x=>x.localName==='Trackpoint');if(!points.length)throw Error('找不到 TCX Trackpoint');const get=(n,tag)=>[...n.getElementsByTagName('*')].find(x=>x.localName===tag)?.textContent;let arr=points.map(n=>({pos:[Number(get(n,'LatitudeDegrees')),Number(get(n,'LongitudeDegrees'))],time:Date.parse(get(n,'Time')||''),hr:Number(get(n,'Value')||0)})).filter(p=>p.pos.every(Number.isFinite));const ty=doc.getElementsByTagName('Activity')[0]?.getAttribute('Sport')||'';return trackToActivity(arr,name,'tcx',ty)}
function trackToActivity(arr,name,src,activityHint=''){if(arr.length<2)throw Error('有效路线点不足');let meters=0;for(let i=1;i<arr.length;i++){let d=pointDistance(arr[i-1].pos,arr[i].pos);if(d<1000)meters+=d}
 const times=arr.map(p=>p.time).filter(Number.isFinite),startMs=times[0]||Date.now(),finishMs=times.at(-1)||startMs+60e3;const mins=Math.max(1,(finishMs-startMs)/60000),km=Number((meters/1000).toFixed(2));const hint=(name+' '+activityHint).toLowerCase();const type=/bik|cycl|骑行|ride|biking/.test(hint)?'cycle':'run';const hrList=arr.map(p=>p.hr).filter(h=>h>=30&&h<=240),hr=hrList.length?Math.round(hrList.reduce((a,b)=>a+b,0)/hrList.length):null;const d=new Date(startMs),start=d.toISOString();const a={id:'file-'+uniqueID(),sourceKey:'file:'+src+':'+start+':'+km,source:src.toUpperCase()+' 文件',date:new Date(startMs).toLocaleDateString('sv-SE'),start,title:name.replace(/\.(gpx|tcx|fit)$/i,''),minutes:Math.round(mins*10)/10,distance:km,type,hr,routePoints:arr.map(x=>x.pos)};
 a.date=new Date(startMs).toLocaleDateString('sv-SE');if(type==='run'&&km){const pm=mins/km;a.pace=Math.floor(pm)+':'+String(Math.round(pm%1*60)).padStart(2,'0')}if(type==='cycle'&&km)a.speed=+(km/(mins/60)).toFixed(1);return a}
function dataValue(b,offset,size,type,le){if(offset+size>b.byteLength)return null;const dv=new DataView(b.buffer,b.byteOffset+offset,size);const t=type&0x1f;try{if(t===0||t===2||t===10)return dv.getUint8(0);if(t===1)return dv.getInt8(0);if(t===3)return dv.getInt16(0,le);if(t===4||t===11)return dv.getUint16(0,le);if(t===5)return dv.getInt32(0,le);if(t===6||t===12)return dv.getUint32(0,le);if(t===8)return dv.getFloat32(0,le);if(t===9)return dv.getFloat64(0,le)}catch{}return null}
function parseFITBytes(buffer,name){const b=new Uint8Array(buffer),v=new DataView(buffer);if(b.length<20||String.fromCharCode(...b.slice(8,12))!=='.FIT')throw Error('不是有效的 FIT 文件');const start=b[0],end=Math.min(start+v.getUint32(4,true),b.length-2),defs=new Array(16).fill(null);let pos=start,records=[],sessions=[];const epoch=Date.UTC(1989,11,31);
 while(pos<end){const h=b[pos++];if(h&0x80){const id=(h>>5)&3;if(!defs[id])throw Error('FIT compressed timestamp 未找到定义');const d=defs[id],entry={};for(const f of d.fields){let val=dataValue(b,pos,f.size,f.type,d.le);pos+=f.size;entry[f.n]=val}pos+=d.extraBytes||0;if(d.g===20)records.push(entry);if(d.g===18)sessions.push(entry);continue}
 const id=h&15,definition=(h&0x40)!==0;if(definition){pos+=1;const le=b[pos++]===0;const g=v.getUint16(pos,le);pos+=2;const count=b[pos++],fields=[];for(let j=0;j<count;j++){fields.push({n:b[pos],size:b[pos+1],type:b[pos+2]});pos+=3}let extraBytes=0;if(h&0x20){const dc=b[pos++];for(let j=0;j<dc;j++){extraBytes+=b[pos+1];pos+=3}}defs[id]={g,le,fields,extraBytes}}else{const d=defs[id];if(!d)throw Error('FIT 数据消息缺少定义');const entry={};for(const f of d.fields){entry[f.n]=dataValue(b,pos,f.size,f.type,d.le);pos+=f.size}pos+=d.extraBytes||0;if(d.g===20)records.push(entry);if(d.g===18)sessions.push(entry)}
 }
 const pts=records.filter(r=>r[0]!=null&&r[1]!=null&&r[0]!==2147483647&&r[1]!==2147483647).map(r=>({pos:[r[0]*180/2**31,r[1]*180/2**31],time:Number.isFinite(r[253])?epoch+r[253]*1000:NaN,hr:r[3]||0}));if(pts.length<2)throw Error('FIT 中没有足够的 GPS 轨迹点');return trackToActivity(pts,name,'fit');
}
async function importFile(file){const ext=file.name.split('.').at(-1)?.toLowerCase();let item;
 if(ext==='gpx')item=parseGPX(await file.text(),file.name);
 else if(ext==='tcx')item=parseTCX(await file.text(),file.name);
 else if(ext==='fit')item=parseFITBytes(await file.arrayBuffer(),file.name);
 else throw Error('暂不支持此文件格式');
 const outcome=await addActivity(item);return outcome;
}
async function handleFileInput(event){const files=[...event.target.files];if(!files.length)return;let n=0,skipped=0,errors=[];for(const f of files){try{let r=await importFile(f);if(r==='added')n++;else skipped++}catch(e){errors.push(f.name+': '+e.message)}}event.target.value='';render();toast(`导入 ${n} 条，跳过 ${skipped} 条${errors.length?'；失败 '+errors.length+' 条':''}`);if(errors.length)alert(errors.join('\n'))}
async function importBackup(){const i=document.createElement('input');i.type='file';i.accept='.json,application/json';i.onchange=async()=>{const f=i.files[0];if(!f)return;try{const data=JSON.parse(await f.text());if(data.format!=='motion-backup-v1'||!Array.isArray(data.activities))throw Error('不是 MOTION. 备份文件');let n=0;for(const a of data.activities){if((await addActivity(a))==='added')n++}if(confirm('已导入 '+n+' 条运动。是否同时恢复计划、收藏及笔记？')){if(Array.isArray(data.plan))state.plan=data.plan;if(Array.isArray(data.favorites))state.favorites=data.favorites;if(Array.isArray(data.wishlist))state.wishlist=data.wishlist;if(data.notes)state.notes=data.notes;persist()}render();toast('备份已恢复')}catch(e){alert('备份文件不正确：'+e.message)}};i.click()}
async function removeSamples(){const ids=state.manual.filter(a=>a.id?.startsWith('sample-')).map(a=>a.id);if(!ids.length){toast('没有演示数据');return}for(const id of ids){await removeSavedActivity(id)}state.manual=state.manual.filter(a=>!ids.includes(a.id));render();toast('已移除 '+ids.length+' 条演示样例')}
async function loadSample(){const seed=sampleRecords.map(r=>({...r,id:'sample-'+r.id,source:'演示数据 · SAMPLE',sourceKey:'sample:'+r.id}));let n=0;for(const r of seed){if((await addActivity(r))==='added')n++}state.calendarMonth=new Date(2026,9,1,12);state.weekOverview=new Date(2026,9,29,12);state.selectedDate='2026-10-30';state.nav='overview';closeSync();render();toast('已加载 '+n+' 条演示记录（可从设置清除）')}
window.addEventListener('DOMContentLoaded',()=>{document.querySelector('#import-file')?.addEventListener('change',handleFileInput);hydrate()});
