/* Run with: node cycling-analytics.test.cjs */
const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const api=vm.runInNewContext(fs.readFileSync(path.join(__dirname,'cycling-analytics.js'),'utf8'));
const count=(function runTests(api){
 const assert=(ok,msg)=>{if(!ok)throw Error(msg)};let count=0;const test=(ok,msg)=>{assert(ok,msg);count++};
 const near=(a,b)=>Math.abs(a-b)<1e-6;
 const raw={samples:Array.from({length:3601},(_,t)=>[t,10*t,10,100,80,120,20]),timer:3600,events:[{t:0,action:"start"},{t:3600,action:"stop"}]};
 for(const k of [5,10,20,30]){const r=api.analyze(raw,k);test(r.rows.length===Math.ceil(36/k),`count ${k}`);test(near(r.rows[0].speed,36),`speed ${k}`);test(near(r.rows.at(-1).end,36),`tail ${k}`)}
 const r=api.analyze(raw,5);test(near(r.overall.np,100),"constant NP");test(r.rows[0].np===null,"short NP");test(near(r.overall.power,100),"power");test(near(r.overall.cadence,80),"cadence");
 const pause={samples:Array.from({length:1301},(_,t)=>[t,(t<=600?t:t<700?600:t-100)*10,10,100,80,120,20]),timer:1200,events:[{t:0,action:"start"},{t:600,action:"stop"},{t:700,action:"start"},{t:1300,action:"stop"}]};
 const p=api.analyze(pause,10);test(p.reliableTimer&&near(p.overall.seconds,1200),"pause");test(near(p.overall.speed,36),"pause speed");
 const zero=api.analyze({...raw,samples:raw.samples.map(x=>[...x.slice(0,3),0,...x.slice(4)])},5);test(zero.overall.power===0&&zero.overall.np===0,"valid zero power");
 const missing=api.analyze({...raw,samples:raw.samples.map(x=>[...x.slice(0,3),null,...x.slice(4)])},5);test(missing.overall.power===null&&missing.overall.np===null,"missing not zero");
 const sparse=api.analyze({...raw,samples:raw.samples.filter((_,i)=>i%5===0)},5);test(sparse.overall.np===null,"no NP from sparse power");
 const unsure=api.analyze({...raw,timer:3400,events:[]},5);test(!unsure.reliableTimer&&unsure.overall.np===null,"unknown timer");
 const secs=[227,142,136,177,216,152,149,131,135,139,161,146,136,136,133,136,135,133,134];
 const legacy=api.legacy({distance:31.97,splits:secs.map((seconds,i)=>({km:i+1,distanceKm:1,seconds}))},5);
 test(legacy.partial,"partial screenshot");test(legacy.rows[0].seconds===898&&legacy.rows[1].seconds===706&&legacy.rows[2].seconds===712,"screenshot first 3 splits");
 test(api.eventAction("timer","stopAll")==="stop"&&api.eventAction(0,0)==="start","FIT event mapping");
 const full=api.legacy({distance:31.97,splits:Array.from({length:32},(_,i)=>({km:i+1,distanceKm:i===31?.97:1,seconds:144}))},5);
 test(full.rows.length===7&&near(full.rows.at(-1).end,31.97)&&!full.partial,"legacy final segment");
 test(api.renderSplits({type:"cycle",distance:31.97,splits:secs.map((seconds,i)=>({km:i+1,distanceKm:1,seconds}))}).includes("均速 km/h"),"render cycling speed unit");
 test(api.renderSplits({type:"cycle",sourceKey:"garmin:123"}).includes("正在准备原始数据更新"),"automatic migration status");
 const grade=api.gradeSeries({samples:Array.from({length:101},(_,t)=>[t,t*10,10,100,80,120,t*.5])});test(grade.length===10&&grade.every(p=>near(p[1],5)),"5 percent grade");
 
 const stop={samples:Array.from({length:1301},(_,t)=>[t,(t<=600?t:t<700?600:t-100)*10,t>=600&&t<700?0:10,t>=600&&t<700?999:100,80,120,20]),timer:1300,elapsed:1300,events:[{t:0,action:"start"},{t:1300,action:"stop"}]};
 const stationary=api.analyze(stop,5);test(near(stationary.overall.seconds,1200)&&near(stationary.overall.stopped,100),"stationary excluding stops");test(near(stationary.overall.power,100),"exclude stationary power");test(stationary.checks.time&&stationary.checks.distance,"stationary reconciliation");
 test(near(stationary.rows.reduce((s,r)=>s+r.seconds,0),stationary.overall.seconds),"sum moving");test(stationary.rows.every(r=>r.stopped===undefined)&&near(stationary.overall.stopped,100),"stops are activity-only");
 const absent={...pause,samples:pause.samples.filter(r=>r[0]<600||r[0]>=700)};const gap=api.analyze(absent,5);test(near(gap.overall.seconds,1200)&&near(gap.overall.stopped,100),"FIT gap with pause");test(near(gap.overall.speed,36),"distance across pause not diluted");test(gap.checks.time&&gap.checks.distance,"gap reconciliation");
 const sparseMoving=api.analyze({...raw,samples:raw.samples.filter(r=>r[0]<500||r[0]>550)},5);test(near(sparseMoving.overall.seconds,3600)&&sparseMoving.overall.estimated,"sparse moving gap with speed evidence");test(sparseMoving.rows.every(r=>near(r.speed,36)),"all split speeds retained with sufficient evidence");
 const smallUnknown=api.analyze({...raw,samples:raw.samples.filter(r=>r[0]!==100).map(r=>r[0]===101?[r[0],r[1],r[2],...r.slice(3)]:r)},20);test(smallUnknown.rows.every(r=>near(r.speed,36)),"minor sampling interval");
 const severe=api.analyze({...raw,samples:raw.samples.filter(r=>r[0]<300||r[0]>700).map(r=>[r[0],r[1],null,...r.slice(3)])},5);test(severe.rows[0].speed===null&&severe.rows[1].speed===null&&near(severe.rows[2].speed,36),"major ambiguous gaps suppressed locally");
 const drift={...pause,samples:pause.samples.map(r=>[r[0],r[1]+(r[0]>=700?30:r[0]>=600?(r[0]-600)*.3:0),...r.slice(2)])};const noPauseDistance=api.analyze(drift,5);test(near(noPauseDistance.overall.end,12)&&near(noPauseDistance.checks.excludedDistanceMeters,30),"distance accumulated during pause excluded");test(near(noPauseDistance.overall.seconds,1200),"pause distance never alters time");
 const mixed={...raw,samples:raw.samples.filter(r=>r[0]<1050||r[0]>1067||r[0]===1060)};const five=api.analyze(mixed,5),twenty=api.analyze(mixed,20);test(five.rows.every(r=>Number.isFinite(r.speed))&&twenty.rows.every(r=>Number.isFinite(r.speed)),"5 and 20 km tolerate sparse intervals");test(near(five.overall.seconds,twenty.overall.seconds)&&near(twenty.rows[0].seconds,five.rows.slice(0,4).reduce((s,r)=>s+r.seconds,0)),"same moving time across split choices");
 const html=api.renderSplits({type:"cycle",cyclingRaw:pause});test(!html.includes(">停留</th>"),"no pause column in split table");
 const smallAmbiguous=api.analyze({...raw,samples:raw.samples.filter(r=>r[0]<1100||r[0]>1135).map(r=>[r[0],r[1],null,...r.slice(3)])},20);test(smallAmbiguous.rows[0].estimated&&near(smallAmbiguous.rows[0].speed,36),"small uncertain portion yields labeled estimate");
 const coast=api.analyze({...raw,samples:raw.samples.map(r=>[...r.slice(0,3),r[0]<1800?100:0,r[0]<1800?80:0,...r.slice(5)])},5);test(near(coast.overall.power,50)&&near(coast.overall.cadence,80),"coasting included in power excluded in cadence");test(near(coast.overall.seconds,3600),"coasting is moving");
 const mismatch=api.analyze({...raw,distance:35000},5);test(mismatch.overall.speed===null&&!mismatch.checks.distanceMatchesSession,"session distance check");
 test(api.needsRefresh({type:"cycle",sourceKey:"garmin:12"})&&!api.needsRefresh({type:"run",sourceKey:"garmin:12"}),"cycling-only migration");
 test(!api.needsRefresh({type:"cycle",sourceKey:"garmin:12",cyclingRaw:{version:2,samples:[[0,0]]}}),"no repeat after migration");
 test(api.needsRefresh({type:"cycle",cyclingRaw:{version:1,fitBase64:"abc",samples:[[0,0]]}}),"local FIT migration");
 test(api.summaryFields({type:"cycle",cyclingRaw:stop,distance:12,power:999}).find(x=>x[0]==="平均功率")[1]==="100 W","summary uses segment calculation, not device avg");
 test(api.timeLabel(0)==="0:00","zero stop display");
 
 // Reproduce the screenshot's shape with synthetic distances, two sparse areas
 // and a 16:07 cafe stop. No real FIT measurements are assumed.
 const ride=[];let timestamp=0,meters=0;const events=[{t:0,action:"start"}];
 while(meters<31960){
  ride.push([timestamp,meters,7,90,80,130,25]);
  if(meters===28000){events.push({t:timestamp,action:"stop"});timestamp+=967;events.push({t:timestamp,action:"start"});ride.push([timestamp,meters,7,90,80,130,25]);}
  const step=Math.min(7,31960-meters);timestamp+=step/7;meters+=step;
 }
 ride.push([timestamp,meters,7,90,80,130,25]);events.push({t:timestamp,action:"stop"});
 // 28,000 is an exact multiple of 7; stop occurs once.
 const screen={samples:ride.filter(r=>!(r[1]>12000&&r[1]<12080)&&!(r[1]>22000&&r[1]<22085)),timer:timestamp-967,elapsed:timestamp,events,distance:31960};
 const screen5=api.analyze(screen,5),screen20=api.analyze(screen,20);test(screen5.rows.length===7&&screen20.rows.length===2,"31.96 km split shape");test(screen5.rows.every(r=>near(r.speed,25.2))&&screen20.rows.every(r=>near(r.speed,25.2)),"screenshot-shaped gaps no blank averages");test(near(screen5.overall.stopped,967)&&near(screen5.overall.seconds,timestamp-967),"16:07 only in overview");
 return count;
})(api);console.log(count+' cycling assertions passed');
