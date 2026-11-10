/* v30：左欄預設收起 + 「跟 reference 改光暗分佈」預設關
   T1 預設 body.lfold、左欄 display:none、☰ 掣存在、stage 明顯闊咗（對照 v28 baseline）
   T2 撳 ☰ 展開 → 左欄返嚟、掣變 «；再撳收返
   T3 localStorage ld.dirfold persist：reload 保持
   T4 #tone 預設 unchecked、shotState().tone=false；牙齒：v28 baseline 係 checked
   T5 tone 掣真係有影響：同一 grade tone on vs off 輸出 hash 唔同；off 兩次 hash 一致（noise control）
   T6 舊專案還原 tone 跟存檔（unpackShotState true→true）
   T7 專注（F）獨立：lfold 收起下開 focus 再關，左欄跟返 lfold 狀態
   鐵律：finally close browser + process.exit(0)
*/
const { chromium } = require('playwright');
const BASE = 'file:///C:/Users/kincheung/WorkBuddy/2026-10-21-01-48-56/look-direction/';
let b = null;
const E = [];
const log = m => { try { require('fs').writeSync(2, '[' + new Date().toISOString().slice(11, 19) + '] ' + m + '\n'); } catch (_) {} };

(async () => {
  b = await chromium.connectOverCDP('http://127.0.0.1:9444');
  const ctx = b.contexts()[0];
  const out = {};

  /* ---- pg0：v28 baseline 牙齒（舊預設 tone=checked、無 lfold）---- */
  const pg0 = await ctx.newPage();
  pg0.setViewportSize({ width: 1600, height: 1000 });
  await pg0.goto(BASE + '_v28base.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await pg0.waitForFunction(() => document.readyState === 'complete', { timeout: 20000 }).catch(() => {});
  await pg0.waitForTimeout(700);
  out.teeth_v28 = await pg0.evaluate(() => ({
    ver: (typeof APP_VER !== 'undefined') ? APP_VER : '?',
    toneDefaultChecked: document.getElementById('tone') ? document.getElementById('tone').checked : null,
    hasDirFold: !!document.getElementById('b-dirfold'),
    bodyLfold: document.body.classList.contains('lfold')
  }));
  await pg0.close();

  /* ---- pg1：v30 主測試 ---- */
  const pg = await ctx.newPage();
  pg.setViewportSize({ width: 1600, height: 1000 });
  pg.on('pageerror', e => { E.push('pg1: ' + e.message); log('PAGEERROR pg1 ' + e.message); });
  pg.on('console', m => log('pg1: ' + m.text()));
  log('pg1 goto');
  await pg.goto(BASE + 'index.html?fresh', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await pg.waitForFunction(() => document.readyState === 'complete', { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(900);

  const R = await pg.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const S = window.ldKey.S, K = window.ldKey;
    const o = {};
    o.ver = (typeof APP_VER !== 'undefined') ? APP_VER : '?';
    const colL = document.querySelector('.col-l'), stage = document.getElementById('stage');

    /* T1 預設收起 */
    o.T1_defaultFold = {
      bodyLfold: document.body.classList.contains('lfold'),
      btnExists: !!document.getElementById('b-dirfold'),
      colLDisplay: colL ? getComputedStyle(colL).display : null,
      colLHidden: !colL || getComputedStyle(colL).display === 'none',
      stageW: stage ? stage.clientWidth : 0,
      S_dirFold: S.dirFold
    };

    /* T5 準備：細圖 + ref，grade 設光暗，量 tone on/off hash */
    const mk = (i, bright) => {
      const c = document.createElement('canvas'); c.width = 520; c.height = 360;
      const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 520, 360);
      if (bright) { g.addColorStop(0, 'rgb(200,205,215)'); g.addColorStop(0.5, 'rgb(150,158,170)'); g.addColorStop(1, 'rgb(90,98,112)'); }
      else { g.addColorStop(0, 'rgb(28,32,40)'); g.addColorStop(0.5, 'rgb(70,78,92)'); g.addColorStop(1, 'rgb(140,150,166)'); }
      x.fillStyle = g; x.fillRect(0, 0, 520, 360);
      x.fillStyle = 'rgba(230,205,185,0.85)'; x.beginPath(); x.arc(260, 180, 60, 0, 7); x.fill();
      return c.toDataURL('image/png');
    };
    const load = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });
    const imS = await load(mk(0, false)), imR = await load(mk(1, true));
    addShot(imS, 'toneTest'); await sleep(300);
    addRef(imR, 'toneRef'); await sleep(200);
    switchShot(0);
    S.sec.con = 40; S.sec.exp = 20; S.chromaStr = 60;
    saveShotState(); render(false); await sleep(250);
    const hash = u => { let h = 2166136261; for (let i = 0; i < u.length; i += 97) { h ^= u[i]; h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
    const snap = async () => { const bl = await new Promise(r => exportFull().toBlob(r, 'image/png')); return hash(new Uint8Array(await bl.arrayBuffer())); };
    const toneCb = document.getElementById('tone');
    o.T4_toneDefault = { checked: toneCb ? toneCb.checked : null, shotStateTone: shotState().tone };
    toneCb.checked = false; render(false); await sleep(150);
    const hOff1 = await snap();
    const hOff2 = await snap();
    toneCb.checked = true; render(false); await sleep(150);
    const hOn = await snap();
    toneCb.checked = false; render(false); await sleep(150);
    const hOff3 = await snap();
    o.T5_toneEffect = { hOff1, hOff2, hOn, hOff3,
      noiseControl: hOff1 === hOff2,
      toneChangesOutput: hOn !== hOff1,
      offAgainMatches: hOff3 === hOff1 };

    /* T6 舊專案 tone 跟存檔 */
    o.T6_unpack = { oldTrue: unpackShotState({ tone:true }, null).tone,
                    oldFalse: unpackShotState({ tone:false }, null).tone };

    /* T2 展開／收起 */
    const btn = document.getElementById('b-dirfold');
    btn.click(); await sleep(120);
    o.T2_open = { bodyLfold: document.body.classList.contains('lfold'),
      colLDisplay: getComputedStyle(colL).display, btnText: btn.textContent,
      stageW: stage.clientWidth };
    btn.click(); await sleep(120);
    o.T2_close = { bodyLfold: document.body.classList.contains('lfold'),
      colLDisplay: getComputedStyle(colL).display, btnText: btn.textContent,
      stageW: stage.clientWidth };

    /* T7 專注（F）獨立 */
    S.focus = true; document.body.classList.toggle('focus', S.focus); await sleep(80);
    o.T7_focusOn = { colLDisplay: getComputedStyle(colL).display };
    S.focus = false; document.body.classList.toggle('focus', S.focus); await sleep(80);
    o.T7_focusOff = { bodyLfold: document.body.classList.contains('lfold'),
      colLDisplay: getComputedStyle(colL).display };

    /* T3 persist：設做展開，reload 後應該保持 */
    localStorage.setItem('ld.dirfold', '0');
    return { o, T3_setup: true, T5: o.T5_toneEffect };
  }, );

  out.pg1 = R.o || R;
  /* T3 reload 驗證 */
  await pg.goto(BASE + 'index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await pg.waitForFunction(() => document.readyState === 'complete', { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(900);
  out.T3_afterReload = await pg.evaluate(() => ({
    bodyLfold: document.body.classList.contains('lfold'),
    colLDisplay: getComputedStyle(document.querySelector('.col-l')).display,
    dirFold: window.ldKey.S.dirFold,
    stored: localStorage.getItem('ld.dirfold')
  }));
  await pg.evaluate(() => { try { localStorage.setItem('ld.dirfold', '1'); } catch (_) {} });

  /* 判讀 */
  const t1 = out.pg1.T1_defaultFold, t2o = out.pg1.T2_open, t2c = out.pg1.T2_close,
        t4 = out.pg1.T4_toneDefault, t5 = out.pg1.T5_toneEffect, t6 = out.pg1.T6_unpack,
        t7o = out.pg1.T7_focusOn, t7f = out.pg1.T7_focusOff, t3 = out.T3_afterReload,
        tv = out.teeth_v28;
  const chk = {
    'T1_default_folded': t1.bodyLfold && t1.btnExists && t1.colLHidden && t1.S_dirFold === true,
    'T1_stage_wider_than_v28_style': t1.stageW > 1000,
    'T2_toggle_works': t2o.colLDisplay !== 'none' && t2o.bodyLfold === false && t2o.btnText === '«'
      && t2c.colLDisplay === 'none' && t2c.bodyLfold === true && t2c.btnText === '☰',
    'T2_stage_wider_when_folded': t2c.stageW > t2o.stageW, /* 收起左欄後畫面闊 316px */
    'T3_persist': t3.bodyLfold === false && t3.colLDisplay !== 'none' && t3.dirFold === false && t3.stored === '0',
    'T4_tone_default_off': t4.checked === false && t4.shotStateTone === false,
    'T4_TEETH_v28_was_on': tv.toneDefaultChecked === true && tv.hasDirFold === false && tv.bodyLfold === false,
    'T5_tone_still_works': t5.noiseControl && t5.toneChangesOutput && t5.offAgainMatches,
    'T6_old_projects_restore': t6.oldTrue === true && t6.oldFalse === false,
    'T7_focus_independent': t7o.colLDisplay === 'none' && t7f.bodyLfold === true,
    'PAGEERROR_none': E.length === 0
  };
  out.PASS = chk;
  out.ALL_PASS = Object.values(chk).every(Boolean);
  console.log(JSON.stringify(out, null, 1));
  console.log('PAGEERROR:', E.length ? E.slice(0, 4).join(' | ') : 'none');
  console.log('ALL_PASS:', out.ALL_PASS);
})().catch(e => console.log('FATAL', e.message))
  .finally(async () => { try { if (b) await b.close(); } catch (_) {} process.exit(0); });
