/* MOTION. Cream Solid · presentation-only update · 2026-11-11
   Reuse the original overview, week navigation, records and quick-entry handlers.
   Use the user's five approved PNG files directly. No redraw or image filters. */
(function () {
  'use strict';

  const approved = Object.freeze({
    run: './assets/icons/running.png',
    cycle: './assets/icons/cycling.png',
    strength: './assets/icons/strength.png',
    tennis: './assets/icons/tennis.png'
  });
  const tones = {
    run: {color: '#BF7659', back: '#F4E9DF'},
    cycle: {color: '#B5977D', back: '#F3EAE1'},
    strength: {color: '#805640', back: '#F0E4D9'},
    tennis: {color: '#9879B1', back: '#F1EAF5'}
  };
  for (const [name, values] of Object.entries(tones)) {
    if (sport[name]) Object.assign(sport[name], values);
  }

  const originalSportIcon = sportIcon;
  sportIcon = function (type, requestedSize = 19) {
    if (!Object.prototype.hasOwnProperty.call(approved, type)) {
      return originalSportIcon(type, requestedSize);
    }
    const px = Math.max(12, Math.min(72, Number(requestedSize) || 19));
    return '<img class="cs-approved-icon cs-icon-' + type + '"'
      + ' src="' + approved[type] + '" width="' + px + '" height="' + px + '"'
      + ' alt="" aria-hidden="true" draggable="false" decoding="async">';
  };

  const originalOverview = overview;
  overview = function () {
    // The legacy function computes all statistics and generates the live
    // week controls, gear/sync buttons, and activity records. Retain those.
    const oldMarkup = originalOverview();
    const temp = document.createElement('template');
    temp.innerHTML = oldMarkup;
    const root = temp.content;
    const quick = root.querySelector('.overview-quick');
    const sections = Array.from(root.children).filter(el => el.matches('section.section'));
    const week = sections[0], distribution = sections[1], recent = sections[2], notice = sections[3];
    if (!quick || !week || !distribution || !recent || !notice) return oldMarkup;
    const weekControls = week.querySelector('.section-row');
    const hero = week.querySelector('.hero.card');
    const sportGrid = distribution.querySelector('.sport-grid');
    const trend = distribution.querySelector('.trend-row');
    if (!weekControls || !hero || !sportGrid || !trend) return oldMarkup;

    // Hide the old static example bars; the distribution below reflects live data.
    hero.querySelector('.mini-bars')?.remove();

    const sportStrip = ['run', 'cycle', 'strength', 'tennis'].map(type => {
      const s = sport[type];
      return '<div class="cs-sport-sign" aria-label="' + s.zh + '">'
        + sportIcon(type, 48) + '<span>' + s.en + '</span></div>';
    }).join('');

    return '<div class="cs-home">'
      + '<section class="cs-sports" aria-label="四种运动">' + sportStrip + '</section>'
      + '<section class="cs-quick" aria-label="快捷入口">' + quick.outerHTML + '</section>'
      + '<section class="cs-week-section" aria-labelledby="cs-week-title">'
      + '<div class="cs-heading"><span class="cs-eyebrow">YOUR MOVEMENT</span>'
      + '<h1 id="cs-week-title">运动总览</h1></div>'
      + '<div class="cs-week-surface card">'
      + weekControls.outerHTML
      + hero.outerHTML
      + '<div class="cs-distribution"><div class="cs-distribution-header">'
      + '<h2>运动分布</h2><span>4 SPORTS</span></div>'
      + trend.outerHTML + sportGrid.outerHTML
      + '</div></div></section>'
      + '<section class="cs-recent">' + recent.innerHTML + '</section>'
      + '<section class="cs-notice">' + notice.innerHTML + '</section>'
      + '</div>';
  };

  // Do not override navigate(), render(), activityCard(), openSync(),
  // gearOpen(), strength(), calendar(), or any data/save/sync functions.
  if (typeof render === 'function') render();
})();
