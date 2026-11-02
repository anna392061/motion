'use strict';
/* MOTION. V1.4.1 — non-destructive, reversible linking of strength logs
 * with Apple Watch activity streams. Each source remains an independent
 * IndexedDB activity; only the display and statistics use a composite view.
 * No Worker changes, no background synchronization, no external uploads.
 */

const LINK_FIELDS = ['minutes','hr','cal','hrSeries','altitudeSeries','speedSeries','paceSeries','powerSeries','cadenceSeries','gain'];
const isStrengthLog = a => !!(a && a.type==='strength' && Array.isArray(a.log) && a.log.length);
const isWatchStrength = a => !!(a && a.type==='strength' && !isStrengthLog(a) && (a.sourceKey?.startsWith('intervals:') || /Intervals\.icu|Apple Health|Apple Watch/i.test(a.source||'')));
const rawById = id => state.manual.find(a=>a.id===id);
const safeMinutes = a => Number.isFinite(Number(a?.minutes)) && Number(a.minutes)>0 ? Number(a.minutes) : null;

// The manual record is the canonical session. The external workout is attached
// without copying health data into the manual raw record.
function makeCompositeStrength(manual,watch){
  const merged={...manual};
  for(const f of LINK_FIELDS){
    const value=watch[f];
    if(value!==undefined && value!==null && (!Array.isArray(value)||value.length))merged[f]=value;
  }
  merged.title=manual.title;
  merged.source='MOTION. 训练日志 + Apple Watch';
  merged.composite=true;
  merged.watchOriginalId=watch.id;
  merged.manualMinutes=manual.minutes;
  merged.minutes=safeMinutes(watch)??manual.minutes;
  merged.start=watch.start||manual.start;
  return merged;
}
function displayMergedActivities(rawList){
  const valid=new Set(rawList.map(a=>a.id));
  const usedWatch=new Set();
  const merged=rawList.filter(a=>{
    if(a.linkedManualId && valid.has(a.linkedManualId)){
      const parent=rawList.find(x=>x.id===a.linkedManualId);
      if(parent?.linkedWatchId===a.id){usedWatch.add(a.id);return false}
    }
    return true;
  }).map(a=>{
    if(isStrengthLog(a) && a.linkedWatchId){
      const watch=rawList.find(w=>w.id===a.linkedWatchId);
      if(watch && isWatchStrength(watch) && watch.linkedManualId===a.id)return makeCompositeStrength(a,watch);
    }
    return a;
  });
  // Orphan references never suppress raw records.
  return merged;
}

function sameDateLogCandidates(watch){
  return state.manual.filter(a=>isStrengthLog(a)&&a.date===watch.date&&
    (!a.linkedWatchId || a.linkedWatchId===watch.id))
    .sort((a,b)=>{
      const w=getStart(watch),ta=getStart(a),tb=getStart(b);
      const da=Number.isFinite(w)&&Number.isFinite(ta)?Math.abs(w-ta):0;
      const db=Number.isFinite(w)&&Number.isFinite(tb)?Math.abs(w-tb):0;
      return da-db;
    });
}
function sameDateWatchCandidates(manual){
  return state.manual.filter(w=>isWatchStrength(w)&&w.date===manual.date&&
    (!w.linkedManualId || w.linkedManualId===manual.id))
    .sort((a,b)=>Math.abs(getStart(a)-getStart(manual))-Math.abs(getStart(b)-getStart(manual)));
}

