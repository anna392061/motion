'use strict';
/* MOTION. V1.4 — selectively imported workouts, gear mileage and complete details.
   Runs after the original, battle-tested V1.2 app. Existing IndexedDB is retained. */
const GEAR_KEY='motion_gear_v14';
let gearList=[];
try{const g=JSON.parse(localStorage.getItem(GEAR_KEY)||'[]');if(Array.isArray(g))gearList=g}catch{}
let gearEditorId=null;
let syncCandidates=[];
let syncSelected=new Set();
let syncFilter='all';
let syncSport='all';
let syncQuery='';
let syncPeriod='90';
let syncShown=25;
let syncBusy=false;
let importShoeChoices={};
let lastSyncErrors=[];
let editingBackup=false;
const gearSave=()=>{localStorage.setItem(GEAR_KEY,JSON.stringify(gearList))};
const activeShoes=()=>gearList.filter(g=>g.status!=='retired');
const getShoe=id=>gearList.find(g=>g.id===id);
const shoeDistance=g=>Math.round((Number(g.initialKm||0)+state.manual.filter(a=>a.type==='run'&&a.shoeId===g.id).reduce((sum,a)=>sum+(Number(a.distance)||0),0))*100)/100;
const shoeRuns=g=>state.manual.filter(a=>a.type==='run'&&a.shoeId===g.id).length;
const defaultShoe=()=>activeShoes().find(g=>g.default)?.id||'';
const allowedExternalURL=s=>typeof s==='string'&&/^https?:\/\//.test(s);
function gearOpen(){document.querySelector('#sync-sheet')?.remove();document.querySelector('.overlay')?.remove();state.overlay=null;gearEditorId=null;gearRender()}
function gearClose(){document.querySelector('#gear-sheet')?.remove();render()}
function gearRender(){
  let sheet=document.querySelector('#gear-sheet');if(!sheet){sheet=document.createElement('div');sheet.id='gear-sheet';sheet.className='overlay gear-sheet';document.querySelector('.app').appendChild(sheet)}
  const total=state.manual.filter(a=>a.type==='run').reduce((n,a)=>n+(Number(a.distance)||0),0);
  sheet.innerHTML=`<button class="backlink" onclick="gearClose()">← 返回</button><div class="micro">EQUIPMENT JOURNAL</div><h1 class="page-title">My running shoes<span style="color:var(--orange)">.</span></h1><p class="sub">每一步都有自己的故事。跑鞋里程由关联的真实跑步自动统计。</p>
  <div class="gear-head"><div><span class="micro">RUNNING DISTANCE · RECORDED</span><div class="gear-big">${total.toFixed(1)} <small>km</small></div></div><div><span class="micro">SHOES</span><div class="gear-big">${gearList.length}</div></div></div>
  ${gearList.length?`<div class="gear-grid">${gearList.map(g=>`<button class="gear-tile" onclick="gearEdit('${esc(g.id)}')"><div class="shoe-graphic">${g.photo?`<img src="${esc(g.photo)}" alt="${esc(g.name)}">`:`<span>↗</span>`}</div><div class="micro">${esc(g.brand||'MY SHOES')}</div><strong>${esc(g.name)}</strong><span class="shoe-km">${shoeDistance(g).toFixed(1)} <small>km</small></span><span class="gear-sub">${shoeRuns(g)} runs ${g.default?' · ★ 默认':''} ${g.status==='retired'?' · 已退役':''}</span></button>`).join('')}</div>`:'<div class="card p20" style="margin:18px 0;color:var(--muted)">还没有跑鞋。添加第一双跑鞋后，可以在导入跑步时直接选择它。</div>'}
  <button class="primary wide" onclick="gearEdit()">＋ Add running shoes</button>
  <section class="section"><h2 class="section-title">未分配的跑步</h2><p class="helper">你可以在每条跑步详情中选择实际穿着的跑鞋。</p><div class="card p18" style="margin-top:10px">${state.manual.filter(a=>a.type==='run'&&!a.shoeId).length} 条跑步尚未选择跑鞋</div></section>
  <p class="helper section">起始公里数可用于补录开始使用 MOTION. 之前的跑量；之后只统计实际关联的运动。重复同步不会重复计算。</p>
  ${gearEditorId!==null?gearForm(gearEditorId):''}`;
  sheet.scrollTop=0;
}
function gearForm(id){const g=id==='new'?{}:getShoe(id)||{};return `<div class="gear-editor-backdrop"><div class="gear-editor"><div class="spread"><h2 style="font-size:20px">${id==='new'?'添加跑鞋':'编辑跑鞋'}</h2><button class="soft-btn" onclick="gearCancel()">✕</button></div><label class="form-label">品牌<input id="shoe-brand" class="search" placeholder="例如 adidas" value="${esc(g.brand||'')}"></label><label class="form-label">型号 / 名称<input id="shoe-name" class="search" maxlength="80" placeholder="例如 Adizero Evo SL" value="${esc(g.name||'')}"></label><div class="two-info"><label class="form-label">开始使用日期<input type="date" id="shoe-start" class="search" value="${esc(g.startDate||dateKey(new Date()))}"></label><label class="form-label">初始公里数 (km)<input type="number" min="0" step="0.1" id="shoe-initial" class="search" value="${Number(g.initialKm||0)}"></label></div><label class="form-label">个人备注<textarea id="shoe-notes" class="note-input" placeholder="脚感、适用配速、鞋楦感受...">${esc(g.notes||'')}</textarea></label><label class="form-label">跑鞋照片（可选）<input type="file" id="shoe-photo" accept="image/*" class="search"></label><label class="form-label" style="display:flex;align-items:center;gap:9px"><input type="checkbox" id="shoe-default" ${g.default?'checked':''}> 设为默认跑鞋</label><label class="form-label" style="display:flex;align-items:center;gap:9px"><input type="checkbox" id="shoe-retired" ${g.status==='retired'?'checked':''}> 已退役</label><div class="row" style="gap:8px;justify-content:space-between;margin-top:18px"><button class="soft-btn" onclick="gearCancel()">取消</button>${id!=='new'?'<button class="soft-btn" onclick="gearRemove()">删除装备</button>':''}<button class="primary small" onclick="gearSubmit()">保存跑鞋</button></div></div></div>`}
function gearEdit(id='new'){gearEditorId=id;gearRender();}
function gearCancel(){gearEditorId=null;gearRender()}
function resizePhoto(file){return new Promise((resolve,reject)=>{if(!file)return resolve(null);if(file.size>12*1024*1024)return reject(Error('照片大小请小于 12MB'));let url=URL.createObjectURL(file);let img=new Image();img.onload=()=>{let c=document.createElement('canvas');const scale=Math.min(1,500/Math.max(img.width,img.height));c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);resolve(c.toDataURL('image/jpeg',.7))};img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('图片无法读取'))};img.src=url})}
async function gearSubmit(){try{const name=document.querySelector('#shoe-name')?.value.trim();if(!name){alert('请填写跑鞋型号或名称');return}const id=gearEditorId,old=id==='new'?{}:getShoe(id)||{};const photoFile=document.querySelector('#shoe-photo')?.files[0];const photo=photoFile?await resizePhoto(photoFile):old.photo||'';const g={...old,id:id==='new'?'shoe-'+Date.now().toString(36):id,brand:document.querySelector('#shoe-brand').value.trim(),name,startDate:document.querySelector('#shoe-start').value,initialKm:Math.max(0,Number(document.querySelector('#shoe-initial').value)||0),notes:document.querySelector('#shoe-notes').value.trim(),photo,status:document.querySelector('#shoe-retired').checked?'retired':'active',default:document.querySelector('#shoe-default').checked};if(g.default){gearList.forEach(sh=>sh.default=false)}const k=gearList.findIndex(sh=>sh.id===g.id);if(k<0)gearList.unshift(g);else gearList[k]=g;gearSave();gearEditorId=null;gearRender();toast('跑鞋已保存')}catch(err){alert(err.message)}}
function gearRemove(){const id=gearEditorId,g=getShoe(id);if(!g||!confirm('删除跑鞋「'+g.name+'」？关联运动仍会保留，但其跑鞋归属会清空。'))return;gearList=gearList.filter(x=>x.id!==id);Promise.all(state.manual.filter(a=>a.shoeId===id).map(a=>{delete a.shoeId;return storeActivity(a)}));gearSave();gearEditorId=null;gearRender()}
async function setActivityShoe(id){const a=state.manual.find(x=>x.id===id);if(!a||a.type!=='run')return;const sel=document.getElementById('run-shoe-choice');a.shoeId=sel?.value||null;await storeActivity(a);showOverlay();toast(a.shoeId?'已将跑步计入跑鞋':'已取消跑鞋归属')}
function shoePickerForActivity(a){return `<section class="card p18 section gear-in-activity"><div class="micro">RUNNING GEAR</div><div class="spread" style="margin-top:8px;gap:10px"><div><h2 class="section-title">这次穿的是哪双鞋？</h2><p class="helper">更改后自动重新计算跑鞋累计里程</p></div><span class="shoe-icon">↗</span></div><select id="run-shoe-choice" class="search" onchange="setActivityShoe('${esc(a.id)}')"><option value="">暂不指定</option>${gearList.map(g=>`<option value="${esc(g.id)}" ${a.shoeId===g.id?'selected':''}>${esc(g.brand?g.brand+' ':'')}${esc(g.name)}${g.status==='retired'?'（已退役）':''}</option>`).join('')}</select><button class="more" onclick="gearOpen()">＋ 管理我的跑鞋 →</button></section>`}

