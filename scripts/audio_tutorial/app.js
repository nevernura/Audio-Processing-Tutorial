(() => {
  "use strict";

  const { $, el } = window.AudioTutorial;
  const STEPS = window.AudioTutorial.STEPS;

let idx=0,current=null;
const theory=$("#theory"), stageCanvas=$("#stagecanvas"), controlsEl=$("#controls"),
      dotsEl=$("#dots"), counterEl=$("#counter"), backBtn=$("#back"), nextBtn=$("#next"),
      stepTitle=$("#steptitle");

STEPS.forEach((s,i)=>{
  const d=el("b"); d.title=s.short; d.setAttribute("role","button"); d.setAttribute("tabindex","0");
  d.addEventListener("click",()=>go(i));
  d.addEventListener("keydown",e=>{ if(e.key==="Enter" || e.key===" "){ e.preventDefault(); go(i); }});
  dotsEl.appendChild(d);
});

function renderTheory(s){
  theory.innerHTML="";
  const wrap=el("div","lesson-card");
  wrap.appendChild(el("div","kicker",s.kicker));
  wrap.appendChild(el("h2",null,s.title));
  wrap.appendChild(el("p","intuition",s.intuition));
  if(s.takeaway) wrap.appendChild(el("div","takeaway",s.takeaway));
  if(s.chips && s.chips.length){
    const chips=el("div","chips");
    s.chips.forEach(c=>chips.appendChild(el("span","chip",c)));
    wrap.appendChild(chips);
  }
  const mw=el("div","mathwrap");
  const tog=el("button","mathtoggle",`<span class="chev">▶</span> Show the math`);
  const body=el("div","mathbody",s.math);
  tog.addEventListener("click",()=>{
    const open=body.classList.toggle("open");
    tog.classList.toggle("open",open);
    tog.innerHTML=`<span class="chev">▶</span> ${open?"Hide":"Show"} the math`;
    if(open) renderMath(body);
  });
  mw.append(tog,body); wrap.appendChild(mw); theory.appendChild(wrap);
}

function renderControls(viz){
  controlsEl.innerHTML="";
  (viz.controls || []).forEach(c=>{
    if(c.type==="range"){
      const w=el("div","ctl"), lab=el("label",null,c.label), inp=el("input");
      inp.type="range"; inp.min=c.min; inp.max=c.max; inp.step=c.step; inp.value=c.val();
      const v=el("span","val",c.fmt?c.fmt(+inp.value):inp.value);
      inp.addEventListener("input",()=>{ c.on(+inp.value); v.textContent=c.fmt?c.fmt(+inp.value):inp.value; });
      w.append(lab,inp,v); controlsEl.appendChild(w);
    }else if(c.type==="seg"){
      const w=el("div","ctl"); w.appendChild(el("label",null,c.label));
      const seg=el("div","seg");
      c.opts.forEach(([val,txt])=>{
        const b=el("button",null,txt); b.classList.toggle("active",c.val()===val);
        b.addEventListener("click",()=>{ [...seg.children].forEach(x=>x.classList.remove("active")); b.classList.add("active"); c.on(val); });
        seg.appendChild(b);
      });
      w.appendChild(seg); controlsEl.appendChild(w);
    }else if(c.type==="play"){
      const b=el("button","playbtn",`▶ ${typeof c.label==="function"?c.label():c.label}`);
      b.addEventListener("click",()=>c.on()); controlsEl.appendChild(b);
    }
  });
  const err=el("span","errmsg"); err.id="sg-err"; controlsEl.appendChild(err);
}

function renderLegend(viz){
  if(!viz.legend || !viz.legend.length) return;
  const legend=el("div","legend");
  viz.legend.forEach(([color,label])=>legend.appendChild(el("span",null,`<i style="background:${color}"></i>${label}`)));
  stageCanvas.appendChild(legend);
}

function go(i){
  if(i<0 || i>=STEPS.length) return;
  if(current && current.unmount) current.unmount();
  stageCanvas.querySelectorAll("canvas,.hint,.axis-note,.legend").forEach(n=>n.remove());
  idx=i; const s=STEPS[i];
  renderTheory(s);
  const viz=s.viz(); current=viz;
  if(viz.note) stageCanvas.appendChild(el("div","axis-note",viz.note));
  renderLegend(viz);
  viz.mount(stageCanvas);
  if(viz.hint){ const h=el("div","hint",viz.hint); h.id="stage-hint"; stageCanvas.appendChild(h); }
  renderControls(viz);
  counterEl.textContent=`${String(i+1).padStart(2,"0")} / ${String(STEPS.length).padStart(2,"0")}`;
  [...dotsEl.children].forEach((d,j)=>{ d.classList.toggle("on",j===i); d.classList.toggle("done",j<i); d.setAttribute("aria-current",j===i?"step":"false"); });
  backBtn.disabled=i===0; nextBtn.disabled=i===STEPS.length-1;
  nextBtn.textContent=i===STEPS.length-1?"Done ✓":"Next →";
  stepTitle.textContent=s.short;
}

function renderMath(node){
  if(window.renderMathInElement){
    window.renderMathInElement(node,{delimiters:[
      {left:"$$",right:"$$",display:true},
      {left:"$",right:"$",display:false}
    ]});
  }
}

backBtn.addEventListener("click",()=>go(idx-1));
nextBtn.addEventListener("click",()=>go(idx+1));
window.addEventListener("keydown",e=>{
  if(e.target && ["INPUT","BUTTON"].includes(e.target.tagName)) return;
  if(e.key==="ArrowRight") go(idx+1);
  if(e.key==="ArrowLeft") go(idx-1);
});
window.addEventListener("resize",()=>go(idx));
window.addEventListener("load",()=>go(0));
if(document.readyState==="complete") go(0);
})();
