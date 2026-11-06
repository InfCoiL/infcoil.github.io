import * as THREE from 'three';
import {OrbitControls} from './vendor/three/examples/jsm/controls/OrbitControls.js';
const $=s=>document.getElementById(s), base='assets/v2/';
const CASE_NAMES={
  's2-long-table':'Table transport (C45k, S=2)',
  's2-long-tripod':'Tripod transport (C45k, S=2)',
  'c45-s2-woodchair':'Wood chair (new C45k, S=2)',
  'c45-s1-woodchair':'Wood chair (new C45k, S=1)',
  'monitor-ours':'Monitor (InfCoiL)',
  'monitor-sft':'Monitor (SFT cascade)',
  'monitor-student':'Monitor (InterMimic student)',
  'suitcase-ours':'Suitcase (InfCoiL)',
  'floorlamp-ours':'Floor lamp (InfCoiL)',
  'woodchair-ours':'Wood chair (InfCoiL)'
};
function formatCaseTitle(c){
  if(!c)return 'Recorded motion';
  if(CASE_NAMES[c.id])return CASE_NAMES[c.id];
  return String(c.object||c.id||'Motion').replace(/\u00b7/g,' ').replace(/\s+/g,' ').trim();
}
let manifest,active,raw,smoothed,meshes=[],playing=false,time=0,last=0,serial=0,physics=null,mj=null,pushUntil=0,loading=false;
const status=t=>{$('status').textContent=t;};
const scene=new THREE.Scene();scene.background=new THREE.Color('#e9e8e1');scene.up.set(0,0,1);
const camera=new THREE.PerspectiveCamera(38,1,.01,150);camera.up.set(0,0,1);
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true});}catch(e){status('3D rendering is unavailable in this browser. Use the recorded videos.');throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
$('viewport').appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=1;controls.maxDistance=20;controls.maxPolarAngle=Math.PI*.49;
scene.add(new THREE.HemisphereLight(0xffffff,0x64766b,2.1));const sun=new THREE.DirectionalLight(0xfff7e8,3);sun.position.set(3,-4,7);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-8;sun.shadow.camera.right=8;sun.shadow.camera.top=8;sun.shadow.camera.bottom=-8;sun.shadow.normalBias=.025;scene.add(sun);scene.add(sun.target);
const plane=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0xdeddd4,roughness:.95}));plane.position.z=-.025;plane.receiveShadow=true;scene.add(plane);
const grid=new THREE.GridHelper(30,60,0xb5beb5,0xcbd0c6);grid.rotation.x=Math.PI/2;grid.position.z=-.022;grid.material.transparent=true;grid.material.opacity=.25;scene.add(grid);
const bodyMat=new THREE.MeshStandardMaterial({color:0x237e80,roughness:.4,metalness:.12}),objectMat=new THREE.MeshStandardMaterial({color:0xdc7351,roughness:.5});
const resize=()=>{let v=$('viewport');renderer.setSize(v.clientWidth,v.clientHeight);camera.aspect=v.clientWidth/v.clientHeight;camera.updateProjectionMatrix();};new ResizeObserver(resize).observe($('viewport'));
async function fetchOK(url,type){const r=await fetch(url);if(!r.ok)throw Error(`${url}: ${r.status}`);return type==='binary'?new Float32Array(await r.arrayBuffer()):r.json();}
function setPlaying(v){playing=v;$('play').textContent=v?'Pause':'Play';}
function disposePhysics(){if(physics){physics.data.delete();physics.model.delete();physics=null;}}
function poseAt(a,frame,i){return a.subarray((frame*53+i)*7,(frame*53+i+1)*7);}
function drawPose(){if(!active)return;const f=Math.min(active.frames-1,Math.floor(time*30)),a=physics?raw:($('smooth').checked?smoothed:raw);for(let i=0;i<53;i++){const p=poseAt(a,f,i);meshes[i].position.fromArray(p);meshes[i].quaternion.fromArray(p,3);}
 if(physics){const q=physics.data.qpos;meshes[52].position.set(q[0],q[1],q[2]);meshes[52].quaternion.set(q[4],q[5],q[6],q[3]);}
 $('timeline').value=time;$('clock').textContent=`${time.toFixed(2)} s`;
}
async function loadCase(id){let token=++serial;loading=true;$('motion').disabled=true;setPlaying(false);$('play').disabled=true;$('reset').disabled=true;$('mode').disabled=true;status('Loading motion…');disposePhysics();
 try{const c=manifest.cases.find(c=>c.id===id);const [g,r,s]=await Promise.all([fetchOK(base+c.geometry),fetchOK(base+id+'-raw.bin','binary'),fetchOK(base+id+'-smooth.bin','binary')]);if(token!==serial)return;
 for(const m of meshes){scene.remove(m);m.geometry.dispose();}meshes=[];for(let i=0;i<g.length;i++){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(g[i].vertices.flat(),3));geometry.setIndex(g[i].faces.flat());geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,i<52?bodyMat:objectMat);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);meshes.push(mesh);}
 active=c;raw=r;smoothed=s;time=0;$('timeline').max=(c.frames-1)/30;const center=new THREE.Vector3((c.bounds[0][0]+c.bounds[1][0])/2,(c.bounds[0][1]+c.bounds[1][1])/2,.85);controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(2.4,-3.4,1.9));sun.target.position.copy(center);sun.position.copy(center).add(new THREE.Vector3(3,-4,7));controls.update();$('play').disabled=false;$('reset').disabled=false;$('mode').disabled=false;loading=false;await changeMode();drawPose();
 }catch(e){status('Unable to load this motion. Please reload.');console.error(e);loading=false;$('motion').disabled=false;}}