// Preserve legacy functions while adding Gear / graphs to the existing pages.
const overviewBeforeV14=overview;
overview=function(){const old=overviewBeforeV14();const n=gearList.length;return old.replace('<h1 class="page-title">运动总览</h1>',`<h1 class="page-title">运动总览</h1><div class="overview-quick"><button onclick="gearOpen()">↗ &nbsp; My Gear <small>${n} 双跑鞋</small></button><button onclick="openSync()">↻ &nbsp; Import activities <small>手动选择</small></button></div>`)};
const settingsBeforeV14=settingsOverlay;
settingsOverlay=function(){const old=settingsBeforeV14().replace('V1.2','V1.4');return old+`<div class="card p18 section"><div class="spread"><div><b>My Gear · 我的跑鞋</b><div class="helper">管理每双跑鞋与累计使用里程</div></div><button class="soft-btn" onclick="gearOpen()">打开 →</button></div></div><p class="helper section">Safari 与主屏幕版是独立本地存储。需要在新环境恢复 JSON 备份，之后再同步运动来源。</p>`};
const activityBeforeV14=activityOverlay;
activityOverlay=function(){let html=activityBeforeV14();const a=state.manual.find(x=>x.id===state.activityID);if(!a)return html;let extras='';
if(a.type==='run')extras+=shoePickerForActivity(a);
if(a.type==='run'&&a.paceSeries?.length>1)extras+=motionPaceGraph(a.paceSeries);
if(a.type==='cycle'&&a.speedSeries?.length>1)extras+=graphSVG(a.speedSeries.map(p=>[p[0],p[1]*3.6]),'SPEED · 速度','km/h','#c57741');
if(a.cadenceSeries?.length>1&&(a.type==='run'||a.type==='cycle')){
  // FIT / Intervals cadence can be strides/min or steps/min; normalize for display.
  // Conversion is display-only; never modify stored cadenceSeries or backups.
  const isRunning=a.type==='run';
  // Sources may report either strides/min (one foot) or steps/min (both feet).
  // Infer the representation from the median of positive samples once per activity,
  // not per point, avoiding accidental 340+ spm for already-normalized records.
  const cadenceSamples=a.cadenceSeries.map(p=>Number(p[1])).filter(v=>Number.isFinite(v)&&v>15&&v<300).sort((x,y)=>x-y);
  const median=cadenceSamples.length?cadenceSamples[Math.floor(cadenceSamples.length/2)]:0;
  const runScale=isRunning&&median>0&&median<125?2:1;
  const cadencePoints=isRunning?a.cadenceSeries.map(p=>[p[0],p[1]*runScale]):a.cadenceSeries;
  extras+=graphSVG(cadencePoints,
    isRunning?'RUNNING CADENCE · 步频':'CYCLING CADENCE · 踏频',
    isRunning?'步/分钟':'rpm','#a27f5f');
}
if(a.powerSeries?.length>1)extras+=graphSVG(a.powerSeries,'POWER · 功率','W','#a67b60');
if(a.type==='cycle'&&a.cal!=null)extras+=`<section class="card p18 section"><div class="micro">ACTIVE CALORIES</div><h2>${Math.round(a.cal)} kcal</h2></section>`;
if(a.type==='cycle'&&Number.isFinite(a.power))extras+=`<section class="card p18 section"><div class="micro">AVERAGE POWER</div><h2>${a.power} W</h2></section>`;
html=html.replace('<div class="card p18 section"><div class="eyebrow">管理这条记录</div>',extras+'<div class="card p18 section"><div class="eyebrow">管理这条记录</div>');return html};
// v1 backup-compatible schema, adding gear and richer activity fields.
exportData=function(){const data={format:'motion-backup-v1',appVersion:'1.4',exportedAt:new Date().toISOString(),activities:state.manual,gear:gearList,plan:state.plan,favorites:state.favorites,wishlist:state.wishlist,notes:state.notes};downloadJSON(data,'MOTION-backup-'+dateKey(new Date())+'.json');toast('完整备份已下载，请保存在私密位置')};
importBackup=async function(){const i=document.createElement('input');i.type='file';i.accept='.json,application/json';i.onchange=async()=>{let f=i.files[0];if(!f)return;try{const data=JSON.parse(await f.text());if(data.format!=='motion-backup-v1'||!Array.isArray(data.activities))throw Error('不是兼容的 MOTION 备份');let added=0,duplicate=0;for(const a of data.activities){const existing=hasDuplicate(a);const result=await addActivity(a);if(result==='added')added++;else{duplicate++;if(existing&&!existing.shoeId&&a.shoeId){existing.shoeId=a.shoeId;await storeActivity(existing)}}}if(Array.isArray(data.gear)){for(const g of data.gear){if(g?.id&&!gearList.some(x=>x.id===g.id))gearList.push(g)}gearSave()}if(confirm(`已合并运动 ${added} 条，已存在 ${duplicate} 条。是否同时恢复训练计划、收藏和个人笔记？`)){if(Array.isArray(data.plan))state.plan=data.plan;if(Array.isArray(data.favorites))state.favorites=data.favorites;if(Array.isArray(data.wishlist))state.wishlist=data.wishlist;if(data.notes&&typeof data.notes==='object')state.notes={...state.notes,...data.notes};persist()}render();toast('备份恢复完成')}catch(e){alert('恢复失败：'+e.message)}};i.click()};

