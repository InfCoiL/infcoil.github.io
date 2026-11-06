import * as THREE from 'three';
import {OrbitControls} from './vendor/three/examples/jsm/controls/OrbitControls.js';

const $=s=>document.getElementById(s), base='assets/v2/';

const OBJECT_LABELS={
  largetable:'Table',
  table:'Table',
  tripod:'Tripod',
  woodchair:'Wood chair',
  floorlamp:'Floor lamp',
  monitor:'Monitor'
};

const FALLBACK_CURATED=[
  {id:'s2-long-table',object:'largetable',title:'Table'},
  {id:'s2-long-tripod',object:'tripod',title:'Tripod'},
  {id:'c45-s2-woodchair',object:'woodchair',title:'Wood chair'},
  {id:'floorlamp-ours',object:'floorlamp',title:'Floor lamp'},
  {id:'monitor-ours',object:'monitor',title:'Monitor'}
];

function cleanText(t){
  return String(t||'').replace(/\u00b7/g,' ').replace(/\s+/g,' ').trim();
}

function formatCuratedTitle(c){
  if(!c)return 'Recorded motion';
  const rawTitle=cleanText(c.title);
  if(rawTitle)return rawTitle;
  const objKey=String(c.object||'').toLowerCase();
  if(OBJECT_LABELS[objKey])return OBJECT_LABELS[objKey];
  return cleanText(c.object||c.id||'Motion');
}

let manifest,curatedCases=[],curatedById=new Map(),active,activeCurated=null,raw,smoothed,meshes=[],playing=false,time=0,last=0,serial=0,physics=null,mj=null,pushUntil=0,loading=false;

const status=t=>{$('status').textContent=cleanText(t);};

const scene=new THREE.Scene();
scene.background=new THREE.Color('#e9e8e1');
scene.up.set(0,0,1);

const camera=new THREE.PerspectiveCamera(38,1,.02,180);
camera.up.set(0,0,1);

