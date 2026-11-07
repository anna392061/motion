/* MOTION startup: map libraries are loaded only when an activity route is opened.
   The built-in SVG remains visible during loading and if the CDN is unavailable. */
(function(){
  'use strict';
  const originalInitializeRouteMap=initializeRouteMap;
  let mapAssetsPromise=null;

  function appendAsset(tag,url,globalName){
    if(globalName && window[globalName])return Promise.resolve(true);
    return new Promise(resolve=>{
      const element=document.createElement(tag);
      let settled=false;
      const done=ok=>{
        if(settled)return;
        settled=true;
        clearTimeout(timeout);
        resolve(ok);
      };
      const timeout=setTimeout(()=>done(false),8500);
      element.onload=()=>done(true);
      element.onerror=()=>done(false);
      if(tag==='link'){
        element.rel='stylesheet';
        element.href=url;
      }else{
        element.src=url;
        element.async=true;
      }
      document.head.appendChild(element);
    });
  }

  function ensureMapAssets(){
    if(window.maplibregl && window.L)return Promise.resolve();
    if(!mapAssetsPromise){
      mapAssetsPromise=Promise.allSettled([
        appendAsset('link','https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.css'),
        appendAsset('link','https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'),
        appendAsset('script','https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js','maplibregl'),
        appendAsset('script','https://unpkg.com/leaflet@1.9.4/dist/leaflet.js','L')
      ]).then(()=>{
        if(!window.maplibregl && !window.L)console.warn('Map CDN unavailable; showing local route drawing');
      });
    }
    return mapAssetsPromise;
  }

  initializeRouteMap=function(){
    const canvas=document.getElementById('map-canvas');
    // Other overlays and routes without GPS points have nothing to load.
    if(!canvas)return originalInitializeRouteMap();
    const activityId=state.activityID;
    return ensureMapAssets().then(()=>{
      if(canvas.isConnected && document.getElementById('map-canvas')===canvas && state.activityID===activityId){
        return originalInitializeRouteMap();
      }
    });
  };
})();
