/* MOTION. cycling analytics — v1.4.11; independent of running */
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
function archiveFit(buffer){const bytes=new Uint8Array(buffer);let binary="";for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(binary)}
function fromDecoded(decoded){
 const {rows,route,session,events}=decoded;
 const samples=rows.map(r=>[r.t,safe(r.dist),safe(r.speed,0,100),safe(r.power,0,5000),safe(r.cadence,0,300),safe(r.hr,0,255),safe(r.alt,-1000,10000)]);
 return {version:2,samples,route:route||[],events:events||[],timer:safe(session.totalTimerTime),elapsed:safe(session.totalElapsedTime),distance:safe(session.totalDistance),np:safe(session.normalizedPower,0,5000),cadence:safe(session.avgCadence,0,300),power:safe(session.avgPower,0,5000)};
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
 const first=rows[0],last=rows.at(-1),recordElapsed=last[0]-first[0],rawDistance=(last[1]-first[1])/1000;
 if(rawDistance<=0||recordElapsed<=0||rawDistance>2000)return null;
 const events=(raw.events||[]).filter(e=>finite(e.t)&&["start","stop"].includes(e.action)).sort((a,b)=>a.t-b.t);
 let active=true,eidx=0,activeTime=0,pausedTime=0,stationaryTime=0,unknownTime=0,excludedDistance=0,negativeDistance=false,moveDistance=0;
 const intervals=[];
 const alt=rows.map((r,i)=>{const a=rows.slice(Math.max(0,i-2),i+3).map(x=>x[6]).filter(finite).sort((x,y)=>x-y);return finite(r[6])&&a.length?a[Math.floor(a.length/2)]:null});
 let anchor=alt[0],breakBefore=true;
 while(eidx<events.length&&events[eidx].t<=first[0])active=events[eidx++].action==="start";
 for(let i=1;i<rows.length;i++){
  const a=rows[i-1],b=rows[i],dt=b[0]-a[0],dm=b[1]-a[1];
  if(dt<=0){if(Math.abs(dm)>.01)negativeDistance=true;continue}
  if(dm<-.01){negativeDistance=true;continue}
  const meters=Math.max(0,dm);let cursor=a[0],live=0;
  while(eidx<events.length&&events[eidx].t<=cursor)active=events[eidx++].action==="start";
  while(eidx<events.length&&events[eidx].t<b[0]){
   const ev=events[eidx++];if(active)live+=ev.t-cursor;cursor=ev.t;active=ev.action==="start";
  }
  if(active)live+=b[0]-cursor;
  const paused=Math.max(0,dt-live);activeTime+=live;pausedTime+=paused;
  if(live<=1e-8){excludedDistance+=meters;breakBefore=true;anchor=null;continue}
  const speeds=[a[2],b[2]].filter(v=>finite(v)&&v>=0&&v<=45);
  const bothMoving=speeds.length===2&&speeds.every(v=>v>.5);
  const stoppedEvidence=!bothMoving&&(!speeds.length||speeds.some(v=>v<=.5));
  // Distance is authoritative for stationary detection, except very short samples
  // with a moving speed sensor (distance may be quantized).
  const stationary=meters<=.01&&!bothMoving||meters/live<=.2&&stoppedEvidence;
  if(stationary){stationaryTime+=live;excludedDistance+=meters;breakBefore=true;anchor=null;continue}
  const implied=meters/live;
  let moving=live,estimated=false,unknown=false;
  if(meters<=.01){
   if(live<=2&&bothMoving){estimated=true}
   else{unknown=true;moving=0}
  }else if(implied>45){unknown=true}
  else if(live>MAX_GAP){
   // Smart recording can have sparse time stamps. Use active time as an
   // estimate for short gaps; for longer gaps require speed evidence.
   estimated=true;
   if(live>30){
    const v=speeds.length===2?(speeds[0]+speeds[1])/2:null;
    if(bothMoving&&v>0&&implied<=v*2&&implied>=v*.25){moving=Math.min(live,meters/v)}
    else unknown=true;
   }
  }
  if(paused>1e-7)estimated=true;
  if(unknown){unknownTime+=live;moving=meters>.01?live:0}
  // Any non-moving remainder from an inferred long gap is unobserved,
  // not a confirmed stop. Keep it in the uncertainty budget.
  const unresolved=unknown?live:Math.max(0,live-moving);
  if(!unknown&&unresolved>0)unknownTime+=unresolved;
  let gain=null;
  if(!unknown&&paused<=1e-7&&dt<=MAX_GAP&&finite(alt[i])&&finite(anchor)){
   const diff=alt[i]-anchor;gain=0;if(diff>=3){gain=diff;anchor=alt[i]}else if(diff<=-3)anchor=alt[i];
  }
  if(!finite(anchor)||unknown||paused>1e-7||dt>MAX_GAP)anchor=alt[i];
  const start=moveDistance;moveDistance+=meters/1000;
  intervals.push({start,end:moveDistance,moving,live,uncertainty:unresolved,estimated:estimated||unknown,unknown,p:a[3],c:a[4],h:a[5],gain,valid:!unknown&&paused<=1e-7&&dt<=MAX_GAP,npSparse:unknown||paused>1e-7||dt>2,breakBefore:breakBefore||paused>1e-7||unknown});
  breakBefore=unknown||paused>1e-7;
 }
 if(negativeDistance||moveDistance<=0)return null;
 const total=moveDistance;
 const buckets=Array.from({length:Math.ceil(total/km-1e-9)},(_,i)=>newBucket(i*km,Math.min(total,(i+1)*km)));
 const overall=newBucket(0,total);
 const at=d=>buckets[Math.max(0,Math.min(buckets.length-1,Math.floor((d+1e-9)/km)))];
 for(const q of intervals){
  const span=q.end-q.start,cuts=[q.start,q.end];
  if(span>0)for(let mark=(Math.floor((q.start+1e-9)/km)+1)*km;mark<q.end-1e-9;mark+=km)cuts.push(mark);
  cuts.sort((x,y)=>x-y);
  for(let j=1;j<cuts.length;j++){
   const lo=cuts[j-1],hi=cuts[j],ratio=span>0?(hi-lo)/span:1;
   if(ratio<=0)continue;
   const bucket=at((lo+hi)/2);
   for(const target of [bucket,overall]){
    target.active=(target.active||0)+q.live*ratio;
    target.uncertainty=(target.uncertainty||0)+q.uncertainty*ratio;
    target.estimated=target.estimated||q.estimated;
    target.npSparse=target.npSparse||q.npSparse;
    addPiece(target,q.moving*ratio,q.p,q.c,q.h,finite(q.gain)?q.gain*ratio:null,q.breakBefore&&j===1||target.pieces.length===0,q.valid);
   }
  }
 }
 const timerKnown=events.length>0||finite(raw.timer)&&Math.abs(raw.timer-recordElapsed)<=2;
 const timerMismatch=finite(raw.timer)&&Math.abs(activeTime-raw.timer)>Math.max(3,raw.timer*.01);
 const reliableTimer=timerKnown&&!timerMismatch;
 const sessionDistance=finite(raw.distance)?raw.distance/1000:null;
 const distanceMismatch=finite(sessionDistance)&&Math.abs(rawDistance-sessionDistance)>Math.max(.05,sessionDistance*.005);
 const edgeElapsed=finite(raw.elapsed)&&raw.elapsed>=recordElapsed-2?Math.max(recordElapsed,raw.elapsed):recordElapsed;
 const unobserved=Math.max(0,edgeElapsed-recordElapsed);
 function finishBucket(b){
  const uncertainty=b.uncertainty||0,activeSeconds=b.active||0;
  // Small unknown intervals may yield an explicitly approximate result.
  // Do not suppress an entire 20 km segment for a one-second ambiguity.
  const ok=reliableTimer&&!distanceMismatch&&b.seconds>0&&uncertainty<=Math.max(10,activeSeconds*.05);
  const r=finish(b,ok&&!b.npSparse);
  return {...r,seconds:ok?b.seconds:null,speed:ok?r.speed:null,power:ok?r.power:null,np:ok?r.np:null,cadence:ok?r.cadence:null,hr:ok?r.hr:null,gain:ok?r.gain:null,estimated:ok&&(!!b.estimated||uncertainty>0),unknown:uncertainty,complete:ok,active:activeSeconds,elapsed:activeSeconds};
 }
 const result=finishBucket(overall),out=buckets.map(finishBucket);
 result.elapsed=edgeElapsed;result.timer=finite(raw.timer)?raw.timer:reliableTimer?activeTime:null;
 result.stopped=reliableTimer&&unobserved<=3?pausedTime+stationaryTime:null;
 result.paused=pausedTime;result.stationary=stationaryTime;
 const sum=key=>out.reduce((s,r)=>s+(r[key]||0),0);
 const checks={distance:Math.abs(out.reduce((s,r)=>s+r.end-r.start,0)-total)<1e-6,time:Math.abs(sum("active")+pausedTime+stationaryTime-recordElapsed)<.01,timer:reliableTimer,distanceMatchesSession:!distanceMismatch,unobservedSeconds:unobserved,unknownSeconds:unknownTime,excludedDistanceMeters:excludedDistance};
 if(!checks.time||!checks.distance){for(const r of [...out,result]){r.seconds=r.speed=r.power=r.np=r.cadence=r.hr=null;r.complete=false}}
 return {rows:out,overall:result,basis:!result.complete?"部分移动时间无法核实；仅显示可计算的路段":out.some(r=>r.estimated)||result.estimated?"排除停车与暂停；≈ 表示采样间隔估算":"仅按移动距离与移动时间计算",reliableTimer,estimated:out.some(r=>r.estimated)||result.estimated,source:"FIT",checks};
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
function results(a,km){return a.cyclingRaw?analyze(a.cyclingRaw,km):legacy(a,km)}
function timeLabel(s){if(!finite(s)||s<0)return "—";s=Math.round(s);const h=Math.floor(s/3600),m=Math.floor(s%3600/60),ss=String(s%60).padStart(2,"0");return h?`${h}:${String(m).padStart(2,"0")}:${ss}`:`${m}:${ss}`}
const fmt=(x,d=0)=>finite(x)?x.toFixed(d):"—";
const labelKm=x=>Number(x.toFixed(2)).toString();
let selectedKm=5,mode="basic";
function renderSplits(a){
 const data=results(a,selectedKm);
 const header=`<section class="section cycling-splits" id="cycling-splits"><div class="spread"><h2 class="section-title">分段均速</h2></div><div class="filter-line" style="margin:12px 0;gap:6px;flex-wrap:wrap">${DISTANCES.map(k=>`<button class="pill ${k===selectedKm?"active":""}" onclick="MOTIONCycling.select(${k})" aria-pressed="${k===selectedKm}">${k} km</button>`).join("")}</div><div class="filter-line" style="margin:8px 0;gap:6px"><button class="pill ${mode==="basic"?"active":""}" onclick="MOTIONCycling.view('basic')">基础表现</button><button class="pill ${mode==="training"?"active":""}" onclick="MOTIONCycling.view('training')">训练分析</button></div>`;
 const status=refreshState.get(a.id),refresh=needsRefresh(a)?`<p id="cycling-refresh-status" class="helper" aria-live="polite">${status==="failed"?"原始数据更新失败。":status==="busy"?"正在自动更新原始数据…":"正在准备原始数据更新…"}</p>${status==="failed"?`<button class="soft-btn" onclick="MOTIONCycling.enrich()" style="margin-top:8px">重试</button>`:""}`:"";
 if(!data?.rows.length)return header+`<div class="card p18"><p class="helper">尚无可用分段数据。</p>${refresh}</div></section>`;
 const training=mode==="training",heads=training?["路段 km","均功率 W","NP W","踏频 rpm","心率 bpm","爬升 m"]:(data.source==="FIT"?["路段 km","移动时间","均速 km/h"]:["路段 km","历史用时","历史均速 km/h"]);
 const rows=data.rows.map(r=>[`${labelKm(r.start)}–${labelKm(r.end)}`,...(training?[fmt(r.power),fmt(r.np),fmt(r.cadence),fmt(r.hr),fmt(r.gain)]:[`${r.estimated&&finite(r.seconds)?"≈":""}${timeLabel(r.seconds)}`,`${r.estimated&&finite(r.speed)?"≈":""}${fmt(r.speed,1)}`])]);
 return header+`<div class="card p18" style="margin-top:12px;overflow-x:auto;padding-inline:12px"><table style="width:100%;border-collapse:collapse;font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap"><thead><tr>${heads.map(x=>`<th scope="col" style="font-weight:500;padding:10px 3px;text-align:right">${x}</th>`).join("")}</tr></thead><tbody>${rows.map(row=>`<tr style="border-top:1px solid rgba(143,107,97,.16)">${row.map((x,i)=>`<td style="padding:13px 3px;text-align:right;${i===0||i===2&&!training?"font-weight:650;":""}">${x}</td>`).join("")}</tr>`).join("")}</tbody></table><p class="helper" style="margin-top:10px">时间：${data.basis}。${data.partial?"历史数据不完整，仅显示已有分段。":""}${data.source==="FIT"?(training?" 功率含滑行零值，踏频仅计踩踏；NP 至少10分钟且采样充分。爬升为估算。":" 停留时间仅在运动概览统计。"):" 旧记录仅展示历史计算值，不等同移动均速。"}</p>${refresh}</div></section>`;
}
function gradeSeries(raw){
 const points=[];
 for(const r of raw?.samples||[]){if(!finite(r[1])||!finite(r[6]))continue;const last=points.at(-1);if(!last||r[1]>last[0])points.push([r[1],r[6]])}
 if(points.length<2)return [];
 const start=points[0][0],end=points.at(-1)[0],result=[];let i=0;
 function altitude(d){while(i+1<points.length&&points[i+1][0]<d)i++;const a=points[i],b=points[i+1];if(!a||!b||d<a[0]||d>b[0]||b[0]-a[0]>100)return null;return a[1]+(b[1]-a[1])*(d-a[0])/(b[0]-a[0])}
 let before=altitude(start);
 const step=100*Math.max(1,Math.ceil((end-start)/100/600));
 for(let d=start+step;d<=end;d+=step){const after=altitude(d);if(finite(before)&&finite(after))result.push([(d-start-step/2)/1000,(after-before)/step*100]);else result.push([(d-start-step/2)/1000,null]);before=after}
 return result;
}
function gradeChart(a){
 const points=gradeSeries(a.cyclingRaw),valid=points.filter(p=>finite(p[1]));
 if(valid.length<2)return "";
 const xmax=points.at(-1)[0]+(points[1][0]-points[0][0])/2,max=Math.max(2,...valid.map(p=>Math.abs(p[1]))),W=340,H=130,pad=14;
 const x=d=>pad+d/xmax*(W-2*pad),y=g=>H/2-g/max*(H/2-pad);
 let path="",move=true;for(const [d,g] of points){if(!finite(g)){move=true;continue}path+=(move?"M":"L")+x(d).toFixed(1)+","+y(g).toFixed(1)+" ";move=false}
 return `<div class="card p18 section metric-chart"><div class="micro">GRADE · 坡度</div><p class="chart-caption">根据海拔与距离估算 · 非瞬时坡度</p><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="骑行坡度与距离曲线"><line x1="${pad}" x2="${W-pad}" y1="${H/2}" y2="${H/2}" stroke="#ead7e1"/><path d="${path}" fill="none" stroke="#9b87b3" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg><div class="chart-labels"><span>0 km · 0% 基准线</span><span>${xmax.toFixed(1)} km</span></div></div>`;
}
function summaryFields(a){
 const data=analyze(a.cyclingRaw,5),r=data?.overall;
 const fields=[["距离",finite(r?.end)?r.end.toFixed(2)+" km":finite(a.distance)?a.distance.toFixed(2)+" km":"—"],["移动均速",finite(r?.speed)?(r.estimated?"≈":"")+fmt(r.speed,1)+" km/h":"—"],["移动时间",finite(r?.seconds)?(r.estimated?"≈":"")+timeLabel(r.seconds):"—"],[finite(a.cyclingRaw?.elapsed)?"总耗时":"记录跨度（估算）",timeLabel(r?.elapsed)],["停留时间",timeLabel(r?.stopped)],["计时时间",timeLabel(r?.timer??a.cyclingRaw?.timer??(finite(a.minutes)?a.minutes*60:null))],["平均功率",finite(r?.power)?fmt(r.power)+" W":"—"],["标准化功率",finite(r?.np)?fmt(r.np)+" W":"—"],["平均踏频",finite(r?.cadence)?fmt(r.cadence)+" rpm":"—"],["平均心率",finite(r?.hr)?fmt(r.hr)+" bpm":"—"],["累计爬升",finite(a.gain)?fmt(a.gain)+" m":"—"],["来源",a.source||"—"]];
 if(!finite(r?.speed)&&finite(a.speed))fields.push(["设备均速（原始）",fmt(a.speed,1)+" km/h"]);if(!finite(r?.power)&&finite(a.cyclingRaw?.power??a.power))fields.push(["设备平均功率（原始）",fmt(a.cyclingRaw?.power??a.power)+" W"]);if(!finite(r?.np)&&finite(a.cyclingRaw?.np))fields.push(["设备 NP（原始）",fmt(a.cyclingRaw.np)+" W"]);
 return fields;
}
function replacePanel(){const a=state.manual.find(x=>x.id===state.activityID),panel=document.getElementById("cycling-splits");if(a?.type==="cycle"&&panel)panel.outerHTML=renderSplits(a)}
function select(k){if(DISTANCES.includes(k)){selectedKm=k;replacePanel()}}
function view(v){if(["basic","training"].includes(v)){mode=v;replacePanel()}}
const refreshState=new Map();
function needsRefresh(a){return a?.type==="cycle"&&(!a.cyclingRaw?.samples?.length&&String(a.sourceKey||"").startsWith("garmin:")||a.cyclingRaw?.version===1&&!!a.cyclingRaw.fitBase64)}
async function enrich(id=state.activityID,automatic=false){
 const a=state.manual.find(x=>x.id===id);
 if(!needsRefresh(a)||refreshState.get(id)==="busy"||(automatic&&refreshState.get(id)==="failed"))return;
 refreshState.set(id,"busy");if(state.activityID===id&&state.overlay==="activity")replacePanel();
 try{
  const copy={...a};
  if(a.cyclingRaw?.fitBase64){const binary=atob(a.cyclingRaw.fitBase64),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));const full=await parseGarminFull(bytes.buffer,"cycle");Object.assign(copy,full)}
  else await importGarminCandidate(copy,String(a.sourceKey).slice(7));
  if(!copy.cyclingRaw?.samples?.length||copy.cyclingRaw.version!==2)throw Error("原始数据未成功解析");
  if(!state.manual.includes(a)||a.type!=="cycle")return;
  // Save a new object first, then update the visible record; never overwrite title, notes or equipment.
  const next={...a};
  for(const k of ["cyclingRaw","power","cadenceSeries","powerSeries","speedSeries","distanceTimeSeries","routeTimedPoints","routePoints","altitudeSeries","hrSeries","splits","fitChecked","fitDecoder","distance","gain","cal","hr"])if(copy[k]!=null)next[k]=copy[k];
  const previous={...a};Object.assign(a,next);
  try{await storeActivity(a)}catch(e){for(const k of Object.keys(a))if(!(k in previous))delete a[k];Object.assign(a,previous);throw e}
  if(!state.manual.includes(a)||a.type!=="cycle")return;
  refreshState.delete(id);
  if(state.activityID===id&&state.overlay==="activity"){const old=document.querySelector(".overlay")?.scrollTop||0;showOverlay();const overlay=document.querySelector(".overlay");if(overlay)overlay.scrollTop=old}
 }catch(e){refreshState.set(id,"failed");if(state.activityID===id&&state.overlay==="activity")replacePanel();console.warn("Cycling FIT refresh failed",e)}
 finally{if(refreshState.get(id)==="busy")refreshState.delete(id)}
}
function rawChart(...args){return graphSVG(...args).replace(/平均 [^·]* · /,"原始采样 · ")}
const api={rawChart,DISTANCES,eventAction,timerEvents,fromDecoded,archiveFit,analyze,legacy,results,summaryFields,gradeSeries,gradeChart,renderSplits,select,view,enrich,needsRefresh,timeLabel};
if(typeof window!=="undefined"){window.MOTIONCycling=api;if(typeof openActivity==="function"){const previous=openActivity;openActivity=function(id){selectedKm=5;mode="basic";const result=previous(id);const a=state.manual.find(x=>x.id===id);if(needsRefresh(a))void enrich(id,true);return result}}}
return api;
})();
