// content.js — 注入 Temu 列表页 & 店铺页，添加悬停下载按钮
// 支持页面类型：
//   - https://www.temu.com/          （首页推荐列表）
//   - https://www.temu.com/search*   （搜索结果）
//   - https://www.temu.com/mall.html （店铺页商品列表）

// ─── 工具函数 ───────────────────────────────────────────────

/** 清理文件名，去除 Windows 非法字符，限制长度 */
function sanitizeFilename(title) {
  return (title || '')
    .replace(/[\/\\:*?"<>|]/g, '') // Windows 非法字符
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 100);
}

/** 从商品卡片中提取商品标题 */
function getTitle(card) {
  // ① aria-label 最稳定（列表页 & mall 页通用）
  const group = card.closest('[role="group"][aria-label]') || card;
  const label = group.getAttribute('aria-label')?.trim();
  if (label && label.length > 2) return label;

  // ② data-tooltip-title（goodName 节点）
  const tooltipEl = card.querySelector('[data-tooltip^="goodName-"]');
  const tooltipTitle = tooltipEl?.getAttribute('data-tooltip-title')?.trim();
  if (tooltipTitle && tooltipTitle.length > 2) return tooltipTitle;

  // ③ h3 span 文字
  const h3Span = card.querySelector('h3 span');
  const spanText = h3Span?.innerText?.trim();
  if (spanText && spanText.length > 2) return spanText;

  // ④ a 标签 title 属性
  const link = card.querySelector('a[href*="goods"]');
  const linkTitle = link?.getAttribute('title')?.trim();
  if (linkTitle && linkTitle.length > 2) return linkTitle;

  // ⑤ 兜底
  return `temu_${Date.now()}`;
}

/** 将图片 URL 升级为原图最高质量 */
function upgradeImageQuality(url) {
  try {
    const u = new URL(url);
    // ① 去掉所有 query 参数（Temu 七牛云 CDN 用 ?imageView2/2/w/238 限制尺寸）
    u.search = '';
    // ② 去掉路径里的 _NNNxNNN 尺寸后缀
    u.pathname = u.pathname.replace(/_\d+x\d+[^./]*/g, '');
    // ③ .webp → .jpg 确保下载后可直接打开
    if (u.pathname.toLowerCase().endsWith('.webp')) {
      u.pathname = u.pathname.slice(0, -5) + '.jpg';
    }
    return u.toString();
  } catch (_) {
    return url.split('?')[0];
  }
}

/** 从商品卡片中提取主图 URL */
function getImageUrl(card) {
  // ① data-js-main-img（列表页首选）
  const mainImg = card.querySelector('img[data-js-main-img="true"]');
  if (mainImg) {
    const src = mainImg.src || mainImg.getAttribute('src') || '';
    if (src.startsWith('https://')) return upgradeImageQuality(src);
  }

  // ② goods.html 链接里的 top_gallery_url 参数（mall 页 & 列表页通用）
  const goodsLink = card.querySelector('a[href*="goods_id"], a[href*="goods.html"]');
  if (goodsLink) {
    try {
      const href = goodsLink.getAttribute('href');
      const url = new URL(href, location.origin);
      const galleryUrl = url.searchParams.get('top_gallery_url');
      if (galleryUrl) return upgradeImageQuality(decodeURIComponent(galleryUrl));
    } catch (_) {}
  }

  // ③ data-tooltip-title 在 goodsImage 节点上有时包含图片 URL 信息
  const imgTooltip = card.querySelector('[data-tooltip^="goodsImage-"]');
  const tooltipSrc = imgTooltip?.querySelector('img')?.src;
  if (tooltipSrc && tooltipSrc.startsWith('https://')) {
    return upgradeImageQuality(tooltipSrc);
  }

  // ④ 兜底：卡片内任意 kwcdn.com 图片
  const anyImg = card.querySelector('img[src*="kwcdn.com"]');
  if (anyImg?.src) return upgradeImageQuality(anyImg.src);

  return null;
}

// ─── 注入下载按钮 ───────────────────────────────────────────

function injectDownloadButton(card) {
  // 找图片容器 —— 多种选择器兼容列表页和 mall 页
  let imgContainer = card.querySelector(
    '[class*="goods-image-container"], [class*="goods-img-external"], [class*="goods-img"]'
  );

  // 如果找不到容器，退而求其次：找第一个包含 img 的相对/绝对定位元素
  if (!imgContainer) {
    imgContainer = card.querySelector('[class*="OdRhMCvs"], [class*="_1KPRonPK"]');
  }

  // 实在找不到就用 card 自身作为容器（确保按钮能显示）
  if (!imgContainer) {
    imgContainer = card;
  }

  // 确保容器有相对定位
  if (getComputedStyle(imgContainer).position === 'static') {
    imgContainer.style.position = 'relative';
  }

  // 创建按钮
  const btn = document.createElement('button');
  btn.className = 'temu-dl-btn';
  btn.title = '下载图片';
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="16" height="16">
      <path d="M12 16l-5-5h3V4h4v7h3l-5 5zm-7 2h14v2H5v-2z"/>
    </svg>
  `;

  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    e.preventDefault();

    // 从 card 或其父级 group 获取完整上下文
    const context = card.closest('[role="group"][aria-label]') || card;
    const imageUrl = getImageUrl(context);
    const title = getTitle(context);

    if (!imageUrl) {
      setButtonState(btn, 'error', '无法获取图片');
      return;
    }

    setButtonState(btn, 'loading');

    try {
      const { subfolder = 'Temu' } = await chrome.storage.sync.get('subfolder');
      const filename = sanitizeFilename(title);

      chrome.runtime.sendMessage(
        {
          action: 'downloadImage',
          url: imageUrl,
          filename: filename,
          subfolder: subfolder,
        },
        (response) => {
          if (chrome.runtime.lastError || (response && !response.success)) {
            setButtonState(btn, 'error', '下载失败');
          } else {
            setButtonState(btn, 'success');
          }
        }
      );
    } catch (err) {
      console.error('[Temu DL]', err);
      setButtonState(btn, 'error', '下载失败');
    }
  });

  imgContainer.appendChild(btn);
}

/** 设置按钮状态 */
function setButtonState(btn, state, tooltip) {
  btn.className = `temu-dl-btn temu-dl-btn--${state}`;
  if (tooltip) btn.title = tooltip;

  const downloadIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="16" height="16"><path d="M12 16l-5-5h3V4h4v7h3l-5 5zm-7 2h14v2H5v-2z"/></svg>`;
  const checkIcon   = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="16" height="16"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>`;
  const crossIcon   = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="16" height="16"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;

  if (state === 'loading') {
    btn.innerHTML = `<span class="temu-dl-spinner"></span>`;
    return;
  }
  if (state === 'success') {
    btn.innerHTML = checkIcon;
    setTimeout(() => { btn.className = 'temu-dl-btn'; btn.title = '下载图片'; btn.innerHTML = downloadIcon; }, 1800);
    return;
  }
  if (state === 'error') {
    btn.innerHTML = crossIcon;
    setTimeout(() => { btn.className = 'temu-dl-btn'; btn.title = '下载图片'; btn.innerHTML = downloadIcon; }, 2000);
  }
}

// ─── 扫描并注入 ─────────────────────────────────────────────

function scanAndInject() {
  document.querySelectorAll(
    'div[role="group"][aria-label]:not([data-temu-dl-inited])'
  ).forEach((card) => {
    card.setAttribute('data-temu-dl-inited', '1');
    injectDownloadButton(card);
  });
}

// 初始扫描
scanAndInject();

// MutationObserver 监听无限滚动 / 动态加载
const observer = new MutationObserver(() => scanAndInject());
observer.observe(document.body, { childList: true, subtree: true });
