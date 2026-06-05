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

function QuantizationViz(){
  let cv,ctx,raf,t=0,rate=24,bits=3;
  return {
    controls:[
      {type:"range",label:"Sample rate",min:8,max:72,step:1,val:()=>rate,fmt:v=>v+" /s",on:v=>rate=v},
      {type:"range",label:"Bit depth",min:2,max:8,step:1,val:()=>bits,fmt:v=>v+" bits",on:v=>bits=v}
    ],
    note:"x axis: sampling rate · y axis: bit depth",
    legend:[["#25d8d0","true wave"],["#ffd84d","quantized steps"],["#ff5c9d","rounding error"]],
    mount(host){ cv=el("canvas"); host.appendChild(cv); loop(); },
    unmount(){ cancelAnimationFrame(raf); }
  };
  function loop(){ raf=requestAnimationFrame(loop); t+=0.012; draw(); }
  function signal(u){ return .72*Math.sin(u*TAU*2-t*1.8)+.22*Math.sin(u*TAU*5+t); }
  function quant(y){ const levels=Math.pow(2,bits); return Math.round(((y+1)/2)*(levels-1))/(levels-1)*2-1; }
  function draw(){
    const dpr=fitCanvas(cv),W=cv.width,H=cv.height; ctx=ctx||cv.getContext("2d");
    ctx.clearRect(0,0,W,H); drawStageTitle(ctx,dpr,"Quantization: measuring height","bit depth decides how many vertical slots exist");
    const left=54*dpr,right=W-42*dpr,top=98*dpr,bottom=H-58*dpr,mid=(top+bottom)/2,A=(bottom-top)*.42;
    const levels=Math.pow(2,bits);
    ctx.strokeStyle="rgba(255,255,255,.11)"; ctx.lineWidth=1*dpr;
    for(let i=0;i<levels;i++){
      const q=-1+i/(levels-1)*2, y=mid-q*A;
      ctx.beginPath(); ctx.moveTo(left,y); ctx.lineTo(right,y); ctx.stroke();
    }
    ctx.strokeStyle="#25d8d0"; ctx.lineWidth=3*dpr; ctx.beginPath();
    for(let x=left;x<=right;x+=2*dpr){ const u=(x-left)/(right-left), y=mid-signal(u)*A; x===left?ctx.moveTo(x,y):ctx.lineTo(x,y); }
    ctx.stroke();
    const pts=[];
    for(let i=0;i<=rate;i++){ const u=i/rate, x=left+u*(right-left), y=signal(u), q=quant(y); pts.push([x,mid-y*A,mid-q*A]); }
    ctx.strokeStyle="#ffd84d"; ctx.lineWidth=4*dpr; ctx.lineCap="round"; ctx.lineJoin="round"; ctx.beginPath();
    pts.forEach((p,i)=>{ if(i===0) ctx.moveTo(p[0],p[2]); else { const prev=pts[i-1]; ctx.lineTo(p[0],prev[2]); ctx.lineTo(p[0],p[2]); }});
    ctx.stroke();
    pts.forEach(p=>{
      ctx.strokeStyle="rgba(255,92,157,.5)"; ctx.lineWidth=2*dpr; ctx.beginPath(); ctx.moveTo(p[0],p[1]); ctx.lineTo(p[0],p[2]); ctx.stroke();
      ctx.fillStyle="#ff5c9d"; ctx.beginPath(); ctx.arc(p[0],p[2],4*dpr,0,TAU); ctx.fill();
    });
    ctx.fillStyle="rgba(237,246,255,.7)"; ctx.font=`${12*dpr}px "Spline Sans Mono"`;
    ctx.fillText(`${levels} amplitude levels`,left,bottom+28*dpr);
    ctx.fillText("quantization error becomes noise",right-260*dpr,bottom+28*dpr);
  }
}

  window.AudioTutorial.visuals.QuantizationViz = QuantizationViz;
})();
