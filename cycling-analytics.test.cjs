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
 test(api.renderSplits({type:"cycle",sourceKey:"garmin:123"}).includes("补全 Garmin FIT 数据"),"legacy refresh button");
 return count;
})(api);console.log(count+' cycling assertions passed');
