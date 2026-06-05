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

function WindowViz(){
  let cv,ctx,raf,t=0,windowSize=.22,overlap=.5;
  return {
    controls:[
      {type:"range",label:"Window size",min:.12,max:.5,step:.01,val:()=>windowSize,fmt:v=>Math.round(v*100)+"%",on:v=>windowSize=v},
      {type:"range",label:"Overlap",min:0,max:.85,step:.05,val:()=>overlap,fmt:v=>Math.round(v*100)+"%",on:v=>overlap=v}
    ],
    note:"short windows let changing audio look nearly still",
    legend:[["#25d8d0","signal"],["#ffd84d","analysis window"],["#ff5c9d","frames"]],
    mount(host){ cv=el("canvas"); host.appendChild(cv); loop(); },
    unmount(){ cancelAnimationFrame(raf); }
  };
  function loop(){ raf=requestAnimationFrame(loop); t+=0.008; draw(); }
  function sig(u){ return Math.sin(TAU*(2.2+5*u)*u - t*3)*(.25+.65*u); }
  function draw(){
    const dpr=fitCanvas(cv),W=cv.width,H=cv.height; ctx=ctx||cv.getContext("2d");
    ctx.clearRect(0,0,W,H); drawStageTitle(ctx,dpr,"Windowing: small slices","spectrograms analyze short overlapping frames");
    const left=42*dpr,right=W-42*dpr,mid=H*.48,A=H*.22;
    ctx.strokeStyle="rgba(255,255,255,.15)"; ctx.lineWidth=1*dpr; ctx.beginPath(); ctx.moveTo(left,mid); ctx.lineTo(right,mid); ctx.stroke();
    ctx.strokeStyle="#25d8d0"; ctx.lineWidth=3*dpr; ctx.lineCap="round"; ctx.beginPath();
    for(let x=left;x<=right;x+=2*dpr){ const u=(x-left)/(right-left),y=mid-sig(u)*A; x===left?ctx.moveTo(x,y):ctx.lineTo(x,y); }
    ctx.stroke();
    const winW=(right-left)*windowSize, step=winW*(1-overlap), start=left+((t*70*dpr)%Math.max(step,1));
    for(let x=start-winW;x<right;x+=Math.max(step,10*dpr)){
      if(x+winW<left) continue;
      const active=x<=left+(right-left)*.5 && x+winW>=left+(right-left)*.5;
      ctx.fillStyle=active?"rgba(255,216,77,.24)":"rgba(255,92,157,.13)";
      ctx.strokeStyle=active?"#ffd84d":"rgba(255,92,157,.5)";
      roundedRect(ctx,x,mid-A-28*dpr,winW,A*2+56*dpr,16*dpr); ctx.fill(); ctx.stroke();
    }
    const miniTop=H-104*dpr, frameCount=Math.floor(1/windowSize/(1-overlap));
    ctx.fillStyle="rgba(237,246,255,.58)"; ctx.font=`${12*dpr}px "Spline Sans Mono"`;
    ctx.fillText("frames become columns in the spectrogram",left,miniTop-18*dpr);
    for(let i=0;i<Math.min(frameCount,18);i++){
      const x=left+i*24*dpr, h=(24+Math.sin(i*.8+t*3)*18+windowSize*50)*dpr;
      roundedRect(ctx,x,miniTop+54*dpr-h,15*dpr,h,7*dpr);
      ctx.fillStyle=i%2?"#ff5c9d":"#ffd84d"; ctx.fill();
    }
  }
}

  window.AudioTutorial.visuals.WindowViz = WindowViz;
})();
