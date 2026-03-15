/* content/content.js */
(function () {
  "use strict";

  if (window.__PM_CONTENT_INITIALIZED__) return;
  window.__PM_CONTENT_INITIALIZED__ = true;

  var themeObserver = null;
  var themeDebounceTimer = null;

  function detectHostTheme() {
    var htmlClass = String(document.documentElement.className || "").toLowerCase();

    if (htmlClass.indexOf("dark") !== -1) return "dark";
    if (htmlClass.indexOf("light") !== -1) return "light";

    try {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch (e) {
      return "light";
    }
  }

  function applySidebarTheme() {
    var root = document.getElementById("pm-sidebar-root");
    if (!root) return;

    var nextTheme = detectHostTheme();
    var currentTheme = root.getAttribute("data-theme");

    if (currentTheme !== nextTheme) {
      root.setAttribute("data-theme", nextTheme);
    }
  }

  function scheduleApplySidebarTheme() {
    if (themeDebounceTimer) {
      clearTimeout(themeDebounceTimer);
    }

    themeDebounceTimer = setTimeout(function () {
      themeDebounceTimer = null;
      applySidebarTheme();
    }, 80);
  }

  function startThemeSync() {
    if (themeObserver) return;

    applySidebarTheme();

    themeObserver = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        if (mutations[i].attributeName === "class") {
          scheduleApplySidebarTheme();
          break;
        }
      }
    });

    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"]
    });
  }

  function injectSidebar() {
    try {
      if (document.getElementById("pm-sidebar")) return;

      var root = createSidebarRoot();

      applySidebarTheme();
      startThemeSync();

      if (!document.getElementById("pm-sidebar-css")) {
        var link = document.createElement("link");
        link.id = "pm-sidebar-css";
        link.rel = "stylesheet";
        link.href = chrome.runtime.getURL("content/sidebar.css");
        (document.head || document.documentElement).appendChild(link);
      }

      window.pmInsertIntoInput = function (text) {
        var input = findChatGPTInput();
        if (!input) {
          alert("ChatGPT input not found");
          return false;
        }
        return insertTextIntoInput(input, text);
      };

      var sidebarUrl = chrome.runtime.getURL("content/sidebar.html");

      fetch(sidebarUrl)
        .then(function (response) {
          if (!response.ok) {
            throw new Error("sidebar.html fetch failed with status " + response.status);
          }
          return response.text();
        })
        .then(function (html) {
          if (!html || !html.trim()) {
            throw new Error("sidebar.html empty");
          }

          if (document.getElementById("pm-sidebar")) return;

          root.innerHTML = html;

          /* prevent first-render animation flash */
          var sidebar = document.getElementById("pm-sidebar");
          if (sidebar) {
            sidebar.style.transition = "none";
          }

          applySidebarTheme();

          window.__pmSidebarReady = true;
          document.dispatchEvent(new CustomEvent("pm-sidebar-ready"));

          /* restore animation next frame */
          requestAnimationFrame(function () {
            var sidebar = document.getElementById("pm-sidebar");
            if (sidebar) sidebar.style.transition = "";
          });
        })
        .catch(function (err) {
          console.error("[PromptManager] inject failed (sidebar.html)", err);

          if (!document.getElementById("pm-sidebar")) {
            var fallback =
              '<div class="pm-hover-zone" id="pm-hover-zone"></div>' +
              '<div class="pm-sidebar pm-open" id="pm-sidebar">' +
              '<button type="button" class="pm-toggle-button" id="pm-toggle-button">Prompts</button>' +
              '<div class="pm-sidebar-inner">' +
              '<header class="pm-header"><h2 class="pm-title">Prompt Manager</h2></header>' +
              '<div style="padding:16px;">Sidebar fallback loaded</div>' +
              "</div></div>";

            root.innerHTML = fallback;
            applySidebarTheme();

            window.__pmSidebarReady = true;
            document.dispatchEvent(new CustomEvent("pm-sidebar-ready"));
          }
        });
    } catch (err) {
      console.error("[PromptManager] inject failed", err);
    }
  }

  function isVisible(el) {
    if (!el) return false;

    try {
      var rect = el.getBoundingClientRect();
      return rect && rect.width > 0 && rect.height > 0;
    } catch (_) {
      return false;
    }
  }

  function findReadyInput() {
    try {
      var helperEl = typeof findChatGPTInput === "function" ? findChatGPTInput() : null;
      if (helperEl) return helperEl;
    } catch (_) { }

    var selectors = [
      'textarea[data-id="root"]',
      "form textarea",
      "textarea",
      'div[contenteditable="true"]'
    ];

    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el && isVisible(el)) return el;
    }

    return null;
  }

  function waitForChatGPTUI() {
    var startedAt = Date.now();
    var INTERVAL_MS = 120;
    var TIMEOUT_MS = 15000;

    var timer = setInterval(function () {
      try {
        if (document.getElementById("pm-sidebar")) {
          clearInterval(timer);
          startThemeSync();
          return;
        }

        var input = findReadyInput();
        if (input) {
          clearInterval(timer);
          injectSidebar();
          return;
        }

        if (Date.now() - startedAt > TIMEOUT_MS) {
          clearInterval(timer);
          console.warn("[PromptManager] UI not ready (timeout); not injecting.");
        }
      } catch (err) {
        clearInterval(timer);
        console.error("[PromptManager] wait failed", err);
      }
    }, INTERVAL_MS);
  }

  waitForChatGPTUI();
})();