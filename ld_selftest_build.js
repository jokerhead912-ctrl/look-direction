'use strict';
/* v12 自檢頁：合成一張圖 → 行真實 addShot/render →
   真跑 CDL 數學、四個操作面、Scopes、.cube / .cdl / 方向紙，
   結果寫落 document.title，headless --dump-dom 捉得出。 */
const fs=require('fs');
const P='/Users/kincheung/WorkBuddy/2026-09-01-13-20-32/look-direction/index.html';
const html=fs.readFileSync(P,'utf8');
const INJECT=`
<script>
(async()=>{
  const R={};
  const ok=(k,v)=>{ R[k]=v; };
  try{
    /* ---------- 1. 載入圖 + render ---------- */
    const c=document.createElement('canvas'); c.width=240; c.height=180;
    const g=c.getContext('2d');
    const gr=g.createLinearGradient(0,0,240,180);
    gr.addColorStop(0,'#1b2836'); gr.addColorStop(0.5,'#7a6a52'); gr.addColorStop(1,'#e0c48a');
    g.fillStyle=gr; g.fillRect(0,0,240,180);
    const img=new Image();
    await new Promise(r=>{ img.onload=r; img.onerror=r; img.src=c.toDataURL('image/png'); });
    ok('imgOK', !!(img.width&&img.height));
    addShot(img,'selftest.png');
    await new Promise(r=>setTimeout(r,350));
    ok('vendor', !!S.vendorImg);
    setActive(0);
    await new Promise(r=>setTimeout(r,350));
    render(false);
    await new Promise(r=>setTimeout(r,350));
    ok('outCanvas', !!S.outCanvas);

    /* ---------- 2. SC DOM（v12 清理 + 新增） ---------- */
    ok('domToneMode', !!$('tonemode'));
    ok('domTspl', !!$('tspl'));
    ok('domTwheel', !!$('twheel'));
    ok('domTcurve', !!$('tcurve'));
    ok('domTnum', !!$('tnum'));
    ok('domScopeCv', !!$('scopecv'));
    ok('domExpMenu', !!$('expmenu'));
    ok('domBcdl', !!$('b-cdl'));
    ok('domHelp', !!$('b-help'));
    ok('goneLock', !$('b-lock'));
    ok('goneAddshot2', !$('b-addshot2'));
    ok('lggWheelCount', document.querySelectorAll('.wheelgrid canvas[data-lg]').length);

    /* ---------- 3. CDL 數學 ---------- */
    const z=newSec();
    const cd0=activeCdlFor(z);
    ok('cdlIdentityAtZero', cdlIsIdentity(cd0));

    /* 曝光 +100 → Slope 全部 ×2^1.5 ≈ 2.828；Offset 要係 0（曝光唔准抬黑位） */
    const ze=Object.assign(newSec(),{exp:100});
    const cde=splToCdl(ze);
    ok('expSlope', +cde.s[0].toFixed(4));
    ok('expOffsetZero', Math.abs(cde.o[0])<1e-9 && Math.abs(cde.o[2])<1e-9);

    /* 對比：樞紐點 0.18 一定要唔郁 */
    const zc=Object.assign(newSec(),{con:60});
    const cdc=splToCdl(zc);
    const pv=[0,1,2].map(i=>0.18*cdc.s[i]+cdc.o[i]);
    ok('contrastPivot', +pv[0].toFixed(4));
    ok('contrastPivotSame', Math.abs(pv[0]-pv[1])<1e-9 && Math.abs(pv[1]-pv[2])<1e-9);

    /* 負對比 → Offset 正（托起黑位）；正對比 → Offset 負 */
    const cdn=splToCdl(Object.assign(newSec(),{con:-60}));
    ok('negContrastOffsetPos', cdn.o[0]>0);
    ok('posContrastOffsetNeg', cdc.o[0]<0);

    /* 色溫：正 = R 升 B 降；色調：正 = G 降（洋紅） */
    const cdt=splToCdl(Object.assign(newSec(),{temp:100}));
    ok('tempRup', cdt.s[0]>1); ok('tempBdown', cdt.s[2]<1);
    const cdi=splToCdl(Object.assign(newSec(),{tint:100}));
    ok('tintGdown', cdi.s[1]<1 && cdi.s[0]>1);

    /* 飽和：sat +100 → Saturation ≈ 1.9 */
    ok('satVal', +splToCdl(Object.assign(newSec(),{sat:100})).sat.toFixed(3));

    /* CDL 公式本身：out = (in*S+O)^P，再過 Sat */
    const ctest={s:[1.5,1,1],o:[0.1,0,0],p:[1,1,1],sat:1};
    ok('cdlFormula', +(applyCdlRGB(100,100,100,ctest)[0]).toFixed(4));

    /* ---------- 4. LGG 色輪 ---------- */
    const w=wheelToRGB(1,0,0.6);
    ok('wheelSumZero', Math.abs(w[0]+w[1]+w[2])<1e-9);
    ok('wheelSumVal', +(w[0]+w[1]+w[2]).toExponential(2));
    ok('wheelR', +w[0].toFixed(4));
    const rt=rgbToWheel(w,0.6);
    ok('wheelRoundTrip', Math.abs(rt.x-1)<1e-6 && Math.abs(rt.y-0)<1e-6);
    const zl=Object.assign(newSec(),{lgg:{lift:{x:0.6,y:0},gamma:{x:0,y:0},gain:{x:0,y:0},off:{x:0,y:0}}});
    const cdl=lggToCdl(zl.lgg);
    ok('liftRaisesR', cdl.o[0]>0);
    ok('liftLowersGB', cdl.o[1]<0 && cdl.o[2]<0);

    /* 串接：SPL 同 LGG 合成要等於逐段計 */
    const sA=splToCdl(Object.assign(newSec(),{exp:40,con:20,temp:30,sat:10}));
    const sB=lggToCdl({lift:{x:0.5,y:0.2},gamma:{x:-0.3,y:0.1},gain:{x:0.4,y:-0.2},off:{x:0,y:0}});
    const comp=composeCdl(sA,sB);
    let manual=[0,0,0];
    for(let i=0;i<3;i++){
      let v=0.5*sA.s[i]+sA.o[i];
      v=v*sB.s[i]+sB.o[i];
      manual[i]=Math.pow(Math.max(0,v),sB.p[i]);
    }
    const Y=0.2126*manual[0]+0.7152*manual[1]+0.0722*manual[2];
    manual=manual.map(v=>Y+(v-Y)*comp.sat);
    const direct=applyCdlRGB(127.5,127.5,127.5,comp);
    ok('composeMatches', Math.abs(direct[0]*255-manual[0]*255)<0.01 && Math.abs(direct[2]*255-manual[2]*255)<0.01);

    /* ---------- 5. 曲線 ---------- */
    ok('curveIdentity', Math.abs(curveAt([[0,0],[1,1]],0.5)-0.5)<1e-9);
    const cpts=[[0,0],[0.25,0.1],[0.75,0.9],[1,1]];
    ok('curveMid', +curveAt(cpts,0.5).toFixed(4));
    ok('curveEndpoints', curveAt(cpts,0)===0 && curveAt(cpts,1)===1);
    const cl=buildCurveLUT(cpts);
    ok('curveLUTlen', cl.length);
    ok('curveLUTends', Math.round(cl[0])===0 && Math.round(cl[255])===255);

    /* ---------- 6. 四個操作面切換 ---------- */
    S.toneMode='spl';
    S.sec.lgg={lift:{x:0.5,y:0},gamma:{x:0,y:0},gain:{x:0,y:0},off:{x:0,y:0}};
    const before=JSON.stringify(activeCdl());
    setToneMode('num');
    ok('modeNum', S.toneMode==='num');
    const afterNum=JSON.stringify(activeCdl());
    ok('switchLossless', before===afterNum);
    setToneMode('wheel');
    ok('modeWheel', S.toneMode==='wheel');
    ok('lggKept', Math.abs(S.sec.lgg.lift.x-0.5)<1e-9);
    setToneMode('curve');
    ok('modeCurve', S.toneMode==='curve');
    setToneMode('spl');
    ok('backToSpl', S.toneMode==='spl' && JSON.stringify(activeCdl())===before);
    updateToneSurfaces();

    /* ---------- 7. Scopes ---------- */
    S.sec.exp=40; S.sec.con=25; S.sec.temp=20; S.sec.sat=10;
    secChanged();
    await new Promise(r=>setTimeout(r,350));
    render(false);
    await new Promise(r=>setTimeout(r,350));
    ['hist','wave','vec'].forEach(m=>{ S.scopeMode=m; drawScopes(); });
    S.scopeMode='hist'; drawScopes();
    const sc=$('scopecv');
    ok('scopePainted', !!(sc&&sc.width>0&&sc.height>0));
    ok('scopePixels', (()=>{
      try{
        const d=sc.getContext('2d').getImageData(0,0,sc.width,sc.height).data;
        let nz=0; for(let i=0;i<d.length;i+=4){ if(d[i]>25||d[i+1]>25||d[i+2]>25) nz++; }
        return nz;
      }catch(e){ return -1; }
    })());
    ok('clipLo', ($('clipLo').textContent||''));
    ok('clipHi', ($('clipHi').textContent||''));

    /* 保層次開咗之後，死黑／爆光一定要係 0% */
    $('protect').checked=true;
    render(false);
    await new Promise(r=>setTimeout(r,350));
    ok('protectClipLo', $('clipLo').textContent);
    ok('protectClipHi', $('clipHi').textContent);
    $('protect').checked=false;
    render(false);
    await new Promise(r=>setTimeout(r,300));

    /* ---------- 8. 匯出 ---------- */
    const cube=makeCubeText();
    ok('cubeLen', cube? cube.length : -1);
    ok('cubeSize', cube? cube.split('\\n')[3] : '');
    const cdlTxt=makeCdlText();
    ok('cdlLen', cdlTxt.length);
    ok('cdlHasSlope', cdlTxt.indexOf('<Slope>')>0);
    ok('cdlHasOffset', cdlTxt.indexOf('<Offset>')>0);
    ok('cdlHasPower', cdlTxt.indexOf('<Power>')>0);
    ok('cdlHasSat', cdlTxt.indexOf('<Saturation>')>0);
    ok('cdlNum', (cdlTxt.match(/-?[0-9]+\\.[0-9]{6}/g)||[]).length);
    const sheet=buildSheetCanvas();
    ok('sheetOK', !!sheet);
    ok('sheetW', sheet? sheet.width : 0);
    ok('sheetH', sheet? sheet.height : 0);

    /* ---------- 9. 數值面輸入 ---------- */
    setToneMode('num');
    updateNumUI();
    const ni=document.querySelector('#tnum input[data-cdl="s0"]');
    ok('numInputExists', !!ni);
    if(ni){
      ni.value='1.7500';
      ni.dispatchEvent(new Event('blur'));
      await new Promise(r=>setTimeout(r,200));
      ok('numSet', Math.abs(S.sec.cdlOv.s[0]-1.75)<1e-6);
      ni.value='zzz';
      ni.dispatchEvent(new Event('blur'));
      await new Promise(r=>setTimeout(r,200));
      ok('numGarbageSafe', Math.abs(S.sec.cdlOv.s[0]-1.75)<1e-6 && !isNaN(S.sec.cdlOv.s[0]));
    }
    setToneMode('spl');

    /* ---------- 10. A/B + slider 打字 ---------- */
    toggleAB(); ok('abLocked', !!S.locked);
    ok('abBadge', ($('abbadge').textContent||''));
    toggleAB(); ok('abBack', !S.locked);
    const slEl=document.querySelector('.sl[data-k="exp"] input.sl-vl');
    ok('slInputExists', !!slEl);
    if(slEl){
      slEl.value='42';
      slEl.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
      await new Promise(r=>setTimeout(r,200));
      ok('typedSet', S.sec.exp===42);
      slEl.value='abc';
      slEl.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
      await new Promise(r=>setTimeout(r,200));
      ok('typedGarbageSafe', S.sec.exp===42 && !isNaN(S.sec.exp));
    }

    /* ---------- 11. 導出選單 / 快捷鍵彈層 ---------- */
    $('b-expmenu').click();
    ok('menuOpen', !$('expmenu').hidden);
    $('b-expmenu').click();
    ok('menuClose', $('expmenu').hidden);
    $('b-help').click();
    ok('helpOpen', !$('kbdpop').hidden);
    $('b-help').click();
    ok('helpClose', $('kbdpop').hidden);

    /* ---------- 12. 全掣推到盡都唔准出 NaN ---------- */
    const extreme=newSec();
    ['exp','con','temp','tint','sat','high','shad','white','black','vib'].forEach(k=>{ extreme[k]=100; });
    extreme.lgg={lift:{x:1,y:1},gamma:{x:1,y:1},gain:{x:1,y:1},off:{x:1,y:1}};
    const cdX=activeCdlFor(extreme);
    ok('extremeFinite', [].concat(cdX.s,cdX.o,cdX.p,[cdX.sat]).every(v=>isFinite(v)));
    const px=applyCdlRGB(0,0,0,cdX).concat(applyCdlRGB(255,255,255,cdX));
    ok('extremeNoNaN', px.every(v=>isFinite(v)));
    ok('extremeNoClipLow', px[0]>=0 && px[0]<=255);

    /* ---------- 13. 合併返嚟嘅遠端功能：導演色彩牆 ---------- */
    ok('dirCount', DIRECTOR_LOOKS.length);
    const d0=DIRECTOR_LOOKS[0];
    const st0=dirStops(d0);
    ok('dirStops3', !!st0 && st0.length===3);
    ok('dirStopsL', !!st0 && st0[0].L===25 && st0[1].L===55 && st0[2].L===85);
    ok('dirStopsClamp', !!st0 && st0.every(s=>Math.abs(s.a)<=26 && Math.abs(s.b)<=26));
    ok('dirStopsFinite', !!st0 && st0.every(s=>isFinite(s.a)&&isFinite(s.b)));
    ok('dirHexRgb', JSON.stringify(hexRgb('#3E6B52')));
    S.dirQ='王家衛'; ok('dirSearch1', dirList().length===1 && dirList()[0].zh==='王家衛');
    S.dirQ='HK';    ok('dirSearchRg', dirList().length>=3);
    S.dirQ='霓虹';  ok('dirSearchSg', dirList().length>=1);
    S.dirQ='zzzz';  ok('dirSearchNone', dirList().length===0);
    S.dirQ='';
    const dw=DIRECTOR_LOOKS.find(d=>d.zh==='王家衛');
    applyDirLook(dw);
    ok('dirApplyOn', S.sec.palOn===1);
    ok('dirApplySig', palSigFromSec()===dw.id);
    applyDirLook(dw);
    ok('dirApplyOff', S.sec.palOn===0);
    ok('dirSearchDom', !!$('dirsearch'));
    const oldWM=S.palWallMode;
    S.palWallMode='dir'; buildWallTiles();
    ok('dirWallTiles', $('palwall').children.length===74);
    ok('dirWallClass', $('palwall').className.indexOf('dirgrid')>=0);
    ok('dirSearchShown', $('dirsearch').style.display==='');
    renderPalWall();
    ok('dirWallPainted', !!$('palwall').children[0].querySelector('canvas'));
    S.palWallMode=oldWM; buildWallTiles();
    ok('dirWallRestore', $('palwall').children.length>0 && $('palwall').className.indexOf('dirgrid')<0);

    /* ---------- 14. 合併返嚟嘅遠端功能：膚色保護 v3 ---------- */
    ok('skinMaskSkin',  +skinMask(62,16,18).toFixed(3));            /* 典型膚色：應該高 */
    ok('skinMaskGreen', +skinMask(60,-30,30).toFixed(3));           /* 綠：應該近 0 */
    ok('skinMaskBlack', skinMask(2,0,0));                           /* 死黑：0 */
    ok('skinMaskGray',  +skinMask(60,0,0).toFixed(3));              /* 中性灰：0 */
    ok('skinMaskRange', [skinMask(62,16,18),skinMask(30,10,12),skinMask(85,8,10)]
                          .every(v=>v>=0&&v<=1));
    /* 全保（prot=1, m=1）：hue 要凍結 —— 輸入嘅 hue 位移要被壓到 ~0 */
    const hs=skinSafe(16,18,-14,6,1,1);
    ok('skinSafeFinite', hs.every(v=>isFinite(v)));
    const h0=Math.atan2(18,16), h1=Math.atan2(18+hs[1],16+hs[0]);
    let dh=h1-h0; while(dh>Math.PI)dh-=2*Math.PI; while(dh<-Math.PI)dh+=2*Math.PI;
    ok('skinSafeHueFreeze', +(Math.abs(dh)*180/Math.PI).toFixed(3));  /* 應該 < 0.5° */
    const hs0=skinSafe(16,18,-14,6,0,1);
    ok('skinSafeNoMask', Math.abs(hs0[0]+14)<1e-9 && Math.abs(hs0[1]-6)<1e-9);
    /* mask 場：整張圖計一次，取樣值要喺 0..1 */
    const fld=buildSkinField(S.vendorLabQuick||S.vendorLabFull);
    let fmin=1,fmax=0,fnan=false;
    for(let i=0;i<fld.m.length;i++){ const v=fld.m[i];
      if(!isFinite(v)) fnan=true; if(v<fmin)fmin=v; if(v>fmax)fmax=v; }
    ok('skinFieldFinite', !fnan);
    ok('skinFieldRange', fmin>=0 && fmax<=1);
    ok('skinSampleRange', (()=>{ const s=sampleSkin(fld,fld.W*2,fld.H*2,0); return isFinite(s)&&s>=0&&s<=1; })());
    /* opt().skinProt：checkbox 關 = 0；開 = S.skinProt/100 */
    const sk=$('skin'); const oldSk=sk.checked;
    sk.checked=false; S.skinProt=100;
    ok('skinProtOff', opt().skinProt===0);
    sk.checked=true;  S.skinProt=85;  ok('skinProtOn85', Math.abs(opt().skinProt-0.85)<1e-9);
    S.skinProt=100;   ok('skinProtOn100', opt().skinProt===1);
    ok('skinProtSliderDom', !!document.querySelector('[data-k="skinProt"]'));
    /* 開住膚保 render：唔准 NaN，唔准崩 */
    sk.checked=true; S.skinProt=100;
    render(false);
    await new Promise(r=>setTimeout(r,300));
    ok('skinRenderOK', !!S.outCanvas);
    const _sid=S.outCanvas.getContext('2d').getImageData(0,0,S.outCanvas.width,S.outCanvas.height).data;
    let _snan=false; for(let i=0;i<_sid.length;i+=4){ if(!isFinite(_sid[i])||!isFinite(_sid[i+1])||!isFinite(_sid[i+2])){_snan=true;break;} }
    ok('skinRenderNoNaN', !_snan);
    sk.checked=oldSk;

    ok('OK', true);
  }catch(e){
    R.OK=false; R.ERR=(e&&e.message)||String(e); R.STACK=(e&&e.stack||'').split('\\n').slice(0,3).join(' | ');
  }
  document.title='SELFTEST '+JSON.stringify(R);
})();
<\/script>
`;
if(!html.includes('</body>')) throw new Error('冇 </body>');
const out=html.replace('</body>', INJECT+'</body>');
fs.writeFileSync('/tmp/_ld_selftest.html', out);
console.log('built /tmp/_ld_selftest.html  '+(out.length/1024).toFixed(0)+'KB');