let renderer;
try{
  renderer=new THREE.WebGLRenderer({antialias:true});
}catch(e){
  status('3D rendering is unavailable in this browser. Use the recorded videos.');
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
$('viewport').appendChild(renderer.domElement);

const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;
controls.minDistance=0.8;
controls.maxDistance=35;
controls.maxPolarAngle=Math.PI*.49;

scene.add(new THREE.HemisphereLight(0xffffff,0x64766b,2.1));
const sun=new THREE.DirectionalLight(0xfff7e8,3);
sun.position.set(3,-4,7);
sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-10;
sun.shadow.camera.right=10;
sun.shadow.camera.top=10;
sun.shadow.camera.bottom=-10;
sun.shadow.normalBias=.025;
scene.add(sun);
scene.add(sun.target);

const plane=new THREE.Mesh(
  new THREE.PlaneGeometry(200,200),
  new THREE.MeshStandardMaterial({color:0xdeddd4,roughness:.95})
);
plane.position.z=-.025;
plane.receiveShadow=true;
scene.add(plane);

const grid=new THREE.GridHelper(36,72,0xb5beb5,0xcbd0c6);
grid.rotation.x=Math.PI/2;
grid.position.z=-.022;
grid.material.transparent=true;
grid.material.opacity=.25;
scene.add(grid);

const bodyMat=new THREE.MeshStandardMaterial({color:0x237e80,roughness:.4,metalness:.12});
const objectMat=new THREE.MeshStandardMaterial({color:0xdc7351,roughness:.5});

const goalGroup=new THREE.Group();
goalGroup.name='goalMarkers';
scene.add(goalGroup);

const objGoalMat=new THREE.MeshBasicMaterial({color:0x0969da,side:THREE.DoubleSide});
const objGoalFillMat=new THREE.MeshBasicMaterial({color:0x0969da,side:THREE.DoubleSide,transparent:true,opacity:0.09,depthWrite:false});
const objGoalLineMat=new THREE.LineBasicMaterial({color:0x0969da});

const pelvisGoalMat=new THREE.MeshBasicMaterial({color:0xd97706,side:THREE.DoubleSide});
const pelvisGoalFillMat=new THREE.MeshBasicMaterial({color:0xd97706,side:THREE.DoubleSide,transparent:true,opacity:0.10,depthWrite:false});
const pelvisGoalLineMat=new THREE.LineBasicMaterial({color:0xd97706});

function clearGoalMarkers(){
  while(goalGroup.children.length){
    const ch=goalGroup.children[0];
    goalGroup.remove(ch);
    if(ch.geometry)ch.geometry.dispose();
  }
}

function isValidVec3(v){
  return Array.isArray(v)&&v.length>=3&&Number.isFinite(+v[0])&&Number.isFinite(+v[1])&&Number.isFinite(+v[2]);
}

function resolveGoals(curatedEntry,rawData,frames){
  let objGoal=isValidVec3(curatedEntry?.object_goal)?curatedEntry.object_goal.map(Number):null;
  let pelGoal=isValidVec3(curatedEntry?.pelvis_goal)?curatedEntry.pelvis_goal.map(Number):null;
  if(!objGoal||!pelGoal)throw Error('Verified target coordinates missing');
  return {object_goal:objGoal,pelvis_goal:pelGoal};
}

function buildGoalMarkers(goals){
  clearGoalMarkers();
  const zGround=0.003;

  if(isValidVec3(goals?.object_goal)){
    const [ox,oy,oz]=goals.object_goal;
    const zTop=Math.max(zGround+0.02,oz);

    // Blue object target ring (r = 0.3) on ground
    const ringMesh=new THREE.Mesh(new THREE.RingGeometry(0.276,0.30,64),objGoalMat);
    ringMesh.position.set(ox,oy,zGround);
    goalGroup.add(ringMesh);

    const fillMesh=new THREE.Mesh(new THREE.CircleGeometry(0.276,64),objGoalFillMat);
    fillMesh.position.set(ox,oy,zGround-0.0005);
    goalGroup.add(fillMesh);

    // Short vertical stem ending at object target XYZ
    const stemHeight=Math.max(0.02,zTop-zGround);
    const stemGeom=new THREE.CylinderGeometry(0.006,0.006,stemHeight,12);
    stemGeom.rotateX(Math.PI/2);
    const stemMesh=new THREE.Mesh(stemGeom,objGoalMat);
    stemMesh.position.set(ox,oy,zGround+stemHeight*0.5);
    goalGroup.add(stemMesh);

    // Small 3D crosshair at object target XYZ (and ground center tick)
    const arm=0.075,zArm=0.055;
    const crossVerts=new Float32Array([
      ox-arm,oy,zTop, ox+arm,oy,zTop,
      ox,oy-arm,zTop, ox,oy+arm,zTop,
      ox,oy,Math.max(zGround,zTop-zArm), ox,oy,zTop+zArm,
      ox-0.045,oy,zGround+0.001, ox+0.045,oy,zGround+0.001,
      ox,oy-0.045,zGround+0.001, ox,oy+0.045,zGround+0.001
    ]);
    const crossGeom=new THREE.BufferGeometry();
    crossGeom.setAttribute('position',new THREE.BufferAttribute(crossVerts,3));
    goalGroup.add(new THREE.LineSegments(crossGeom,objGoalLineMat));

    const centerDot=new THREE.Mesh(new THREE.SphereGeometry(0.016,16,12),objGoalMat);
    centerDot.position.set(ox,oy,zTop);
    goalGroup.add(centerDot);
  }

  if(isValidVec3(goals?.pelvis_goal)){
    const [px,py]=goals.pelvis_goal;
    const zPelvis=0.004;

    // Amber pelvis target ring (r = 0.16) on ground
    const pRingMesh=new THREE.Mesh(new THREE.RingGeometry(0.140,0.16,48),pelvisGoalMat);
    pRingMesh.position.set(px,py,zPelvis);
    goalGroup.add(pRingMesh);

    const pFillMesh=new THREE.Mesh(new THREE.CircleGeometry(0.140,48),pelvisGoalFillMat);
    pFillMesh.position.set(px,py,zPelvis-0.0005);
    goalGroup.add(pFillMesh);

    const pArm=0.048;
    const pCrossVerts=new Float32Array([
      px-pArm,py,zPelvis+0.001, px+pArm,py,zPelvis+0.001,
      px,py-pArm,zPelvis+0.001, px,py+pArm,zPelvis+0.001
    ]);
    const pCrossGeom=new THREE.BufferGeometry();
    pCrossGeom.setAttribute('position',new THREE.BufferAttribute(pCrossVerts,3));
    goalGroup.add(new THREE.LineSegments(pCrossGeom,pelvisGoalLineMat));
  }

  updateGoalVisibility();
}

function updateGoalVisibility(){
  const show=$('goals')?$('goals').checked:true;
  goalGroup.visible=show;
  if($('goal-legend'))$('goal-legend').hidden=!show;
}

function fitCameraToScene(c,goals){
  const v=$('viewport');
  if(v&&v.clientWidth>0&&v.clientHeight>0){
    camera.aspect=v.clientWidth/v.clientHeight;
  }
  let minX=c.bounds[0][0],minY=c.bounds[0][1],minZ=Math.min(0,c.bounds[0][2]);
  let maxX=c.bounds[1][0],maxY=c.bounds[1][1],maxZ=Math.max(1.65,c.bounds[1][2]);

  if(isValidVec3(goals?.object_goal)){
    const [ox,oy,oz]=goals.object_goal;
    minX=Math.min(minX,ox-0.36);
    maxX=Math.max(maxX,ox+0.36);
    minY=Math.min(minY,oy-0.36);
    maxY=Math.max(maxY,oy+0.36);
    maxZ=Math.max(maxZ,oz+0.15);
  }
  if(isValidVec3(goals?.pelvis_goal)){
    const [px,py,pz]=goals.pelvis_goal;
    minX=Math.min(minX,px-0.22);
    maxX=Math.max(maxX,px+0.22);
    minY=Math.min(minY,py-0.22);
    maxY=Math.max(maxY,py+0.22);
    maxZ=Math.max(maxZ,(pz||0)+0.15);
  }

  const cx=(minX+maxX)*0.5;
  const cy=(minY+maxY)*0.5;
  const cz=Math.max(0.65,Math.min(0.95,(minZ+maxZ)*0.48));
  const spanX=maxX-minX,spanY=maxY-minY,spanZ=maxZ-minZ;
  const radius=Math.max(1.15,0.5*Math.hypot(spanX,spanY,spanZ));

  const vFov=THREE.MathUtils.degToRad(camera.fov*0.5);
  const hFov=Math.atan(Math.tan(vFov)*Math.max(0.55,camera.aspect));
  const halfFov=Math.min(vFov,hFov);
  const dist=Math.max(3.4,(radius*1.22)/Math.sin(halfFov));

  const center=new THREE.Vector3(cx,cy,cz);
  controls.target.copy(center);
  const viewDir=new THREE.Vector3(2.4,-3.4,1.9).normalize();
  camera.position.copy(center).addScaledVector(viewDir,dist);
  camera.near=0.02;
  camera.far=Math.max(160,dist*6);
  camera.updateProjectionMatrix();

  const shadowSpan=Math.max(8,radius*1.6);
  sun.shadow.camera.left=-shadowSpan;
  sun.shadow.camera.right=shadowSpan;
  sun.shadow.camera.top=shadowSpan;
  sun.shadow.camera.bottom=-shadowSpan;
  sun.shadow.camera.updateProjectionMatrix();
  sun.target.position.copy(center);
  sun.position.copy(center).add(new THREE.Vector3(3,-4,7));

  controls.update();
}

const resize=()=>{
  const v=$('viewport');
  renderer.setSize(v.clientWidth,v.clientHeight);
  camera.aspect=v.clientWidth/v.clientHeight;
  camera.updateProjectionMatrix();
};
new ResizeObserver(resize).observe($('viewport'));

async function fetchOK(url,type){
  const r=await fetch(url);
  if(!r.ok)throw Error(`${url}: ${r.status}`);
  return type==='binary'?new Float32Array(await r.arrayBuffer()):r.json();
}

function setPlaying(v){
  playing=v;
  $('play').textContent=v?'Pause':'Play';
}

function disposePhysics(){
  if(physics){
    physics.data.delete();
    physics.model.delete();
    physics=null;
  }
}

function poseAt(a,frame,i){
  return a.subarray((frame*53+i)*7,(frame*53+i+1)*7);
}

function drawPose(){
  if(!active)return;
  const f=Math.min(active.frames-1,Math.floor(time*30));
  const a=physics?raw:($('smooth').checked?smoothed:raw);
  for(let i=0;i<53;i++){
    const p=poseAt(a,f,i);
    meshes[i].position.fromArray(p);
    meshes[i].quaternion.fromArray(p,3);
  }
  if(physics){
    const q=physics.data.qpos;
    meshes[52].position.set(q[0],q[1],q[2]);
    meshes[52].quaternion.set(q[4],q[5],q[6],q[3]);
  }
  $('timeline').value=time;
  $('clock').textContent=`${time.toFixed(2)} s`;
}

async function loadCase(requestedId){
  let token=++serial;
  loading=true;
  $('motion').disabled=true;
  setPlaying(false);
  $('play').disabled=true;
  $('reset').disabled=true;
  $('mode').disabled=true;
  status('Loading motion…');
  disposePhysics();

  try{
    let curatedEntry=curatedById.get(requestedId);
    if(!curatedEntry&&curatedCases.length){
      curatedEntry=curatedCases[0];
    }
    const id=curatedEntry?curatedEntry.id:requestedId;
    if($('motion').value!==id)$('motion').value=id;

    const c=manifest.cases.find(x=>x.id===id);
    if(!c)throw Error(`Unknown case ${id}`);

    const [g,r,s]=await Promise.all([
      fetchOK(base+c.geometry),
      fetchOK(base+id+'-raw.bin','binary'),
      fetchOK(base+id+'-smooth.bin','binary')
    ]);
    if(token!==serial)return;

    for(const m of meshes){
      scene.remove(m);
      m.geometry.dispose();
    }
    meshes=[];
    for(let i=0;i<g.length;i++){
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(g[i].vertices.flat(),3));
      geometry.setIndex(g[i].faces.flat());
      geometry.computeVertexNormals();
      const mesh=new THREE.Mesh(geometry,i<52?bodyMat:objectMat);
      mesh.castShadow=true;
      mesh.receiveShadow=true;
      scene.add(mesh);
      meshes.push(mesh);
    }

    active=c;
    activeCurated=curatedEntry||{id:c.id,object:c.object,title:OBJECT_LABELS[c.object]||c.object};
    raw=r;
    smoothed=s;
    time=0;
    $('timeline').max=(c.frames-1)/30;

    const goals=resolveGoals(activeCurated,raw,c.frames);
    activeCurated={...activeCurated,...goals};
    buildGoalMarkers(goals);
    fitCameraToScene(c,goals);

    $('play').disabled=false;
    $('reset').disabled=false;
    $('mode').disabled=false;
    loading=false;
    await changeMode();
    drawPose();
  }catch(e){
    status('Unable to load this motion. Please reload.');
    console.error(e);
    loading=false;
    $('motion').disabled=false;
  }
}