// One IndexedDB readwrite transaction ensures the two pointers are committed
// together. In-memory state changes only after the write has completed.
async function persistActivityPair(first,second){
  try{
    const db=await openDB();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('activities','readwrite');
      const store=tx.objectStore('activities');
      store.put(first);store.put(second);
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error||Error('关联保存失败'));
      tx.onabort=()=>reject(tx.error||Error('关联保存已取消'));
    });
  }catch(err){
    // Only use fallback for IndexedDB availability failures, not transaction errors.
    if(err?.name!=='SecurityError' && err?.name!=='NotSupportedError' &&
       !String(err?.message||'').includes('IndexedDB'))throw err;
    localStorage.setItem('motion_fallback_activities',JSON.stringify(
      state.manual.map(a=>a.id===first.id?first:a.id===second.id?second:a)));
  }
  for(const updated of [first,second]){
    const old=rawById(updated.id);
    if(!old)continue;
    // Object.assign cannot clear a removed link pointer.
    for(const key of ['linkedWatchId','linkedManualId']){if(!(key in updated))delete old[key]}
    Object.assign(old,updated);
  }
}
async function linkStrengthRecords(manualId,watchId){
  const manual=rawById(manualId),watch=rawById(watchId);
  if(!isStrengthLog(manual)||!isWatchStrength(watch))throw Error('仅支持将动作日志与 Apple Watch 力量记录关联');
  if(manual.date!==watch.date)throw Error('两条记录的日期不同，暂不允许关联');
  if(manual.linkedWatchId && manual.linkedWatchId!==watchId)throw Error('这份训练日志已关联另一条 Apple Watch 记录，请先解除关联');
  if(watch.linkedManualId && watch.linkedManualId!==manualId)throw Error('这条 Apple Watch 记录已关联另一份训练日志');
  await persistActivityPair({...manual,linkedWatchId:watchId},{...watch,linkedManualId:manualId});
  return true;
}
async function unlinkStrengthRecords(manualId){
  const manual=rawById(manualId);
  if(!manual?.linkedWatchId)return false;
  const watch=rawById(manual.linkedWatchId);
  if(watch){
    const newManual={...manual},newWatch={...watch};
    delete newManual.linkedWatchId;delete newWatch.linkedManualId;
    await persistActivityPair(newManual,newWatch);
  }else{
    delete manual.linkedWatchId;
    await storeActivity(manual);
  }
  return true;
}
async function chooseLinkFromActivity(){
  const record=rawById(state.activityID);
  if(!record)return;
  const select=document.getElementById('strength-link-choice');
  const otherId=select?.value;
  if(!otherId){toast('请先选择另一条训练记录');return}
  const manual=isStrengthLog(record)?record:rawById(otherId);
  const watch=isWatchStrength(record)?record:rawById(otherId);
  try{
    await linkStrengthRecords(manual.id,watch.id);
    state.activityID=manual.id;
    showOverlay();
    toast('两条记录已关联，日历和周统计现在只算一次');
  }catch(e){alert('关联失败：'+e.message)}
}
async function removeStrengthLink(){
  const a=rawById(state.activityID);
  const manual=isStrengthLog(a)?a:rawById(a?.linkedManualId);
  if(!manual || !confirm('解除关联后，两条原始力量训练将恢复单独显示，原始数据不会删除。确定吗？'))return;
  try{await unlinkStrengthRecords(manual.id);state.activityID=manual.id;showOverlay();toast('已解除关联，两条记录独立保留')}
  catch(err){alert('解除关联失败：'+err.message)}
}
function strengthLinkPanel(raw){
  if(raw.type!=='strength')return '';
  const manual=isStrengthLog(raw)?raw:null;
  const watch=isWatchStrength(raw)?raw:null;
  if(!manual&&!watch)return '';
  const watchRef=manual?.linkedWatchId?rawById(manual.linkedWatchId):watch;
  const manualRef=watch?.linkedManualId?rawById(watch.linkedManualId):manual;
  const linked=!!(manualRef?.linkedWatchId && watchRef?.linkedManualId && manualRef.linkedWatchId===watchRef.id && watchRef.linkedManualId===manualRef.id);
  if(linked){
    return `<section class="card p18 section strength-link-card"><div class="micro">LINKED WORKOUT · 已关联</div><h2 class="section-title">两份记录，一次训练</h2>
    <p class="helper">Apple Watch 的生理数据与 MOTION. 的动作日志共同构成这条运动；周统计只计算一次。两份原始记录分别保留。</p>
    <div class="link-source-grid"><div><strong>⌚ Apple Watch</strong><small>${durationString(watchRef.minutes)} · ${watchRef.hr!=null?watchRef.hr+' bpm':'心率未提供'} · ${watchRef.cal!=null?watchRef.cal+' kcal':'热量未提供'}</small></div>
    <div><strong>✎ MOTION. Training Log</strong><small>${manualRef.log?.length||0} 个动作 · ${manualRef.sets||0} 组 · 手动计时 ${durationString(manualRef.minutes)}</small></div></div>
    <button class="soft-btn" onclick="removeStrengthLink()" style="margin-top:14px">解除关联</button></section>`;
  }
  const choices=manual?sameDateWatchCandidates(manual):sameDateLogCandidates(watch);
  return `<section class="card p18 section strength-link-card"><div class="micro">LINK ACTIVITY</div><h2 class="section-title">关联同一次力量训练</h2>
  <p class="helper">使用 Apple Watch 的时长、心率和热量，保留 MOTION. 的动作与组数。仅根据同一天推荐，需你亲自确认是否属于同一场训练。</p>
  ${choices.length?`<label class="form-label">选择另一条记录<select id="strength-link-choice" class="search" style="margin-top:8px">${choices.map(a=>`<option value="${esc(a.id)}">${esc(a.title)} · ${durationString(a.minutes)}${a.hr!=null?' · '+a.hr+' bpm':''}</option>`).join('')}</select></label>
  <button class="primary small" onclick="chooseLinkFromActivity()">Link Activity · 确认关联</button>`:
  `<div class="helper">同一天还没有可关联的${manual?' Apple Watch 力量记录':'手动动作日志'}。先保留这条记录，之后导入或完成另一份记录即可关联。</div>`}
  </section>`;
}

