/* CDL 自洽檢查（唔使 Resolve 都驗到）：
   將「app 自己 render 出嚟」對「同一組導出 CDL 直接打落原圖」逐像素比。
   如果兩者差得遠，即係導出俾供應商嗰組數字同 app 顯示嘅唔係同一件事 ——
   「對外工具照做」嗰條就會穿。 */
const { chromium } = require('playwright');
(async()=>{
  const b=await chromium.connectOverCDP('http://127.0.0.1:9444');
  const pg=await (b.contexts()[0]).newPage();
  pg.setViewportSize({width:1600,height:1000});
  const E=[]; pg.on('pageerror',e=>E.push(e.message));
  await pg.goto('file:///C:/Users/kincheung/WorkBuddy/2026-10-21-01-48-56/look-direction/index.html',{waitUntil:'load'});
  await pg.waitForTimeout(800);
  const R=await pg.evaluate(async()=>{
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const S=window.ldKey.S, P=window.ldPerf;
    const cv=document.querySelector('#cv'), g=cv.getContext('2d');
    const c=document.createElement('canvas'); c.width=800;c.height=500;
    const x=c.getContext('2d');
    for(let i=0;i<8;i++){ const v=Math.round(20+i*30);
      x.fillStyle='rgb('+v+','+v+','+v+')'; x.fillRect(i*100,0,100,500); }
    addShot(c,'cdl'); await sleep(600);

    /* 淨留 CDL：關方向注入、關 tone、曲線拉直、關保層次 */
    S.sec.palOn=0; S.sec.toneStr=0; S.sec.strength=0;
    const tcb=document.getElementById('tone'); if(tcb) tcb.checked=false;
    const pcb=document.getElementById('protect'); if(pcb) pcb.checked=false;
    for(const k of ['exp','con','high','shad','white','black','temp','tint','vib','sat']) S.sec[k]=0;

    const out={pivot:null, rows:{}};
    out.pivot = (typeof cdlPivotFor==='function') ? +cdlPivotFor().toFixed(4) : null;
    for(const con of [0,40,80]){
      for(const k of ['exp','con','sat']) S.sec[k]=0;
      S.sec.con=con;
      S.pvKey++; S.pvCache.clear(); P.render(false); await sleep(200);
      const W=cv.width,H=cv.height;
      const A=g.getImageData(0,0,W,H).data;
      const cdl=exportCdlFor(S.sec);
      const oc=S.vendorOrig, ow=oc.width, oh=oc.height;
      const og=oc.getContext('2d').getImageData(0,0,ow,oh).data;
      const s0=cdl.s[0],o0=cdl.o[0],p0=cdl.p[0],sat=cdl.sat;
      const sx=ow/W, sy=oh/H;
      let sum=0,mx=0,n=0;
      for(let y=0;y<H;y+=2) for(let xx=0;xx<W;xx+=2){
        const ox=Math.min(ow-1,Math.round(xx*sx)), oy=Math.min(oh-1,Math.round(y*sy));
        const oi=(oy*ow+ox)*4, ai=(y*W+xx)*4;
        const v=[0,0,0];
        for(let ch=0;ch<3;ch++){
          let t=(og[oi+ch]/255)*s0+o0; if(t<0)t=0; else if(t>1)t=1;
          if(p0!==1) t=Math.pow(t,p0);
          v[ch]=t*255;
        }
        if(sat!==1){ const Y=0.2126*v[0]+0.7152*v[1]+0.0722*v[2];
          v[0]=Y+(v[0]-Y)*sat; v[1]=Y+(v[1]-Y)*sat; v[2]=Y+(v[2]-Y)*sat; }
        let d=0;
        for(let ch=0;ch<3;ch++){ const dd=Math.abs(v[ch]-A[ai+ch]); if(dd>d) d=dd; }
        sum+=d; if(d>mx)mx=d; n++;
      }
      /* 導出 CDL 嘅真正不動點：x = o/(1-s) */
      const fp = (Math.abs(1-s0)<1e-9)? null : +(o0/(1-s0)).toFixed(4);
      out.rows['con'+con]={slope:+s0.toFixed(4), offset:+o0.toFixed(4), power:p0, sat:+sat.toFixed(4),
                           meanDiff:+(sum/n).toFixed(2), maxDiff:+mx.toFixed(2), fixedPoint:fp};
    }
    /* 復原 */
    for(const k of ['exp','con','sat']) S.sec[k]=0;
    S.pvKey++; S.pvCache.clear(); P.render(false);
    return out;
  });
  console.log(JSON.stringify(R,null,1));
  console.log('ERR',E.slice(0,3).join(' | '));
  await pg.close(); await b.close();
})().catch(e=>console.log('FATAL',e.message));