// ---------- Selective import: list first, only fetch full content after consent ----------
function openSync(){document.querySelector('#sync-sheet')?.remove();document.querySelector('.overlay')?.remove();state.overlay=null;syncCandidates=[];syncSelected.clear();syncFilter='all';syncSport='all';syncShown=25;lastSyncErrors=[];
 const e=document.createElement('div');e.className='overlay sync-sheet v14-sync';e.id='sync-sheet';document.querySelector('.app').append(e);syncRender()}
function syncRender(){const el=document.getElementById('sync-sheet');if(!el)return;
 const items=syncCandidates.filter(c=>(syncFilter==='all'||c.source===syncFilter)&&(syncSport==='all'||c.item.type===syncSport)&&(syncQuery===''||(`${c.item.title} ${c.item.date}`.toLowerCase().includes(syncQuery.toLowerCase()))));
 const sorted=[...items].sort((a,b)=>(b.item.start||b.item.date).localeCompare(a.item.start||a.item.date));const shown=sorted.slice(0,syncShown);
 const count=syncSelected.size;
 el.innerHTML=`<button class="backlink" onclick="closeSync()">← 返回</button><div class="micro">MANUAL SYNC · V1.4</div><h1 class="page-title">Import activities<span style="color:var(--orange)">.</span></h1><p class="sub">先浏览运动列表，再挑选需要保存的记录。不会自动批量导入历史运动。</p>
 <section class="card p18 sync-step"><div class="spread"><div><div class="micro">STEP 01</div><h2 class="section-title">查看可导入的运动</h2></div><span class="pill">READ ONLY</span></div><div class="row" style="gap:8px;margin-top:14px;align-items:center"><select id="sync-period" class="search" onchange="syncPeriod=this.value" style="margin:0;flex:1"><option value="30" ${syncPeriod==='30'?'selected':''}>最近 30 天</option><option value="90" ${syncPeriod==='90'?'selected':''}>最近 90 天</option><option value="365" ${syncPeriod==='365'?'selected':''}>最近一年</option><option value="all" ${syncPeriod==='all'?'selected':''}>尽可能多的历史运动</option></select><button id="fetch-activities" class="primary small" onclick="fetchAvailableActivities()" ${syncBusy?'disabled':''}>${syncBusy?'获取中…':'Fetch list ↻'}</button></div><p class="helper" style="margin-top:9px">这一步只下载列表摘要，不下载 FIT / GPX 文件，也不保存运动。</p></section>
 ${syncCandidates.length?`<section class="section" style="margin-top:22px"><div class="spread"><h2 class="section-title">STEP 02 · 选择记录</h2><span class="micro">${sorted.length} AVAILABLE</span></div><div class="filter-line" style="margin:12px 0"><button class="pill ${syncFilter==='all'?'active':''}" onclick="syncSetFilter('all')">全部</button><button class="pill ${syncFilter==='intervals'?'active':''}" onclick="syncSetFilter('intervals')">Apple Watch</button><button class="pill ${syncFilter==='garmin'?'active':''}" onclick="syncSetFilter('garmin')">Garmin</button></div><div class="row" style="gap:8px"><select class="search" style="flex:1" onchange="syncSport=this.value;syncShown=25;syncRender()"><option value="all" ${syncSport==='all'?'selected':''}>全部运动</option>${Object.entries(sport).map(([k,v])=>`<option value="${k}" ${syncSport===k?'selected':''}>${v.zh}</option>`).join('')}</select><button class="soft-btn" style="margin-bottom:10px" onclick="selectRecent()">仅选最近一条</button></div><div class="sync-list">${shown.map(c=>syncRow(c)).join('')}</div>${shown.length<sorted.length?`<button class="soft-btn wide" style="margin-top:10px" onclick="syncShown+=25;syncRender()">显示更多 · 还有 ${sorted.length-shown.length} 条</button>`:''}</section>`:''}
 <div id="sync-status" class="notice section" aria-live="polite">${syncCandidates.length?`已加载 ${syncCandidates.length} 条可浏览记录。已选择 ${count} 条。`:'尚未读取远端列表。请点击 Fetch list。'}${lastSyncErrors.length?'<p style="margin-top:8px">'+lastSyncErrors.map(esc).join('；')+'</p>':''}</div>
 ${syncCandidates.length?`<div class="sync-bottom"><div class="spread"><span>${count} selected</span><button class="more" onclick="syncSelected.clear();syncRender()">清除选择</button></div><button class="primary wide" ${count===0||syncBusy?'disabled':''} onclick="importSelectedActivities()">${syncBusy?'导入中…':`Import Selected · ${count}`}</button></div>`:''}
 <div class="card p18 section" style="margin-bottom:35px"><div class="spread"><div><b>导入运动文件</b><p class="helper">GPX / TCX / FIT 文件，离线使用</p></div><button class="soft-btn" onclick="document.querySelector('#import-file').click()">选择文件</button></div></div>`;
}
function syncRow(c){const a=c.item,existing=!!hasDuplicate(a),checked=syncSelected.has(c.key),disabled=existing&&!c.needsRefresh;const status=existing?(c.needsRefresh?'可更新详情':'已导入'):'未导入';const shoeField=a.type==='run'&&checked&&!disabled?`<div class="sync-shoe"><label>跑鞋：<select onchange="importShoeChoices['${esc(c.key)}']=this.value" onclick="event.stopPropagation()"><option value="">暂不指定</option>${gearList.map(g=>`<option value="${esc(g.id)}" ${importShoeChoices[c.key]===g.id?'selected':''}>${esc(g.brand?g.brand+' ':'')}${esc(g.name)}</option>`).join('')}</select></label></div>`:'';
 return `<div class="sync-record ${disabled?'already-imported':''}"><label class="sync-check"><input type="checkbox" ${checked?'checked':''} ${disabled?'disabled':''} onchange="toggleSyncChoice('${esc(c.key)}',this.checked)"><span class="sync-symbol">${sportIcon(a.type,18)}</span><span class="sync-info"><strong>${esc(a.title)}</strong><small>${esc(a.date)} · ${c.source==='garmin'?'Garmin':'Apple Watch'} ${a.distance?' · '+a.distance+' km':''} · ${Math.round(a.minutes)} min</small></span><span class="sync-state">${status}</span></label>${shoeField}</div>`}
