import {drawCelebration,CELEBRATION_SECONDS} from './celebration-overlay.js';
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
    this.canvas=document.createElement('canvas');this.canvas.id='goal-confetti';this.canvas.setAttribute('aria-hidden','true');document.getElementById('viewport').appendChild(this.canvas);this.context=this.canvas.getContext('2d');this.group={visible:false};
    this.badge=document.createElement('div');this.badge.id='goal-celebration';this.badge.hidden=true;this.badge.setAttribute('role','status');this.badge.textContent='Targets reached!' ;document.getElementById('viewport').appendChild(this.badge);
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)');
    this.visible=true;this.reset();
  }
  setCase(raw,frames,goals){this.goals=goals;this.timeline=scanGoalEvents(raw,frames,goals);this.reset();}
  reset(){this.previousFrame=-1;this.triggered=false;this.bursts=0;this.started=null;this.reached=false;this.badge.hidden=true;this.group.visible=false;this.clear();}
  setVisible(visible){this.visible=visible;this.badge.hidden=!visible||!this.reached;if(!visible)this.group.visible=false;this.clear();}
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
  clear(){this.context.clearRect(0,0,this.canvas.width,this.canvas.height);}
  tick(now){
    const age=now/1000-this.started;
    this.group.visible=this.visible&&this.reached&&this.started!==null&&age<CELEBRATION_SECONDS&&!this.reduced.matches;
    if(!this.group.visible){this.clear();return;}
    const width=this.canvas.clientWidth,height=this.canvas.clientHeight;
    if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}
    drawCelebration(this.context,width,height,age,{banner:false});
  }
  get state(){return {objectReached:this.objectReached,pelvisReached:this.pelvisReached,objectError:this.objectError,pelvisError:this.pelvisError,arrivalFrame:this.timeline?.arrival,celebrating:this.group.visible,targetsReached:this.reached,bursts:this.bursts};}
}
