import * as THREE from 'three';
const RED=0xd94335,GREEN=0x17964e;
export function scanGoalEvents(raw,frames,goals){
  const objectErrors=[],pelvisErrors=[];let stable=0,arrival=-1;
  for(let f=0;f<frames;f++){
    const oi=(f*53+52)*7,pi=f*53*7,prev=((Math.max(0,f-1))*53+52)*7;
    const od=Math.hypot(...goals.object_goal.map((v,j)=>raw[oi+j]-v));
    const pd=Math.hypot(raw[pi]-goals.pelvis_goal[0],raw[pi+1]-goals.pelvis_goal[1]);
    const speed=f?Math.hypot(raw[oi]-raw[prev],raw[oi+1]-raw[prev+1],raw[oi+2]-raw[prev+2])*30:0;
    objectErrors.push(od);pelvisErrors.push(pd);
    stable=od<.3&&pd<.3&&speed<.2?stable+1:0;
    if(stable>=10&&arrival<0)arrival=f;
  }
  return {objectErrors,pelvisErrors,arrival};
}
export class GoalEffects{
  constructor(scene,objectMaterials,pelvisMaterials){
    this.objectMaterials=objectMaterials;this.pelvisMaterials=pelvisMaterials;
    this.group=new THREE.Group();scene.add(this.group);
    this.badge=document.createElement('div');this.badge.id='goal-celebration';this.badge.hidden=true;this.badge.setAttribute('role','status');this.badge.textContent='🎉 Targets reached';document.getElementById('viewport').appendChild(this.badge);
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const colors=[0xf0b93e,0x17964e,0xea7254,0x459edb,0xf8e4af];
    const geometry=new THREE.PlaneGeometry(.045,.018);
    const materials=colors.map(color=>new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));
    this.particles=Array.from({length:70},(_,i)=>{const mesh=new THREE.Mesh(geometry,materials[i%5]);this.group.add(mesh);return {mesh,angle:i*2.399963,radial:.5+(i%9)/12,vz:1.6+(i%11)/12,delay:(i%7)*.018};});
    this.visible=true;this.reset();
  }
  setCase(raw,frames,goals){this.goals=goals;this.timeline=scanGoalEvents(raw,frames,goals);this.reset();}
  reset(){this.previousFrame=-1;this.triggered=false;this.bursts=0;this.started=null;this.reached=false;this.badge.hidden=true;this.group.visible=false;}
  setVisible(visible){this.visible=visible;this.badge.hidden=!visible||!this.reached;if(!visible)this.group.visible=false;}
  update(frame,objectPosition,pelvisPosition,sandbox=false){
    if(!this.timeline)return;
    if(frame<this.previousFrame)this.reset();
    this.previousFrame=frame;
    const od=sandbox?Math.hypot(...this.goals.object_goal.map((v,j)=>objectPosition[j]-v)):this.timeline.objectErrors[frame];
    const pd=sandbox?Math.hypot(pelvisPosition[0]-this.goals.pelvis_goal[0],pelvisPosition[1]-this.goals.pelvis_goal[1]):this.timeline.pelvisErrors[frame];
    this.objectReached=od<.3;this.pelvisReached=pd<.3;this.objectError=od;this.pelvisError=pd;
    for(const [materials,ok,id] of [[this.objectMaterials,this.objectReached,'object'],[this.pelvisMaterials,this.pelvisReached,'pelvis']]){
      const color=ok?GREEN:RED;materials.forEach(m=>m.color.setHex(color));
      const swatch=document.getElementById(id+'-goal-swatch');if(swatch){swatch.style.borderColor='#'+color.toString(16);swatch.style.backgroundColor=ok?'#17964e33':'#d9433533';}
      const label=document.getElementById(id+'-goal-status');if(label)label.textContent=ok?'Reached':'Pending';
    }
    this.reached=!sandbox&&this.timeline.arrival>=0&&frame>=this.timeline.arrival&&this.objectReached&&this.pelvisReached;
    this.badge.hidden=!this.visible||!this.reached;
    if(this.reached&&!this.triggered){this.triggered=true;this.bursts++;this.started=performance.now()/1000;}
    if(!this.reached)this.group.visible=false;
  }
  tick(now){
    const age=now/1000-this.started;this.group.visible=this.visible&&this.reached&&this.started!==null&&age<1.5&&!this.reduced.matches;
    if(!this.group.visible)return;
    const g=this.goals.object_goal,p=this.goals.pelvis_goal;
    for(const part of this.particles){const t=age-part.delay;part.mesh.visible=t>=0;if(t<0)continue;part.mesh.position.set((g[0]+p[0])/2+Math.cos(part.angle)*part.radial*t,(g[1]+p[1])/2+Math.sin(part.angle)*part.radial*t,Math.max(1,g[2])+.25+part.vz*t-2.6*t*t);part.mesh.rotation.set(part.angle+t*3,part.angle*.7+t*5,t*2);part.mesh.scale.setScalar(t<1.1?1:Math.max(0,(1.5-t)/.4));}
  }
  get state(){return {objectReached:this.objectReached,pelvisReached:this.pelvisReached,objectError:this.objectError,pelvisError:this.pelvisError,arrivalFrame:this.timeline?.arrival,celebrating:this.group.visible,targetsReached:this.reached,bursts:this.bursts};}
}
