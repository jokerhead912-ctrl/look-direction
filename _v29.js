/* v29：專案儲存 / 開啟 / 自動儲存 回歸（全部要有牙齒）
   T60 UI + ldProj 暴露
   T61 buildProjectFiles 結構：project.json + shot/ref/key media，每張自己嘅 state
   T62 makeZip → unzipStore 逐位元組還原 + EOCD/CRC
   T63 save → newProject(清空) → open 後 shots/refs/customs/settings/grade 全一致
   T64 原檔 bytes 保真（牙齒：canvas 重編碼 hash 一定唔同）
   T65 每張 grade 各自還原；T65b 當前 shot 未 saveShotState 要即場抓（牙齒：舊 sh.st 會錯）
   T66 膚色 key soft matte 存做 alpha PNG 再還原（8-bit quant 誤差 < 1/255）
   T67 舊 .json（base64 media）向後兼容
   T68 IndexedDB autosave 落地
   T69 Ctrl+S 出 1 個 .ldproj 下載
   T70 ?fresh 跳過還原提示
   T71 新專案兩次確認
   T72 reload → restorebar →「還原」成功
   鐵律：finally close browser + process.exit(0)
*/
const { chromium } = require('playwright');
const fs = require('fs');
const D = 'C:/Users/kincheung/WorkBuddy/2026-10-21-01-48-56/';
const APP = 'file:///C:/Users/kincheung/WorkBuddy/2026-10-21-01-48-56/look-direction/index.html';
const jd = f => 'data:image/jpeg;base64,' + fs.readFileSync(D + f).toString('base64');
const IMGS = ['ab_skill_test/ref_shot04.jpg','ab_skill_test/ref_shot05.jpg','ab_skill_test/ref_shot06.jpg']
  .map(f => ({ name: f.split('/').pop(), src: jd(f) }));
const REF = { name:'ref_wkw.jpg', src: jd('ab_skill_test/ref_shot08.jpg') };
let b = null;
const E = [];
const log = m => fs.writeSync(2, '[' + new Date().toISOString().slice(11, 19) + '] ' + m + '\n');

