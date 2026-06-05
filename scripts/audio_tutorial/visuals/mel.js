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

function MelViz(){
  let cv,ctx,raf,t=0,toneHz=700,view="mel";
  return {
    controls:[
      {type:"range",label:"Frequency",min:80,max:8000,step:10,val:()=>toneHz,fmt:v=>Math.round(v)+" Hz",on:v=>toneHz=v},
      {type:"seg",label:"Scale",opts:[["hz","Hz"],["mel","Mel"]],val:()=>view,on:v=>view=v}
    ],
    note:"humans hear pitch spacing more like mel than linear hertz",
    legend:[["#ffd84d","equal Hz"],["#25d8d0","mel spacing"],["#ff5c9d","selected tone"]],
    mount(host){ cv=el("canvas"); host.appendChild(cv); loop(); },
    unmount(){ cancelAnimationFrame(raf); }
  };
  function hzToMel(f){ return 2595*Math.log10(1+f/700); }
  function normHz(f){ return f/8000; }
  function normMel(f){ return hzToMel(f)/hzToMel(8000); }
  function loop(){ raf=requestAnimationFrame(loop); t+=0.012; draw(); }
  function draw(){
    const dpr=fitCanvas(cv),W=cv.width,H=cv.height; ctx=ctx||cv.getContext("2d");
    ctx.clearRect(0,0,W,H); drawStageTitle(ctx,dpr,"Mel scale: hearing is not linear","low frequencies get more perceptual detail");
    const left=72*dpr,right=W-54*dpr,y1=H*.42,y2=H*.62;
    drawRail(left,right,y1,"Linear Hz",normHz,dpr);
    drawRail(left,right,y2,"Mel scale",normMel,dpr);
    const selected=view==="hz"?normHz(toneHz):normMel(toneHz);
    const x=left+selected*(right-left);
    ctx.strokeStyle="#ff5c9d"; ctx.lineWidth=3*dpr; ctx.beginPath(); ctx.moveTo(x,y1-64*dpr); ctx.lineTo(x,y2+64*dpr); ctx.stroke();
    ctx.beginPath(); ctx.arc(x,view==="hz"?y1:y2,13*dpr+Math.sin(t*5)*2*dpr,0,TAU); ctx.fillStyle="#ff5c9d"; ctx.fill();
    ctx.fillStyle="#fff"; ctx.font=`700 ${13*dpr}px "Spline Sans Mono"`; ctx.fillText(`${Math.round(toneHz)} Hz`,x+16*dpr,(view==="hz"?y1:y2)+5*dpr);
    ctx.fillStyle="rgba(237,246,255,.66)"; ctx.font=`${12*dpr}px "Spline Sans Mono"`;
    ctx.fillText("500 -> 1000 Hz feels much larger than 10000 -> 10500 Hz, even with the same raw gap.",left,H-48*dpr);
  }
  function drawRail(left,right,y,label,map,dpr){
    ctx.strokeStyle="rgba(255,255,255,.18)"; ctx.lineWidth=8*dpr; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(left,y); ctx.lineTo(right,y); ctx.stroke();
    [125,250,500,1000,2000,4000,8000].forEach((f,i)=>{
      const x=left+map(f)*(right-left);
      ctx.fillStyle=label==="Mel scale"?"#25d8d0":"#ffd84d";
      ctx.beginPath(); ctx.arc(x,y,6*dpr,0,TAU); ctx.fill();
      ctx.fillStyle="rgba(237,246,255,.58)"; ctx.font=`${10*dpr}px "Spline Sans Mono"`;
      if(i%2===0) ctx.fillText(f>=1000?(f/1000)+"k":String(f),x-10*dpr,y+28*dpr);
    });
    ctx.fillStyle="rgba(237,246,255,.8)"; ctx.font=`700 ${13*dpr}px "Spline Sans Mono"`;
    ctx.fillText(label,left,y-24*dpr);
  }
}

  window.AudioTutorial.visuals.MelViz = MelViz;
})();
