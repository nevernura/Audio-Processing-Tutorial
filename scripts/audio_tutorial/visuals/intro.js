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

function IntroViz(){
  let cv,ctx,raf,t=0,mode="messages";
  const words=["traffic","audio","image","gesture","code","sensor","voice","music","beacon","heartbeat"];
  return {
    controls:[
      {type:"seg",label:"View",opts:[["messages","Messages"],["function","Function"]],val:()=>mode,on:v=>mode=v}
    ],
    note:"a signal is a changing message",
    legend:[["#ffd84d","message"],["#25d8d0","measurable change"]],
    mount(host){ cv=el("canvas"); host.appendChild(cv); loop(); },
    unmount(){ cancelAnimationFrame(raf); }
  };
  function loop(){ raf=requestAnimationFrame(loop); t+=0.018; draw(); }
  function draw(){
    const dpr=fitCanvas(cv), W=cv.width, H=cv.height; ctx=ctx || cv.getContext("2d");
    ctx.clearRect(0,0,W,H);
    drawStageTitle(ctx,dpr,"Signals carry messages","anything measurable that changes can become data");
    if(mode==="messages") drawMessages(dpr,W,H); else drawFunction(dpr,W,H);
  }
  function drawMessages(dpr,W,H){
    const cx=W/2, cy=H/2+10*dpr, orbit=Math.min(W,H)*0.27;
    ctx.save();
    ctx.lineWidth=2*dpr; ctx.strokeStyle="rgba(255,255,255,.12)";
    for(let r=0.36;r<=1;r+=0.32){ ctx.beginPath(); ctx.arc(cx,cy,orbit*r,0,TAU); ctx.stroke(); }
    words.forEach((word,i)=>{
      const a=t*0.8+i*TAU/words.length, r=orbit*(0.58+0.34*((i%3)/2));
      const x=cx+Math.cos(a)*r, y=cy+Math.sin(a)*r;
      const w=(word.length*8+28)*dpr, h=34*dpr;
      roundedRect(ctx,x-w/2,y-h/2,w,h,17*dpr);
      ctx.fillStyle=`${palette(i)}dd`; ctx.fill();
      ctx.fillStyle="#10172a"; ctx.font=`700 ${12*dpr}px "Spline Sans Mono", monospace`;
      ctx.fillText(word,x-w/2+14*dpr,y+4*dpr);
    });
    const pulse=1+Math.sin(t*4)*0.05;
    ctx.beginPath(); ctx.arc(cx,cy,58*dpr*pulse,0,TAU); ctx.fillStyle="#fffaf0"; ctx.fill();
    ctx.beginPath(); ctx.arc(cx,cy,42*dpr,0,TAU); ctx.fillStyle="#3d7cff"; ctx.fill();
    ctx.fillStyle="#fff"; ctx.font=`800 ${14*dpr}px "Hanken Grotesk"`; ctx.textAlign="center";
    ctx.fillText("SIGNAL",cx,cy+5*dpr); ctx.textAlign="left";
    ctx.restore();
  }
  function drawFunction(dpr,W,H){
    const left=70*dpr,right=W-40*dpr,mid=H*0.55,amp=H*.2;
    ctx.save();
    ctx.strokeStyle="rgba(255,255,255,.14)"; ctx.lineWidth=1*dpr;
    ctx.beginPath(); ctx.moveTo(left,mid); ctx.lineTo(right,mid); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(left,mid-amp-34*dpr); ctx.lineTo(left,mid+amp+34*dpr); ctx.stroke();
    ctx.strokeStyle="#25d8d0"; ctx.lineWidth=5*dpr; ctx.lineCap="round"; ctx.beginPath();
    for(let x=left;x<=right;x+=3*dpr){
      const u=(x-left)/(right-left);
      const y=mid-(Math.sin(u*TAU*2.1-t*1.8)*.62+Math.sin(u*TAU*5+t)*.22)*amp;
      x===left?ctx.moveTo(x,y):ctx.lineTo(x,y);
    }
    ctx.stroke();
    for(let i=0;i<11;i++){
      const u=i/10, x=left+u*(right-left);
      const y=mid-(Math.sin(u*TAU*2.1-t*1.8)*.62+Math.sin(u*TAU*5+t)*.22)*amp;
      ctx.beginPath(); ctx.arc(x,y,7*dpr,0,TAU); ctx.fillStyle=palette(i); ctx.fill();
    }
    ctx.fillStyle="rgba(237,246,255,.7)"; ctx.font=`${12*dpr}px "Spline Sans Mono"`;
    ctx.fillText("parameter: time, space, or anything measurable",left,mid+amp+62*dpr);
    ctx.fillText("value: pressure, brightness, voltage, position...",left,mid-amp-48*dpr);
    ctx.restore();
  }
}

  window.AudioTutorial.visuals.IntroViz = IntroViz;
})();
