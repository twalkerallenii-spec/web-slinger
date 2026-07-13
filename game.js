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
renderer.toneMappingExposure = 1.05;

const scene = new T.Scene();
scene.background = new T.Color(0x2a1533);
scene.fog = new T.Fog(0x3a1d44, 340, 1700);

const camera = new T.PerspectiveCamera(64, innerWidth/innerHeight, 0.5, 5000);
camera.position.set(0, 180, 40);

addEventListener('resize', ()=>{
  camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* ============================ LIGHTING ============================ */
scene.add(new T.HemisphereLight(0xffb98a, 0x241031, 0.85));
scene.add(new T.AmbientLight(0x5a4a7a, 0.5));
const sun = new T.DirectionalLight(0xffd9a0, 1.15); sun.position.set(-400, 320, -260); scene.add(sun);
const rim = new T.DirectionalLight(0x6ea8ff, 0.5); rim.position.set(380, 220, 320); scene.add(rim);

/* ============================ SKY DOME ============================ */
(function sky(){
  const cv = document.createElement('canvas'); cv.width = 16; cv.height = 256;
  const g = cv.getContext('2d');
  const grd = g.createLinearGradient(0,0,0,256);
  grd.addColorStop(0.0,'#1a0b2e'); grd.addColorStop(0.42,'#4b1d55'); grd.addColorStop(0.62,'#a5325f');
  grd.addColorStop(0.78,'#ff7847'); grd.addColorStop(0.9,'#ffb15c'); grd.addColorStop(1.0,'#ffd7a0');
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

/* ============================ FACADE TEXTURES (noise-detailed) ============================ */
function makeFacade(seed){
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 256;
  const g = cv.getContext('2d');
  const base = 18 + (seed*37 % 26);
  g.fillStyle = `rgb(${base},${base+6},${base+18})`; g.fillRect(0,0,128,256);
  const img = g.getImageData(0,0,128,256), d = img.data;
  for(let y=0;y<256;y++) for(let x=0;x<128;x++){
    const n = snoise(x*0.06 + seed*10, y*0.06);
    const streak = snoise(x*0.5, y*0.01 + seed) * 0.4;
    const shade = (n*10 + streak*18)|0; const i = (y*128+x)*4;
    d[i]=Math.max(0,d[i]+shade); d[i+1]=Math.max(0,d[i+1]+shade); d[i+2]=Math.max(0,d[i+2]+shade);
  }
  g.putImageData(img,0,0);
  const cols = 6, rows = 12, mw = 128/cols, mh = 256/rows;
  for(let y=0;y<rows;y++) for(let x=0;x<cols;x++){
    const lit = ((x*7+y*13+seed*3) % 10) < 5;
    if(lit){ const warm = ((x+y+seed)%3)===0;
      g.fillStyle = warm ? `rgba(255,${190+((x*y)%50)},120,1)` : `rgba(150,200,255,.95)`;
    } else { g.fillStyle = 'rgba(10,14,26,1)'; }
    g.fillRect(x*mw+2, y*mh+3, mw-5, mh-6);
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x*mw+2, y*mh+3, mw-5, 2);
  }
  const tex = new T.CanvasTexture(cv); tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.anisotropy = 2;
  return tex;
}
const FACADES = []; for(let i=0;i<6;i++) FACADES.push(makeFacade(i+1));

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
// Central Park: 59th-110th St, west-of-centre rectangle
const PARK = { x0:-72, x1:78, z0:180, z1:560 };
function inPark(x,z){ return x>PARK.x0 && x<PARK.x1 && z>PARK.z0 && z<PARK.z1; }

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
const buildings = [];
const boxGeo = new T.BoxGeometry(1,1,1); boxGeo.translate(0, 0.5, 0);
const roofMat = new T.MeshStandardMaterial({ color:0x241a30, roughness:.9, metalness:.1 });
const spireMat = new T.MeshStandardMaterial({ color:0x2b2140, roughness:.6, metalness:.3, emissive:0x140a20 });

function addBuilding(x,z,w,d,h){
  const fi = (Math.abs((x*3+z*7))|0) % FACADES.length;
  const facTex = FACADES[fi].clone(); facTex.needsUpdate = true;
  facTex.repeat.set(Math.max(1, w/9), Math.max(1, h/9));
  const tint = new T.Color().setHSL(0.62 + Math.random()*0.12, 0.25, 0.35 + Math.random()*0.1);
  const mat = new T.MeshStandardMaterial({ map:facTex, emissiveMap:facTex, emissive:0xffffff,
    emissiveIntensity:0.55, color:tint, roughness:.78, metalness:.15 });
  const mesh = new T.Mesh(boxGeo, mat); mesh.position.set(x,0,z); mesh.scale.set(w,h,d); scene.add(mesh);
  const roof = new T.Mesh(boxGeo, roofMat); roof.position.set(x,h,z); roof.scale.set(w*1.02,2.5,d*1.02); scene.add(roof);
  // rooftop clutter
  if(Math.random()<0.5){ const t = new T.Mesh(boxGeo, roofMat); const tw = 3+Math.random()*5;
    t.position.set(x+(Math.random()-.5)*w*.4, h+2, z+(Math.random()-.5)*d*.4); t.scale.set(tw,5+Math.random()*8,tw); scene.add(t); }
  // iconic tapered crown/antenna on supertalls
  if(h>270){
    const crown = new T.Mesh(new T.ConeGeometry(Math.min(w,d)*0.42, 26, 6), spireMat);
    crown.position.set(x, h+13, z); scene.add(crown);
    const ant = new T.Mesh(new T.CylinderGeometry(0.5,0.8,22,5), spireMat); ant.position.set(x, h+30, z); scene.add(ant);
  }
  buildings.push({ x, z, w, d, h });
}
function buildingAt(x, z){
  for(const b of buildings){ if(x>b.x-b.w/2 && x<b.x+b.w/2 && z>b.z-b.d/2 && z<b.z+b.d/2) return b; }
  return null;
}

function heightFor(x,z){
  const r = Math.random();
  if(z < -640) return 190 + r*210;                       // Financial District skyscrapers (south tip)
  if(z > -140 && z < 170) return 155 + r*185;            // Midtown cluster (below the park)
  if(z > PARK.z1 - 60 && Math.abs(x) < 200) return 44 + r*46; // Upper-side lower-rise near/above park
  return 58 + r*95 + (r<0.07 ? 130 : 0);                 // residential + occasional spike
}

/* Avenues run N-S (wide spacing in X); cross-streets run E-W (short spacing in Z) — real grid shape. */
const AVX = 70, CSZ = 54, STREET = 20;
const streetPos = [], parkPos = [], treePos = [];
for(let x = -220; x <= 220; x += AVX){
  for(let z = ZMIN; z <= ZMAX; z += CSZ){
    const bx = x + AVX/2, bz = z + CSZ/2;
    if(!inIsland(bx,bz)) continue;
    if(inPark(bx,bz)){ parkPos.push({x:bx,z:bz}); if(Math.random()<0.55) treePos.push({x:bx+(Math.random()-.5)*40, z:bz+(Math.random()-.5)*30}); continue; }
    streetPos.push({x:bx,z:bz});
    const bw = AVX - STREET, bd = CSZ - STREET;
    addBuilding(bx, bz, bw, bd, heightFor(bx,bz));
  }
}

/* instanced ground tiles (asphalt) + park tiles (grass) */
(function tiles(){
  const sGeo = new T.BoxGeometry(AVX-4, 0.8, CSZ-4);
  const sMat = new T.MeshStandardMaterial({ color:0x181521, roughness:.96, metalness:0 });
  const streets = new T.InstancedMesh(sGeo, sMat, streetPos.length);
  streetPos.forEach((p,i)=>{ m4.makeTranslation(p.x,0.3,p.z); streets.setMatrixAt(i,m4); });
  streets.instanceMatrix.needsUpdate = true; scene.add(streets);
  if(parkPos.length){
    const pGeo = new T.BoxGeometry(AVX-2, 0.9, CSZ-2);
    const pMat = new T.MeshStandardMaterial({ color:0x1f5a2a, roughness:1, metalness:0 });
    const park = new T.InstancedMesh(pGeo, pMat, parkPos.length);
    parkPos.forEach((p,i)=>{ m4.makeTranslation(p.x,0.35,p.z); park.setMatrixAt(i,m4); });
    park.instanceMatrix.needsUpdate = true; scene.add(park);
    // pond
    const pond = new T.Mesh(new T.CircleGeometry(34,20), new T.MeshStandardMaterial({ color:0x2a6a8a, roughness:.3, metalness:.4 }));
    pond.rotation.x = -Math.PI/2; pond.position.set((PARK.x0+PARK.x1)/2, 0.5, (PARK.z0+PARK.z1)/2 + 40); scene.add(pond);
  }
  // trees (instanced trunk + foliage)
  if(treePos.length){
    const fGeo = new T.ConeGeometry(4.5, 11, 6); const fMat = new T.MeshStandardMaterial({ color:0x2c7a3a, roughness:.9 });
    const tGeo = new T.CylinderGeometry(0.7,0.9,5,5); const tMat = new T.MeshStandardMaterial({ color:0x4a2f1e, roughness:1 });
    const fol = new T.InstancedMesh(fGeo, fMat, treePos.length);
    const trk = new T.InstancedMesh(tGeo, tMat, treePos.length);
    treePos.forEach((p,i)=>{ m4.makeTranslation(p.x,9,p.z); fol.setMatrixAt(i,m4); m4.makeTranslation(p.x,2.5,p.z); trk.setMatrixAt(i,m4); });
    fol.instanceMatrix.needsUpdate = true; trk.instanceMatrix.needsUpdate = true; scene.add(fol); scene.add(trk);
  }
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
  g.add(Object.assign(new T.Mesh(new T.CylinderGeometry(0.9,1.1,3.4,8), enemyBody),{position:new T.Vector3(0,1.7,0)}));
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
canvas.addEventListener('mousedown', e=>{ if(!started) return; if(!pointerLocked) canvas.requestPointerLock();
  if(e.button===0) mouseDownL=true; if(e.button===2) mouseDownR=true; });
addEventListener('mouseup', e=>{ if(e.button===0) mouseDownL=false; if(e.button===2) mouseDownR=false; });
addEventListener('contextmenu', e=> e.preventDefault());
document.addEventListener('pointerlockchange', ()=>{ pointerLocked = document.pointerLockElement===canvas;
  document.getElementById('crosshair').classList.toggle('lock', pointerLocked); });
addEventListener('mousemove', e=>{ if(!pointerLocked) return; yaw-=e.movementX*0.0022; pitch-=e.movementY*0.0020;
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
  let best=null, bestScore=-1e9; const maxRope=150;
  for(const b of buildings){
    const ax=Math.max(b.x-b.w/2,Math.min(b.x+b.w/2, player.pos.x+fwd.x*20));
    const az=Math.max(b.z-b.d/2,Math.min(b.z+b.d/2, player.pos.z+fwd.z*20));
    const ay=b.h; if(ay<player.pos.y+6) continue;
    const dx=ax-player.pos.x, dy=ay-player.pos.y, dz=az-player.pos.z;
    const dist=Math.hypot(dx,dy,dz); if(dist<14||dist>maxRope) continue;
    const ahead=(dx*fwd.x+dz*fwd.z)/(Math.hypot(dx,dz)||1); if(ahead<-0.15) continue;
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
function startSwing(){ const a=findAnchor(false); if(!a) return false;
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
  dt=Math.min(dt,0.033); const GRAV=-46;
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
      if(tang.length()>0.1){ tang.normalize(); player.vel.addScaledVector(tang,22*dt); }
      player.vel.addScaledVector(steerR,inR*16*dt);
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
    if(keys[' ']||mouseDownL){ if(!startSwing()){ player.vel.y=26; player.state='air'; } }
    player.pos.addScaledVector(player.vel,dt);
    const bb=buildingAt(player.pos.x,player.pos.z); const floorY=bb?bb.h:STREET_Y;
    if(player.pos.y>floorY+R*0.5+0.5) player.state='air'; else player.pos.y=floorY+R*0.2;
    resolveCollisions(); if(keys['f']) attack();
  } else {
    player.airTime+=dt; player.vel.y+=GRAV*dt;
    player.vel.x+=(steerF.x*inF+steerR.x*inR)*40*dt; player.vel.z+=(steerF.z*inF+steerR.z*inR)*40*dt;
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

  updateModel(dt); updateCamera(dt); updateHUD(); frameCount++;
  if(frameCount%2===0) drawMinimap();
}

/* ============================ MODEL ANIMATION ============================ */
let animT=0;
function updateModel(dt){ animT+=dt; hero.position.copy(player.pos);
  if(player.state==='wall'){ const n=player.wallNormal; hero.lookAt(player.pos.x-n.x,player.pos.y,player.pos.z-n.z);
    armL.rotation.set(0.3,0,-1.6); armR.rotation.set(0.3,0,1.6); legL.rotation.set(0,0,-0.5); legR.rotation.set(0,0,0.5);
  } else { const look=_v.copy(player.pos).add(player.facing); hero.lookAt(look.x,player.pos.y+player.vel.y*0.02,look.z); }
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
  const lerp=1-Math.pow(0.001,dt); camPos.lerp(desired,Math.min(1,lerp*1.6)); camera.position.copy(camPos);
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
function frame(){ requestAnimationFrame(frame); const dt=clock.getDelta(); if(started) update(dt); renderer.render(scene,camera); }
respawn(); camera.position.set(0,260,160); camera.lookAt(0,140,0);
const loadEl=document.getElementById('loading'); if(loadEl){ loadEl.classList.add('fade'); setTimeout(()=>loadEl.remove(),600); }
drawMinimap(); frame();

document.getElementById('goBtn').addEventListener('click', ()=>{
  const s=document.getElementById('start'); s.classList.add('fade'); setTimeout(()=>{ if(s.parentNode) s.remove(); },550);
  started=true; clock.getDelta(); initAudio(); canvas.requestPointerLock();
  crimeCooldown=6; toast('Hold SPACE or LEFT-CLICK to swing');
});
addEventListener('blur', ()=>{ mouseDownL=mouseDownR=false; for(const k in keys) keys[k]=false; });
})();
