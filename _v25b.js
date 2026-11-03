/* T7 單獨測：bypass（K）喺**真實相**上面係咪真係郁到皮膚。
   合成圖唔得：一次調色對嗰嚿純色皮膚嘅色度 delta ≈ 0，而 key 只還原 a/b（色度），
   所以保護同 bypass 都係 no-op —— 量到 0 唔代表 code 錯，係物料冇得保。 */
const { chromium } = require('playwright');
const fs=require('fs');
const D='C:/Users/kincheung/WorkBuddy/2026-10-21-01-48-56/';
const IMGS=['ab_skill_test/ref_shot04.jpg','ab_skill_test/ref_shot05.jpg','ab_skill_test/ref_shot06.jpg'];
let b=null;
(async()=>{
b=await chromium.connectOverCDP('http://127.0.0.1:9444');
const pg=await (b.contexts()[0]).newPage();
pg.setViewportSize({width:1600,height:1000});
const E=[]; pg.on('pageerror',e=>E.push(e.message));
await pg.goto('file:///C:/Users/kincheung/WorkBuddy/2026-10-21-01-48-56/look-direction/index.html',{waitUntil:'load'});
await pg.waitForTimeout(900);
const dataUrls=IMGS.map(f=>'data:image/jpeg;base64,'+fs.readFileSync(D+f).toString('base64'));

const R=await pg.evaluate(async(urls)=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const S=window.ldKey.S;
  const cv=document.querySelector('#cv'), g=cv.getContext('2d');
  const rows=[];
  const loadImg=src=>new Promise(res=>{ const im=new Image(); im.onload=()=>res(im); im.src=src; });

  for(const u of urls){
    const im=await loadImg(u);
    addShot(im,'real'); await sleep(800);
    const sk=document.querySelector('#skin'); if(sk) sk.checked=true;
    /* 關色度降噪：a0/b0 係 prewash **後**嘅值，prewash 自己會郁 1.8 chroma，
      唔關就量唔到「key 保咗幾多」，淨會量到 prewash。 */
    const nr=document.querySelector('#chrnr'); if(nr) nr.checked=false; S.chrNR=false;
    S.skinProt=100; S.chromaStr=100; S.toneStr=0;
    setActive(3); await sleep(300);                  /* 青橙電影：色度重 */
    const ok=autoSkinMatte(); await sleep(700); await sleep(400);
    const cov=+(keyCoverage()*100).toFixed(2);
    /* 攞 matte 內部嘅採樣點（用 blurredMatte 自己搵，唔好估） */
    const K=S.keyMatte, m=window.ldKey.blurredMatte();
    const pts=[];
    if(K&&m){ let cnt=0;
      for(let y=2;y<K.h-2&&pts.length<400;y+=7) for(let x=2;x<K.w-2&&pts.length<400;x+=7)
        if(m[y*K.w+x]>0.9) pts.push([(x+0.5)/K.w,(y+0.5)/K.h]);
    }
    const px=p=>{ const X=Math.max(0,Math.min(cv.width-1,Math.round(p[0]*cv.width)));
      const Y=Math.max(0,Math.min(cv.height-1,Math.round(p[1]*cv.height)));
      const d=g.getImageData(X,Y,1,1).data; return [d[0],d[1],d[2]]; };
    const grab=()=>pts.map(px);
    const diff=(A,B)=>{ let s=0; for(let i=0;i<A.length;i++)
        s+=Math.abs(A[i][0]-B[i][0])+Math.abs(A[i][1]-B[i][1])+Math.abs(A[i][2]-B[i][2]);
      return +(s/(A.length*3)).toFixed(3); };
    const redraw=async()=>{ S.pvKey++; S.pvCache.clear(); scheduleRender(true); await sleep(500); await sleep(400); };

    S.hold=true; paint(); await sleep(80); const orig=grab(); S.hold=false; paint(); await sleep(80);
    S.keyBy=false; await redraw(); const on=grab();
    S.keyBy=false; await redraw(); const on2=grab();   /* 對照組：同一 state render 兩次 */
    S.keyBy=true;  await redraw(); const off=grab();
    S.keyBy=false; await redraw();
    /* 拆 L / a / b：key 保護嘅係「乜」？ */
    const L=p=>0.299*p[0]+0.587*p[1]+0.114*p[2];
    const aP=p=>p[0]-p[1];
    const bP=p=>(p[0]+p[1])/2-p[2];
    const dm=(f,A,B)=>{ let s=0; for(let i=0;i<A.length;i++) s+=Math.abs(f(A[i])-f(B[i])); return +(s/A.length).toFixed(3); };
    /* 決定性檢查：全選 → kf=1 全圖 → 保護應該 100% 還原色度（da_grade≈0）。
       如果呢度都還原唔到，即係保護根本冇行，唔係物料問題。 */
    keyFillAll(); await sleep(600); await sleep(400);
    S.keyBy=false; await redraw(); const fOn=grab();
    S.keyBy=true;  await redraw(); const fOff=grab();
    S.keyBy=false; await redraw();
    const allSel={ daFull_on:dm(aP,fOn,orig), dbFull_on:dm(bP,fOn,orig),
                   daFull_off:dm(aP,fOff,orig), dbFull_off:dm(bP,fOff,orig),
                   bypassFull:diff(fOn,fOff) };
    rows.push({name:S.shots[S.shotIdx].name, auto:ok, coverage:cov, nPts:pts.length, allSel,
      gradeDiff:diff(on,orig), bypassOffDiff:diff(off,orig), bypassDiff:diff(on,off),
      controlDiff:diff(on,on2),
      dL_on_off:dm(L,on,off), da_on_off:dm(aP,on,off), db_on_off:dm(bP,on,off),
      dL_grade:dm(L,on,orig), da_grade:dm(aP,on,orig), db_grade:dm(bP,on,orig),
      chromaStr:S.chromaStr, toneStr:S.toneStr});
  }
  return rows;
}, dataUrls);
console.log(JSON.stringify(R,null,1));
console.log('ERR',E.slice(0,3).join(' | '));
})().catch(e=>console.log('FATAL',e.message))
 .finally(async()=>{ try{ if(b) await b.close(); }catch(_){} process.exit(0); });
