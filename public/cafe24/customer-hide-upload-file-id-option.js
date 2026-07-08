(function () {
  "use strict";

  var UPLOAD_FILE_ID_PATTERN = /업로드\s*파일\s*ID/;
  var OTHER_OPTION_PATTERN = /(지류|사이즈|수량|인쇄추가|후가공|컬러지)/;
  var CUSTOMER_OPTION_SELECTOR = "li,p,dd,dt,span,em,strong,small,td,div";
  var HIDDEN_MARK = "data-perpackage-upload-file-id-hidden";
  var CLEANED_MARK = "data-perpackage-upload-file-id-cleaned";

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function containsUploadFileId(text) {
    return UPLOAD_FILE_ID_PATTERN.test(String(text || ""));
  }

  function removeUploadFileIdSegments(text) {
    return String(text || "")
      .replace(/\s*,\s*\[\s*업로드\s*파일\s*ID\s*[:：][^\]]*\]\s*/g, " ")
      .replace(/\[\s*업로드\s*파일\s*ID\s*[:：][^\]]*\]\s*/g, " ")
      .replace(/\s*,\s*\(\s*업로드\s*파일\s*ID\s*[:：][^\)]*\)\s*/g, " ")
      .replace(/\(\s*업로드\s*파일\s*ID\s*[:：][^\)]*\)\s*/g, " ")
      .replace(/\s*\/\s*업로드\s*파일\s*ID\s*[:：]\s*[0-9a-fA-F-]{8,80}\s*/g, " ")
      .replace(/\s*\/\s*업로드\s*파일\s*ID\s*[:：]\s*[^\s\]\)]{8,120}\s*/g, " ")
      .replace(/업로드\s*파일\s*ID\s*[:：]\s*[0-9a-fA-F-]{8,80}\s*/g, " ")
      .replace(/업로드\s*파일\s*ID\s*[:：]\s*[^\s\]\)]{8,120}\s*/g, " ")
      .replace(/\s+,/g, ",")
      .replace(/,\s*$/g, "")
      .replace(/\s{2,}/g, " ");
  }

  function isIgnoredElement(element) {
    return Boolean(
      !element ||
        element.closest("script,style,template,noscript") ||
        element.closest("input,textarea,select,button") ||
        element.closest("#app-perpackage-product-upload")
    );
  }

  function getDepth(element) {
    var depth = 0;
    var node = element;

    while (node && node.parentElement) {
      depth += 1;
      node = node.parentElement;
    }

    return depth;
  }

  function hideElement(element) {
    if (!element || element.getAttribute(HIDDEN_MARK) === "1") {
      return;
    }

    element.style.display = "none";
    element.setAttribute(HIDDEN_MARK, "1");
  }

  function cleanUploadFileIdTextNodes(root) {
    if (!root) {
      return;
    }

    var nodes = [];
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!containsUploadFileId(node.nodeValue)) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      },
    });
    var current = walker.nextNode();

    while (current) {
      nodes.push(current);
      current = walker.nextNode();
    }

    nodes.forEach(function (node) {
      node.nodeValue = removeUploadFileIdSegments(node.nodeValue);
    });

    if (nodes.length > 0) {
      root.setAttribute(CLEANED_MARK, "1");
    }
  }

  function shouldHideWholeElement(element, text) {
    var normalized = normalizeText(text);

    if (!normalized || !containsUploadFileId(normalized)) {
      return false;
    }

    if (OTHER_OPTION_PATTERN.test(normalized)) {
      return false;
    }

    return !normalizeText(removeUploadFileIdSegments(normalized));
  }

  function handleOptionElement(element) {
    if (isIgnoredElement(element)) {
      return;
    }

    var text = normalizeText(element.textContent);

    if (!containsUploadFileId(text)) {
      return;
    }

    if (shouldHideWholeElement(element, text)) {
      hideElement(element);
      return;
    }

    cleanUploadFileIdTextNodes(element);

    if (!normalizeText(element.textContent)) {
      hideElement(element);
    }
  }

  function hideUploadFileIdOptionText() {
    var elements = Array.prototype.slice.call(document.querySelectorAll(CUSTOMER_OPTION_SELECTOR));

    elements
      .sort(function (a, b) {
        return getDepth(b) - getDepth(a);
      })
      .forEach(handleOptionElement);
  }

  hideUploadFileIdOptionText();
  window.setTimeout(hideUploadFileIdOptionText, 300);
  window.setTimeout(hideUploadFileIdOptionText, 1000);
})();