(async () => {
  b = await chromium.connectOverCDP('http://127.0.0.1:9444');
  const ctx = b.contexts()[0];
  const out = { ver: null, pages: {} };

  /* ---------------- pg1：核心 save / open / ZIP / legacy ---------------- */
  const pg = await ctx.newPage();
  pg.setViewportSize({ width: 1600, height: 1000 });
  pg.on('pageerror', e => { E.push('pg1: ' + e.message); log('PAGEERROR pg1 ' + e.message); });
  pg.on('console', m => log('pg1: ' + m.text()));
  log('pg1 goto');
  await pg.goto(APP + '?fresh', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await pg.waitForFunction(() => document.readyState === 'complete', { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(900);

  log('pg1 evaluate START');
  const R = await pg.evaluate(async ({ imgs, ref }) => {
    console.log('S0 start');
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const P = window.ldProj, K = window.ldKey, S = K.S, o = {};
    const hash = u => { let h = 2166136261; for (let i = 0; i < u.length; i += 97) { h ^= u[i]; h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
    const byteEq = (a, b) => { if (!a || !b || a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };
    const pad = n => String(n).padStart(2, '0');
    const load = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });
    const fileOf = async src => { const bl = await (await fetch(src)).blob(); return new File([bl], 'x.jpg', { type: 'image/jpeg' }); };
    const sumM = m => { let s = 0; for (let i = 0; i < m.length; i++) s += m[i]; return +s.toFixed(1); };
    const withTO = (p, ms, tag) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT ' + tag)), ms))]);

    o.ver = (typeof APP_VER !== 'undefined') ? APP_VER : '?';
    console.log('S1 ver=' + o.ver + ' T60probe=' + (typeof P) + '/' + (typeof K));
    /* T60 */
    o.T60_ui = ['b-projsave','b-projopen','b-projnew','restorebar','projfile','rbyes','rbno']
      .every(id => !!document.getElementById(id));
    o.T60_ldProj = ['buildProjectFiles','unzipStore','makeZip','restoreFromMap','restoreProject',
      'saveProjectFile','openProjectBlob','autoSaveNow','scheduleAutoSave','checkAutoSave',
      'idbGet','idbDel','newProject','filesToMap'].every(k => typeof P[k] === 'function');

    /* 由乾淨狀態起 */
    S.shots = []; S.refs = []; S.customs = []; S.shotIdx = -1;
    const srcBytes = [];
    for (let i = 0; i < imgs.length; i++) {
      console.log('S2a load img ' + i);
      const im = await withTO(load(imgs[i].src), 15000, 'img' + i);
      console.log('S2b loaded ' + i + ' ok=' + !!im + ' w=' + (im && im.width));
      const f = await withTO(fileOf(imgs[i].src), 15000, 'file' + i);
      console.log('S2c file ' + i + ' size=' + f.size);
      addShot(im, imgs[i].name, { blob: f });           /* v29：帶原檔 File */
      console.log('S2d addShot ' + i + ' n=' + S.shots.length);
      srcBytes.push(new Uint8Array(await withTO(f.arrayBuffer(), 15000, 'buf' + i)));
      console.log('S2e bytes ' + i + ' len=' + srcBytes[i].length);
      await sleep(320);
    }
    console.log('S2f ref START');
    { const im = await withTO(load(ref.src), 15000, 'refimg');
      const f = await withTO(fileOf(ref.src), 15000, 'reffile');
      addRef(im, ref.name, f); var srcRefBytes = new Uint8Array(await withTO(f.arrayBuffer(), 15000, 'refbuf')); }
    console.log('S2g ref done refs=' + S.refs.length);
    S.customs.push({ kind:'custom', name:'My Look A', sec:Object.assign({}, S.sec, { sat:33, temp:12, high:-8 }) });
    S.customs.push({ kind:'custom', name:'My Look B', sec:Object.assign({}, S.sec, { sat:-21 }) });
    console.log('S2 loaded shots=' + S.shots.length + ' refs=' + S.refs.length);

    /* 三張各設一套 grade，寫入自己嘅 shot state */
    const sats = [-42, 25, 0];
    for (let i = 0; i < 3; i++) {
      switchShot(i);
      S.sec.sat = sats[i]; S.sec.temp = (i === 0 ? 18 : 0); S.sec.high = (i === 1 ? 30 : 0);
      S.chromaStr = 55 + i * 7;
      saveShotState(); render(false); await sleep(130);
    }

    /* shot 1 畫一個 soft key（全 1 + 頭 300 格 gradient，測 8-bit quant） */
    switchShot(1);
    K.keyFillAll();
    const km = S.keyMatte;
    for (let i = 0; i < 300; i++) km.m[i] = i / 300;
    saveShotState();
    const keySumBefore = sumM(S.keyMatte.m);
    const keyLenBefore = S.keyMatte.m.length;
    console.log('S3 key drawn len=' + keyLenBefore + ' sum=' + keySumBefore);

    /* 全域設定：特登設到唔同 default */
    S.wandTol = 27; S.brushR = 61; S.keyFeath = 9; S.split = 0.37;
    S.scopeMode = 'vec'; S.tileSize = 'L'; S.keyShow = 2; S.skinProtSec = false;
    { const en = document.getElementById('expname'); if (en) en.value = 'MY_PROJECT_X'; }

    /* T65b 牙齒：當前 shot 改咗 grade 但唔 saveShotState，build 要即場抓 */
    switchShot(2);
    S.sec.sat = 77; render(false); await sleep(150);
    o.T65b_liveSat = S.sec.sat;
    o.T65b_shStSat = (S.shots[2].st && S.shots[2].st.sec) ? S.shots[2].st.sec.sat : null;

    /* T61 buildProjectFiles */
    console.log('S4a buildProjectFiles START');
    const files = await P.buildProjectFiles();
    console.log('S4b files=' + files.length);
    o.T61_count = files.length;
    o.T61_names = files.map(f => f.name);
    o.T61_hasProj = files.some(f => f.name === 'project.json');
    o.T61_shots = files.filter(f => /^media\/shot_\d+\.png$/.test(f.name)).length;
    o.T61_refs  = files.filter(f => /^media\/ref_\d+\.png$/.test(f.name)).length;
    o.T61_keys  = files.filter(f => /^media\/key_\d+\.png$/.test(f.name)).length;
    o.T61_allNonEmpty = files.every(f => f.data && f.data.length > 0);
    const map = P.filesToMap(files);
    const proj = JSON.parse(new TextDecoder().decode(map['project.json']));
    o.T61_proj = { app:proj.app, ver:proj.ver, shots:proj.shots.length, refs:proj.refs.length,
                   customs:proj.customs.length, settingsKeys:Object.keys(proj.settings || {}).length,
                   shot2sat: proj.shots[2].st && proj.shots[2].st.sec ? proj.shots[2].st.sec.sat : null,
                   keyFiles: proj.shots.map(s => s.st && s.st.keyFile) };
    o.T65b_packedSat = o.T61_proj.shot2sat;
    o.T65b_PASS = (o.T65b_packedSat === 77 && o.T65b_shStSat !== 77);  /* 舊 sh.st 會俾錯數 */

    /* T64 原檔 bytes 保真 + 牙齒（canvas 重編碼一定唔同） */
    o.T64_shotBytes = srcBytes.map((u, i) => byteEq(u, map['media/shot_' + pad(i) + '.png']));
    o.T64_refBytes = byteEq(srcRefBytes, map['media/ref_00.png']);
    const im0 = S.shots[0].img, c = imgToCanvas(im0, im0.width, im0.height);
    const reBlob = await new Promise(r => c.toBlob(r, 'image/png'));
    const reU8 = new Uint8Array(await reBlob.arrayBuffer());
    o.T64_teeth_canvasHash = hash(reU8);
    o.T64_teeth_originalHash = hash(srcBytes[0]);
    o.T64_teeth_differ = o.T64_teeth_canvasHash !== o.T64_teeth_originalHash;

    /* T62 ZIP round-trip + EOCD/CRC */
    console.log('S5a makeZip START');
    const zip = P.makeZip(files);
    const um = await P.unzipStore(zip);
    console.log('S5b zip=' + zip.size + ' unzip=' + Object.keys(um).length);
    o.T62_zipBytes = zip.size;
    o.T62_entries = Object.keys(um).length;
    o.T62_namesEqual = o.T62_entries === files.length && files.every(f => !!um[f.name]);
    o.T62_allByteEqual = files.every(f => byteEq(f.data, um[f.name]));
    const zu = new Uint8Array(await zip.arrayBuffer()), dv = new DataView(zu.buffer);
    let eo = -1;
    for (let i = zu.length - 22; i >= Math.max(0, zu.length - 65557); i--) { if (dv.getUint32(i, true) === 0x06054b50) { eo = i; break; } }
    o.T62_hasEOCD = eo >= 0;
    if (eo >= 0) {
      const cnt = dv.getUint16(eo + 10, true), cd = dv.getUint32(eo + 16, true);
      o.T62_eocdCount = cnt;
      let p = cd, crcOK = true, allStore = true;
      for (let k = 0; k < cnt; k++) {
        const method = dv.getUint16(p + 10, true), csz = dv.getUint32(p + 20, true);
        const fl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
        const lo = dv.getUint32(p + 42, true);
        if (method !== 0) allStore = false;
        if (dv.getUint32(lo, true) === 0x04034b50) {
          const lfl = dv.getUint16(lo + 26, true), lel = dv.getUint16(lo + 28, true);
          const data = zu.subarray(lo + 30 + lfl + lel, lo + 30 + lfl + lel + csz);
          if ((K.crc32(data) >>> 0) !== (dv.getUint32(p + 16, true) >>> 0)) crcOK = false;
        } else crcOK = false;
        p += 46 + fl + el + cl;
      }
      o.T62_crcOK = crcOK; o.T62_allStore = allStore;
    }

    /* 記低 save 前 snapshot */
    const en0 = document.getElementById('expname');
    const snap = {
      n:S.shots.length, names:S.shots.map(s => s.name),
      sats:S.shots.map((s, i) => (i === 2 ? 77 : (s.st && s.st.sec ? s.st.sec.sat : null))),
      chroma:S.shots.map(s => s.st ? s.st.chromaStr : null),
      refN:S.refs.length, custN:S.customs.length, custNames:S.customs.map(c => c.name),
      custSat:S.customs.map(c => c.sec.sat),
      wandTol:S.wandTol, brushR:S.brushR, keyFeath:S.keyFeath, split:S.split,
      scopeMode:S.scopeMode, tileSize:S.tileSize, keyShow:S.keyShow, skinProtSec:S.skinProtSec,
      expName:en0 ? en0.value : '', keySum:keySumBefore, keyLen:keyLenBefore
    };
    o.snap = snap;

    /* T71 新專案兩次確認 */
    P.newProject(); o.T71_firstNoClear = (S.shots.length === snap.n);
    await sleep(60);
    P.newProject(); o.T71_secondClear = (S.shots.length === 0 && S.refs.length === 0 && S.customs.length === 0);

    /* T63 save → 清空 → open（用返同一個 zip blob，等同經下載再開） */
    console.log('S6a openProjectBlob START');
    await P.openProjectBlob(zip);
    console.log('S6b restored n=' + S.shots.length);
    o.T63_n = S.shots.length;
    o.T63_names = S.shots.map(s => s.name);
    o.T63_bytes = S.shots.map((s, i) => byteEq(s.bytes, srcBytes[i]));
    o.T63_refBytes = byteEq(S.refs[0] && S.refs[0].bytes, srcRefBytes);
    o.T63_sats = S.shots.map(s => s.st && s.st.sec ? s.st.sec.sat : null);
    o.T63_chroma = S.shots.map(s => s.st ? s.st.chromaStr : null);
    o.T63_refN = S.refs.length;
    o.T63_custN = S.customs.length; o.T63_custNames = S.customs.map(c => c.name);
    o.T63_custSat = S.customs.map(c => c.sec.sat);
    o.T63_settings = { wandTol:S.wandTol, brushR:S.brushR, keyFeath:S.keyFeath, split:S.split,
      scopeMode:S.scopeMode, tileSize:S.tileSize, keyShow:S.keyShow, skinProtSec:S.skinProtSec,
      expName:(document.getElementById('expname') || {}).value };
    o.T63_shotIdx = S.shotIdx;

    /* T66 key matte round-trip */
    const k1 = S.shots[1].st && S.shots[1].st.key;
    o.T66_hasKey = !!(k1 && k1.m && k1.m.length);
    if (o.T66_hasKey) {
      o.T66_keyLen = k1.m.length; o.T66_keySum = sumM(k1.m);
      o.T66_gradientOK = Math.abs(k1.m[150] - 150 / 300) < 0.01;
      o.T66_sumClose = Math.abs(o.T66_keySum - snap.keySum) < snap.keyLen * 0.005;
    }

    /* T67 舊 .json（media base64 + project）兼容 */
    const media = {};
    for (const k in map) media[k] = K.bytesToB64(map[k]);
    console.log('S7a legacy JSON START');
    const legacyBlob = new Blob([JSON.stringify({ media, project:proj })], { type:'application/json' });
    let legacyErr = null;
    try { await P.openProjectBlob(legacyBlob); } catch (e) { legacyErr = e.message; }
    o.T67_err = legacyErr;
    o.T67_n = S.shots.length; o.T67_names = S.shots.map(s => s.name);
    o.T67_custNames = S.customs.map(c => c.name);
    o.T67_keyHas = !!(S.shots[1].st && S.shots[1].st.key);
    o.T67_bytes = S.shots.map((s, i) => byteEq(s.bytes, srcBytes[i]));

    console.log('S7b legacy done err=' + legacyErr);
    /* T69 Ctrl+S 出 1 個 .ldproj 下載 */
    console.log('S8a Ctrl+S START');
    const orig = HTMLAnchorElement.prototype.click, caps = [];
    HTMLAnchorElement.prototype.click = function(){ caps.push({ href:this.href, download:this.download }); };
    try {
      caps.length = 0;
      document.dispatchEvent(new KeyboardEvent('keydown', { key:'s', ctrlKey:true, bubbles:true }));
      for (let i = 0; i < 30 && !caps.length; i++) await sleep(100);
      o.T69_downloads = caps.length;
      o.T69_name = caps.length ? caps[0].download : null;
      if (caps.length) {
        const z = new Uint8Array(await (await fetch(caps[0].href)).arrayBuffer());
        o.T69_zipMagic = (z[0] === 0x50 && z[1] === 0x4b);
        o.T69_zipBytes = z.length;
      }
    } finally { HTMLAnchorElement.prototype.click = orig; }

    console.log('S8b Ctrl+S done downloads=' + o.T69_downloads);
    /* T68 autosave 落地（清走再寫，之後 pg2 reload 用） */
    console.log('S9a autosave START');
    await P.idbDel();
    const ok = await P.autoSaveNow();
    const rec = await P.idbGet();
    o.T68_return = ok;
    o.T68_hasRec = !!rec;
    o.T68_ver = rec && rec.ver;
    o.T68_files = rec && rec.files ? rec.files.length : 0;
    if (rec && rec.files) {
      const pj = rec.files.find(f => f.name === 'project.json');
      o.T68_pjShots = pj ? (JSON.parse(new TextDecoder().decode(pj.data)).shots || []).length : -1;
    }
    console.log('S9b done idbOK=' + o.T68_hasRec);
    return o;
  }, { imgs: IMGS, ref: REF });
  log('pg1 evaluate DONE');
  out.ver = R.ver; out.pg1 = R;

  /* ---------------- pg2：reload → restorebar → 還原 ---------------- */
  await pg.close();                       /* 停 pg1 嘅 debounce，避免再寫 IDB */
  const pg2 = await ctx.newPage();
  pg2.setViewportSize({ width: 1600, height: 1000 });
  pg2.on('pageerror', e => { E.push('pg2: ' + e.message); log('PAGEERROR pg2 ' + e.message); });
  pg2.on('console', m => log('pg2: ' + m.text()));
  log('pg2 goto');
  await pg2.goto(APP, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await pg2.waitForFunction(() => document.readyState === 'complete', { timeout: 20000 }).catch(() => {});
  await pg2.waitForTimeout(1300);
  out.pg2 = await pg2.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const S = window.ldKey.S, o = {};
    const bar = document.getElementById('restorebar');
    o.T72_barExists = !!bar;
    o.T72_barVisible = !!bar && !bar.hidden;
    o.T72_info = (document.getElementById('rbinfo') || {}).textContent;
    o.T72_beforeN = S.shots.length;
    const y = document.getElementById('rbyes');
    if (y) { y.click(); for (let i = 0; i < 30 && S.shots.length === 0; i++) await sleep(100); await sleep(400); }
    o.T72_afterN = S.shots.length;
    o.T72_afterNames = S.shots.map(s => s.name);
    o.T72_afterCustoms = S.customs.map(c => c.name);
    o.T72_barHiddenAfter = bar ? bar.hidden : null;
    return o;
  });

  /* ---------------- pg3：?fresh 唔應該出還原條 ---------------- */
  const pg3 = await ctx.newPage();
  pg3.on('pageerror', e => { E.push('pg3: ' + e.message); log('PAGEERROR pg3 ' + e.message); });
  pg3.on('console', m => log('pg3: ' + m.text()));
  log('pg3 goto');
  await pg3.goto(APP + '?fresh=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await pg3.waitForFunction(() => document.readyState === 'complete', { timeout: 20000 }).catch(() => {});
  await pg3.waitForTimeout(1200);
  out.pg3 = await pg3.evaluate(() => {
    const bar = document.getElementById('restorebar');
    return { T70_barHidden: !!bar && bar.hidden, T70_shots: window.ldKey.S.shots.length };
  });

  /* ---------------- 判讀 ---------------- */
  const R1 = out.pg1, R2 = out.pg2, R3 = out.pg3, s = R1.snap;
  const chk = {};
  chk['T60_UI_and_ldProj']        = R1.T60_ui && R1.T60_ldProj;
  chk['T61_structure']            = R1.T61_hasProj && R1.T61_shots === 3 && R1.T61_refs === 1 && R1.T61_keys === 1 && R1.T61_allNonEmpty && R1.T61_count === 6;
  chk['T62_zip_roundtrip_CRC']    = R1.T62_hasEOCD && R1.T62_namesEqual && R1.T62_allByteEqual && R1.T62_crcOK && R1.T62_allStore && R1.T62_eocdCount === R1.T61_count;
  chk['T63_open_restores_all']    = R1.T63_n === s.n && JSON.stringify(R1.T63_names) === JSON.stringify(s.names)
    && R1.T63_bytes.every(Boolean) && R1.T63_refBytes
    && JSON.stringify(R1.T63_sats) === JSON.stringify(s.sats)
    && JSON.stringify(R1.T63_chroma) === JSON.stringify(s.chroma)
    && R1.T63_refN === s.refN && R1.T63_custN === s.custN
    && JSON.stringify(R1.T63_custNames) === JSON.stringify(s.custNames)
    && JSON.stringify(R1.T63_custSat) === JSON.stringify(s.custSat)
    && R1.T63_settings.wandTol === s.wandTol && R1.T63_settings.brushR === s.brushR
    && R1.T63_settings.keyFeath === s.keyFeath && Math.abs(R1.T63_settings.split - s.split) < 1e-9
    && R1.T63_settings.scopeMode === s.scopeMode && R1.T63_settings.tileSize === s.tileSize
    && R1.T63_settings.keyShow === s.keyShow && R1.T63_settings.skinProtSec === s.skinProtSec
    && R1.T63_settings.expName === s.expName;
  chk['T64_original_bytes']       = R1.T64_refBytes && R1.T64_shotBytes.every(Boolean) && R1.T64_teeth_differ;
  chk['T65_live_state_teeth']     = R1.T65b_PASS && R1.T65b_packedSat === 77;
  chk['T66_key_matte_roundtrip']  = R1.T66_hasKey && R1.T66_gradientOK && R1.T66_sumClose && R1.T66_keyLen === s.keyLen;
  chk['T67_legacy_json']          = !R1.T67_err && R1.T67_n === s.n && R1.T67_keyHas && R1.T67_bytes.every(Boolean)
    && JSON.stringify(R1.T67_custNames) === JSON.stringify(s.custNames);
  chk['T68_autosave_idb']         = R1.T68_return && R1.T68_hasRec && R1.T68_ver === out.ver && R1.T68_pjShots === s.n;
  chk['T69_ctrl_s_download']      = R1.T69_downloads === 1 && /\.ldproj$/.test(R1.T69_name || '') && R1.T69_zipMagic;
  chk['T70_fresh_skips_restore']  = R3.T70_barHidden;
  chk['T71_new_project_2click']   = R1.T71_firstNoClear && R1.T71_secondClear;
  chk['T72_reload_restore_bar']   = R2.T72_barVisible && /3\s*張/.test(R2.T72_info || '') && R2.T72_beforeN === 0
    && R2.T72_afterN === s.n && R2.T72_barHiddenAfter
    && JSON.stringify(R2.T72_afterCustoms) === JSON.stringify(s.custNames);
  chk['PAGEERROR_none']           = E.length === 0;
  out.PASS = chk;
  out.ALL_PASS = Object.values(chk).every(Boolean);
  out.PAGEERRORS = E.slice(0, 6);

  console.log(JSON.stringify(out, null, 1));
  console.log('PAGEERROR:', E.length ? E.slice(0, 4).join(' | ') : 'none');
  console.log('ALL_PASS:', out.ALL_PASS);
})().catch(e => console.log('FATAL', e.message))
  .finally(async () => { try { if (b) await b.close(); } catch (_) {} process.exit(0); });
