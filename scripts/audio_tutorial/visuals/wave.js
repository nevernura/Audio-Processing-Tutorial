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

function WaveViz(){
  let cv,ctx,raf,osc,gain,playing=false,freq=3,amp=0.7,phase=0,playHz=220,wave="sine";
  return {
    controls:[
      {type:"range",label:"Frequency",min:1,max:8,step:0.1,val:()=>freq,fmt:v=>v.toFixed(1)+"x",on:v=>{freq=v; playHz=110*v; if(osc) osc.frequency.value=playHz;}},
      {type:"range",label:"Amplitude",min:0.1,max:1,step:0.01,val:()=>amp,fmt:v=>v.toFixed(2),on:v=>{amp=v; if(gain) gain.gain.value=v*0.16;}},
      {type:"seg",label:"Shape",opts:[["sine","Sine"],["square","Square"],["sawtooth","Saw"]],val:()=>wave,on:v=>{wave=v; if(osc) osc.type=wave;}},
      {type:"play",label:()=>playing?"Stop":"Play tone",on:()=>toggle()}
    ],
    note:"x(t) = A sin(2 pi f t)",
    legend:[["#ff5c9d","wave"],["#ffd84d","air pressure samples"]],
    mount(host){ cv=el("canvas"); host.appendChild(cv); loop(); },
    unmount(){ cancelAnimationFrame(raf); stop(); }
  };
  function toggle(){ playing ? stop() : start(); }
  function start(){
    const c=ac(); osc=c.createOscillator(); gain=c.createGain();
    osc.type=wave; osc.frequency.value=playHz; gain.gain.value=amp*0.16;
    osc.connect(gain); gain.connect(c.destination); osc.start(); playing=true; refreshPlay();
  }
  function stop(){
    if(osc){ try{osc.stop();}catch(e){} osc.disconnect(); osc=null; }
    playing=false; refreshPlay();
  }
  function refreshPlay(){
    const b=document.querySelector(".playbtn");
    if(b){ b.classList.toggle("on",playing); b.textContent=playing?"■ Stop":"▶ Play tone"; }
  }
  function value(u){
    if(wave==="square") return Math.sign(Math.sin(u*freq*TAU-phase)) || 0;
    if(wave==="sawtooth") return 2*((u*freq-phase/TAU)%1)-1;
    return Math.sin(u*freq*TAU-phase);
  }
  function loop(){ raf=requestAnimationFrame(loop); phase+=0.035; draw(); }
  function draw(){
    const dpr=fitCanvas(cv),W=cv.width,H=cv.height; ctx=ctx||cv.getContext("2d");
    ctx.clearRect(0,0,W,H); drawStageTitle(ctx,dpr,"Wave anatomy","frequency controls pitch; amplitude controls loudness");
    const left=36*dpr,right=W-36*dpr,mid=H*.55,A=amp*H*.28;
    ctx.strokeStyle="rgba(255,255,255,.16)"; ctx.lineWidth=1*dpr;
    ctx.beginPath(); ctx.moveTo(left,mid); ctx.lineTo(right,mid); ctx.stroke();
    ctx.lineWidth=4*dpr; ctx.strokeStyle="#ff5c9d"; ctx.lineCap="round"; ctx.beginPath();
    for(let x=left;x<=right;x+=2*dpr){
      const u=(x-left)/(right-left), y=mid-value(u)*A;
      x===left?ctx.moveTo(x,y):ctx.lineTo(x,y);
    }
    ctx.stroke();
    ctx.globalAlpha=.18; ctx.lineWidth=12*dpr; ctx.stroke(); ctx.globalAlpha=1;
    ctx.fillStyle="#ffd84d";
    for(let i=0;i<20;i++){
      const u=i/19, x=left+u*(right-left), y=mid-value(u)*A;
      ctx.beginPath(); ctx.arc(x,y,4.5*dpr,0,TAU); ctx.fill();
    }
    ctx.strokeStyle="#25d8d0"; ctx.lineWidth=2*dpr; ctx.setLineDash([5*dpr,6*dpr]);
    const ax=left+(right-left)*.16, ay=mid-value(.16)*A;
    ctx.beginPath(); ctx.moveTo(ax,mid); ctx.lineTo(ax,ay); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle="#25d8d0"; ctx.font=`${12*dpr}px "Spline Sans Mono"`;
    ctx.fillText("amplitude",ax+8*dpr,(mid+ay)/2);
  }
}

  window.AudioTutorial.visuals.WaveViz = WaveViz;
})();