const activityOverlayV14Base = activityOverlay;
activityOverlay = function(){
  const html=activityOverlayV14Base();
  const raw=rawById(state.activityID);
  if(!raw||raw.type!=='strength')return html;
  return html.replace('<div class="card p18 section"><div class="eyebrow">管理这条记录</div>',
    strengthLinkPanel(raw)+'<div class="card p18 section"><div class="eyebrow">管理这条记录</div>');
};

// Override destructive operations so broken links cannot be left behind.
const updateActivitySportBefore141=updateActivitySport;
updateActivitySport=async function(){
  const raw=rawById(state.activityID),field=document.getElementById('activity-type');
  if(raw?.type==='strength' && field?.value!=='strength' && (raw.linkedWatchId||raw.linkedManualId)){
    if(!confirm('修改运动类型需要先解除力量训练关联。继续吗？'))return;
    const manual=isStrengthLog(raw)?raw:rawById(raw.linkedManualId);
    if(manual)await unlinkStrengthRecords(manual.id);
  }
  return updateActivitySportBefore141();
};
deleteSelectedActivity=async function(){
  const raw=rawById(state.activityID);if(!raw)return;
  if(!confirm('删除「'+raw.title+'」这条原始运动？'+((raw.linkedWatchId||raw.linkedManualId)?'关联将自动解除，另一条原始记录仍保留。':'')))return;
  const manual=isStrengthLog(raw)?raw:rawById(raw.linkedManualId);
  if(manual?.linkedWatchId)await unlinkStrengthRecords(manual.id);
  state.manual=state.manual.filter(a=>a.id!==raw.id);
  await removeSavedActivity(raw.id);closeOverlay();toast('已删除记录，另一条记录未受影响');
};

