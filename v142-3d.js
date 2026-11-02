/* MOTION. anatomical viewer 1.4.3
 * Source mesh: Écorché, CC BY-SA 4.0 (see ATTRIBUTION_ANATOMY.md).
 * Bones retain original ivory vertex colours. Muscle vertex colours are remapped
 * into a warm cream/apricot palette, retaining their source lighting and tendon
 * gradients. No synthetic lines, strokes or fiber geometry are added.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
const URLS=[
 './models/ecorche.meshopt.glb',
 'https://cdn.jsdelivr.net/gh/Charleeh/ecorche@main/model/ecorche.meshopt.glb',
 'https://raw.githubusercontent.com/Charleeh/ecorche/main/model/ecorche.meshopt.glb'
];
const v={ready:false,busy:false,failed:false,renderer:null,camera:null,controls:null,scene:null,root:null,meshes:[],bones:[],muscles:[],grouped:new Map(),active:false,center:new THREE.Vector3(0,1,0),radius:2.6,host:null};
function textStatus(s){const x=document.querySelector('#atlas-load-state');if(x)x.textContent=s;const y=document.querySelector('#atlas-fallback .atlas-fallback-note');if(y)y.textContent=s}
function boot(){
 if(v.renderer)return;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,1,.008,50);
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.7));renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.45;
 scene.add(new THREE.HemisphereLight(0xffffff,0xc8ae99,2.5));
 const key=new THREE.DirectionalLight(0xfff7ed,2.2);key.position.set(-2,4,3);scene.add(key);
 const fill=new THREE.DirectionalLight(0xfbe7d7,1.2);fill.position.set(3,1,-2);scene.add(fill);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.07;controls.enablePan=false;controls.minPolarAngle=.13;controls.maxPolarAngle=Math.PI-.12;
 v.renderer=renderer;v.camera=camera;v.scene=scene;v.controls=controls;
 let down=null;
 renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,t:performance.now()}});
 renderer.domElement.addEventListener('pointerup',e=>{
   if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>7||performance.now()-down.t>480){down=null;return}
   down=null;if(!v.ready)return;
   const box=renderer.domElement.getBoundingClientRect();const mouse=new THREE.Vector2(((e.clientX-box.left)/box.width)*2-1,-((e.clientY-box.top)/box.height)*2+1);
   const ray=new THREE.Raycaster();ray.setFromCamera(mouse,camera);
   const targets=v.muscles.filter(m=>m.visible);
   const hit=ray.intersectObjects(targets,false)[0];if(!hit)return;
   const n=hit.object.userData.motionName;
   if(!n)return;
   const reg=atlasRegionFor(n);atlasState.region=reg;atlasState.name=n;atlasState.filter='';atlasUpdate(false);
 });
 let last=0;renderer.setAnimationLoop(ms=>{
   if(!v.active)return;
   if(ms-last<30)return;last=ms;
   controls.update();renderer.render(scene,camera)
 });
}
function objName(o){return String(o.userData?.name||o.parent?.userData?.name||o.name||'').replace(/_/g,' ')}
function regionOfObj(o){return atlasRegionFor(atlasCleanName(objName(o)))}
// Recolour original red muscle vertex colours, without replacing the mesh or its actual geometry.
// Read the original baked tone and pale tendon transitions; the mesh shape and surface
// details remain native to Écorché. Uses a per-geometry cache to avoid duplicating work.
const tintedGeometries=new WeakMap();
function tintMuscle(o){
 const original=o.geometry;
 if(!original)return;
 const cached=tintedGeometries.get(original);
 if(cached){o.geometry=cached;return}
 const colors=original.getAttribute('color');
 if(!colors)return; // Some third-party models provide only material colour.
 const geometry=original.clone();
 const buf=new Float32Array(colors.count*colors.itemSize);
 const cap=x=>Math.min(1,Math.max(0,x));
 const read=(v)=>v>1? v/255 : v;
 for(let i=0;i<colors.count;i++){
   const red=cap(read(colors.getX(i))), green=cap(read(colors.getY(i))), blue=cap(read(colors.getZ(i)));
   // Red-rich tissue -> peach/apricot; pale tendons -> soft ivory/cream.
   const tissue=cap((red-Math.max(green,blue)) / Math.max(.18,red*.82));
   const w=Math.pow(tissue,.72);
   const sourceLight=cap(red*.55+green*.32+blue*.13);
   const shade=.77+.25*sourceLight; // retain gentle native highlights and shadows
   const tendon=[.97,.92,.87], muscle=[.96,.74,.56];
   for(let k=0;k<3;k++)buf[i*colors.itemSize+k]=cap((tendon[k]*(1-w)+muscle[k]*w)*shade);
   if(colors.itemSize===4)buf[i*colors.itemSize+3]=read(colors.getW(i));
 }
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(buf,colors.itemSize));
 tintedGeometries.set(original,geometry);o.geometry=geometry;
}
function initGeometry(gltf){
 v.root=gltf.scene;v.meshes=[];v.bones=[];v.muscles=[];v.grouped.clear();
 gltf.scene.traverse(o=>{
   if(!o.isMesh)return;
   const layer=String(o.userData?.layer||o.parent?.userData?.layer||'').toLowerCase();
   const n=atlasCleanName(objName(o));o.userData.motionName=n;
   // Keep the ivory bone colours. Remap only muscle colours into MOTION.'s peach palette.
   if(layer.includes('muscle')){
     tintMuscle(o);
     o.userData.motionRegion=atlasRegionFor(n);o.userData.motionDeep=layer.includes('deep');
     v.muscles.push(o);
     let entry=v.grouped.get(n);if(!entry){entry={name:n,region:o.userData.motionRegion,deep:o.userData.motionDeep,count:0};v.grouped.set(n,entry)}
     entry.count++;
   } else if(layer==='skeleton'){v.bones.push(o)} else o.visible=false;
   v.meshes.push(o);
 });
 if(v.muscles.length<180)throw Error('模型未能读取完整肌肉图层');
 v.scene.add(v.root);v.root.updateMatrixWorld(true);v.ready=true;v.failed=false;v.busy=false;
 const items=Array.from(v.grouped.values()).sort((a,b)=>a.name.localeCompare(b.name));
 atlasLoadList(items);
 if(atlasState.region&&(!atlasState.name||!v.grouped.has(atlasState.name))){atlasState.name=items.find(x=>x.region===atlasState.region)?.name||''}
 updateScene(true);
}
async function getModel(u){
 const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);
 const ctl=new AbortController();const timeout=setTimeout(()=>ctl.abort(),24000);
 try{
   const response=await fetch(u,{signal:ctl.signal});if(!response.ok)throw Error('HTTP '+response.status);
   const buff=await response.arrayBuffer();
   return await new Promise((resolve,reject)=>loader.parse(buff,u.substring(0,u.lastIndexOf('/')+1),resolve,reject));
 }finally{clearTimeout(timeout)}
}
async function load(){
 if(v.ready||v.busy)return;v.busy=true;v.failed=false;
 textStatus('载入全身肌肉网格中，首次需要网络…');
 let err;
 for(let i=0;i<URLS.length;i++){
   try{const gltf=await getModel(URLS[i]);initGeometry(gltf);textStatus('已载入真实全身肌肉图谱');return}
   catch(e){err=e;console.info('3D source',i+1,'unavailable',e.message)}
 }
 v.busy=false;v.failed=true;textStatus('3D 模型暂时无法加载。请保持联网并点击重试。');
 const bar=document.getElementById('atlas-load-state');if(bar){bar.style.cursor='pointer';bar.title='点击重试';bar.onclick=()=>{bar.onclick=null;v.failed=false;load()}}
 console.warn('MOTION 3D all-body model unavailable',err);
}
function bboxFor(objects){const b=new THREE.Box3();for(const o of objects)b.expandByObject(o);return b}
function focus(selected=false){
 if(!v.ready)return;
 const r=atlasState.region,n=atlasState.name;
 const relevant=!r?v.muscles:r&&selected&&n?v.muscles.filter(m=>m.userData.motionName===n):v.muscles.filter(m=>m.userData.motionRegion===r);
 const bb=bboxFor(relevant.length?relevant:v.muscles),center=bb.getCenter(new THREE.Vector3()),size=bb.getSize(new THREE.Vector3());
 v.center.copy(center);const span=Math.max(.12,size.x,size.y,size.z);
 v.radius=Math.max(.45,span*2.1);
 const d=v.radius;
 // Source model faces +Z: looking from -Z shows the posterior side.
 v.camera.position.set(center.x+d*.19,center.y+d*.11,center.z-d);
 v.camera.near=.006;v.camera.far=70;v.camera.updateProjectionMatrix();
 v.controls.target.copy(center);v.controls.minDistance=Math.max(.14,d*.3);v.controls.maxDistance=Math.max(1.8,d*4);v.controls.update();
}
function updateScene(autoFocus=false){
 if(!v.ready)return;
 const reg=atlasState.region,name=atlasState.name;
 const bb=reg?bboxFor(v.muscles.filter(x=>x.userData.motionRegion===reg)):null;
 const center=bb&& !bb.isEmpty()?bb.getCenter(new THREE.Vector3()):new THREE.Vector3(0,.9,0);
 const size=bb&&!bb.isEmpty()?bb.getSize(new THREE.Vector3()).length():1.8;
 for(const m of v.muscles){
   if(!reg){m.visible=!m.userData.motionDeep}
   else if(name&&v.grouped.has(name)){m.visible=m.userData.motionName===name}
   else {m.visible=m.userData.motionRegion===reg&&!m.userData.motionDeep}
 }
 // Keep bones as a clean ivory reference. Hide distant bones in regional view.
 for(const b of v.bones){
   if(!reg){b.visible=true;continue}
   const c=new THREE.Box3().setFromObject(b).getCenter(new THREE.Vector3());b.visible=c.distanceTo(center)<Math.max(.26,Math.min(.62,size*.58))
 }
 if(autoFocus)focus(Boolean(reg&&name));
 const standin=document.querySelector('#atlas-fallback');if(standin)standin.style.display='none';
 textStatus(reg?`${atlasDisplayName(name)} · 拖动旋转 / 双指缩放`:`${v.grouped.size} 个肌肉名称 · 点击选择身体部位`);
}
function resize(){if(!v.renderer||!v.host)return;const w=Math.max(1,v.host.clientWidth),h=Math.max(1,v.host.clientHeight);v.renderer.setSize(w,h,false);v.camera.aspect=w/h;v.camera.updateProjectionMatrix()}
function attach(){
 const host=document.getElementById('motion-atlas-stage');
 if(!host){pause();return}
 try{boot()}catch(e){textStatus('无法启动 3D：'+e.message);return}
 if(v.renderer.domElement.parentNode!==host)host.append(v.renderer.domElement);
 v.host=host;v.active=true;host.classList.add('atlas-3d-on');resize();
 if(v.ready)updateScene(true);else if(!v.busy&&!v.failed)load();
 else if(v.failed)textStatus('模型暂不可用，点击下方提示重试');
}
function pause(){v.active=false}
function reset(){if(v.ready)focus(Boolean(atlasState.region&&atlasState.name))}
window.motionAtlas3D={attach,pause,reset,retry:()=>{v.failed=false;load()},status:()=>({ready:v.ready,meshCount:v.muscles.length,uniqueMuscles:v.grouped.size})};
if(state.nav==='strength'&&state.strengthTab==='anatomy')requestAnimationFrame(attach);
window.addEventListener('resize',resize,{passive:true});
