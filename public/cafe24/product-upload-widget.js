(function () {
  "use strict";

  var WIDGET_ID = "app-perpackage-product-upload";
  var STYLE_ID = "app-perpackage-product-upload-style";
  var CONFIG = window.PERPACKAGE_PRODUCT_UPLOAD_CONFIG || {};

  if (document.getElementById(WIDGET_ID)) {
    return;
  }

  function getAppOrigin() {
    if (CONFIG.appOrigin) {
      return String(CONFIG.appOrigin).replace(/\/+$/, "");
    }

    var currentScript = document.currentScript;
    if (currentScript && currentScript.src) {
      try {
        return new URL(currentScript.src).origin;
      } catch (error) {
        return "";
      }
    }

    return "";
  }

  function getProductNoFromInputs() {
    var selectors = [
      "input[name='product_no']",
      "input[name='product_no[]']",
      "input#product_no",
      "[data-product-no]",
      "[data-product_no]"
    ];

    for (var i = 0; i < selectors.length; i += 1) {
      var element = document.querySelector(selectors[i]);
      if (!element) continue;

      var value = element.value || element.getAttribute("data-product-no") || element.getAttribute("data-product_no");
      if (value) return String(value).trim();
    }

    return "";
  }

  function getProductNoFromGlobals() {
    var candidates = [
      window.iProductNo,
      window.product_no,
      window.productNo,
      window.CAFE24 && window.CAFE24.PRODUCT_NO
    ];

    for (var i = 0; i < candidates.length; i += 1) {
      if (candidates[i]) return String(candidates[i]).trim();
    }

    return "";
  }

  function getProductNoFromPath() {
    var match = window.location.pathname.match(/\/product\/(?:[^/]+\/)?(\d+)(?:\/|$)/);
    return match ? match[1] : "";
  }

  function resolveProductNo() {
    return String(CONFIG.productNo || getProductNoFromInputs() || getProductNoFromGlobals() || getProductNoFromPath() || "").trim();
  }

  function resolveShopNo() {
    return String(CONFIG.shopNo || window.shop_no || window.iShopNo || "1").trim();
  }

  function resolveMallId() {
    return String(CONFIG.mallId || window.mall_id || window.CAFE24_MALL_ID || "peerl").trim();
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      "#app-perpackage-product-upload{margin:18px 0;padding:16px;border:1px solid #d9e2f2;border-radius:8px;background:#f7faff;color:#1f2a44;font-family:inherit;box-sizing:border-box}",
      "#app-perpackage-product-upload *{box-sizing:border-box}",
      "#app-perpackage-product-upload .ppu-title{margin:0 0 6px;font-size:16px;font-weight:700;color:#15213b}",
      "#app-perpackage-product-upload .ppu-desc{margin:0 0 12px;font-size:13px;line-height:1.55;color:#4b5875}",
      "#app-perpackage-product-upload .ppu-form{display:grid;gap:10px}",
      "#app-perpackage-product-upload .ppu-file{width:100%;padding:10px;border:1px solid #cfd8ea;border-radius:6px;background:#fff;font-size:13px}",
      "#app-perpackage-product-upload .ppu-button{width:100%;max-width:180px;padding:10px 14px;border:0;border-radius:6px;background:#2A408C;color:#fff;font-size:14px;font-weight:700;cursor:pointer}",
      "#app-perpackage-product-upload .ppu-button:disabled{background:#8b97ba;cursor:not-allowed}",
      "#app-perpackage-product-upload .ppu-status{margin:2px 0 0;font-size:13px;line-height:1.5;color:#4b5875}",
      "#app-perpackage-product-upload .ppu-result{margin:10px 0 0;padding:10px;border-radius:6px;background:#fff;border:1px solid #d9e2f2;font-size:13px;line-height:1.6}",
      "#app-perpackage-product-upload .ppu-error{color:#b42318}",
      "#app-perpackage-product-upload .ppu-success{color:#155724}",
      "@media (max-width:480px){#app-perpackage-product-upload{padding:14px}#app-perpackage-product-upload .ppu-button{max-width:none}}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function findInsertTarget() {
    if (CONFIG.targetSelector) {
      var configuredTarget = document.querySelector(CONFIG.targetSelector);
      if (configuredTarget) return configuredTarget;
    }

    var selectors = [
      ".xans-product-detail .infoArea",
      ".xans-product-detail",
      "#prdDetail",
      "#contents",
      "form[action*='basket']",
      "form"
    ];

    for (var i = 0; i < selectors.length; i += 1) {
      var element = document.querySelector(selectors[i]);
      if (element) return element;
    }

    return document.body;
  }

  function renderWidget() {
    injectStyles();

    var wrapper = document.createElement("section");
    wrapper.id = WIDGET_ID;
    wrapper.setAttribute("aria-label", "Perpackage print file upload");
    wrapper.innerHTML = [
      '<h3 class="ppu-title">인쇄파일 업로드</h3>',
      '<p class="ppu-desc">AI, PDF, ZIP, DXF 파일 업로드를 권장합니다. 파일 확인 후 필요한 경우 별도로 안내드립니다.</p>',
      '<form class="ppu-form">',
      '<input class="ppu-file" name="file" type="file" required aria-label="인쇄파일 선택">',
      '<button class="ppu-button" type="submit">파일 업로드</button>',
      '<p class="ppu-status" role="status"></p>',
      '<div class="ppu-result" hidden></div>',
      "</form>"
    ].join("");

    var target = findInsertTarget();
    target.appendChild(wrapper);
    bindForm(wrapper);
  }

  function bindForm(wrapper) {
    var form = wrapper.querySelector("form");
    var fileInput = wrapper.querySelector("input[type='file']");
    var button = wrapper.querySelector("button[type='submit']");
    var status = wrapper.querySelector(".ppu-status");
    var result = wrapper.querySelector(".ppu-result");
    var appOrigin = getAppOrigin();

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var file = fileInput.files && fileInput.files[0];
      if (!file) {
        showMessage(status, result, "업로드할 파일을 선택해 주세요.", true);
        return;
      }

      if (!appOrigin) {
        showMessage(status, result, "업로드 서버 주소를 확인할 수 없습니다.", true);
        return;
      }

      var formData = new FormData();
      formData.append("file", file);
      formData.append("mall_id", resolveMallId());
      formData.append("shop_no", resolveShopNo());
      formData.append("product_no", resolveProductNo());
      formData.append("customer_type", "cafe24-product-detail");
      formData.append("customer_identifier", window.location.href);

      button.disabled = true;
      status.className = "ppu-status";
      status.textContent = "파일을 업로드하고 있습니다.";
      result.hidden = true;
      result.textContent = "";

      fetch(appOrigin + "/api/files/upload", {
        method: "POST",
        body: formData
      })
        .then(function (response) {
          return response.json().catch(function () {
            return {};
          }).then(function (json) {
            if (!response.ok || !json.ok) {
              throw new Error(json.message || "파일 업로드에 실패했습니다.");
            }
            return json;
          });
        })
        .then(function (json) {
          var uploaded = json.file || {};
          status.className = "ppu-status ppu-success";
          status.textContent = "업로드가 완료되었습니다.";
          result.hidden = false;
          result.innerHTML = [
            "<strong>업로드 정보</strong>",
            "<br>file_id: " + escapeHtml(uploaded.id || "-"),
            "<br>original_filename: " + escapeHtml(uploaded.original_filename || "-"),
            "<br>status: " + escapeHtml(uploaded.status || "-")
          ].join("");
          form.reset();
        })
        .catch(function (error) {
          showMessage(status, result, error.message || "네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.", true);
        })
        .finally(function () {
          button.disabled = false;
        });
    });
  }

  function showMessage(status, result, message, isError) {
    status.className = isError ? "ppu-status ppu-error" : "ppu-status";
    status.textContent = message;
    result.hidden = true;
    result.textContent = "";
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderWidget, { once: true });
  } else {
    renderWidget();
  }
})();