async function changeMode(){
  setPlaying(false);
  disposePhysics();
  time=0;
  const sandbox=$('mode').value==='physics';
  $('push').hidden=!sandbox;
  $('timeline').disabled=sandbox;
  $('smooth-label').hidden=sandbox;
  $('play').disabled=true;
  $('reset').disabled=true;
  $('mode').disabled=true;
  $('motion').disabled=true;

  try{
    if(sandbox){
      status('Loading MuJoCo physics…');
      if(!mj){
        const mod=await import('./vendor/mujoco/mujoco.js');
        mj=await mod.default();
      }
      const response=await fetch(base+active.object+'-sandbox.xml');
      if(!response.ok)throw Error('Physics model missing');
      const model=mj.MjModel.from_xml_string(await response.text());
      const data=new mj.MjData(model);
      physics={model,data};
      resetPhysics();
      status(`${formatCuratedTitle(activeCurated)} MuJoCo live physics (recorded body, dynamic object)`);
      $('description').textContent='Press Play, then push the object. Body motion follows the recording; only the object responds to live physics. The trained policy is not running.';
    }else{
      status(`${formatCuratedTitle(activeCurated)} recorded trajectory`);
      $('description').textContent='Drag to inspect the interaction and goal markers from any angle. Toggle display smoothing to compare with the original recorded poses. Raw pelvis and object translations are preserved.';
    }
    $('play').disabled=false;
    $('reset').disabled=false;
  }catch(e){
    console.error(e);
    status('MuJoCo could not start. Recorded replay remains available.');
    $('mode').value='replay';
    disposePhysics();
    $('timeline').disabled=false;
    $('push').hidden=true;
    $('smooth-label').hidden=false;
    $('play').disabled=false;
    $('reset').disabled=false;
  }finally{
    $('mode').disabled=false;
    $('motion').disabled=false;
    drawPose();
  }
}

