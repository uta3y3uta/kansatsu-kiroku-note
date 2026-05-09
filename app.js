(() => {
  'use strict';

  const STORAGE_KEY = 'kansatsu-records-v1';
  const CHILDREN_KEY = 'kansatsu-children-v1';

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // ---------- データ層 ----------
  const loadRecords = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };
  const saveRecords = (records) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  };

  let records = loadRecords();

  const loadChildren = () => {
    try {
      const raw = localStorage.getItem(CHILDREN_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  };
  const saveChildren = (cs) => localStorage.setItem(CHILDREN_KEY, JSON.stringify(cs));
  let children = loadChildren();

  // ---------- ユーティリティ ----------
  const pad = (n) => String(n).padStart(2, '0');
  const formatTimestamp = (iso) => {
    const d = new Date(iso);
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // カタカナをひらがなへ（漢字はそのまま）
  const katakanaToHiragana = (s) =>
    String(s || '').replace(/[\u30A1-\u30F6]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0x60)
    );

  const splitNames = (raw) => {
    if (!raw) return [];
    return raw
      .split(/[，、,\s]+/)
      .map((s) => katakanaToHiragana(s.trim()))
      .filter(Boolean);
  };

  const splitAliases = (raw) => {
    if (!raw) return [];
    return raw
      .split(/[，、,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  };

  const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

  // ---------- タブ切替 ----------
  const initTabs = () => {
    $$('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        $$('.tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
        $$('.tab-panel').forEach((p) => {
          p.classList.toggle('active', p.id === `tab-${tab}`);
        });
        if (tab === 'list') renderList();
        if (tab === 'children') renderChildren();
      });
    });
  };

  // ---------- 音声入力 ----------
  let recognition = null;
  let isRecording = false;
  let interimText = '';
  let baseText = '';

  const initSpeech = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const micBtn = $('#micBtn');
    const micStatus = $('#micStatus');

    if (!SR) {
      micStatus.textContent = 'このブラウザは音声入力に対応していません。テキスト欄に直接入力してください。';
      micBtn.disabled = true;
      micBtn.style.opacity = '0.6';
      micBtn.style.cursor = 'not-allowed';
      return;
    }

    recognition = new SR();
    recognition.lang = 'ja-JP';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      isRecording = true;
      micBtn.classList.add('recording');
      micBtn.querySelector('.mic-label').textContent = '停止';
      micStatus.textContent = '録音中… もう一度押すと停止します。';
    };

    recognition.onresult = (event) => {
      let interim = '';
      let finalAdd = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalAdd += transcript;
        else interim += transcript;
      }
      if (finalAdd) {
        baseText = (baseText + (baseText ? ' ' : '') + finalAdd).trim();
      }
      interimText = interim;
      const memo = $('#memoText');
      memo.value = (baseText + (interim ? ' ' + interim : '')).trim();
    };

    recognition.onerror = (event) => {
      micStatus.textContent = `音声入力エラー：${event.error}`;
      stopRecording();
    };

    recognition.onend = () => {
      if (isRecording) {
        // 連続モード時に自然終了したら再開
        try { recognition.start(); } catch (_) {}
      }
    };

    micBtn.addEventListener('click', () => {
      if (isRecording) stopRecording();
      else startRecording();
    });
  };

  const startRecording = () => {
    if (!recognition) return;
    baseText = $('#memoText').value.trim();
    interimText = '';
    try {
      recognition.start();
    } catch (e) {
      // すでに開始済みのケース
    }
  };

  const stopRecording = () => {
    isRecording = false;
    if (recognition) {
      try { recognition.stop(); } catch (_) {}
    }
    const micBtn = $('#micBtn');
    micBtn.classList.remove('recording');
    micBtn.querySelector('.mic-label').textContent = '押して話す';
    $('#micStatus').textContent = '録音を停止しました。内容を確認して保存できます。';
    if (interimText) {
      baseText = (baseText + (baseText ? ' ' : '') + interimText).trim();
      $('#memoText').value = baseText;
      interimText = '';
    }
  };

  // ---------- 保存・クリア ----------
  const initSaveActions = () => {
    $('#saveBtn').addEventListener('click', () => {
      const text = $('#memoText').value.trim();
      const namesRaw = $('#childNameInput').value.trim();
      if (!text) {
        showSaveStatus('記録内容が空です。', true);
        return;
      }
      const record = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        text,
        names: splitNames(namesRaw),
      };
      records.unshift(record);
      saveRecords(records);
      showSaveStatus('保存しました。');
      $('#memoText').value = '';
      baseText = '';
      interimText = '';
      // 名前は次の記録でも使う可能性があるので残す
    });

    $('#clearBtn').addEventListener('click', () => {
      $('#memoText').value = '';
      $('#childNameInput').value = '';
      baseText = '';
      interimText = '';
      showSaveStatus('');
    });
  };

  const showSaveStatus = (msg, isError = false) => {
    const el = $('#saveStatus');
    el.textContent = msg;
    el.style.color = isError ? 'var(--danger)' : 'var(--success)';
    if (msg) {
      setTimeout(() => {
        if (el.textContent === msg) el.textContent = '';
      }, 2500);
    }
  };

  // ---------- 一覧表示 ----------
  const renderList = () => {
    const listEl = $('#recordsList');
    const emptyEl = $('#listEmpty');
    const keyword = ($('#searchInput').value || '').trim().toLowerCase();

    const filtered = keyword
      ? records.filter((r) => {
          const inText = r.text.toLowerCase().includes(keyword);
          const inName = r.names.some((n) => n.toLowerCase().includes(keyword));
          return inText || inName;
        })
      : records;

    listEl.innerHTML = '';
    if (filtered.length === 0) {
      emptyEl.style.display = 'block';
      emptyEl.textContent = keyword
        ? '一致する記録は見つかりませんでした。'
        : 'まだ記録がありません。「録音」タブから始めましょう。';
      return;
    }
    emptyEl.style.display = 'none';

    filtered.forEach((r) => {
      const card = document.createElement('div');
      card.className = 'record-card';
      const nameTags = r.names
        .map((n) => `<span class="name-tag">${escapeHtml(n)}</span>`)
        .join('');
      card.innerHTML = `
        <div class="record-meta">
          <span class="timestamp">${formatTimestamp(r.timestamp)}</span>
          ${nameTags}
        </div>
        <div class="record-text">${escapeHtml(r.text)}</div>
        <div class="record-actions">
          <button class="icon-btn" data-action="edit" data-id="${r.id}">編集</button>
          <button class="icon-btn danger" data-action="delete" data-id="${r.id}">削除</button>
        </div>
      `;
      listEl.appendChild(card);
    });

    listEl.querySelectorAll('button[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => handleRecordAction(btn));
    });
  };

  // 共通：記録の編集／削除
  const editRecord = (id) => {
    const rec = records.find((r) => r.id === id);
    if (!rec) return;
    const newText = prompt('記録内容を編集', rec.text);
    if (newText === null) return;
    const newNames = prompt('子供の名前（区切りOK）', rec.names.join('，'));
    if (newNames === null) return;
    rec.text = newText.trim() || rec.text;
    rec.names = splitNames(newNames);
    saveRecords(records);
    renderList();
    renderChildren();
  };

  const deleteRecord = (id) => {
    if (!confirm('この記録を削除しますか？')) return;
    records = records.filter((r) => r.id !== id);
    saveRecords(records);
    renderList();
    renderChildren();
  };

  const handleRecordAction = (btn) => {
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    if (action === 'delete') deleteRecord(id);
    else if (action === 'edit') editRecord(id);
  };

  // ---------- 子供別 ----------
  // 各記録について，登録された子供（名前＋別表記）または記録自身のnames配列に
  // 一致する子供グループを返す。本文に名前が含まれていれば自動でふりわけ。
  const childMatchesRecord = (child, record) => {
    const candidates = [child.name, ...(child.aliases || [])].filter(Boolean);
    if (record.names.some((n) => candidates.includes(n))) return true;
    if (candidates.some((c) => record.text.includes(c))) return true;
    return false;
  };

  const renderChildren = () => {
    const listEl = $('#childrenList');
    const emptyEl = $('#childrenEmpty');
    listEl.innerHTML = '';

    // グループ集合：登録済み子供＋記録のnamesに含まれる名前
    const groupMap = new Map();
    children.forEach((c) => {
      groupMap.set(c.name, {
        key: c.name,
        displayName: c.name,
        aliases: c.aliases || [],
        records: [],
        childId: c.id,
      });
    });
    records.forEach((r) => {
      r.names.forEach((n) => {
        if (!groupMap.has(n)) {
          groupMap.set(n, {
            key: n,
            displayName: n,
            aliases: [],
            records: [],
            childId: null,
          });
        }
      });
    });

    // ふりわけ
    const matchedRecordIds = new Set();
    groupMap.forEach((group) => {
      records.forEach((r) => {
        const child = { name: group.displayName, aliases: group.aliases };
        if (childMatchesRecord(child, r)) {
          group.records.push(r);
          matchedRecordIds.add(r.id);
        }
      });
    });

    const sortedGroups = [...groupMap.values()].sort((a, b) =>
      a.displayName.localeCompare(b.displayName, 'ja')
    );

    const visibleGroups = sortedGroups.filter(
      (g) => g.records.length > 0 || g.childId
    );

    const unclassified = records.filter((r) => !matchedRecordIds.has(r.id));

    if (visibleGroups.length === 0 && unclassified.length === 0) {
      emptyEl.style.display = 'block';
      return;
    }
    emptyEl.style.display = 'none';

    const renderEntry = (r) => `
      <div class="child-entry">
        <span class="timestamp">${formatTimestamp(r.timestamp)}</span>
        <div class="record-text">${escapeHtml(r.text)}</div>
        <div class="record-actions">
          <button class="icon-btn" data-action="edit" data-id="${r.id}">編集</button>
          <button class="icon-btn danger" data-action="delete" data-id="${r.id}">削除</button>
        </div>
      </div>`;

    visibleGroups.forEach((group) => {
      const sortedRecords = group.records
        .slice()
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      const aliasText =
        group.aliases.length > 0
          ? `<span class="alias">（${escapeHtml(group.aliases.join('・'))}）</span>`
          : '';
      const headerActions = group.childId
        ? `
          <button class="icon-btn" data-child-action="edit-child" data-cid="${group.childId}">編集</button>
          <button class="icon-btn danger" data-child-action="delete-child" data-cid="${group.childId}">登録解除</button>`
        : `<button class="icon-btn" data-child-action="register" data-name="${escapeHtml(group.displayName)}">登録</button>`;

      const groupEl = document.createElement('div');
      groupEl.className = 'child-group';
      groupEl.innerHTML = `
        <h3>
          <span class="child-title">${escapeHtml(group.displayName)}${aliasText} <span class="count">${sortedRecords.length}件</span></span>
          <span class="group-actions">${headerActions}</span>
        </h3>
        ${sortedRecords.map(renderEntry).join('') ||
          '<p class="empty-msg" style="padding:12px 0;">該当する記録はまだありません。</p>'}
      `;
      listEl.appendChild(groupEl);
    });

    if (unclassified.length > 0) {
      const sorted = unclassified
        .slice()
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      const groupEl = document.createElement('div');
      groupEl.className = 'child-group unclassified';
      groupEl.innerHTML = `
        <h3>
          <span class="child-title">未分類 <span class="count">${sorted.length}件</span></span>
        </h3>
        ${sorted.map(renderEntry).join('')}
      `;
      listEl.appendChild(groupEl);
    }

    // 記録の編集・削除
    listEl.querySelectorAll('button[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => handleRecordAction(btn));
    });
    // 子供（登録）の編集・削除・登録
    listEl.querySelectorAll('button[data-child-action]').forEach((btn) => {
      btn.addEventListener('click', () => handleChildAction(btn));
    });
  };

  // 子供登録の操作
  const handleChildAction = (btn) => {
    const action = btn.dataset.childAction;
    if (action === 'register') {
      const name = btn.dataset.name;
      const aliases = prompt(
        `「${name}」を登録します。別の表記があればカンマ区切りで（任意）：`,
        ''
      );
      if (aliases === null) return;
      children.push({
        id: newId(),
        name: katakanaToHiragana(name),
        aliases: splitAliases(aliases),
      });
      saveChildren(children);
      renderChildren();
    } else if (action === 'edit-child') {
      const cid = btn.dataset.cid;
      const child = children.find((c) => c.id === cid);
      if (!child) return;
      const newName = prompt('名前（ひらがな）', child.name);
      if (newName === null) return;
      const newAliases = prompt('別の表記（カンマ区切り・任意）', (child.aliases || []).join('，'));
      if (newAliases === null) return;
      child.name = katakanaToHiragana(newName.trim()) || child.name;
      child.aliases = splitAliases(newAliases);
      saveChildren(children);
      renderChildren();
    } else if (action === 'delete-child') {
      const cid = btn.dataset.cid;
      const child = children.find((c) => c.id === cid);
      if (!child) return;
      if (
        confirm(
          `「${child.name}」の登録を解除しますか？（記録自体は削除されません）`
        )
      ) {
        children = children.filter((c) => c.id !== cid);
        saveChildren(children);
        renderChildren();
      }
    }
  };

  const initChildrenForm = () => {
    const form = document.getElementById('addChildForm');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = katakanaToHiragana(($('#newChildName').value || '').trim());
      const aliases = splitAliases($('#newChildAliases').value || '');
      if (!name) return;
      // 既登録チェック
      if (children.some((c) => c.name === name)) {
        alert(`「${name}」はすでに登録されています。`);
        return;
      }
      children.push({ id: newId(), name, aliases });
      saveChildren(children);
      $('#newChildName').value = '';
      $('#newChildAliases').value = '';
      renderChildren();
    });

    // 入力中もカタカナ→ひらがなに正規化
    const nameInput = $('#newChildName');
    nameInput.addEventListener('input', () => {
      const start = nameInput.selectionStart;
      const converted = katakanaToHiragana(nameInput.value);
      if (converted !== nameInput.value) {
        nameInput.value = converted;
        try { nameInput.setSelectionRange(start, start); } catch (_) {}
      }
    });
  };

  // ---------- 検索 ----------
  const initSearch = () => {
    $('#searchInput').addEventListener('input', () => renderList());
  };

  // ---------- 書き出し ----------
  const buildExportRows = () => {
    const rows = [['日時', '子供の名前', '記録内容']];
    records
      .slice()
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .forEach((r) => {
        rows.push([formatTimestamp(r.timestamp), r.names.join('，'), r.text]);
      });
    return rows;
  };

  const exportXlsx = () => {
    if (records.length === 0) {
      alert('書き出す記録がありません。');
      return;
    }
    if (typeof XLSX === 'undefined') {
      alert('Excelライブラリの読み込みに失敗しました。CSV書き出しをご利用ください。');
      return;
    }
    const rows = buildExportRows();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 18 }, { wch: 16 }, { wch: 60 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '観察記録');
    const today = new Date();
    const fname = `観察記録_${today.getFullYear()}${pad(today.getMonth() + 1)}${pad(today.getDate())}.xlsx`;
    XLSX.writeFile(wb, fname);
  };

  const exportCsv = () => {
    if (records.length === 0) {
      alert('書き出す記録がありません。');
      return;
    }
    const rows = buildExportRows();
    const csv = rows
      .map((row) =>
        row
          .map((cell) => {
            const s = String(cell ?? '');
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(',')
      )
      .join('\r\n');
    // Excel/Googleスプレッドシートで文字化けしないようBOM付き
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const today = new Date();
    const fname = `観察記録_${today.getFullYear()}${pad(today.getMonth() + 1)}${pad(today.getDate())}.csv`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportJson = () => {
    if (records.length === 0) {
      alert('書き出す記録がありません。');
      return;
    }
    const payload = {
      app: 'kansatsu-kiroku-note',
      version: 1,
      exportedAt: new Date().toISOString(),
      records,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    const today = new Date();
    const fname = `観察記録バックアップ_${today.getFullYear()}${pad(today.getMonth() + 1)}${pad(today.getDate())}.json`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importJson = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const incoming = Array.isArray(data) ? data : data.records;
        if (!Array.isArray(incoming)) throw new Error('不正な形式です');

        const valid = incoming.filter(
          (r) =>
            r &&
            typeof r.text === 'string' &&
            typeof r.timestamp === 'string' &&
            Array.isArray(r.names)
        );
        if (valid.length === 0) {
          alert('取り込める記録が見つかりませんでした。');
          return;
        }

        const existingIds = new Set(records.map((r) => r.id));
        const existingKeys = new Set(
          records.map((r) => `${r.timestamp}::${r.text}`)
        );
        let added = 0;
        valid.forEach((r) => {
          const id = r.id || `${Date.parse(r.timestamp) || Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const key = `${r.timestamp}::${r.text}`;
          if (existingIds.has(id) || existingKeys.has(key)) return;
          records.push({ id, timestamp: r.timestamp, text: r.text, names: r.names });
          existingIds.add(id);
          existingKeys.add(key);
          added++;
        });
        records.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        saveRecords(records);
        renderList();
        renderChildren();
        alert(`取り込み完了：${added}件を追加しました（重複はスキップ）。`);
      } catch (err) {
        alert(`取り込みに失敗しました：${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const initExport = () => {
    $('#exportXlsxBtn').addEventListener('click', exportXlsx);
    $('#exportCsvBtn').addEventListener('click', exportCsv);
    $('#exportJsonBtn').addEventListener('click', exportJson);
    $('#importJsonBtn').addEventListener('click', () => $('#importJsonInput').click());
    $('#importJsonInput').addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) importJson(file);
      e.target.value = '';
    });
    $('#clearAllBtn').addEventListener('click', () => {
      if (records.length === 0) {
        alert('削除する記録がありません。');
        return;
      }
      if (
        confirm(
          `すべての記録（${records.length}件）を削除します。よろしいですか？\nこの操作は取り消せません。`
        )
      ) {
        records = [];
        saveRecords(records);
        renderList();
        renderChildren();
      }
    });
  };

  const initNameInputNormalize = () => {
    const el = $('#childNameInput');
    if (!el) return;
    el.addEventListener('input', () => {
      const start = el.selectionStart;
      const converted = katakanaToHiragana(el.value);
      if (converted !== el.value) {
        el.value = converted;
        try { el.setSelectionRange(start, start); } catch (_) {}
      }
    });
  };

  // ---------- 起動 ----------
  document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initSpeech();
    initSaveActions();
    initSearch();
    initExport();
    initChildrenForm();
    initNameInputNormalize();
    renderList();
    renderChildren();
  });
})();