function syncSetFilter(v){syncFilter=v;syncShown=25;syncRender()}
function toggleSyncChoice(key,checked){if(checked){syncSelected.add(key);if(!(key in importShoeChoices))importShoeChoices[key]=defaultShoe()}else syncSelected.delete(key);syncRender()}
function selectRecent(){const s=syncCandidates.filter(c=>!hasDuplicate(c.item)||c.needsRefresh).sort((a,b)=>(b.item.start||b.item.date).localeCompare(a.item.start||a.item.date));syncSelected.clear();if(s[0]){syncSelected.add(s[0].key);importShoeChoices[s[0].key]??=defaultShoe()}syncRender()}
async function fetchAvailableActivities(){if(syncBusy)return;syncBusy=true;syncCandidates=[];syncSelected.clear();lastSyncErrors=[];syncRender();const now=new Date(),oldest=syncPeriod==='all'?'2010-01-01':dateKey(new Date(now.getTime()-Number(syncPeriod)*864e5));const newest=dateKey(now);
 let capabilities={};try{const health=await callWorker('/health');capabilities=health.providers||{}}catch(err){lastSyncErrors.push('连接失败：'+err.message);syncBusy=false;syncRender();return}
 for(const [source,path] of [['intervals',`/sync/intervals?oldest=${oldest}&newest=${newest}`],['garmin','/sync/garmin']]){
  if(!capabilities[source])continue;
  try{const raw=await callWorker(path);const items=Array.isArray(raw.activities)?raw.activities:[];for(const row of items){const a=normalizedRecord(row,source);if(!a||a.date<oldest||a.date>newest)continue;const id=String(row.id??row.activityId??row.activity_id??'');if(!id)continue;const key=`${source}:${id}`;if(syncCandidates.some(c=>c.key===key))continue;const existing=hasDuplicate(a);syncCandidates.push({key,source,id,item:a,needsRefresh:!!(existing&&((source==='intervals'&&(!existing.streamsChecked||!existing.routePoints?.length))||(source==='garmin'&&!existing.fitChecked)))})}}
  catch(err){lastSyncErrors.push((source==='garmin'?'Garmin':'Apple Watch')+'：'+err.message)}
 }
 syncBusy=false;syncRender();const status=document.querySelector('#sync-status');if(status&&!syncCandidates.length)status.textContent=lastSyncErrors.length?lastSyncErrors.join(' · '):'当前日期范围内没有找到运动记录。';
}

