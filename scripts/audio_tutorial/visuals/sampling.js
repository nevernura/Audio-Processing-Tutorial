(() => {
  "use strict";

  const {
    TAU,
    clamp,
    el,
    fitCanvas,
    roundedRect,
    drawStageTitle,
    palette,
    ac
  } = window.AudioTutorial;

function SamplingViz(){
  let cv,ctx,raf,phase=0,rate=18,showRecon=true,sigHz=4.2;
  return {
    controls:[
      {type:"range",label:"Sample rate",min:5,max:64,step:1,val:()=>rate,fmt:v=>v+" /s",on:v=>rate=v},
      {type:"range",label:"Signal speed",min:1,max:9,step:0.1,val:()=>sigHz,fmt:v=>v.toFixed(1)+"x",on:v=>sigHz=v},
      {type:"seg",label:"Rebuild",opts:[["on","Show"],["off","Hide"]],val:()=>showRecon?"on":"off",on:v=>showRecon=(v==="on")}
    ],
    note:"sample rate vs. the wave",
    legend:[["#8b95a7","analog"],["#ffd84d","samples"],["#3d7cff","digital rebuild"]],
    mount(host){ cv=el("canvas"); host.appendChild(cv); loop(); },
    unmount(){ cancelAnimationFrame(raf); }
  };
  function loop(){ raf=requestAnimationFrame(loop); phase+=0.014; draw(); }
  function wave(u){ return Math.sin(u*sigHz*TAU - phase) + .24*Math.sin(u*sigHz*TAU*2 - phase*.7); }
  function draw(){
    const dpr=fitCanvas(cv),W=cv.width,H=cv.height; ctx=ctx||cv.getContext("2d");
    ctx.clearRect(0,0,W,H); drawStageTitle(ctx,dpr,"Sampling: snapshots in time","the computer only sees the dots");
    const left=36*dpr,right=W-36*dpr,mid=H*.55,A=H*.24;
    ctx.strokeStyle="rgba(255,255,255,.16)"; ctx.lineWidth=1*dpr; ctx.beginPath(); ctx.moveTo(left,mid); ctx.lineTo(right,mid); ctx.stroke();
    ctx.strokeStyle="rgba(237,246,255,.38)"; ctx.lineWidth=3*dpr; ctx.beginPath();
    for(let x=left;x<=right;x+=2*dpr){ const u=(x-left)/(right-left),y=mid-wave(u)*A; x===left?ctx.moveTo(x,y):ctx.lineTo(x,y); }
    ctx.stroke();
    const N=rate, pts=[];
    for(let i=0;i<=N;i++){ const u=i/N, x=left+u*(right-left), y=mid-wave(u)*A; pts.push([x,y]); }
    if(showRecon){
      ctx.strokeStyle="#3d7cff"; ctx.lineWidth=3*dpr; ctx.lineCap="round"; ctx.beginPath();
      pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1])); ctx.stroke();
      ctx.globalAlpha=.16; ctx.lineWidth=10*dpr; ctx.stroke(); ctx.globalAlpha=1;
    }
    pts.forEach((p,i)=>{
      ctx.strokeStyle="rgba(255,216,77,.28)"; ctx.lineWidth=1*dpr; ctx.beginPath(); ctx.moveTo(p[0],mid+H*.28); ctx.lineTo(p[0],mid-H*.28); ctx.stroke();
      ctx.fillStyle=i%2?"#ffd84d":"#ff5c9d"; ctx.beginPath(); ctx.arc(p[0],p[1],5*dpr,0,TAU); ctx.fill();
    });
    const ok=rate>=sigHz*2.2;
    ctx.font=`700 ${13*dpr}px "Spline Sans Mono"`;
    ctx.fillStyle=ok?"#25d8d0":"#ff8a7a";
    ctx.fillText(ok?"above Nyquist: the shape survives":"below Nyquist: aliases appear",24*dpr,H-26*dpr);
  }
}

  window.AudioTutorial.visuals.SamplingViz = SamplingViz;
})();
