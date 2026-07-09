(function () {
  "use strict";

  var ROOT_ID = "perpackage-customer-order-file-status";
  var PLACEHOLDER_ID = "perpackage-customer-order-file-status-root";
  var ORDER_ID_PATTERN = /\b\d{8}-\d{7}(?:-\d{2})?\b/;
  var FILE_ID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
  var UPLOAD_FILE_ID_LABEL = "업로드 파일 ID";
  var APP_ORIGIN = "https://perpackage-cafe24-file-upload-app.vercel.app";
  var attempts = 0;
  var isLoading = false;
  var didRender = false;

  function getScriptOrigin() {
    var script = document.currentScript;
    if (script && script.src) {
      try {
        return new URL(script.src).origin;
      } catch (_) {
        return APP_ORIGIN;
      }
    }

    return APP_ORIGIN;
  }

  var apiUrl = getScriptOrigin() + "/api/customer/order-file-status";

  function normalizeReuploadUrl(url) {
    var value = normalizeText(url);
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return value;
    if (value.charAt(0) === "/") return APP_ORIGIN + value;
    return APP_ORIGIN + "/" + value;
  }

  function normalizeText(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function normalizeOrderId(value) {
    var match = normalizeText(value).match(ORDER_ID_PATTERN);
    return match ? match[0] : "";
  }

  function normalizeFileId(value) {
    var match = normalizeText(value).match(FILE_ID_PATTERN);
    return match ? match[0] : "";
  }

  function getSearchParamOrderId() {
    try {
      var params = new URLSearchParams(window.location.search);
      var keys = ["order_id", "orderId", "order_no", "orderNo"];
      for (var i = 0; i < keys.length; i += 1) {
        var value = params.get(keys[i]);
        var orderId = normalizeOrderId(value);
        if (orderId) return orderId;
      }
    } catch (_) {
      return "";
    }

    return "";
  }

  function getTextCandidates() {
    var selectors = [
      ".orderArea",
      ".orderInfo",
      ".xans-myshop-orderhistorydetail",
      ".xans-myshop-orderhistorydetailbasic",
      ".xans-myshop-orderhistorydetailitem",
      ".ec-base-table",
      "table",
      "dl",
      "ul",
      "ol",
      "p",
      "div",
      "span"
    ];
    var nodes = [];
    for (var i = 0; i < selectors.length; i += 1) {
      var found = document.querySelectorAll(selectors[i]);
      for (var j = 0; j < found.length; j += 1) {
        nodes.push(found[j]);
      }
    }
    nodes.push(document.body);
    return nodes;
  }

  function extractOrderId() {
    var fromSearch = getSearchParamOrderId();
    if (fromSearch) return fromSearch;

    var nodes = getTextCandidates();
    for (var i = 0; i < nodes.length; i += 1) {
      var text = normalizeText(nodes[i].textContent);
      if (!text || text.indexOf("주문") === -1) continue;
      var orderId = normalizeOrderId(text);
      if (orderId) return orderId;
    }

    var bodyText = normalizeText(document.body ? document.body.textContent : "");
    return normalizeOrderId(bodyText);
  }

  function extractFileId() {
    var inputs = document.querySelectorAll("input, textarea");
    for (var i = 0; i < inputs.length; i += 1) {
      var input = inputs[i];
      var value = input.value || input.getAttribute("value") || "";
      var nearbyText = normalizeText(
        [
          input.name,
          input.id,
          input.getAttribute("title"),
          input.getAttribute("aria-label"),
          input.closest("tr, li, dd, dt, div, p") && input.closest("tr, li, dd, dt, div, p").textContent
        ].join(" ")
      );
      if (nearbyText.indexOf(UPLOAD_FILE_ID_LABEL) === -1 && !FILE_ID_PATTERN.test(value)) {
        continue;
      }

      var fromInput = normalizeFileId(value);
      if (fromInput) return fromInput;
    }

    var nodes = getTextCandidates();
    for (var j = 0; j < nodes.length; j += 1) {
      var text = normalizeText(nodes[j].textContent);
      if (!text || text.indexOf(UPLOAD_FILE_ID_LABEL) === -1) continue;
      var fileId = normalizeFileId(text);
      if (fileId) return fileId;
    }

    return "";
  }

  function formatDate(value) {
    if (!value) return "-";
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value).slice(0, 10);
    }

    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function ensureStyle() {
    if (document.getElementById(ROOT_ID + "-style")) return;

    var style = document.createElement("style");
    style.id = ROOT_ID + "-style";
    style.textContent = [
      "#" + ROOT_ID + " { margin: 18px 0; padding: 18px; border: 1px solid #d8dde5; background: #fff; color: #1f2933; font-family: inherit; box-sizing: border-box; }",
      "#" + ROOT_ID + " * { box-sizing: border-box; }",
      "#" + ROOT_ID + " .ppu-order-status-label { margin: 0 0 6px; font-size: 12px; font-weight: 700; color: #476173; }",
      "#" + ROOT_ID + " .ppu-order-status-title { margin: 0 0 12px; font-size: 18px; line-height: 1.4; font-weight: 700; color: #111827; }",
      "#" + ROOT_ID + " .ppu-order-status-list { display: grid; gap: 8px; margin: 0 0 12px; }",
      "#" + ROOT_ID + " .ppu-order-status-row { display: flex; gap: 10px; align-items: baseline; line-height: 1.5; }",
      "#" + ROOT_ID + " .ppu-order-status-term { flex: 0 0 74px; color: #64748b; font-size: 13px; }",
      "#" + ROOT_ID + " .ppu-order-status-desc { flex: 1; min-width: 0; margin: 0; color: #1f2937; font-size: 14px; overflow-wrap: anywhere; }",
      "#" + ROOT_ID + " .ppu-order-status-message { margin: 10px 0 0; color: #374151; font-size: 14px; line-height: 1.6; }",
      "#" + ROOT_ID + " .ppu-order-status-reupload { margin-top: 12px; padding: 12px; border: 1px solid #f2c8b5; background: #fff7f2; color: #623b28; }",
      "#" + ROOT_ID + " .ppu-order-status-reupload strong { display: block; margin-bottom: 6px; color: #7c2d12; }",
      "#" + ROOT_ID + " .ppu-order-status-reupload p { margin: 0; line-height: 1.6; }",
      "#" + ROOT_ID + " .ppu-order-status-button { display: inline-block; margin-top: 10px; padding: 9px 14px; border: 1px solid #7c2d12; background: #7c2d12; color: #fff; text-decoration: none; font-size: 13px; font-weight: 700; line-height: 1.4; }",
      "#" + ROOT_ID + " .ppu-order-status-button:hover { background: #9a3412; border-color: #9a3412; color: #fff; }",
      "@media (max-width: 640px) { #" + ROOT_ID + " { margin: 14px 0; padding: 15px; } #" + ROOT_ID + " .ppu-order-status-row { display: block; } #" + ROOT_ID + " .ppu-order-status-term { display: block; margin-bottom: 2px; } }"
    ].join("\n");
    document.head.appendChild(style);
  }

  function findInsertTarget() {
    var selectors = [
      ".xans-myshop-orderhistorydetailitem",
      ".xans-myshop-orderhistorydetail",
      ".xans-myshop-orderhistorydetailbasic",
      ".orderArea",
      ".orderInfo",
      ".ec-base-table",
      "#contents",
      "#content",
      "main"
    ];

    for (var i = 0; i < selectors.length; i += 1) {
      var target = document.querySelector(selectors[i]);
      if (target && target.parentNode) {
        return target;
      }
    }

    return document.body;
  }

  function getStatusRoot() {
    var placeholder = document.getElementById(PLACEHOLDER_ID);
    var root = document.getElementById(ROOT_ID);

    if (placeholder) {
      if (root && root.parentNode !== placeholder) {
        placeholder.appendChild(root);
        return root;
      }

      if (!root) {
        root = document.createElement("section");
        root.id = ROOT_ID;
        root.setAttribute("aria-label", "파일 확인 상태");
        placeholder.appendChild(root);
      }

      return root;
    }

    if (root) {
      return root;
    }

    root = document.createElement("section");
    root.id = ROOT_ID;
    root.setAttribute("aria-label", "파일 확인 상태");
    var target = findInsertTarget();
    target.parentNode.insertBefore(root, target.nextSibling);
    return root;
  }

  function renderStatusBox(data) {
    if (!data || !data.ok || !data.has_file || !data.file) return;
    didRender = true;
    ensureStyle();

    var root = getStatusRoot();
    if (!root) {
      root = document.createElement("section");
      root.id = ROOT_ID;
      root.setAttribute("aria-label", "파일 확인 상태");
      var target = findInsertTarget();
      target.parentNode.insertBefore(root, target.nextSibling);
    }

    var file = data.file;
    var reupload = data.reupload || {};
    var reuploadHtml = "";
    var reuploadButtonHtml = "";
    if (reupload.requested || reupload.status) {
      var pendingButtonText = reupload.requested ? "<p>재업로드 버튼은 추후 제공 예정입니다.</p>" : "";
      if (reupload.available && reupload.url) {
        reuploadButtonHtml =
          '<a class="ppu-order-status-button" href="' +
          escapeHtml(normalizeReuploadUrl(reupload.url)) +
          '">' +
          escapeHtml(reupload.button_label || "파일 재업로드하기") +
          "</a>";
        pendingButtonText = reuploadButtonHtml;
      }
      reuploadHtml =
        '<div class="ppu-order-status-reupload">' +
        "<strong>" +
        escapeHtml(reupload.status_label || "재업로드 요청") +
        "</strong>" +
        "<p>" +
        escapeHtml(reupload.message || "파일 재업로드가 필요합니다. 안내받은 링크를 이용해 주세요.") +
        "</p>" +
        pendingButtonText +
        "</div>";
    }

    root.innerHTML =
      '<p class="ppu-order-status-label">페르패키지 파일 확인 안내</p>' +
      '<h3 class="ppu-order-status-title">파일 확인 상태</h3>' +
      '<div class="ppu-order-status-list">' +
      '<div class="ppu-order-status-row"><span class="ppu-order-status-term">업로드 파일</span><p class="ppu-order-status-desc">' +
      escapeHtml(file.filename || "-") +
      "</p></div>" +
      '<div class="ppu-order-status-row"><span class="ppu-order-status-term">업로드일</span><p class="ppu-order-status-desc">' +
      escapeHtml(formatDate(file.uploaded_at)) +
      "</p></div>" +
      '<div class="ppu-order-status-row"><span class="ppu-order-status-term">상태</span><p class="ppu-order-status-desc">' +
      escapeHtml(file.status_label || "상태 확인 중") +
      "</p></div>" +
      "</div>" +
      '<p class="ppu-order-status-message">' +
      escapeHtml(data.message || "파일에 문제가 있으면 이 화면에서 재업로드 안내가 표시됩니다.") +
      "</p>" +
      reuploadHtml;
  }

  function fetchStatus(orderId, fileId) {
    if (isLoading || didRender) return;
    isLoading = true;

    fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "omit",
      body: JSON.stringify({
        order_id: orderId,
        file_id: fileId
      })
    })
      .then(function (response) {
        if (!response.ok) return null;
        return response.json();
      })
      .then(function (data) {
        if (data && data.ok) {
          renderStatusBox(data);
        }
      })
      .catch(function () {
        return null;
      })
      .finally(function () {
        isLoading = false;
      });
  }

  function run() {
    if (didRender) return;

    var orderId = extractOrderId();
    var fileId = extractFileId();
    if (orderId && fileId) {
      fetchStatus(orderId, fileId);
    }
  }

  function scheduleRun(delay) {
    window.setTimeout(function () {
      attempts += 1;
      run();
    }, delay);
  }

  run();
  if (attempts < 3) {
    scheduleRun(300);
    scheduleRun(1000);
  }
})();