function samplePairs(xs,limit=380){if(!xs.length)return [];const skip=Math.max(1,Math.ceil(xs.length/limit));return xs.filter((x,i)=>i%skip===0||i===xs.length-1)}
function validNum(x){return x!==undefined&&x!==null&&x!==''&&Number.isFinite(Number(x))?Number(x):null}
function getMetric(o,...keys){for(const k of keys){const n=validNum(o?.[k]);if(n!==null)return n}return null}
function pointCoord(raw){const n=Number(raw);if(!Number.isFinite(n))return null;const deg=Math.abs(n)>180?n*180/2147483648:n;return Math.abs(deg)<=180?deg:null}
function asTimestamp(x){if(x instanceof Date)return x.getTime();if(typeof x==='string')return Date.parse(x);if(typeof x==='number')return x>1e12?x:x>1e9?x*1000:x*1000+631065600000;return NaN}
function mapFITMessages(messages){const records=messages.recordMesgs||messages.records||messages.record||[];const sessions=messages.sessionMesgs||messages.sessions||messages.session||[];const session=sessions.at?.(-1)||{};const rows=[],route=[];let startMs=NaN;
 for(const r of records){const stamp=asTimestamp(r.timestamp);if(!Number.isFinite(stamp))continue;if(!Number.isFinite(startMs))startMs=stamp;const t=(stamp-startMs)/1000;if(t<0)continue;const lat=pointCoord(r.positionLat),lon=pointCoord(r.positionLong);if(lat!==null&&lon!==null&&Math.abs(lat)<=90&&Math.abs(lon)<=180)route.push([lat,lon,t]);rows.push({t,hr:getMetric(r,'heartRate'),dist:getMetric(r,'distance'),alt:getMetric(r,'enhancedAltitude','altitude'),speed:getMetric(r,'enhancedSpeed','speed'),cadence:getMetric(r,'cadence'),power:getMetric(r,'power')})}
 return {rows,route,session,startMs};}