// At import selection, matching manual workouts are *suggestions only*.
// The default is independent import, never automatic linking by date alone.
let syncStrengthLinks = {};
const syncRowBefore141=syncRow;
syncRow=function(c){
  let html=syncRowBefore141(c);
  if(c.source!=='intervals'||c.item.type!=='strength')return html;
  const existing=hasDuplicate(c.item);
  const matching=sameDateLogCandidates(c.item);
  const checked=syncSelected.has(c.key);
  // A previously imported watch record can be linked without redownloading.
  if(existing&&!c.needsRefresh&&matching.length&&!existing.linkedManualId){
    html=html.replace(/disabled/g,'').replace('already-imported','');
  }
  if(!matching.length||existing?.linkedManualId||!checked)return html;
  const choice=syncStrengthLinks[c.key]||'separate';
  const options=`<option value="separate" ${choice==='separate'?'selected':''}>作为独立运动导入</option>`+
    matching.map(a=>`<option value="${esc(a.id)}" ${choice===a.id?'selected':''}>关联：${esc(a.title)} · ${a.sets||0} 组</option>`).join('');
  const selector=`<div class="sync-strength-match"><strong>可能是同一次训练</strong><p>仅凭日期无法确定，请选择；不合并时保持为独立记录。</p><select class="search" onchange="syncStrengthLinks['${esc(c.key)}']=this.value" onclick="event.stopPropagation()">${options}</select></div>`;
  return html.replace(/<\/div>$/,selector+'</div>');
};
const fetchAvailableActivitiesBefore141=fetchAvailableActivities;
fetchAvailableActivities=async function(){syncStrengthLinks={};return fetchAvailableActivitiesBefore141()};
const originalOpenSync141=openSync;
openSync=function(){syncStrengthLinks={};return originalOpenSync141()};

// Preserve V1.4's behavior for all non-strength imports, including shoes.
// A successful link does NOT delete either raw record.
importSelectedActivities=async function(){
  if(syncBusy||!syncSelected.size)return;
  syncBusy=true;
  const selected=syncCandidates.filter(c=>syncSelected.has(c.key));
  let added=0,updated=0,skipped=0,linked=0;
  const errors=[];syncRender();
  for(let i=0;i<selected.length;i++){
    const c=selected[i];
    const status=document.getElementById('sync-status');
    if(status)status.textContent=`正在导入 ${i+1}/${selected.length} · ${c.item.title}`;
    try{
      const target=syncStrengthLinks[c.key]||'separate';
      const existing=hasDuplicate(c.item);
      const isLinkChoice=c.source==='intervals'&&c.item.type==='strength'&&target!=='separate';
      if(isLinkChoice){
        const candidateManual=rawById(target);
        if(!isStrengthLog(candidateManual)||candidateManual.date!==c.item.date)throw Error('关联目标不存在或日期不一致，请重新选择');
      }
      let record=existing;
      if(!existing||c.needsRefresh){
        const full={...c.item};
        if(c.source==='garmin')await importGarminCandidate(full,c.id);
        else await importIntervalsCandidate(full,c.id);
        if(existing){
          for(const [k,v] of Object.entries(full)){
            if(['routePoints','hrSeries','altitudeSeries','speedSeries','paceSeries','cadenceSeries','powerSeries','splits','gain','cal','power','hr','distance','speed','pace','minutes','fitChecked','fitDecoder','streamsChecked','detailChecked'].includes(k) && v!==undefined && v!==null && (!Array.isArray(v)||v.length)){
              if(k==='routePoints'||k==='splits'||k.endsWith('Series')||existing[k]==null||existing[k]===0)existing[k]=v;
            }
          }
          await storeActivity(existing);updated++;
        }else{
          if(full.type==='run')full.shoeId=importShoeChoices[c.key]||null;
          const result=await addActivity(full);
          if(result==='added'){added++;record=full}else{skipped++;record=hasDuplicate(full)}
        }
      }else{skipped++}
      if(isLinkChoice){
        if(!record)throw Error('没有可关联的 Apple Watch 记录');
        await linkStrengthRecords(target,record.id);linked++;
      }
    }catch(e){errors.push(`${c.item.date} ${c.item.title}: ${e.message}`);console.warn('Import failed',c.key,e)}
  }
  syncBusy=false;syncSelected.clear();syncStrengthLinks={};lastSyncErrors=errors;
  syncCandidates=syncCandidates.map(c=>({...c,needsRefresh:!hasDuplicate(c.item)?.routePoints?.length&&!!hasDuplicate(c.item)}));
  syncRender();
  const status=document.getElementById('sync-status');
  if(status)status.innerHTML=`<strong>导入完成</strong> · 新增 ${added} · 更新 ${updated} · 关联 ${linked} · 跳过 ${skipped} · 失败 ${errors.length}${errors.length?'<p style="margin-top:8px">'+errors.map(esc).join('<br>')+'</p>':''}`;
  render();toast(`同步完成 · 关联 ${linked} 条力量训练`);
};

