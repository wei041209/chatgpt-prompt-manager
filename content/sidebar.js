/* content/sidebar.js */
(function () {
  "use strict";

  function init() {
    if (window.__PM_SIDEBAR_INITIALIZED__) return;
    window.__PM_SIDEBAR_INITIALIZED__ = true;

    const root = document.getElementById("pm-sidebar-root");
    const sidebar = document.getElementById("pm-sidebar");
    const hoverZone = document.getElementById("pm-hover-zone");
    const toggleBtn = document.getElementById("pm-toggle-button");
    const listEl = document.getElementById("pm-prompt-list");
    const emptyEl = document.getElementById("pm-empty-state");
    const searchInput = document.getElementById("pm-search-input");
    const titleInput = document.getElementById("pm-title-input");
    const textInput = document.getElementById("pm-text-input");
    const saveBtn = document.getElementById("pm-save-btn");

    if (
      !root ||
      !sidebar ||
      !hoverZone ||
      !toggleBtn ||
      !listEl ||
      !emptyEl ||
      !searchInput ||
      !titleInput ||
      !textInput ||
      !saveBtn
    ) {
      return;
    }

    let isPinned = false;
    let closeTimeout = null;
    let isSaving = false;

    function openSidebar() {
      sidebar.classList.add("pm-open");
      hideEdgeHint();
    }

    function closeSidebar() {
      sidebar.classList.remove("pm-open");
    }

    function isOpen() {
      return sidebar.classList.contains("pm-open");
    }

    function scheduleClose() {
      if (closeTimeout) clearTimeout(closeTimeout);

      closeTimeout = setTimeout(function () {
        closeTimeout = null;
        if (!isPinned) closeSidebar();
      }, 220);
    }

    function cancelClose() {
      if (closeTimeout) {
        clearTimeout(closeTimeout);
        closeTimeout = null;
      }
    }

    /* edge hint */
    let edgeHint = document.getElementById("pm-edge-hint");
    if (!edgeHint) {
      edgeHint = document.createElement("div");
      edgeHint.id = "pm-edge-hint";
      edgeHint.className = "pm-edge-hint";
      edgeHint.style.pointerEvents = "none";
      root.appendChild(edgeHint);
    }

    function showEdgeHint() {
      if (!edgeHint || isOpen()) return;
      edgeHint.classList.add("visible");
    }

    function hideEdgeHint() {
      if (!edgeHint) return;
      edgeHint.classList.remove("visible");
    }

    async function getPrompts() {
      if (Array.isArray(cachedPrompts)) {
        return cachedPrompts;
      }

      try {
        const result = await chrome.storage.local.get(STORAGE_KEY);
        let prompts = result[STORAGE_KEY];

        if (!Array.isArray(prompts) || prompts.length === 0) {
          prompts = [...DEFAULT_PROMPTS];
          await chrome.storage.local.set({ [STORAGE_KEY]: prompts });
        } else {
          let changed = false;

          prompts = prompts.map(function (prompt) {
            const nextPrompt = { ...prompt };

            if (!nextPrompt.type) {
              if (String(nextPrompt.id || "").indexOf("tpl_") === 0) {
                nextPrompt.type = "template";
              } else {
                nextPrompt.type = "saved";
              }
              changed = true;
            }

            return nextPrompt;
          });

          if (changed) {
            await chrome.storage.local.set({ [STORAGE_KEY]: prompts });
          }
        }

        cachedPrompts = prompts;
        return cachedPrompts;
      } catch (err) {
        console.warn("[Prompt Manager] getPrompts error:", err);
        cachedPrompts = [...DEFAULT_PROMPTS];
        return cachedPrompts;
      }
    }

    async function reloadAndRender() {
      try {
        const prompts = await getPrompts();
        renderPrompts(prompts, searchInput.value);
      } catch (err) {
        console.error("[PromptManager] failed to reload prompts", err);
      }
    }

    /* only hint on edge hover */
    hoverZone.addEventListener("pointerenter", function () {
      cancelClose();
      if (!isOpen()) showEdgeHint();
    });

    hoverZone.addEventListener("pointerleave", function () {
      if (!isOpen()) hideEdgeHint();
    });

    /* actual open happens on Prompts tab hover */
    toggleBtn.addEventListener("pointerenter", function () {
      cancelClose();
      openSidebar();
    });

    /* click = pin / unpin */
    toggleBtn.addEventListener("click", function () {
      if (isOpen() && isPinned) {
        isPinned = false;
        closeSidebar();
        return;
      }

      openSidebar();
      isPinned = true;
    });

    sidebar.addEventListener("pointerenter", function () {
      cancelClose();
      hideEdgeHint();
    });

    sidebar.addEventListener("pointerleave", function () {
      if (!isPinned) {
        scheduleClose();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && isOpen() && !isPinned) {
        closeSidebar();
        hideEdgeHint();
      }
    });

    function renderPrompts(prompts, searchTerm) {
      const term = (searchTerm || "").toLowerCase().trim();
      const filtered = term
        ? prompts.filter(function (p) {
          return (
            (p.title || "").toLowerCase().includes(term) ||
            (p.text || "").toLowerCase().includes(term)
          );
        })
        : prompts;

      listEl.innerHTML = "";

      if (filtered.length === 0) {
        emptyEl.textContent = prompts.length === 0
          ? "No saved prompts yet"
          : "No matching prompts found";
        emptyEl.style.display = "block";
      } else {
        emptyEl.style.display = "none";
      }

      filtered.forEach(function (prompt) {
        const li = document.createElement("li");
        li.className = "pm-prompt-item";
        li.dataset.id = prompt.id;

        const title = document.createElement("div");
        title.className = "pm-prompt-item-title";

        const titleText = document.createElement("span");
        titleText.textContent = prompt.title || "Untitled";

        title.appendChild(titleText);

        if (prompt.type === "template") {
          const badge = document.createElement("span");
          badge.className = "pm-badge";
          badge.textContent = "Template";
          title.appendChild(badge);
        } else {
          const badge = document.createElement("span");
          badge.className = "pm-badge pm-badge-saved";
          badge.textContent = "Saved";
          title.appendChild(badge);
        }

        const text = document.createElement("div");
        text.className = "pm-prompt-item-text";
        text.textContent = (prompt.text || "").slice(0, 80);

        const actions = document.createElement("div");
        actions.className = "pm-prompt-item-actions";

        const copyBtn = document.createElement("button");
        copyBtn.type = "button";
        copyBtn.className = "pm-btn pm-btn-copy";
        copyBtn.textContent = "Copy";

        copyBtn.addEventListener("click", async function () {
          try {
            await navigator.clipboard.writeText(prompt.text || "");

            const original = copyBtn.textContent;
            copyBtn.textContent = "Copied ✓";

            setTimeout(() => {
              copyBtn.textContent = original;
            }, 800);

          } catch (err) {
            console.error("[PromptManager] copy failed", err);
          }
        });

        const insertBtn = document.createElement("button");
        insertBtn.type = "button";
        insertBtn.className = "pm-btn pm-btn-insert";
        insertBtn.textContent = "Insert";
        insertBtn.addEventListener("click", function () {
          try {
            insertBtn.classList.remove("pm-insert-success");
            li.classList.remove("pm-card-highlight");

            void insertBtn.offsetWidth;

            insertBtn.classList.add("pm-insert-success");
            li.classList.add("pm-card-highlight");

            let inserted = false;

            /* Append-mode insert: preserves existing input, adds two newlines then prompt */
            if (typeof window.pmInsertIntoInput === "function") {
              inserted = window.pmInsertIntoInput(prompt.text || "");
            }

            setTimeout(function () {
              insertBtn.classList.remove("pm-insert-success");
              li.classList.remove("pm-card-highlight");

              if (inserted && !isPinned) {
                scheduleClose();
              }
            }, 420);
          } catch (err) {
            console.error("[PromptManager] insert failed", err);
          }
        });

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "pm-btn pm-btn-delete";
        deleteBtn.textContent = "Delete";
        deleteBtn.addEventListener("click", async function () {
          try {
            if (!confirm("Delete this prompt?")) return;
            await deletePrompt(prompt.id);
            await reloadAndRender();
          } catch (err) {
            console.error("[PromptManager] delete failed", err);
          }
        });

        actions.appendChild(insertBtn);
        actions.appendChild(copyBtn);

        if (prompt.type !== "template") {
          actions.appendChild(deleteBtn);
        }
        li.appendChild(title);
        li.appendChild(text);
        li.appendChild(actions);
        listEl.appendChild(li);
      });
    }

    searchInput.addEventListener("input", async function () {
      await reloadAndRender();
    });

    saveBtn.addEventListener("click", async function () {
      const title = (titleInput.value || "").trim();
      const text = (textInput.value || "").trim();

      if (!text || isSaving) return;

      isSaving = true;

      const originalText = saveBtn.textContent;
      saveBtn.textContent = "Saving...";
      saveBtn.disabled = true;

      try {
        const prompt = {
          id: generateId(),
          title: title || "Untitled",
          text: text,
          createdAt: Date.now(),
        };

        await savePrompt(prompt);

        titleInput.value = "";
        textInput.value = "";

        await reloadAndRender();

        saveBtn.textContent = "Saved ✓";

        setTimeout(() => {
          saveBtn.textContent = originalText;
          saveBtn.disabled = false;
          isSaving = false;
        }, 800);

      } catch (err) {
        console.error("[PromptManager] save failed", err);

        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
        isSaving = false;
      }
    });

    (async function loadAndRender() {
      await reloadAndRender();
    })();
  }

  document.addEventListener("pm-sidebar-ready", init);
  if (window.__pmSidebarReady) init();
})();