function decodeRawFit(bytes){
 const b=new Uint8Array(bytes),d=new DataView(bytes);if(b.length<16||String.fromCharCode(...b.slice(8,12))!=='.FIT')throw Error('FIT 文件头无效');const head=b[0],end=Math.min(head+d.getUint32(4,true),b.length-2);let i=head,lastTs=null;const definitions={},rows=[],route=[],sessions=[];let firstTs=null;const epoch=631065600000;
 function num(pos,size,type,le){if(pos+size>b.length)return null;const t=type&31;try{if(t===0||t===2||t===10)return b[pos];if(t===1)return d.getInt8(pos);if(t===3)return d.getInt16(pos,le);if(t===4||t===11)return d.getUint16(pos,le);if(t===5)return d.getInt32(pos,le);if(t===6||t===12)return d.getUint32(pos,le);if(t===8)return d.getFloat32(pos,le);if(t===9)return d.getFloat64(pos,le)}catch{}return null}
 while(i<end){const h=b[i++],compressed=!!(h&128),local=compressed?(h>>5)&3:h&15,definition=!compressed&&!!(h&64);
 if(definition){if(i+5>end)break;i++;const le=b[i++]===0;const global=d.getUint16(i,le);i+=2;const count=b[i++],fields=[];for(let f=0;f<count;f++){fields.push({id:b[i],size:b[i+1],type:b[i+2]});i+=3}let dev=0;if(h&32){const n=b[i++];for(let f=0;f<n;f++){dev+=b[i+1];i+=3}}definitions[local]={le,global,fields,dev};continue}
 const def=definitions[local];if(!def)throw Error('FIT 缺少字段定义');const item={};for(const f of def.fields){item[f.id]=num(i,f.size,f.type,def.le);i+=f.size}i+=def.dev;if(i>end)break;
 if(compressed){const offset=h&31;let timestamp=lastTs===null?null:(lastTs&~31)+offset;if(timestamp!==null&&timestamp<=lastTs)timestamp+=32;if(timestamp!==null)item[253]=timestamp}
 if(Number.isFinite(item[253]))lastTs=item[253];
 if(def.global===18){sessions.push(item);continue}if(def.global!==20)continue;
 let ts=getMetric(item,'253');if(ts===null)continue;if(firstTs===null)firstTs=ts;const t=ts-firstTs;if(t<0||t>864000)continue;
 const latitude=item[0],longitude=item[1];if(Number.isFinite(latitude)&&Number.isFinite(longitude)&&latitude!==2147483647&&longitude!==2147483647){const lat=latitude*180/2147483648,lon=longitude*180/2147483648;if(Math.abs(lat)<=90&&Math.abs(lon)<=180)route.push([lat,lon,t])}
 const scalar=(field,scale,offset=0)=>Number.isFinite(item[field])?item[field]/scale-offset:null;
 rows.push({t,hr:scalar(3,1),dist:scalar(5,100),alt:scalar(78,5,500)??scalar(2,5,500),speed:scalar(73,1000)??scalar(6,1000),cadence:scalar(4,1),power:scalar(7,1)});
 }
 const s=sessions.at(-1)||{};return {rows,route,startMs:firstTs===null?null:firstTs*1000+epoch,session:{totalAscent:s[22],totalCalories:s[11],avgHeartRate:s[16],avgPower:s[20],totalDistance:Number.isFinite(s[9])?s[9]/100:null,totalTimerTime:Number.isFinite(s[8])?s[8]/1000:null,avgSpeed:Number.isFinite(s[14])?s[14]/1000:null}};
}
async function getFITContents(zipBuffer){try{return await zipFitData(zipBuffer)}catch(primaryError){try{const fflate=await import('https://esm.sh/fflate@0.8.2?bundle');const unzipped=fflate.unzipSync(new Uint8Array(zipBuffer));for(const [filename,bytes] of Object.entries(unzipped))if(filename.toLowerCase().endsWith('.fit'))return bytes.slice().buffer;throw Error('ZIP 中不存在 FIT 文件')}catch(e){throw Error('无法解压 Garmin FIT：'+primaryError.message+'。浏览器需联网加载解压组件。')}}}
async function parseGarminFull(buffer){let decoded=null,usedSdk=false;try{const mod=await import('https://esm.sh/@garmin/fitsdk@21.218.0?bundle');const {Decoder,Stream}=mod;const s=Stream.fromArrayBuffer(buffer);const result=new Decoder(s).read();if((result.messages?.recordMesgs||[]).length){decoded=mapFITMessages(result.messages);usedSdk=true}}catch(e){console.info('Official FIT SDK not available; using local decoder',e.message)}
 if(!decoded||!decoded.rows.length){decoded=decodeRawFit(buffer)}
 const {rows,route,session,startMs}=decoded;
 const pairs=(name)=>samplePairs(rows.filter(r=>Number.isFinite(r[name])).map(r=>[r.t,r[name]]));
 const hrSeries=pairs('hr'),altitudeSeries=pairs('alt'),speedSeries=pairs('speed'),powerSeries=pairs('power'),cadenceSeries=pairs('cadence');
 const drows=rows.filter(r=>Number.isFinite(r.dist)).map(r=>[r.t,r.dist]);
 const timer=rows.length?rows.at(-1).t:null;
 let minutes=Number.isFinite(session.totalTimerTime)?session.totalTimerTime/60:Number.isFinite(timer)?timer/60:null;
 const sdist=getMetric(session,'totalDistance');const dis=sdist!==null?sdist:(drows.length?drows.at(-1)[1]:null);
 const km=dis!==null?+(dis/1000).toFixed(2):null;
 let gain=getMetric(session,'totalAscent');if(gain===null&&altitudeSeries.length>1){let elevation=0;for(let i=1;i<altitudeSeries.length;i++){const delta=altitudeSeries[i][1]-altitudeSeries[i-1][1];if(delta>2)elevation+=delta}gain=elevation>0?Math.round(elevation):null}
 const hr=getMetric(session,'avgHeartRate')??(hrSeries.length?Math.round(hrSeries.reduce((n,p)=>n+p[1],0)/hrSeries.length):null);
 const power=getMetric(session,'avgPower')??(powerSeries.length?Math.round(powerSeries.reduce((n,p)=>n+p[1],0)/powerSeries.length):null);
 const paceSeries=samplePairs(rows.filter(r=>Number.isFinite(r.speed)&&r.speed>.2).map(r=>[r.t,1000/r.speed]));
 return {start:Number.isFinite(startMs)?new Date(startMs).toISOString():null,routePoints:samplePairs(route,6500).map(p=>p.slice(0,2)),routeTimedPoints:samplePairs(route,6500),distanceTimeSeries:samplePairs(drows,5000),hrSeries,altitudeSeries,speedSeries,powerSeries,cadenceSeries,paceSeries,splits:calcKmSplits(drows.map(p=>p[0]),drows.map(p=>p[1])),gain,hr,power,cal:getMetric(session,'totalCalories'),distance:km,minutes,fitChecked:true,fitDecoder:usedSdk?'Garmin FIT SDK':'Local FIT parser'};
}
async function importGarminCandidate(item,id){const zip=await callWorker('/sync/garmin/fit?id='+encodeURIComponent(id),'buffer');const fit=await getFITContents(zip);const full=await parseGarminFull(fit);for(const [k,val] of Object.entries(full))if(val!==undefined&&val!==null&&(!Array.isArray(val)||val.length))item[k]=val;
 if(item.distance&&item.minutes){item.speed=+(item.distance/(item.minutes/60)).toFixed(1);if(item.type==='run')item.pace=fmtPace(item.minutes*60/item.distance)}item.route=!!item.routePoints?.length;return item}
