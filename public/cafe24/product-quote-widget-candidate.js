(function () {
  "use strict";

  var ROOT_ID = "perpackage-quote-widget-root";
  var WIDGET_ID = "perpackage-product-quote-widget";
  var STYLE_ID = "perpackage-product-quote-widget-style";
  var CONFIG = window.PERPACKAGE_QUOTE_CONFIG || {};
  var DEFAULT_APP_ORIGIN = "https://perpackage-cafe24-file-upload-app.vercel.app";
  var priceRequestTimer = null;
  var currentPriceRequest = null;

  function getRoot() {
    if (CONFIG.targetSelector) {
      var configuredTarget = document.querySelector(String(CONFIG.targetSelector));
      if (configuredTarget && configuredTarget.id === ROOT_ID) {
        return configuredTarget;
      }
    }

    return document.getElementById(ROOT_ID);
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
        return DEFAULT_APP_ORIGIN;
      }
    }

    return DEFAULT_APP_ORIGIN;
  }

  function getCafe24ProductNo() {
    var configuredProductNo = String(CONFIG.cafe24ProductNo || "").trim();
    if (configuredProductNo) return configuredProductNo;

    var queryProductNo = new URLSearchParams(window.location.search).get("product_no");
    if (queryProductNo) return String(queryProductNo).trim();

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

    var globalCandidates = [
      window.iProductNo,
      window.product_no,
      window.productNo,
      window.CAFE24 && window.CAFE24.PRODUCT_NO
    ];
    for (var j = 0; j < globalCandidates.length; j += 1) {
      if (globalCandidates[j]) return String(globalCandidates[j]).trim();
    }

    return "";
  }

  function getProductCode(root) {
    var directCode = CONFIG.productCode || (root && root.getAttribute("data-product-code"));
    if (directCode) return String(directCode).trim().toUpperCase();

    var productMap = CONFIG.productMap;
    var productNo = getCafe24ProductNo();
    if (
      productMap &&
      productNo &&
      Object.prototype.hasOwnProperty.call(productMap, productNo)
    ) {
      return String(productMap[productNo] || "").trim().toUpperCase();
    }

    return "";
  }

  function findAutoInsertTarget() {
    var selectors = [
      "#totalProducts",
      ".buy-scroll-box .infoArea",
      ".xans-product-detail .infoArea",
      ".buy-scroll-box"
    ];
    for (var i = 0; i < selectors.length; i += 1) {
      var target = document.querySelector(selectors[i]);
      if (target) return target;
    }
    return null;
  }

  function getOrCreateRoot() {
    var existingRoot = getRoot();
    if (existingRoot) return existingRoot;

    if (!CONFIG.productMap || !getProductCode(null)) return null;
    var insertTarget = findAutoInsertTarget();
    if (!insertTarget) return null;

    var root = document.createElement("div");
    root.id = ROOT_ID;
    insertTarget.insertAdjacentElement("afterend", root);
    return root;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      "#" + WIDGET_ID + "{margin:18px 0;padding:18px;border:1px solid #d7dce6;border-radius:8px;background:#fff;color:#19213a;font-family:inherit;box-sizing:border-box}",
      "#" + WIDGET_ID + " *{box-sizing:border-box}",
      "#" + WIDGET_ID + " .ppq-eyebrow{margin:0 0 6px;color:#31549b;font-size:11px;font-weight:700;letter-spacing:0}",
      "#" + WIDGET_ID + " .ppq-title{margin:0;color:#15213b;font-size:19px;line-height:1.35}",
      "#" + WIDGET_ID + " .ppq-description{margin:8px 0 0;color:#5d6780;font-size:13px;line-height:1.6}",
      "#" + WIDGET_ID + " .ppq-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:18px}",
      "#" + WIDGET_ID + " .ppq-field{min-width:0}",
      "#" + WIDGET_ID + " .ppq-field-wide{grid-column:1/-1}",
      "#" + WIDGET_ID + " .ppq-label{display:block;margin-bottom:7px;color:#27334f;font-size:13px;font-weight:700}",
      "#" + WIDGET_ID + " .ppq-select{width:100%;height:42px;padding:0 34px 0 12px;border:1px solid #c9d2e2;border-radius:6px;background:#fff;color:#19213a;font:inherit;font-size:13px}",
      "#" + WIDGET_ID + " .ppq-select:focus{outline:2px solid #b9c9ec;outline-offset:1px;border-color:#31549b}",
      "#" + WIDGET_ID + " .ppq-choice-list{display:flex;flex-wrap:wrap;gap:7px}",
      "#" + WIDGET_ID + " .ppq-choice{min-width:72px;padding:9px 11px;border:1px solid #c9d2e2;border-radius:6px;background:#fff;color:#33415e;font:inherit;font-size:13px;line-height:1.2;cursor:pointer}",
      "#" + WIDGET_ID + " .ppq-choice:hover{border-color:#31549b;color:#173b84}",
      "#" + WIDGET_ID + " .ppq-choice[aria-pressed='true']{border-color:#31549b;background:#31549b;color:#fff;font-weight:700}",
      "#" + WIDGET_ID + " .ppq-finish-note{margin:0;color:#5d6780;font-size:12px;line-height:1.55}",
      "#" + WIDGET_ID + " .ppq-price{display:flex;justify-content:space-between;gap:18px;align-items:flex-end;margin-top:18px;padding:15px 0 0;border-top:1px solid #e2e6ee}",
      "#" + WIDGET_ID + " .ppq-price-label{margin:0;color:#495772;font-size:13px;font-weight:700}",
      "#" + WIDGET_ID + " .ppq-price-note{margin:5px 0 0;color:#69748a;font-size:12px}",
      "#" + WIDGET_ID + " .ppq-price-value{margin:0;color:#15213b;font-size:24px;font-weight:800;line-height:1.15;text-align:right}",
      "#" + WIDGET_ID + " .ppq-unit-price{margin:6px 0 0;color:#5d6780;font-size:12px;text-align:right}",
      "#" + WIDGET_ID + " .ppq-message{min-height:19px;margin:10px 0 0;color:#5d6780;font-size:12px;line-height:1.55}",
      "#" + WIDGET_ID + " .ppq-message.ppq-error{color:#b42318}",
      "@media (max-width:560px){#" + WIDGET_ID + "{padding:15px}#" + WIDGET_ID + " .ppq-form{grid-template-columns:1fr}#" + WIDGET_ID + " .ppq-price{align-items:flex-start;flex-direction:column}#" + WIDGET_ID + " .ppq-price-value,#" + WIDGET_ID + " .ppq-unit-price{text-align:left}}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function createElement(tagName, className, text) {
    var element = document.createElement(tagName);
    if (className) element.className = className;
    if (typeof text === "string") element.textContent = text;
    return element;
  }

  function formatWon(value) {
    return Number(value || 0).toLocaleString("ko-KR") + "원";
  }

  function clearElement(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  function createSelectField(label, className) {
    var field = createElement("div", "ppq-field");
    var labelElement = createElement("label", "ppq-label", label);
    var select = createElement("select", "ppq-select " + className);
    labelElement.htmlFor = className;
    select.id = className;
    field.appendChild(labelElement);
    field.appendChild(select);
    return { field: field, select: select };
  }

  function setSelectOptions(select, items, getValue, getLabel) {
    clearElement(select);
    items.forEach(function (item) {
      var option = document.createElement("option");
      option.value = String(getValue(item));
      option.textContent = String(getLabel(item));
      select.appendChild(option);
    });
  }

  function setMessage(messageElement, message, isError) {
    messageElement.textContent = message || "";
    messageElement.className = isError ? "ppq-message ppq-error" : "ppq-message";
  }

  function selectedChoiceValue(container) {
    var selected = container.querySelector("button[aria-pressed='true']");
    return selected ? selected.getAttribute("data-value") || "" : "";
  }

  function renderChoices(container, items, getValue, getLabel, onChange) {
    clearElement(container);
    items.forEach(function (item, index) {
      var button = createElement("button", "ppq-choice", getLabel(item));
      button.type = "button";
      button.setAttribute("data-value", String(getValue(item)));
      button.setAttribute("aria-pressed", index === 0 ? "true" : "false");
      button.addEventListener("click", function () {
        Array.prototype.forEach.call(container.querySelectorAll("button"), function (choice) {
          choice.setAttribute("aria-pressed", choice === button ? "true" : "false");
        });
        onChange();
      });
      container.appendChild(button);
    });
  }

  function requestJson(url, options) {
    return window.fetch(url, options).then(function (response) {
      return response.json().catch(function () {
        return {};
      }).then(function (body) {
        if (!response.ok || !body.ok) {
          throw new Error(body.message || "견적 정보를 확인할 수 없습니다.");
        }
        return body;
      });
    });
  }

  function buildWidget(root, options, appOrigin) {
    injectStyles();
    clearElement(root);
    root.style.display = "";

    var widget = createElement("section", "", "");
    widget.id = WIDGET_ID;
    widget.setAttribute("aria-label", "자동 견적 옵션");
    widget.appendChild(createElement("p", "ppq-eyebrow", "AUTOMATIC QUOTE"));
    widget.appendChild(createElement("h3", "ppq-title", options.product.name + " 견적"));
    widget.appendChild(
      createElement("p", "ppq-description", "규격과 사양을 선택하면 부가세 포함 예상 금액을 바로 확인할 수 있습니다.")
    );

    var form = createElement("div", "ppq-form");
    var sizeField = createSelectField("사이즈", "ppq-size");
    var materialField = createSelectField("종이", "ppq-material");
    var quantityField = createElement("div", "ppq-field ppq-field-wide");
    quantityField.appendChild(createElement("p", "ppq-label", "수량"));
    var quantityChoices = createElement("div", "ppq-choice-list");
    quantityField.appendChild(quantityChoices);
    var printField = createElement("div", "ppq-field ppq-field-wide");
    printField.appendChild(createElement("p", "ppq-label", "인쇄"));
    var printChoices = createElement("div", "ppq-choice-list");
    printField.appendChild(printChoices);
    var finishField = createElement("div", "ppq-field ppq-field-wide");
    finishField.appendChild(createElement("p", "ppq-label", "후가공"));
    finishField.appendChild(createElement("p", "ppq-finish-note", "현재 테스트 단계에서는 무후가공 기준으로만 금액을 표시합니다."));
    form.appendChild(sizeField.field);
    form.appendChild(materialField.field);
    form.appendChild(quantityField);
    form.appendChild(printField);
    form.appendChild(finishField);
    widget.appendChild(form);

    var price = createElement("div", "ppq-price");
    var priceText = createElement("div", "");
    priceText.appendChild(createElement("p", "ppq-price-label", "예상 결제 금액"));
    priceText.appendChild(createElement("p", "ppq-price-note", "부가세 포함 · 배송비 및 별도 작업은 제외"));
    var priceNumbers = createElement("div", "");
    var priceValue = createElement("p", "ppq-price-value", "가격 확인 중");
    var unitPrice = createElement("p", "ppq-unit-price", "");
    priceNumbers.appendChild(priceValue);
    priceNumbers.appendChild(unitPrice);
    price.appendChild(priceText);
    price.appendChild(priceNumbers);
    widget.appendChild(price);
    var message = createElement("p", "ppq-message", "");
    widget.appendChild(message);
    root.appendChild(widget);

    setSelectOptions(sizeField.select, options.sizes, function (size) {
      return size.code;
    }, function (size) {
      return size.label + " mm";
    });

    function setMaterialsForSize() {
      var sizeCode = sizeField.select.value;
      var selectedSize = options.sizes.find(function (size) {
        return size.code === sizeCode;
      });
      var allowedCodes = selectedSize ? selectedSize.allowed_material_codes : [];
      var materials = options.materials.filter(function (material) {
        return allowedCodes.indexOf(material.code) !== -1;
      });
      setSelectOptions(materialField.select, materials, function (material) {
        return material.code;
      }, function (material) {
        return material.label;
      });
    }

    var finishOption = options.finish_options.find(function (option) {
      return option.code === "none";
    });
    var finishCode = finishOption ? finishOption.code : "";
    setMaterialsForSize();
    renderChoices(quantityChoices, options.quantities, function (quantity) {
      return quantity;
    }, function (quantity) {
      return Number(quantity).toLocaleString("ko-KR") + "개";
    }, schedulePriceRequest);
    renderChoices(printChoices, options.print_options, function (option) {
      return option.code;
    }, function (option) {
      return option.label;
    }, schedulePriceRequest);

    sizeField.select.addEventListener("change", function () {
      setMaterialsForSize();
      schedulePriceRequest();
    });
    materialField.select.addEventListener("change", schedulePriceRequest);

    function schedulePriceRequest() {
      if (priceRequestTimer) {
        window.clearTimeout(priceRequestTimer);
      }
      priceRequestTimer = window.setTimeout(loadPrice, 160);
    }

    function loadPrice() {
      if (!finishCode) {
        priceValue.textContent = "가격 확인 불가";
        unitPrice.textContent = "";
        setMessage(message, "현재 선택한 사양의 가격을 확인할 수 없습니다.", true);
        return;
      }

      if (currentPriceRequest) {
        currentPriceRequest.abort();
      }
      currentPriceRequest = new AbortController();
      priceValue.textContent = "가격 확인 중";
      unitPrice.textContent = "";
      setMessage(message, "", false);

      requestJson(appOrigin + "/api/quotes/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: currentPriceRequest.signal,
        body: JSON.stringify({
          product_code: options.product.code,
          size_code: sizeField.select.value,
          material_code: materialField.select.value,
          quantity: Number(selectedChoiceValue(quantityChoices)),
          print_option_code: selectedChoiceValue(printChoices),
          finish_option_code: finishCode
        })
      }).then(function (response) {
        priceValue.textContent = formatWon(response.price.vat_inclusive_price);
        unitPrice.textContent = "개당 " + formatWon(response.price.unit_price);
      }).catch(function (error) {
        if (error && error.name === "AbortError") return;
        priceValue.textContent = "가격 확인 불가";
        unitPrice.textContent = "";
        setMessage(message, error && error.message ? error.message : "가격을 확인할 수 없습니다.", true);
      });
    }

    loadPrice();
  }

  function hideRoot(root) {
    clearElement(root);
    root.style.display = "none";
  }

  function initialize() {
    var root = getOrCreateRoot();
    if (!root || document.getElementById(WIDGET_ID)) return;

    var productCode = getProductCode(root);
    if (!/^[A-Z0-9_]{3,64}$/.test(productCode)) {
      hideRoot(root);
      return;
    }

    var appOrigin = getAppOrigin();
    requestJson(appOrigin + "/api/quotes/products/" + encodeURIComponent(productCode) + "/options", {
      method: "GET",
      headers: { Accept: "application/json" }
    }).then(function (options) {
      if (!options.sizes || !options.sizes.length || !options.materials || !options.materials.length) {
        hideRoot(root);
        return;
      }
      buildWidget(root, options, appOrigin);
    }).catch(function () {
      hideRoot(root);
    });
  }

  initialize();
})();
