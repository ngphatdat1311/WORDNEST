function render() {
  chrome.storage.local.get('pendingWords', ({ pendingWords = [] }) => {
    const listEl = document.getElementById('list');
    if (!pendingWords.length) {
      listEl.innerHTML = '<div class="empty">Hàng đợi đang trống ✨</div>';
      return;
    }
    const ul = document.createElement('ul');
    pendingWords.forEach((item, i) => {
      const li = document.createElement('li');
      const span = document.createElement('span');
      span.textContent = item.word;
      const btn = document.createElement('button');
      btn.className = 'rm';
      btn.textContent = '✕';
      btn.title = 'Xóa khỏi hàng đợi';
      btn.addEventListener('click', () => removeAt(i));
      li.appendChild(span);
      li.appendChild(btn);
      ul.appendChild(li);
    });
    listEl.innerHTML = '';
    listEl.appendChild(ul);
  });
}

function removeAt(index) {
  chrome.storage.local.get('pendingWords', ({ pendingWords = [] }) => {
    pendingWords.splice(index, 1);
    chrome.storage.local.set({ pendingWords }, render);
  });
}

render();
