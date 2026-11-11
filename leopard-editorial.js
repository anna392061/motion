/* MOTION. Leopard Editorial · Design Specification v1.0
   Presentation-only layer: does not alter IndexedDB, sync, strength sets, backups or routes.
   Loaded last, after the existing modules and Performance enhancements. */
(function () {
  'use strict';
  var leColor={
    run:['#BF7659','#F4E4D8'],cycle:['#B5977D','#F0E7DE'],
    strength:['#805640','#EDDFD3'],tennis:['#9879B1','#EEE5F4']
  };
  Object.keys(leColor).forEach(function(t){
    if(typeof sport!=='undefined'&&sport[t]){
      sport[t].color=leColor[t][0];
      sport[t].back=leColor[t][1];
    }
  });
  var leShapes={
    run:'<circle cx="35" cy="11" r="4"/><path d="m27 25 8-6 8 6 7 2M35 19l-8 13 10 8m-10-8-9 4-7 11m26-7-5 11m-6-29-10-2-7 6"/>',
    cycle:'<circle cx="15" cy="43" r="10"/><circle cx="49" cy="43" r="10"/><path d="m15 43 12-20 10 20H15m22 0h12l-8-21h-7M23 23h10m7-4h9"/>',
    strength:'<rect x="13" y="20" width="9" height="24" rx="3"/><rect x="42" y="20" width="9" height="24" rx="3"/><path d="M22 30h20v4H22zM8 25v14m48-14v14"/>',
    tennis:'<ellipse cx="28" cy="23" rx="13" ry="17" transform="rotate(-29 28 23)"/><path d="m35 37 11 16m-7-15 7-6M19 15l19 16M15 26l24-10"/><circle cx="49" cy="15" r="5"/>'
  };
  sportIcon=function(type,size){
    var t=leShapes[type]?type:'run',s=Math.max(14,Math.min(44,Number(size)||24));
    return '<svg class="le-sport-svg le-icon-'+t+'" width="'+s+'" height="'+s+'" viewBox="0 0 64 64" fill="none" stroke="'+leColor[t][0]+'" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+leShapes[t]+'</svg>';
  };
  window.motionOpenActivityById=function(encoded){openActivity(decodeURIComponent(encoded));};
  window.motionOpenSport=function(type){
    if(type==='strength'){navigate('strength');return;}
    if(!leShapes[type])return;
    state.overlay=null;state.nav='sport-'+type;render();
    window.scrollTo({top:0,behavior:'instant'});
  };
  function leAction(label,action,extra){
    return '<button type="button" class="le-text-action '+(extra||'')+'" onclick="'+action+'">'+label+' <span aria-hidden="true">↗</span></button>';
  }
  function leActivity(a){
    var s=sport[a.type]||sport.run;
    var distanceText=(a.type==='run'||a.type==='cycle')&&Number(a.distance)>0
      ?Number(a.distance).toFixed(2)+' km · ':'';
    return '<button type="button" class="le-activity-row" onclick="motionOpenActivityById(\''+encodeURIComponent(String(a.id))+'\')">'
      +'<span class="le-activity-symbol">'+sportIcon(a.type,28)+'</span>'
      +'<span class="le-activity-copy"><strong>'+esc(a.title||s.zh)+'</strong><small>'+esc(fmtDate(a.date))+' · '+distanceText+esc(durationString(a.minutes))+'</small></span>'
      +'<span class="le-chevron" aria-hidden="true">›</span></button>';
  }
  function leRecentNotices(){
    var notices=[];
    try{var saved=JSON.parse(localStorage.getItem('motion_performance_v1_insights')||'[]');
      if(Array.isArray(saved))notices=saved.filter(function(n){return n&&activities().some(function(a){return a.id===n.id;});}).slice(0,1);
    }catch(err){}
    return notices.map(function(n){
      return '<button type="button" class="le-milestone card" onclick="MOTIONPerformance.open()">'
      +'<span class="le-kicker">✦ A LITTLE MILESTONE</span>'
      +'<strong>'+esc(n.title||'A new milestone.')+'</strong>'
      +'<small>'+esc(n.sub||'Explore your progress')+'</small></button>';
    }).join('');
  }
  function leHome(){
    var all=activities(),latest=all[0]||null,week=selectedWeek(new Date());
    var weekKm=distance(week,'run')+distance(week,'cycle');
    var weekMinutes=totalMinutes(week);
    var latestHtml=latest?
      '<button type="button" class="le-latest card" onclick="motionOpenActivityById(\''+encodeURIComponent(String(latest.id))+'\')">'
      +'<span class="le-leopard-corner" aria-hidden="true"></span>'
      +'<span class="le-kicker">RECENT ACTIVITY</span>'
      +'<span class="le-latest-name">'+esc(latest.title||sport[latest.type].zh)+'</span>'
      +'<span class="le-latest-meta">'+esc(fmtDate(latest.date))+' <b>·</b> '
      +(Number(latest.distance)>0?Number(latest.distance).toFixed(2)+' km <b>·</b> ':'')
      +esc(durationString(latest.minutes))+'</span><span class="le-arrow" aria-hidden="true">↗</span></button>'
      :'<div class="le-latest le-empty card"><span class="le-kicker">RECENT ACTIVITY</span><span class="le-latest-name">Your story starts here.</span><p>还没有运动记录。点击右上角同步，或导入运动文件。</p><button class="le-small-button" onclick="openSync()">Import activities ↗</button></div>';
    var hour=new Date().getHours(),greeting=hour<12?'Good Morning':hour<18?'Good Afternoon':'Good Evening';
    return '<div class="le-home">'
      +'<section class="le-hero" aria-label="Welcome to MOTION.">'
      +'<div class="le-hero-copy"><span class="le-greeting">'+greeting+' <span class="le-small-heart">♡</span></span>'
      +'<h1>Let’s Move.</h1><p>Every move counts.</p></div>'
      +'<div class="le-hero-print" aria-hidden="true"></div></section>'
      +'<section class="le-shortcuts" aria-label="Sports">'
      +Object.keys(sport).map(function(t){return '<button type="button" class="le-sport-entry" onclick="motionOpenSport(\''+t+'\')">'
        +sportIcon(t,37)+'<span>'+sport[t].en+'</span></button>';}).join('')
      +'</section>'
      +'<section class="le-home-section">'+latestHtml+'</section>'
      +'<section class="le-home-section"><div class="le-week card">'
      +'<div class="le-section-heading"><h2>This Week</h2><span class="le-week-note">'+week.length+' activities</span></div>'
      +'<div class="le-week-stats"><div><strong>'+week.length+'</strong><small>workouts</small></div>'
      +'<div><strong>'+weekKm.toFixed(1)+'</strong><small>km · run + ride</small></div>'
      +'<div><strong>'+durationString(weekMinutes)+'</strong><small>active time</small></div></div>'
      +'<div class="le-mini-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>'
      +'</div></section>'
      +leRecentNotices()
      +'<section class="le-footer-links">'
      +leAction('My Gear','gearOpen()')
      +leAction('Performance','MOTIONPerformance.open()')
      +leAction('Settings','openSettings()')
      +'</section></div>';
  }
  function leSportPage(t){
    var s=sport[t],list=activities().filter(function(a){return a.type===t;});
    var km=distance(list,t),mins=totalMinutes(list);
    return '<div class="le-secondary-page le-sport-page">'
      +'<button type="button" class="le-back" onclick="navigate(\'overview\')">‹ &nbsp; Home</button>'
      +'<div class="le-sport-heading">'+sportIcon(t,40)+'<div><span class="le-kicker">YOUR MOVEMENT</span><h1>'+esc(s.en)+'</h1></div></div>'
      +'<div class="le-summary-row"><div><span>ACTIVITIES</span><strong>'+list.length+'</strong></div>'
      +'<div><span>'+(t==='run'||t==='cycle'?'DISTANCE':'ACTIVE TIME')+'</span><strong>'+(t==='run'||t==='cycle'?km.toFixed(1)+' km':durationString(mins))+'</strong></div></div>'
      +'<div class="le-sport-tools">'
      +leAction('Sync','openSync()')
      +leAction('History','navigate(\'calendar\')')
      +(t==='run'?leAction('Performance','MOTIONPerformance.open()')+leAction('My Gear','gearOpen()'):'')
      +'</div><div class="le-section-heading"><h2>Recent '+esc(s.en)+'</h2><span>'+list.length+' records</span></div>'
      +(list.length?'<div class="le-records">'+list.slice(0,15).map(leActivity).join('')+'</div>'
       :'<div class="le-empty-panel card">暂无'+esc(s.zh)+'记录。可以手动同步或导入运动文件。</div>')
      +'</div>';
  }
  function leInsights(){
    var all=activities(),week=selectedWeek(new Date()),mins=totalMinutes(week);
    return '<div class="le-secondary-page le-insights">'
     +'<span class="le-kicker">YOUR MOVEMENT STORY</span><h1 class="le-editorial-title">My Progress.</h1>'
     +'<p class="le-intro">A clearer view of how you move.</p>'
     +'<div class="le-insights-summary card"><span class="le-kicker">THIS WEEK</span>'
     +'<div class="le-week-stats"><div><strong>'+week.length+'</strong><small>workouts</small></div>'
     +'<div><strong>'+activeDays(week)+'</strong><small>active days</small></div>'
     +'<div><strong>'+durationString(mins)+'</strong><small>total time</small></div></div></div>'
     +'<div class="le-section-heading"><h2>By Sport</h2><span>All time</span></div>'
     +'<div class="le-insight-sports">'
     +Object.keys(sport).map(function(t){var records=all.filter(function(a){return a.type===t;});return '<button class="le-insight-sport card" onclick="motionOpenSport(\''+t+'\')">'
       +sportIcon(t,27)+'<span>'+sport[t].en+'</span><strong>'+records.length+'</strong><small>sessions</small></button>';}).join('')
     +'</div>'
     +'<div class="le-performance-card card"><span class="le-kicker">PERFORMANCE</span>'
     +'<h2>Every effort has a story.</h2><p>相同路线、共同路段与 1 / 3 / 5 / 6 / 8 km 历史成绩。</p>'
     +'<button class="le-primary-btn" onclick="MOTIONPerformance.open()">Explore Performance ↗</button></div>'
     +leRecentNotices()
     +'<div class="le-footer-links">'+leAction('My Gear','gearOpen()')+leAction('Settings','openSettings()')+'</div>'
     +'</div>';
  }
  var leOldRender=render;
  overview=leHome;
  render=function(){
    var custom=state.nav==='insights'||String(state.nav).indexOf('sport-')===0;
    if(custom){
      document.querySelector('.overlay:not(#sync-sheet)')?.remove();
      var main=document.getElementById('main');
      if(main)main.innerHTML=state.nav==='insights'?leInsights():leSportPage(state.nav.slice(6));
      if(state.overlay)showOverlay();
    }else{leOldRender();}
    var active=state.nav==='calendar'?'calendar':state.nav==='insights'?'insights':'overview';
    document.querySelectorAll('.nav button').forEach(function(el){
      var isActive=el.id==='nav-'+active;
      el.classList.toggle('active',isActive);
      if(isActive)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');
    });
  };
  // Existing records, settings and workout data stay in their original stores.
  render();
})();