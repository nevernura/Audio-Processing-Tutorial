(() => {
  "use strict";

  const { el, fitCanvas, roundedRect, drawStageTitle } = window.AudioTutorial;

  function SpectrogramViz(){
    let cv,ctx,raf,t=0;
    return {
      controls:[
        {type:"play",label:()=>"Open spectrogram lab",on:()=>{ window.location.href="/upload"; }}
      ],
      note:"three source modes: sweep · upload · microphone",
      hint:"Page 7 now uses the Next.js spectrogram lab for reliable source-specific pipelines.",
      mount(host){
        cv=el("canvas");
        host.appendChild(cv);
        loop();
      },
      unmount(){ cancelAnimationFrame(raf); }
    };

    function loop(){ raf=requestAnimationFrame(loop); t+=0.018; draw(); }

    function draw(){
      const dpr=fitCanvas(cv), W=cv.width, H=cv.height; ctx=ctx||cv.getContext("2d");
      ctx.clearRect(0,0,W,H);
      drawStageTitle(ctx,dpr,"Spectrogram lab","choose the right pipeline for each source");

      const cards=[
        {title:"Generated sweep", body:"Always works. A synthesized sweep draws a rising diagonal in real time.", color:"#ffd84d"},
        {title:"Upload audio", body:"Calls the Python/librosa API first, then falls back to browser STFT if needed.", color:"#ff5c9d"},
        {title:"Microphone", body:"Uses a live Web Audio analyser with explicit permission and error states.", color:"#25d8d0"},
      ];
      const gap=18*dpr;
      const cardW=Math.min(280*dpr,(W-72*dpr-gap*2)/3);
      const total=cardW*3+gap*2;
      const startX=(W-total)/2;
      const y=H*.38;

      cards.forEach((card,i)=>{
        const x=startX+i*(cardW+gap);
        const bob=Math.sin(t*2+i)*6*dpr;
        roundedRect(ctx,x,y+bob,cardW,172*dpr,24*dpr);
        ctx.fillStyle="rgba(255,255,255,.08)";
        ctx.fill();
        ctx.strokeStyle="rgba(255,255,255,.14)";
        ctx.lineWidth=1*dpr;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x+32*dpr,y+34*dpr+bob,12*dpr+Math.sin(t*4+i)*2*dpr,0,Math.PI*2);
        ctx.fillStyle=card.color;
        ctx.fill();
        ctx.fillStyle="rgba(237,246,255,.92)";
        ctx.font=`800 ${17*dpr}px Hanken Grotesk, sans-serif`;
        ctx.fillText(card.title,x+54*dpr,y+41*dpr+bob);
        ctx.fillStyle="rgba(237,246,255,.66)";
        ctx.font=`${12*dpr}px Spline Sans Mono, monospace`;
        wrapText(card.body,x+24*dpr,y+84*dpr+bob,cardW-48*dpr,20*dpr);
      });

      const btnW=270*dpr, btnH=48*dpr, bx=W/2-btnW/2, by=H*.78;
      roundedRect(ctx,bx,by,btnW,btnH,18*dpr);
      const grad=ctx.createLinearGradient(bx,by,bx+btnW,by);
      grad.addColorStop(0,"#ffd84d"); grad.addColorStop(1,"#ff8a4c");
      ctx.fillStyle=grad; ctx.fill();
      ctx.fillStyle="#10172a";
      ctx.font=`900 ${14*dpr}px Hanken Grotesk, sans-serif`;
      ctx.textAlign="center";
      ctx.fillText("Open /upload spectrogram lab",W/2,by+31*dpr);
      ctx.textAlign="left";
    }

    function wrapText(text,x,y,maxWidth,lineHeight){
      const words=text.split(" ");
      let line="";
      for(const word of words){
        const next=line?line+" "+word:word;
        if(ctx.measureText(next).width>maxWidth && line){
          ctx.fillText(line,x,y);
          line=word;
          y+=lineHeight;
        }else{
          line=next;
        }
      }
      if(line) ctx.fillText(line,x,y);
    }
  }

  window.AudioTutorial.visuals.SpectrogramViz = SpectrogramViz;
})();