async function importIntervalsCandidate(item,id){const detail=await callWorker('/sync/intervals/detail?id='+encodeURIComponent(id)).catch(e=>{console.info('Activity detail unavailable',e.message);return null});if(detail){const improved=normalizedRecord(detail,'intervals');if(improved){for(const k of ['gain','cal','hr','distance','pace','duration','speed'])if(improved[k]!==null&&improved[k]!==undefined)item[k]=improved[k]}}
 try{const raw=await callWorker('/sync/intervals/streams?id='+encodeURIComponent(id));const streams=parseIntervalStreams(raw);Object.assign(item,Object.fromEntries(Object.entries(streams).filter(([,v])=>Array.isArray(v)&&v.length)));if(streams.speedSeries?.length){item.paceSeries=samplePairs(streams.speedSeries.filter(p=>p[1]>.2).map(([t,v])=>[t,1000/v]))}item.streamsChecked=true}catch(e){console.info('Intervals streams unavailable',e.message)}
 try{const raw=await callWorker('/sync/intervals/gpx?id='+encodeURIComponent(id),'buffer');const track=parseGPX(new TextDecoder().decode(raw),'route.gpx');const points=track.routePoints;if(points?.length){item.routePoints=samplePairs(points,6500);if(track.routeTimedPoints?.length)item.routeTimedPoints=samplePairs(track.routeTimedPoints,6500);item.route=true}}catch(e){console.info('GPX not available',e.message)}item.detailChecked=true;return item}
