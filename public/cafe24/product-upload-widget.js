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
      "#app-perpackage-product-upload .ppu-warning{color:#9a6700}",
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

  function normalizeSearchText(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function compactSearchText(value) {
    return normalizeSearchText(value).replace(/[\s\[\]\(\):：*＊_-]+/g, "");
  }

  function includesFileIdLabel(value) {
    var text = normalizeSearchText(value);
    var compactText = compactSearchText(value);
    var keywords = [
      "\uc5c5\ub85c\ub4dc \ud30c\uc77c id",
      "\uc5c5\ub85c\ub4dc \ud30c\uc77c id[\ud544\uc218]",
      "\ud30c\uc77c\uc811\uc218\ubc88\ud638",
      "\ud30c\uc77c id",
      "file_id",
      "file id"
    ];
    if (!text) return false;

    for (var i = 0; i < keywords.length; i += 1) {
      if (text.indexOf(normalizeSearchText(keywords[i])) !== -1) return true;
      if (compactText.indexOf(compactSearchText(keywords[i])) !== -1) return true;
    }

    return false;
  }

  function isFileIdFieldCandidate(element) {
    if (!element) return false;
    var tagName = String(element.tagName || "").toLowerCase();
    if (tagName !== "input" && tagName !== "textarea") return false;
    if (element.closest && element.closest("#" + WIDGET_ID)) return false;
    if (element.disabled || element.readOnly) return false;

    if (tagName === "input") {
      var inputType = String(element.getAttribute("type") || "text").toLowerCase();
      var blockedTypes = ["button", "checkbox", "file", "hidden", "image", "radio", "reset", "submit"];
      for (var i = 0; i < blockedTypes.length; i += 1) {
        if (inputType === blockedTypes[i]) return false;
      }
    }

    return true;
  }

  function getInputSearchText(element) {
    var parts = [];
    var attributes = ["name", "id", "placeholder", "title", "aria-label"];

    for (var i = 0; i < attributes.length; i += 1) {
      var attrValue = element.getAttribute(attributes[i]);
      if (attrValue) parts.push(attrValue);
    }

    if (element.id) {
      try {
        var label = document.querySelector("label[for='" + cssEscape(element.id) + "']");
        if (label) parts.push(label.textContent);
      } catch (error) {
        // Ignore invalid selectors from third-party theme markup.
      }
    }

    var parentLabel = element.closest && element.closest("label");
    if (parentLabel) parts.push(parentLabel.textContent);

    var row = element.closest && element.closest("tr");
    if (row) {
      var rowHeader = row.querySelector("th");
      if (rowHeader) parts.push(rowHeader.textContent);
    }

    var fieldContainer = element.closest && element.closest("li, dd, td, div");
    if (fieldContainer) {
      var containerLabel = fieldContainer.querySelector("label, th, dt, .title, .label");
      if (containerLabel) parts.push(containerLabel.textContent);
    }

    return parts.join(" ");
  }

  function findFirstUsableField(root) {
    if (!root) return null;

    if (isFileIdFieldCandidate(root)) {
      return root;
    }

    if (!root.querySelectorAll) return null;

    var fields = root.querySelectorAll("input, textarea");
    for (var i = 0; i < fields.length; i += 1) {
      if (isFileIdFieldCandidate(fields[i])) {
        return fields[i];
      }
    }

    return null;
  }

  function resolveConfiguredFileIdInput() {
    if (!CONFIG.fileIdInputSelector) return null;

    try {
      var configuredTarget = document.querySelector(CONFIG.fileIdInputSelector);
      var configuredInput = findFirstUsableField(configuredTarget);
      if (configuredInput) {
        return {
          element: configuredInput,
          source: "config:fileIdInputSelector"
        };
      }
    } catch (error) {
      // Fall back to automatic field discovery below.
    }

    return null;
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(value);
    }

    return String(value).replace(/'/g, "\\'");
  }

  function findFileIdInputByAttributes() {
    var fields = document.querySelectorAll("input, textarea");
    for (var i = 0; i < fields.length; i += 1) {
      var field = fields[i];
      if (!isFileIdFieldCandidate(field)) continue;

      var searchText = getInputSearchText(field);

      if (includesFileIdLabel(searchText)) {
        return {
          element: field,
          source: "auto:" + normalizeSearchText(searchText).slice(0, 80)
        };
      }
    }

    return null;
  }

  function findFieldNearLabelElement(labelElement) {
    if (!labelElement) return null;

    var forAttribute = labelElement.getAttribute && labelElement.getAttribute("for");
    if (forAttribute) {
      var controlledField = document.getElementById(forAttribute);
      if (isFileIdFieldCandidate(controlledField)) return controlledField;
    }

    if (String(labelElement.tagName || "").toLowerCase() === "label") {
      var fieldInsideLabel = findFirstUsableField(labelElement);
      if (fieldInsideLabel) return fieldInsideLabel;
    }

    var row = labelElement.closest && labelElement.closest("tr");
    if (row) {
      var fieldInRow = findFirstUsableField(row);
      if (fieldInRow) return fieldInRow;

      var nextCell = labelElement.closest("th, td");
      while (nextCell && nextCell.nextElementSibling) {
        nextCell = nextCell.nextElementSibling;
        var fieldInNextCell = findFirstUsableField(nextCell);
        if (fieldInNextCell) return fieldInNextCell;
      }
    }

    var containerSelectors = ["li", "dd", "dl", "table", "tbody", "div"];
    for (var i = 0; i < containerSelectors.length; i += 1) {
      var container = labelElement.closest && labelElement.closest(containerSelectors[i]);
      var fieldInContainer = findFirstUsableField(container);
      if (fieldInContainer) return fieldInContainer;
    }

    return null;
  }

  function findFileIdInputByLabelText() {
    var labelElements = document.querySelectorAll("th, label, dt, strong, span");

    for (var i = 0; i < labelElements.length; i += 1) {
      var labelElement = labelElements[i];
      if (labelElement.closest && labelElement.closest("#" + WIDGET_ID)) continue;
      if (!includesFileIdLabel(labelElement.textContent)) continue;

      var field = findFieldNearLabelElement(labelElement);
      if (field) {
        return {
          element: field,
          source: "label:" + normalizeSearchText(labelElement.textContent).slice(0, 80)
        };
      }
    }

    return null;
  }

  function findFileIdInput() {
    return (
      resolveConfiguredFileIdInput() ||
      findFileIdInputByAttributes() ||
      findFileIdInputByLabelText()
    );
  }

  function setFieldValue(element, value) {
    var tagName = String(element.tagName || "").toLowerCase();
    var prototype = tagName === "textarea" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    var descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

    if (descriptor && descriptor.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }

    element.setAttribute("value", value);
  }

  function applyFileIdToCafe24Input(fileId) {
    if (!fileId) {
      return {
        status: "not_found",
        source: "missing_file_id"
      };
    }

    var match = findFileIdInput();
    if (!match || !match.element) {
      return {
        status: "not_found",
        source: "no_matching_input"
      };
    }

    setFieldValue(match.element, fileId);
    dispatchFieldEvent(match.element, "input");
    dispatchFieldEvent(match.element, "change");
    dispatchFieldEvent(match.element, "blur");

    return {
      status: "success",
      source: match.source
    };
  }

  function dispatchFieldEvent(element, eventName) {
    var event;

    if (typeof Event === "function") {
      event = new Event(eventName, { bubbles: true, cancelable: true });
    } else {
      event = document.createEvent("Event");
      event.initEvent(eventName, true, true);
    }

    element.dispatchEvent(event);
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
          var fileId = uploaded.id || json.id || "";
          var cafe24InputResult = applyFileIdToCafe24Input(fileId);
          status.className = "ppu-status ppu-success";
          status.textContent = cafe24InputResult.status === "success"
            ? "업로드가 완료되었고 주문 연결용 파일 ID가 입력되었습니다."
            : "업로드가 완료되었습니다. 주문 연결용 입력 옵션은 찾지 못했습니다.";
          result.hidden = false;
          result.innerHTML = [
            "<strong>업로드 정보</strong>",
            "<br>file_id: " + escapeHtml(fileId || "-"),
            "<br>original_filename: " + escapeHtml(uploaded.original_filename || "-"),
            "<br>status: " + escapeHtml(uploaded.status || "-"),
            "<br>Cafe24 입력 옵션 반영 여부: " + escapeHtml(cafe24InputResult.status),
            "<br>input source: " + escapeHtml(cafe24InputResult.source || "-")
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