function resetPhysics(){
  if(!physics)return;
  mj.mj_resetData(physics.model,physics.data);
  const p=poseAt(raw,0,52);
  physics.data.qpos.set([p[0],p[1],p[2],p[6],p[3],p[4],p[5]]);
  pushUntil=0;
  setMocap(0);
  mj.mj_forward(physics.model,physics.data);
}

function setMocap(t){
  const f=Math.min(active.frames-1,Math.floor(t*30));
  for(let i=0;i<52;i++){
    const p=poseAt(raw,f,i);
    physics.data.mocap_pos.set(p.subarray(0,3),i*3);
    physics.data.mocap_quat.set([p[6],p[3],p[4],p[5]],i*4);
  }
}

function populateCuratedSelect(list){
  const sel=$('motion');
  sel.innerHTML='';
  for(const item of list){
    const opt=document.createElement('option');
    opt.value=item.id;
    opt.textContent=formatCuratedTitle(item);
    sel.appendChild(opt);
  }
}

$('play').onclick=()=>{
  if(time>=(active.frames-1)/30){
    time=0;
    resetPhysics();
  }
  setPlaying(!playing);
};
$('reset').onclick=()=>{
  setPlaying(false);
  time=0;
  resetPhysics();
  drawPose();
};
$('timeline').oninput=()=>{
  setPlaying(false);
  time=+$('timeline').value;
  drawPose();
};
$('smooth').onchange=drawPose;
if($('goals'))$('goals').onchange=updateGoalVisibility;
$('mode').onchange=changeMode;
$('motion').onchange=()=>loadCase($('motion').value);
$('push').onclick=()=>{
  if(physics){
    pushUntil=physics.data.time+.12;
    setPlaying(true);
  }
};

