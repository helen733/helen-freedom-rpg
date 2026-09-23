// Inlined separately from the app so syntax/startup failures remain visible.
// Keep this bootstrap ES5-compatible, including on older file preview engines.
(function () {
  'use strict';
  var appReady = false;
  var issues = {};
  function show() {
    var banner = document.getElementById('load-warning');
    if (!banner) return;
    var messages = Object.keys(issues).map(function (key) { return '[' + key + '] ' + issues[key]; });
    if (!messages.length && appReady) {
      banner.hidden = true;
      banner.style.display = 'none';
      return;
    }
    if (!messages.length) return;
    banner.hidden = false;
    banner.style.display = 'block';
    var address = location.protocol === 'file:' ? '本地文件（file://）' : location.origin + location.pathname;
    banner.textContent = messages.join('\n') + '\n打开位置：' + address;
  }
  function report(code, detail) {
    issues[code] = detail;
    show();
    if (window.console) console.error('[海伦 RPG ' + code + '] ' + detail);
  }
  function check() {
    var style = document.getElementById('app-styles');
    if (!style || !style.sheet || getComputedStyle(document.documentElement).getPropertyValue('--green').trim() !== '#344e41') {
      report('CSS', '页面样式未生效：内嵌 CSS 缺失或被浏览器拦截。请重新获取完整 index.html，并在 Safari / Chrome 中打开；部署时检查 style-src 是否允许内嵌样式。');
    }
    if (!appReady) report('JS', '页面脚本未启动：JavaScript 被禁用、拦截或文件不完整。请退出微信/文件预览，在 Safari / Chrome 打开网页地址；部署时检查 script-src 是否允许内嵌脚本。');
    if (location.protocol === 'file:' || location.protocol === 'content:') {
      report('本地预览', '当前是本地文件预览。页面已自带样式和脚本，但预览器仍可能禁用脚本、保存和安装。每天使用请在 Safari / Chrome 打开网页地址；添加桌面及离线使用需要 HTTPS。');
    }
    show();
  }
  window.helenLoadCheck = {
    ready: function () { appReady = true; show(); },
    report: report
  };
  window.addEventListener('error', function (event) {
    var target = event.target;
    if (target && target !== window && (target.tagName === 'SCRIPT' || target.tagName === 'LINK')) {
      // Local previews do not support PWA metadata; the local-mode notice covers it.
      if (target.rel === 'manifest' && location.protocol === 'file:') return;
      report(target.tagName === 'SCRIPT' ? 'JS' : '资源', '资源加载失败：' + (target.getAttribute('src') || target.getAttribute('href') || target.id));
    } else {
      report('JS', '脚本运行异常：' + (event.message || '未知错误') + (event.lineno ? '（行 ' + event.lineno + '）' : '') + '。请重新加载完整页面。');
    }
  }, true);
  window.addEventListener('unhandledrejection', function () { report('JS', '脚本操作未能完成。请重新加载页面，并查看浏览器控制台中的错误详情。'); });
  document.addEventListener('DOMContentLoaded', check);
})();
