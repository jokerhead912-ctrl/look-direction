'use strict';
/* v12 自檢頁：合成一張圖 → 行真實 addShot/render →
   真跑 CDL 數學、四個操作面、Scopes、.cube / .cdl / 方向紙，
   結果寫落 document.title，headless --dump-dom 捉得出。 */
const fs=require('fs');
const P=process.argv[2]||'/Users/kincheung/WorkBuddy/2026-09-01-13-20-32/look-direction/index.html';
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

    /* ---------- 15. 防「拖 CDL 桿 → 成張圖變紅」回歸 ----------
       2026-10-24 導演實測：拖任何一條 CDL 桿，畫面即變純紅（G=B=0）。
       root cause：buildPostLUT 開咗 Float32Array(256) 但按 c*256+i 寫到 767；
       typed array 越界寫入係靜默丟棄、唔會報錯，所以一定要靠「三通道都有值」守住。 */
    const _pl=buildPostLUT(newCur(),false);
    ok('plutLen', _pl.length);                 /* 要 768 */
    let _plBad=0; for(let i=0;i<_pl.length;i++) if(!isFinite(_pl[i])) _plBad++;
    ok('plutAllFinite', _plBad===0 && _pl.length===768);
    const _plP=buildPostLUT(newCur(),true);
    let _plPBad=0; for(let i=0;i<_plP.length;i++) if(!isFinite(_plP[i])) _plPBad++;
    ok('plutProtectFinite', _plPBad===0 && _plP.length===768);
    ok('clutLen', buildCdlLUT(activeCdlFor(newSec())).length);

    const _meanRGB=()=>{ const cc=S.outCanvas;
      const d=cc.getContext('2d').getImageData(0,0,cc.width,cc.height).data;
      let r=0,g=0,b=0,n=0;
      for(let i=0;i<d.length;i+=16){ r+=d[i]; g+=d[i+1]; b+=d[i+2]; n++; }
      return [r/n,g/n,b/n]; };
    S.sec=newSec(); syncSecSliders(); render(false);
    const _m0=_meanRGB();
    S.sec.exp=30; render(false);
    const _m1=_meanRGB();
    ok('cdlBaseRGB', _m0.map(v=>Math.round(v)).join(','));
    ok('cdlExpRGB',  _m1.map(v=>Math.round(v)).join(','));
    ok('cdlAllChannelsLive', _m1[0]>5 && _m1[1]>5 && _m1[2]>5);
    ok('cdlNoGreenBlackout', _m1[1] > _m0[1]*0.9);
    ok('cdlNoBlueBlackout',  _m1[2] > _m0[2]*0.9);
    /* 曝光係純 Slope，三通道要同步升 —— G/R 比例唔可以走樣 */
    ok('cdlRatioKept', Math.abs((_m1[1]/_m1[0])-(_m0[1]/_m0[0]))<0.06);
    S.sec.exp=0; render(false);

    /* 真·拖曝光桿：用 slider 自己嘅 API（同 pointer 拖桿行同一條 set() 路徑，
       但唔依賴 headless layout —— getBoundingClientRect().width 間中係 0，
       單靠 pointer 事件會「拖咗等於冇拖」，令下面幾條變假綠。 */
    if(SLIDERS.exp){ SLIDERS.exp.set(56); render(false); }
    const _m2=_meanRGB();
    ok('dragExpSec',  S.sec.exp);              /* 要真係改咗值，否則下面係假綠 */
    ok('dragExpRGB',  _m2.map(v=>Math.round(v)).join(','));
    ok('dragExpNoRed', _m2[1]>5 && _m2[2]>5);
    ok('dragExpBrighter', _m2[0] > _m0[0]);    /* 推正曝光 → R 一定要升 */
    /* 再用真 pointer 事件拖一次（layout 有闊度先斷言） */
    const _sl=document.querySelector('[data-k="exp"]');
    if(_sl){
      const tr=_sl.querySelector('.sl-tr');
      if(tr.scrollIntoView) tr.scrollIntoView();
      const r=tr.getBoundingClientRect();
      ok('ptrDragWidth', Math.round(r.width));
      if(r.width>0){
        const mk=(t,x)=>new PointerEvent(t,{bubbles:true,cancelable:true,clientX:x,clientY:r.top+8,pointerId:1,isPrimary:true});
        tr.dispatchEvent(mk('pointerdown', r.left+r.width*0.2));
        tr.dispatchEvent(mk('pointermove', r.left+r.width*0.45));
        tr.dispatchEvent(mk('pointerup',   r.left+r.width*0.45));
        render(false);
        const _m3=_meanRGB();
        ok('ptrDragSec',  S.sec.exp);
        ok('ptrDragRGB',  _m3.map(v=>Math.round(v)).join(','));
        ok('ptrDragNoRed', _m3[1]>5 && _m3[2]>5);
      }
    }

    /* ---------- 16. 全屏檢查（~ 鍵 · Premiere Pro 式） ---------- */
    ok('fsDom', !!$('b-fs') && !!$('fsbar') && !!$('fshint'));
    ok('fsOffDefault', S.fs===false && !document.body.classList.contains('fs'));
    ok('fsBtnWired', typeof $('b-fs').onclick==='function');
    /* fsFit：全屏要跟螢幕升解像，但唔可以無上限 */
    const _big={width:4000,height:3000};
    const _f1=fsFit(_big), _f0=fitSize(_big,1400,900);
    /* 視口細過 1400×900（例如 headless）嗰陣 fsFit 有 floor，
       結果會等於普通 fitSize —— 呢個係設計而唔係 bug，
       所以呢條要跟實際視口計，唔可以硬 assert「一定大過」。 */
    const _dpr=Math.min(window.devicePixelRatio||1,2);
    const _mw=Math.max(1400, Math.round(Math.min(window.innerWidth *_dpr, 2400)));
    const _mh=Math.max(900,  Math.round(Math.min(window.innerHeight*_dpr, 1500)));
    const _exp=fitSize(_big,_mw,_mh);
    ok('vp', window.innerWidth+'x'+window.innerHeight);
    ok('fsFitBigger', _f1.w>=_f0.w && _f1.h>=_f0.h);          /* 起碼唔可以細過普通視圖 */
    ok('fsFitMatchesViewport', _f1.w===_exp.w && _f1.h===_exp.h);
    ok('fsFitCapped', _f1.w<=2400 && _f1.h<=1500);
    ok('fsFitFinite', isFinite(_f1.w)&&isFinite(_f1.h)&&_f1.w>0&&_f1.h>0);
    /* 細圖唔好無謂升解 */
    const _sm=fsFit({width:240,height:180});
    ok('fsFitSmallNoUpscale', _sm.w<=240 && _sm.h<=180);

    const _cvW0=Math.round($('cv').getBoundingClientRect().width);
    const _labW0=S.vendorLabFull.w;
    const _key=(k,o)=>window.dispatchEvent(new KeyboardEvent('keydown',
      Object.assign({key:k,bubbles:true,cancelable:true},o||{})));
    _key('~');
    ok('fsOnByTilde', S.fs===true && document.body.classList.contains('fs'));
    ok('fsHeaderHidden', getComputedStyle(document.querySelector('header')).display==='none');
    ok('fsLeftHidden',   getComputedStyle(document.querySelector('.col-l')).display==='none');
    ok('fsRightHidden',  getComputedStyle(document.querySelector('.col-r')).display==='none');
    ok('fsScopesHidden', getComputedStyle($('scopes')).display==='none');
    ok('fsBarShown',     getComputedStyle($('fsbar')).display!=='none');
    ok('fsHintShown',    getComputedStyle($('fshint')).display!=='none');
    const _cvW1=Math.round($('cv').getBoundingClientRect().width);
    ok('fsCanvasWider', _cvW1>_cvW0);          /* 全屏真係大咗 */
    ok('fsCanvasSize',  _cvW0+'→'+_cvW1);
    ok('fsLabKept', S.vendorLabFull.w===_labW0 && isFinite(S.vendorLabFull.w));
    ok('fsNameFilled', ($('fsname').textContent||'').indexOf('—')<0);
    /* 再撳 ~ 應該出返去 */
    _key('~');
    ok('fsOffByTilde', S.fs===false && !document.body.classList.contains('fs'));
    /* Esc 都要出到去 */
    _key('~');
    ok('fsOnAgain', S.fs===true);
    _key('Escape');
    ok('fsOffByEsc', S.fs===false && !document.body.classList.contains('fs'));
    ok('fsHeaderBack', getComputedStyle(document.querySelector('header')).display!=='none');
    /* 離開之後 render 解像度要還原 1400×900 嗰份 */
    ok('fsResRestored', S.vendorLabFull.w===_labW0);
    /* 用 API 直接開關都得（掣就係行呢條） */
    toggleFs(true);  ok('fsApiOn',  S.fs===true);
    toggleFs(false); ok('fsApiOff', S.fs===false);
    /* 冇圖嗰陣唔好炸 */
    const _keepImg=S.vendorImg; S.vendorImg=null;
    let _fsNoImgErr=''; try{ toggleFs(true); }catch(e){ _fsNoImgErr=e.message; }
    ok('fsNoImgSafe', !_fsNoImgErr && S.fs===false);
    S.vendorImg=_keepImg;
    /* 全屏入面 render + 拖桿都要照行 */
    toggleFs(true);
    S.sec.exp=20; render(false);
    ok('fsRenderOK', !!S.outCanvas);
    if(SLIDERS.con){ SLIDERS.con.set(20); render(false); }
    const _fsm=_meanRGB();
    ok('fsRGB', _fsm.join(','));
    ok('fsNoRed', _fsm[1]>5 && _fsm[2]>5);
    toggleFs(false);
    S.sec.exp=0; S.sec.con=0; syncSecSliders(); render(false);

    /* ---------- 17. 專注調色模式（F 鍵） ---------- */
    ok('fcDom', !!$('b-focus'));
    ok('fcBtnWired', typeof $('b-focus').onclick==='function');
    const _rect=()=>{ const r=$('cv').getBoundingClientRect(); return Math.round(r.width)+'×'+Math.round(r.height); };
    const _area=()=>{ const r=$('cv').getBoundingClientRect(); return Math.round(r.width*r.height); };
    toggleFocus(false);
    ok('fcOffNow', S.focus===false && !document.body.classList.contains('focus'));
    const _a0=_area(), _r0=_rect();
    _key('f');
    ok('fcOnByF', S.focus===true && document.body.classList.contains('focus'));
    ok('fcLeftHidden', getComputedStyle(document.querySelector('.col-l')).display==='none');
    ok('fcDockHidden', getComputedStyle(document.querySelector('.dock')).display==='none');
    ok('fcRightKept',  getComputedStyle(document.querySelector('.col-r')).display!=='none');
    ok('fcScopesKept', getComputedStyle($('scopes')).display!=='none');
    const _a1=_area(), _r1=_rect();
    ok('fcCanvasSize', _r0+' → '+_r1);
    ok('fcCanvasBigger', _a1 > _a0*1.35);            /* 面積要明顯大咗 */
    ok('fcGainPct', Math.round((_a1/_a0-1)*100)+'%');
    ok('fcPersistOn', localStorage.getItem('ld.focus')==='1');
    /* 專注入面 render + 拖桿都要照行，三通道唔可以塌 */
    S.sec.exp=20; render(false);
    if(SLIDERS.con) SLIDERS.con.set(15);
    render(false);
    const _fcm=_meanRGB();
    ok('fcRGB', _fcm.map(v=>Math.round(v)).join(','));
    ok('fcNoRed', _fcm[1]>5 && _fcm[2]>5);
    S.sec.exp=0; S.sec.con=0; syncSecSliders(); render(false);
    /* F 再撳 = 還原 */
    _key('f');
    ok('fcOffByF', S.focus===false && !document.body.classList.contains('focus'));
    ok('fcLeftBack', getComputedStyle(document.querySelector('.col-l')).display!=='none');
    ok('fcPersistOff', localStorage.getItem('ld.focus')==='0');
    /* Esc 都要出到去 */
    _key('f'); ok('fcOnAgain', S.focus===true);
    _key('Escape'); ok('fcOffByEsc', S.focus===false);
    /* 全屏同專注唔好疊住：開全屏再開專注 → 全屏要讓位 */
    toggleFs(true);  ok('fcFsOn', S.fs===true);
    toggleFocus(true);
    ok('fcExclusiveFs', S.fs===false && S.focus===true);
    toggleFocus(false);
    ok('fcClean', S.focus===false && S.fs===false &&
                  !document.body.classList.contains('focus') &&
                  !document.body.classList.contains('fs'));

    /* ---------- 18. C. PiP 目標圖（R 鍵）+ A. 示波器浮層 ---------- */
    ok('pipDom', !!$('pip') && !!$('pipcv') && !!$('pipx'));
    /* 內建 preset 冇實圖 → PiP 唔應該出 */
    setActive(0); render(false);
    ok('pipHiddenForPreset', $('pip').hidden===true);
    /* 加一張真參考圖 */
    const _rc=document.createElement('canvas'); _rc.width=600; _rc.height=400;
    const _rg=_rc.getContext('2d');
    const _rgd=_rg.createLinearGradient(0,0,600,400);
    _rgd.addColorStop(0,'#0d2b3e'); _rgd.addColorStop(0.5,'#3f7a86'); _rgd.addColorStop(1,'#d9c79a');
    _rg.fillStyle=_rgd; _rg.fillRect(0,0,600,400);
    addRef(_rc,'target.png');
    await new Promise(r=>setTimeout(r,300));
    render(false);
    ok('pipShownForRef', $('pip').hidden===false);
    ok('pipName', ($('pipnm').textContent||'').indexOf('target')>=0);
    /* PiP 要真係畫咗嘢（唔係淨係個框） */
    const _pcv=$('pipcv'), _pd=_pcv.getContext('2d').getImageData(0,0,_pcv.width,_pcv.height).data;
    let _pmin=255,_pmax=0;
    for(let i=0;i<_pd.length;i+=4){ const v=_pd[i]; if(v<_pmin)_pmin=v; if(v>_pmax)_pmax=v; }
    ok('pipPainted', _pmax-_pmin > 30);
    ok('pipPxRange', _pmin+'–'+_pmax);
    /* 撳 PiP 轉角（順序 bl→br→tr→tl） */
    S.pipCorner='bl'; renderPip();
    ok('pipCorner0', $('pip').className.indexOf('bl')>=0);
    cyclePipCorner(); ok('pipCorner1', $('pip').className.indexOf('br')>=0);
    cyclePipCorner(); ok('pipCorner2', $('pip').className.indexOf('tr')>=0);
    cyclePipCorner(); ok('pipCorner3', $('pip').className.indexOf('tl')>=0);
    cyclePipCorner(); ok('pipCornerWrap', $('pip').className.indexOf('bl')>=0);
    /* 撳 PiP 唔好 trigger 個 stage（唔好變咗「撳實睇原圖」） */
    S.hold=false;
    $('pip').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerId:3,isPrimary:true}));
    ok('pipNoStageHold', S.hold===false);
    ok('pipClickCycles', $('pip').className.indexOf('br')>=0 ||
                         $('pip').className.indexOf('bl')>=0);
    /* R 收起／開返 */
    _key('r'); ok('pipOffByR', S.pipOn===false && $('pip').hidden===true);
    _key('r'); ok('pipOnByR',  S.pipOn===true  && $('pip').hidden===false);
    ok('pipPersist', localStorage.getItem('ld.pip')==='1');

    /* A. 示波器浮層：專注模式要變 absolute，唔好再霸垂直空間 */
    toggleFocus(false);
    ok('scopesStatic', getComputedStyle($('scopes')).position!=='absolute');
    const _h0=Math.round($('cv').getBoundingClientRect().height);
    toggleFocus(true);
    ok('scopesFloat', getComputedStyle($('scopes')).position==='absolute');
    const _h1=Math.round($('cv').getBoundingClientRect().height);
    ok('focusH', _h0+'→'+_h1);
    ok('focusTaller', _h1>_h0);
    ok('scopesStillVisible', getComputedStyle($('scopes')).display!=='none');
    ok('scopePainted', (()=>{
      const s=$('scopecv'); const d=s.getContext('2d').getImageData(0,0,s.width,s.height).data;
      let mn=255,mx=0; for(let i=0;i<d.length;i+=4){ if(d[i]<mn)mn=d[i]; if(d[i]>mx)mx=d[i]; }
      return mx-mn>20;
    })());
    /* 專注 + PiP + 浮層示波器 一齊：render 要照行，三通道唔可以塌 */
    S.sec.exp=25; S.sec.con=18; render(false);
    const _allm=_meanRGB();
    ok('allRGB', _allm.map(v=>Math.round(v)).join(','));
    ok('allNoRed', _allm[1]>5 && _allm[2]>5);
    toggleFocus(false);
    S.sec.exp=0; S.sec.con=0; syncSecSliders(); render(false);

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
