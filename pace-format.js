// 1.4.4: display-only mm:ss/km line chart; original paceSeries remain seconds/km.
function motionPaceGraph(points){
  const pts=(points||[]).filter(p=>Array.isArray(p)&&Number.isFinite(Number(p[0]))&&Number.isFinite(Number(p[1]))&&p[1]>0&&p[1]<3600);
  if(pts.length<2)return '';
  const vals=pts.map(p=>Number(p[1]));
  const xlo=Number(pts[0][0]),xhi=Number(pts.at(-1)[0]);
  const lo=Math.min(...vals),hi=Math.max(...vals),spread=Math.max(8,hi-lo);
  const ylo=lo-spread*.12,yhi=hi+spread*.12,W=340,H=130,m=14;
  const xx=t=>m+((Number(t)-xlo)/(xhi-xlo||1))*(W-2*m);
  const yy=v=>H-m-((Number(v)-ylo)/(yhi-ylo||1))*(H-2*m);
  const d=pts.map((p,i)=>(i?'L':'M')+xx(p[0]).toFixed(1)+','+yy(p[1]).toFixed(1)).join(' ');
  const avg=vals.reduce((a,b)=>a+b,0)/vals.length;
  const pace=s=>{let n=Math.round(s);return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`};
  return `<div class="card p18 section metric-chart"><div class="micro">PACE · 配速</div><p class="chart-caption">平均 ${pace(avg)} /km · 范围 ${pace(lo)}–${pace(hi)} /km</p><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="真实跑步配速曲线，单位分秒每公里"><line x1="${m}" x2="${W-m}" y1="${H-m}" y2="${H-m}" stroke="#ead7e1"/><path d="${d}" fill="none" stroke="#c57741" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg><div class="chart-labels"><span>开始</span><span>约 ${Math.round((xhi-xlo)/60)} 分钟</span></div></div>`;
}
