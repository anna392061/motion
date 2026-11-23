/* MOTION. Strength Core 1.4.8 — real local data, editable templates, activity-linked history.
   This replaces ONLY Strength's screen. It does not change sync, calendars, activities or gear. */
(function(){
'use strict';
const STORAGE='motion_strength_templates_v1';
const ACTIVE='motion_strength_active_v1';
const CUSTOM_STORAGE='motion_strength_custom_exercises_v1';
const MAX_CUSTOM=100;
const X=val=>String(val??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=x=>JSON.parse(JSON.stringify(x));
const num=(n,min=0,max=999)=>Math.min(max,Math.max(min,Number(n)||0));
const gen=()=>('t'+Date.now().toString(36)+Math.random().toString(36).slice(2,7));
const parseJSON=(key,def)=>{try{return JSON.parse(localStorage.getItem(key))??def}catch{return def}};
const createSet=(w=0,r=10)=>({weight:String(w),reps:String(r),done:false});
const safeId=id=>String(id||'').replace(/[^a-z0-9_-]/gi,'');
const itemsFromPlan=()=>Array.isArray(state.plan)?state.plan.filter(p=>getEx(p.id)).map(p=>({id:p.id,sets:Array.from({length:Math.max(1,Math.min(15,Number(p.sets)||3))},()=>createSet(p.weight??0,p.reps??10))})):[];
const extra=[
{id:'row_close',parentId:'row',variant:'close',name:'窄握坐姿划船',en:'Close-Grip Seated Cable Row',pattern:'Pull · 水平 · 窄握',primary:['lats','traps'],secondary:['biceps','rearDelts'],stabilizer:['erectors'],desc:'使用较窄握柄完成坐姿绳索划船，独立记录重量和训练进展。',setup:['坐稳并保持躯干稳定，使用舒适的窄握柄。'],execution:['手肘沿身体两侧向后移动，肩胛骨自然活动。'],mistakes:['为了拉得更远而大幅后仰，或用肩部耸起代偿。'],cue:'将肘部向身后带，不要用腰部甩动。'},
{id:'row_wide',parentId:'row',variant:'wide',name:'宽握坐姿划船',en:'Wide-Grip Seated Cable Row',pattern:'Pull · 水平 · 宽握',primary:['traps','lats'],secondary:['rearDelts','biceps'],stabilizer:['erectors'],desc:'使用较宽握柄完成坐姿绳索划船。肘部路径可随握柄调整，与窄握版本分别追踪。',setup:['使用舒适的宽握柄，坐稳，胸廓和骨盆保持自然对齐。'],execution:['肘部自然向两侧后方移动，控制肩胛骨活动与还原。'],mistakes:['强行把肘抬得过高，或通过躯干摆动借力。'],cue:'手只是连接握柄，想象上背部带动手肘后移。'},
{id:'smithsquat',name:'史密斯深蹲',en:'Smith Machine Squat',pattern:'Squat · 史密斯',primary:['quads','gluteMax'],secondary:['hamstrings'],stabilizer:['abs'],desc:'固定杠铃轨迹的深蹲变式。'},
{id:'gobletsquat',name:'高脚杯深蹲',en:'Goblet Squat',pattern:'Squat · 前置负重',primary:['quads','gluteMax'],secondary:['abs'],stabilizer:[],desc:'持哑铃或壶铃于胸前的深蹲。'},
{id:'hacksquat',name:'哈克深蹲',en:'Hack Squat',pattern:'Squat · 器械',primary:['quads','gluteMax'],secondary:[],stabilizer:[],desc:'器械支撑下完成的深蹲。'},
{id:'frontsquat',name:'杠铃前蹲',en:'Front Squat',pattern:'Squat · 前架',primary:['quads','gluteMax'],secondary:['abs'],stabilizer:[],desc:'杠铃前架深蹲。'},
{id:'backsquat',name:'杠铃背蹲',en:'Back Squat',pattern:'Squat · 自由重量',primary:['quads','gluteMax'],secondary:['abs'],stabilizer:[],desc:'杠铃背部负重深蹲。'},
{id:'stepdown',name:'台阶下放',en:'Step-down',pattern:'Single-leg · 控制',primary:['quads'],secondary:['gluteMed','gluteMax'],stabilizer:[],desc:'台阶上的单侧离心下放练习。'},
{id:'stepup',name:'上台阶',en:'Step-up',pattern:'Single-leg · 上台阶',primary:['gluteMax','quads'],secondary:['gluteMed'],stabilizer:[],desc:'单侧登阶的力量训练。'},
{id:'facepull',name:'面拉',en:'Face Pull',pattern:'Pull · 肩后侧',primary:['traps','rearDelts'],secondary:[],stabilizer:[],desc:'绳索后拉动作。'},
{id:'deadbug',name:'死虫式',en:'Dead Bug',pattern:'Core · 抗伸展',primary:['abs'],secondary:[],stabilizer:[],desc:'仰卧对侧手脚配合的躯干控制。'},
{id:'pallof',name:'Pallof Press',en:'Pallof Press',pattern:'Core · 抗旋转',primary:['abs'],secondary:[],stabilizer:[],desc:'站姿抗旋转练习。'}
];
extra.forEach(e=>{if(!exerciseList.some(a=>a.id===e.id))exerciseList.push({...e,setup:e.setup||[],execution:e.execution||[],mistakes:e.mistakes||[],cue:e.cue||''})});
// User-created exercises have stable IDs so templates, history and personal notes stay linked.
// Validate imported records as well as new records; never allow an import to overwrite built-ins.
function normalizeCustom(raw){
 if(!raw||typeof raw!=='object')return null;
 const id=safeId(raw.id);
 const name=String(raw.name||'').trim().slice(0,60);
 if(!/^custom_[a-z0-9_-]{5,50}$/i.test(id)||!name)return null;
 const primary=Array.isArray(raw.primary)?raw.primary.filter(m=>Object.prototype.hasOwnProperty.call(muscles,m)).slice(0,1):[];
 const main=primary[0]||'lats';
 return {id,custom:true,name,en:String(raw.en||'').trim().slice(0,80),pattern:'Custom · '+(muscles[main]?.name||'训练'),primary:[main],secondary:[],stabilizer:[],desc:String(raw.desc||'').trim().slice(0,240),setup:[],execution:[],mistakes:[],cue:''};
}
function restoreCustomExercises(raw){
 if(!Array.isArray(raw))return;
 for(const entry of raw.slice(0,MAX_CUSTOM)){
  const ex=normalizeCustom(entry);if(!ex)continue;
  const old=getEx(ex.id);
  if(old){if(old.custom)Object.assign(old,ex);}
  else if(exerciseList.filter(e=>e.custom).length<MAX_CUSTOM)exerciseList.push(ex);
 }
 saveCustomExercises();
 refresh();
}
function saveCustomExercises(){
 try{localStorage.setItem(CUSTOM_STORAGE,JSON.stringify(exerciseList.filter(e=>e.custom)))}catch{toast('自定义动作未能保存，请检查设备存储空间')}
}
function getCustomExercises(){return clone(exerciseList.filter(e=>e.custom))}
const savedCustom=parseJSON(CUSTOM_STORAGE,[]);
if(Array.isArray(savedCustom))for(const entry of savedCustom.slice(0,MAX_CUSTOM)){
 const ex=normalizeCustom(entry);
 if(ex&&!getEx(ex.id))exerciseList.push(ex);
}

function sanitizeTemplates(raw){return raw.filter(t=>t&&Array.isArray(t.items)).slice(0,40).map(t=>({id:safeId(t.id)||gen(),name:String(t.name||'我的训练').slice(0,80),desc:String(t.desc||'').slice(0,160),items:t.items.filter(i=>i&&getEx(i.id)).slice(0,35).map(i=>({id:i.id,sets:(Array.isArray(i.sets)&&i.sets.length?i.sets:[createSet()]).slice(0,25).map(s=>({weight:String(num(s.weight,0,999)),reps:String(num(s.reps,0,200)),done:false}))}))}));}
let templates=sanitizeTemplates(parseJSON(STORAGE,[]));
if(!templates.length){templates=[{id:'legacy-lower-a',name:'Lower Body A',desc:'从原有 My Plan 安全迁移',items:itemsFromPlan()}];saveTemplates();}
let active=parseJSON(ACTIVE,null);
if(active && (!Array.isArray(active.items)||!active.startAt))active=null;
let draft=null,editId=null,editNew=false,editingCustomId=null;
let mode='home',search='',filter='全部',pickContext=null,detailId=null,returnMode='library',busy=false;
function saveTemplates(){try{localStorage.setItem(STORAGE,JSON.stringify(templates))}catch{toast('模板保存失败，请检查设备存储空间')}}
function keepActive(){try{if(active)localStorage.setItem(ACTIVE,JSON.stringify(active));else localStorage.removeItem(ACTIVE)}catch{toast('临时训练未能保存在设备上')}}
function syncLegacyPlan(){const t=templates[0];if(!t)return;state.plan=t.items.map((i,n)=>({key:'sc'+n,id:i.id,sets:i.sets.length,reps:Number(i.sets[0]?.reps)||10,weight:Number(i.sets[0]?.weight)||0}));persist()}
const asName=id=>getEx(id)?.name||id;
const top=(label,title,sub='')=>`<div class="sc-kicker">${X(label)}</div><h1 class="sc-title">${X(title)}</h1>${sub?`<p class="sc-sub">${X(sub)}</p>`:''}`;
const btn=(text,action,extra='')=>`<button type="button" class="sc-btn ${extra}" onclick="${action}">${text}</button>`;
function last(id){return activities().filter(a=>a.type==='strength'&&Array.isArray(a.log)).sort((a,b)=>String(b.start||b.date).localeCompare(String(a.start||a.date))).flatMap(a=>a.log.filter(l=>l.id===id).map(l=>({date:a.date,sets:l.sets}))).find(x=>x.sets?.length)||null}
const lastStr=id=>{const l=last(id);if(!l)return '尚无历史组数';const s=l.sets[0];return `${X(s.weight)} kg × ${X(s.reps)} · ${X(l.date.slice(5))}`};
function primaryNav(){return `<nav class="sc-topnav" aria-label="力量训练分类">
 ${[['home','My Training'],['library','Exercises'],['history','History']].map(([m,label])=>`<button type="button" class="${mode===m?'chosen':''}" ${mode===m?'aria-current="page"':''} onclick="MOTIONStrength.go('${m}')">${label}</button>`).join('')}
 </nav>`}
function screen(){
 const onPrimary=['home','library','history'].includes(mode);
 let s=onPrimary?`<div class="sc-pagehead"><h1 class="sc-title">Strength</h1></div>${primaryNav()}`:'';
 if(active && mode!=='workout')s+=`<div class="sc-resume">有一场尚未完成的训练 ${btn('继续训练 →','MOTIONStrength.resume()','solid')}</div>`;
 if(mode==='home')s+=home();
 if(mode==='edit')s+=edit();
 if(mode==='workout')s+=workout();
 if(mode==='library')s+=library();
 if(mode==='create')s+=customForm();
 if(mode==='detail')s+=detail();
 if(mode==='history')s+=history();
 return `<div class="strength-core">${s}</div>`;
}
function home(){return `<div class="sc-headrow"><h2>My Training <small>· 我的模板</small></h2>${btn('＋ 新建模板','MOTIONStrength.newTemplate()','quiet')}</div>
 ${templates.map(t=>`<section class="sc-template"><div class="sc-kicker">TRAINING TEMPLATE</div><div class="sc-template-title">${X(t.name)}</div><p>${X(t.desc||`${t.items.length} 个动作`)}</p><div class="sc-actions">${btn('编辑模板','MOTIONStrength.editTemplate(\''+t.id+'\')','outline')}${btn('开始训练 →','MOTIONStrength.start(\''+t.id+'\')','solid')}</div></section>`).join('')||'<div class="sc-empty">还没有训练模板。</div>'}
 <div class="sc-shortcuts">${btn('⌕ 查找动作','MOTIONStrength.go(\'library\')','outline')}${btn('↗ 查看训练历史','MOTIONStrength.go(\'history\')','outline')}</div>`}
function edit(){if(!draft)return home();return `<button class="sc-back" onclick="MOTIONStrength.cancelEdit()">← 返回模板</button>${top('EDIT TEMPLATE',editNew?'新建训练模板':'编辑训练模板','编辑不会产生新的运动记录。')}
 <label class="sc-label">模板名称<input class="sc-input" value="${X(draft.name)}" maxlength="80" oninput="MOTIONStrength.editName(this.value)"></label>
 <label class="sc-label">模板说明<input class="sc-input" value="${X(draft.desc)}" maxlength="160" oninput="MOTIONStrength.editDescription(this.value)"></label>
 <div class="sc-headrow"><h2>动作编排 <small>${draft.items.length} 个动作</small></h2>${btn('＋ 添加动作','MOTIONStrength.pick(\'edit\')','quiet')}</div>
 ${draft.items.map((it,i)=>`<section class="sc-exercise"><div class="sc-exhead"><div><b>${i+1}. ${X(asName(it.id))}</b><small>${X(getEx(it.id)?.en||'')}</small></div><div class="sc-mini">${btn('↑',`MOTIONStrength.move(${i},-1)`,'quiet')}${btn('↓',`MOTIONStrength.move(${i},1)`,'quiet')}</div></div>
 <div class="sc-mini sc-line">${btn('替换',`MOTIONStrength.pick('edit',${i})`,'quiet')}${btn('移除',`MOTIONStrength.removeItem(${i})`,'quiet')}</div>
 ${it.sets.map((set,j)=>setRow(set,i,j,'edit')).join('')}
 ${btn('＋ 添加一组',`MOTIONStrength.addSet(${i})`,'quiet')}
 </section>`).join('')||'<p class="sc-empty">模板尚无动作。点击上方添加动作。</p>'}
 <div class="sc-actions">${btn('取消','MOTIONStrength.cancelEdit()','outline')}${btn('保存模板','MOTIONStrength.saveEdit()','solid')}</div>
 ${!editNew?`<div class="sc-delete">${btn('删除这个模板','MOTIONStrength.deleteTemplate()','quiet')}</div>`:''}`}
function setRow(set,i,j,type){return `<div class="sc-setrow"><span>${j+1}</span><label>KG<input aria-label="第 ${j+1} 组重量" inputmode="decimal" type="text" autocomplete="off" spellcheck="false" value="${X(set.weight)}" onfocus="MOTIONStrength.selectNumber(this)" onclick="MOTIONStrength.selectNumber(this)" onchange="this.value=MOTIONStrength.setField('${type}',${i},${j},'weight',this.value)"></label><label>REPS<input aria-label="第 ${j+1} 组次数" inputmode="numeric" type="text" autocomplete="off" spellcheck="false" value="${X(set.reps)}" onfocus="MOTIONStrength.selectNumber(this)" onclick="MOTIONStrength.selectNumber(this)" onchange="this.value=MOTIONStrength.setField('${type}',${i},${j},'reps',this.value)"></label>${type==='workout'?`<button class="sc-check ${set.done?'done':''}" aria-label="完成第 ${j+1} 组" onclick="MOTIONStrength.mark(${i},${j})">${set.done?'✓':'○'}</button>`:`<button class="sc-check" aria-label="删除第 ${j+1} 组" onclick="MOTIONStrength.delSet(${i},${j})">×</button>`}</div>`}
function actionStatus(it){
 const completed=it.sets.reduce((n,s)=>n+(s.done?1:0),0);
 return {completed,total:it.sets.length,status:completed===0?'none':completed===it.sets.length?'all':'partial'};
}
function workout(){if(!active){mode='home';return home()}return `<button class="sc-back" onclick="MOTIONStrength.go('home')">← 返回模板（训练会保留）</button>${top('● WORKOUT IN PROGRESS',active.name,'点选动作旁的按钮可一次完成所有组；未勾选的组不会保存。')}
 <div class="sc-timer">开始时间 ${X(new Date(active.startAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}))} · 计时中</div>
 ${active.items.map((it,i)=>{const {completed,total,status}=actionStatus(it);return `<section class="sc-exercise"><div class="sc-exhead sc-workout-exhead"><div class="sc-exhead-title"><b>${i+1}. ${X(asName(it.id))}</b><small>${X(lastStr(it.id))}</small></div><div class="sc-exhead-actions"><button type="button" class="sc-action-check ${status}" role="checkbox" aria-checked="${status==='partial'?'mixed':status==='all'}" aria-label="${X(asName(it.id))}：${completed}/${total}组完成，${status==='all'?'点击取消全部完成':'点击标记全部完成'}" onclick="MOTIONStrength.toggleExercise(${i})"><span class="sc-action-check-symbol" aria-hidden="true">${status==='all'?'✓':status==='partial'?'−':'○'}</span><span>${status==='all'?'已完成':status==='partial'?'部分完成':'全选'}</span></button>${btn('查看历史 →',`MOTIONStrength.openDetail('${it.id}','workout')`,'quiet')}</div></div>${it.sets.map((s,j)=>setRow(s,i,j,'workout')).join('')}<div class="sc-mini sc-line">${btn('＋ 一组',`MOTIONStrength.addSet(${i})`,'quiet')}${btn('替换',`MOTIONStrength.pick('workout',${i})`,'quiet')}${btn('移除',`MOTIONStrength.removeItem(${i})`,'quiet')}${btn('↑',`MOTIONStrength.move(${i},-1)`,'quiet')}${btn('↓',`MOTIONStrength.move(${i},1)`,'quiet')}</div></section>`}).join('')}
 ${btn('＋ 添加动作',"MOTIONStrength.pick('workout')",'outline sc-full')}
 <div class="sc-actions">${btn('放弃训练','MOTIONStrength.discard()','outline')}${btn('完成并保存','MOTIONStrength.finish()','solid')}</div>`}
function category(e){const m=[...(e.primary||[]),...(e.secondary||[])];if(m.some(id=>['gluteMax','gluteMed','hamstrings','quads','calves'].includes(id)))return '臀腿';if(m.some(id=>['lats','traps','rearDelts','erectors'].includes(id)))return '背肩';if(m.some(id=>['pecs','triceps','biceps','delts'].includes(id)))return '胸臂';return '核心'}
function filtered(){return exerciseList.filter(e=>(filter==='全部'||category(e)===filter)&&`${e.name} ${e.en} ${e.pattern}`.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>Number(state.favorites.includes(b.id))-Number(state.favorites.includes(a.id))||a.name.localeCompare(b.name,'zh-CN'))}
function exrows(){return filtered().map(e=>`<div class="sc-listrow"><button class="sc-flex" onclick="MOTIONStrength.openDetail('${e.id}','library')"><b>${X(e.name)}</b><small>${X(e.en)} · ${X(e.pattern)}</small></button>${pickContext?btn(pickContext.index!=null?'替换':'添加',`MOTIONStrength.choose('${e.id}')`,'solid small'):btn('查看 →',`MOTIONStrength.openDetail('${e.id}','library')`,'quiet')}</div>`).join('')||'<p class="sc-empty">没有符合条件的动作。</p>'}
function library(){return `${pickContext?'<button class="sc-back" onclick="MOTIONStrength.backFromLibrary()">← 返回上一页</button>':''}<div class="sc-headrow"><h2>${pickContext?'选择动作':'动作库'}</h2>${btn('＋ 自定义动作','MOTIONStrength.newCustom()','quiet')}</div>
 <input id="sc-search" class="sc-input" placeholder="搜索动作名称、中英文或模式" value="${X(search)}" oninput="MOTIONStrength.search(this.value)">
 <div class="sc-filters">${['全部','臀腿','背肩','胸臂','核心'].map(c=>`<button class="${filter===c?'sel':''}" onclick="MOTIONStrength.filter('${c}')">${c}</button>`).join('')}</div>
 <div id="sc-exlist">${exrows()}</div>`}
const roleOverrides={
  slrdl:{stabilizer:['gluteMed','erectors'],secondary:[]},
  split:{stabilizer:['gluteMed','abs'],secondary:['hamstrings']},
  stepdown:{stabilizer:['gluteMed'],secondary:['gluteMax']}
};
function muscleNames(ids=[]){return [...new Set(ids)].map(id=>muscles[id]?.name||id).map(n=>`<span>${X(n)}</span>`).join('')||'<span>—</span>'}
function movementName(e){
 const p=String(e.pattern||'');
 if(e.id==='split')return '分腿蹲 · 单侧 · 髋/膝主导';
 if(e.id==='slrdl')return '髋铰链 · 单侧 · 多平面控制';
 if(/Hip Abduction/i.test(p))return '髋外展';
 if(/Hinge/i.test(p))return '髋铰链'+(/单侧/.test(p)?' · 单侧':'');
 if(/Squat/i.test(p))return '深蹲 / 膝主导'+(/单侧/.test(p)?' · 单侧':'');
 if(/Pull/i.test(p))return '上肢拉力';
 if(/Core/i.test(p))return '核心控制';
 return p||'力量训练';
}
function detail(){
 const e=getEx(detailId);if(!e)return library();
 const l=last(e.id);
 const roles=roleOverrides[e.id]||{};
 const primary=e.primary||[];
 const secondary=(roles.secondary||e.secondary||[]).filter(m=>!primary.includes(m));
 const stabilizer=(roles.stabilizer||e.stabilizer||[]).filter(m=>!primary.includes(m)&&!secondary.includes(m));
 const cues=[...(e.setup||[]).slice(0,1),...(e.execution||[]).slice(0,1)].slice(0,2);
 const historyList=activities().filter(a=>a.type==='strength'&&Array.isArray(a.log)&&a.log.some(it=>it.id===e.id)).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,12);
 return `<button class="sc-back" onclick="MOTIONStrength.backFromDetail()">← 返回</button><div class="sc-detail-head"><h1>${X(e.name)}</h1><p>${X(e.en)} · ${X(e.pattern||'')}</p></div>
 <section class="sc-facts" aria-label="动作信息">
   <div class="sc-factrow"><b>动作模式</b><span>${X(movementName(e))}</span></div>
   <div class="sc-factrow"><b>主要动力肌</b><div class="sc-tags">${muscleNames(primary)}</div></div>
   ${secondary.length?`<div class="sc-factrow"><b>协同肌</b><div class="sc-tags">${muscleNames(secondary)}</div></div>`:''}
   ${stabilizer.length?`<div class="sc-factrow"><b>稳定肌群</b><div class="sc-tags">${muscleNames(stabilizer)}</div></div>`:''}
 </section>
 ${cues.length?`<section class="sc-exercise"><h2 class="sc-section-title">动作要点</h2><ul class="sc-cues">${cues.map(c=>`<li>${X(c)}</li>`).join('')}</ul></section>`:''}
 <section class="sc-exercise"><div class="sc-kicker">LAST PERFORMANCE</div><div class="sc-performance">${l?X(l.sets.map(s=>`${s.weight} kg × ${s.reps}`).join(' · ')):'暂无历史记录'}</div>${l?`<p class="sc-performance-date">${X(l.date)}</p>`:''}</section>
 <section class="sc-exercise"><h2 class="sc-section-title">历史表现</h2>${historyList.map(a=>{const entry=a.log.find(it=>it.id===e.id);return `<div class="sc-historyline"><span>${X(a.date)}</span><b>${X(entry.sets.map(s=>`${s.weight}×${s.reps}`).join(' · '))}</b></div>`}).join('')||'<p class="sc-sub">暂无历史数据。</p>'}</section>
 ${pickContext?btn('添加到当前安排',`MOTIONStrength.choose('${e.id}')`,'solid sc-full'):btn('添加到模板',`MOTIONStrength.quickAdd('${e.id}')`,'outline sc-full')}
 ${e.custom?btn('编辑自定义动作',"MOTIONStrength.editCustom('"+e.id+"')",'quiet sc-full'):''}`;
}

function customForm(){
 const e=editingCustomId?getEx(editingCustomId):null;
 const primary=e?.primary?.[0]||'lats';
 return `<button class="sc-back" type="button" onclick="MOTIONStrength.cancelCustom()">← 返回</button>${top('CUSTOM EXERCISE',e?'编辑自定义动作':'创建自定义动作','自定义动作会独立保留重量和次数历史。')}
 <form class="sc-custom-form" onsubmit="event.preventDefault();MOTIONStrength.saveCustom()">
 <label class="sc-label">动作名称 <span class="sc-required">*</span><input id="sc-custom-name" class="sc-input" required maxlength="60" value="${X(e?.name||'')}" placeholder="例如：胸托哑铃划船"></label>
 <label class="sc-label">英文名称（选填）<input id="sc-custom-en" class="sc-input" maxlength="80" value="${X(e?.en||'')}" placeholder="Exercise name"></label>
 <label class="sc-label">主要训练肌群<select id="sc-custom-muscle" class="sc-input">${Object.keys(muscles).map(id=>`<option value="${id}" ${id===primary?'selected':''}>${X(muscles[id].name)}</option>`).join('')}</select></label>
 <label class="sc-label">动作说明（选填）<textarea id="sc-custom-desc" class="sc-input" rows="3" maxlength="240" placeholder="器械、握法或个人动作提示…">${X(e?.desc||'')}</textarea></label>
 <p class="sc-sub">每个自定义动作都有独立的训练记录。编辑名称不会删除已有历史。</p>
 <div class="sc-actions"><button type="button" class="sc-btn outline" onclick="MOTIONStrength.cancelCustom()">取消</button><button type="submit" class="sc-btn solid">保存动作</button></div>
 </form>`;
}
function newCustom(){editingCustomId=null;mode='create';refresh()}
function editCustom(id){if(!getEx(id)?.custom)return;editingCustomId=id;detailId=id;mode='create';refresh()}
function cancelCustom(){mode=editingCustomId?'detail':'library';editingCustomId=null;refresh()}
function saveCustom(){
 const name=String(document.getElementById('sc-custom-name')?.value||'').trim();
 const en=String(document.getElementById('sc-custom-en')?.value||'').trim();
 const primary=document.getElementById('sc-custom-muscle')?.value||'lats';
 const desc=String(document.getElementById('sc-custom-desc')?.value||'').trim();
 if(!name){toast('请填写动作名称');return}
 if(name.length>60||en.length>80||desc.length>240){toast('动作说明过长');return}
 if(exerciseList.some(e=>e.id!==editingCustomId&&e.name.toLowerCase()===name.toLowerCase())){toast('动作名称已存在，请换一个名称');return}
 if(!Object.prototype.hasOwnProperty.call(muscles,primary)){toast('请选择有效的肌群');return}
 if(!editingCustomId&&exerciseList.filter(e=>e.custom).length>=MAX_CUSTOM){toast('最多可创建 100 个自定义动作');return}
 const id=editingCustomId||('custom_'+gen());
 const next=normalizeCustom({id,name,en,primary:[primary],desc});
 if(!next)return;
 const old=getEx(id);
 if(old?.custom)Object.assign(old,next);
 else if(!old)exerciseList.push(next);
 else {toast('动作 ID 冲突');return}
 saveCustomExercises();
 const isNew=!editingCustomId;
 editingCustomId=null;
 if(isNew&&pickContext){choose(id);return}
 detailId=id;returnMode='library';mode='detail';refresh();toast(isNew?'自定义动作已创建':'动作已更新');
}
function history(){const a=activities().filter(x=>x.type==='strength').sort((a,b)=>String(b.date).localeCompare(String(a.date)));return `<div class="sc-headrow"><h2>训练历史</h2></div>
 ${a.map(s=>`<button class="sc-historyitem" onclick="openActivity('${X(s.id)}')"><span><b>${X(s.title||'力量训练')}</b><small>${X(s.date)} · ${Math.round(Number(s.minutes)||0)} min · ${s.sets??'—'} 组</small></span><span>›</span></button>`).join('')||'<div class="sc-empty">还没有力量训练记录。</div>'}`}
function refresh(){if(state.nav==='strength')render()}
function go(page){if(mode==='edit'&&page!=='edit'&&draft && !confirm('离开将放弃尚未保存的模板更改，确定吗？'))return; if(mode==='edit'){draft=null;editId=null}mode=page;pickContext=null;refresh();window.scrollTo({top:0,behavior:'smooth'})}
function openTemplateEditor(id){const t=templates.find(t=>t.id===id);if(!t)return;draft=clone(t);editId=id;editNew=false;mode='edit';refresh()}
function newTemplate(){draft={id:gen(),name:'新训练模板',desc:'',items:[]};editId=null;editNew=true;mode='edit';refresh()}
function saveEdit(){if(!draft)return;if(!draft.name.trim()){toast('请填写模板名称');return}const clean=sanitizeTemplates([draft])[0];if(!clean){toast('模板格式不正确');return}if(editNew)templates.push(clean);else{const i=templates.findIndex(t=>t.id===editId);if(i<0)return;templates[i]=clean;}saveTemplates();syncLegacyPlan();draft=null;editId=null;editNew=false;mode='home';refresh();toast('训练模板已保存')}
function cancelEdit(){if(draft&&!confirm('放弃未保存的模板修改？'))return;draft=null;editId=null;editNew=false;mode='home';refresh()}
function deleteTemplate(){if(!editId||!confirm('删除这个训练模板？历史运动记录不会删除。'))return;templates=templates.filter(t=>t.id!==editId);saveTemplates();syncLegacyPlan();draft=null;editId=null;mode='home';refresh()}
function current(type){return type==='edit'?draft:active}
function selectNumber(el){if(el&&typeof el.select==='function')el.select()}
function setField(type,i,j,field,value){const s=current(type)?.items?.[i]?.sets?.[j];if(!s||!['weight','reps'].includes(field))return '';const n=num(value,0,field==='weight'?999:200);s[field]=String(field==='reps'?Math.round(n):n);if(type==='workout')keepActive();return s[field]}
function move(i,delta){const c=mode==='edit'?draft:active;if(!c)return;const j=i+delta;if(j<0||j>=c.items.length)return;[c.items[i],c.items[j]]=[c.items[j],c.items[i]];if(active===c)keepActive();refresh()}
function removeItem(i){const c=mode==='edit'?draft:active;if(!c)return;c.items.splice(i,1);if(active===c)keepActive();refresh()}
function addSet(i){const c=mode==='edit'?draft:active,it=c?.items?.[i];if(!it||it.sets.length>=25)return;let last=it.sets.at(-1)||createSet();it.sets.push({...last,done:false});if(c===active)keepActive();refresh()}
function delSet(i,j){const it=draft?.items?.[i];if(!it||it.sets.length<=1){toast('至少保留一组');return}it.sets.splice(j,1);refresh()}
function mark(i,j){let s=active?.items?.[i]?.sets?.[j];if(!s)return;s.done=!s.done;keepActive();refresh()}
function toggleExercise(i){
 const sets=active?.items?.[i]?.sets;
 if(!sets?.length)return;
 const complete=!sets.every(s=>s.done);
 sets.forEach(s=>{s.done=complete});
 keepActive();refresh();
}
function start(id){if(active&&!confirm('已有未完成训练，是否放弃并开始新训练？'))return;let t=templates.find(x=>x.id===id);if(!t||!t.items.length){toast('先在模板中添加动作');return}active={id:gen(),name:t.name,templateId:t.id,startAt:Date.now(),items:clone(t.items).map(x=>({...x,sets:x.sets.map(s=>({...s,done:false}))}))};keepActive();mode='workout';refresh()}
function resume(){if(!active)return;mode='workout';refresh()}
function discard(){if(!confirm('丢弃这次未完成的训练？此前的历史记录不会受到影响。'))return;active=null;keepActive();mode='home';refresh()}
async function finish(){if(!active||busy)return;const done=active.items.map(it=>({id:it.id,sets:it.sets.filter(s=>s.done).map(s=>({weight:num(s.weight),reps:num(s.reps)}))})).filter(it=>it.sets.length);if(!done.length){toast('请先完成至少一组');return}busy=true;const from=active;
 const secs=Math.max(1,Math.round((Date.now()-from.startAt)/60000));const a={id:'m'+Date.now()+'sc',date:dateKey(new Date(from.startAt)),start:new Date(from.startAt).toISOString(),type:'strength',title:from.name+' · 力量训练',minutes:secs,sets:done.reduce((n,it)=>n+it.sets.length,0),exNames:done.map(it=>asName(it.id)),log:done,source:'手动记录'};
 try{state.manual.push(a);await storeActivity(a);active=null;keepActive();mode='history';refresh();toast('已保存运动，可在历史中关联 Apple Watch')}catch(e){state.manual=state.manual.filter(x=>x.id!==a.id);toast('保存失败，请保留页面重试');console.error(e)}finally{busy=false}}
function pick(context,index=null){pickContext={context,index};mode='library';search='';filter='全部';refresh()}
function choose(id){const e=getEx(id);if(!e||!pickContext)return;const {context,index}=pickContext;const target=context==='edit'?draft:active;if(!target)return;const prior=last(id)?.sets||((index!=null)?target.items[index]?.sets:[])||[];const item={id,sets:prior.length?prior.map(s=>createSet(s.weight,s.reps)):Array.from({length:3},()=>createSet())};if(index===null||index===undefined)target.items.push(item);else target.items.splice(index,1,item);if(context==='workout')keepActive();pickContext=null;mode=context==='edit'?'edit':'workout';refresh();toast('动作已添加')}
function backFromLibrary(){const ctx=pickContext?.context;pickContext=null;mode=ctx==='edit'?'edit':ctx==='workout'?'workout':'home';refresh()}
function openDetail(id,origin='library'){detailId=id;returnMode=origin;mode='detail';refresh()}
function backFromDetail(){mode=returnMode;refresh()}
function quickAdd(id){if(!templates.length)templates.push({id:gen(),name:'Lower Body A',desc:'',items:[]});const t=templates[0];t.items.push({id,sets:Array.from({length:3},()=>createSet())});saveTemplates();syncLegacyPlan();toast('已加入 '+t.name)}
function searchFor(q){search=q;const el=document.getElementById('sc-exlist');if(el)el.innerHTML=exrows()}
function setFilter(q){filter=q;refresh()}
function restoreTemplates(t){const clean=sanitizeTemplates(t);if(!clean.length)return;for(const v of clean){const i=templates.findIndex(a=>a.id===v.id);if(i<0)templates.push(v);else templates[i]=v;}saveTemplates();syncLegacyPlan();refresh()}
function restoreLegacyPlan(plan){
 const items=(plan||[]).filter(p=>p&&getEx(p.id)).map(p=>({id:p.id,sets:Array.from({length:Math.max(1,Math.min(15,Number(p.sets)||3))},()=>createSet(p.weight??0,p.reps??10))}));
 if(!items.length)return;
 const index=templates.findIndex(t=>t.id==='legacy-lower-a');
 if(index>=0)templates[index].items=items;
 else templates.unshift({id:'legacy-lower-a',name:'Lower Body A',desc:'从旧版训练计划恢复',items});
 saveTemplates();refresh();
}
window.MOTIONStrength={screen,go,openTemplateEditor,editTemplate:openTemplateEditor,restoreLegacyPlan,newTemplate,saveEdit,cancelEdit,deleteTemplate,editName:v=>{if(draft)draft.name=v},editDescription:v=>{if(draft)draft.desc=v},move,removeItem,addSet,delSet,mark,toggleExercise,setField,selectNumber,start,resume,discard,finish,pick,choose,backFromLibrary,openDetail,backFromDetail,quickAdd,newCustom,editCustom,cancelCustom,saveCustom,getCustomExercises,restoreCustomExercises,search:searchFor,filter:setFilter,note:(id,value)=>{state.notes[id]=value;persist()},getTemplates:()=>clone(templates),restoreTemplates};
// Override only the Strength page. All original activity, syncing, calendar and gear functions remain intact.
strength=function(){return window.MOTIONStrength.screen()};
// Integrate the remember-token control into the existing settings screen. Preserve
// the original Settings / Gear / Strength Linking sections and all stored data.
const priorSettings=settingsOverlay;
settingsOverlay=function(){
 const base=priorSettings();
 const rememberChoice=(()=>{try{return localStorage.getItem('motion_remember_worker_token')!=='0'}catch{return true}})();
 const label='访问口令（仅保存当前标签页）';
 const intro='<div class="spread"><button class="soft-btn" onclick="saveConfig()">';
 const tokenSettings=`<label class="motion-remember-row"><input id="remember-worker-token" type="checkbox" ${rememberChoice?'checked':''}><span><b>在此设备记住同步访问口令</b><small>仅建议在自己的设备上开启；口令存储在当前站点浏览器中。</small></span></label><div class="motion-forget"><button type="button" class="soft-btn" onclick="forgetWorkerToken()">清除此设备口令</button></div>`;
 return base.replace(label,'同步访问口令')
   .replace(intro,tokenSettings+intro)
   .replace('访问口令关闭浏览器标签页后需重新输入。','保存后更新网页无需重复输入；如果已清除网站数据，需重新填写一次。')
   +`<section class="card p18 section"><div class="micro">APP VERSION</div><h2 class="section-title">MOTION. V1.4.8</h2><p class="helper">Strength exercise variations · Custom exercises · Remember Sync Token</p></section>`;
};
})();
