/**
 * GitCMSstudio — Ultra-lightweight Headless Git CMS (100% Vanilla JS)
 * MIT License (c) 2026 Geoff1805
 */

(() => {
  'use strict';

  // State Management
  const state = {
    repo: '',
    branch: 'main',
    token: '',
    configPath: 'cms.config.json',
    config: null,
    activeCollection: null,
    activeItem: null, // for folder collections
    loadedData: new Map(), // path -> { content: object|string, sha: string }
    modifiedFiles: new Map(), // path -> newContent
    deletedFiles: new Set() // path
  };

  // DOM Elements
  const el = {
    appTitle: document.getElementById('studio-app-title'),
    repoBadge: document.getElementById('studio-repo-badge'),
    unsavedBadge: document.getElementById('unsaved-badge'),
    btnReconnect: document.getElementById('btn-reconnect'),
    btnPublish: document.getElementById('btn-publish'),
    sidebarNav: document.getElementById('nav-collections-list'),
    mainContent: document.getElementById('main-content'),
    emptyState: document.getElementById('empty-state'),
    editorView: document.getElementById('editor-view'),
    viewTitle: document.getElementById('view-title'),
    viewSubtitle: document.getElementById('view-subtitle'),
    viewActions: document.getElementById('view-actions'),
    formContainer: document.getElementById('form-container'),
    connectModal: document.getElementById('connect-modal'),
    connectForm: document.getElementById('connect-form'),
    inputRepo: document.getElementById('input-repo'),
    inputBranch: document.getElementById('input-branch'),
    inputConfig: document.getElementById('input-config'),
    inputToken: document.getElementById('input-token'),
    btnOpenConnect: document.getElementById('btn-open-connect'),
    btnCloseConnect: document.getElementById('btn-close-connect'),
    btnCancelConnect: document.getElementById('btn-cancel-connect'),
    publishModal: document.getElementById('publish-modal'),
    btnClosePublish: document.getElementById('btn-close-publish'),
    btnCancelPublish: document.getElementById('btn-cancel-publish'),
    btnConfirmPublish: document.getElementById('btn-confirm-publish'),
    publishFilesList: document.getElementById('publish-files-list'),
    inputCommitMsg: document.getElementById('input-commit-msg'),
    publishProgress: document.getElementById('publish-progress'),
    toastContainer: document.getElementById('toast-container')
  };

  // Toast Notification
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    el.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // Robust UTF-8 / Base64 Helpers using TextEncoder & TextDecoder
  function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function base64ToUtf8(base64) {
    const cleanBase64 = base64.replace(/\s/g, '');
    const binary = atob(cleanBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  }

  // GitHub API Client
  async function ghRequest(endpoint, options = {}) {
    const url = endpoint.startsWith('https://') ? endpoint : `https://api.github.com${endpoint}`;
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${state.token}`,
      ...(options.headers || {})
    };

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `GitHub API error: ${res.status} ${res.statusText}`);
    }
    return res.json();
  }

  async function fetchFile(path) {
    const data = await ghRequest(`/repos/${state.repo}/contents/${path}?ref=${state.branch}`);
    const content = base64ToUtf8(data.content);
    return {
      content: path.endsWith('.json') ? JSON.parse(content) : content,
      sha: data.sha
    };
  }

  async function fetchFolder(path) {
    return ghRequest(`/repos/${state.repo}/contents/${path}?ref=${state.branch}`);
  }

  async function putFile(path, content, message, sha) {
    let base64Content;
    // Check if content is already a raw base64 string (e.g. image upload)
    if (typeof content === 'string' && /\.(jpe?g|png|gif|webp|ico|svg|pdf)$/i.test(path) && /^[A-Za-z0-9+/=\s]+$/.test(content)) {
      base64Content = content.replace(/\s/g, '');
    } else {
      base64Content = utf8ToBase64(typeof content === 'string' ? content : JSON.stringify(content, null, 2));
    }

    const body = {
      message,
      content: base64Content,
      branch: state.branch
    };
    if (sha) body.sha = sha;

    return ghRequest(`/repos/${state.repo}/contents/${path}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  }

  async function deleteFile(path, message, sha) {
    const body = {
      message,
      sha,
      branch: state.branch
    };

    return ghRequest(`/repos/${state.repo}/contents/${path}`, {
      method: 'DELETE',
      body: JSON.stringify(body)
    });
  }

  // Initialization & Connect
  function init() {
    // Read from URL query params
    const params = new URLSearchParams(window.location.search);
    const qRepo = params.get('repo');
    const qBranch = params.get('branch');
    const qConfig = params.get('config');

    // Read stored credentials from localStorage
    state.repo = qRepo || localStorage.getItem('gitcms_repo') || '';
    state.branch = qBranch || localStorage.getItem('gitcms_branch') || 'main';
    state.configPath = qConfig || localStorage.getItem('gitcms_config') || 'cms.config.json';
    state.token = localStorage.getItem('gitcms_token') || '';

    el.inputRepo.value = state.repo;
    el.inputBranch.value = state.branch;
    el.inputConfig.value = state.configPath;
    el.inputToken.value = state.token;

    attachEventListeners();

    if (state.repo && state.token) {
      loadRepositoryConfig();
    } else {
      openConnectModal();
    }
  }

  function attachEventListeners() {
    el.btnOpenConnect.addEventListener('click', openConnectModal);
    el.btnReconnect.addEventListener('click', openConnectModal);
    el.btnCloseConnect.addEventListener('click', closeConnectModal);
    el.btnCancelConnect.addEventListener('click', closeConnectModal);

    el.connectForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      state.repo = el.inputRepo.value.trim();
      state.branch = el.inputBranch.value.trim() || 'main';
      state.configPath = el.inputConfig.value.trim() || 'cms.config.json';
      state.token = el.inputToken.value.trim();

      localStorage.setItem('gitcms_repo', state.repo);
      localStorage.setItem('gitcms_branch', state.branch);
      localStorage.setItem('gitcms_config', state.configPath);
      localStorage.setItem('gitcms_token', state.token);

      closeConnectModal();
      await loadRepositoryConfig();
    });

    el.btnPublish.addEventListener('click', openPublishModal);
    el.btnClosePublish.addEventListener('click', closePublishModal);
    el.btnCancelPublish.addEventListener('click', closePublishModal);
    el.btnConfirmPublish.addEventListener('click', confirmPublish);
  }

  function openConnectModal() {
    el.connectModal.style.display = 'flex';
  }

  function closeConnectModal() {
    el.connectModal.style.display = 'none';
  }

  // Load Configuration & Collections
  async function loadRepositoryConfig() {
    try {
      el.repoBadge.textContent = `${state.repo} (${state.branch})`;
      showToast('Loading schema configuration...', 'success');

      const configData = await fetchFile(state.configPath);
      state.config = configData.content;

      if (state.config.title) {
        el.appTitle.textContent = state.config.title;
        document.title = `${state.config.title} — GitCMSstudio`;
      }

      renderSidebar();
      el.emptyState.style.display = 'none';
      el.editorView.style.display = 'block';

      // Open first collection by default
      if (state.config.collections && state.config.collections.length > 0) {
        selectCollection(state.config.collections[0]);
      }
    } catch (err) {
      console.error(err);
      showToast(`Error loading configuration: ${err.message}`, 'error');
      openConnectModal();
    }
  }

  function renderSidebar() {
    el.sidebarNav.innerHTML = '';
    if (!state.config || !state.config.collections) return;

    state.config.collections.forEach((col) => {
      const item = document.createElement('div');
      item.className = 'nav-item';
      item.dataset.colName = col.name;
      item.innerHTML = `
        <span>${col.label || col.name}</span>
        <span class="nav-item-badge">${col.type === 'folder' ? 'Folder' : 'File'}</span>
      `;
      item.addEventListener('click', () => selectCollection(col));
      el.sidebarNav.appendChild(item);
    });
  }

  async function selectCollection(col) {
    state.activeCollection = col;
    state.activeItem = null;

    // Highlight active nav item
    document.querySelectorAll('.nav-item').forEach((n) => {
      n.classList.toggle('active', n.dataset.colName === col.name);
    });

    el.viewTitle.textContent = col.label || col.name;
    el.viewSubtitle.textContent = col.type === 'folder' ? `Directory: ${col.folder}` : `File: ${col.file}`;
    el.viewActions.innerHTML = '';

    if (col.type === 'folder') {
      await renderFolderCollection(col);
    } else {
      await renderFileCollection(col);
    }
  }

  // Single File Collection Renderer
  async function renderFileCollection(col) {
    el.formContainer.innerHTML = '<div style="color: var(--text-muted);">Loading content...</div>';
    try {
      let dataObj;
      if (state.modifiedFiles.has(col.file)) {
        dataObj = state.modifiedFiles.get(col.file);
      } else if (state.loadedData.has(col.file)) {
        dataObj = state.loadedData.get(col.file).content;
      } else {
        const fetched = await fetchFile(col.file);
        state.loadedData.set(col.file, fetched);
        dataObj = fetched.content;
      }

      el.formContainer.innerHTML = '';
      const card = document.createElement('div');
      card.className = 'form-card';

      col.fields.forEach((field) => {
        const fieldEl = renderField(field, dataObj[field.name], (newVal) => {
          dataObj[field.name] = newVal;
          markModified(col.file, dataObj);
        });
        card.appendChild(fieldEl);
      });

      el.formContainer.appendChild(card);
    } catch (err) {
      el.formContainer.innerHTML = `<div style="color: var(--danger);">Error: ${err.message}</div>`;
    }
  }

  // Folder Collection Renderer (e.g. pages)
  async function renderFolderCollection(col) {
    el.formContainer.innerHTML = '<div style="color: var(--text-muted);">Loading items...</div>';
    try {
      const items = await fetchFolder(col.folder);
      const jsonItems = items.filter((f) => f.name.endsWith('.json'));

      el.viewActions.innerHTML = `
        <button class="btn btn-primary" id="btn-add-item">
          + Add New Entry
        </button>
      `;
      document.getElementById('btn-add-item').addEventListener('click', () => {
        openFolderItemEditor(col, null);
      });

      const card = document.createElement('div');
      card.className = 'form-card';

      if (jsonItems.length === 0) {
        card.innerHTML = '<div style="color: var(--text-muted); padding: 20px 0;">No entries found in this directory.</div>';
      } else {
        const table = document.createElement('table');
        table.className = 'items-table';
        table.innerHTML = `
          <thead>
            <tr>
              <th>Name</th>
              <th>Path</th>
              <th style="text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody></tbody>
        `;

        const tbody = table.querySelector('tbody');
        jsonItems.forEach((f) => {
          const tr = document.createElement('tr');
          const isModified = state.modifiedFiles.has(f.path);
          tr.innerHTML = `
            <td><strong>${f.name.replace('.json', '')}</strong> ${isModified ? '<span class="badge-modified">Modified</span>' : ''}</td>
            <td style="color: var(--text-muted); font-size: 13px;">${f.path}</td>
            <td style="text-align: right;">
              <button class="btn btn-secondary btn-edit" style="padding: 4px 10px; font-size: 12px;">Edit</button>
              <button class="btn btn-danger btn-delete" style="padding: 4px 10px; font-size: 12px; margin-left: 6px;">Delete</button>
            </td>
          `;

          tr.querySelector('.btn-edit').addEventListener('click', async () => {
            await openFolderItemEditor(col, f);
          });

          tr.querySelector('.btn-delete').addEventListener('click', () => {
            if (confirm(`Are you sure you want to delete ${f.name}?`)) {
              state.deletedFiles.add(f.path);
              state.modifiedFiles.delete(f.path);
              updateUnsavedState();
              tr.remove();
              showToast(`Marked ${f.name} for deletion. Click Publish to apply.`, 'warning');
            }
          });

          tbody.appendChild(tr);
        });

        card.appendChild(table);
      }

      el.formContainer.innerHTML = '';
      el.formContainer.appendChild(card);
    } catch (err) {
      el.formContainer.innerHTML = `<div style="color: var(--danger);">Error loading folder: ${err.message}</div>`;
    }
  }

  // Item Editor inside a Folder Collection
  async function openFolderItemEditor(col, fileRef) {
    const isNew = !fileRef;
    const filePath = isNew ? '' : fileRef.path;

    el.viewTitle.textContent = isNew ? `New ${col.label || col.name}` : `Edit: ${fileRef.name}`;
    el.viewSubtitle.textContent = isNew ? 'Create a new entry' : `Path: ${filePath}`;
    el.viewActions.innerHTML = `
      <button class="btn btn-secondary" id="btn-back-folder">← Back to List</button>
    `;
    document.getElementById('btn-back-folder').addEventListener('click', () => {
      renderFolderCollection(col);
    });

    el.formContainer.innerHTML = '<div style="color: var(--text-muted);">Loading entry content...</div>';

    let dataObj = {};
    if (!isNew) {
      if (state.modifiedFiles.has(filePath)) {
        dataObj = state.modifiedFiles.get(filePath);
      } else if (state.loadedData.has(filePath)) {
        dataObj = state.loadedData.get(filePath).content;
      } else {
        const fetched = await fetchFile(filePath);
        state.loadedData.set(filePath, fetched);
        dataObj = fetched.content;
      }
    }

    el.formContainer.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'form-card';

    col.fields.forEach((field) => {
      const fieldEl = renderField(field, dataObj[field.name], (newVal) => {
        dataObj[field.name] = newVal;
        const currentPath = isNew
          ? `${col.folder}/${(dataObj.slug || 'new-entry').toLowerCase().replace(/[^a-z0-9_-]/g, '-')}.json`
          : filePath;
        markModified(currentPath, dataObj);
      });
      card.appendChild(fieldEl);
    });

    el.formContainer.appendChild(card);
  }

  // Dynamic Field Rendering
  function renderField(field, value, onChange) {
    const container = document.createElement('div');
    container.className = 'form-group';

    const label = document.createElement('label');
    label.className = 'form-label';
    label.textContent = field.label || field.name;
    if (field.required) label.textContent += ' *';
    container.appendChild(label);

    let inputEl;

    switch (field.type) {
      case 'text':
      case 'markdown':
        inputEl = document.createElement('textarea');
        inputEl.className = 'form-textarea';
        inputEl.value = value || '';
        inputEl.addEventListener('input', (e) => onChange(e.target.value));
        container.appendChild(inputEl);
        break;

      case 'boolean':
        const switchWrap = document.createElement('label');
        switchWrap.className = 'form-switch';
        inputEl = document.createElement('input');
        inputEl.type = 'checkbox';
        inputEl.checked = Boolean(value);
        inputEl.addEventListener('change', (e) => onChange(e.target.checked));
        switchWrap.appendChild(inputEl);
        const switchText = document.createElement('span');
        switchText.textContent = 'Enabled';
        switchWrap.appendChild(switchText);
        container.appendChild(switchWrap);
        break;

      case 'select':
        inputEl = document.createElement('select');
        inputEl.className = 'form-select';
        (field.options || []).forEach((opt) => {
          const optEl = document.createElement('option');
          optEl.value = typeof opt === 'object' ? opt.value : opt;
          optEl.textContent = typeof opt === 'object' ? opt.label : opt;
          if (optEl.value === value) optEl.selected = true;
          inputEl.appendChild(optEl);
        });
        inputEl.addEventListener('change', (e) => onChange(e.target.value));
        container.appendChild(inputEl);
        break;

      case 'color':
        const colorWrap = document.createElement('div');
        colorWrap.style.display = 'flex';
        colorWrap.style.gap = '10px';
        colorWrap.style.alignItems = 'center';

        inputEl = document.createElement('input');
        inputEl.type = 'color';
        inputEl.value = value || '#10b981';
        inputEl.style.width = '44px';
        inputEl.style.height = '40px';
        inputEl.style.padding = '0';
        inputEl.style.border = 'none';
        inputEl.style.background = 'transparent';
        inputEl.style.cursor = 'pointer';

        const textVal = document.createElement('input');
        textVal.type = 'text';
        textVal.className = 'form-input';
        textVal.value = value || '#10b981';

        inputEl.addEventListener('input', (e) => {
          textVal.value = e.target.value;
          onChange(e.target.value);
        });
        textVal.addEventListener('input', (e) => {
          inputEl.value = e.target.value;
          onChange(e.target.value);
        });

        colorWrap.appendChild(inputEl);
        colorWrap.appendChild(textVal);
        container.appendChild(colorWrap);
        break;

      case 'image':
        const imgWrap = document.createElement('div');
        inputEl = document.createElement('input');
        inputEl.type = 'text';
        inputEl.className = 'form-input';
        inputEl.value = value || '';
        inputEl.placeholder = '/images/example.jpg';
        inputEl.addEventListener('input', (e) => onChange(e.target.value));

        const uploadBtn = document.createElement('input');
        uploadBtn.type = 'file';
        uploadBtn.accept = 'image/*';
        uploadBtn.style.marginTop = '8px';
        uploadBtn.addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (!file) return;

          const reader = new FileReader();
          reader.onload = async () => {
            const mediaFolder = state.config.media_folder || 'public/images';
            const cleanName = file.name.toLowerCase().replace(/[^a-z0-9._-]/g, '-');
            const targetPath = `${mediaFolder}/${cleanName}`;
            const publicPath = `${state.config.public_folder || '/images'}/${cleanName}`;

            const base64Data = reader.result.split(',')[1];
            // Stage image commit
            state.modifiedFiles.set(targetPath, base64Data);
            inputEl.value = publicPath;
            onChange(publicPath);
            updateUnsavedState();
            showToast(`Image staged: ${cleanName}`, 'success');
          };
          reader.readAsDataURL(file);
        });

        imgWrap.appendChild(inputEl);
        imgWrap.appendChild(uploadBtn);
        container.appendChild(imgWrap);
        break;

      case 'object':
        const objWrap = document.createElement('div');
        objWrap.style.paddingLeft = '16px';
        objWrap.style.borderLeft = '2px solid var(--border-color)';
        const curObj = value || {};

        (field.fields || []).forEach((subField) => {
          const subEl = renderField(subField, curObj[subField.name], (newSubVal) => {
            curObj[subField.name] = newSubVal;
            onChange(curObj);
          });
          objWrap.appendChild(subEl);
        });
        container.appendChild(objWrap);
        break;

      default: // string
        inputEl = document.createElement('input');
        inputEl.type = 'text';
        inputEl.className = 'form-input';
        inputEl.value = value || '';
        inputEl.addEventListener('input', (e) => onChange(e.target.value));
        container.appendChild(inputEl);
    }

    if (field.hint) {
      const hint = document.createElement('div');
      hint.className = 'form-hint';
      hint.textContent = field.hint;
      container.appendChild(hint);
    }

    return container;
  }

  // Modified / Unsaved Changes Tracking
  function markModified(path, data) {
    state.modifiedFiles.set(path, data);
    updateUnsavedState();
  }

  function updateUnsavedState() {
    const count = state.modifiedFiles.size + state.deletedFiles.size;
    if (count > 0) {
      el.unsavedBadge.style.display = 'inline-block';
      el.unsavedBadge.textContent = `${count} unsaved change${count > 1 ? 's' : ''}`;
      el.btnPublish.disabled = false;
    } else {
      el.unsavedBadge.style.display = 'none';
      el.btnPublish.disabled = true;
    }
  }

  // Publish / Commit to GitHub Modal
  function openPublishModal() {
    el.publishFilesList.innerHTML = '';
    const totalChanges = state.modifiedFiles.size + state.deletedFiles.size;
    if (totalChanges === 0) return;

    state.modifiedFiles.forEach((_, path) => {
      const div = document.createElement('div');
      div.innerHTML = `<span style="color: var(--success); font-weight: bold;">[UPDATE]</span> ${path}`;
      el.publishFilesList.appendChild(div);
    });

    state.deletedFiles.forEach((path) => {
      const div = document.createElement('div');
      div.innerHTML = `<span style="color: var(--danger); font-weight: bold;">[DELETE]</span> ${path}`;
      el.publishFilesList.appendChild(div);
    });

    el.publishModal.style.display = 'flex';
  }

  function closePublishModal() {
    el.publishModal.style.display = 'none';
    el.publishProgress.style.display = 'none';
    el.btnConfirmPublish.disabled = false;
  }

  async function confirmPublish() {
    const commitMsg = el.inputCommitMsg.value.trim() || 'Update content via GitCMSstudio';
    el.btnConfirmPublish.disabled = true;
    el.publishProgress.style.display = 'block';

    try {
      // 1. Process Updates
      for (const [path, content] of state.modifiedFiles.entries()) {
        el.publishProgress.textContent = `Pushing ${path}...`;
        let sha = null;
        if (state.loadedData.has(path)) {
          sha = state.loadedData.get(path).sha;
        } else {
          try {
            const existing = await fetchFile(path);
            sha = existing.sha;
          } catch (_) {}
        }

        const res = await putFile(path, content, commitMsg, sha);
        state.loadedData.set(path, { content, sha: res.content?.sha });
      }

      // 2. Process Deletions
      for (const path of state.deletedFiles) {
        el.publishProgress.textContent = `Deleting ${path}...`;
        let sha = null;
        if (state.loadedData.has(path)) {
          sha = state.loadedData.get(path).sha;
        } else {
          try {
            const existing = await fetchFile(path);
            sha = existing.sha;
          } catch (_) {}
        }
        if (sha) {
          await deleteFile(path, commitMsg, sha);
        }
      }

      state.modifiedFiles.clear();
      state.deletedFiles.clear();
      updateUnsavedState();

      closePublishModal();
      showToast('Changes published successfully to GitHub!', 'success');

      // Refresh current view
      if (state.activeCollection) {
        selectCollection(state.activeCollection);
      }
    } catch (err) {
      console.error(err);
      el.publishProgress.textContent = `Error: ${err.message}`;
      showToast(`Commit failed: ${err.message}`, 'error');
      el.btnConfirmPublish.disabled = false;
    }
  }

  // Run on page load
  window.addEventListener('DOMContentLoaded', init);
})();