// Backup compatible with V1.0–V1.4: existing format and source IDs retained.
// Restore reconciles link metadata on equal IDs rather than silently dropping
// the relationships when restoring into an already populated installation.
exportData=function(){
  downloadJSON({format:'motion-backup-v1',appVersion:'1.4.1',exportedAt:new Date().toISOString(),activities:state.manual,gear:gearList,plan:state.plan,favorites:state.favorites,wishlist:state.wishlist,notes:state.notes},
    'MOTION-backup-'+dateKey(new Date())+'.json');
  toast('完整备份已下载（包含力量训练关联）');
};
importBackup=async function(){
  const input=document.createElement('input');input.type='file';input.accept='.json,application/json';
  input.onchange=async()=>{
    const file=input.files?.[0];if(!file)return;
    try{
      const data=JSON.parse(await file.text());
      if(data.format!=='motion-backup-v1'||!Array.isArray(data.activities))throw Error('不是兼容的 MOTION 备份');
      const activityMap=new Map(state.manual.map(a=>[a.id,a]));
      let added=0,updated=0;
      for(const incoming of data.activities){
        if(!incoming||!incoming.id||!incoming.date||!incoming.type)continue;
        const existing=activityMap.get(incoming.id);
        if(existing){
          const patch={...existing};
          for(const [field,value] of Object.entries(incoming)){
            if(['linkedManualId','linkedWatchId'].includes(field)){
              if(!patch[field]&&value)patch[field]=value;
            }else if(patch[field]===undefined||patch[field]===null||Array.isArray(patch[field])&&!patch[field].length){patch[field]=value}
          }
          Object.assign(existing,patch);await storeActivity(existing);updated++;
        }else{
          // Restore the exact original IDs rather than using date-based fuzzy
          // deduplication, which could merge two distinct sessions.
          state.manual.push(incoming);activityMap.set(incoming.id,incoming);
          await storeActivity(incoming);added++;
        }
      }
      if(Array.isArray(data.gear)){
        for(const g of data.gear)if(g?.id&&!gearList.some(x=>x.id===g.id))gearList.push(g);
        gearSave();
      }
      if(confirm(`已恢复 ${added} 条新运动，补充 ${updated} 条已有记录。是否也恢复训练计划、收藏和个人笔记？`)){
        if(Array.isArray(data.plan))state.plan=data.plan;
        if(Array.isArray(data.favorites))state.favorites=data.favorites;
        if(Array.isArray(data.wishlist))state.wishlist=data.wishlist;
        if(data.notes&&typeof data.notes==='object')state.notes={...state.notes,...data.notes};
        persist();
      }
      render();toast('备份恢复完成，力量训练关联已保留');
    }catch(e){alert('恢复失败：'+e.message)}
  };
  input.click();
};

const settingsOverlayBefore141=settingsOverlay;
settingsOverlay=function(){
  return settingsOverlayBefore141().replace('V1.4','V1.4.1')+`<div class="card p18 section"><div class="micro">STRENGTH LINKING · V1.4.1</div><p class="helper">已有的 Apple Watch 力量训练与手动动作日志可在运动详情中关联。关联后只统计一次；原始数据仍保留，JSON 备份包含关联关系。</p></div>`;
};