async function importSelectedActivities(){if(syncBusy||!syncSelected.size)return;syncBusy=true;const targets=syncCandidates.filter(c=>syncSelected.has(c.key));let added=0,updated=0,skipped=0,errors=[];syncRender();for(let idx=0;idx<targets.length;idx++){
 const c=targets[idx],status=document.querySelector('#sync-status');if(status)status.textContent=`正在导入 ${idx+1}/${targets.length} · ${c.item.title}`;
 try{const item={...c.item};if(c.source==='garmin')await importGarminCandidate(item,c.id);else await importIntervalsCandidate(item,c.id);
  const exists=hasDuplicate(item);if(exists){for(const [k,v] of Object.entries(item))if(['routePoints','routeTimedPoints','distanceTimeSeries','hrSeries','altitudeSeries','speedSeries','paceSeries','cadenceSeries','powerSeries','splits','gain','cal','power','hr','distance','speed','pace','fitChecked','fitDecoder','streamsChecked','detailChecked'].includes(k)&&v!==null&&v!==undefined&&(!Array.isArray(v)||v.length)){if(k==='routePoints'||k==='routeTimedPoints'||k==='splits'||k.endsWith('Series')||exists[k]==null||exists[k]===0)exists[k]=v}await storeActivity(exists);updated++}
  else{if(item.type==='run'){item.shoeId=importShoeChoices[c.key]||null}const outcome=await addActivity(item);if(outcome==='added')added++;else skipped++}
 }catch(e){errors.push(`${c.item.date} ${c.item.title}: ${e.message}`);console.warn('Import failed:',c.key,e)}
 }
 syncBusy=false;syncSelected.clear();lastSyncErrors=errors;const oldErrors=[...errors];syncCandidates=syncCandidates.map(c=>({...c,needsRefresh:!hasDuplicate(c.item)?.routePoints?.length&&!!hasDuplicate(c.item)}));syncRender();const status=document.querySelector('#sync-status');if(status)status.innerHTML=`<strong>导入完成</strong> · 新增 ${added} · 更新 ${updated} · 跳过 ${skipped} · 失败 ${errors.length}${errors.length?'<p style="margin-top:8px">'+oldErrors.map(esc).join('<br>')+'</p>':''}`;
 toast(`导入完成 · 新增 ${added} 条`);
}
// Keep old syncNow symbol functional for bookmarks, but require a selection.
syncNow=function(){return fetchAvailableActivities()};

// Exercise/sport icon accents for the new warm palette.
sport.run.color="#d28d57";sport.run.back="#fff0df";sport.cycle.color="#769e9b";sport.cycle.back="#eef4f1";sport.strength.color="#b39c7e";sport.strength.back="#f7f0e7";sport.tennis.color="#a69aac";sport.tennis.back="#f4eff7";
// First real render occurs after IndexedDB hydration, once the overrides are installed.

// Strength record usability: show the most recent real set performance per exercise.
function priorExercisePerformance(id){const a=activities().find(x=>x.type==='strength'&&Array.isArray(x.log)&&x.log.some(v=>v.id===id&&v.sets?.length));if(!a)return '';const log=a.log.find(v=>v.id===id);return `上次 ${a.date}：${log.sets.slice(0,3).map(s=>`${s.weight} kg × ${s.reps}`).join(' · ')}${log.sets.length>3?' …':''}`}
const planItemBeforeV14=planItem;
planItem=function(p,i){let h=planItemBeforeV14(p,i),prev=priorExercisePerformance(p.id);return prev?h.replace(/<\/div>$/,`<div class="helper last-performance">${esc(prev)}</div></div>`):h};
const workoutScreenBeforeV14=workoutScreen;
workoutScreen=function(){let h=workoutScreenBeforeV14();state.workoutSets.forEach((x,i)=>{const e=getEx(x.id),prev=priorExercisePerformance(x.id);if(prev)h=h.replace(`<b>${i+1}. ${e.name}</b>`,`<div><b>${i+1}. ${e.name}</b><div class="helper last-performance">${esc(prev)}</div></div>`)});return h};

// Treat the selected running shoe as part of a backup even when the workout
// already exists locally, but never overwrite an existing assignment.
const backupRestoreUsesGear=true;

// A locally selected .fit file can also use the richer decoder, without cloud access.
const originalImportFileV14=importFile;
importFile=async function(file){if(!file.name.toLowerCase().endsWith('.fit'))return originalImportFileV14(file);
 const decoded=await parseGarminFull(await file.arrayBuffer());
 if(!Number.isFinite(decoded.minutes)||decoded.minutes<=0)throw Error('FIT 文件不包含有效运动时长');
 const start=decoded.start||new Date().toISOString(),fileLower=file.name.toLowerCase();
 const type=/cycl|ride|bike|骑行/.test(fileLower)?'cycle':'run';
 const a={id:'file-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),sourceKey:'fit:'+start+':'+decoded.distance,source:'FIT 文件',start,date:start.slice(0,10),type,title:file.name.replace(/\.fit$/i,''),minutes:decoded.minutes};
 for(const [k,v] of Object.entries(decoded))if(v!==null&&v!==undefined)a[k]=v;
 if(a.distance&&a.minutes){a.speed=+(a.distance/(a.minutes/60)).toFixed(1);a.pace=fmtPace(a.minutes*60/a.distance)}
 a.shoeId=type==='run'?defaultShoe()||null:null;
 return addActivity(a);
};
