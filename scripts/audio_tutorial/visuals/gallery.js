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

function GalleryViz(){
  let cv,ctx,raf,t=0,kind="tone",playing=false,srcNode,gainNode;
  const kinds={
    tone:{label:"Pure tone",sub:"one horizontal stripe",color:"#ffd84d"},
    two:{label:"Two tones",sub:"two steady stripes",color:"#25d8d0"},
    chirp:{label:"Chirp",sub:"a rising diagonal",color:"#ff5c9d"},
    perc:{label:"Percussion",sub:"low thumps and broadband streaks",color:"#3d7cff"},
    voice:{label:"Voice",sub:"harmonic ladder with vibrato",color:"#8b5cf6"},
    bird:{label:"Birdsong",sub:"fast swooping curves",color:"#55d66b"}
  };
  return {
    controls:[
      {type:"seg",label:"Example",opts:Object.keys(kinds).map(k=>[k,kinds[k].label]),val:()=>kind,on:v=>{kind=v; if(playing){stop(); start();}}},
      {type:"play",label:()=>playing?"Stop":"Play example",on:()=>playing?stop():start()}
    ],
    note:"spectrogram reading practice",
    legend:[["#ffd84d","steady tone"],["#ff5c9d","moving pitch"],["#3d7cff","transient noise"]],
    mount(host){ cv=el("canvas"); host.appendChild(cv); loop(); },
    unmount(){ cancelAnimationFrame(raf); stop(); }
  };
  function loop(){ raf=requestAnimationFrame(loop); t+=0.018; draw(); }
  function draw(){
    const dpr=fitCanvas(cv),W=cv.width,H=cv.height; ctx=ctx||cv.getContext("2d");
    ctx.clearRect(0,0,W,H); drawStageTitle(ctx,dpr,kinds[kind].label,kinds[kind].sub);
    const left=54*dpr,right=W-44*dpr,top=94*dpr,bottom=H-58*dpr;
    ctx.fillStyle="rgba(8,13,31,.45)"; roundedRect(ctx,left,top,right-left,bottom-top,22*dpr); ctx.fill();
    ctx.strokeStyle="rgba(255,255,255,.12)"; ctx.lineWidth=1*dpr;
    for(let i=0;i<6;i++){ const y=top+i/5*(bottom-top); ctx.beginPath(); ctx.moveTo(left,y); ctx.lineTo(right,y); ctx.stroke(); }
    for(let i=0;i<9;i++){ const x=left+i/8*(right-left); ctx.beginPath(); ctx.moveTo(x,top); ctx.lineTo(x,bottom); ctx.stroke(); }
    if(kind==="tone") drawTone(left,right,top,bottom,dpr,[.45],["#ffd84d"]);
    if(kind==="two") drawTone(left,right,top,bottom,dpr,[.38,.58],["#ffd84d","#25d8d0"]);
    if(kind==="chirp") drawChirp(left,right,top,bottom,dpr);
    if(kind==="perc") drawPerc(left,right,top,bottom,dpr);
    if(kind==="voice") drawVoice(left,right,top,bottom,dpr);
    if(kind==="bird") drawBird(left,right,top,bottom,dpr);
    ctx.fillStyle="rgba(237,246,255,.62)"; ctx.font=`${11*dpr}px "Spline Sans Mono"`;
    ctx.fillText("time ->",right-70*dpr,bottom+28*dpr); ctx.fillText("frequency",left,bottom+28*dpr);
  }
  function glowLine(points,color,dpr,width=3){
    ctx.strokeStyle=color; ctx.lineWidth=width*dpr; ctx.lineCap="round"; ctx.lineJoin="round"; ctx.beginPath();
    points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1])); ctx.stroke();
    ctx.globalAlpha=.16; ctx.lineWidth=(width+9)*dpr; ctx.stroke(); ctx.globalAlpha=1;
  }
  function drawTone(left,right,top,bottom,dpr,levels,colors){
    levels.forEach((lv,i)=>{ const y=bottom-lv*(bottom-top); glowLine([[left+20*dpr,y],[right-20*dpr,y]],colors[i],dpr,4); });
  }
  function drawChirp(left,right,top,bottom,dpr){
    const pts=[]; for(let i=0;i<120;i++){ const u=i/119; pts.push([left+u*(right-left), bottom-(.18+.68*u)*(bottom-top)]); }
    glowLine(pts,"#ff5c9d",dpr,4);
  }
  function drawPerc(left,right,top,bottom,dpr){
    for(let beat=0;beat<4;beat++){
      const x=left+(beat+.08)/4*(right-left);
      ctx.fillStyle="rgba(255,216,77,.62)"; roundedRect(ctx,x,bottom-(bottom-top)*.25,24*dpr,(bottom-top)*.22,12*dpr); ctx.fill();
      const sx=left+(beat+.55)/4*(right-left);
      const grad=ctx.createLinearGradient(sx,top,sx,bottom);
      grad.addColorStop(0,"rgba(61,124,255,.72)"); grad.addColorStop(1,"rgba(61,124,255,.05)");
      ctx.fillStyle=grad; roundedRect(ctx,sx-8*dpr,top+18*dpr,28*dpr,bottom-top-36*dpr,14*dpr); ctx.fill();
    }
  }
  function drawVoice(left,right,top,bottom,dpr){
    for(let k=1;k<=7;k++){
      const pts=[]; for(let i=0;i<140;i++){ const u=i/139, base=.12+k*.095; pts.push([left+u*(right-left), bottom-(base+Math.sin(u*TAU*5+t)*.012*k)*(bottom-top)]); }
      glowLine(pts, k%2?"#8b5cf6":"#25d8d0", dpr, 2.4);
    }
  }
  function drawBird(left,right,top,bottom,dpr){
    for(let call=0;call<5;call++){
      const pts=[]; const x0=(call+.12)/5, w=.12+.03*(call%2);
      for(let i=0;i<60;i++){ const u=i/59, x=left+(x0+u*w)*(right-left), y=bottom-(.62+.18*Math.sin(u*Math.PI)+.08*Math.sin(u*TAU*2+call))*(bottom-top); pts.push([x,y]); }
      glowLine(pts,"#55d66b",dpr,3);
    }
  }
  function start(){
    const c=ac(); gainNode=c.createGain(); gainNode.gain.value=.12; gainNode.connect(c.destination);
    if(kind==="tone" || kind==="two" || kind==="chirp" || kind==="voice"){
      const osc=c.createOscillator(); osc.type=kind==="voice"?"sawtooth":"sine";
      const now=c.currentTime;
      if(kind==="chirp"){ osc.frequency.setValueAtTime(180,now); osc.frequency.exponentialRampToValueAtTime(1800,now+2.4); }
      else osc.frequency.value=kind==="two"?330:kind==="voice"?220:440;
      osc.connect(gainNode); osc.start(); osc.stop(now+2.5); osc.onended=stop; srcNode=osc;
      if(kind==="two"){
        const osc2=c.createOscillator(); osc2.frequency.value=550; osc2.connect(gainNode); osc2.start(); osc2.stop(now+2.5); srcNode.extra=osc2;
      }
    }else{
      playNoisyPattern(c, kind);
    }
    playing=true; refreshPlay();
  }
  function playNoisyPattern(c,type){
    const dur=2.5, buffer=c.createBuffer(1,Math.floor(c.sampleRate*dur),c.sampleRate), data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++){
      const time=i/c.sampleRate; let v=0;
      if(type==="perc"){
        for(let b=0;b<4;b++){ const dt=time-b*.6; if(dt>=0&&dt<.18) v+=Math.sin(TAU*(120*Math.exp(-18*dt))*dt)*Math.exp(-18*dt); const st=time-(b*.6+.3); if(st>=0&&st<.12) v+=(Math.random()*2-1)*Math.exp(-32*st); }
      }else{
        const mod=Math.sin(TAU*(5+3*Math.sin(time*4))*time); v=Math.sin(TAU*(1900+700*mod)*time)*(.4+.6*Math.sin(TAU*7*time))*Math.exp(-.2*time);
      }
      data[i]=clamp(v*.45,-1,1);
    }
    const s=c.createBufferSource(); s.buffer=buffer; s.connect(gainNode); s.start(); s.onended=stop; srcNode=s;
  }
  function stop(){
    if(srcNode){ try{srcNode.stop&&srcNode.stop();}catch(e){} try{srcNode.disconnect();}catch(e){} if(srcNode.extra){try{srcNode.extra.stop();}catch(e){} try{srcNode.extra.disconnect();}catch(e){}} srcNode=null; }
    if(gainNode){ gainNode.disconnect(); gainNode=null; }
    playing=false; refreshPlay();
  }
  function refreshPlay(){ const b=document.querySelector(".playbtn"); if(b){ b.classList.toggle("on",playing); b.textContent=playing?"■ Stop":"▶ Play example"; } }
}

  window.AudioTutorial.visuals.GalleryViz = GalleryViz;
})();
