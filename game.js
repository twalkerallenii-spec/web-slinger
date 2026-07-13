/* Web-Slinger — a Three.js Spider-Man-style web-swinging sandbox.
   Original art. Not affiliated with Marvel / Insomniac.
   Libraries: three.js (r128), simplex-noise (procedural texture detail). */
(function(){
'use strict';
if (!window.THREE) { const l=document.getElementById('loading'); if(l) l.textContent='Failed to load Three.js (need internet).'; return; }
const T = THREE;
const Simplex = (window.SimplexNoise ? new window.SimplexNoise('web-slinger') : null);
function snoise(x,y){ return Simplex ? Simplex.noise2D(x,y) : (Math.sin(x*12.9898+y*78.233)*43758.5453 % 1); }

/* ============================ CORE SETUP ============================ */
const canvas = document.getElementById('c');
const renderer = new T.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.outputEncoding = T.sRGBEncoding;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new T.Scene();
const DUSK = new T.Color(0x2a1533);
scene.background = DUSK.clone();
scene.fog = new T.Fog(0x3a1d44, 260, 1150);

const camera = new T.PerspectiveCamera(64, innerWidth/innerHeight, 0.5, 4000);
camera.position.set(0, 180, 40);

addEventListener('resize', ()=>{
  camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* ============================ LIGHTING ============================ */
scene.add(new T.HemisphereLight(0xffb98a, 0x241031, 0.85));
scene.add(new T.AmbientLight(0x5a4a7a, 0.5));
const sun = new T.DirectionalLight(0xffd9a0, 1.15);
sun.position.set(-400, 320, -260); scene.add(sun);
const rim = new T.DirectionalLight(0x6ea8ff, 0.5);
rim.position.set(380, 220, 320); scene.add(rim);

/* ============================ SKY DOME ============================ */
(function sky(){
  const cv = document.createElement('canvas'); cv.width = 16; cv.height = 256;
  const g = cv.getContext('2d');
  const grd = g.createLinearGradient(0,0,0,256);
  grd.addColorStop(0.0, '#1a0b2e');
  grd.addColorStop(0.42,'#4b1d55');
  grd.addColorStop(0.62,'#a5325f');
  grd.addColorStop(0.78,'#ff7847');
  grd.addColorStop(0.9, '#ffb15c');
  grd.addColorStop(1.0, '#ffd7a0');
  g.fillStyle = grd; g.fillRect(0,0,16,256);
  g.fillStyle = 'rgba(255,255,255,.9)';
  for(let i=0;i<40;i++){ g.fillRect(Math.random()*16, Math.random()*90, 1, 1); }
  const tex = new T.CanvasTexture(cv); tex.magFilter = T.LinearFilter;
  const dome = new T.Mesh(new T.SphereGeometry(2600, 24, 16),
    new T.MeshBasicMaterial({ map:tex, side:T.BackSide, fog:false, depthWrite:false }));
  scene.add(dome);
  const sc = document.createElement('canvas'); sc.width = sc.height = 128;
  const sg = sc.getContext('2d');
  const rg = sg.createRadialGradient(64,64,0,64,64,64);
  rg.addColorStop(0,'rgba(255,240,200,1)'); rg.addColorStop(.3,'rgba(255,180,110,.85)');
  rg.addColorStop(1,'rgba(255,120,70,0)');
  sg.fillStyle = rg; sg.fillRect(0,0,128,128);
  const spr = new T.Sprite(new T.SpriteMaterial({ map:new T.CanvasTexture(sc), transparent:true, depthWrite:false, fog:false }));
  spr.scale.set(700,700,1); spr.position.set(-1500, 380, -1900); scene.add(spr);
})();

/* ============================ WINDOW/FACADE TEXTURE (noise-detailed) ============================ */
function makeFacade(seed){
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 256;
  const g = cv.getContext('2d');
  const base = 18 + (seed*37 % 26);
  g.fillStyle = `rgb(${base},${base+6},${base+18})`; g.fillRect(0,0,128,256);
  // simplex grunge overlay on the concrete
  const img = g.getImageData(0,0,128,256), d = img.data;
  for(let y=0;y<256;y++) for(let x=0;x<128;x++){
    const n = snoise(x*0.06 + seed*10, y*0.06);        // -1..1
    const streak = snoise(x*0.5, y*0.01 + seed) * 0.4;  // vertical dirt streaks
    const shade = (n*10 + streak*18)|0;
    const i = (y*128+x)*4;
    d[i]=Math.max(0,d[i]+shade); d[i+1]=Math.max(0,d[i+1]+shade); d[i+2]=Math.max(0,d[i+2]+shade);
  }
  g.putImageData(img,0,0);
  // windows
  const cols = 6, rows = 12, mw = 128/cols, mh = 256/rows;
  for(let y=0;y<rows;y++) for(let x=0;x<cols;x++){
    const lit = ((x*7+y*13+seed*3) % 10) < 5;
    if(lit){
      const warm = ((x+y+seed)%3)===0;
      g.fillStyle = warm ? `rgba(255,${190+((x*y)%50)},120,1)` : `rgba(150,200,255,.95)`;
    } else { g.fillStyle = 'rgba(10,14,26,1)'; }
    g.fillRect(x*mw+2, y*mh+3, mw-5, mh-6);
    // subtle window reflection line
    g.fillStyle = 'rgba(255,255,255,.08)';
    g.fillRect(x*mw+2, y*mh+3, mw-5, 2);
  }
  const tex = new T.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.anisotropy = 2;
  return tex;
}
const FACADES = []; for(let i=0;i<6;i++) FACADES.push(makeFacade(i+1));

/* ============================ GROUND (noise-detailed asphalt) ============================ */
(function ground(){
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#15111c'; g.fillRect(0,0,256,256);
  const img = g.getImageData(0,0,256,256), d = img.data;
  for(let y=0;y<256;y++) for(let x=0;x<256;x++){
    const n = snoise(x*0.05, y*0.05)*8 + snoise(x*0.2,y*0.2)*4;
    const i=(y*256+x)*4; d[i]+=n; d[i+1]+=n; d[i+2]+=n;
  }
  g.putImageData(img,0,0);
  g.strokeStyle = 'rgba(120,120,160,.25)'; g.lineWidth = 4; g.strokeRect(0,0,256,256);
  g.strokeStyle = 'rgba(255,200,120,.18)'; g.setLineDash([14,16]); g.lineWidth = 2;
  g.beginPath(); g.moveTo(128,0); g.lineTo(128,256); g.stroke();
  const tex = new T.CanvasTexture(cv); tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.repeat.set(30, 30);
  const geo = new T.PlaneGeometry(4000, 4000); geo.rotateX(-Math.PI/2);
  const mat = new T.MeshStandardMaterial({ map:tex, roughness:0.95, metalness:0.0, color:0x2a2436 });
  scene.add(new T.Mesh(geo, mat));
})();

/* ============================ CITY GENERATION (same city) ============================ */
const buildings = [];
const CELL = 78, GRID = 15;
const HALF = (GRID*CELL)/2;
const boxGeo = new T.BoxGeometry(1,1,1); boxGeo.translate(0, 0.5, 0);
const roofMat = new T.MeshStandardMaterial({ color:0x241a30, roughness:.9, metalness:.1 });

function addBuilding(x,z,w,d,h){
  const fi = (Math.abs((x*3+z*7))|0) % FACADES.length;
  const facTex = FACADES[fi].clone(); facTex.needsUpdate = true;
  facTex.repeat.set(Math.max(1, w/9), Math.max(1, h/9));
  const tint = new T.Color().setHSL(0.62 + Math.random()*0.12, 0.25, 0.35 + Math.random()*0.1);
  const mat = new T.MeshStandardMaterial({
    map:facTex, emissiveMap:facTex, emissive:0xffffff, emissiveIntensity:0.55,
    color:tint, roughness:.78, metalness:.15
  });
  const mesh = new T.Mesh(boxGeo, mat); mesh.position.set(x,0,z); mesh.scale.set(w,h,d); scene.add(mesh);
  const roof = new T.Mesh(boxGeo, roofMat); roof.position.set(x,h,z); roof.scale.set(w*1.02,2.5,d*1.02); scene.add(roof);
  if(Math.random()<0.5){
    const t = new T.Mesh(boxGeo, roofMat); const tw = 3+Math.random()*5;
    t.position.set(x+(Math.random()-.5)*w*.4, h+2, z+(Math.random()-.5)*d*.4);
    t.scale.set(tw, 5+Math.random()*8, tw); scene.add(t);
  }
  buildings.push({ x, z, w, d, h });
}

for(let ix=0; ix<GRID; ix++) for(let iz=0; iz<GRID; iz++){
  const cx = -HALF + ix*CELL + CELL/2, cz = -HALF + iz*CELL + CELL/2;
  const x = cx + (Math.random()-.5)*6, z = cz + (Math.random()-.5)*6;
  const w = 34 + Math.random()*20, d = 34 + Math.random()*20;
  const distC = Math.hypot(cx, cz) / HALF;
  let h = 46 + (1-distC)*120 + Math.random()*70;
  if(Math.random()<0.09) h += 90 + Math.random()*140;
  h = Math.min(h, 330);
  addBuilding(x, z, w, d, h);
}

function buildingAt(x, z){
  for(const b of buildings){
    if(x > b.x-b.w/2 && x < b.x+b.w/2 && z > b.z-b.d/2 && z < b.z+b.d/2) return b;
  }
  return null;
}

/* ============================ SPIDER (PLAYER MODEL) ============================ */
const suitRed  = new T.MeshStandardMaterial({ color:0xd21f3c, roughness:.5, metalness:.15 });
const suitBlue = new T.MeshStandardMaterial({ color:0x1e3a8a, roughness:.5, metalness:.2 });
const suitDark = new T.MeshStandardMaterial({ color:0x0b1220, roughness:.6 });
const eyeMat   = new T.MeshStandardMaterial({ color:0xffffff, emissive:0xffffff, emissiveIntensity:.9, roughness:.3 });

const hero = new T.Group();
function limbGeo(r,len){ const g=new T.CylinderGeometry(r*0.75,r,len,8); g.translate(0,-len/2,0); return g; }

const torso = new T.Mesh(new T.CylinderGeometry(1.05,0.85,3.1,10), suitRed); torso.position.y = 0; hero.add(torso);
const chest = new T.Mesh(new T.SphereGeometry(1.15,12,10), suitRed); chest.scale.set(1,0.7,0.7); chest.position.y = 1.1; hero.add(chest);
const pelvis = new T.Mesh(new T.SphereGeometry(1.0,12,10), suitBlue); pelvis.scale.set(1,0.7,0.8); pelvis.position.y = -1.4; hero.add(pelvis);
const emblem = new T.Mesh(new T.SphereGeometry(0.42,8,8), suitDark); emblem.scale.set(1,1.5,0.4); emblem.position.set(0,0.9,0.95); hero.add(emblem);
const head = new T.Mesh(new T.SphereGeometry(0.72,14,12), suitRed); head.position.y = 2.35; hero.add(head);
const eyeL = new T.Mesh(new T.SphereGeometry(0.26,10,8), eyeMat); eyeL.scale.set(1.4,0.9,0.4); eyeL.position.set(-0.28,2.42,0.55); hero.add(eyeL);
const eyeR = eyeL.clone(); eyeR.position.x = 0.28; hero.add(eyeR);

function makeLimb(mat, r, len){
  const grp = new T.Group();
  grp.add(new T.Mesh(limbGeo(r,len), mat));
  const hand = new T.Mesh(new T.SphereGeometry(r*0.9,8,8), suitDark); hand.position.y = -len; grp.add(hand);
  return grp;
}
const armL = makeLimb(suitRed, 0.32, 2.6); armL.position.set(-1.05, 1.2, 0); hero.add(armL);
const armR = makeLimb(suitRed, 0.32, 2.6); armR.position.set( 1.05, 1.2, 0); hero.add(armR);
const legL = makeLimb(suitBlue,0.38, 3.0); legL.position.set(-0.5, -1.9, 0); hero.add(legL);
const legR = makeLimb(suitBlue,0.38, 3.0); legR.position.set( 0.5, -1.9, 0); hero.add(legR);
scene.add(hero);

/* web line */
const webMat = new T.LineBasicMaterial({ color:0xffffff, transparent:true, opacity:0.9 });
const webGeo = new T.BufferGeometry(); webGeo.setAttribute('position', new T.BufferAttribute(new Float32Array(6),3));
const webLine = new T.Line(webGeo, webMat); webLine.visible = false; scene.add(webLine);

const zipMat = new T.LineBasicMaterial({ color:0x9fe0ff, transparent:true, opacity:0.85 });
const zipGeo = new T.BufferGeometry(); zipGeo.setAttribute('position', new T.BufferAttribute(new Float32Array(6),3));
const zipLine = new T.Line(zipGeo, zipMat); zipLine.visible=false; scene.add(zipLine);

/* ============================ COLLECTIBLES ============================ */
const tokens = [];
const tokenGeo = new T.OctahedronGeometry(1.4, 0);
const tokenMat = new T.MeshStandardMaterial({ color:0x24d3ff, emissive:0x24d3ff, emissiveIntensity:1.1, roughness:.2, metalness:.4 });
function spawnTokens(n){
  for(let i=0;i<n;i++){
    const b = buildings[(Math.random()*buildings.length)|0];
    const m = new T.Mesh(tokenGeo, tokenMat);
    const y = 20 + Math.random()*Math.max(30, b.h);
    m.position.set(b.x + (Math.random()-.5)*CELL*0.9, y, b.z + (Math.random()-.5)*CELL*0.9);
    scene.add(m); tokens.push(m);
  }
}
spawnTokens(46);
document.getElementById('toktot').textContent = tokens.length;

/* ============================ ENEMIES ============================ */
const enemies = [];
const enemyBody = new T.MeshStandardMaterial({ color:0x394b2a, roughness:.8 });
const enemyHead = new T.MeshStandardMaterial({ color:0xc79b78, roughness:.7 });
function spawnEnemies(n){
  for(let i=0;i<n;i++){
    const g = new T.Group();
    const body = new T.Mesh(new T.CylinderGeometry(0.9,1.1,3.4,8), enemyBody); body.position.y=1.7; g.add(body);
    const h = new T.Mesh(new T.SphereGeometry(0.7,10,8), enemyHead); h.position.y=3.8; g.add(h);
    const gx = (((Math.random()*GRID)|0)) * CELL - HALF;
    const gz = (((Math.random()*GRID)|0)) * CELL - HALF;
    g.position.set(gx, 0, gz);
    g.userData = { alive:true, wanderT:Math.random()*10, dir:Math.random()*Math.PI*2 };
    scene.add(g); enemies.push(g);
  }
}
spawnEnemies(14);

/* ============================ INPUT ============================ */
const keys = {};
addEventListener('keydown', e=>{
  const k = e.key.toLowerCase(); keys[k] = true;
  if(k===' ') e.preventDefault();
  if(k==='h'){ const h=document.getElementById('help'); h.style.display = h.style.display==='none'?'block':'none'; }
  if(k==='r'){ respawn(); }
});
addEventListener('keyup', e=>{ keys[e.key.toLowerCase()] = false; });

let mouseDownL=false, mouseDownR=false;
let yaw = 0, pitch = 0.15, pointerLocked = false;
canvas.addEventListener('mousedown', e=>{
  if(!started) return;
  if(!pointerLocked){ canvas.requestPointerLock(); }
  if(e.button===0) mouseDownL=true;
  if(e.button===2) mouseDownR=true;
});
addEventListener('mouseup', e=>{ if(e.button===0) mouseDownL=false; if(e.button===2) mouseDownR=false; });
addEventListener('contextmenu', e=> e.preventDefault());
document.addEventListener('pointerlockchange', ()=>{
  pointerLocked = document.pointerLockElement === canvas;
  document.getElementById('crosshair').classList.toggle('lock', pointerLocked);
});
addEventListener('mousemove', e=>{
  if(!pointerLocked) return;
  yaw -= e.movementX*0.0022; pitch -= e.movementY*0.0020;
  pitch = Math.max(-0.9, Math.min(1.1, pitch));
});
function swingHeld(){ return keys[' '] || mouseDownL; }
function zipHeld(){ return keys['shift'] || mouseDownR; }

/* ============================ PLAYER STATE ============================ */
const player = {
  pos:new T.Vector3(), vel:new T.Vector3(), state:'air',
  anchor:new T.Vector3(), ropeLen:0, swingHand:1, wallNormal:new T.Vector3(),
  facing:new T.Vector3(0,0,-1),
  hp:100, web:100, score:0, tokens:0, kos:0, combo:0, comboT:0, attackT:0, invuln:0, airTime:0,
};
const R = 2.2, GROUND_Y = 0;

function respawn(){
  let best=buildings[0];
  for(const b of buildings){ if(b.h>best.h && Math.hypot(b.x,b.z)<HALF*0.5) best=b; }
  player.pos.set(best.x, best.h + 8, best.z); player.vel.set(0,0,-2);
  player.state='air'; player.hp=100; player.web=100; player.combo=0;
  toast('Dropped into the city — hold SPACE to swing');
}

/* ============================ HELPERS ============================ */
const _v = new T.Vector3(), _v2 = new T.Vector3(), _v3 = new T.Vector3();
function camForwardFlat(){ return _v.set(-Math.sin(yaw),0,-Math.cos(yaw)).normalize(); }
function camRightFlat(){ return _v2.set(Math.cos(yaw),0,-Math.sin(yaw)).normalize(); }

function findAnchor(preferHigh){
  const fwd = camForwardFlat().clone();
  const hv = _v3.set(player.vel.x,0,player.vel.z);
  if(hv.length() > 8){ fwd.lerp(hv.normalize(), 0.55).normalize(); }
  let best=null, bestScore=-1e9; const maxRope = 130;
  for(const b of buildings){
    const ax = Math.max(b.x-b.w/2, Math.min(b.x+b.w/2, player.pos.x + fwd.x*20));
    const az = Math.max(b.z-b.d/2, Math.min(b.z+b.d/2, player.pos.z + fwd.z*20));
    const ay = b.h;
    if(ay < player.pos.y + 6) continue;
    const dx=ax-player.pos.x, dy=ay-player.pos.y, dz=az-player.pos.z;
    const dist = Math.hypot(dx,dy,dz);
    if(dist<14 || dist>maxRope) continue;
    const ahead = (dx*fwd.x + dz*fwd.z)/(Math.hypot(dx,dz)||1);
    if(ahead < -0.15) continue;
    const score = ahead*40 + (preferHigh?dy*1.2:dy*0.5) - Math.abs(dist-70)*0.35;
    if(score>bestScore){ bestScore=score; best={ x:ax,y:ay,z:az,dist }; }
  }
  return best;
}

/* ============================ TOASTS / COMBO ============================ */
function toast(msg){
  const box = document.getElementById('toast');
  const el = document.createElement('div'); el.className='toastmsg'; el.textContent=msg; box.appendChild(el);
  setTimeout(()=>{ el.style.transition='opacity .4s'; el.style.opacity='0'; setTimeout(()=>el.remove(),420); }, 1600);
  while(box.children.length>3) box.removeChild(box.firstChild);
}
const comboEl = document.getElementById('combo');
function bumpCombo(pts, label){
  player.combo++; player.comboT = 2.2;
  player.score += pts * Math.max(1, player.combo);
  comboEl.textContent = (label||'STYLE') + '  x' + player.combo;
  comboEl.style.opacity = '1';
}

/* ============================ SWING / MOVEMENT ============================ */
function startSwing(){
  const a = findAnchor(false); if(!a) return false;
  player.anchor.set(a.x, a.y, a.z);
  player.ropeLen = a.dist * 0.92;
  player.state = 'swing'; player.swingHand *= -1; player.airTime = 0;
  return true;
}
function releaseSwing(boost){
  player.state = 'air';
  if(boost){
    const hv = _v.set(player.vel.x,0,player.vel.z); const sp = hv.length();
    if(sp>1){ hv.normalize(); player.vel.x += hv.x*4; player.vel.z += hv.z*4; }
    player.vel.y += 4.5; if(player.vel.y<2) player.vel.y=2;
    bumpCombo(50,'SWING');
  }
  webLine.visible = false;
}

let zipT = 0;
function startZip(){
  if(player.web < 8) return;
  const a = findAnchor(true); let target;
  if(a){ target = _v.set(a.x,a.y,a.z); }
  else { const f = camForwardFlat(); target = _v.set(player.pos.x+f.x*60, player.pos.y+70, player.pos.z+f.z*60); }
  const dir = _v2.copy(target).sub(player.pos).normalize();
  player.vel.addScaledVector(dir, 62);
  player.vel.y = Math.max(player.vel.y, 18);
  player.web -= 8; player.state='air'; zipT = 0.18;
  const p = zipGeo.attributes.position.array;
  p[0]=player.pos.x; p[1]=player.pos.y; p[2]=player.pos.z; p[3]=target.x; p[4]=target.y; p[5]=target.z;
  zipGeo.attributes.position.needsUpdate = true; zipLine.visible = true;
  bumpCombo(30,'ZIP');
}

function attack(){
  if(player.attackT>0) return;
  player.attackT = 0.4;
  let hit=null, hd=1e9;
  for(const e of enemies){ if(!e.userData.alive) continue; const d=e.position.distanceTo(player.pos); if(d<hd){ hd=d; hit=e; } }
  if(hit && hd < 10) knockout(hit);
}
function knockout(e){
  e.userData.alive=false;
  e.rotation.z = (Math.random()<.5?1:-1)*1.4; e.position.y = 0.2;
  e.traverse(o=>{ if(o.material){ o.material=o.material.clone(); o.material.opacity=0.85; o.material.transparent=true; } });
  player.kos++; bumpCombo(80,'TAKEDOWN'); toast('TAKEDOWN!');
}

/* ============================ COLLISION ============================ */
function resolveCollisions(){
  let hitSide=null;
  for(const b of buildings){
    const minX=b.x-b.w/2-R, maxX=b.x+b.w/2+R, minZ=b.z-b.d/2-R, maxZ=b.z+b.d/2+R;
    if(player.pos.x>minX && player.pos.x<maxX && player.pos.z>minZ && player.pos.z<maxZ && player.pos.y<b.h && player.pos.y>0){
      const penX1=player.pos.x-minX, penX2=maxX-player.pos.x, penZ1=player.pos.z-minZ, penZ2=maxZ-player.pos.z;
      const penTop=(b.h+R)-player.pos.y, mHoriz=Math.min(penX1,penX2,penZ1,penZ2);
      if(penTop<mHoriz && player.vel.y<=0.5){
        player.pos.y = b.h + R*0.2;
        if(player.vel.y<0){ landImpact(); player.vel.y=0; }
        if(player.state!=='swing') player.state='ground';
        continue;
      }
      let nx=0,nz=0;
      if(mHoriz===penX1){ player.pos.x=minX; nx=-1; }
      else if(mHoriz===penX2){ player.pos.x=maxX; nx=1; }
      else if(mHoriz===penZ1){ player.pos.z=minZ; nz=-1; }
      else { player.pos.z=maxZ; nz=1; }
      const vn = player.vel.x*nx + player.vel.z*nz;
      if(vn<0){ player.vel.x-=vn*nx; player.vel.z-=vn*nz; }
      hitSide = { nx, nz };
    }
  }
  return hitSide;
}
let lastFallSpeed=0;
function landImpact(){ if(lastFallSpeed < -35){ toast('Superhero landing!'); bumpCombo(20,'LANDING'); } }

/* ============================ UPDATE ============================ */
let started=false;
const clock = new T.Clock();

function update(dt){
  dt = Math.min(dt, 0.033);
  const GRAV = -46;
  if(player.comboT>0){ player.comboT-=dt; if(player.comboT<=0){ player.combo=0; comboEl.style.opacity='0'; } }
  if(player.attackT>0) player.attackT-=dt;
  if(player.invuln>0) player.invuln-=dt;
  player.web = Math.min(100, player.web + dt*14);
  if(zipT>0){ zipT-=dt; if(zipT<=0) zipLine.visible=false; }

  const steerF = camForwardFlat(), steerR = camRightFlat();
  const inF = (keys['w']?1:0) - (keys['s']?1:0);
  const inR = (keys['d']?1:0) - (keys['a']?1:0);

  if(zipHeld() && player.state!=='wall') startZip();

  if(swingHeld()){
    if(player.state!=='swing' && player.web>2) startSwing();
  } else if(player.state==='swing'){ releaseSwing(true); }

  if(player.state==='swing'){
    player.web = Math.max(0, player.web - dt*9);
    if(player.web<=0){ releaseSwing(true); }
    else {
      player.vel.y += GRAV*dt;
      const toA = _v.copy(player.anchor).sub(player.pos); toA.normalize();
      const tang = _v2.copy(player.vel).addScaledVector(toA, -player.vel.dot(toA));
      if(tang.length()>0.1){ tang.normalize(); player.vel.addScaledVector(tang, 22*dt); }
      player.vel.addScaledVector(steerR, inR*16*dt);
      if(keys['w']) player.ropeLen = Math.max(12, player.ropeLen - 26*dt);
      if(keys['s']) player.ropeLen = Math.min(140, player.ropeLen + 26*dt);
      player.pos.addScaledVector(player.vel, dt);
      const d = _v.copy(player.pos).sub(player.anchor); const dist = d.length();
      if(dist > player.ropeLen){
        d.multiplyScalar(1/dist);
        player.pos.copy(player.anchor).addScaledVector(d, player.ropeLen);
        const radial = player.vel.dot(d); if(radial>0) player.vel.addScaledVector(d, -radial);
      }
      player.vel.multiplyScalar(0.999);
    }
    resolveCollisions();
  }
  else if(player.state==='wall'){
    const n = player.wallNormal;
    const tangH = _v2.set(-n.z, 0, n.x);
    player.vel.set(0,0,0);
    player.pos.y += inF*16*dt;
    player.pos.addScaledVector(tangH, inR*16*dt);
    player.pos.y = Math.max(R, player.pos.y);
    if(keys[' ']||mouseDownL){ player.state='air'; player.vel.copy(n).multiplyScalar(24); player.vel.y=20; }
    else if(!keys['e']){ player.state='air'; player.vel.copy(n).multiplyScalar(6); }
    const bb = buildingAt(player.pos.x, player.pos.z);
    if(bb && player.pos.y>=bb.h){ player.pos.y=bb.h+R*0.2; player.state='ground'; }
  }
  else if(player.state==='ground'){
    player.airTime = 0;
    const accel=120, maxSp=30;
    player.vel.x += (steerF.x*inF + steerR.x*inR)*accel*dt;
    player.vel.z += (steerF.z*inF + steerR.z*inR)*accel*dt;
    player.vel.x*=0.86; player.vel.z*=0.86;
    const hs=Math.hypot(player.vel.x,player.vel.z);
    if(hs>maxSp){ player.vel.x*=maxSp/hs; player.vel.z*=maxSp/hs; }
    player.vel.y=0;
    if(keys[' ']||mouseDownL){ if(!startSwing()){ player.vel.y=26; player.state='air'; } }
    player.pos.addScaledVector(player.vel, dt);
    const bb = buildingAt(player.pos.x, player.pos.z);
    const floorY = bb ? bb.h : GROUND_Y;
    if(player.pos.y > floorY + R*0.5 + 0.5) player.state='air';
    else player.pos.y = floorY + R*0.2;
    resolveCollisions();
    if(keys['f']) attack();
  }
  else {
    player.airTime += dt;
    player.vel.y += GRAV*dt;
    player.vel.x += (steerF.x*inF + steerR.x*inR)*40*dt;
    player.vel.z += (steerF.z*inF + steerR.z*inR)*40*dt;
    player.vel.x*=0.995; player.vel.z*=0.995;
    lastFallSpeed = player.vel.y;
    player.pos.addScaledVector(player.vel, dt);
    if(keys['e']){
      const side = resolveCollisions();
      if(side){ player.state='wall'; player.wallNormal.set(side.nx,0,side.nz).normalize(); }
    } else resolveCollisions();
    if(keys['f']) attack();
    if(player.pos.y <= GROUND_Y + R*0.2){
      const bb = buildingAt(player.pos.x, player.pos.z);
      if(!bb){ player.pos.y=GROUND_Y+R*0.2; if(player.vel.y<0) landImpact(); player.vel.y=0; player.state='ground'; }
    }
  }

  const B = HALF + 120;
  player.pos.x = Math.max(-B, Math.min(B, player.pos.x));
  player.pos.z = Math.max(-B, Math.min(B, player.pos.z));

  const hv = _v.set(player.vel.x,0,player.vel.z);
  if(hv.length()>3) player.facing.copy(hv.normalize());

  for(let i=tokens.length-1;i>=0;i--){
    const tk=tokens[i];
    tk.rotation.y += dt*2; tk.rotation.x += dt*1.1;
    tk.position.y += Math.sin(performance.now()*0.003 + i)*0.02;
    if(tk.position.distanceTo(player.pos) < 5){
      scene.remove(tk); tokens.splice(i,1);
      player.tokens++; player.score+=25; bumpCombo(25,'TOKEN'); toast('Token collected  +25');
    }
  }
  for(const e of enemies){
    if(!e.userData.alive) continue;
    e.userData.wanderT -= dt;
    if(e.userData.wanderT<=0){ e.userData.dir=Math.random()*Math.PI*2; e.userData.wanderT=2+Math.random()*4; }
    e.position.x += Math.cos(e.userData.dir)*dt*4;
    e.position.z += Math.sin(e.userData.dir)*dt*4;
    e.rotation.y = -e.userData.dir + Math.PI/2;
    if(player.state==='air' && player.vel.y<-14 && e.position.distanceTo(player.pos)<7) knockout(e);
  }

  updateModel(dt); updateCamera(dt); updateHUD();
}

/* ============================ MODEL ANIMATION ============================ */
let animT=0;
function updateModel(dt){
  animT += dt;
  hero.position.copy(player.pos);
  if(player.state==='wall'){
    const n = player.wallNormal;
    hero.lookAt(player.pos.x-n.x, player.pos.y, player.pos.z-n.z);
    armL.rotation.set(0.3,0,-1.6); armR.rotation.set(0.3,0,1.6);
    legL.rotation.set(0,0,-0.5); legR.rotation.set(0,0,0.5);
  } else {
    const look = _v.copy(player.pos).add(player.facing);
    hero.lookAt(look.x, player.pos.y + player.vel.y*0.02, look.z);
  }

  if(player.state==='swing'){
    armL.rotation.set(-2.4,0,-0.25); armR.rotation.set(-2.4,0,0.25);
    const s = Math.sin(animT*4)*0.3;
    legL.rotation.set(0.6+s,0,-0.15); legR.rotation.set(0.6-s,0,0.15);
    hero.rotation.z = 0;
  } else if(player.state==='ground'){
    const sp = Math.hypot(player.vel.x,player.vel.z);
    if(sp>1){ const c=Math.sin(animT*10);
      legL.rotation.set(c*0.8,0,0); legR.rotation.set(-c*0.8,0,0);
      armL.rotation.set(-c*0.6,0,-0.1); armR.rotation.set(c*0.6,0,0.1);
    } else { legL.rotation.set(0,0,0); legR.rotation.set(0,0,0); armL.rotation.set(0,0,-0.1); armR.rotation.set(0,0,0.1); }
  } else if(player.state==='air'){
    if(player.attackT>0){ legL.rotation.set(-1.6,0,0); legR.rotation.set(-1.4,0,0); armL.rotation.set(2.2,0,-0.3); armR.rotation.set(2.2,0,0.3); }
    else { armL.rotation.set(-1.8,0,-0.7); armR.rotation.set(-1.8,0,0.7); legL.rotation.set(0.5,0,-0.4); legR.rotation.set(0.5,0,0.4); }
  }

  if(player.state==='swing'){
    const hand = (player.swingHand>0?armR:armL);
    hand.updateWorldMatrix(true,false);
    const hp = new T.Vector3(); hand.getWorldPosition(hp);
    const a = webGeo.attributes.position.array;
    a[0]=hp.x; a[1]=hp.y; a[2]=hp.z; a[3]=player.anchor.x; a[4]=player.anchor.y; a[5]=player.anchor.z;
    webGeo.attributes.position.needsUpdate = true; webLine.visible = true;
  } else webLine.visible = false;
}

/* ============================ CAMERA ============================ */
const camPos = new T.Vector3(0, 200, 60), camTgt = new T.Vector3();
function updateCamera(dt){
  const speed = player.vel.length();
  const dist = 16 + Math.min(speed*0.12, 10), height = 5 + Math.min(speed*0.03, 4);
  const dir = new T.Vector3(Math.sin(yaw)*Math.cos(pitch), Math.sin(pitch), Math.cos(yaw)*Math.cos(pitch));
  const desired = _v.copy(player.pos).addScaledVector(dir, dist); desired.y += height;
  if(desired.y < 3) desired.y = 3;
  const lerp = 1 - Math.pow(0.001, dt);
  camPos.lerp(desired, Math.min(1, lerp*1.6)); camera.position.copy(camPos);
  const ahead = _v2.copy(player.facing).multiplyScalar(Math.min(speed*0.15,8));
  camTgt.lerp(_v3.copy(player.pos).add(ahead).add(new T.Vector3(0,2.5,0)), Math.min(1, lerp*2));
  camera.lookAt(camTgt);
  const targetFov = 62 + Math.min(speed*0.22, 26);
  camera.fov += (targetFov - camera.fov)*Math.min(1,dt*4); camera.updateProjectionMatrix();
}

/* ============================ HUD ============================ */
const el = {
  hp:document.getElementById('hpfill'), web:document.getElementById('webfill'),
  tok:document.getElementById('tok'), kos:document.getElementById('kos'),
  score:document.getElementById('score'), speed:document.getElementById('speedbig'),
  alt:document.getElementById('alt'), state:document.getElementById('statelbl'),
};
function updateHUD(){
  el.hp.style.width = player.hp+'%'; el.web.style.width = player.web+'%';
  el.tok.textContent = player.tokens; el.kos.textContent = player.kos; el.score.textContent = player.score;
  el.speed.innerHTML = ((player.vel.length()*2.1)|0)+'<small>mph</small>';
  el.alt.textContent = (player.pos.y*3.28)|0; el.state.textContent = player.state.toUpperCase();
}

/* ============================ LOOP ============================ */
function frame(){
  requestAnimationFrame(frame);
  const dt = clock.getDelta();
  if(started) update(dt);
  renderer.render(scene, camera);
}

respawn();
camera.position.set(0, 240, 120); camera.lookAt(0, 120, 0);
const loadEl = document.getElementById('loading');
if(loadEl){ loadEl.classList.add('fade'); setTimeout(()=>loadEl.remove(), 600); }
frame();

document.getElementById('goBtn').addEventListener('click', ()=>{
  const s=document.getElementById('start'); s.classList.add('fade'); setTimeout(()=>{ if(s.parentNode) s.remove(); }, 550);
  started = true; clock.getDelta(); canvas.requestPointerLock();
  toast('Hold SPACE or LEFT-CLICK to swing');
});
addEventListener('blur', ()=>{ mouseDownL=mouseDownR=false; for(const k in keys) keys[k]=false; });
})();
