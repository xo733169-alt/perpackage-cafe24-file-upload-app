(function () {
  "use strict";

  var WIDGET_ID = "app-perpackage-product-upload";
  var STYLE_ID = "app-perpackage-product-upload-style";
  var CONFIG = window.PERPACKAGE_PRODUCT_UPLOAD_CONFIG || {};
  var DEFAULT_BUY_BUTTON_SELECTOR = "a[onclick*='product_submit(1,']";
  var DEFAULT_CART_BUTTON_SELECTOR = "a[onclick*='product_submit(2,']";
  var DEFAULT_ORDER_ACTION_SELECTOR = DEFAULT_BUY_BUTTON_SELECTOR + ", " + DEFAULT_CART_BUTTON_SELECTOR;

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
      "#app-perpackage-product-upload{margin:18px 0;padding:18px;border:1px solid #d9e2f2;border-radius:8px;background:#fff;color:#1f2a44;font-family:inherit;box-sizing:border-box;box-shadow:0 6px 18px rgba(31,42,68,.06)}",
      "#app-perpackage-product-upload *{box-sizing:border-box}",
      "#app-perpackage-product-upload .ppu-title{margin:0 0 8px;font-size:17px;font-weight:700;color:#15213b;line-height:1.35}",
      "#app-perpackage-product-upload .ppu-desc{margin:0 0 6px;font-size:13px;line-height:1.6;color:#4b5875}",
      "#app-perpackage-product-upload .ppu-guide{margin:12px 0;padding:12px;border:1px solid #dbe5f5;border-radius:8px;background:#f7faff}",
      "#app-perpackage-product-upload .ppu-guide-title{margin:0 0 8px;font-size:13px;font-weight:700;color:#1f2a44}",
      "#app-perpackage-product-upload .ppu-checklist{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 12px;margin:0;padding:0;list-style:none}",
      "#app-perpackage-product-upload .ppu-checklist li{position:relative;padding-left:18px;font-size:12px;line-height:1.45;color:#4b5875}",
      "#app-perpackage-product-upload .ppu-checklist li:before{content:'✓';position:absolute;left:0;top:0;color:#2A408C;font-weight:700}",
      "#app-perpackage-product-upload .ppu-form{display:grid;gap:10px;margin-top:12px}",
      "#app-perpackage-product-upload .ppu-file-help{margin:0;font-size:12px;line-height:1.55;color:#5b6680}",
      "#app-perpackage-product-upload .ppu-static-note{margin:10px 0 0;padding:10px 12px;border:1px solid #dbe5f5;border-radius:8px;background:#f7faff;font-size:12px;line-height:1.6;color:#4b5875}",
      "#app-perpackage-product-upload .ppu-static-note strong{color:#2A408C;font-weight:700}",
      "#app-perpackage-product-upload .ppu-option-gate{margin:12px 0 0;padding:11px 12px;border:1px solid #f3c969;border-radius:8px;background:#fff9e8;color:#8a5a00;font-size:12px;line-height:1.6}",
      "#app-perpackage-product-upload.ppu-is-ready .ppu-option-gate{border-color:#c8d9f5;background:#f7faff;color:#2A408C}",
      "#app-perpackage-product-upload .ppu-upload-controls{display:none;gap:10px}",
      "#app-perpackage-product-upload.ppu-is-ready .ppu-upload-controls{display:grid}",
      "#app-perpackage-product-upload .ppu-dropzone{display:grid;gap:5px;width:100%;min-height:96px;padding:18px;border:1px dashed #9fb1d4;border-radius:8px;background:#f8fbff;color:#1f2a44;text-align:center;cursor:pointer;align-content:center;transition:border-color .15s ease,background .15s ease}",
      "#app-perpackage-product-upload .ppu-dropzone:hover,#app-perpackage-product-upload .ppu-dropzone.ppu-is-dragover{border-color:#2A408C;background:#eef4ff}",
      "#app-perpackage-product-upload .ppu-drop-title{font-size:14px;font-weight:700;color:#15213b}",
      "#app-perpackage-product-upload .ppu-drop-desc{font-size:12px;line-height:1.5;color:#5b6680}",
      "#app-perpackage-product-upload .ppu-upload-controls .ppu-button{display:none}",
      "#app-perpackage-product-upload .ppu-file-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center}",
      "#app-perpackage-product-upload .ppu-file{position:absolute;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none}",
      "#app-perpackage-product-upload .ppu-button{width:100%;min-width:128px;max-width:180px;padding:10px 14px;border:0;border-radius:6px;background:#2A408C;color:#fff;font-size:14px;font-weight:700;cursor:pointer;white-space:nowrap}",
      "#app-perpackage-product-upload .ppu-button:disabled{background:#8b97ba;cursor:not-allowed}",
      "#app-perpackage-product-upload .ppu-status{margin:2px 0 0;font-size:13px;line-height:1.55;color:#4b5875}",
      "#app-perpackage-product-upload .ppu-result{margin:10px 0 0;padding:10px;border-radius:6px;background:#fff;border:1px solid #d9e2f2;font-size:13px;line-height:1.6}",
      "#app-perpackage-product-upload .ppu-result-title{display:block;margin-bottom:4px;color:#15213b;font-weight:700}",
      "#app-perpackage-product-upload .ppu-tracking{display:block;margin-top:4px;font-size:12px;color:#6b7280;word-break:break-all}",
      "#app-perpackage-product-upload .ppu-file-id-warning{margin-top:8px;padding:9px 10px;border:1px solid #f3c969;border-radius:6px;background:#fff9e8;color:#8a5a00;font-size:12px;line-height:1.55}",
      "#app-perpackage-product-upload .ppu-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}",
      "#app-perpackage-product-upload .ppu-action{padding:8px 10px;border:1px solid #b8c4dd;border-radius:6px;background:#fff;color:#1f2a44;font-size:12px;font-weight:700;cursor:pointer}",
      "#app-perpackage-product-upload .ppu-action:hover{border-color:#2A408C;color:#2A408C}",
      "#app-perpackage-product-upload .ppu-error{color:#b42318}",
      "#app-perpackage-product-upload .ppu-success{color:#155724}",
      "#app-perpackage-product-upload .ppu-warning{color:#9a6700}",
      "@media (max-width:560px){#app-perpackage-product-upload{padding:14px}#app-perpackage-product-upload .ppu-checklist{grid-template-columns:1fr}#app-perpackage-product-upload .ppu-file-row{grid-template-columns:1fr}#app-perpackage-product-upload .ppu-button{max-width:none}}"
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

  function isElementVisible(element) {
    if (!element || !document.documentElement.contains(element)) return false;

    var current = element;
    while (current && current.nodeType === 1 && current !== document.documentElement) {
      if (current.hidden || current.getAttribute("aria-hidden") === "true") return false;

      if (window.getComputedStyle) {
        var style = window.getComputedStyle(current);
        if (style.display === "none" || style.visibility === "hidden") return false;
      }

      current = current.parentElement;
    }

    if (element.getClientRects && element.getClientRects().length > 0) return true;
    return !!(element.offsetWidth || element.offsetHeight);
  }

  function isFileIdInputUsable(match) {
    if (!match || !match.element) return false;

    var element = match.element;
    var tagName = String(element.tagName || "").toLowerCase();
    if (tagName !== "input" && tagName !== "textarea") return false;
    if (element.disabled) return false;

    if (tagName === "input") {
      var inputType = String(element.getAttribute("type") || "text").toLowerCase();
      if (inputType === "hidden") return false;
    }

    return isElementVisible(element);
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

  function isAddOptionValueFieldCandidate(element) {
    if (!element) return false;
    var tagName = String(element.tagName || "").toLowerCase();
    if (tagName !== "input" && tagName !== "textarea") return false;
    if (element.closest && element.closest("#" + WIDGET_ID)) return false;
    if (element.disabled) return false;

    if (tagName === "input") {
      var inputType = String(element.getAttribute("type") || "text").toLowerCase();
      var blockedTypes = ["button", "checkbox", "file", "hidden", "image", "radio", "reset", "submit"];
      for (var i = 0; i < blockedTypes.length; i += 1) {
        if (inputType === blockedTypes[i]) return false;
      }
    }

    return true;
  }

  function findTextFieldForAddOptionHidden(hiddenField) {
    if (!hiddenField) return null;

    var container = hiddenField.closest && hiddenField.closest("tr");
    if (!container || !container.querySelectorAll) return null;

    var fields = container.querySelectorAll([
      "input.input_addoption[type='text']",
      "input.input_peraddoption[type='text']",
      "input[type='text']",
      "textarea"
    ].join(", "));

    for (var i = 0; i < fields.length; i += 1) {
      var field = fields[i];
      if (field === hiddenField) continue;
      if (isAddOptionValueFieldCandidate(field)) return field;
    }

    return null;
  }

  function getUploadFileIdAddOptionRowFromHidden(hiddenField) {
    if (!hiddenField) return null;
    if (!isExactUploadFileIdLabel(hiddenField.value || hiddenField.getAttribute("value") || "")) return null;
    return hiddenField.closest && hiddenField.closest("tr");
  }

  function hideUploadFileIdAddOptionRows(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var markers;

    try {
      markers = scope.querySelectorAll("input[type='hidden'][name^='add_option_']");
    } catch (error) {
      return;
    }

    for (var i = 0; i < markers.length; i += 1) {
      var row = getUploadFileIdAddOptionRowFromHidden(markers[i]);
      if (!row || row.closest && row.closest("#" + WIDGET_ID)) continue;
      row.hidden = false;
      row.style.display = "";
      row.style.visibility = "";
      row.style.position = "absolute";
      row.style.left = "-9999px";
      row.style.top = "auto";
      row.style.width = "1px";
      row.style.height = "1px";
      row.style.overflow = "hidden";
      row.style.opacity = "0";
      row.style.pointerEvents = "none";
      row.setAttribute("data-perpackage-upload-file-id-row", "visually-hidden");
    }
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

  function joinSelectors(selectors) {
    var result = [];

    for (var i = 0; i < selectors.length; i += 1) {
      var selector = String(selectors[i] || "").trim();
      if (selector) result.push(selector);
    }

    return result.join(", ");
  }

  function getOrderActionSelector() {
    return joinSelectors([
      CONFIG.orderActionSelector,
      CONFIG.buyButtonSelector || DEFAULT_BUY_BUTTON_SELECTOR,
      CONFIG.cartButtonSelector || DEFAULT_CART_BUTTON_SELECTOR,
      CONFIG.mobileOrderActionSelector,
      DEFAULT_ORDER_ACTION_SELECTOR
    ]);
  }

  function getSelectedProductSelector() {
    return joinSelectors([
      CONFIG.selectedProductSelector,
      "#totalProducts tbody.option_products > tr.option_product",
      "#totalProducts tbody.option_products tr",
      "#totalProducts tbody.add_products tr",
      "#totalProducts tbody tr",
      ".option_products tr",
      ".add_products tr",
      ".option_products li",
      ".add_products li"
    ]);
  }

  function getOptionBoxIdInput(element) {
    if (!element || !element.querySelector) return null;
    return element.querySelector('input.option_box_id[name="item_code[]"]');
  }

  function hasNonEmptyOptionBoxId(element) {
    var optionBoxIdInput = getOptionBoxIdInput(element);
    return !!(optionBoxIdInput && optionBoxIdInput.value && optionBoxIdInput.value.trim());
  }

  function requiresOptionBoxIdValidation(element) {
    if (!element || !element.matches) return false;
    return (
      element.matches("#totalProducts tbody.option_products > tr.option_product") ||
      element.matches("#totalProducts tbody.option_products tr") ||
      element.matches("#totalProducts tbody.add_products tr") ||
      element.matches("#totalProducts tbody tr") ||
      element.matches(".option_products tr") ||
      element.matches(".add_products tr")
    );
  }

  function looksLikeEmptySelectedProductRow(element) {
    if (!element) return true;

    var className = normalizeSearchText(element.className || "");
    if (className.indexOf("displaynone") !== -1 || className.indexOf("display-none") !== -1) return true;
    if (element.getAttribute && element.getAttribute("data-perpackage-removing") === "true") return true;

    if (requiresOptionBoxIdValidation(element)) {
      return !hasNonEmptyOptionBoxId(element);
    }

    var text = normalizeSearchText(element.textContent || "");
    if (!text && !element.querySelector("input:not([type='hidden']), select, textarea, button, a")) return true;
    if (text.indexOf("option_product_no") !== -1) return true;

    return false;
  }

  function isExactUploadFileIdLabel(value) {
    var expectedLabel = "\uc5c5\ub85c\ub4dc \ud30c\uc77c id";
    var text = normalizeSearchText(value);
    if (!text) return false;
    return text === expectedLabel || compactSearchText(text) === compactSearchText(expectedLabel);
  }

  function hasVisibleSelectedProductRow() {
    var selector = getSelectedProductSelector();
    if (!selector) return false;

    var rows;
    try {
      rows = document.querySelectorAll(selector);
    } catch (error) {
      return false;
    }

    for (var i = 0; i < rows.length; i += 1) {
      var row = rows[i];
      if (row.closest && row.closest("#" + WIDGET_ID)) continue;
      if (!isElementVisible(row)) continue;
      if (looksLikeEmptySelectedProductRow(row)) continue;
      return true;
    }

    return false;
  }

  function getConfirmedSelectedProductRows() {
    var rows;
    var confirmedRows = [];

    try {
      rows = document.querySelectorAll("#totalProducts tbody.option_products > tr.option_product");
    } catch (error) {
      return confirmedRows;
    }

    for (var i = 0; i < rows.length; i += 1) {
      var row = rows[i];
      if (row.closest && row.closest("#" + WIDGET_ID)) continue;
      if (row.getAttribute && row.getAttribute("data-perpackage-removing") === "true") continue;
      if (!isElementVisible(row)) continue;
      if (!hasNonEmptyOptionBoxId(row)) continue;
      confirmedRows.push(row);
    }

    return confirmedRows;
  }

  function findFileIdInputInSelectedProductRow(row) {
    if (!row || !row.querySelectorAll) return null;

    var markers = row.querySelectorAll("input[type='hidden'][name^='add_option_']");
    for (var i = 0; i < markers.length; i += 1) {
      var marker = markers[i];
      if (!isExactUploadFileIdLabel(marker.value || marker.getAttribute("value") || "")) continue;

      var field = findTextFieldForAddOptionHidden(marker);
      if (field) {
        return {
          element: field,
          source: "selected_row:exact_upload_file_id"
        };
      }
    }

    return null;
  }

  function findLatestSelectedProductFileIdInput() {
    var rows = getConfirmedSelectedProductRows();
    var latestRow = rows.length ? rows[rows.length - 1] : null;
    return findFileIdInputInSelectedProductRow(latestRow);
  }

  function isMatchInLatestSelectedProductRow(match) {
    if (!match || !match.element) return false;

    var rows = getConfirmedSelectedProductRows();
    var latestRow = rows.length ? rows[rows.length - 1] : null;
    return !!(latestRow && latestRow.contains(match.element));
  }

  function isStrictUploadFileIdInputMatch(match) {
    if (!isMatchInLatestSelectedProductRow(match)) return false;

    var row = match.element.closest && match.element.closest("tr");
    if (!row || !row.querySelectorAll) return false;

    var markers = row.querySelectorAll("input[type='hidden'][name^='add_option_']");
    for (var i = 0; i < markers.length; i += 1) {
      if (isExactUploadFileIdLabel(markers[i].value || markers[i].getAttribute("value") || "")) {
        return findTextFieldForAddOptionHidden(markers[i]) === match.element;
      }
    }

    return false;
  }

  function clearMisappliedFileIdFromSelectedProductRows(fileId, allowedElement) {
    if (!fileId) return;

    var rows = getConfirmedSelectedProductRows();
    for (var rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      var markers = rows[rowIndex].querySelectorAll("input[type='hidden'][name^='add_option_']");
      for (var markerIndex = 0; markerIndex < markers.length; markerIndex += 1) {
        var marker = markers[markerIndex];
        if (isExactUploadFileIdLabel(marker.value || marker.getAttribute("value") || "")) continue;

        var field = findTextFieldForAddOptionHidden(marker);
        if (!field || field === allowedElement) continue;
        if (String(field.value || "").trim() !== fileId) continue;

        setFieldValue(field, "");
        dispatchFieldEvent(field, "input");
        dispatchFieldEvent(field, "change");
        dispatchFieldEvent(field, "blur");
      }
    }
  }

  function applyFileIdToLatestSelectedProductInput(fileId, preferredMatch) {
    var safeMatch = findLatestSelectedProductFileIdInput() ||
      (isStrictUploadFileIdInputMatch(preferredMatch) ? preferredMatch : null);

    if (!safeMatch || !safeMatch.element) {
      return {
        status: "not_found",
        source: "no_latest_selected_row_upload_file_id"
      };
    }

    return applyFileIdToCafe24Input(fileId, safeMatch);
  }

  function clearSelectedProductRowFileId(row) {
    var match = findFileIdInputInSelectedProductRow(row);
    if (match && match.element) {
      clearFileIdInput(match);
    }
  }

  function getSelectedProductDeleteControl(row) {
    if (!row || !row.querySelector) return null;
    return row.querySelector([
      ".option_box_del",
      ".delete",
      "a.delete",
      "[id^='option_box'][id$='_del']"
    ].join(", "));
  }

  function removeSelectedProductRow(row) {
    if (row && row.setAttribute) {
      row.setAttribute("data-perpackage-removing", "true");
    }

    var deleteControl = getSelectedProductDeleteControl(row);
    if (deleteControl && typeof deleteControl.click === "function") {
      deleteControl.click();
      return "click";
    }

    if (row && row.parentNode) {
      row.parentNode.removeChild(row);
      return "remove";
    }

    return "none";
  }

  function keepOnlyLatestSelectedProductRow() {
    var rows = getConfirmedSelectedProductRows();
    if (rows.length <= 1) return false;

    for (var i = 0; i < rows.length - 1; i += 1) {
      clearSelectedProductRowFileId(rows[i]);
      removeSelectedProductRow(rows[i]);
    }

    return true;
  }

  function preventQuantityButtonClick(event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
  }

  function hideQuantityControls(row) {
    var controls = row.querySelectorAll([
      ".eProductQuantityUpClass",
      ".eProductQuantityDownClass",
      ".up",
      ".down",
      "[id$='_up']",
      "[id$='_down']"
    ].join(", "));

    for (var i = 0; i < controls.length; i += 1) {
      var control = controls[i];
      control.style.display = "none";
      control.setAttribute("aria-hidden", "true");
      control.setAttribute("tabindex", "-1");

      if (!control.__perpackageQuantityLockBound) {
        control.addEventListener("click", preventQuantityButtonClick, true);
        control.__perpackageQuantityLockBound = true;
      }
    }
  }

  function enforceSingleQuantityForSelectedProducts() {
    var rows = getConfirmedSelectedProductRows();

    for (var i = 0; i < rows.length; i += 1) {
      var row = rows[i];
      var quantityInput = row.querySelector("input.quantity_opt, input[name='quantity_opt[]']");
      if (!quantityInput) continue;

      quantityInput.readOnly = true;
      quantityInput.setAttribute("readonly", "readonly");
      quantityInput.setAttribute("aria-label", "주문 수량 1개 고정");

      if (String(quantityInput.value || "").trim() !== "1") {
        quantityInput.value = "1";
        quantityInput.defaultValue = "1";
        dispatchFieldEvent(quantityInput, "input");
        dispatchFieldEvent(quantityInput, "change");
        dispatchFieldEvent(quantityInput, "blur");
      }

      hideQuantityControls(row);
    }
  }

  function getTotalPriceState() {
    var selectors = joinSelectors([
      CONFIG.totalPriceSelector,
      "#totalPrice",
      ".totalPrice",
      ".total_price",
      ".total_price_box"
    ]);

    if (!selectors) return "unknown";

    var elements;
    try {
      elements = document.querySelectorAll(selectors);
    } catch (error) {
      return "unknown";
    }

    var foundVisibleTotal = false;
    var foundNumber = false;

    for (var i = 0; i < elements.length; i += 1) {
      var element = elements[i];
      if (!isElementVisible(element)) continue;
      foundVisibleTotal = true;

      var text = String(element.textContent || "").replace(/,/g, "");
      var matches = text.match(/\d+/g);
      if (!matches) continue;
      foundNumber = true;

      for (var j = 0; j < matches.length; j += 1) {
        if (Number(matches[j]) > 0) return "nonzero";
      }
    }

    if (foundVisibleTotal && foundNumber) return "zero";
    return "unknown";
  }

  function hasSelectedProductState() {
    if (!hasVisibleSelectedProductRow()) return false;
    return getTotalPriceState() !== "zero";
  }

  function isUploadReady(match) {
    return isFileIdInputUsable(match) && hasSelectedProductState();
  }

  function closestBySelector(target, selector) {
    if (!target || !target.closest || !selector) return null;

    try {
      return target.closest(selector);
    } catch (error) {
      return null;
    }
  }

  function findOrderActionElement(target) {
    var configuredAction = closestBySelector(target, getOrderActionSelector());
    if (configuredAction) return configuredAction;

    var actionElement = target && target.closest && target.closest("a, button, input[type='button'], input[type='submit']");
    if (!actionElement || !looksLikeOrderAction(actionElement)) return null;

    if (actionElement.closest && actionElement.closest(".xans-product-detail, #prdDetail, form[action*='basket']")) {
      return actionElement;
    }

    return null;
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

  function findFileIdInputByCafe24AddOption() {
    var hiddenFields = document.querySelectorAll("input[type='hidden'][name^='add_option_']");

    for (var i = 0; i < hiddenFields.length; i += 1) {
      var hiddenField = hiddenFields[i];
      if (hiddenField.closest && hiddenField.closest("#" + WIDGET_ID)) continue;
      if (!isExactUploadFileIdLabel(hiddenField.value || hiddenField.getAttribute("value") || "")) continue;

      var fieldInContainer = findTextFieldForAddOptionHidden(hiddenField);
      if (fieldInContainer) {
        return {
          element: fieldInContainer,
          source: "cafe24:exact_upload_file_id"
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
      findFileIdInputByCafe24AddOption() ||
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

  function applyFileIdToCafe24Input(fileId, preferredMatch) {
    if (!fileId) {
      return {
        status: "not_found",
        source: "missing_file_id"
      };
    }

    var match = isStrictUploadFileIdInputMatch(preferredMatch)
      ? preferredMatch
      : findLatestSelectedProductFileIdInput();
    if (!match || !match.element) {
      return {
        status: "not_found",
        source: "no_strict_upload_file_id_input"
      };
    }

    releaseFileIdInput(match);
    setFieldValue(match.element, fileId);
    dispatchFieldEvent(match.element, "input");
    dispatchFieldEvent(match.element, "change");
    dispatchFieldEvent(match.element, "blur");

    return {
      status: "success",
      source: match.source,
      element: match.element
    };
  }

  function getSelectedFileCount(fileInput) {
    return fileInput && fileInput.files ? fileInput.files.length : 0;
  }

  function getMultipleFilesMessage() {
    return "파일은 1개만 업로드 가능합니다. 여러 파일은 AI, PDF, EPS, JPG, PNG만 포함한 ZIP 1개로 압축해 업로드해 주세요.";
  }

  function getFileIdChangedMessage() {
    return "업로드 파일 ID가 변경되었거나 비어 있습니다. 파일 확인 및 주문 연결을 위해 업로드 완료 후 생성된 업로드 파일 ID는 수정하지 말아 주세요. 다시 파일을 업로드하거나 새로고침 후 다시 진행해 주세요.";
  }

  function makeFileIdInputReadonly(match, fileId) {
    if (!match || !match.element || !fileId) return;

    match.element.readOnly = true;
    match.element.setAttribute("readonly", "readonly");
    match.element.setAttribute("aria-readonly", "true");
    match.element.setAttribute("data-perpackage-file-id", fileId);
    match.element.title = "업로드 파일 ID는 파일 확인 및 주문 연결용 값입니다. 수정하지 말아 주세요.";
  }

  function releaseFileIdInput(match) {
    if (!match || !match.element) return;

    match.element.readOnly = false;
    match.element.removeAttribute("readonly");
    match.element.removeAttribute("aria-readonly");
    match.element.removeAttribute("data-perpackage-file-id");
  }

  function clearFileIdInput(match) {
    if (!match || !match.element) return;

    releaseFileIdInput(match);
    setFieldValue(match.element, "");
    dispatchFieldEvent(match.element, "input");
    dispatchFieldEvent(match.element, "change");
    dispatchFieldEvent(match.element, "blur");
  }

  function getCurrentFileIdValue(uploadState) {
    var element = uploadState && uploadState.fileIdInputMatch && uploadState.fileIdInputMatch.element;
    if (!element) return "";
    return String(element.value || "").trim();
  }

  function isFileIdInputValid(uploadState) {
    if (!uploadState || !uploadState.fileId) return true;
    return getCurrentFileIdValue(uploadState) === String(uploadState.fileId).trim();
  }

  function showFileIdChangedWarning(status, result) {
    status.className = "ppu-status ppu-warning";
    status.textContent = getFileIdChangedMessage();

    if (result && !result.hidden) {
      var existingWarning = result.querySelector(".ppu-file-id-warning");
      if (!existingWarning) {
        existingWarning = document.createElement("div");
        existingWarning.className = "ppu-file-id-warning";
        result.appendChild(existingWarning);
      }
      existingWarning.textContent = getFileIdChangedMessage();
    }
  }

  function watchFileIdInput(uploadState, status, result) {
    var element = uploadState && uploadState.fileIdInputMatch && uploadState.fileIdInputMatch.element;
    if (!element || element.getAttribute("data-perpackage-watch") === "1") return;

    element.setAttribute("data-perpackage-watch", "1");

    var validate = function () {
      var expectedFileId = String(element.getAttribute("data-perpackage-file-id") || "").trim();
      var currentFileId = String(element.value || "").trim();

      if (expectedFileId && currentFileId !== expectedFileId) {
        showFileIdChangedWarning(status, result);
      }
    };

    element.addEventListener("input", validate);
    element.addEventListener("change", validate);
    element.addEventListener("blur", validate);
  }

  function looksLikeOrderAction(element) {
    if (!element) return false;

    var text = [
      element.textContent,
      element.value,
      element.getAttribute && element.getAttribute("href"),
      element.getAttribute && element.getAttribute("onclick"),
      element.getAttribute && element.getAttribute("class"),
      element.getAttribute && element.getAttribute("id"),
      element.getAttribute && element.getAttribute("name")
    ].join(" ");
    var normalized = normalizeSearchText(text);

    if (normalized.indexOf("product_submit") !== -1) return true;

    return (
      normalized.indexOf("구매") !== -1 ||
      normalized.indexOf("주문") !== -1 ||
      normalized.indexOf("장바구니") !== -1 ||
      normalized.indexOf("buy") !== -1 ||
      normalized.indexOf("order") !== -1 ||
      normalized.indexOf("basket") !== -1 ||
      normalized.indexOf("cart") !== -1
    );
  }

  function isCartActionElement(element) {
    if (!element) return false;

    var text = [
      element.textContent,
      element.value,
      element.getAttribute && element.getAttribute("href"),
      element.getAttribute && element.getAttribute("onclick"),
      element.getAttribute && element.getAttribute("class"),
      element.getAttribute && element.getAttribute("id"),
      element.getAttribute && element.getAttribute("name")
    ].join(" ");
    var normalized = normalizeSearchText(text);

    return (
      normalized.indexOf("product_submit(2") !== -1 ||
      normalized.indexOf("basket") !== -1 ||
      normalized.indexOf("cart") !== -1 ||
      normalized.indexOf("\uc7a5\ubc14\uad6c\ub2c8") !== -1
    );
  }

  function elementTextContains(element, keywords) {
    var text = normalizeSearchText(element && element.textContent);
    if (!text) return false;

    for (var i = 0; i < keywords.length; i += 1) {
      if (text.indexOf(normalizeSearchText(keywords[i])) !== -1) return true;
    }

    return false;
  }

  function findCartSuccessLayer() {
    var selectors = [
      "#confirmLayer",
      "#confirm_layer",
      ".ec-base-layer",
      ".xans-product-basketadd",
      ".xans-product-addbasket",
      ".xans-order-layerbasketpackage",
      ".layerCart",
      ".basketLayer",
      "[id*='basket']",
      "[class*='basket']",
      "[id*='Basket']",
      "[class*='Basket']"
    ].join(", ");
    var layers;

    try {
      layers = document.querySelectorAll(selectors);
    } catch (error) {
      return null;
    }

    for (var i = 0; i < layers.length; i += 1) {
      var layer = layers[i];
      if (!isElementVisible(layer)) continue;

      var hasCartText = elementTextContains(layer, [
        "\uc7a5\ubc14\uad6c\ub2c8",
        "basket",
        "cart"
      ]);
      var hasSuccessAction = elementTextContains(layer, [
        "\uc1fc\ud551\uacc4\uc18d\ud558\uae30",
        "\uc7a5\ubc14\uad6c\ub2c8 \uc774\ub3d9",
        "\uad6c\ub9e4\ud558\uae30",
        "continue",
        "checkout"
      ]);

      if (hasCartText && hasSuccessAction) return layer;
    }

    return null;
  }

  function renderUploadResult(result, uploaded, fileId, cafe24InputResult) {
    var actions = [
      '<div class="ppu-actions">'
    ];

    if (cafe24InputResult.status !== "success") {
      actions.push('<button class="ppu-action" type="button" data-ppu-action="retry-file-id">업로드 파일 ID 다시 입력하기</button>');
    }

    actions.push('<button class="ppu-action" type="button" data-ppu-action="reset-upload">다시 업로드하기</button>');
    actions.push("</div>");

    result.hidden = false;
    result.innerHTML = [
      "<strong>업로드 정보</strong>",
      "<br>file_id: " + escapeHtml(fileId || "-"),
      "<br>original_filename: " + escapeHtml(uploaded.original_filename || "-"),
      "<br>status: " + escapeHtml(uploaded.status || "-"),
      "<br>Cafe24 입력 옵션 반영 여부: " + escapeHtml(cafe24InputResult.status),
      "<br>input source: " + escapeHtml(cafe24InputResult.source || "-"),
      actions.join("")
    ].join("");
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
    wrapper.hidden = true;
    wrapper.style.display = "none";
    wrapper.setAttribute("aria-hidden", "true");
    wrapper.innerHTML = [
      '<h3 class="ppu-title">인쇄파일 업로드</h3>',
      '<p class="ppu-desc">AI, PDF, EPS, ZIP 파일만 업로드할 수 있습니다. 최대 100MB까지 업로드할 수 있습니다.</p>',
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
    var currentUpload = null;

    result.addEventListener("click", function (event) {
      var actionButton = event.target && event.target.closest && event.target.closest("[data-ppu-action]");
      if (!actionButton) return;

      var action = actionButton.getAttribute("data-ppu-action");

      if (action === "retry-file-id") {
        if (!currentUpload || !currentUpload.fileId) {
          showMessage(status, result, "다시 입력할 업로드 파일 ID가 없습니다.", true);
          return;
        }

        var retryResult = applyFileIdToCafe24Input(currentUpload.fileId);
        currentUpload.cafe24InputResult = retryResult;

        if (retryResult.status === "success") {
          status.className = "ppu-status ppu-success";
          status.textContent = "업로드 파일 ID가 입력 옵션에 다시 반영되었습니다.";
          renderUploadResult(result, currentUpload.uploaded, currentUpload.fileId, retryResult);
        } else {
          status.className = "ppu-status ppu-warning";
          status.textContent = "상품 옵션을 먼저 선택한 뒤 다시 눌러주세요.";
          renderUploadResult(result, currentUpload.uploaded, currentUpload.fileId, retryResult);
        }
      }

      if (action === "reset-upload") {
        if (currentUpload && currentUpload.fileIdInputMatch) {
          releaseFileIdInput(currentUpload.fileIdInputMatch);
        }
        currentUpload = null;
        form.reset();
        fileInput.value = "";
        button.disabled = false;
        status.className = "ppu-status";
        status.textContent = "새 파일을 선택한 뒤 업로드해 주세요.";
        result.hidden = true;
        result.textContent = "";
      }
    });

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

      var fileIdInputMatch = currentUpload && currentUpload.fileIdInputMatch
        ? currentUpload.fileIdInputMatch
        : findFileIdInput();
      if (!fileIdInputMatch || !fileIdInputMatch.element) {
        status.className = "ppu-status ppu-warning";
        status.textContent = "먼저 상품 옵션을 선택해 주세요. 옵션 선택 후 파일 업로드를 진행할 수 있습니다.";
        result.hidden = true;
        result.textContent = "";
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
              throw new Error(json.message || "파일 용량이 너무 큽니다. 100MB 이하 파일만 업로드해 주세요.");
            }
            return json;
          });
        })
        .then(function (json) {
          var uploaded = json.file || {};
          var fileId = uploaded.id || json.id || "";
          var cafe24InputResult = applyFileIdToCafe24Input(fileId, fileIdInputMatch);
          currentUpload = {
            uploaded: uploaded,
            fileId: fileId,
            cafe24InputResult: cafe24InputResult
          };
          status.className = "ppu-status ppu-success";
          status.textContent = cafe24InputResult.status === "success"
            ? "업로드가 완료되었고 주문 연결용 파일 ID가 입력되었습니다."
            : "업로드가 완료되었습니다. 주문 연결용 입력 옵션은 찾지 못했습니다.";
          status.textContent = cafe24InputResult.status === "success"
            ? "파일 업로드가 완료되었습니다."
            : "파일 업로드가 완료되었습니다. 옵션 입력칸이 준비되면 업로드 파일 ID가 자동 입력됩니다.";
          renderUploadResult(result, uploaded, fileId, cafe24InputResult);
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

  function renderUploadResult(result, uploaded, fileId, cafe24InputResult) {
    var actions = [
      '<div class="ppu-actions">'
    ];

    if (cafe24InputResult.status !== "success") {
      actions.push('<button class="ppu-action" type="button" data-ppu-action="retry-file-id">업로드 파일 ID 다시 입력하기</button>');
    }

    actions.push('<button class="ppu-action" type="button" data-ppu-action="reset-upload">다시 업로드하기</button>');
    actions.push("</div>");

    result.hidden = false;
    result.innerHTML = [
      '<span class="ppu-result-title">파일 업로드가 완료되었습니다.</span>',
      "주문 시 업로드 파일 ID가 함께 전달됩니다.",
      '<span class="ppu-tracking">업로드 파일 ID: ' + escapeHtml(fileId || "-") + "</span>",
      '<span class="ppu-tracking">파일명: ' + escapeHtml(uploaded.original_filename || "-") + "</span>",
      '<span class="ppu-tracking">상태: ' + escapeHtml(uploaded.status || "-") + " / Cafe24 입력 옵션 반영: " + escapeHtml(cafe24InputResult.status) + "</span>",
      '<span class="ppu-tracking">input source: ' + escapeHtml(cafe24InputResult.source || "-") + "</span>",
      actions.join("")
    ].join("");
  }

  function renderWidget() {
    injectStyles();

    var wrapper = document.createElement("section");
    wrapper.id = WIDGET_ID;
    wrapper.setAttribute("aria-label", "Perpackage print file upload");
    wrapper.hidden = true;
    wrapper.style.display = "none";
    wrapper.setAttribute("aria-hidden", "true");
    wrapper.innerHTML = [
      '<h3 class="ppu-title">인쇄용 파일 업로드</h3>',
      '<p class="ppu-desc">AI, PDF, EPS, ZIP 파일만 업로드할 수 있습니다.</p>',
      '<p class="ppu-desc">파일 없이도 주문할 수 있습니다.</p>',
      '<p class="ppu-desc">최대 100MB까지 업로드할 수 있습니다.</p>',
      '<p class="ppu-desc">ZIP 안에는 AI, PDF, EPS, JPG, PNG 파일만 포함해 주세요.</p>',
      '<p class="ppu-option-gate" data-ppu-option-gate>파일 업로드는 선택사항입니다.</p>',
      '<form class="ppu-form">',
      '<div class="ppu-upload-controls" data-ppu-upload-controls>',
      '<label class="ppu-dropzone" data-ppu-dropzone>',
      '<span class="ppu-drop-title">파일을 선택하거나 이곳에 끌어다 놓으세요</span>',
      '<span class="ppu-drop-desc">AI, PDF, EPS, ZIP 파일 / 최대 100MB</span>',
      '<input class="ppu-file" name="file" type="file" required aria-label="인쇄용 파일 선택">',
      "</label>",
      '<button class="ppu-button" type="submit">파일 업로드</button>',
      "</div>",
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
    var optionGate = wrapper.querySelector("[data-ppu-option-gate]");
    var dropzone = wrapper.querySelector("[data-ppu-dropzone]");
    var appOrigin = getAppOrigin();
    var currentUpload = null;
    var lastFileIdInputMatch = null;
    var isUploading = false;
    var pendingDroppedFile = null;
    var availabilityTimers = [];
    var pendingApplyTimer = null;
    var lastSelectedProductReady = hasVisibleSelectedProductRow();
    var retainedCompletedUpload = null;
    var cartSuccessTimers = [];
    var cartReloadTimer = null;

    fileInput.removeAttribute("multiple");

    function clearAvailabilityTimers() {
      for (var i = 0; i < availabilityTimers.length; i += 1) {
        clearTimeout(availabilityTimers[i]);
      }
      availabilityTimers = [];
    }

    function clearCartSuccessTimers() {
      for (var i = 0; i < cartSuccessTimers.length; i += 1) {
        clearTimeout(cartSuccessTimers[i]);
      }
      cartSuccessTimers = [];
    }

    function scheduleReloadAfterCartSuccess() {
      if (cartReloadTimer) {
        clearTimeout(cartReloadTimer);
      }

      cartReloadTimer = setTimeout(function () {
        window.location.reload();
      }, 700);
    }

    function resetAfterCartSuccess() {
      var rows = getConfirmedSelectedProductRows();

      clearCartSuccessTimers();
      clearAvailabilityTimers();

      for (var i = 0; i < rows.length; i += 1) {
        clearSelectedProductRowFileId(rows[i]);
        removeSelectedProductRow(rows[i]);
      }

      if (pendingApplyTimer) {
        clearTimeout(pendingApplyTimer);
        pendingApplyTimer = null;
      }

      retainedCompletedUpload = null;
      currentUpload = null;
      lastFileIdInputMatch = null;
      pendingDroppedFile = null;
      lastSelectedProductReady = false;
      isUploading = false;

      form.reset();
      fileInput.value = "";
      fileInput.disabled = true;
      button.disabled = true;
      status.className = "ppu-status";
      status.textContent = "";
      result.hidden = true;
      result.textContent = "";

      wrapper.hidden = true;
      wrapper.style.display = "none";
      wrapper.setAttribute("aria-hidden", "true");
      wrapper.classList.remove("ppu-is-ready");

      setTimeout(function () {
        refreshUploadAvailability();
      }, 150);

      scheduleReloadAfterCartSuccess();
    }

    function scheduleCartSuccessReset() {
      var delays = [450, 900, 1400, 2200, 3200];

      clearCartSuccessTimers();

      for (var i = 0; i < delays.length; i += 1) {
        cartSuccessTimers.push(setTimeout(function () {
          if (!findCartSuccessLayer()) return;
          resetAfterCartSuccess();
        }, delays[i]));
      }
    }

    function setUploadAvailability(match) {
      var isReady = isUploadReady(match);

      wrapper.classList.toggle("ppu-is-ready", isReady);
      fileInput.disabled = !isReady || isUploading;
      button.disabled = !isReady || isUploading;

      if (optionGate) {
        optionGate.textContent = isReady
          ? "상품 옵션이 선택되었습니다. 파일을 선택하거나 끌어다 놓으면 자동으로 업로드됩니다."
          : "상품 옵션을 먼저 선택해 주세요. 옵션 선택 후 파일 업로드 영역이 활성화됩니다.";
      }

      if (isReady) {
        lastFileIdInputMatch = match;
      }

      return isReady;
    }

    function clearUploadStateBecauseOptionNotReady(match) {
      var fieldToClear = currentUpload && currentUpload.fileIdInputMatch
        ? currentUpload.fileIdInputMatch
        : (lastFileIdInputMatch || match);

      if (fieldToClear && fieldToClear.element && document.documentElement.contains(fieldToClear.element)) {
        clearFileIdInput(fieldToClear);
      }

      currentUpload = null;
      lastFileIdInputMatch = null;
      pendingDroppedFile = null;
      if (pendingApplyTimer) {
        clearTimeout(pendingApplyTimer);
        pendingApplyTimer = null;
      }
      fileInput.value = "";
      result.hidden = true;
      result.textContent = "";
    }

    function clearUploadStateBecauseSelectedProductChanged(match) {
      var fieldToClear = currentUpload && currentUpload.fileIdInputMatch
        ? currentUpload.fileIdInputMatch
        : (lastFileIdInputMatch || match);

      if (fieldToClear && fieldToClear.element && document.documentElement.contains(fieldToClear.element)) {
        clearFileIdInput(fieldToClear);
      }

      currentUpload = null;
      lastFileIdInputMatch = null;
      pendingDroppedFile = null;
      if (pendingApplyTimer) {
        clearTimeout(pendingApplyTimer);
        pendingApplyTimer = null;
      }
      fileInput.value = "";
      result.hidden = true;
      result.textContent = "";
    }

    function retainCompletedUpload(uploadState) {
      if (!uploadState || !uploadState.fileId) return;

      retainedCompletedUpload = {
        uploaded: uploadState.uploaded || {},
        fileId: uploadState.fileId,
        cafe24InputResult: uploadState.cafe24InputResult || { status: "not_found", source: "retained_upload" },
        fileIdInputMatch: uploadState.fileIdInputMatch || null
      };
    }

    function restoreCurrentUploadFromRetained(match, syncResult) {
      if (!retainedCompletedUpload || !retainedCompletedUpload.fileId) return null;

      currentUpload = {
        uploaded: retainedCompletedUpload.uploaded || {},
        fileId: retainedCompletedUpload.fileId,
        cafe24InputResult: syncResult || retainedCompletedUpload.cafe24InputResult,
        fileIdInputMatch: match || retainedCompletedUpload.fileIdInputMatch || null
      };

      return currentUpload;
    }

    function refreshUploadAvailability() {
      var knownMatch = currentUpload && currentUpload.fileIdInputMatch
        ? currentUpload.fileIdInputMatch
        : lastFileIdInputMatch;
      var match = findFileIdInput();

      if (!isUploadReady(match) && knownMatch && knownMatch.element && document.documentElement.contains(knownMatch.element)) {
        match = knownMatch;
      }

      if (setUploadAvailability(match)) {
        return match;
      }

      clearUploadStateBecauseOptionNotReady(match);
      return null;
    }

    function scheduleUploadAvailabilityRefresh() {
      var delays = [120, 300];

      clearAvailabilityTimers();

      for (var j = 0; j < delays.length; j += 1) {
        availabilityTimers.push(setTimeout(function () {
          refreshUploadAvailability();
        }, delays[j]));
      }
    }

    function shouldRefreshForUploadAvailabilityEvent(target) {
      if (!target || !target.closest) return false;
      if (target.closest("#" + WIDGET_ID)) return false;
      return !!target.closest([
        "#totalProducts",
        ".xans-product-option",
        ".option_products",
        ".add_products",
        ".option_box_del",
        "[id^='option_box'][id$='_del']"
      ].join(", "));
    }

    function shouldIgnoreUploadAvailabilityMutation(mutations) {
      for (var i = 0; i < mutations.length; i += 1) {
        var target = mutations[i].target;
        if (target && target.closest && !target.closest("#" + WIDGET_ID)) {
          return false;
        }
      }

      return true;
    }

    setUploadAvailability = function (match) {
      var hasSelectedRow = hasVisibleSelectedProductRow();
      var removedExtraRows = false;

      if (hasSelectedRow) {
        removedExtraRows = keepOnlyLatestSelectedProductRow();
        if (removedExtraRows) {
          clearUploadStateBecauseSelectedProductChanged(match);
          match = findLatestSelectedProductFileIdInput();
          hasSelectedRow = hasVisibleSelectedProductRow();
          scheduleUploadAvailabilityRefresh();
        }
      }

      if (hasSelectedRow) {
        hideUploadFileIdAddOptionRows(document.querySelector("#totalProducts"));
        match = findLatestSelectedProductFileIdInput() || (isMatchInLatestSelectedProductRow(match) ? match : null);
      } else {
        match = null;
      }

      wrapper.hidden = !hasSelectedRow;
      wrapper.style.display = hasSelectedRow ? "" : "none";
      wrapper.setAttribute("aria-hidden", hasSelectedRow ? "false" : "true");
      wrapper.classList.toggle("ppu-is-ready", hasSelectedRow);
      fileInput.disabled = !hasSelectedRow || isUploading;
      button.disabled = !hasSelectedRow || isUploading;

      if (hasSelectedRow) {
        enforceSingleQuantityForSelectedProducts();
      }

      if (optionGate) {
        optionGate.textContent = hasSelectedRow
          ? "파일 업로드는 선택사항입니다."
          : "상품 옵션을 선택하면 파일 업로드 영역이 표시됩니다.";
      }

      if (match && match.element) {
        lastFileIdInputMatch = match;
      }

      return match || null;
    };

    function syncCurrentUploadToCafe24Input(match) {
      if (!currentUpload || !currentUpload.fileId) return null;
      if (currentUpload.fileIdInputMatch && isFileIdInputValid(currentUpload)) {
        return currentUpload.fileIdInputMatch;
      }

      var preferredMatch = findLatestSelectedProductFileIdInput() ||
        (isMatchInLatestSelectedProductRow(match) ? match : null) ||
        (isMatchInLatestSelectedProductRow(currentUpload.fileIdInputMatch) ? currentUpload.fileIdInputMatch : null) ||
        (isMatchInLatestSelectedProductRow(lastFileIdInputMatch) ? lastFileIdInputMatch : null);
      if (!preferredMatch) return null;
      var syncResult = applyFileIdToLatestSelectedProductInput(currentUpload.fileId, preferredMatch);
      currentUpload.cafe24InputResult = syncResult;

      if (syncResult.status !== "success") {
        return null;
      }

      currentUpload.fileIdInputMatch = {
        element: syncResult.element || (preferredMatch && preferredMatch.element),
        source: syncResult.source
      };
      lastFileIdInputMatch = currentUpload.fileIdInputMatch;
      makeFileIdInputReadonly(currentUpload.fileIdInputMatch, currentUpload.fileId);
      watchFileIdInput(currentUpload, status, result);
      clearMisappliedFileIdFromSelectedProductRows(currentUpload.fileId, currentUpload.fileIdInputMatch.element);

      if (!result.hidden) {
        status.className = "ppu-status ppu-success";
        status.textContent = "업로드 파일 ID가 주문 옵션 입력칸에 반영되었습니다.";
        renderUploadResult(result, currentUpload.uploaded, currentUpload.fileId, syncResult);
      }

      return currentUpload.fileIdInputMatch;
    }

    function syncRetainedUploadToCafe24Input(match) {
      if (!retainedCompletedUpload || !retainedCompletedUpload.fileId) return null;
      if (!hasVisibleSelectedProductRow()) return null;

      var selectedRows = getConfirmedSelectedProductRows();
      var latestRow = selectedRows.length ? selectedRows[selectedRows.length - 1] : null;
      var rowMatch = findFileIdInputInSelectedProductRow(latestRow);
      var preferredMatch = rowMatch || (
        match && match.element && latestRow && latestRow.contains(match.element)
          ? match
          : null
      );
      if (!preferredMatch || !preferredMatch.element) return null;

      var syncResult;
      if (String(preferredMatch.element.value || "").trim() === retainedCompletedUpload.fileId) {
        syncResult = {
          status: "success",
          source: preferredMatch.source,
          element: preferredMatch.element
        };
      } else {
        syncResult = applyFileIdToLatestSelectedProductInput(retainedCompletedUpload.fileId, preferredMatch);
      }

      if (syncResult.status !== "success") return null;

      var restoredMatch = {
        element: syncResult.element || preferredMatch.element,
        source: syncResult.source || preferredMatch.source
      };
      retainedCompletedUpload.cafe24InputResult = syncResult;
      retainedCompletedUpload.fileIdInputMatch = restoredMatch;
      restoreCurrentUploadFromRetained(restoredMatch, syncResult);
      lastFileIdInputMatch = restoredMatch;
      makeFileIdInputReadonly(restoredMatch, retainedCompletedUpload.fileId);
      watchFileIdInput(currentUpload, status, result);
      clearMisappliedFileIdFromSelectedProductRows(retainedCompletedUpload.fileId, restoredMatch.element);

      if (!result.hidden) {
        status.className = "ppu-status ppu-success";
        status.textContent = "업로드 파일 ID가 주문 옵션 입력칸에 반영되었습니다.";
        renderUploadResult(result, currentUpload.uploaded, currentUpload.fileId, syncResult);
      }

      return restoredMatch;
    }

    refreshUploadAvailability = function () {
      var match = findLatestSelectedProductFileIdInput() || findFileIdInput();
      var hasSelectedRow = hasVisibleSelectedProductRow();
      var safeMatch = setUploadAvailability(match);

      if (!hasSelectedRow) {
        if (lastSelectedProductReady || currentUpload || pendingDroppedFile) {
          clearUploadStateBecauseOptionNotReady(match);
        }
        lastSelectedProductReady = false;
        return null;
      }

      lastSelectedProductReady = true;
      if (hasSelectedRow) {
        if (retainedCompletedUpload && retainedCompletedUpload.fileId) {
          syncRetainedUploadToCafe24Input(safeMatch);
        } else {
          syncCurrentUploadToCafe24Input(safeMatch);
        }
      }
      return safeMatch || (isMatchInLatestSelectedProductRow(lastFileIdInputMatch) ? lastFileIdInputMatch : null);
    };

    function schedulePendingFileIdApply() {
      if (pendingApplyTimer) {
        clearTimeout(pendingApplyTimer);
      }

      pendingApplyTimer = setTimeout(function () {
        pendingApplyTimer = null;
        refreshUploadAvailability();
      }, 250);
    }

    function reinforceFileIdBeforeOrderAction(match) {
      var sourceUpload = currentUpload && currentUpload.fileId
        ? currentUpload
        : retainedCompletedUpload;

      if (!sourceUpload || !sourceUpload.fileId) return null;
      if (!hasVisibleSelectedProductRow()) return null;

      var preferredMatch = findLatestSelectedProductFileIdInput() ||
        (isMatchInLatestSelectedProductRow(match) ? match : null) ||
        (isMatchInLatestSelectedProductRow(sourceUpload.fileIdInputMatch) ? sourceUpload.fileIdInputMatch : null) ||
        (isMatchInLatestSelectedProductRow(lastFileIdInputMatch) ? lastFileIdInputMatch : null);

      if (!preferredMatch || !preferredMatch.element) return null;

      var syncResult = applyFileIdToLatestSelectedProductInput(sourceUpload.fileId, preferredMatch);
      if (syncResult.status !== "success") return null;

      var reinforcedMatch = {
        element: syncResult.element || preferredMatch.element,
        source: syncResult.source || preferredMatch.source
      };

      currentUpload = {
        uploaded: sourceUpload.uploaded || {},
        fileId: sourceUpload.fileId,
        cafe24InputResult: syncResult,
        fileIdInputMatch: reinforcedMatch
      };
      lastFileIdInputMatch = reinforcedMatch;
      makeFileIdInputReadonly(reinforcedMatch, sourceUpload.fileId);
      watchFileIdInput(currentUpload, status, result);
      clearMisappliedFileIdFromSelectedProductRows(sourceUpload.fileId, reinforcedMatch.element);
      retainCompletedUpload(currentUpload);

      return reinforcedMatch;
    }

    refreshUploadAvailability();

    if (window.MutationObserver) {
      var uploadAvailabilityObserveTarget = document.querySelector("#totalProducts");
      if (uploadAvailabilityObserveTarget) {
        var optionObserver = new MutationObserver(function (mutations) {
          if (shouldIgnoreUploadAvailabilityMutation(mutations)) return;
          scheduleUploadAvailabilityRefresh();
        });
        optionObserver.observe(uploadAvailabilityObserveTarget, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["class", "style", "disabled", "value", "selected", "hidden", "aria-hidden"]
        });
      }
    }

    ["click", "change", "input"].forEach(function (eventName) {
      document.addEventListener(eventName, function (event) {
        if (!shouldRefreshForUploadAvailabilityEvent(event.target)) return;
        scheduleUploadAvailabilityRefresh();
      }, true);
    });

    function submitUploadForm() {
      var submitEvent;

      if (typeof Event === "function") {
        submitEvent = new Event("submit", { bubbles: true, cancelable: true });
      } else {
        submitEvent = document.createEvent("Event");
        submitEvent.initEvent("submit", true, true);
      }

      form.dispatchEvent(submitEvent);
    }

    function clearPreviousUploadForNewAttempt() {
      var fieldToClear = currentUpload && currentUpload.fileIdInputMatch
        ? currentUpload.fileIdInputMatch
        : lastFileIdInputMatch;

      if (fieldToClear && fieldToClear.element && document.documentElement.contains(fieldToClear.element)) {
        clearFileIdInput(fieldToClear);
        lastFileIdInputMatch = fieldToClear;
      }

      currentUpload = null;
      if (pendingApplyTimer) {
        clearTimeout(pendingApplyTimer);
        pendingApplyTimer = null;
      }
      result.hidden = true;
      result.textContent = "";
    }

    result.addEventListener("click", function (event) {
      var actionButton = event.target && event.target.closest && event.target.closest("[data-ppu-action]");
      if (!actionButton) return;

      var action = actionButton.getAttribute("data-ppu-action");

      if (action === "retry-file-id") {
        if (!currentUpload || !currentUpload.fileId) {
          showMessage(status, result, "다시 입력할 업로드 파일 ID가 없습니다.", true);
          return;
        }

        var retryResult = applyFileIdToLatestSelectedProductInput(currentUpload.fileId, currentUpload.fileIdInputMatch);
        currentUpload.cafe24InputResult = retryResult;
        currentUpload.fileIdInputMatch = retryResult.status === "success"
          ? {
            element: retryResult.element || (currentUpload.fileIdInputMatch && currentUpload.fileIdInputMatch.element),
            source: retryResult.source
          }
          : currentUpload.fileIdInputMatch;
        if (retryResult.status === "success") {
          lastFileIdInputMatch = currentUpload.fileIdInputMatch;
        }

        if (retryResult.status === "success") {
          makeFileIdInputReadonly(currentUpload.fileIdInputMatch, currentUpload.fileId);
          watchFileIdInput(currentUpload, status, result);
          clearMisappliedFileIdFromSelectedProductRows(currentUpload.fileId, currentUpload.fileIdInputMatch.element);
          retainCompletedUpload(currentUpload);
          status.className = "ppu-status ppu-success";
          status.textContent = "업로드 파일 ID가 입력 옵션에 다시 반영되었습니다.";
          renderUploadResult(result, currentUpload.uploaded, currentUpload.fileId, retryResult);
        } else {
          status.className = "ppu-status ppu-warning";
          status.textContent = "주문 옵션 입력칸이 준비되면 업로드 파일 ID가 자동 반영됩니다. 필요하면 잠시 후 다시 눌러주세요.";
          renderUploadResult(result, currentUpload.uploaded, currentUpload.fileId, retryResult);
        }
      }

      if (action === "reset-upload") {
        var fieldToClear = currentUpload && currentUpload.fileIdInputMatch
          ? currentUpload.fileIdInputMatch
          : lastFileIdInputMatch;
        clearFileIdInput(fieldToClear);
        lastFileIdInputMatch = fieldToClear;
        currentUpload = null;
        retainedCompletedUpload = null;
        pendingDroppedFile = null;
        form.reset();
        fileInput.value = "";
        status.className = "ppu-status";
        status.textContent = "새 파일을 선택한 뒤 업로드 버튼을 눌러주세요.";
        result.hidden = true;
        result.textContent = "";
        refreshUploadAvailability();
      }
    });

    fileInput.addEventListener("change", function () {
      if (getSelectedFileCount(fileInput) > 1) {
        fileInput.value = "";
        showMessage(status, result, getMultipleFilesMessage(), true);
        return;
      }

      if (fileInput.files && fileInput.files[0]) {
        clearPreviousUploadForNewAttempt();
        submitUploadForm();
      }
    });

    if (dropzone) {
      ["dragenter", "dragover"].forEach(function (eventName) {
        dropzone.addEventListener(eventName, function (event) {
          event.preventDefault();
          event.stopPropagation();

          if (fileInput.disabled) {
            return;
          }

          dropzone.classList.add("ppu-is-dragover");
        });
      });

      ["dragleave", "dragend", "drop"].forEach(function (eventName) {
        dropzone.addEventListener(eventName, function () {
          dropzone.classList.remove("ppu-is-dragover");
        });
      });

      dropzone.addEventListener("drop", function (event) {
        event.preventDefault();
        event.stopPropagation();

        refreshUploadAvailability();

        if (isUploading) {
          showMessage(status, result, "파일을 업로드하는 중입니다. 잠시만 기다려 주세요.", true);
          return;
        }

        var files = event.dataTransfer && event.dataTransfer.files;
        if (!files || !files.length) return;

        if (files.length > 1) {
          fileInput.value = "";
          pendingDroppedFile = null;
          showMessage(status, result, getMultipleFilesMessage(), true);
          return;
        }

        clearPreviousUploadForNewAttempt();
        pendingDroppedFile = files[0];
        submitUploadForm();
      });
    }

    document.addEventListener("click", function (event) {
      var actionElement = findOrderActionElement(event.target);
      if (!actionElement) return;
      var isCartAction = isCartActionElement(actionElement);

      if (isUploading) {
        event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) event.stopImmediatePropagation();

        showMessage(status, result, "파일을 업로드하는 중입니다. 업로드가 완료된 뒤 구매하기 또는 장바구니를 진행해 주세요.", true);
        return;
      }

      refreshUploadAvailability();
      reinforceFileIdBeforeOrderAction(lastFileIdInputMatch);

      // File upload is optional; allow order actions unless an uploaded file_id was changed to another non-empty value.
      if (!currentUpload || !currentUpload.fileId) {
        if (isCartAction) scheduleCartSuccessReset();
        return;
      }
      if (!getCurrentFileIdValue(currentUpload)) {
        if (isCartAction) scheduleCartSuccessReset();
        return;
      }
      if (isFileIdInputValid(currentUpload)) {
        if (isCartAction) scheduleCartSuccessReset();
        return;
      }

      if (currentUpload && currentUpload.fileId) {
        event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) event.stopImmediatePropagation();

        showFileIdChangedWarning(status, result);
        return;
      }

      showMessage(status, result, "파일 업로드를 먼저 완료해 주세요. 업로드 완료 후 생성된 업로드 파일 ID가 입력되어야 구매하기 또는 장바구니를 진행할 수 있습니다.", true);
    }, true);

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      if (isUploading) {
        showMessage(status, result, "파일을 업로드하는 중입니다. 잠시만 기다려 주세요.", true);
        return;
      }

      if (getSelectedFileCount(fileInput) > 1) {
        fileInput.value = "";
        pendingDroppedFile = null;
        showMessage(status, result, getMultipleFilesMessage(), true);
        return;
      }

      var file = pendingDroppedFile || (fileInput.files && fileInput.files[0]);
      if (!file) {
        showMessage(status, result, "업로드할 파일을 선택해 주세요.", true);
        return;
      }

      if (!appOrigin) {
        showMessage(status, result, "업로드 서버 주소를 확인할 수 없습니다.", true);
        return;
      }

      var fileIdInputMatch = refreshUploadAvailability();

      var formData = new FormData();
      formData.append("file", file);
      formData.append("mall_id", resolveMallId());
      formData.append("shop_no", resolveShopNo());
      formData.append("product_no", resolveProductNo());
      formData.append("customer_type", "cafe24-product-detail");
      formData.append("customer_identifier", window.location.href);

      button.disabled = true;
      status.className = "ppu-status";
      status.textContent = "파일을 업로드하는 중입니다. 잠시만 기다려 주세요.";
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
              throw new Error(json.message || "파일 용량이 너무 큽니다. 100MB 이하 파일만 업로드해 주세요.");
            }
            return json;
          });
        })
        .then(function (json) {
          var uploaded = json.file || {};
          var fileId = uploaded.id || json.id || "";
          var cafe24InputResult = applyFileIdToLatestSelectedProductInput(fileId, fileIdInputMatch);
          currentUpload = {
            uploaded: uploaded,
            fileId: fileId,
            cafe24InputResult: cafe24InputResult,
            fileIdInputMatch: cafe24InputResult.status === "success"
              ? {
                element: cafe24InputResult.element || fileIdInputMatch.element,
                source: cafe24InputResult.source
              }
              : null
          };
          if (cafe24InputResult.status === "success") {
            lastFileIdInputMatch = currentUpload.fileIdInputMatch;
            makeFileIdInputReadonly(currentUpload.fileIdInputMatch, fileId);
            watchFileIdInput(currentUpload, status, result);
            clearMisappliedFileIdFromSelectedProductRows(fileId, currentUpload.fileIdInputMatch.element);
          } else {
            schedulePendingFileIdApply();
            setTimeout(schedulePendingFileIdApply, 800);
            setTimeout(schedulePendingFileIdApply, 1500);
            setTimeout(schedulePendingFileIdApply, 3000);
          }
          retainCompletedUpload(currentUpload);
          status.className = "ppu-status ppu-success";
          status.textContent = cafe24InputResult.status === "success"
            ? "파일 업로드가 완료되었습니다. 주문 시 업로드 파일 ID가 함께 전달됩니다."
            : "파일 업로드가 완료되었습니다. 주문 옵션 입력칸이 준비되면 업로드 파일 ID가 자동 입력됩니다.";
          renderUploadResult(result, uploaded, fileId, cafe24InputResult);
          form.reset();
          pendingDroppedFile = null;
        })
        .catch(function (error) {
          pendingDroppedFile = null;
          showMessage(
            status,
            result,
            error && error.message ? error.message : "파일 업로드에 실패했습니다. 다시 시도해 주세요.",
            true
          );
        })
        .finally(function () {
          isUploading = false;
          refreshUploadAvailability();
        });
    });

    applyEditorFileIdFromUrl();

    function applyEditorFileIdFromUrl() {
      var editorFileId = "";
      try {
        editorFileId = String(new URLSearchParams(window.location.search).get("perpackage_file_id") || "").trim();
      } catch (error) {
        return;
      }
      if (!editorFileId || !/^[0-9a-zA-Z-]{8,64}$/.test(editorFileId)) return;

      var tryApply = function () {
        if (currentUpload && currentUpload.fileId && isUploadReady(currentUpload.fileIdInputMatch)) return true;

        var match = refreshUploadAvailability();
        if (!match || !match.element) return false;

        var applied = applyFileIdToLatestSelectedProductInput(editorFileId, match);
        if (applied.status !== "success") return false;

        var editorUpload = {
          uploaded: { original_filename: "전개도 에디터 디자인 파일", status: "uploaded_pending" },
          fileId: editorFileId,
          cafe24InputResult: applied,
          fileIdInputMatch: {
            element: applied.element || match.element,
            source: applied.source
          }
        };
        currentUpload = editorUpload;
        retainCompletedUpload(editorUpload);
        lastFileIdInputMatch = editorUpload.fileIdInputMatch;
        makeFileIdInputReadonly(editorUpload.fileIdInputMatch, editorFileId);
        watchFileIdInput(editorUpload, status, result);
        clearMisappliedFileIdFromSelectedProductRows(editorFileId, editorUpload.fileIdInputMatch.element);
        status.className = "ppu-status ppu-success";
        status.textContent = "전개도 에디터에서 업로드한 파일 ID가 입력 옵션에 자동 입력되었습니다. 이 값은 수정하지 말아 주세요.";
        return true;
      };

      if (tryApply()) return;

      status.className = "ppu-status";
      status.textContent = "전개도 에디터 디자인 파일 ID를 확인했습니다. 상품 옵션을 선택하면 자동으로 입력됩니다.";

      var attempts = 0;
      var timer = setInterval(function () {
        attempts += 1;
        if (tryApply() || attempts >= 40) {
          clearInterval(timer);
          if (attempts >= 40 && !(currentUpload && currentUpload.fileId)) {
            status.className = "ppu-status ppu-warning";
            status.textContent = "업로드 파일 ID 입력칸을 찾지 못했습니다. 상품 옵션을 선택한 뒤, 에디터에서 복사한 업로드 파일 ID를 직접 붙여넣어 주세요.";
          }
        }
      }, 1500);
    }
  }

  function renderUploadResult(result, uploaded, fileId, cafe24InputResult) {
    var actions = [
      '<div class="ppu-actions">'
    ];

    if (cafe24InputResult.status !== "success") {
      actions.push('<button class="ppu-action" type="button" data-ppu-action="retry-file-id">업로드 파일 ID 다시 입력하기</button>');
    }

    actions.push('<button class="ppu-action" type="button" data-ppu-action="reset-upload">다시 업로드하기</button>');
    actions.push("</div>");

    result.hidden = false;
    result.innerHTML = [
      '<span class="ppu-result-title">파일 업로드가 완료되었습니다.</span>',
      "주문 시 업로드 파일 ID가 함께 전달됩니다.",
      '<span class="ppu-tracking">업로드 파일 ID: ' + escapeHtml(fileId || "-") + "</span>",
      '<span class="ppu-tracking">파일명: ' + escapeHtml(uploaded.original_filename || "-") + "</span>",
      actions.join("")
    ].join("");
  }

  function renderWidget() {
    injectStyles();

    if (document.getElementById(WIDGET_ID)) return;

    var wrapper = document.createElement("section");
    wrapper.id = WIDGET_ID;
    wrapper.setAttribute("aria-label", "Perpackage print file upload");
    wrapper.hidden = true;
    wrapper.style.display = "none";
    wrapper.setAttribute("aria-hidden", "true");
    wrapper.innerHTML = [
      '<h3 class="ppu-title">인쇄용 파일 업로드</h3>',
      '<p class="ppu-desc">AI, PDF, EPS, ZIP 파일만 업로드할 수 있습니다.</p>',
      '<p class="ppu-desc">파일 없이도 주문할 수 있습니다.</p>',
      '<p class="ppu-desc">최대 100MB까지 업로드할 수 있습니다.</p>',
      '<p class="ppu-desc">ZIP 안에는 AI, PDF, EPS, JPG, PNG 파일만 포함해 주세요.</p>',
      '<p class="ppu-option-gate" data-ppu-option-gate>파일 업로드는 선택사항입니다.</p>',
      '<form class="ppu-form">',
      '<div class="ppu-upload-controls" data-ppu-upload-controls>',
      '<label class="ppu-dropzone" data-ppu-dropzone>',
      '<span class="ppu-drop-title">파일을 선택하거나 이곳에 끌어다 놓으세요</span>',
      '<span class="ppu-drop-desc">AI, PDF, EPS, ZIP 파일 / 최대 100MB</span>',
      '<input class="ppu-file" name="file" type="file" required aria-label="인쇄용 파일 선택">',
      "</label>",
      '<button class="ppu-button" type="submit">파일 업로드</button>',
      "</div>",
      '<p class="ppu-status" role="status"></p>',
      '<div class="ppu-result" hidden></div>',
      "</form>"
    ].join("");

    var target = findInsertTarget();
    target.appendChild(wrapper);
    bindForm(wrapper);
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
