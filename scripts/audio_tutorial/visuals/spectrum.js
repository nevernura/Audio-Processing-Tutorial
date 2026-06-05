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

function SpectrumViz(){
  let cv,ctx,raf,phase=0,playing=false,oscillators=[],gain;
  const comps=[{f:1,a:.8},{f:2,a:.25},{f:3,a:.15},{f:5,a:0}];
  return {
    controls:[
      {type:"range",label:"Tone 1",min:0,max:1,step:0.01,val:()=>comps[0].a,fmt:v=>v.toFixed(2),on:v=>{comps[0].a=v; updateGain();}},
      {type:"range",label:"Tone 2",min:0,max:1,step:0.01,val:()=>comps[1].a,fmt:v=>v.toFixed(2),on:v=>{comps[1].a=v; updateGain();}},
      {type:"range",label:"Tone 3",min:0,max:1,step:0.01,val:()=>comps[2].a,fmt:v=>v.toFixed(2),on:v=>{comps[2].a=v; updateGain();}},
      {type:"range",label:"Tone 5",min:0,max:1,step:0.01,val:()=>comps[3].a,fmt:v=>v.toFixed(2),on:v=>{comps[3].a=v; updateGain();}},
      {type:"play",label:()=>playing?"Stop":"Play mix",on:()=>playing?stop():start()}
    ],
    note:"left: wave · right: frequency recipe",
    legend:[["#ff5c9d","sum"],["#3d7cff","spectrum bars"]],
    mount(host){ cv=el("canvas"); host.appendChild(cv); loop(); },
    unmount(){ cancelAnimationFrame(raf); stop(); }
  };
  function start(){
    const c=ac(); gain=c.createGain(); gain.gain.value=.045; gain.connect(c.destination);
    oscillators=comps.map((comp)=>{
      const osc=c.createOscillator(), g=c.createGain();
      osc.type="sine"; osc.frequency.value=180*comp.f; g.gain.value=comp.a;
      osc.connect(g); g.connect(gain); osc.start(); return {osc,g};
    });
    playing=true; refreshPlay();
  }
  function stop(){
    oscillators.forEach(({osc})=>{ try{osc.stop();}catch(e){} try{osc.disconnect();}catch(e){} });
    oscillators=[]; if(gain){gain.disconnect(); gain=null;} playing=false; refreshPlay();
  }
  function updateGain(){ oscillators.forEach((o,i)=>o.g.gain.value=comps[i].a); }
  function refreshPlay(){ const b=document.querySelector(".playbtn"); if(b){ b.classList.toggle("on",playing); b.textContent=playing?"■ Stop":"▶ Play mix"; } }
  function loop(){ raf=requestAnimationFrame(loop); phase+=0.027; draw(); }
  function draw(){
    const dpr=fitCanvas(cv),W=cv.width,H=cv.height; ctx=ctx||cv.getContext("2d");
    ctx.clearRect(0,0,W,H); drawStageTitle(ctx,dpr,"Fourier: the recipe","a complex sound is a stack of simple tones");
    const split=W*.62,left=36*dpr,mid=H*.55,A=H*.22;
    ctx.strokeStyle="rgba(255,255,255,.15)"; ctx.lineWidth=1*dpr; ctx.beginPath(); ctx.moveTo(left,mid); ctx.lineTo(split-24*dpr,mid); ctx.stroke();
    const amax=comps.reduce((s,c)=>s+c.a,0)||1;
    ctx.strokeStyle="#ff5c9d"; ctx.lineWidth=4*dpr; ctx.lineCap="round"; ctx.beginPath();
    for(let x=left;x<=split-24*dpr;x+=2*dpr){
      const u=(x-left)/(split-24*dpr-left); let y=0;
      comps.forEach(c=>{ y+=c.a*Math.sin(u*c.f*TAU*3 - phase*c.f); });
      const py=mid-(y/amax)*A; x===left?ctx.moveTo(x,py):ctx.lineTo(x,py);
    }
    ctx.stroke(); ctx.globalAlpha=.16; ctx.lineWidth=12*dpr; ctx.stroke(); ctx.globalAlpha=1;
    ctx.strokeStyle="rgba(255,255,255,.16)"; ctx.lineWidth=1*dpr; ctx.beginPath(); ctx.moveTo(split,84*dpr); ctx.lineTo(split,H-54*dpr); ctx.stroke();
    const bx0=split+46*dpr, bw=W-bx0-44*dpr, base=H-78*dpr;
    ctx.strokeStyle="rgba(255,255,255,.22)"; ctx.lineWidth=2*dpr; ctx.beginPath(); ctx.moveTo(bx0-16*dpr,base); ctx.lineTo(W-30*dpr,base); ctx.stroke();
    comps.forEach((c,i)=>{
      const x=bx0+(i+.5)/comps.length*bw, h=c.a*(H*.48);
      ctx.strokeStyle=palette(i+2); ctx.lineWidth=16*dpr; ctx.lineCap="round";
      ctx.beginPath(); ctx.moveTo(x,base); ctx.lineTo(x,base-h); ctx.stroke();
      ctx.fillStyle="rgba(237,246,255,.72)"; ctx.font=`${12*dpr}px "Spline Sans Mono"`;
      ctx.fillText(`${c.f}f`,x-12*dpr,base+26*dpr);
    });
    ctx.fillStyle="rgba(237,246,255,.55)"; ctx.font=`${11*dpr}px "Spline Sans Mono"`;
    ctx.fillText("frequency",bx0-16*dpr,H-28*dpr);
  }
}

  window.AudioTutorial.visuals.SpectrumViz = SpectrumViz;
})();
