(() => {
  "use strict";

let AC = null;
function ac(){
  AC = AC || new (window.AudioContext || window.webkitAudioContext)();
  if(AC.state === "suspended") AC.resume();
  return AC;
}
function sampleRate(){
  return AC ? AC.sampleRate : 44100;
}

const TAU = Math.PI * 2;
const $ = (s,r=document)=>r.querySelector(s);
const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
function el(tag, cls, html){
  const e=document.createElement(tag);
  if(cls) e.className=cls;
  if(html != null) e.innerHTML=html;
  return e;
}
function fitCanvas(cv){
  const r=cv.getBoundingClientRect(), dpr=Math.min(window.devicePixelRatio || 1, 2);
  cv.width=Math.max(1, Math.round(r.width*dpr));
  cv.height=Math.max(1, Math.round(r.height*dpr));
  return dpr;
}
function roundedRect(ctx,x,y,w,h,r){
  const rr=Math.min(r,w/2,h/2);
  ctx.beginPath();
  ctx.moveTo(x+rr,y);
  ctx.arcTo(x+w,y,x+w,y+h,rr);
  ctx.arcTo(x+w,y+h,x,y+h,rr);
  ctx.arcTo(x,y+h,x,y,rr);
  ctx.arcTo(x,y,x+w,y,rr);
  ctx.closePath();
}
function drawStageTitle(ctx,dpr,text,sub){
  ctx.save();
  ctx.font=`${16*dpr}px "Spline Sans Mono", monospace`;
  ctx.fillStyle="rgba(237,246,255,.82)";
  ctx.fillText(text,22*dpr,56*dpr);
  if(sub){
    ctx.font=`${11*dpr}px "Spline Sans Mono", monospace`;
    ctx.fillStyle="rgba(237,246,255,.52)";
    ctx.fillText(sub,22*dpr,76*dpr);
  }
  ctx.restore();
}
function palette(i){
  return ["#ffd84d","#ff5c9d","#3d7cff","#25d8d0","#55d66b","#8b5cf6","#ff8a4c"][i%7];
}

  window.AudioTutorial = {
    TAU,
    $,
    clamp,
    el,
    fitCanvas,
    roundedRect,
    drawStageTitle,
    palette,
    ac,
    sampleRate,
    visuals: {}
  };
})();