async function changeMode(){setPlaying(false);disposePhysics();time=0;const sandbox=$('mode').value==='physics';$('push').hidden=!sandbox;$('timeline').disabled=sandbox;$('smooth-label').hidden=sandbox;$('play').disabled=true;$('reset').disabled=true;$('mode').disabled=true;$('motion').disabled=true;
 try{if(sandbox){status('Loading MuJoCo physics…');if(!mj){const mod=await import('./vendor/mujoco/mujoco.js');mj=await mod.default();}const response=await fetch(base+active.object+'-sandbox.xml');if(!response.ok)throw Error('Physics model missing');const model=mj.MjModel.from_xml_string(await response.text());const data=new mj.MjData(model);physics={model,data};resetPhysics();status('MuJoCo live physics (recorded body, dynamic object)');$('description').textContent='Press Play, then push the object. Body motion follows the recording; only the object responds to live physics. The trained policy is not running.';
 }else{status(`${formatCaseTitle(active)} recorded trajectory`);$('description').textContent='Drag to inspect the interaction from any angle. Toggle display smoothing to compare with the original recorded poses. Raw pelvis and object translations are preserved.';}
 $('play').disabled=false;$('reset').disabled=false;
 }catch(e){console.error(e);status('MuJoCo could not start. Recorded replay remains available.');$('mode').value='replay';disposePhysics();$('timeline').disabled=false;$('push').hidden=true;$('smooth-label').hidden=false;$('play').disabled=false;$('reset').disabled=false;}finally{$('mode').disabled=false;$('motion').disabled=false;drawPose();}}
function resetPhysics(){if(!physics)return;mj.mj_resetData(physics.model,physics.data);const p=poseAt(raw,0,52);physics.data.qpos.set([p[0],p[1],p[2],p[6],p[3],p[4],p[5]]);pushUntil=0;setMocap(0);mj.mj_forward(physics.model,physics.data);}
function setMocap(t){const f=Math.min(active.frames-1,Math.floor(t*30));for(let i=0;i<52;i++){const p=poseAt(raw,f,i);physics.data.mocap_pos.set(p.subarray(0,3),i*3);physics.data.mocap_quat.set([p[6],p[3],p[4],p[5]],i*4);}}
$('play').onclick=()=>{if(time>=(active.frames-1)/30){time=0;resetPhysics();}setPlaying(!playing);};$('reset').onclick=()=>{setPlaying(false);time=0;resetPhysics();drawPose();};$('timeline').oninput=()=>{setPlaying(false);time=+$('timeline').value;drawPose();};$('smooth').onchange=drawPose;$('mode').onchange=changeMode;$('motion').onchange=()=>loadCase($('motion').value);$('push').onclick=()=>{if(physics){pushUntil=physics.data.time+.12;setPlaying(true);}};
function tick(now){requestAnimationFrame(tick);let dt=Math.min((now-last)/1000,.05);last=now;if(playing&&active&&!loading){if(physics){const end=Math.min(physics.data.time+dt,(active.frames-1)/30);while(physics.data.time<end){setMocap(physics.data.time);physics.data.xfrc_applied.fill(0);if(physics.data.time<pushUntil)physics.data.xfrc_applied[53*6]=55;mj.mj_step(physics.model,physics.data);}time=physics.data.time;}else time+=dt;if(time>=(active.frames-1)/30){time=(active.frames-1)/30;setPlaying(false);}drawPose();}controls.update();renderer.render(scene,camera);}
window.__playground={get state(){return {ready:!!active&&!loading,case:active?.id,time,playing,physics:!!physics,simTime:physics?.data.time,contacts:physics?.data.ncon,object:meshes[52]?.position.toArray()};}};
requestAnimationFrame(tick);try{manifest=await fetchOK(base+'motions.json');await loadCase($('motion').value);}catch(e){status('Motion data could not be loaded.');console.error(e);}
document.addEventListener('visibilitychange',()=>{if(document.hidden)setPlaying(false);});