function tick(now){
  requestAnimationFrame(tick);
  let dt=Math.min((now-last)/1000,.05);
  last=now;
  if(playing&&active&&!loading){
    if(physics){
      const end=Math.min(physics.data.time+dt,(active.frames-1)/30);
      while(physics.data.time<end){
        setMocap(physics.data.time);
        physics.data.xfrc_applied.fill(0);
        if(physics.data.time<pushUntil)physics.data.xfrc_applied[53*6]=55;
        mj.mj_step(physics.model,physics.data);
      }
      time=physics.data.time;
    }else{
      time+=dt;
    }
    if(time>=(active.frames-1)/30){
      time=(active.frames-1)/30;
      setPlaying(false);
    }
    drawPose();
  }
  controls.update();
  renderer.render(scene,camera);
}

window.__playground={
  get state(){
    return {
      ready:!!active&&!loading,
      case:active?.id,
      objectName:active?.object,
      title:activeCurated?formatCuratedTitle(activeCurated):null,
      curatedIds:curatedCases.map(c=>c.id),
      object_goal:activeCurated?.object_goal||null,
      pelvis_goal:activeCurated?.pelvis_goal||null,
      goalsVisible:goalGroup.visible,
      time,
      playing,
      physics:!!physics,
      simTime:physics?.data.time,
      contacts:physics?.data.ncon,
      object:meshes[52]?.position.toArray()
    };
  }
};

requestAnimationFrame(tick);

try{
  const [curatedData,motionsData]=await Promise.all([
    fetchOK(base+'curated.json'),
    fetchOK(base+'motions.json')
  ]);
  manifest=motionsData;
  const validManifestIds=new Set((manifest.cases||[]).map(c=>c.id));
  const rawList=Array.isArray(curatedData?.cases)?curatedData.cases:[];
  curatedCases=rawList.filter(c=>c&&validManifestIds.has(c.id));
  if(!curatedCases.length){
    throw Error('No verified curated demonstrations');
  }
  curatedById=new Map(curatedCases.map(c=>[c.id,c]));
  populateCuratedSelect(curatedCases);

  const defaultCase=
    curatedCases.find(c=>c.id==='s2-long-table'||/table/i.test(`${c.object||''} ${c.title||''}`))||
    curatedCases[0];
  if(defaultCase){
    $('motion').value=defaultCase.id;
    await loadCase(defaultCase.id);
  }
}catch(e){
  status('Motion data could not be loaded.');
  console.error(e);
}

document.addEventListener('visibilitychange',()=>{
  if(document.hidden)setPlaying(false);
});
