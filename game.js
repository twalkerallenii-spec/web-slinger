/* Web-Slinger — a Three.js Spider-Man-style web-swinging sandbox.
   Original art. Not affiliated with / not a copy of Marvel or Insomniac's Spider-Man.
   The city is a stylised, geographically-grounded MANHATTAN (real island shape, avenue/street
   grid, Central Park at 59th-110th, Hudson/East rivers, Financial District + Midtown clusters).
   Libraries: three.js (r128), simplex-noise (procedural texture detail). */
(function(){
'use strict';
if (!window.THREE) { const l=document.getElementById('loading'); if(l) l.textContent='Failed to load Three.js (need internet).'; return; }
const T = THREE;
const Simplex = (window.SimplexNoise ? new window.SimplexNoise('web-slinger') : null);
function snoise(x,y){ return Simplex ? Simplex.noise2D(x,y) : (Math.sin(x*12.9898+y*78.233)*43758.5453 % 1); }
const m4 = new T.Matrix4();

/* ============================ CORE SETUP ============================ */
const canvas = document.getElementById('c');
const renderer = new T.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.outputEncoding = T.sRGBEncoding;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;

const scene = new T.Scene();
scene.background = new T.Color(0xc3d3e2);
scene.fog = new T.Fog(0xd0d3ce, 720, 3100);

const camera = new T.PerspectiveCamera(64, innerWidth/innerHeight, 0.5, 5000);
camera.position.set(0, 180, 40);

/* Bloom post-processing (graceful fallback to plain render if the passes didn't load) */
let composer = null, bloomPass = null;
try{
  if(T.EffectComposer && T.RenderPass && T.UnrealBloomPass){
    composer = new T.EffectComposer(renderer);
    composer.addPass(new T.RenderPass(scene, camera));
    bloomPass = new T.UnrealBloomPass(new T.Vector2(innerWidth*0.5, innerHeight*0.5), 0.75, 0.8, 0.72);
    composer.addPass(bloomPass);
    composer.setSize(innerWidth, innerHeight);
  }
}catch(e){ composer = null; }

addEventListener('resize', ()=>{
  camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if(composer) composer.setSize(innerWidth, innerHeight);
});

/* ============================ LIGHTING ============================ */
scene.add(new T.HemisphereLight(0xbfd4ee, 0x8a7a5c, 0.9));
scene.add(new T.AmbientLight(0x9fb0c4, 0.32));
const sun = new T.DirectionalLight(0xffe6bf, 1.5); sun.position.set(-400, 320, -260); scene.add(sun);
const rim = new T.DirectionalLight(0x9fc4ff, 0.4); rim.position.set(380, 220, 320); scene.add(rim);

/* Real texture loader (SBS CC0 packs, served locally). Async: procedural/color stays if a file is missing. */
const TL = new T.TextureLoader();
function rtex(url, rx, ry){ const t = TL.load(url, undefined, undefined, ()=>{}); t.wrapS=t.wrapT=T.RepeatWrapping; if(rx) t.repeat.set(rx, ry||rx); t.anisotropy=4; return t; }

/* ============================ SKY DOME ============================ */
(function sky(){
  const cv = document.createElement('canvas'); cv.width = 16; cv.height = 256;
  const g = cv.getContext('2d');
  const grd = g.createLinearGradient(0,0,0,256);
  grd.addColorStop(0.0,'#4f86c6'); grd.addColorStop(0.4,'#88b0d8'); grd.addColorStop(0.62,'#cdd8e0');
  grd.addColorStop(0.8,'#ffe3b0'); grd.addColorStop(0.92,'#ffc07a'); grd.addColorStop(1.0,'#ff9a5a');
  g.fillStyle = grd; g.fillRect(0,0,16,256);
  g.fillStyle = 'rgba(255,255,255,.9)';
  for(let i=0;i<40;i++){ g.fillRect(Math.random()*16, Math.random()*90, 1, 1); }
  const tex = new T.CanvasTexture(cv); tex.magFilter = T.LinearFilter;
  scene.add(new T.Mesh(new T.SphereGeometry(3000, 24, 16),
    new T.MeshBasicMaterial({ map:tex, side:T.BackSide, fog:false, depthWrite:false })));
  const sc = document.createElement('canvas'); sc.width = sc.height = 128;
  const sg = sc.getContext('2d');
  const rg = sg.createRadialGradient(64,64,0,64,64,64);
  rg.addColorStop(0,'rgba(255,240,200,1)'); rg.addColorStop(.3,'rgba(255,180,110,.85)'); rg.addColorStop(1,'rgba(255,120,70,0)');
  sg.fillStyle = rg; sg.fillRect(0,0,128,128);
  const spr = new T.Sprite(new T.SpriteMaterial({ map:new T.CanvasTexture(sc), transparent:true, depthWrite:false, fog:false }));
  spr.scale.set(800,800,1); spr.position.set(-1700, 420, -2100); scene.add(spr);
})();

/* ============================ BUILDING TEXTURES (archetype window grids) ============================ */
function clampB(v){ return v<0?0:v>255?255:v; }
function makeWindowTex(o){
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 256; const g = cv.getContext('2d');
  const b = o.base; g.fillStyle = `rgb(${b[0]},${b[1]},${b[2]})`; g.fillRect(0,0,128,256);
  const img = g.getImageData(0,0,128,256), d = img.data;
  for(let y=0;y<256;y++) for(let x=0;x<128;x++){
    const n = snoise(x*0.06 + o.seed*9, y*0.06)*o.grime + snoise(x*0.5, y*0.01 + o.seed)*o.streak;
    const s = n|0; const i = (y*128+x)*4;
    d[i]=clampB(d[i]+s); d[i+1]=clampB(d[i+1]+s); d[i+2]=clampB(d[i+2]+s);
  }
  g.putImageData(img,0,0);
  const cols=o.cols, rows=o.rows, mw=128/cols, mh=256/rows, pad=o.pad;
  for(let y=0;y<rows;y++) for(let x=0;x<cols;x++){
    const lit = ((x*7+y*13+o.seed*5) % 10) < o.litProb;
    let col;
    if(lit){ col = ((x+y+o.seed)%o.warmMod)===0 ? o.warm : o.cool; } else col = o.dark;
    g.fillStyle = col; g.fillRect(x*mw+pad, y*mh+pad, mw-pad*2, mh-pad*2);
    g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(x*mw+pad, y*mh+pad, mw-pad*2, 1.5);   // sill glint
  }
  const t = new T.CanvasTexture(cv); t.wrapS=t.wrapT=T.RepeatWrapping; t.anisotropy=2; return t;
}
const TEXPOOL = {
  glass:[ makeWindowTex({base:[20,30,44],cool:'rgba(120,180,235,.95)',warm:'rgba(185,218,255,.9)',dark:'rgba(13,21,36,1)',litProb:6,warmMod:4,cols:7,rows:16,pad:1.5,seed:1,grime:6,streak:8}),
          makeWindowTex({base:[16,34,40],cool:'rgba(110,205,215,.95)',warm:'rgba(165,232,240,.9)',dark:'rgba(10,24,28,1)',litProb:6,warmMod:5,cols:7,rows:15,pad:1.5,seed:2,grime:6,streak:8}) ],
  office:[ makeWindowTex({base:[40,44,56],cool:'rgba(160,205,255,.92)',warm:'rgba(255,220,150,.9)',dark:'rgba(15,19,29,1)',litProb:5,warmMod:3,cols:6,rows:13,pad:2,seed:3,grime:9,streak:12}),
           makeWindowTex({base:[34,36,46],cool:'rgba(150,195,240,.9)',warm:'rgba(255,210,140,.9)',dark:'rgba(13,16,25,1)',litProb:5,warmMod:3,cols:6,rows:14,pad:2,seed:4,grime:9,streak:12}) ],
  brick:[ makeWindowTex({base:[86,52,42],cool:'rgba(255,205,140,.95)',warm:'rgba(255,182,112,.95)',dark:'rgba(30,18,16,1)',litProb:5,warmMod:2,cols:5,rows:12,pad:2.5,seed:5,grime:12,streak:6}),
          makeWindowTex({base:[70,44,40],cool:'rgba(255,200,150,.95)',warm:'rgba(255,172,122,.95)',dark:'rgba(26,16,14,1)',litProb:5,warmMod:2,cols:5,rows:11,pad:2.5,seed:6,grime:12,streak:6}) ],
  deco:[ makeWindowTex({base:[74,66,52],cool:'rgba(255,225,170,.9)',warm:'rgba(255,205,150,.9)',dark:'rgba(28,24,18,1)',litProb:5,warmMod:2,cols:6,rows:14,pad:2,seed:7,grime:10,streak:8}) ],
};

/* ============================ MANHATTAN ISLAND (real proportions) ============================ */
/* Long axis = Z. South tip (Battery / Financial District) = -Z, North (Inwood) = +Z.
   Half-width table samples the real island silhouette: widest near "14th St", tapering to the tips. */
const ISLE = [[-980,64],[-840,116],[-620,158],[-360,172],[-40,152],[220,140],[460,132],[680,104],[840,74],[980,50]];
const ZMIN = ISLE[0][0], ZMAX = ISLE[ISLE.length-1][0];
function islandHalfW(z){
  if(z<=ZMIN || z>=ZMAX) return 0;
  for(let i=0;i<ISLE.length-1;i++){ const a=ISLE[i], b=ISLE[i+1];
    if(z>=a[0]&&z<=b[0]){ const t=(z-a[0])/(b[0]-a[0]); return a[1]+(b[1]-a[1])*t; } }
  return 0;
}
function inIsland(x,z){ return Math.abs(x) < islandHalfW(z); }
// Central Park: 59th-110th St — a long, narrow rectangle (~5:1, real proportions), centre-west
const PARK = { x0:-48, x1:48, z0:110, z1:600 };
function inPark(x,z){ return x>PARK.x0 && x<PARK.x1 && z>PARK.z0 && z<PARK.z1; }
const PARK_CX = (PARK.x0+PARK.x1)/2;

/* WATER (Hudson + East rivers + harbour) */
(function water(){
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  const img = g.createImageData(256,256), d = img.data;
  for(let y=0;y<256;y++) for(let x=0;x<256;x++){
    const n = snoise(x*0.08,y*0.08)*0.5 + snoise(x*0.3,y*0.3)*0.25 + 0.5;
    const i=(y*256+x)*4;
    d[i]= 10+n*20; d[i+1]= 30+n*40; d[i+2]= 60+n*70; d[i+3]=255;
  }
  g.putImageData(img,0,0);
  const tex = new T.CanvasTexture(cv); tex.wrapS=tex.wrapT=T.RepeatWrapping; tex.repeat.set(40,40);
  const mat = new T.MeshStandardMaterial({ map:tex, color:0x24507a, roughness:0.35, metalness:0.4 });
  const geo = new T.PlaneGeometry(6000,6000); geo.rotateX(-Math.PI/2);
  const m = new T.Mesh(geo, mat); m.position.y = -0.4; scene.add(m);
  window.__water = tex;
})();

/* ============================ CITY GENERATION ============================ */
/* Dusk-sky reflection probe for glass buildings */
let ENV = null;
(function(){ try{
  const rt = new T.WebGLCubeRenderTarget(128, { generateMipmaps:true, minFilter:T.LinearMipmapLinearFilter });
  const cc = new T.CubeCamera(1, 5000, rt); cc.position.set(0, 240, 0); cc.update(renderer, scene); ENV = rt.texture;
}catch(e){} })();

/* per-frame ambient animators (traffic, sky life, blinking lights) */
const cityTicks = [];
window.__cityAnimate = function(dt){ for(let i=0;i<cityTicks.length;i++) cityTicks[i](dt); };

const buildings = [];
const boxGeo = new T.BoxGeometry(1,1,1); boxGeo.translate(0, 0.5, 0);
const spireMat = new T.MeshStandardMaterial({ color:0x2b2140, roughness:.6, metalness:.3, emissive:0x140a20 });
function box(x,y,z,w,h,d,mat){ const m=new T.Mesh(boxGeo,mat); m.position.set(x,y,z); m.scale.set(w,h,d); scene.add(m); return m; }
function makeBuildingMat(arch, t){
  if(arch==='glass') return new T.MeshStandardMaterial({ map:t, emissiveMap:t, emissive:0x2a4a66, emissiveIntensity:0.14, color:0x35586e, metalness:0.9, roughness:0.12, envMap:ENV, envMapIntensity:1.3 });
  if(arch==='brick') return new T.MeshStandardMaterial({ map:t, emissiveMap:t, emissive:0x1a1410, emissiveIntensity:0.06, color:0x9a6a50, roughness:0.95, metalness:0.02 });
  if(arch==='deco')  return new T.MeshStandardMaterial({ map:t, emissiveMap:t, emissive:0x1e1a14, emissiveIntensity:0.06, color:0xb2a78e, roughness:0.7, metalness:0.1, envMap:ENV, envMapIntensity:0.3 });
  return new T.MeshStandardMaterial({ map:t, emissiveMap:t, emissive:0x223344, emissiveIntensity:0.10, color:0x8a94a2, roughness:0.5, metalness:0.35, envMap:ENV, envMapIntensity:0.65 });
}
const tankPos=[], acPos=[], antPos=[], neonList=[];
// kept for the World Builder (a handful of blocks — clone cost is negligible there)
function pickTex(arch,x,z){ const pool=TEXPOOL[arch]; return pool[(Math.abs((x*5+z*3))|0)%pool.length].clone(); }

/* Shared per-archetype materials (a few colour/texture variants) — no per-building clones,
   so the whole city uses ~12 materials instead of hundreds. This is the big load-time win. */
Object.keys(TEXPOOL).forEach(a=>TEXPOOL[a].forEach(t=>{ t.wrapS=t.wrapT=T.RepeatWrapping; t.repeat.set(1,1); }));
const MATS = {};
['glass','office','brick','deco'].forEach(arch=>{
  const list=[];
  TEXPOOL[arch].forEach(t=>{ list.push(makeBuildingMat(arch,t));
    const m2=makeBuildingMat(arch,t); m2.color.offsetHSL(0,0,(arch==='brick')?-0.06:0.06); list.push(m2); });
  MATS[arch]=list;
});
function matFor(arch,x,z){ const l=MATS[arch]; return l[(Math.abs((x*7+z*13))|0)%l.length]; }

/* Upgrade non-glass facades with real SBS material textures + a window overlay (async, guarded).
   Glass stays procedural so it reads as a glass tower. If a file is missing, procedural map stays. */
(function upgradeFacades(){
  const bases = { brick:['textures/brick1.jpg','textures/brick2.jpg'], office:['textures/plaster.jpg'], deco:['textures/stone.jpg'] };
  const cfg = { brick:{cols:4,rows:8,on:'#20242e',off:'#3a2f22'}, office:{cols:5,rows:9,on:'#26303e',off:'#767b84'}, deco:{cols:5,rows:10,on:'#2a2620',off:'#a89a7c'} };
  Object.keys(bases).forEach(arch=>{
    bases[arch].forEach((url,vi)=>{
      const im = new Image();
      im.onload = ()=>{ try{
        const S=256, cv=document.createElement('canvas'); cv.width=cv.height=S; const g=cv.getContext('2d');
        for(let ty=0;ty<2;ty++) for(let tx=0;tx<2;tx++) g.drawImage(im, tx*(S/2), ty*(S/2), S/2, S/2);   // tile the material
        const c=cfg[arch], mw=S/c.cols, mh=S/c.rows, px=mw*0.16, py=mh*0.16;
        for(let y=0;y<c.rows;y++) for(let x=0;x<c.cols;x++){
          const lit=((x*7+y*13+vi*5)%10)<5; g.globalAlpha= lit?0.9:0.6; g.fillStyle= lit?c.on:c.off;
          g.fillRect(x*mw+px, y*mh+py, mw-px*2, mh-py*2); g.globalAlpha=1;
          g.strokeStyle='rgba(0,0,0,.3)'; g.lineWidth=1; g.strokeRect(x*mw+px, y*mh+py, mw-px*2, mh-py*2);
        }
        const tex=new T.CanvasTexture(cv); tex.wrapS=tex.wrapT=T.RepeatWrapping; tex.anisotropy=4;
        const list=MATS[arch]||[]; const targets = bases[arch].length===1 ? list : (list[vi]?[list[vi]]:[]);
        targets.forEach(m=>{ m.map=tex; m.emissiveMap=tex; m.emissiveIntensity=0.05; m.color.setHex(0xffffff); m.needsUpdate=true; });
      }catch(e){} };
      im.onerror=()=>{}; im.src=url;
    });
  });
})();

/* Box geometry with window UVs baked to world scale → correct window size with a shared material. */
function makeBuildingGeo(w,d,h,cell){
  const g=new T.BoxGeometry(w,h,d); g.translate(0,h/2,0);
  const a=g.attributes.uv.array, su=d/cell, su2=w/cell, sv=h/cell;
  for(let i=0;i<4;i++){ a[i*2]*=su;  a[i*2+1]*=sv; }     // +X face (width = depth)
  for(let i=4;i<8;i++){ a[i*2]*=su;  a[i*2+1]*=sv; }     // -X face
  for(let i=16;i<20;i++){ a[i*2]*=su2; a[i*2+1]*=sv; }   // +Z face (width = w)
  for(let i=20;i<24;i++){ a[i*2]*=su2; a[i*2+1]*=sv; }   // -Z face
  g.attributes.uv.needsUpdate=true; return g;
}
function bbox(x,base,z,w,d,h,mat,cell){ const m=new T.Mesh(makeBuildingGeo(w,d,h,cell),mat); m.position.set(x,base,z); scene.add(m); return m; }

function addBuilding(x,z,w,d,h,arch){
  const mat=matFor(arch,x,z), cell=(arch==='brick')?6:8;
  if(arch==='deco' && h>150){                                   // art-deco ziggurat setbacks
    const h1=h*0.56, h2=h*0.28, h3=h*0.16;
    bbox(x,0,z,w,d,h1,mat,cell); bbox(x,h1,z,w*0.72,d*0.72,h2,mat,cell); bbox(x,h1+h2,z,w*0.5,d*0.5,h3,mat,cell);
    const cr=new T.Mesh(new T.ConeGeometry(Math.min(w,d)*0.22,28,6),spireMat); cr.position.set(x,h,z); scene.add(cr);
    antPos.push({x,z,y:h+14,hh:16});
  } else if((arch==='glass'||arch==='office') && h>170){         // modern upper setback
    const h1=h*0.82; bbox(x,0,z,w,d,h1,mat,cell); bbox(x,h1,z,w*0.82,d*0.82,h-h1,mat,cell);
    if(h>250) antPos.push({x,z,y:h,hh:26});
  } else { bbox(x,0,z,w,d,h,mat,cell); if(h>70 && Math.random()<0.3) bbox(x,h,z,w*0.5,d*0.5,6+Math.random()*10,mat,cell); }
  if((arch==='brick'||arch==='office') && Math.random()<0.7) tankPos.push({x:x+(Math.random()-.5)*w*.3, z:z+(Math.random()-.5)*d*.3, y:h});
  acPos.push({x:x+(Math.random()-.5)*w*.4, z:z+(Math.random()-.5)*d*.4, y:h});
  if(Math.random()<0.4) acPos.push({x:x+(Math.random()-.5)*w*.4, z:z+(Math.random()-.5)*d*.4, y:h});
  if(h>150 && z>-170 && z<200 && Math.random()<0.4) neonList.push({x,z,y:22+Math.random()*(h-46),w,d});
  buildings.push({ x, z, w, d, h });
}
function buildingAt(x, z){ for(const b of buildings){ if(x>b.x-b.w/2 && x<b.x+b.w/2 && z>b.z-b.d/2 && z<b.z+b.d/2) return b; } return null; }
function heightFor(x,z){ const r=Math.random();
  if(z < -620) return 210 + r*250;                        // Financial District super-talls
  if(z > -180 && z < 210) return 150 + r*220;             // Midtown cluster
  if(z > PARK.z1-60 && Math.abs(x)<210) return 46 + r*54; // Upper-side lower-rise
  return 62 + r*120 + (r<0.1 ? 150 : 0); }                // denser mid/high rise
function districtArch(x,z,h){
  if(h>175){ const r=Math.random(); return r<0.34?'deco':(r<0.7?'glass':'office'); }   // varied super-talls
  if(h>110){ const r=Math.random(); return r<0.4?'office':(r<0.72?'glass':'deco'); }
  if(h<85) return Math.random()<0.72?'brick':'office';
  return Math.random()<0.55?'office':'brick'; }

/* Avenues run N-S (wide spacing X); cross-streets E-W (short spacing Z). */
const AVX = 64, CSZ = 50, STREET = 14;
const streetPos = [], parkPos = [], treePos = [], lampPos = [];
for(let x = -224; x <= 224; x += AVX){
  for(let z = ZMIN; z <= ZMAX; z += CSZ){
    const bx = x + AVX/2, bz = z + CSZ/2;
    if(inIsland(x,z) && ((Math.round(x/AVX)+Math.round(z/CSZ))%2===0)) lampPos.push({x,z});
    if(!inIsland(bx,bz)) continue;
    if(inPark(bx,bz)){ parkPos.push({x:bx,z:bz}); continue; }
    streetPos.push({x:bx,z:bz});
    const bw=AVX-STREET, bd=CSZ-STREET, h=heightFor(bx,bz);
    addBuilding(bx,bz,bw,bd,h, districtArch(bx,bz,h));
  }
}

/* ---- STREETS: dark road grid (base) + light sidewalk blocks w/ crosswalks ---- */
(function streets(){
  const baseGeo = new T.BoxGeometry(AVX, 0.4, CSZ);
  const baseMat = new T.MeshStandardMaterial({ map:rtex('textures/tile.jpg',1,1), color:0x54555e, roughness:.55, metalness:.2, envMap:ENV, envMapIntensity:.3 });
  const swCv=document.createElement('canvas'); swCv.width=swCv.height=64; const sg=swCv.getContext('2d');
  sg.fillStyle='#3a3a44'; sg.fillRect(0,0,64,64);
  const si=sg.getImageData(0,0,64,64), sd=si.data;
  for(let i=0;i<sd.length;i+=4){ const n=(snoise(i*0.02,i*0.013)*14)|0; sd[i]=clampB(sd[i]+n); sd[i+1]=clampB(sd[i+1]+n); sd[i+2]=clampB(sd[i+2]+n); }
  sg.putImageData(si,0,0);
  sg.fillStyle='rgba(230,230,235,.8)';
  for(let k=0;k<7;k++){ sg.fillRect(4+k*8,1,4,6); sg.fillRect(4+k*8,57,4,6); sg.fillRect(1,4+k*8,6,4); sg.fillRect(57,4+k*8,6,4); }
  const swTex=new T.CanvasTexture(swCv);
  const swGeo = new T.BoxGeometry(AVX-14, 0.6, CSZ-12);
  const swMat = new T.MeshStandardMaterial({ map:swTex, color:0x9a9aa6, roughness:.62, metalness:.2, envMap:ENV, envMapIntensity:.28 });
  const rb = new T.InstancedMesh(baseGeo, baseMat, streetPos.length);
  streetPos.forEach((p,i)=>{ m4.makeTranslation(p.x,0.15,p.z); rb.setMatrixAt(i,m4); }); rb.instanceMatrix.needsUpdate=true; scene.add(rb);
  const sw = new T.InstancedMesh(swGeo, swMat, streetPos.length);
  streetPos.forEach((p,i)=>{ m4.makeTranslation(p.x,0.42,p.z); sw.setMatrixAt(i,m4); }); sw.instanceMatrix.needsUpdate=true; scene.add(sw);
})();

/* ---- CENTRAL PARK: grass, Reservoir, Pond, Great Lawn, trees, paths ---- */
const RES = { x:PARK_CX, z:430, rx:40, rz:78 };      // the Reservoir (north)
const POND= { x:PARK_CX-6, z:168, rx:24, rz:30 };     // the Pond (south)
function inEll(e,x,z){ const dx=(x-e.x)/e.rx, dz=(z-e.z)/e.rz; return dx*dx+dz*dz < 1; }
function inParkWater(x,z){ return inEll(RES,x,z)||inEll(POND,x,z); }
(function park(){
  if(!parkPos.length) return;
  const gGeo=new T.BoxGeometry(AVX, 0.6, CSZ);
  const gMat=new T.MeshStandardMaterial({ map:rtex('textures/grass.jpg',3,3), color:0xdfeecb, roughness:1, metalness:0 });
  const grass=new T.InstancedMesh(gGeo,gMat,parkPos.length);
  parkPos.forEach((p,i)=>{ m4.makeTranslation(p.x,0.32,p.z); grass.setMatrixAt(i,m4); }); grass.instanceMatrix.needsUpdate=true; scene.add(grass);
  const waterMat=new T.MeshStandardMaterial({ color:0x2a6a8a, roughness:.22, metalness:.55, envMap:ENV, envMapIntensity:.6 });
  [RES,POND].forEach(e=>{ const m=new T.Mesh(new T.CircleGeometry(1,28), waterMat); m.rotation.x=-Math.PI/2; m.scale.set(e.rx,e.rz,1); m.position.set(e.x,0.55,e.z); scene.add(m); });
  // Great Lawn (lighter grass oval)
  const lawn=new T.Mesh(new T.CircleGeometry(1,26), new T.MeshStandardMaterial({ color:0x3a8a44, roughness:1 }));
  lawn.rotation.x=-Math.PI/2; lawn.scale.set(34,52,1); lawn.position.set(PARK_CX+2,0.5,300); scene.add(lawn);
  // main path down the park
  const pathMat=new T.MeshStandardMaterial({ color:0x6a5a44, roughness:1 });
  box(PARK_CX, 0.5, (PARK.z0+PARK.z1)/2, 6, 0.4, PARK.z1-PARK.z0-20, pathMat);
  box(PARK_CX, 0.5, 250, PARK.x1-PARK.x0-14, 0.4, 6, pathMat);
  box(PARK_CX, 0.5, 500, PARK.x1-PARK.x0-14, 0.4, 6, pathMat);
  // trees (avoid water)
  const tp=[];
  for(let i=0;i<220;i++){ const x=PARK.x0+2+Math.random()*(PARK.x1-PARK.x0-4), z=PARK.z0+4+Math.random()*(PARK.z1-PARK.z0-8);
    if(inParkWater(x,z)||Math.abs(x-PARK_CX)<4) continue; tp.push({x,z}); }
  const fGeo=new T.ConeGeometry(4.2,11,6), fMat=new T.MeshStandardMaterial({color:0x2c7a3a,roughness:.9});
  const tGeo=new T.CylinderGeometry(0.7,0.9,5,5), tMat=new T.MeshStandardMaterial({color:0x4a2f1e,roughness:1});
  const fol=new T.InstancedMesh(fGeo,fMat,tp.length), trk=new T.InstancedMesh(tGeo,tMat,tp.length);
  tp.forEach((p,i)=>{ m4.makeTranslation(p.x,9,p.z); fol.setMatrixAt(i,m4); m4.makeTranslation(p.x,2.5,p.z); trk.setMatrixAt(i,m4); });
  fol.instanceMatrix.needsUpdate=true; trk.instanceMatrix.needsUpdate=true; scene.add(fol); scene.add(trk);
})();

/* ---- ROOFTOP PROPS: water towers, AC units, antennas ---- */
(function rooftops(){
  if(tankPos.length){
    const baseG=new T.BoxGeometry(7,1.5,7); baseG.translate(0,0.75,0);
    const tankG=new T.CylinderGeometry(3,3,7,10); tankG.translate(0,3.5,0);
    const roofG=new T.ConeGeometry(3.7,3,10); roofG.translate(0,1.5,0);
    const bM=new T.MeshStandardMaterial({color:0x2a2230,roughness:.9}); const wM=new T.MeshStandardMaterial({map:rtex('textures/wood.jpg',1,2),color:0xffffff,roughness:.9}); const rM=new T.MeshStandardMaterial({map:rtex('textures/roof.jpg'),color:0xffffff,roughness:.9});
    const B=new T.InstancedMesh(baseG,bM,tankPos.length), Tk=new T.InstancedMesh(tankG,wM,tankPos.length), Rf=new T.InstancedMesh(roofG,rM,tankPos.length);
    tankPos.forEach((p,i)=>{ m4.makeTranslation(p.x,p.y,p.z); B.setMatrixAt(i,m4); m4.makeTranslation(p.x,p.y+1.5,p.z); Tk.setMatrixAt(i,m4); m4.makeTranslation(p.x,p.y+8.5,p.z); Rf.setMatrixAt(i,m4); });
    [B,Tk,Rf].forEach(m=>{ m.instanceMatrix.needsUpdate=true; scene.add(m); });
  }
  if(acPos.length){
    const g=new T.BoxGeometry(1,1,1); g.translate(0,0.5,0); const mm=new T.MeshStandardMaterial({map:rtex('textures/metal.jpg'),color:0xdfe3e8,roughness:.6,metalness:.5});
    const im=new T.InstancedMesh(g,mm,acPos.length);
    acPos.forEach((p,i)=>{ const s=3+Math.random()*3; m4.makeScale(s,2+Math.random()*2,s); m4.setPosition(p.x,p.y,p.z); im.setMatrixAt(i,m4); });
    im.instanceMatrix.needsUpdate=true; scene.add(im);
  }
  if(antPos.length){
    const g=new T.CylinderGeometry(0.4,0.7,10,5); g.translate(0,5,0); const mm=spireMat;
    const im=new T.InstancedMesh(g,mm,antPos.length);
    antPos.forEach((p,i)=>{ m4.makeScale(1,p.hh/10,1); m4.setPosition(p.x,p.y,p.z); im.setMatrixAt(i,m4); });
    im.instanceMatrix.needsUpdate=true; scene.add(im);
  }
})();

/* ---- STREETLIGHTS (emissive lamps read as glow at dusk) ---- */
(function lights(){
  if(!lampPos.length) return;
  const poleG=new T.CylinderGeometry(0.35,0.5,13,6); poleG.translate(0,6.5,0);
  const poleM=new T.MeshStandardMaterial({color:0x20202a,roughness:.8});
  const lampG=new T.BoxGeometry(1.8,0.8,1.8); lampG.translate(0,0,0);
  const lampM=new T.MeshStandardMaterial({color:0xffe6b0,emissive:0xffdca0,emissiveIntensity:1.3,roughness:.4});
  const P=new T.InstancedMesh(poleG,poleM,lampPos.length), L=new T.InstancedMesh(lampG,lampM,lampPos.length);
  lampPos.forEach((p,i)=>{ m4.makeTranslation(p.x,0,p.z); P.setMatrixAt(i,m4); m4.makeTranslation(p.x,13,p.z); L.setMatrixAt(i,m4); });
  P.instanceMatrix.needsUpdate=true; L.instanceMatrix.needsUpdate=true; scene.add(P); scene.add(L);
})();

/* ---- NEON BILLBOARDS (abstract, Midtown) ---- */
(function neon(){
  function neonTex(seed){ const cv=document.createElement('canvas'); cv.width=128; cv.height=64; const g=cv.getContext('2d');
    g.fillStyle='#08060e'; g.fillRect(0,0,128,64);
    const cols=['#ff2d7e','#28e0ff','#ffd23f','#7cff5a','#c56bff','#ff7a3d'];
    for(let i=0;i<4;i++){ g.fillStyle=cols[(seed+i)%cols.length]; g.globalAlpha=.9;
      g.fillRect(8, 8+i*13, 30+((seed*7+i*11)%80), 8); }
    g.globalAlpha=1; return new T.CanvasTexture(cv); }
  neonList.slice(0,16).forEach((n,i)=>{
    const tex=neonTex(i); const w=Math.min(n.w*0.8,26), h=w*0.5;
    const m=new T.Mesh(new T.PlaneGeometry(w,h), new T.MeshBasicMaterial({map:tex, toneMapped:false}));
    const face=(i%2===0)?1:-1; m.position.set(n.x, n.y, n.z + face*(n.d/2+0.6)); if(face<0) m.rotation.y=Math.PI; scene.add(m);
    const side=(i%3===0);
    if(side){ m.rotation.y=Math.PI/2; m.position.set(n.x + (n.w/2+0.6)*((i%2)?1:-1), n.y, n.z); }
  });
})();

/* ---- TRAFFIC (animated, on the avenues) ---- */
let updateTraffic=null;
(function traffic(){
  const laneX=[-128,-72,72,128]; const CARN=40;
  const g=new T.BoxGeometry(4.4,2.2,9); const mm=new T.MeshStandardMaterial({roughness:.5,metalness:.4});
  const cars=new T.InstancedMesh(g,mm,CARN); const carData=[];
  const palette=[0xff4030,0xffffff,0x2a3a6a,0xf0d040,0x303030,0xc03030,0x40c0d0];
  for(let i=0;i<CARN;i++){ const lane=laneX[i%laneX.length]; const dir=(i%2)?1:-1;
    carData.push({ x:lane+(dir>0?-3:3), z:-540+Math.random()*1080, v:dir*(34+Math.random()*30), dir });
    cars.setColorAt(i, new T.Color(palette[i%palette.length])); }
  cars.instanceColor.needsUpdate=true; scene.add(cars);
  updateTraffic=function(dt){ for(let i=0;i<CARN;i++){ const c=carData[i]; c.z+=c.v*dt;
    if(c.z>558){ c.z=-558; } else if(c.z<-558){ c.z=558; }
    m4.makeTranslation(c.x,1.7,c.z); cars.setMatrixAt(i,m4); } cars.instanceMatrix.needsUpdate=true; };
  cityTicks.push(updateTraffic);
})();

/* ---- SUSPENSION BRIDGE over the East River ---- */
(function bridge(){
  const z0=-360, hw=islandHalfW(z0);
  const deckM=new T.MeshStandardMaterial({color:0x3a3540,roughness:.8,metalness:.2});
  const towerM=new T.MeshStandardMaterial({color:0x7a3a34,roughness:.7,metalness:.2});
  const x0=hw+6, x1=760, cx=(x0+x1)/2, len=x1-x0;
  box(cx, 40, z0, len, 2, 24, deckM);
  const t1x=x0+len*0.28, t2x=x0+len*0.72;
  [t1x,t2x].forEach(tx=>{ box(tx,0,z0-9,10,120,10,towerM); box(tx,0,z0+9,10,120,10,towerM); box(tx,116,z0,26,6,26,towerM); });
  const cableM=new T.MeshStandardMaterial({color:0x9aa0b0,roughness:.5,metalness:.6});
  [-9,9].forEach(zc=>{ const pts=[new T.Vector3(x0,44,z0+zc),new T.Vector3(t1x,116,z0+zc),new T.Vector3(cx,64,z0+zc),new T.Vector3(t2x,116,z0+zc),new T.Vector3(x1,46,z0+zc)];
    const curve=new T.CatmullRomCurve3(pts); const tube=new T.Mesh(new T.TubeGeometry(curve,40,0.7,6,false),cableM); scene.add(tube); });
})();

/* ---- DISTANT SKYLINE (silhouette depth beyond the water) ---- */
(function distant(){
  const g=new T.BoxGeometry(1,1,1); g.translate(0,0.5,0);
  const mm=new T.MeshStandardMaterial({color:0x140f22,roughness:1,metalness:0});
  const n=170, im=new T.InstancedMesh(g,mm,n);
  for(let i=0;i<n;i++){ const a=(i/n)*Math.PI*2 + (i%4)*0.13; const rad=1300+((i*89)%1000);
    const x=Math.cos(a)*rad, z=Math.sin(a)*rad*1.25, w=40+((i*53)%90), h=50+((i*97)%280);
    m4.makeScale(w,h,w); m4.setPosition(x,0,z); im.setMatrixAt(i,m4); }
  im.instanceMatrix.needsUpdate=true; scene.add(im);
})();

/* ---- SKY LIFE: moon, blimp, patrol helicopter, bird flock, blinking aviation lights ---- */
(function skylife(){
  // moon (opposite the sun; bloom makes it glow)
  const moon=new T.Mesh(new T.SphereGeometry(58,20,16), new T.MeshBasicMaterial({color:0xfff2dc, fog:false}));
  moon.position.set(1500,860,1650); scene.add(moon);

  // blimp drifting a slow high circle
  const blimp=new T.Group();
  const bBody=new T.Mesh(new T.SphereGeometry(18,18,12), new T.MeshStandardMaterial({color:0xd0d6e0,roughness:.55,metalness:.2,emissive:0x20242e,emissiveIntensity:.4}));
  bBody.scale.set(2.6,1,1); blimp.add(bBody);
  const finM=new T.MeshStandardMaterial({color:0xff3b62,emissive:0xff3b62,emissiveIntensity:.7});
  const fin=new T.Mesh(new T.BoxGeometry(9,9,1),finM); fin.position.x=-42; blimp.add(fin);
  const adCv=document.createElement('canvas'); adCv.width=128; adCv.height=48; const ag=adCv.getContext('2d');
  ag.fillStyle='#0a0810'; ag.fillRect(0,0,128,48);
  ['#28e0ff','#ffd23f','#ff2d7e'].forEach((c,i)=>{ ag.fillStyle=c; ag.fillRect(10,8+i*12,20+i*30,7); });
  const ad=new T.Mesh(new T.PlaneGeometry(40,15), new T.MeshBasicMaterial({map:new T.CanvasTexture(adCv), toneMapped:false}));
  ad.position.set(0,0,18.2); blimp.add(ad);
  scene.add(blimp);

  // helicopter patrol with spinning rotor + searchlight
  const heli=new T.Group(); const dkM=new T.MeshStandardMaterial({color:0x1c1c24,roughness:.5,metalness:.5});
  const hBody=new T.Mesh(new T.SphereGeometry(4,12,10),dkM); hBody.scale.set(1.7,1,1); heli.add(hBody);
  const tail=new T.Mesh(new T.BoxGeometry(11,1.1,1.1),dkM); tail.position.x=-8; heli.add(tail);
  const rotor=new T.Mesh(new T.BoxGeometry(34,0.3,1.4),dkM); rotor.position.y=3.4; heli.add(rotor);
  const trotor=new T.Mesh(new T.BoxGeometry(1,6,0.3),dkM); trotor.position.set(-13,1,0); heli.add(trotor);
  const spot=new T.Mesh(new T.ConeGeometry(7,26,14,1,true), new T.MeshBasicMaterial({color:0xfff6c0,transparent:true,opacity:.12,side:T.DoubleSide,fog:false,depthWrite:false}));
  spot.position.y=-13; heli.add(spot);
  const hRed=new T.Mesh(new T.SphereGeometry(0.7,6,6), new T.MeshBasicMaterial({color:0xff2020,fog:false})); hRed.position.set(7,-1.5,0); heli.add(hRed);
  scene.add(heli);

  // bird flock (instanced, flapping)
  const birdGeo=new T.ConeGeometry(1.3,0.4,3); birdGeo.rotateX(Math.PI/2);
  const birds=new T.InstancedMesh(birdGeo, new T.MeshBasicMaterial({color:0x0e0e16}), 30);
  scene.add(birds);
  const bd=[]; for(let i=0;i<30;i++) bd.push({a:Math.random()*6.28, r:50+Math.random()*40, y:130+Math.random()*70, ph:Math.random()*6.28});

  // blinking red aviation lights on the tallest antennas
  let redMat=null, redMesh=null; const talls=antPos.filter(p=>p.hh>=20);
  if(talls.length){ redMat=new T.MeshBasicMaterial({color:0xff1414,fog:false,transparent:true});
    redMesh=new T.InstancedMesh(new T.SphereGeometry(1.2,6,6),redMat,talls.length);
    talls.forEach((p,i)=>{ m4.makeTranslation(p.x,p.y+p.hh+2,p.z); redMesh.setMatrixAt(i,m4); });
    redMesh.instanceMatrix.needsUpdate=true; scene.add(redMesh); }

  let t=0;
  cityTicks.push(function(dt){ t+=dt;
    blimp.position.set(Math.cos(t*0.028)*560, 380+Math.sin(t*0.05)*18, Math.sin(t*0.028)*560);
    blimp.rotation.y = -t*0.028;
    heli.position.set(Math.cos(-t*0.11+2)*320, 155+Math.sin(t*0.22)*8, Math.sin(-t*0.11+2)*320);
    heli.rotation.y = (t*0.11) - 2; rotor.rotation.y += dt*44; trotor.rotation.x += dt*44;
    for(let i=0;i<30;i++){ const b=bd[i]; b.a+=dt*0.45; const x=Math.cos(b.a)*b.r-120, z=Math.sin(b.a)*b.r-180;
      const fl=1+Math.sin(t*9+b.ph)*0.5; m4.makeScale(1,1,fl); m4.setPosition(x,b.y+Math.sin(t*2+b.ph)*3,z); birds.setMatrixAt(i,m4); }
    birds.instanceMatrix.needsUpdate=true;
    if(redMat) redMat.opacity = (Math.sin(t*3.4)>0)?1:0.12;
  });
})();

const STREET_Y = 0.7;
const WORLD_BX = 320, WORLD_BZ = 1080;

/* ============================ PLAYER MODEL ============================ */
const suitRed  = new T.MeshStandardMaterial({ color:0xd21f3c, roughness:.5, metalness:.15 });
const suitBlue = new T.MeshStandardMaterial({ color:0x1e3a8a, roughness:.5, metalness:.2 });
const suitDark = new T.MeshStandardMaterial({ color:0x0b1220, roughness:.6 });
const eyeMat   = new T.MeshStandardMaterial({ color:0xffffff, emissive:0xffffff, emissiveIntensity:.9, roughness:.3 });
const hero = new T.Group();
function limbGeo(r,len){ const g=new T.CylinderGeometry(r*0.75,r,len,8); g.translate(0,-len/2,0); return g; }
const torso = new T.Mesh(new T.CylinderGeometry(1.05,0.85,3.1,10), suitRed); hero.add(torso);
const chest = new T.Mesh(new T.SphereGeometry(1.15,12,10), suitRed); chest.scale.set(1,0.7,0.7); chest.position.y=1.1; hero.add(chest);
const pelvis = new T.Mesh(new T.SphereGeometry(1.0,12,10), suitBlue); pelvis.scale.set(1,0.7,0.8); pelvis.position.y=-1.4; hero.add(pelvis);
const emblem = new T.Mesh(new T.SphereGeometry(0.42,8,8), suitDark); emblem.scale.set(1,1.5,0.4); emblem.position.set(0,0.9,0.95); hero.add(emblem);
const head = new T.Mesh(new T.SphereGeometry(0.72,14,12), suitRed); head.position.y=2.35; hero.add(head);
const eyeL = new T.Mesh(new T.SphereGeometry(0.26,10,8), eyeMat); eyeL.scale.set(1.4,0.9,0.4); eyeL.position.set(-0.28,2.42,0.55); hero.add(eyeL);
const eyeR = eyeL.clone(); eyeR.position.x=0.28; hero.add(eyeR);

/* four swappable suits (keys 1-4 or T to cycle) */
const SUITS = [
  { name:'Classic', red:0xd21f3c, blue:0x1e3a8a, eye:0xffffff },
  { name:'Noir',    red:0x171717, blue:0x2c2c34, eye:0xf0f0f0 },
  { name:'Crimson', red:0xb00020, blue:0x141018, eye:0xff3b3b },
  { name:'Cyber',   red:0x0b1a3a, blue:0x00d0ff, eye:0x00ffe0 },
];
let curSuit = 0;
function swapSuit(i){ if(i<0||i>=SUITS.length||i===curSuit) return; curSuit=i; const s=SUITS[i];
  suitRed.color.setHex(s.red); suitBlue.color.setHex(s.blue); eyeMat.emissive.setHex(s.eye);
  const su=document.getElementById('suit'); if(su) su.textContent=s.name; toast('Suit: '+s.name); }
function makeLimb(mat,r,len){ const grp=new T.Group(); grp.add(new T.Mesh(limbGeo(r,len),mat));
  const hand=new T.Mesh(new T.SphereGeometry(r*0.9,8,8),suitDark); hand.position.y=-len; grp.add(hand); return grp; }
const armL = makeLimb(suitRed,0.32,2.6); armL.position.set(-1.05,1.2,0); hero.add(armL);
const armR = makeLimb(suitRed,0.32,2.6); armR.position.set(1.05,1.2,0); hero.add(armR);
const legL = makeLimb(suitBlue,0.38,3.0); legL.position.set(-0.5,-1.9,0); hero.add(legL);
const legR = makeLimb(suitBlue,0.38,3.0); legR.position.set(0.5,-1.9,0); hero.add(legR);
scene.add(hero);

const webMat = new T.LineBasicMaterial({ color:0xffffff, transparent:true, opacity:0.9 });
const webGeo = new T.BufferGeometry(); webGeo.setAttribute('position', new T.BufferAttribute(new Float32Array(6),3));
const webLine = new T.Line(webGeo, webMat); webLine.visible=false; scene.add(webLine);
const zipMat = new T.LineBasicMaterial({ color:0x9fe0ff, transparent:true, opacity:0.85 });
const zipGeo = new T.BufferGeometry(); zipGeo.setAttribute('position', new T.BufferAttribute(new Float32Array(6),3));
const zipLine = new T.Line(zipGeo, zipMat); zipLine.visible=false; scene.add(zipLine);

/* ============================ COLLECTIBLES ============================ */
const tokens = [];
const tokenGeo = new T.OctahedronGeometry(1.6,0);
const tokenMat = new T.MeshStandardMaterial({ color:0x24d3ff, emissive:0x24d3ff, emissiveIntensity:1.1, roughness:.2, metalness:.4 });
function spawnTokens(n){ for(let i=0;i<n;i++){ const b=buildings[(Math.random()*buildings.length)|0];
  const m=new T.Mesh(tokenGeo,tokenMat); m.position.set(b.x+(Math.random()-.5)*40, 18+Math.random()*Math.max(30,b.h), b.z+(Math.random()-.5)*40);
  scene.add(m); tokens.push(m); } }
spawnTokens(55);
document.getElementById('toktot').textContent = tokens.length;

/* ============================ ENEMIES + CRIME OBJECTIVE ============================ */
const enemies = [];
const enemyBody = new T.MeshStandardMaterial({ color:0x394b2a, roughness:.8 });
const enemyHead = new T.MeshStandardMaterial({ color:0xc79b78, roughness:.7 });
function makeEnemy(x,z,crime){
  const g = new T.Group();
  const body = new T.Mesh(new T.CylinderGeometry(0.9,1.1,3.4,8), enemyBody); body.position.y=1.7; g.add(body);
  const h = new T.Mesh(new T.SphereGeometry(0.7,10,8), enemyHead); h.position.y=3.8; g.add(h);
  g.position.set(x,STREET_Y,z);
  g.userData = { alive:true, wanderT:Math.random()*10, dir:Math.random()*Math.PI*2, crime:!!crime };
  scene.add(g); enemies.push(g); return g;
}
function randStreet(){ return streetPos[(Math.random()*streetPos.length)|0]; }
for(let i=0;i<10;i++){ const s=randStreet(); makeEnemy(s.x+(Math.random()-.5)*20, s.z+(Math.random()-.5)*20, false); }

let crime = null, crimeCooldown = 0;
const beaconMat = new T.MeshBasicMaterial({ color:0xff3355, transparent:true, opacity:0.5, fog:false });
function newCrime(){
  const s = randStreet();
  const es = [];
  for(let i=0;i<3;i++) es.push(makeEnemy(s.x+(Math.random()-.5)*22, s.z+(Math.random()-.5)*22, true));
  const beacon = new T.Mesh(new T.CylinderGeometry(4,4,600,10,1,true), beaconMat);
  beacon.position.set(s.x, 300, s.z); scene.add(beacon);
  crime = { pos:new T.Vector3(s.x,STREET_Y,s.z), es, beacon, total:3 };
  toast('🚨 Crime in progress — follow the red beacon');
}

/* ============================ AUDIO (WebAudio synth, no asset files) ============================ */
const SFX = { ctx:null, master:null, windGain:null };
function initAudio(){
  if(SFX.ctx) return;
  try{
    const AC = window.AudioContext || window.webkitAudioContext; SFX.ctx = new AC();
    SFX.master = SFX.ctx.createGain(); SFX.master.gain.value = 0.5; SFX.master.connect(SFX.ctx.destination);
    // continuous wind driven by speed
    const buf = SFX.ctx.createBuffer(1, SFX.ctx.sampleRate*2, SFX.ctx.sampleRate);
    const dd = buf.getChannelData(0); for(let i=0;i<dd.length;i++) dd[i]=Math.random()*2-1;
    const src = SFX.ctx.createBufferSource(); src.buffer=buf; src.loop=true;
    const lp = SFX.ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=600;
    SFX.windGain = SFX.ctx.createGain(); SFX.windGain.gain.value=0;
    src.connect(lp); lp.connect(SFX.windGain); SFX.windGain.connect(SFX.master); src.start();
  }catch(e){}
}
function noiseBurst(dur, freq, gain, type){
  if(!SFX.ctx) return; const c=SFX.ctx, t=c.currentTime;
  const len = Math.max(1, (c.sampleRate*dur)|0);
  const buf = c.createBuffer(1,len,c.sampleRate); const d=buf.getChannelData(0);
  for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*(1-i/len);
  const src=c.createBufferSource(); src.buffer=buf;
  const f=c.createBiquadFilter(); f.type=type||'bandpass'; f.frequency.value=freq||1200; f.Q.value=1.2;
  const g=c.createGain(); g.gain.value=gain||0.3;
  src.connect(f); f.connect(g); g.connect(SFX.master); src.start(t); src.stop(t+dur);
}
function blip(f0,f1,dur,gain,type){
  if(!SFX.ctx) return; const c=SFX.ctx, t=c.currentTime;
  const o=c.createOscillator(); o.type=type||'sine'; o.frequency.setValueAtTime(f0,t); o.frequency.exponentialRampToValueAtTime(Math.max(1,f1),t+dur);
  const g=c.createGain(); g.gain.setValueAtTime(gain||0.2,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur);
  o.connect(g); g.connect(SFX.master); o.start(t); o.stop(t+dur);
}
const sndThwip = ()=>{ noiseBurst(0.06,2200,0.25); blip(900,1500,0.08,0.15,'square'); };
const sndWhoosh= ()=>{ noiseBurst(0.25,700,0.22,'bandpass'); };
const sndChime = ()=>{ blip(880,1320,0.12,0.2); setTimeout(()=>blip(1320,1760,0.14,0.16),70); };
const sndHit   = ()=>{ noiseBurst(0.08,300,0.4,'lowpass'); blip(200,60,0.12,0.3,'square'); };
const sndThud  = ()=>{ noiseBurst(0.12,180,0.5,'lowpass'); blip(120,40,0.18,0.4,'sine'); };

/* ============================ INPUT ============================ */
const keys = {};
addEventListener('keydown', e=>{ const k=e.key.toLowerCase(); keys[k]=true;
  if(k===' ') e.preventDefault();
  if(k==='h'){ const h=document.getElementById('help'); h.style.display = h.style.display==='none'?'block':'none'; }
  if(k==='r'){ respawn(); }
  if(k==='q'){ webStrike(); }
  if(k==='g'){ heavyKick(); }
  if(k==='t'){ swapSuit((curSuit+1)%SUITS.length); }
  if(k>='1'&&k<='4'){ swapSuit((+k)-1); } });
addEventListener('keyup', e=>{ keys[e.key.toLowerCase()]=false; });
let mouseDownL=false, mouseDownR=false, yaw=0, pitch=0.15, pointerLocked=false;
canvas.addEventListener('mousedown', e=>{ if(!started) return; if(!window.__editing && !pointerLocked) canvas.requestPointerLock();
  if(e.button===0) mouseDownL=true; if(e.button===2) mouseDownR=true; });
addEventListener('mouseup', e=>{ if(e.button===0) mouseDownL=false; if(e.button===2) mouseDownR=false; });
addEventListener('contextmenu', e=> e.preventDefault());
document.addEventListener('pointerlockchange', ()=>{ pointerLocked = document.pointerLockElement===canvas;
  document.getElementById('crosshair').classList.toggle('lock', pointerLocked); });
let mouseSens = 0.0026;
addEventListener('mousemove', e=>{ if(!pointerLocked) return; yaw-=e.movementX*mouseSens; pitch-=e.movementY*mouseSens*0.9;
  pitch=Math.max(-0.9,Math.min(1.1,pitch)); });
function swingHeld(){ return keys[' ']||mouseDownL; }
function zipHeld(){ return keys['shift']||mouseDownR; }

/* ============================ PLAYER STATE ============================ */
const player = { pos:new T.Vector3(), vel:new T.Vector3(), state:'air', anchor:new T.Vector3(), ropeLen:0,
  swingHand:1, wallNormal:new T.Vector3(), facing:new T.Vector3(0,0,-1),
  hp:100, web:100, score:0, tokens:0, kos:0, combo:0, comboT:0, attackT:0, invuln:0, airTime:0 };
const R = 2.2;
function respawn(){
  let best=buildings[0];
  for(const b of buildings){ if(b.h>best.h && b.z>-620 && b.z<220) best=b; }
  player.pos.set(best.x, best.h+8, best.z); player.vel.set(0,0,-2);
  player.state='air'; player.hp=100; player.web=100; player.combo=0;
  toast('Dropped into Manhattan — hold SPACE to swing');
}

/* ============================ HELPERS ============================ */
const _v=new T.Vector3(), _v2=new T.Vector3(), _v3=new T.Vector3();
function camForwardFlat(){ return _v.set(-Math.sin(yaw),0,-Math.cos(yaw)).normalize(); }
function camRightFlat(){ return _v2.set(Math.cos(yaw),0,-Math.sin(yaw)).normalize(); }
function findAnchor(preferHigh){
  const fwd = camForwardFlat().clone();
  const hv = _v3.set(player.vel.x,0,player.vel.z);
  if(hv.length()>8){ fwd.lerp(hv.normalize(),0.55).normalize(); }
  let best=null, bestScore=-1e9; const maxRope=180;
  for(const b of buildings){
    const ax=Math.max(b.x-b.w/2,Math.min(b.x+b.w/2, player.pos.x+fwd.x*20));
    const az=Math.max(b.z-b.d/2,Math.min(b.z+b.d/2, player.pos.z+fwd.z*20));
    const ay=b.h; if(ay<player.pos.y+6) continue;
    const dx=ax-player.pos.x, dy=ay-player.pos.y, dz=az-player.pos.z;
    const dist=Math.hypot(dx,dy,dz); if(dist<14||dist>maxRope) continue;
    const ahead=(dx*fwd.x+dz*fwd.z)/(Math.hypot(dx,dz)||1); if(ahead<-0.4) continue;
    const score=ahead*40 + (preferHigh?dy*1.2:dy*0.5) - Math.abs(dist-78)*0.32;
    if(score>bestScore){ bestScore=score; best={x:ax,y:ay,z:az,dist}; }
  }
  return best;
}

/* ============================ TOASTS / COMBO ============================ */
function toast(msg){ const box=document.getElementById('toast');
  const el=document.createElement('div'); el.className='toastmsg'; el.textContent=msg; box.appendChild(el);
  setTimeout(()=>{ el.style.transition='opacity .4s'; el.style.opacity='0'; setTimeout(()=>el.remove(),420); },1600);
  while(box.children.length>3) box.removeChild(box.firstChild); }
const comboEl = document.getElementById('combo');
function bumpCombo(pts,label){ player.combo++; player.comboT=2.2; player.score+=pts*Math.max(1,player.combo);
  comboEl.textContent=(label||'STYLE')+'  x'+player.combo; comboEl.style.opacity='1'; }

/* ============================ SWING / MOVEMENT ============================ */
function startSwing(allowVirtual){ let a=findAnchor(false);
  if(!a){ if(allowVirtual===false) return false;            // mid-air: never dead-fail — anchor a virtual skyhook ahead
    const f=camForwardFlat(); a={ x:player.pos.x+f.x*40, y:player.pos.y+74, z:player.pos.z+f.z*40, dist:Math.hypot(40,74) }; }
  player.anchor.set(a.x,a.y,a.z); player.ropeLen=a.dist*0.92; player.state='swing'; player.swingHand*=-1; player.airTime=0;
  sndThwip(); return true; }
function releaseSwing(boost){ player.state='air';
  if(boost){ const toA=_v3.copy(player.anchor).sub(player.pos).normalize();
    const hv=_v.set(player.vel.x,0,player.vel.z); const sp=hv.length();
    const perfect = toA.y>0.82 && sp>24;    // released near the bottom of the arc, moving fast = perfect boost
    if(sp>1){ hv.normalize(); const f=perfect?9:4; player.vel.x+=hv.x*f; player.vel.z+=hv.z*f; }
    player.vel.y += perfect?8:4.5; if(player.vel.y<2) player.vel.y=2;
    if(sp>26) sndWhoosh();
    if(perfect){ bumpCombo(120,'PERFECT SWING'); blip(600,1240,0.18,0.25,'triangle'); } else bumpCombo(50,'SWING'); }
  webLine.visible=false; }
let zipT=0;
function startZip(){ if(player.web<8) return; const a=findAnchor(true); let target;
  if(a){ target=_v.set(a.x,a.y,a.z); } else { const f=camForwardFlat(); target=_v.set(player.pos.x+f.x*60,player.pos.y+70,player.pos.z+f.z*60); }
  const dir=_v2.copy(target).sub(player.pos).normalize(); player.vel.addScaledVector(dir,62);
  player.vel.y=Math.max(player.vel.y,18); player.web-=8; player.state='air'; zipT=0.18; sndThwip();
  const p=zipGeo.attributes.position.array; p[0]=player.pos.x;p[1]=player.pos.y;p[2]=player.pos.z;p[3]=target.x;p[4]=target.y;p[5]=target.z;
  zipGeo.attributes.position.needsUpdate=true; zipLine.visible=true; bumpCombo(30,'ZIP'); }
function attack(){ if(player.attackT>0) return; player.attackT=0.4;
  let hit=null,hd=1e9; for(const e of enemies){ if(!e.userData.alive) continue; const d=e.position.distanceTo(player.pos); if(d<hd){hd=d;hit=e;} }
  if(hit && hd<10) knockout(hit); }
function checkCrime(){ if(!crime) return; const left=crime.es.filter(x=>x.userData.alive).length;
  if(left===0){ scene.remove(crime.beacon); player.score+=300; toast('✅ Crime stopped!  +300'); crime=null; crimeCooldown=9; }
  else toast('Thug down — '+left+' left'); }
function knockout(e){ if(!e.userData.alive) return; e.userData.alive=false;
  e.rotation.z=(Math.random()<.5?1:-1)*1.4; e.position.y=0.2;
  e.traverse(o=>{ if(o.material){ o.material=o.material.clone(); o.material.opacity=0.85; o.material.transparent=true; } });
  player.kos++; bumpCombo(80,'TAKEDOWN'); sndHit();
  if(e.userData.crime && crime) checkCrime(); else toast('TAKEDOWN!'); }

/* web-strike: yank the nearest thug ahead of you flying through the air */
function launchEnemy(e, vx, vy, vz){ e.userData.alive=false; e.userData.flying=true;
  e.userData.vx=vx; e.userData.vy=vy; e.userData.vz=vz; player.kos++;
  if(e.userData.crime && crime) checkCrime(); }
function webStrike(){
  const fwd=camForwardFlat(); let hit=null, hd=1e9;
  for(const e of enemies){ if(!e.userData.alive) continue;
    const dx=e.position.x-player.pos.x, dz=e.position.z-player.pos.z; const d=Math.hypot(dx,dz);
    if(d>75) continue; const ahead=(dx*fwd.x+dz*fwd.z)/(d||1); if(ahead<0.15) continue;
    if(d<hd){ hd=d; hit=e; } }
  if(!hit) return; sndThwip();
  zipT=0.2; const p=zipGeo.attributes.position.array;
  p[0]=player.pos.x;p[1]=player.pos.y-1;p[2]=player.pos.z;p[3]=hit.position.x;p[4]=hit.position.y+2;p[5]=hit.position.z;
  zipGeo.attributes.position.needsUpdate=true; zipLine.visible=true;
  launchEnemy(hit, (player.pos.x-hit.position.x)*0.5, 36, (player.pos.z-hit.position.z)*0.5);
  bumpCombo(90,'WEB-STRIKE'); sndHit(); toast('WEB-STRIKE!');
}
/* heavy kick: launch a close enemy away */
function heavyKick(){ if(player.attackT>0) return; player.attackT=0.5;
  let hit=null, hd=1e9; for(const e of enemies){ if(!e.userData.alive) continue; const d=e.position.distanceTo(player.pos); if(d<hd){hd=d;hit=e;} }
  if(hit && hd<13){ const dx=hit.position.x-player.pos.x, dz=hit.position.z-player.pos.z, dl=Math.hypot(dx,dz)||1;
    launchEnemy(hit, dx/dl*42, 22, dz/dl*42); bumpCombo(100,'HEAVY KICK'); sndHit(); toast('HEAVY KICK!'); } }

/* ============================ COLLISION ============================ */
function resolveCollisions(){ let hitSide=null;
  for(const b of buildings){
    const minX=b.x-b.w/2-R,maxX=b.x+b.w/2+R,minZ=b.z-b.d/2-R,maxZ=b.z+b.d/2+R;
    if(player.pos.x>minX&&player.pos.x<maxX&&player.pos.z>minZ&&player.pos.z<maxZ&&player.pos.y<b.h&&player.pos.y>0){
      const penX1=player.pos.x-minX,penX2=maxX-player.pos.x,penZ1=player.pos.z-minZ,penZ2=maxZ-player.pos.z;
      const penTop=(b.h+R)-player.pos.y, mHoriz=Math.min(penX1,penX2,penZ1,penZ2);
      if(penTop<mHoriz && player.vel.y<=0.5){ player.pos.y=b.h+R*0.2;
        if(player.vel.y<0){ landImpact(); player.vel.y=0; } if(player.state!=='swing') player.state='ground'; continue; }
      let nx=0,nz=0;
      if(mHoriz===penX1){ player.pos.x=minX; nx=-1; } else if(mHoriz===penX2){ player.pos.x=maxX; nx=1; }
      else if(mHoriz===penZ1){ player.pos.z=minZ; nz=-1; } else { player.pos.z=maxZ; nz=1; }
      const vn=player.vel.x*nx+player.vel.z*nz; if(vn<0){ player.vel.x-=vn*nx; player.vel.z-=vn*nz; }
      hitSide={nx,nz}; }
  } return hitSide; }
let lastFallSpeed=0;
function landImpact(){ sndThud(); if(lastFallSpeed<-35){ toast('Superhero landing!'); bumpCombo(20,'LANDING'); } }

/* ============================ UPDATE ============================ */
let started=false; const clock=new T.Clock();
function update(dt){
  dt=Math.min(dt,0.033);
  if(window.__editing){ window.__editorUpdate(dt); return; }
  const GRAV=-46;
  if(player.comboT>0){ player.comboT-=dt; if(player.comboT<=0){ player.combo=0; comboEl.style.opacity='0'; } }
  if(player.attackT>0) player.attackT-=dt; if(player.invuln>0) player.invuln-=dt;
  player.web=Math.min(100,player.web+dt*14);
  if(zipT>0){ zipT-=dt; if(zipT<=0) zipLine.visible=false; }
  if(crimeCooldown>0){ crimeCooldown-=dt; if(crimeCooldown<=0 && !crime) newCrime(); }

  const steerF=camForwardFlat(), steerR=camRightFlat();
  const inF=(keys['w']?1:0)-(keys['s']?1:0), inR=(keys['d']?1:0)-(keys['a']?1:0);
  if(zipHeld() && player.state!=='wall') startZip();
  if(swingHeld()){ if(player.state!=='swing' && player.web>2) startSwing(); }
  else if(player.state==='swing'){ releaseSwing(true); }

  if(player.state==='swing'){
    player.web=Math.max(0,player.web-dt*9); if(player.web<=0){ releaseSwing(true); }
    else { player.vel.y+=GRAV*dt;
      const toA=_v.copy(player.anchor).sub(player.pos); toA.normalize();
      const tang=_v2.copy(player.vel).addScaledVector(toA,-player.vel.dot(toA));
      if(tang.length()>0.1){ tang.normalize(); player.vel.addScaledVector(tang,26*dt); }
      player.vel.addScaledVector(steerR,inR*22*dt);
      if(keys['w']) player.ropeLen=Math.max(12,player.ropeLen-26*dt);
      if(keys['s']) player.ropeLen=Math.min(150,player.ropeLen+26*dt);
      player.pos.addScaledVector(player.vel,dt);
      const d=_v.copy(player.pos).sub(player.anchor); const dist=d.length();
      if(dist>player.ropeLen){ d.multiplyScalar(1/dist); player.pos.copy(player.anchor).addScaledVector(d,player.ropeLen);
        const radial=player.vel.dot(d); if(radial>0) player.vel.addScaledVector(d,-radial); }
      player.vel.multiplyScalar(0.999); }
    resolveCollisions();
  } else if(player.state==='wall'){
    const n=player.wallNormal, tangH=_v2.set(-n.z,0,n.x); player.vel.set(0,0,0);
    player.pos.y+=inF*16*dt; player.pos.addScaledVector(tangH,inR*16*dt); player.pos.y=Math.max(R,player.pos.y);
    if(keys[' ']||mouseDownL){ player.state='air'; player.vel.copy(n).multiplyScalar(24); player.vel.y=20; }
    else if(!keys['e']){ player.state='air'; player.vel.copy(n).multiplyScalar(6); }
    const bb=buildingAt(player.pos.x,player.pos.z); if(bb&&player.pos.y>=bb.h){ player.pos.y=bb.h+R*0.2; player.state='ground'; }
  } else if(player.state==='ground'){
    player.airTime=0; const accel=120,maxSp=30;
    player.vel.x+=(steerF.x*inF+steerR.x*inR)*accel*dt; player.vel.z+=(steerF.z*inF+steerR.z*inR)*accel*dt;
    player.vel.x*=0.86; player.vel.z*=0.86;
    const hs=Math.hypot(player.vel.x,player.vel.z); if(hs>maxSp){ player.vel.x*=maxSp/hs; player.vel.z*=maxSp/hs; }
    player.vel.y=0;
    if(keys[' ']||mouseDownL){ if(!startSwing(false)){ player.vel.y=28; player.state='air'; } }
    player.pos.addScaledVector(player.vel,dt);
    const bb=buildingAt(player.pos.x,player.pos.z); const floorY=bb?bb.h:STREET_Y;
    if(player.pos.y>floorY+R*0.5+0.5) player.state='air'; else player.pos.y=floorY+R*0.2;
    resolveCollisions(); if(keys['f']) attack();
  } else {
    player.airTime+=dt; player.vel.y+=GRAV*dt;
    player.vel.x+=(steerF.x*inF+steerR.x*inR)*60*dt; player.vel.z+=(steerF.z*inF+steerR.z*inR)*60*dt;
    player.vel.x*=0.995; player.vel.z*=0.995; lastFallSpeed=player.vel.y;
    player.pos.addScaledVector(player.vel,dt);
    if(keys['e']){ const side=resolveCollisions(); if(side){ player.state='wall'; player.wallNormal.set(side.nx,0,side.nz).normalize(); } }
    else resolveCollisions();
    if(keys['f']) attack();
    if(player.pos.y<=STREET_Y+R*0.2){ const bb=buildingAt(player.pos.x,player.pos.z);
      if(!bb){ if(inIsland(player.pos.x,player.pos.z)){ player.pos.y=STREET_Y+R*0.2; if(player.vel.y<0) landImpact(); player.vel.y=0; player.state='ground'; }
        else { toast('💦 Into the river! Respawning…'); respawn(); } } }
  }

  player.pos.x=Math.max(-WORLD_BX,Math.min(WORLD_BX,player.pos.x));
  player.pos.z=Math.max(-WORLD_BZ,Math.min(WORLD_BZ,player.pos.z));
  const hv=_v.set(player.vel.x,0,player.vel.z); if(hv.length()>3) player.facing.copy(hv.normalize());

  for(let i=tokens.length-1;i>=0;i--){ const tk=tokens[i]; tk.rotation.y+=dt*2; tk.rotation.x+=dt*1.1;
    tk.position.y+=Math.sin(performance.now()*0.003+i)*0.02;
    if(tk.position.distanceTo(player.pos)<5){ scene.remove(tk); tokens.splice(i,1); player.tokens++; player.score+=25; bumpCombo(25,'TOKEN'); sndChime(); } }

  for(const e of enemies){
    if(e.userData.flying){ e.userData.vy-=64*dt;
      e.position.x+=e.userData.vx*dt; e.position.y+=e.userData.vy*dt; e.position.z+=e.userData.vz*dt;
      e.rotation.x+=dt*7; e.userData.vx*=0.99; e.userData.vz*=0.99;
      if(e.position.y<=0.2){ e.position.y=0.2; e.userData.flying=false; e.rotation.z=(Math.random()<.5?1:-1)*1.4;
        e.traverse(o=>{ if(o.material){ o.material=o.material.clone(); o.material.opacity=0.85; o.material.transparent=true; } }); }
      continue; }
    if(!e.userData.alive) continue;
    e.userData.wanderT-=dt; if(e.userData.wanderT<=0){ e.userData.dir=Math.random()*Math.PI*2; e.userData.wanderT=2+Math.random()*4; }
    e.position.x+=Math.cos(e.userData.dir)*dt*4; e.position.z+=Math.sin(e.userData.dir)*dt*4; e.rotation.y=-e.userData.dir+Math.PI/2;
    if(player.state==='air'&&player.vel.y<-14&&e.position.distanceTo(player.pos)<7) knockout(e); }

  if(crime){ crime.beacon.material.opacity=0.35+Math.sin(performance.now()*0.005)*0.2; crime.beacon.rotation.y+=dt*0.5; }

  // wind audio from speed
  if(SFX.windGain){ const sp=player.vel.length(); SFX.windGain.gain.value = Math.min(0.28, Math.max(0, (sp-14)/120)); }
  if(window.__water){ window.__water.offset.x += dt*0.006; window.__water.offset.y += dt*0.004; }
  if(window.__cityAnimate) window.__cityAnimate(dt);

  updateModel(dt); updateCamera(dt); updateHUD(); frameCount++;
  if(frameCount%2===0) drawMinimap();
}

/* ============================ MODEL ANIMATION ============================ */
let animT=0, heroLean=0;
function updateModel(dt){ animT+=dt; hero.position.set(player.pos.x, player.pos.y+4.6, player.pos.z);
  if(player.state==='wall'){ const n=player.wallNormal; hero.lookAt(player.pos.x-n.x,player.pos.y,player.pos.z-n.z);
    armL.rotation.set(0.3,0,-1.6); armR.rotation.set(0.3,0,1.6); legL.rotation.set(0,0,-0.5); legR.rotation.set(0,0,0.5);
  } else {
    const look=_v.copy(player.pos).add(player.facing); hero.lookAt(look.x, player.pos.y+player.vel.y*0.01, look.z);
    const hs=Math.hypot(player.vel.x,player.vel.z);
    let leanT = 0;                                   // ground/idle: upright
    if(player.state==='swing') leanT = 1.15;         // swing: lean into a horizontal arc
    else if(player.state==='air') leanT = Math.min(1.3, 0.3 + hs*0.02);   // dive faster = flatter
    heroLean += (leanT - heroLean) * Math.min(1, dt*9);
    hero.rotateX(heroLean);                          // pitch the body forward (feet trail behind)
  }
  if(player.state==='swing'){ armL.rotation.set(-2.4,0,-0.25); armR.rotation.set(-2.4,0,0.25);
    const s=Math.sin(animT*4)*0.3; legL.rotation.set(0.6+s,0,-0.15); legR.rotation.set(0.6-s,0,0.15); hero.rotation.z=0;
  } else if(player.state==='ground'){ const sp=Math.hypot(player.vel.x,player.vel.z);
    if(sp>1){ const c=Math.sin(animT*10); legL.rotation.set(c*0.8,0,0); legR.rotation.set(-c*0.8,0,0); armL.rotation.set(-c*0.6,0,-0.1); armR.rotation.set(c*0.6,0,0.1); }
    else { legL.rotation.set(0,0,0); legR.rotation.set(0,0,0); armL.rotation.set(0,0,-0.1); armR.rotation.set(0,0,0.1); }
  } else if(player.state==='air'){ if(player.attackT>0){ legL.rotation.set(-1.6,0,0); legR.rotation.set(-1.4,0,0); armL.rotation.set(2.2,0,-0.3); armR.rotation.set(2.2,0,0.3); }
    else { armL.rotation.set(-1.8,0,-0.7); armR.rotation.set(-1.8,0,0.7); legL.rotation.set(0.5,0,-0.4); legR.rotation.set(0.5,0,0.4); } }
  if(player.state==='swing'){ const hand=(player.swingHand>0?armR:armL); hand.updateWorldMatrix(true,false);
    const hp=new T.Vector3(); hand.getWorldPosition(hp); const a=webGeo.attributes.position.array;
    a[0]=hp.x;a[1]=hp.y;a[2]=hp.z;a[3]=player.anchor.x;a[4]=player.anchor.y;a[5]=player.anchor.z;
    webGeo.attributes.position.needsUpdate=true; webLine.visible=true; } else webLine.visible=false;
}

/* ============================ CAMERA ============================ */
const camPos=new T.Vector3(0,200,60), camTgt=new T.Vector3();
function updateCamera(dt){ const speed=player.vel.length();
  const dist=16+Math.min(speed*0.12,10), height=5+Math.min(speed*0.03,4);
  const dir=new T.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
  const desired=_v.copy(player.pos).addScaledVector(dir,dist); desired.y+=height; if(desired.y<3) desired.y=3;
  const lerp=1-Math.pow(0.001,dt); camPos.lerp(desired,Math.min(1,lerp*2.1)); camera.position.copy(camPos);
  const ahead=_v2.copy(player.facing).multiplyScalar(Math.min(speed*0.15,8));
  camTgt.lerp(_v3.copy(player.pos).add(ahead).add(new T.Vector3(0,2.5,0)),Math.min(1,lerp*2)); camera.lookAt(camTgt);
  const targetFov=62+Math.min(speed*0.22,26); camera.fov+=(targetFov-camera.fov)*Math.min(1,dt*4); camera.updateProjectionMatrix();
}

/* ============================ MINIMAP ============================ */
const mm = document.getElementById('minimap'); const mmx = mm.getContext('2d');
mm.width=150; mm.height=196;
// precompute island outline in world coords
const outline=[]; for(let z=ZMIN;z<=ZMAX;z+=40){ const hw=islandHalfW(z); if(hw>0) outline.push({x:-hw,z}); }
for(let z=ZMAX;z>=ZMIN;z-=40){ const hw=islandHalfW(z); if(hw>0) outline.push({x:hw,z}); }
const MM_SCALE = 150/ (2*180); // fit width; z uses same scale (portrait crops fine with padding)
function w2m(x,z){ return { x: mm.width/2 + x*(mm.width*0.42/180), y: mm.height/2 + z*(mm.height*0.46/980) }; }
function drawMinimap(){
  mmx.clearRect(0,0,mm.width,mm.height);
  mmx.fillStyle='rgba(15,30,55,.6)'; mmx.fillRect(0,0,mm.width,mm.height);
  // island
  mmx.beginPath(); outline.forEach((p,i)=>{ const q=w2m(p.x,p.z); i?mmx.lineTo(q.x,q.y):mmx.moveTo(q.x,q.y); }); mmx.closePath();
  mmx.fillStyle='rgba(40,44,60,.95)'; mmx.fill(); mmx.strokeStyle='rgba(255,255,255,.25)'; mmx.stroke();
  // park
  const a=w2m(PARK.x0,PARK.z0), b=w2m(PARK.x1,PARK.z1);
  mmx.fillStyle='rgba(40,110,55,.9)'; mmx.fillRect(a.x,a.y,b.x-a.x,b.y-a.y);
  // tokens
  mmx.fillStyle='#24d3ff'; for(const tk of tokens){ const q=w2m(tk.position.x,tk.position.z); mmx.fillRect(q.x-0.7,q.y-0.7,1.5,1.5); }
  // crime
  if(crime){ const q=w2m(crime.pos.x,crime.pos.z); mmx.fillStyle='#ff3355'; mmx.beginPath(); mmx.arc(q.x,q.y,3.5,0,7); mmx.fill(); }
  // player (triangle facing)
  const q=w2m(player.pos.x,player.pos.z); const ang=Math.atan2(player.facing.x,player.facing.z);
  mmx.save(); mmx.translate(q.x,q.y); mmx.rotate(-ang); mmx.fillStyle='#ff5a6e';
  mmx.beginPath(); mmx.moveTo(0,-5); mmx.lineTo(3.5,4); mmx.lineTo(-3.5,4); mmx.closePath(); mmx.fill(); mmx.restore();
}

/* ============================ HUD ============================ */
const el = { hp:document.getElementById('hpfill'), web:document.getElementById('webfill'),
  tok:document.getElementById('tok'), kos:document.getElementById('kos'), score:document.getElementById('score'),
  speed:document.getElementById('speedbig'), alt:document.getElementById('alt'), state:document.getElementById('statelbl'),
  objT:document.getElementById('objtitle'), objD:document.getElementById('objdist') };
function updateHUD(){ el.hp.style.width=player.hp+'%'; el.web.style.width=player.web+'%';
  el.tok.textContent=player.tokens; el.kos.textContent=player.kos; el.score.textContent=player.score;
  el.speed.innerHTML=((player.vel.length()*2.1)|0)+'<small>mph</small>';
  el.alt.textContent=(player.pos.y*3.28)|0; el.state.textContent=player.state.toUpperCase();
  if(crime){ el.objT.textContent='🚨 STOP THE CRIME'; el.objD.textContent=(player.pos.distanceTo(crime.pos)*0.5|0)+' m away'; }
  else { el.objT.textContent='FREE ROAM'; el.objD.textContent='collect tokens · swing the skyline'; }
}

/* ============================ LOOP ============================ */
let frameCount=0;
let __firstFrame=false, __errLogged=false;
function frame(){ requestAnimationFrame(frame);
  try{
    const dt=clock.getDelta(); if(started) update(dt);
    if(composer) composer.render(); else renderer.render(scene,camera);
  }catch(err){ if(!__errLogged){ __errLogged=true; console.error('[web-slinger] frame error:', err); } }
  if(!__firstFrame){ __firstFrame=true; const l=document.getElementById('loading'); if(l){ l.classList.add('fade'); setTimeout(()=>{ if(l.parentNode) l.remove(); },500); } }
}

/* Wire the Enter button + input FIRST so nothing downstream can leave the button dead. */
const goBtn = document.getElementById('goBtn');
if(goBtn) goBtn.addEventListener('click', ()=>{
  const s=document.getElementById('start'); if(s){ s.classList.add('fade'); setTimeout(()=>{ if(s.parentNode) s.remove(); },550); }
  started=true; clock.getDelta();
  try{ initAudio(); }catch(e){}
  try{ canvas.requestPointerLock(); }catch(e){}
  crimeCooldown=6; toast('Hold SPACE or LEFT-CLICK to swing');
});
addEventListener('blur', ()=>{ mouseDownL=mouseDownR=false; for(const k in keys) keys[k]=false; });

/* Debug/test hook — lets the headless harness observe real game state (harmless in the browser). */
window.__wsState = function(){ return {
  pos:[player.pos.x, player.pos.y, player.pos.z], vel:[player.vel.x, player.vel.y, player.vel.z],
  speed:player.vel.length(), state:player.state, hp:player.hp, web:player.web,
  score:player.score, tokens:player.tokens, kos:player.kos, combo:player.combo, suit:curSuit,
  buildings:buildings.length, enemies:enemies.length, tokensLeft:tokens.length,
  camY:camera.position.y, editing:!!window.__editing, started:started }; };

respawn(); camera.position.set(0,260,160); camera.lookAt(0,140,0);
drawMinimap(); frame();

/* ============================ WORLD BUILDER (in-game block editor) ============================ */
/* Inspired by 3dWorldBuilder — place / resize / delete building blocks, saved to localStorage
   and exportable as JSON. Toggle with B. Your blocks become real city (swing off them, collide). */
(function worldBuilder(){
  const STORE = 'webSlingerWorld_v1';
  const userBlocks = [];
  let editing=false, gw=42, gd=42, gh=90;
  const cursor = new T.Vector3(0, 0, -320);
  let eYaw=0.7, ePitch=0.55, eDist=210;
  const ghostMat = new T.MeshBasicMaterial({ color:0x24d3ff, transparent:true, opacity:0.32, depthWrite:false });
  const ghost = new T.Mesh(boxGeo, ghostMat); ghost.visible=false; scene.add(ghost);
  const ghostEdge = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1,1,1)), new T.LineBasicMaterial({ color:0x9ff0ff }));
  ghostEdge.visible=false; scene.add(ghostEdge);

  function addUserBlock(x,z,w,d,h,save){
    const t = pickTex('office',x,z); t.needsUpdate=true; t.repeat.set(Math.max(1,w/8),Math.max(1,h/8));
    const mesh = box(x,0,z,w,h,d, makeBuildingMat('office',t));
    const entry = { x, z, w, d, h }; buildings.push(entry);
    const u = { entry, mesh, x, z, w, d, h }; userBlocks.push(u);
    if(save!==false) saveWorld(); return u;
  }
  function removeNearest(x,z){
    let idx=-1, best=1e9; userBlocks.forEach((u,i)=>{ const dd=Math.hypot(u.x-x,u.z-z); if(dd<best){best=dd; idx=i;} });
    if(idx<0){ toast('No built blocks to remove'); return; }
    const u=userBlocks[idx]; scene.remove(u.mesh);
    const bi=buildings.indexOf(u.entry); if(bi>=0) buildings.splice(bi,1);
    userBlocks.splice(idx,1); saveWorld();
  }
  function clearWorld(){ userBlocks.slice().forEach(u=>{ scene.remove(u.mesh); const bi=buildings.indexOf(u.entry); if(bi>=0) buildings.splice(bi,1); }); userBlocks.length=0; saveWorld(); toast('Cleared built blocks'); }
  function saveWorld(){ try{ localStorage.setItem(STORE, JSON.stringify(userBlocks.map(u=>({x:Math.round(u.x),z:Math.round(u.z),w:u.w,d:u.d,h:u.h})))); }catch(e){} updateCount(); }
  function loadWorld(){ try{ const s=localStorage.getItem(STORE); if(!s) return; JSON.parse(s).forEach(b=>addUserBlock(b.x,b.z,b.w,b.d,b.h,false)); }catch(e){} updateCount(); }
  function exportWorld(){ try{
    const data = JSON.stringify(userBlocks.map(u=>({x:Math.round(u.x),z:Math.round(u.z),w:u.w,d:u.d,h:u.h})), null, 0);
    const blob = new Blob([data], {type:'application/json'}); const a=document.createElement('a');
    a.href=URL.createObjectURL(blob); a.download='web-slinger-world.json'; a.click(); toast('Exported '+userBlocks.length+' blocks');
  }catch(e){ toast('Export failed'); } }
  function importWorld(){ const s=prompt('Paste world JSON (array of {x,z,w,d,h}):'); if(!s) return;
    try{ const arr=JSON.parse(s); clearWorld(); arr.forEach(b=>addUserBlock(b.x,b.z,b.w,b.d,b.h,false)); saveWorld(); toast('Imported '+arr.length+' blocks'); }catch(e){ toast('Invalid JSON'); } }

  const panel = document.getElementById('editor');
  function updateDims(){ const el=document.getElementById('edims'); if(el) el.textContent = `W ${gw}  ·  D ${gd}  ·  H ${gh}`; }
  function updateCount(){ const el=document.getElementById('ecount'); if(el) el.textContent = userBlocks.length; }

  function toggleEdit(){ editing=!editing; window.__editing=editing;
    ghost.visible=ghostEdge.visible=editing;
    if(panel) panel.style.display = editing?'block':'none';
    const ch=document.getElementById('crosshair'); if(ch) ch.style.display = editing?'none':'block';
    if(editing){ if(document.pointerLockElement) document.exitPointerLock(); mouseDownL=false;
      cursor.set(player.pos.x, 0, player.pos.z);
      toast('🏗️ World Builder ON — WASD move · Space place · ⌫ delete · B to exit'); }
    else { toast('World Builder OFF — back to swinging'); }
    updateDims(); updateCount();
  }

  window.__editorUpdate = function(dt){
    const f = _v.set(-Math.sin(eYaw),0,-Math.cos(eYaw));
    const r = _v2.set(Math.cos(eYaw),0,-Math.sin(eYaw));
    const sp = 150*dt*(keys['shift']?2.4:1);
    if(keys['w']) cursor.addScaledVector(f, sp);
    if(keys['s']) cursor.addScaledVector(f, -sp);
    if(keys['d']) cursor.addScaledVector(r, sp);
    if(keys['a']) cursor.addScaledVector(r, -sp);
    cursor.y=0;
    ghost.position.set(cursor.x,0,cursor.z); ghost.scale.set(gw,gh,gd);
    ghostEdge.position.set(cursor.x,gh/2,cursor.z); ghostEdge.scale.set(gw,gh,gd);
    const cx=cursor.x + Math.sin(eYaw)*Math.cos(ePitch)*eDist;
    const cy=Math.sin(ePitch)*eDist + 24;
    const cz=cursor.z + Math.cos(eYaw)*Math.cos(ePitch)*eDist;
    camera.position.set(cx,cy,cz); camera.lookAt(cursor.x, gh*0.5, cursor.z);
    camera.fov += (62-camera.fov)*Math.min(1,dt*4); camera.updateProjectionMatrix();
  };

  addEventListener('keydown', e=>{ const k=e.key.toLowerCase();
    if(k==='b'){ if(started) toggleEdit(); return; }
    if(!editing) return;
    if(k===' '||k==='enter'){ e.preventDefault(); addUserBlock(cursor.x,cursor.z,gw,gd,gh); toast('Placed block'); }
    else if(k==='backspace'||k==='delete'){ e.preventDefault(); removeNearest(cursor.x,cursor.z); }
    else if(k==='arrowup'){ e.preventDefault(); gh=Math.min(340,gh+6); }
    else if(k==='arrowdown'){ e.preventDefault(); gh=Math.max(8,gh-6); }
    else if(k==='arrowright'){ e.preventDefault(); gw=Math.min(140,gw+4); }
    else if(k==='arrowleft'){ e.preventDefault(); gw=Math.max(8,gw-4); }
    else if(k==='['){ gd=Math.max(8,gd-4); }
    else if(k===']'){ gd=Math.min(140,gd+4); }
    updateDims();
  });
  addEventListener('mousemove', e=>{ if(editing && mouseDownL){ eYaw-=e.movementX*0.005; ePitch=Math.max(0.12,Math.min(1.45,ePitch-e.movementY*0.005)); } });
  addEventListener('wheel', e=>{ if(editing){ eDist=Math.max(50,Math.min(650,eDist+e.deltaY*0.2)); } }, {passive:true});

  function wire(id,fn){ const el=document.getElementById(id); if(el) el.addEventListener('click', ()=>{ fn(); }); }
  wire('eSave', ()=>{ saveWorld(); toast('Saved to browser'); });
  wire('eExport', exportWorld); wire('eImport', importWorld); wire('eClear', clearWorld);

  loadWorld();
})();
})();
