/* MOTION. Performance V1 · local-only, no map-style changes, no network analytics.
   Timed GPS / distance streams are authoritative; legacy splits are marked partial.
   This module never mutates original workout values. */
(function(){
"use strict";
const DISTANCES=[1,3,5,6,8];
const CACHE_KEY="motion_performance_v1_seen";
const NOTICES_KEY="motion_performance_v1_insights";
let selectedDistance=5;
let selectedView="route";
let selectedActivityId=null;
let initialized=false;
const number=x=>x!==null&&x!==undefined&&x!==""&&Number.isFinite(Number(x))?Number(x):NaN;
const safe=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const timeText=s=>Number.isFinite(s)&&s>0?(Math.floor(Math.round(s)/3600)>0?Math.floor(Math.round(s)/3600)+":":"")+(Math.floor(Math.round(s)%3600/60)).toString().padStart(2,"0")+":"+Math.round(s%60).toString().padStart(2,"0"):"—";
const paceText=(seconds,km)=>Number.isFinite(seconds)&&km>0?timeText(seconds/km).replace(/^00:/,"")+"/km":"—";
const runList=()=>state.manual.filter(a=>a&&a.type==="run"&&!String(a.source||"").includes("SAMPLE")&&!String(a.source||"").includes("演示")&&!String(a.id||"").startsWith("sample-"));
const chronology=a=>String(a.start||a.date||"");
const earlier=(a,b)=>chronology(a)<chronology(b)||(chronology(a)===chronology(b)&&String(a.id)<String(b.id));
const RAD=Math.PI/180;
function meters(a,b){
 const p1=number(a[0])*RAD,p2=number(b[0])*RAD,d=(number(b[0])-number(a[0]))*RAD,l=(number(b[1])-number(a[1]))*RAD;
 const h=Math.sin(d/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(l/2)**2;
 return 12742000*Math.asin(Math.min(1,Math.sqrt(Math.max(0,h))));
}
function goodCoord(p){return Array.isArray(p)&&p.length>=2&&Number.isFinite(number(p[0]))&&Number.isFinite(number(p[1]))&&Math.abs(number(p[0]))<=90&&Math.abs(number(p[1]))<=180}
function routeSamples(a){
 const timed=Array.isArray(a.routeTimedPoints)&&a.routeTimedPoints.length>=2?a.routeTimedPoints:null;
 const source=timed||a.routePoints;
 if(!Array.isArray(source)||source.length<2)return [];
 const pts=source.filter(goodCoord).map(p=>({lat:number(p[0]),lon:number(p[1]),t:timed?number(p[2]):NaN}));
 if(pts.length<2)return [];
 const result=[{...pts[0],d:0}];let total=0,mark=50;
 for(let i=1;i<pts.length;i++){
  const prev=pts[i-1],cur=pts[i],step=meters([prev.lat,prev.lon],[cur.lat,cur.lon]);
  if(!Number.isFinite(step)||step>400)return [];
  if(step<0.5)continue;
  while(mark<=total+step&&result.length<1200){
   const f=(mark-total)/step;
   result.push({lat:prev.lat+(cur.lat-prev.lat)*f,lon:prev.lon+(cur.lon-prev.lon)*f,t:Number.isFinite(prev.t)&&Number.isFinite(cur.t)?prev.t+(cur.t-prev.t)*f:NaN,d:mark});
   mark+=50;
  }
  total+=step;
 }
 const tail=pts[pts.length-1];
 if(total>=50&&result.length<1200&&total-result[result.length-1].d>20)result.push({...tail,d:total});
 return result;
}
function overlap(a,b){
 const x=routeSamples(a),y=routeSamples(b);
 if(x.length<17||y.length<17)return null;
 let prev=new Uint16Array(y.length+1),best=0,ia=0,jb=0;
 for(let i=1;i<=x.length;i++){
  const cur=new Uint16Array(y.length+1);
  for(let j=1;j<=y.length;j++){
   if(meters([x[i-1].lat,x[i-1].lon],[y[j-1].lat,y[j-1].lon])<=65){
    cur[j]=prev[j-1]+1;
    if(cur[j]>best){best=cur[j];ia=i;jb=j}
   }
  }
  prev=cur;
 }
 if(best<17)return null;
 const beginA=ia-best,beginB=jb-best,finishA=ia-1,finishB=jb-1;
 const length=Math.min(x[finishA].d-x[beginA].d,y[finishB].d-y[beginB].d);
 if(length<800)return null;
 const full=length>=.85*Math.min(x.at(-1).d,y.at(-1).d)&&
  Math.abs(x.at(-1).d-y.at(-1).d)<Math.max(350,Math.max(x.at(-1).d,y.at(-1).d)*.1)&&
  meters([x[0].lat,x[0].lon],[y[0].lat,y[0].lon])<125&&
  meters([x.at(-1).lat,x.at(-1).lon],[y.at(-1).lat,y.at(-1).lon])<125;
 const timedA=x[finishA].t-x[beginA].t,timedB=y[finishB].t-y[beginB].t;
 const timed=Number.isFinite(timedA)&&Number.isFinite(timedB)&&timedA>0&&timedB>0&&
   Number.isFinite(x[beginA].t)&&Number.isFinite(y[beginB].t)&&timedA<length/1.1&&timedB<length/1.1;
 return {other:b,meters:length,full,secondsA:timed?timedA:null,secondsB:timed?timedB:null,quality:timed?"timed":"route-only",score:length};
}
function matchesFor(activity,limit=8){
 if(!activity?.routePoints?.length)return [];
 return runList().filter(x=>x.id!==activity.id&&x.routePoints?.length>=2&&earlier(x,activity))
  .map(x=>overlap(activity,x)).filter(Boolean)
  .sort((a,b)=>chronology(b.other).localeCompare(chronology(a.other))||b.meters-a.meters).slice(0,limit);
}
function normalizeDistance(a){
 let data=Array.isArray(a.distanceTimeSeries)?a.distanceTimeSeries:[];
 if(!data.length&&Array.isArray(a.routeTimedPoints)&&a.routeTimedPoints.length>6){
  let last=a.routeTimedPoints[0],total=0;data=[];
  for(const p of a.routeTimedPoints){
   if(!goodCoord(p)||!Number.isFinite(number(p[2])))continue;
   if(last&&p!==last){const step=meters(last,p);if(step>250)return [];if(step>=0)total+=step;}
   data.push([number(p[2]),total]);last=p;
  }
 }
 let out=[],lastT=-Infinity,lastD=-Infinity;
 for(const pair of data){
  if(!Array.isArray(pair)||pair.length<2)continue;
  const t=number(pair[0]),d=number(pair[1]);
  if(!Number.isFinite(t)||!Number.isFinite(d)||t<0||d<0||t<=lastT||d<lastD-6)continue;
  if(Number.isFinite(lastT)&&d-lastD>Math.max(100,13*(t-lastT)+30))return [];
  const value=Math.max(d,lastD===-Infinity?0:lastD);
  out.push([t,value]);lastT=t;lastD=value;
 }
 return out.length>=8?out:[];
}
function interpolatedTime(rows,dist){
 if(!rows.length||dist<rows[0][1]||dist>rows.at(-1)[1])return NaN;
 let lo=0,hi=rows.length-1;
 while(lo<hi){const m=(lo+hi)>>1;if(rows[m][1]<dist)lo=m+1;else hi=m;}
 const j=lo;
 if(j===0)return rows[0][0];
 const x=rows[j-1],y=rows[j],den=y[1]-x[1];
 return den>0?x[0]+(dist-x[1])*(y[0]-x[0])/den:y[0];
}
function exactEffort(a,km){
 const rows=normalizeDistance(a),target=km*1000;
 if(rows.length<8||rows.at(-1)[1]-rows[0][1]<target-2)return null;
 let fastest=Infinity;
 for(let i=0;i<rows.length;i++){
  const start=rows[i][1];
  if(start+target<=rows.at(-1)[1]){
   const t=interpolatedTime(rows,start+target)-rows[i][0];
   if(t>100*km&&t<fastest)fastest=t;
  }
  if(start-target>=rows[0][1]){
   const t=rows[i][0]-interpolatedTime(rows,start-target);
   if(t>100*km&&t<fastest)fastest=t;
  }
 }
 return Number.isFinite(fastest)?{activity:a,seconds:fastest,quality:"precise"}:null;
}
function splitEffort(a,km){
 const rows=Array.isArray(a.splits)?a.splits:[];
 if(!rows.length||!Number.isInteger(km))return null;
 const full=rows.filter(s=>number(s.distanceKm)>=.985&&number(s.distanceKm)<=1.015&&Number.isFinite(number(s.seconds))&&number(s.seconds)>0);
 if(full.length<km)return null;
 let best=Infinity;
 for(let i=0;i+km<=full.length;i++){
  if(full.slice(i,i+km).some((s,j)=>number(s.km)!==number(full[i].km)+j))continue;
  const sum=full.slice(i,i+km).reduce((n,s)=>n+number(s.seconds),0);
  if(sum>100*km&&sum<best)best=sum;
 }
 return Number.isFinite(best)?{activity:a,seconds:best,quality:"splits"}:null;
}
function effort(a,km){return exactEffort(a,km)||splitEffort(a,km);}
function results(km){
 return runList().map(a=>effort(a,km)).filter(Boolean).sort((a,b)=>a.seconds-b.seconds||chronology(a.activity).localeCompare(chronology(b.activity)));
}
function trend(km){
 return results(km).sort((a,b)=>chronology(a.activity).localeCompare(chronology(b.activity)));
}
function insightFor(a){
 const insights=[],prev=runList().filter(x=>x.id!==a.id&&earlier(x,a));
 for(const d of DISTANCES){
  const current=exactEffort(a,d);if(!current)continue;
  const prior=prev.map(x=>exactEffort(x,d)).filter(Boolean).sort((x,y)=>x.seconds-y.seconds);
  if(prior.length&&current.seconds+1<prior[0].seconds)insights.push({kind:"distance",d,id:a.id,title:"新的 "+d+" km 最佳成绩",sub:timeText(current.seconds)+" · 比此前快 "+Math.round(prior[0].seconds-current.seconds)+" 秒"});
  else if(!prior.length)insights.push({kind:"distance",d,id:a.id,title:"建立 "+d+" km 连续计时纪录",sub:timeText(current.seconds)+" · 目前缺少可比较的精确历史成绩"});
 }
 const routeMatches=matchesFor(a,1);
 if(routeMatches.length){
  const m=routeMatches[0],s=m.secondsA&&m.secondsB?("本次 "+timeText(m.secondsA)+" · 上次 "+timeText(m.secondsB)):"识别到共同 GPS 路段；需要带时间戳的轨迹才能比较速度";
  insights.push({kind:"route",id:a.id,title:m.full?"再次跑过熟悉路线":"与上次同路段表现对比",sub:(m.meters/1000).toFixed(1)+" km · "+s});
 }
 return insights;
}
function makeAlerts(){
 const records=runList();
 let seen=[];try{seen=JSON.parse(localStorage.getItem(CACHE_KEY)||"[]");if(!Array.isArray(seen))seen=[];}catch(e){}
 const marked=new Set(seen);
 const fresh=records.filter(a=>!marked.has(String(a.id))).sort((a,b)=>chronology(a).localeCompare(chronology(b)));
 if(!initialized){
  initialized=true;
  if(!localStorage.getItem(CACHE_KEY)){localStorage.setItem(CACHE_KEY,JSON.stringify(records.map(a=>String(a.id)).slice(-1000)));return [];}
 }
 if(!fresh.length)return [];
 const notifications=[];
 for(const a of fresh){notifications.push(...insightFor(a));marked.add(String(a.id));}
 try{
  localStorage.setItem(CACHE_KEY,JSON.stringify([...marked].slice(-1000)));
  if(notifications.length){
   const old=JSON.parse(localStorage.getItem(NOTICES_KEY)||"[]");
   localStorage.setItem(NOTICES_KEY,JSON.stringify([...notifications,...(Array.isArray(old)?old:[])].slice(0,12)));
  }
 }catch(e){console.warn("Performance insights storage unavailable",e);}
 return notifications;
}
function recentInsights(){try{const a=JSON.parse(localStorage.getItem(NOTICES_KEY)||"[]");return Array.isArray(a)?a.filter(x=>runList().some(r=>r.id===x.id)).slice(0,3):[];}catch(e){return [];}}
function alertsHtml(){
 const notices=recentInsights();
 return notices.length?'<div class="perf-notice-list">'+notices.map(n=>'<button class="perf-notice" onclick="MOTIONPerformance.open(\''+safe(n.id)+'\',\''+n.kind+'\','+(n.d||5)+')"><strong>'+(n.kind==="distance"?"✦ ":"⌁ ")+safe(n.title)+'</strong><small>'+safe(n.sub)+'</small></button>').join("")+"</div>":"";
}
function perfOverview(){
 return '<section class="section perf-entry"><div class="section-row"><h2 class="section-title">Performance · 表现记录</h2><span class="micro">RUNNING</span></div><div class="card p18"><p class="helper">同一路线与路段对比 · 1 / 3 / 5 / 6 / 8 km 历史成绩</p>'+alertsHtml()+'<button class="soft-btn perf-link" onclick="MOTIONPerformance.open()">查看历史表现 →</button></div></section>';
}
function perfDetail(a){
 const m=matchesFor(a,1),n=DISTANCES.map(d=>({d,result:effort(a,d)})).filter(x=>x.result);
 const last=m[0];if(!last&&!n.length)return '<section class="section perf-in-detail"><div class="card p18"><div class="micro">RUNNING PERFORMANCE</div><p class="helper">可查看历史对比；完整计时数据不足时不会生成未经验证的纪录。</p><button class="soft-btn" onclick="MOTIONPerformance.open(\''+safe(a.id)+'\')">查看 Performance →</button></div></section>';
 return '<section class="section perf-in-detail"><div class="card p18"><div class="micro">RUNNING PERFORMANCE</div>'+
 (last?'<p class="perf-small"><strong>⌁ '+(last.full?"同一路线":"共同路段")+'</strong> · '+(last.meters/1000).toFixed(1)+' km · '+safe(last.other.date)+'</p>':'')+
 (n.length?'<p class="perf-small"><strong>距离表现</strong> · '+n.map(x=>x.d+' km '+timeText(x.result.seconds)+(x.result.quality==="splits"?"*":"")).join(' · ')+'</p>':'')+
 '<button class="soft-btn perf-link" onclick="MOTIONPerformance.open(\''+safe(a.id)+'\')">查看历史对比 →</button></div></section>';
}
function chart(values){
 if(values.length<2)return '';
 const last=values.slice(-18),min=Math.min(...last.map(x=>x.seconds)),max=Math.max(...last.map(x=>x.seconds));
 const n=last.length,pts=last.map((v,i)=>{const x=18+(i/(n-1))*280,y=15+(max===min?.5:(v.seconds-min)/(max-min))*72;return [x,y]});
 const path=pts.map((p,i)=>(i?"L":"M")+p[0].toFixed(1)+","+p[1].toFixed(1)).join(" ");
 return '<svg class="perf-chart" viewBox="0 0 320 112" role="img" aria-label="历次最佳距离成绩趋势，线条越靠上表示耗时越短"><line x1="15" y1="96" x2="305" y2="96" stroke="#e6d7cc"/><path d="'+path+'" stroke="#c58b64" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'+pts.map(p=>'<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="3.5" fill="#c58b64"/>').join("")+'</svg>';
}
function routeView(){
 const a=runList().find(r=>r.id===selectedActivityId)||runList().slice().sort((x,y)=>chronology(y).localeCompare(chronology(x)))[0];
 if(!a)return '<div class="card p18"><p class="helper">导入真实跑步记录后，这里会显示重复路线与共同路段。</p></div>';
 const m=matchesFor(a,12),withoutTiming=runList().filter(x=>x.routePoints?.length&&!x.routeTimedPoints?.length);
 return '<div class="perf-card"><div class="micro">SELECTED RUN</div><h3>'+safe(a.date)+' · '+safe(a.title||"跑步")+'</h3><p class="helper">'+safe(a.distance||"—")+' km · '+safe(a.pace||"—")+'/km</p></div>'+
 (m.length?m.map(x=>'<div class="perf-card"><div class="perf-spread"><strong>'+(x.full?"相同路线":"共同路段")+' · '+(x.meters/1000).toFixed(1)+' km</strong><small>'+safe(x.other.date)+'</small></div><p class="perf-value">'+(x.secondsA?timeText(x.secondsA):"—")+' <span>本次</span></p><p class="perf-sub">'+(x.secondsB?"上次 "+timeText(x.secondsB)+" · "+(x.secondsA<x.secondsB?"快 ":"慢 ")+Math.abs(Math.round(x.secondsA-x.secondsB))+" 秒":"旧记录缺少有效的 GPS 时间信息，不能计算共同路段完成时间")+'</p>'+(x.secondsA&&x.secondsB?'<p class="perf-sub">本次 '+paceText(x.secondsA,x.meters/1000)+' · 上次 '+paceText(x.secondsB,x.meters/1000)+'</p>':'')+'</div>').join(""):'<div class="perf-card"><p class="helper">还没有识别到方向一致、连续至少约 800 m 的历史共同路段。</p></div>')+
 (withoutTiming.length?'<button class="soft-btn perf-link" onclick="MOTIONPerformance.enrich()">补充旧记录的时间数据（需同步口令）</button>':'')+
 '<p class="perf-note">路线以真实 GPS 坐标匹配，容许一定定位误差。只有两条路线都有有效位置时间数据时才计算路段时间；不同训练强度不能直接解释为体能进步。</p>';
}
function distanceView(){
 const rows=results(selectedDistance),accurate=rows.filter(x=>x.quality==="precise"),best=accurate[0]||rows[0],hist=trend(selectedDistance);
 return '<div class="perf-dist-buttons">'+DISTANCES.map(d=>'<button class="'+(d===selectedDistance?"active":"")+'" onclick="MOTIONPerformance.distance('+d+')">'+d+' km</button>').join("")+'</div>'+
 '<div class="perf-card"><div class="micro">'+selectedDistance+' KM / BEST EFFORT</div><div class="perf-hero">'+(best?timeText(best.seconds):"—")+'</div><p class="perf-sub">'+(best?(safe(best.activity.date)+' · '+(best.quality==="precise"?"连续距离计时":"仅整公里分段，非精确最快成绩")):"还没有足够的可计算历史数据")+'</p>'+chart(hist)+'</div>'+
 (hist.length?'<div class="perf-card"><strong>历史表现</strong><div class="perf-history">'+hist.slice(-15).reverse().map(x=>'<button onclick="MOTIONPerformance.open(\''+safe(x.activity.id)+'\',\'distance\','+selectedDistance+')"><span>'+safe(x.activity.date)+'</span><strong>'+timeText(x.seconds)+'</strong><small>'+(x.quality==="precise"?"连续计时":"整公里段")+'</small></button>').join("")+'</div></div>':'')+
 '<p class="perf-note">纪录取每次跑步中连续 '+selectedDistance+' km 的最短经过时间（含暂停）。有完整时间距离序列时进行插值计算；历史记录仅有公里分段时明确标注为「整公里段」，不将其当作精确个人纪录。</p>';
}
function screen(){
 return '<div class="perf-screen"><button class="backlink" onclick="MOTIONPerformance.close()">← 返回</button><div class="micro">MOTION. / RUNNING</div><h1 class="page-title">Performance.</h1><p class="sub">相同路线与特定距离的历史表现。</p><div class="perf-tabs"><button class="'+(selectedView==="route"?"active":"")+'" onclick="MOTIONPerformance.tab(\'route\')">Route</button><button class="'+(selectedView==="distance"?"active":"")+'" onclick="MOTIONPerformance.tab(\'distance\')">Distance</button></div>'+(selectedView==="route"?routeView():distanceView())+'</div>';
}
function open(id,kind,d){
 selectedActivityId=id||null;selectedView=kind==="distance"?"distance":"route";if(DISTANCES.includes(Number(d)))selectedDistance=Number(d);
 document.querySelector(".overlay")?.remove();
 const root=document.createElement("div");root.className="overlay perf-overlay";root.id="perf-sheet";root.innerHTML=screen();document.querySelector(".app").append(root);root.scrollTop=0;
}
function tab(name){selectedView=name;refresh();}
function distance(d){if(DISTANCES.includes(Number(d))){selectedDistance=Number(d);refresh();}}
function refresh(){const el=document.getElementById("perf-sheet");if(el){el.innerHTML=screen();el.scrollTop=0;}}
function close(){document.getElementById("perf-sheet")?.remove();if(selectedActivityId)openActivity(selectedActivityId);else navigate("overview");}
async function enrich(){
 const missing=runList().filter(a=>!a.distanceTimeSeries?.length||!a.routeTimedPoints?.length).filter(a=>/^intervals:|^garmin:/.test(a.sourceKey||"")).slice(0,25);
 if(!missing.length){toast("无需补充可用的历史记录");return;}
 const el=document.getElementById("perf-sheet");
 if(el){const p=el.querySelector(".perf-note");if(p)p.textContent="正在按需补充历史时间序列，请勿关闭页面…";}
 let done=0;
 for(const original of missing){
  try{
   const copy={...original},id=String(original.sourceKey).split(":").slice(1).join(":");
   if(String(original.sourceKey).startsWith("intervals:"))await importIntervalsCandidate(copy,id);
   else if(String(original.sourceKey).startsWith("garmin:"))await importGarminCandidate(copy,id);
   for(const k of ["routeTimedPoints","distanceTimeSeries","routePoints","splits"]){
    if(Array.isArray(copy[k])&&copy[k].length&&(!Array.isArray(original[k])||!original[k].length))original[k]=copy[k];
   }
   await storeActivity(original);done++;
  }catch(e){console.warn("Performance historical enrichment",e);}
 }
 refresh();toast("已尝试补充 "+done+" 条历史记录");
}
function install(){
 const previousOverview=overview;
 overview=function(){return previousOverview()+perfOverview();};
 const previousActivityOverlay=activityOverlay;
 activityOverlay=function(){
  const html=previousActivityOverlay();
  const a=state.manual.find(x=>x.id===state.activityID);
  return a&&a.type==="run"?html.replace('<div class="metric-grid">',perfDetail(a)+'<div class="metric-grid">'):html;
 };
 const originalParseStreams=parseIntervalStreams;
 parseIntervalStreams=function(raw){
  const data=originalParseStreams(raw);
  const arr=Array.isArray(raw)?raw:Array.isArray(raw?.streams)?raw.streams:[];
  const get=name=>{const s=arr.find(x=>String(x.type||x.name||"").toLowerCase()===name);return Array.isArray(s?.data)?s.data:[];};
  const d=get("distance"),t=get("time"),out=[];
  for(let i=0;i<d.length;i++){const dist=number(d[i]),time=number(t[i]);if(Number.isFinite(dist)&&Number.isFinite(time))out.push([time,dist]);}
  if(out.length)data.distanceTimeSeries=out.length>5000?out.filter((_,i)=>i%Math.ceil(out.length/5000)===0||i===out.length-1):out;
  return data;
 };
 const oldHydrate=hydrate;
 hydrate=async function(){
  await oldHydrate();const alerts=makeAlerts();if(alerts.length){render();toast("发现 "+alerts.length+" 项跑步表现变化");}
 };
 if(typeof importSelectedActivities==="function"){
  const originalImport=importSelectedActivities;
  importSelectedActivities=async function(){
   const result=await originalImport();const alerts=makeAlerts();if(alerts.length)toast("发现 "+alerts.length+" 项跑步表现变化 · 查看总览");return result;
  };
 }
 if(typeof handleFileInput==="function"){
  const originalFileImport=handleFileInput;
  handleFileInput=async function(ev){
   const result=await originalFileImport(ev);const alerts=makeAlerts();if(alerts.length)toast("发现 "+alerts.length+" 项跑步表现变化");return result;
  };
 }
}
window.MOTIONPerformance={open,tab,distance,close,enrich,exactEffort,effort,results,matchesFor,overlap,normalizeDistance,makeAlerts,insightFor};
if(!window.__MOTION_PERF_TEST__)install();
})();