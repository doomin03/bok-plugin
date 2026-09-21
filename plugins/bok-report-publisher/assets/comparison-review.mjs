// Embedded in comparison.html; no server or external script is required.
export function csvText(rows) {
  const cell = value => {
    let text = String(value ?? '');
    if (/^[=+\-@\t\r\n']/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return '﻿' + rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}

export function parseCsv(input) {
  const text = input.replace(/^﻿/, '');
  const rows = []; let row = [], value = '', quoted = false, closed = false;
  const push = () => { row.push(value.replace(/^'(?=[=+\-@\t\r\n'])/, '')); value = ''; closed = false; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { value += '"'; i++; }
      else if (ch === '"') { quoted = false; closed = true; }
      else value += ch;
    } else if (ch === ',' || ch === '\n' || ch === '\r') {
      push();
      if (ch !== ',') { rows.push(row); row = []; if (ch === '\r' && text[i + 1] === '\n') i++; }
    } else if (ch === '"' && !value && !closed) quoted = true;
    else { if (closed || ch === '"') throw Error('CSV 따옴표 형식이 잘못되었습니다.'); value += ch; }
  }
  if (quoted) throw Error('CSV 따옴표가 닫히지 않았습니다.');
  if (value || closed || row.length) { push(); rows.push(row); }
  return rows;
}

// 오너 판정 버튼: 동일함/유사함/다름/보류 (표준 결정: reuse/reuse-adapt/new/hold)
const VERDICTS = ['동일함', '유사함', '다름', '보류'];

export function mountReview(config) {
  const columns = ['id', 'title', 'similarity_percent', 'changed_percent', 'status', 'evidence_id', 'target_source', 'analysis', 'verdict', 'review', 'updated_at'];
  const items = config.items;
  const cacheKey = 'bok-comparison-review:' + config.key;
  const blank = () => ({ verdict: '', review: '', updated_at: '' });
  let saved = Object.fromEntries(items.map(item => [item.id, blank()]));
  let fileHandle = null, fileVersion = null, busy = false;
  const message = document.getElementById('review-message');
  const say = text => { message.textContent = text; };
  const remember = () => {
    try { localStorage.setItem(cacheKey, JSON.stringify(saved)); return true; } catch { return false; }
  };
  const ok = entry => entry && typeof entry.review === 'string' && typeof entry.updated_at === 'string' && typeof entry.verdict === 'string';
  try {
    const cache = JSON.parse(localStorage.getItem(cacheKey) || 'null');
    if (cache && items.every(item => ok(cache[item.id]))) {
      saved = cache; say('이 브라우저에 저장한 리뷰를 복원했습니다. CSV의 최신 내용을 쓰려면 CSV 불러오기를 누르세요.');
    }
  } catch { /* CSV remains usable if local storage is unavailable. */ }
  const area = index => document.getElementById('review-' + index);
  const pending = Object.fromEntries(items.map(item => [item.id, saved[item.id].verdict]));
  const paintVerdict = (item, index) => VERDICTS.forEach(v => {
    const b = document.getElementById('verdict-' + index + '-' + v);
    if (b) b.classList.toggle('sel', pending[item.id] === v);
  });
  const render = () => items.forEach((item, index) => {
    area(index).value = saved[item.id].review;
    pending[item.id] = saved[item.id].verdict;
    paintVerdict(item, index);
    document.getElementById('review-status-' + index).textContent =
      saved[item.id].updated_at ? '적용 ' + saved[item.id].updated_at + (saved[item.id].verdict ? ' [' + saved[item.id].verdict + ']' : '') : '미작성';
  });
  const content = state => csvText([columns, ...items.map(item => [item.id, item.title,
    item.metrics?.pixelSimilarityPercent ?? '', item.metrics?.changedPixelPercent ?? '', item.status,
    item.evidenceId, item.comparisonTarget?.selectedSource ?? '', item.analysis,
    state[item.id].verdict, state[item.id].review, state[item.id].updated_at])]);
  const download = text => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'comparison-review.csv'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const write = async (handle, text, expected = null) => {
    if (expected !== null && await (await handle.getFile()).text() !== expected)
      throw Error('CSV가 다른 창이나 프로그램에서 변경되었습니다. 먼저 CSV를 다시 불러오세요.');
    const stream = await handle.createWritable();
    try { await stream.write(text); await stream.close(); }
    catch (error) { await stream.abort().catch(() => {}); throw error; }
    return text.replace(/^﻿/, '');
  };
  const run = async task => {
    if (busy) return;
    busy = true; document.querySelectorAll('[data-review-action]').forEach(button => { button.disabled = true; });
    try { await task(); } catch (error) { say(error.name === 'AbortError' ? '파일 선택을 취소했습니다. 변경 사항은 저장하지 않았습니다.' : '저장/불러오기 실패: ' + error.message); }
    finally { busy = false; document.querySelectorAll('[data-review-action]').forEach(button => { button.disabled = false; }); }
  };
  const persist = (item, index) => run(async () => {
    const next = { ...saved, [item.id]: { verdict: pending[item.id] || '', review: area(index).value, updated_at: new Date().toISOString() } };
    const text = content(next);
    if (fileHandle) fileVersion = await write(fileHandle, text, fileVersion);
    else download(text);
    saved = next;
    const cached = remember();
    document.getElementById('review-status-' + index).textContent = '적용 ' + saved[item.id].updated_at + (saved[item.id].verdict ? ' [' + saved[item.id].verdict + ']' : '');
    say(item.id + (fileHandle ? ' 판정·리뷰를 연결된 CSV에 저장했습니다.' : ' 판정·리뷰를 적용하고 CSV 다운로드를 요청했습니다.') + (cached ? '' : ' 브라우저 임시 저장이 불가하므로 CSV를 보관하세요.'));
  });
  items.forEach((item, index) => {
    area(index).addEventListener('input', () => { document.getElementById('review-status-' + index).textContent = '수정 중 · 적용·저장을 눌러주세요'; });
    VERDICTS.forEach(v => {
      const b = document.getElementById('verdict-' + index + '-' + v);
      if (b) b.addEventListener('click', () => { pending[item.id] = v; paintVerdict(item, index); persist(item, index); });
    });
    document.getElementById('apply-review-' + index).addEventListener('click', () => persist(item, index));
  });
  document.getElementById('save-review-csv').addEventListener('click', () => run(async () => {
    const text = content(saved);
    if (window.showSaveFilePicker) {
      const handle = await window.showSaveFilePicker({ suggestedName: 'comparison-review.csv', types: [{ description: 'CSV', accept: { 'text/csv': ['.csv'] } }] });
      const version = await write(handle, text);
      fileHandle = handle; fileVersion = version;
      say('CSV를 저장하고 연결했습니다. 이제 각 항목의 판정·적용·저장이 이 CSV를 갱신합니다.');
    } else { download(text); say('적용된 전체 리뷰 CSV 다운로드를 요청했습니다. 수정 중인 글은 항목별 적용·저장을 먼저 누르세요.'); }
  }));
  const importFile = async (file, handle = null) => {
    if (file.size > 5 * 1024 * 1024) throw Error('CSV 파일은 5MB 이하여야 합니다.');
    const text = await file.text(), rows = parseCsv(text), header = rows.shift();
    if (!header || columns.some((name, index) => header[index] !== name) || header.length !== columns.length || rows.length !== items.length)
      throw Error('이 비교 화면에서 저장한 CSV 형식/항목 수와 일치하지 않습니다.');
    const next = {}, byId = new Map(items.map(item => [item.id, item]));
    for (const row of rows) {
      const item = byId.get(row[0]);
      if (row.length !== columns.length || !item || Object.hasOwn(next, item.id) || item.evidenceId !== row[5])
        throw Error('비교 대상이 다르거나 중복된 CSV입니다. 현재 리뷰는 유지됩니다.');
      if (row[2] !== String(item.metrics?.pixelSimilarityPercent ?? '') || row[3] !== String(item.metrics?.changedPixelPercent ?? '') || row[4] !== item.status)
        throw Error('CSV 유사도/상태가 현재 계산 결과와 다릅니다.');
      if (row[8] && !VERDICTS.includes(row[8])) throw Error('CSV verdict 값이 올바르지 않습니다: ' + row[8]);
      Object.defineProperty(next, item.id, { value: { verdict: row[8], review: row[9], updated_at: row[10] }, enumerable: true, writable: true, configurable: true });
    }
    if (items.some((item, index) => area(index).value !== saved[item.id].review || pending[item.id] !== saved[item.id].verdict) && !window.confirm('적용하지 않은 입력을 CSV 내용으로 바꿀까요?')) return;
    saved = next; fileHandle = handle; fileVersion = handle ? text.replace(/^﻿/, '') : null; remember(); render();
    say(handle ? 'CSV의 판정·리뷰를 불러왔습니다. 적용·저장을 누르면 이 파일을 갱신합니다.' : 'CSV의 판정·리뷰를 불러왔습니다. 적용·저장은 새 CSV 다운로드로 저장됩니다.');
  };
  document.getElementById('open-review-csv').addEventListener('click', () => {
    if (window.showOpenFilePicker) run(async () => {
      const [handle] = await window.showOpenFilePicker({ multiple: false, types: [{ description: 'CSV', accept: { 'text/csv': ['.csv'] } }] });
      await importFile(await handle.getFile(), handle);
    });
    else document.getElementById('review-csv-file').click();
  });
  document.getElementById('review-csv-file').addEventListener('change', event => {
    const file = event.target.files[0]; if (file) run(() => importFile(file)); event.target.value = '';
  });
  window.addEventListener('beforeunload', event => {
    if (items.some((item, index) => area(index).value !== saved[item.id].review || pending[item.id] !== saved[item.id].verdict)) { event.preventDefault(); event.returnValue = ''; }
  });
  render();
}
