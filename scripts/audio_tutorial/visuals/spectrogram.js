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
    ac,
    sampleRate
  } = window.AudioTutorial;

function SpectrogramViz(){
  let cv,gl,prog,tex,raf,analyser,srcNode,stream,freqData,fileEl;
  let writeCol=0,HIST=1024,bins=1024,running=false;
  let source="tone",scale="log",gain=0.72,cmap=0;
  let uHead,uLog,uMinF,uGain,uMap;
  const VERT=`attribute vec2 p; varying vec2 uv; void main(){ uv=p*0.5+0.5; gl_Position=vec4(p,0.,1.);}`;
  const FRAG=`
    precision mediump float; varying vec2 uv; uniform sampler2D tex;
    uniform float head, logScale, minF, gainv; uniform int cmap;
    vec3 sunset(float t){ return mix(vec3(0.05,0.08,0.2), mix(vec3(1.0,0.22,0.6), vec3(1.0,0.86,0.22), smoothstep(.45,1.0,t)), smoothstep(.02,1.0,t)); }
    vec3 ocean(float t){ return mix(vec3(0.04,0.08,0.18), mix(vec3(0.08,0.84,0.82), vec3(0.86,1.0,0.52), smoothstep(.55,1.0,t)), smoothstep(.02,1.0,t)); }
    void main(){
      float fN=(logScale>.5)?pow(minF,1.0-uv.y):uv.y;
      float m=texture2D(tex,vec2(uv.x+head,clamp(fN,0.0,1.0))).r;
      m=clamp(pow(m,gainv),0.0,1.0);
      vec3 c=(cmap==0)?sunset(m):ocean(m);
      gl_FragColor=vec4(c,1.0);
    }`;
  return {
    controls:[
      {type:"seg",label:"Source",opts:[["tone","Sweep"],["mic","Mic"],["file","File"]],val:()=>source,on:v=>{source=v; if(v==="file") fileEl.click(); restart();}},
      {type:"seg",label:"Scale",opts:[["log","Log"],["lin","Linear"]],val:()=>scale,on:v=>scale=v},
      {type:"range",label:"Gain",min:.4,max:1.25,step:.02,val:()=>gain,fmt:v=>v.toFixed(2),on:v=>gain=v},
      {type:"seg",label:"Color",opts:[["0","Sunset"],["1","Ocean"]],val:()=>String(cmap),on:v=>cmap=+v},
      {type:"play",label:()=>running?"Stop":"Start",on:()=>running?stop():start()}
    ],
    note:"time -> · frequency up · brightness = energy",
    hint:"Press <b>Start</b>. Sweep works everywhere; mic requires browser permission.",
    mount(host){
      cv=el("canvas"); host.appendChild(cv);
      gl=cv.getContext("webgl") || cv.getContext("experimental-webgl");
      if(!gl){ showErr("WebGL is not available in this browser."); return; }
      ensureFile(); initGL(); drawEmpty();
    },
    unmount(){ stop(); if(fileEl) fileEl.remove(); fileEl=null; }
  };
  function ensureFile(){
    if(!fileEl){
      fileEl=el("input"); fileEl.type="file"; fileEl.accept="audio/*"; fileEl.style.display="none";
      document.body.appendChild(fileEl);
      fileEl.addEventListener("change",()=>{ if(fileEl.files.length){ source="file"; restart(); }});
    }
  }
  function compile(type,src){
    const s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
    return s;
  }
  function initGL(){
    prog=gl.createProgram(); gl.attachShader(prog,compile(gl.VERTEX_SHADER,VERT)); gl.attachShader(prog,compile(gl.FRAGMENT_SHADER,FRAG));
    gl.linkProgram(prog); gl.useProgram(prog);
    const buf=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buf);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    const loc=gl.getAttribLocation(prog,"p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
    uHead=gl.getUniformLocation(prog,"head"); uLog=gl.getUniformLocation(prog,"logScale"); uMinF=gl.getUniformLocation(prog,"minF");
    uGain=gl.getUniformLocation(prog,"gainv"); uMap=gl.getUniformLocation(prog,"cmap"); allocTex();
  }
  function allocTex(){
    tex=tex || gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.LUMINANCE,HIST,bins,0,gl.LUMINANCE,gl.UNSIGNED_BYTE,new Uint8Array(HIST*bins));
    writeCol=0;
  }
  async function buildGraph(){
    const c=ac(); analyser=c.createAnalyser(); analyser.fftSize=2048; analyser.smoothingTimeConstant=.55;
    bins=analyser.frequencyBinCount; freqData=new Uint8Array(bins); allocTex();
    if(source==="mic"){
      stream=await navigator.mediaDevices.getUserMedia({audio:true}); srcNode=c.createMediaStreamSource(stream); srcNode.connect(analyser);
    }else if(source==="tone"){
      const osc=c.createOscillator(), g=c.createGain(); g.gain.value=.13; osc.type="sawtooth";
      const t0=c.currentTime; osc.frequency.setValueAtTime(120,t0); osc.frequency.exponentialRampToValueAtTime(8000,t0+6);
      osc.frequency.exponentialRampToValueAtTime(120,t0+12); osc.connect(g); g.connect(analyser); g.connect(c.destination); osc.start(); srcNode=osc;
    }else if(source==="file"){
      ensureFile(); if(!fileEl.files.length) throw {soft:true};
      const ab=await fileEl.files[0].arrayBuffer(), dec=await c.decodeAudioData(ab), s=c.createBufferSource();
      s.buffer=dec; s.connect(analyser); analyser.connect(c.destination); s.start(); s.onended=stop; srcNode=s;
    }
  }
  async function start(){
    ensureFile(); clearErr();
    try{ await buildGraph(); running=true; hideHint(); refreshPlay(); loop(); }
    catch(e){ if(!(e&&e.soft)) showErr(e&&e.name==="NotAllowedError"?"Microphone permission denied.":("Error: "+(e.message||e))); stop(); }
  }
  function stop(){
    running=false; cancelAnimationFrame(raf);
    if(stream){ stream.getTracks().forEach(t=>t.stop()); stream=null; }
    if(srcNode){ try{srcNode.stop && srcNode.stop();}catch(e){} try{srcNode.disconnect();}catch(e){} srcNode=null; }
    refreshPlay();
  }
  function restart(){ if(running){ stop(); start(); } }
  function loop(){
    if(!running) return; raf=requestAnimationFrame(loop);
    analyser.getByteFrequencyData(freqData); gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.texSubImage2D(gl.TEXTURE_2D,0,writeCol,0,1,bins,gl.LUMINANCE,gl.UNSIGNED_BYTE,freqData);
    writeCol=(writeCol+1)%HIST; renderGL();
  }
  function renderGL(){
    const r=cv.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
    cv.width=Math.max(1,Math.round(r.width*dpr)); cv.height=Math.max(1,Math.round(r.height*dpr));
    gl.viewport(0,0,cv.width,cv.height); gl.uniform1f(uHead,(writeCol+.5)/HIST); gl.uniform1f(uLog,scale==="log"?1:0);
    gl.uniform1f(uMinF,30/(sampleRate()/2)); gl.uniform1f(uGain,gain); gl.uniform1i(uMap,cmap); gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  }
  function drawEmpty(){ if(gl) renderGL(); }
  function refreshPlay(){ const b=document.querySelector(".playbtn"); if(b){ b.classList.toggle("on",running); b.textContent=running?"■ Stop":"▶ Start"; } }
  function showErr(m){ const e=$("#sg-err"); if(e) e.textContent=m; }
  function clearErr(){ showErr(""); }
  function hideHint(){ const h=$("#stage-hint"); if(h) h.style.opacity="0"; }
}

  window.AudioTutorial.visuals.SpectrogramViz = SpectrogramViz;
})();
