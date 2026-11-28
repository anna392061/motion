/* MOTION. cycling analytics — v1.4.9 candidate; independent of running */
(function cyclingModule(){
"use strict";
const DISTANCES=[5,10,20,30], MAX_GAP=10, MIN_COVERAGE=.95;
const finite=n=>typeof n==="number"&&Number.isFinite(n);
const safe=(n,min=0,max=Infinity)=>finite(n)&&n>=min&&n<=max?n:null;
const avg=(sum,secs,total)=>total>0&&secs/total>=MIN_COVERAGE?sum/secs:null;
const round=(v,d=0)=>finite(v)?Number(v.toFixed(d)):null;
function eventAction(event,type){
 const e=String(event).toLowerCase().replace(/[_\s-]/g,""),t=String(type).toLowerCase().replace(/[_\s-]/g,"");
 if(e!=="timer"&&e!=="0")return null;
 if(t==="start"||t==="0")return "start";
 if(["stop","stopall","stopdisable","stopdisableall","1","4","8","9"].includes(t))return "stop";
 return null;
}
function timerEvents(events,startMs,asTimestamp){
 return (events||[]).map(e=>({t:(asTimestamp(e.timestamp)-startMs)/1000,action:eventAction(e.event,e.eventType)})).filter(e=>finite(e.t)&&e.action).sort((a,b)=>a.t-b.t);
}
function fromDecoded(decoded){
 const {rows,route,session,events}=decoded;
 const samples=rows.map(r=>[r.t,safe(r.dist),safe(r.speed,0,100),safe(r.power,0,5000),safe(r.cadence,0,300),safe(r.hr,0,255),safe(r.alt,-1000,10000)]);
 return {version:1,samples,route:route||[],events:events||[],timer:safe(session.totalTimerTime),np:safe(session.normalizedPower,0,5000),cadence:safe(session.avgCadence,0,300),power:safe(session.avgPower,0,5000)};
}
function newBucket(start,end){
 return {start,end,seconds:0,powerSum:0,powerTime:0,cadenceSum:0,cadenceTime:0,hrSum:0,hrTime:0,gain:0,gainCount:0,pieces:[],badPower:false};
}
function addPiece(b,dt,p,c,h,g,breakBefore,valid){
 if(dt<=0)return;
 b.seconds+=dt;
 if(valid&&finite(p)){b.powerSum+=p*dt;b.powerTime+=dt}
 if(valid&&finite(c)&&c>0){b.cadenceSum+=c*dt;b.cadenceTime+=dt}
 if(valid&&finite(c)){b.cadenceKnown=(b.cadenceKnown||0)+dt}
 if(valid&&finite(h)&&h>0){b.hrSum+=h*dt;b.hrTime+=dt}
 if(finite(g)){b.gain+=g;b.gainCount++}
 if(!valid||!finite(p))b.badPower=true;
 b.pieces.push({dt,p:valid?p:null,breakBefore});
}
function normalized(b){
 if(b.seconds<600||b.badPower||b.powerTime/b.seconds<.99)return null;
 let ring=[],sum=0,total=0,count=0,remain=1,acc=0;
 for(const q of b.pieces){
  if(q.breakBefore){ring=[];sum=0;remain=1;acc=0}
  if(!finite(q.p))return null;
  let left=q.dt;
  while(left>1e-8){const take=Math.min(left,remain);acc+=q.p*take;remain-=take;left-=take;
   if(remain<1e-8){ring.push(acc);sum+=acc;if(ring.length>30)sum-=ring.shift();if(ring.length===30){total+=(sum/30)**4;count++}remain=1;acc=0}
  }
 }
 return count>=30?Math.pow(total/count,.25):null;
}
function finish(b,allowNP){
 const cadence=b.cadenceKnown/b.seconds>=MIN_COVERAGE&&b.cadenceTime>0?b.cadenceSum/b.cadenceTime:null;
 return {start:b.start,end:b.end,seconds:b.seconds,speed:b.seconds>0?(b.end-b.start)*3600/b.seconds:null,power:avg(b.powerSum,b.powerTime,b.seconds),np:allowNP?normalized(b):null,cadence,hr:avg(b.hrSum,b.hrTime,b.seconds),gain:b.gainCount?b.gain:null};
}
function analyze(raw,km){
 if(!raw||!DISTANCES.includes(km))return null;
 const rows=(raw.samples||[]).filter(r=>finite(r[0])&&finite(r[1])).sort((a,b)=>a[0]-b[0]);
 if(rows.length<2)return null;
 const first=rows[0],last=rows.at(-1),total=(last[1]-first[1])/1000,elapsed=last[0]-first[0];
 if(total<=0||elapsed<=0)return null;
 const events=(raw.events||[]).filter(e=>finite(e.t)&&(e.action==="start"||e.action==="stop")).sort((a,b)=>a.t-b.t);
 let active=true,eidx=0;
 while(eidx<events.length&&events[eidx].t<=first[0])active=events[eidx++].action==="start";
 const timerKnown=events.length>0||finite(raw.timer)&&Math.abs(raw.timer-elapsed)<=2;
 const buckets=Array.from({length:Math.ceil(total/km-1e-10)},(_,i)=>newBucket(i*km,Math.min(total,(i+1)*km)));
 const overall=newBucket(0,total);let wasActive=false,irregular=false,negativeDistance=false,pausedDistance=false;
 // Smooth altitude with a 5-sample median; use 3 m hysteresis to limit jitter.
 const alt=rows.map((r,i)=>{const a=rows.slice(Math.max(0,i-2),i+3).map(x=>x[6]).filter(finite).sort((x,y)=>x-y);return finite(r[6])&&a.length?a[Math.floor(a.length/2)]:null});
 let anchor=alt[0],climb=0,dir=0;
 for(let i=1;i<rows.length;i++){
  const a=rows[i-1],b=rows[i],dt=b[0]-a[0],d0=(a[1]-first[1])/1000,d1=(b[1]-first[1])/1000;
  if(dt<=0)continue;
  if(d1<d0){negativeDistance=true;continue}
  let gain=null;
  if(finite(alt[i])&&finite(anchor)){
   const diff=alt[i]-anchor;gain=0;
   if(diff>=3){gain=diff;climb+=diff;anchor=alt[i];dir=1}
   else if(diff<=-3){anchor=alt[i];dir=-1}
  }else if(finite(alt[i]))anchor=alt[i];
  const cuts=[0,1];
  if(d1>d0){for(let mark=(Math.floor(d0/km)+1)*km;mark<d1-1e-10;mark+=km)cuts.push((mark-d0)/(d1-d0))}
  for(let j=eidx;j<events.length&&events[j].t<b[0];j++){if(events[j].t>a[0])cuts.push((events[j].t-a[0])/dt)}
  cuts.sort((x,y)=>x-y);
  for(let j=1;j<cuts.length;j++){
   const lo=cuts[j-1],hi=cuts[j];if(hi-lo<1e-10)continue;
   const t=a[0]+lo*dt;while(eidx<events.length&&events[eidx].t<=t+1e-7)active=events[eidx++].action==="start";
   if(timerKnown&&!active){if((d1-d0)*(hi-lo)>.0001)pausedDistance=true;wasActive=false;continue}
   const mid=d0+(d1-d0)*(lo+hi)/2,idx=Math.min(buckets.length-1,Math.max(0,Math.floor(mid/km)));
   const valid=dt<=MAX_GAP,sec=dt*(hi-lo),g=finite(gain)?gain*(hi-lo):null;
   if(dt>2)irregular=true;
   for(const target of [buckets[idx],overall])addPiece(target,sec,a[3],a[4],a[5],g,!wasActive,valid);
   wasActive=true;
  }
 }
 if(negativeDistance)return null;
 const timerMismatch=finite(raw.timer)&&Math.abs(overall.seconds-raw.timer)>Math.max(3,raw.timer*.01);
 const reliableTimer=timerKnown&&!timerMismatch&&!pausedDistance;
 // When timing is ambiguous, do not call it moving time or calculate NP from it.
 const allowNP=reliableTimer&&!irregular;
 const result=finish(overall,allowNP);
 if(finite(raw.np))result.np=raw.np;
 if(finite(raw.power))result.power=raw.power;
 if(finite(raw.cadence))result.cadence=raw.cadence;
 if(!reliableTimer){result.np=finite(raw.np)?raw.np:null}
 return {rows:buckets.map(b=>finish(b,allowNP)),overall:result,basis:reliableTimer?"计时器时间":"记录时间（可能含暂停）",reliableTimer,estimated:true,source:"FIT"};
}
function legacy(a,km){
 const splits=a.splits||[];if(!splits.length)return null;
 const out=[];let start=0,end=0,secs=0,expected=1;
 for(const s of splits){
  if(s.km!==expected++||!finite(s.distanceKm)||s.distanceKm<=0||s.distanceKm>1.001||!finite(s.seconds)||s.seconds<=0)break;
  end+=s.distanceKm;secs+=s.seconds;
  if(end-start>=km-.001||s.distanceKm<.999||s===splits.at(-1)){
   out.push({start,end,seconds:secs,speed:(end-start)*3600/secs});start=end;secs=0;
  }
 }
 if(secs>0)out.push({start,end,seconds:secs,speed:(end-start)*3600/secs});
 return {rows:out,basis:"历史分段时间（可能含暂停）",source:"历史分段",partial:finite(a.distance)&&end<a.distance-.03};
}
function results(a,km){return analyze(a.cyclingRaw,km)||legacy(a,km)}
function timeLabel(s){if(!finite(s)||s<=0)return "—";s=Math.round(s);const h=Math.floor(s/3600),m=Math.floor(s%3600/60),ss=String(s%60).padStart(2,"0");return h?`${h}:${String(m).padStart(2,"0")}:${ss}`:`${m}:${ss}`}
const fmt=(x,d=0)=>finite(x)?x.toFixed(d):"—";
const labelKm=x=>Number(x.toFixed(2)).toString();
let selectedKm=5,mode="basic";
function renderSplits(a){
 const data=results(a,selectedKm);
 const header=`<section class="section cycling-splits" id="cycling-splits"><div class="spread"><h2 class="section-title">分段均速</h2></div><div class="filter-line" style="margin:12px 0;gap:6px;flex-wrap:wrap">${DISTANCES.map(k=>`<button class="pill ${k===selectedKm?"active":""}" onclick="MOTIONCycling.select(${k})" aria-pressed="${k===selectedKm}">${k} km</button>`).join("")}</div><div class="filter-line" style="margin:8px 0;gap:6px"><button class="pill ${mode==="basic"?"active":""}" onclick="MOTIONCycling.view('basic')">基础表现</button><button class="pill ${mode==="training"?"active":""}" onclick="MOTIONCycling.view('training')">训练分析</button></div>`;
 const refresh=!a.cyclingRaw&&String(a.sourceKey||"").startsWith("garmin:")?`<button class="soft-btn" onclick="MOTIONCycling.enrich()" style="margin-top:10px">补全 Garmin FIT 数据</button><p id="cycling-refresh-status" class="helper" aria-live="polite">仅更新本条记录，不新增重复运动。</p>`:"";
 if(!data?.rows.length)return header+`<div class="card p18"><p class="helper">尚无可用分段数据。</p>${refresh}</div></section>`;
 const training=mode==="training",heads=training?["路段 km","均功率 W","NP W","踏频 rpm","心率 bpm"]:["路段 km","用时","均速 km/h","均功率 W","爬升 m"];
 const rows=data.rows.map(r=>[`${labelKm(r.start)}–${labelKm(r.end)}`,...(training?[fmt(r.power),fmt(r.np),fmt(r.cadence),fmt(r.hr)]:[timeLabel(r.seconds),fmt(r.speed,1),fmt(r.power),fmt(r.gain)])]);
 return header+`<div class="card p18" style="margin-top:12px;overflow-x:auto;padding-inline:12px"><table style="width:100%;border-collapse:collapse;font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap"><thead><tr>${heads.map(x=>`<th scope="col" style="font-weight:500;padding:10px 3px;text-align:right">${x}</th>`).join("")}</tr></thead><tbody>${rows.map(row=>`<tr style="border-top:1px solid rgba(143,107,97,.16)">${row.map((x,i)=>`<td style="padding:13px 3px;text-align:right;${i===0||i===2&&!training?"font-weight:650;":""}">${x}</td>`).join("")}</tr>`).join("")}</tbody></table><p class="helper" style="margin-top:10px">时间：${data.basis}。${data.partial?"历史数据不完整，仅显示已有分段。":""}${data.source==="FIT"?"分段爬升为海拔平滑估算；踏频仅统计踩踏时段。":"补全 FIT 后可获取分段功率、踏频及爬升。"}${training?" NP 仅在至少10分钟且功率采样充分时计算。":""}</p>${refresh}</div></section>`;
}
function summaryFields(a){
 const r=analyze(a.cyclingRaw,5)?.overall;
 const fields=[["平均功率",finite(a.power)?a.power:r?.power,"W"],["标准化功率",r?.np,"W"],["平均踏频",r?.cadence,"rpm"]];
 return fields.filter(x=>finite(x[1])).map(([k,v,u])=>[k,`${fmt(v)} ${u}`]);
}
function replacePanel(){const a=state.manual.find(x=>x.id===state.activityID),panel=document.getElementById("cycling-splits");if(a?.type==="cycle"&&panel)panel.outerHTML=renderSplits(a)}
function select(k){if(DISTANCES.includes(k)){selectedKm=k;replacePanel()}}
function view(v){if(["basic","training"].includes(v)){mode=v;replacePanel()}}
let busy=false;
async function enrich(){
 if(busy)return;const a=state.manual.find(x=>x.id===state.activityID);
 if(a?.type!=="cycle"||!String(a.sourceKey||"").startsWith("garmin:"))return;
 busy=true;const status=document.getElementById("cycling-refresh-status");if(status)status.textContent="正在读取原始 FIT…";
 try{
  const copy={...a};await importGarminCandidate(copy,String(a.sourceKey).slice(7));
  if(!copy.cyclingRaw?.samples?.length)throw Error("FIT 中没有可用的骑行记录");
  // Only patch the selected activity; never overwrite user-entered metadata.
  for(const k of ["cyclingRaw","power","cadenceSeries","powerSeries","speedSeries","distanceTimeSeries","routeTimedPoints","routePoints","altitudeSeries","hrSeries","splits","fitChecked","fitDecoder","distance","minutes","speed","duration","gain","cal","hr"])if(copy[k]!=null)a[k]=copy[k];
  await storeActivity(a);if(state.activityID===a.id)showOverlay();toast("骑行 FIT 数据已补全");
 }catch(e){const s=document.getElementById("cycling-refresh-status");if(s)s.textContent="补全失败："+e.message;toast("补全失败，请检查 Garmin 连接")}
 finally{busy=false}
}
const api={DISTANCES,eventAction,timerEvents,fromDecoded,analyze,legacy,results,summaryFields,renderSplits,select,view,enrich,timeLabel};
if(typeof window!=="undefined")window.MOTIONCycling=api;
return api;
})();
