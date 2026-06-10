(function () {
  'use strict';

  // DOM 元素
  const fileInput = document.getElementById('fileInput');
  const dropArea = document.getElementById('dropArea');
  const paramsPanel = document.getElementById('paramsPanel');
  const previewPanel = document.getElementById('previewPanel');
  const widthInput = document.getElementById('widthInput');
  const heightInput = document.getElementById('heightInput');
  const widthTip = document.getElementById('widthTip');
  const heightTip = document.getElementById('heightTip');
  const keepRatio = document.getElementById('keepRatio');
  const qualityRange = document.getElementById('qualityRange');
  const qualityInput = document.getElementById('qualityInput');
  const formatSelect = document.getElementById('formatSelect');
  const presetList = document.getElementById('presetList');
  const originalImg = document.getElementById('originalImg');
  const compressedImg = document.getElementById('compressedImg');
  const originalMeta = document.getElementById('originalMeta');
  const compressedMeta = document.getElementById('compressedMeta');
  const downloadBtn = document.getElementById('downloadBtn');
  const resetBtn = document.getElementById('resetBtn');
  const downloadHint = document.getElementById('downloadHint');
  const downloadHintText = downloadHint ? downloadHint.querySelector('.hint-text') : null;

  // 检测移动端（iOS Safari / Android Chrome 等对 a[download] 支持不完善）
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  // 状态
  const state = {
    file: null,
    originalDataUrl: '',
    originalWidth: 0,
    originalHeight: 0,
    originalSize: 0,
    compressedDataUrl: '',
    compressedSize: 0,
    aspectRatio: 1,
  };

  // ===== 工具函数 =====
  function formatBytes(bytes) {
    if (!bytes && bytes !== 0) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function getExtFromMime(mime) {
    switch (mime) {
      case 'image/jpeg': return 'jpg';
      case 'image/png': return 'png';
      case 'image/webp': return 'webp';
      default: return 'png';
    }
  }

  function getBaseName(name) {
    const idx = name.lastIndexOf('.');
    return idx > 0 ? name.slice(0, idx) : name;
  }

  // ===== 文件读取与预览 =====
  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = src;
    });
  }

  // ===== 压缩主流程 =====
  async function compress() {
    if (!state.originalDataUrl) return;

    const targetW = parseInt(widthInput.value, 10);
    const targetH = parseInt(heightInput.value, 10);
    const w = isNaN(targetW) || targetW <= 0 ? state.originalWidth : targetW;
    const h = isNaN(targetH) || targetH <= 0 ? state.originalHeight : targetH;
    const quality = Math.min(1, Math.max(0.01, parseInt(qualityInput.value, 10) / 100));
    const mime = formatSelect.value;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    // PNG 无损，不应用 quality 参数
    const exportQuality = mime === 'image/png' ? undefined : quality;

    const img = await loadImage(state.originalDataUrl);
    ctx.drawImage(img, 0, 0, w, h);

    const dataUrl = canvas.toDataURL(mime, exportQuality);
    state.compressedDataUrl = dataUrl;
    state.compressedMime = mime;
    compressedImg.src = dataUrl;

    // 估算压缩后大小
    const base64 = dataUrl.split(',')[1] || '';
    const size = Math.floor((base64.length * 3) / 4);
    state.compressedSize = size;

    const ratio = state.originalSize > 0
      ? ((1 - size / state.originalSize) * 100).toFixed(1)
      : '0.0';
    const ratioText = size <= state.originalSize
      ? `减少 ${ratio}%`
      : `增加 ${Math.abs(ratio)}%`;

    if (compressedMeta) {
      compressedMeta.innerHTML =
        `尺寸: <strong>${w} × ${h}</strong> · 大小: <strong>${formatBytes(size)}</strong> · ${ratioText}`;
    }

    // 移动端显示提示
    if (isMobile) {
      if (downloadHint) downloadHint.hidden = false;
      if (downloadHintText) downloadHintText.textContent = '点击下载压缩图片后，长按图片选择保存图片';
    } else {
      if (downloadHint) downloadHint.hidden = true;
    }
  }

  // ===== 文件选择回调 =====
  async function handleFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件');
      return;
    }

    state.file = file;
    state.originalSize = file.size;
    state.originalDataUrl = await readFileAsDataURL(file);

    const img = await loadImage(state.originalDataUrl);
    state.originalWidth = img.naturalWidth;
    state.originalHeight = img.naturalHeight;
    state.aspectRatio = state.originalWidth / state.originalHeight;

    // 显示原图
    originalImg.src = state.originalDataUrl;
    originalMeta.innerHTML =
      `尺寸: <strong>${state.originalWidth} × ${state.originalHeight}</strong> · 大小: <strong>${formatBytes(file.size)}</strong>`;

    // 默认参数
    widthInput.value = state.originalWidth;
    heightInput.value = state.originalHeight;
    widthTip.textContent = `原图: ${state.originalWidth}px`;
    heightTip.textContent = `原图: ${state.originalHeight}px`;

    // 清除预设高亮
    presetList.querySelectorAll('.preset-chip').forEach((c) => c.classList.remove('active'));

    // 根据原图类型建议输出格式
    if (file.type === 'image/png') formatSelect.value = 'image/png';
    else if (file.type === 'image/webp') formatSelect.value = 'image/webp';
    else formatSelect.value = 'image/jpeg';

    // 显示面板
    paramsPanel.hidden = false;
    previewPanel.hidden = false;

    // 触发一次压缩
    await compress();
  }

  // ===== 事件绑定 =====
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    handleFile(file);
  });

  // 拖拽上传
  ['dragenter', 'dragover'].forEach((evt) => {
    dropArea.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropArea.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach((evt) => {
    dropArea.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropArea.classList.remove('dragover');
    });
  });
  dropArea.addEventListener('drop', (e) => {
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  // 宽高联动
  function onWidthChange() {
    if (keepRatio.checked && state.originalWidth) {
      const w = parseInt(widthInput.value, 10);
      if (!isNaN(w) && w > 0) {
        heightInput.value = Math.round(w / state.aspectRatio);
      }
    }
    clearPresetActive();
    compress();
  }
  function onHeightChange() {
    if (keepRatio.checked && state.originalHeight) {
      const h = parseInt(heightInput.value, 10);
      if (!isNaN(h) && h > 0) {
        widthInput.value = Math.round(h * state.aspectRatio);
      }
    }
    clearPresetActive();
    compress();
  }

  function clearPresetActive() {
    presetList.querySelectorAll('.preset-chip').forEach((c) => c.classList.remove('active'));
  }
  widthInput.addEventListener('input', onWidthChange);
  heightInput.addEventListener('input', onHeightChange);
  keepRatio.addEventListener('change', compress);

  // 画质联动
  qualityRange.addEventListener('input', () => {
    qualityInput.value = qualityRange.value;
    compress();
  });
  qualityInput.addEventListener('input', () => {
    let v = parseInt(qualityInput.value, 10);
    if (isNaN(v)) v = 80;
    v = Math.min(100, Math.max(1, v));
    qualityInput.value = v;
    qualityRange.value = v;
    compress();
  });

  formatSelect.addEventListener('change', compress);

  // 尺寸快捷选项
  presetList.addEventListener('click', (e) => {
    const chip = e.target.closest('.preset-chip');
    if (!chip) return;

    // 高亮选中
    presetList.querySelectorAll('.preset-chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');

    const w = chip.getAttribute('data-w');
    const h = chip.getAttribute('data-h');

    if (w && h) {
      // 强制按预设尺寸覆盖，保持宽高比选项不生效
      keepRatio.checked = false;
      widthInput.value = w;
      heightInput.value = h;
    } else {
      // 自定义 - 恢复原图尺寸
      keepRatio.checked = true;
      widthInput.value = state.originalWidth;
      heightInput.value = state.originalHeight;
    }
    compress();
  });

  // 下载
  downloadBtn.addEventListener('click', () => {
    if (!state.compressedDataUrl) return;
    const mime = formatSelect.value;
    const ext = getExtFromMime(mime);
    const baseName = state.file ? getBaseName(state.file.name) : 'image';

    // 移动端（特别是 iOS Safari）不支持 a[download]，在新标签页中打开更可靠
    if (isMobile) {
      const win = window.open();
      if (win) {
        win.document.write(
          `<title>${baseName}_compressed.${ext}</title>` +
          `<meta name="viewport" content="width=device-width,initial-scale=1">` +
          `<style>html,body{margin:0;height:100%;background:#000;display:flex;align-items:center;justify-content:center}img{max-width:100%;max-height:100%;object-fit:contain}</style>` +
          `<img src="${state.compressedDataUrl}" />`
        );
        win.document.close();
      } else {
        // 浏览器拦截弹窗时退化为当前页跳转
        window.location.href = state.compressedDataUrl;
      }
      return;
    }

    // 桌面端：使用 a[download] 触发下载
    const a = document.createElement('a');
    a.href = state.compressedDataUrl;
    a.download = `${baseName}_compressed.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  // 重新选择
  resetBtn.addEventListener('click', () => {
    state.file = null;
    state.originalDataUrl = '';
    state.compressedDataUrl = '';
    fileInput.value = '';
    paramsPanel.hidden = true;
    previewPanel.hidden = true;
    originalImg.src = '';
    compressedImg.src = '';
    originalMeta.textContent = '-';
    compressedMeta.textContent = '-';
  });
})();
