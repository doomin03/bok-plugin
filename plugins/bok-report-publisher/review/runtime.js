// Included only by the explicitly enabled review build. No server write endpoint.
const style = document.createElement('style');
style.textContent = '.bok-review-id{display:inline-block!important;background:#123c63!important;color:white!important;border:2px solid #71cef5!important;border-radius:5px;padding:6px 10px!important;margin:6px!important;font:13px sans-serif!important;cursor:pointer}.bok-review-dialog{width:min(560px,90vw);padding:24px;border:2px solid #123c63;border-radius:10px;z-index:2147483647}.bok-review-dialog::backdrop{background:#0007}.bok-review-dialog label{display:block;margin:14px 0}.bok-review-dialog textarea{display:block;box-sizing:border-box;width:100%;min-height:90px;border:1px solid #667;padding:8px}.bok-review-dialog button{padding:8px;margin:5px;border:1px solid #345}@media print{.bok-review-id,.bok-review-dialog{display:none!important}}';
document.head.append(style);
document.addEventListener('click', event => {
  const trigger = event.target.closest?.('[data-bok-review]');
  if (!trigger || document.querySelector('.bok-review-dialog')) return;
  const dialog = document.createElement('dialog');
  dialog.className = 'bok-review-dialog';
  const heading = document.createElement('h2');
  heading.textContent = trigger.dataset.bokReview + ' 피드백';
  dialog.append(heading);
  const form = document.createElement('form');
  const fields = [['feedback', '수정할 내용'], ['tests', '확인할 테스트 조건 (한 줄에 하나씩)']];
  const controls = {};
  for (const [key, title] of fields) {
    const label = document.createElement('label');
    label.textContent = title;
    const input = document.createElement('textarea');
    input.required = true;
    input.maxLength = 10000;
    controls[key] = input;
    label.append(input); form.append(label);
  }
  const save = document.createElement('button');
  save.type = 'submit'; save.textContent = '피드백 파일 저장';
  const cancel = document.createElement('button');
  cancel.type = 'button'; cancel.textContent = '닫기'; cancel.onclick = () => dialog.close();
  form.append(save, cancel); dialog.append(form); document.body.append(dialog);
  dialog.addEventListener('close', () => { dialog.remove(); trigger.focus(); });
  form.onsubmit = event => {
    event.preventDefault();
    const feedback = controls.feedback.value.trim();
    const tests = controls.tests.value.split('\n').map(s => s.trim()).filter(Boolean);
    if (!feedback || !tests.length) return;
    const payload = { id: trigger.dataset.bokReview, sourceHash: trigger.dataset.bokHash, feedback, tests,
      context: { page: location.pathname + location.search + location.hash, viewport: { width: innerWidth, height: innerHeight } } };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = payload.id + '-feedback.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); dialog.close();
  };
  dialog.showModal();
});
