// Shared deterministic screen-space celebration for the viewer and rendered videos.
export const CELEBRATION_SECONDS=3;
const COLORS=['#ffca05','#ff2471','#00a6f5','#742bff','#00bd77','#ff701f'];
const frac=x=>x-Math.floor(x);
const rand=(i,k)=>frac(Math.sin(i*127.1+k*311.7)*43758.5453);
export function drawCelebration(ctx,width,height,age,{banner=true}={}){
  ctx.clearRect(0,0,width,height);
  if(age<0||age>CELEBRATION_SECONDS)return;
  const scale=Math.max(.7,Math.min(1.35,width/1000));
  for(let i=0;i<210;i++){
    const delay=rand(i,1)*.32,t=age-delay;if(t<0)continue;
    const side=i%2?1:-1;
    const x=width*(side<0?.28:.72)+side*(rand(i,2)-.58)*width*.48*t;
    const y=height*.66-(.48+rand(i,3)*.38)*height*t+height*.24*t*t;
    const alpha=Math.min(1,t*14)*Math.min(1,(3-age)*2.5);if(alpha<=0)continue;
    const w=(8+rand(i,4)*11)*scale,h=(5+rand(i,5)*6)*scale;
    ctx.save();ctx.translate(x,y);ctx.rotate(rand(i,6)*6.28+t*(rand(i,7)*8-4));ctx.globalAlpha=alpha;
    ctx.fillStyle=COLORS[i%COLORS.length];ctx.strokeStyle='rgba(25,25,45,.25)';ctx.lineWidth=.8;
    if(i%7===0){ctx.beginPath();for(let j=0;j<10;j++){const a=j*Math.PI/5-Math.PI/2,r=j%2?w*.32:w*.72;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.closePath();ctx.fill();ctx.stroke();}
    else{ctx.fillRect(-w/2,-h/2,w,h);ctx.strokeRect(-w/2,-h/2,w,h);}
    ctx.restore();
  }
  if(!banner)return;
  const font=Math.max(22,Math.min(38,width*.032)),bw=Math.min(width-24,font*12),bh=font*1.9;
  const x=(width-bw)/2,y=height*.055;
  ctx.save();ctx.shadowColor='rgba(0,0,0,.24)';ctx.shadowBlur=14;
  ctx.fillStyle='#086a3b';ctx.beginPath();ctx.roundRect(x,y,bw,bh,12);ctx.fill();ctx.shadowBlur=0;
  ctx.strokeStyle='#8fffbb';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#fff';ctx.font=`800 ${font}px Arial, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('TARGETS REACHED!',width/2,y+bh/2);ctx.restore();
}
