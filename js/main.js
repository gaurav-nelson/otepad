const STORAGE_KEY = "otepad.pads";
const LEGACY_CONTENT_KEY = "content";
const THEME_KEY = "theme";

// Set initial theme before DOMContentLoaded
(function () {
  const storedTheme =
    localStorage.getItem(THEME_KEY) ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", storedTheme);
})();

document.addEventListener("DOMContentLoaded", function () {
  const surfaceView = document.getElementById("surfaceView");
  const editorView = document.getElementById("editorView");
  const padGrid = document.getElementById("padGrid");
  const editDiv = document.getElementById("editable");
  const padTitleEl = document.getElementById("padTitle");
  const padTitleInput = document.getElementById("padTitleInput");
  const addPadBtn = document.getElementById("addPad");
  const backBtn = document.getElementById("backToSurface");
  const deleteBtn = document.getElementById("deleteContent");
  const themeBtn = document.getElementById("toggleTheme");
  const confirmDialog = document.getElementById("confirmDialog");
  const confirmDialogMessage = document.getElementById("confirmDialogMessage");
  const confirmDialogCancel = document.getElementById("confirmDialogCancel");
  const confirmDialogConfirm = document.getElementById("confirmDialogConfirm");

  let store = { version: 1, pads: [] };
  let activePadId = null;
  let titleBeforeEdit = "";
  let isEditingTitle = false;
  let confirmResolver = null;
  let lastFocusBeforeConfirm = null;
  const TITLE_MAX_LENGTH = 60;
  const canStore = storageAvailable("localStorage");

  editDiv.contentEditable = true;

  editDiv.addEventListener("paste", function (e) {
    if (e.shiftKey) {
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      insertTextAtCursor(text);
    }
  });

  if (canStore) {
    const storedTheme =
      localStorage.getItem(THEME_KEY) ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", storedTheme);
    store = loadStore();
  } else {
    document.documentElement.setAttribute("data-theme", "light");
    store = { version: 1, pads: [createPad("sample", "")] };
  }

  const saveContent = debounce(function () {
    persistActivePad();
  }, 300);

  editDiv.addEventListener("blur", persistActivePad);
  editDiv.addEventListener("input", saveContent);

  addPadBtn.addEventListener("click", function () {
    const pad = createPad(nextUntitledTitle(store.pads), "");
    store.pads.push(pad);
    persistStore();
    renderSurface();
  });

  backBtn.addEventListener("click", function () {
    goToSurface();
  });

  deleteBtn.addEventListener("click", function () {
    deleteActivePad();
  });

  themeBtn.addEventListener("click", themeSwitch);
  syncThemeToggleIcon();

  confirmDialogCancel.addEventListener("click", function () {
    closeConfirmDialog(false);
  });

  confirmDialogConfirm.addEventListener("click", function () {
    closeConfirmDialog(true);
  });

  confirmDialog.querySelectorAll("[data-confirm-cancel]").forEach(function (el) {
    el.addEventListener("click", function () {
      closeConfirmDialog(false);
    });
  });

  document.addEventListener("keydown", function (e) {
    if (!confirmDialog.hidden && e.key === "Escape") {
      e.preventDefault();
      closeConfirmDialog(false);
    }
  });

  padTitleEl.addEventListener("click", function () {
    beginTitleEdit();
  });

  padTitleInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitTitleEdit();
      editDiv.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelTitleEdit();
      editDiv.focus();
    }
  });

  padTitleInput.addEventListener("blur", function () {
    if (isEditingTitle) {
      commitTitleEdit();
    }
  });

  padTitleInput.addEventListener("input", function () {
    // Keep titles single-line and within the max length.
    const cleaned = padTitleInput.value.replace(/[\r\n\t]+/g, " ");
    if (cleaned !== padTitleInput.value) {
      padTitleInput.value = cleaned;
    }
    if (padTitleInput.value.length > TITLE_MAX_LENGTH) {
      padTitleInput.value = padTitleInput.value.slice(0, TITLE_MAX_LENGTH);
    }
  });

  window.addEventListener("hashchange", function () {
    routeFromHash({ replaceMissing: true });
  });

  routeFromHash({ replaceMissing: true });

  function loadStore() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.pads)) {
          if (parsed.pads.length === 0) {
            parsed.pads.push(createPad("sample", ""));
            localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
          }
          return { version: 1, pads: parsed.pads };
        }
      } catch (e) {
        // Fall through to migration / seed
      }
    }

    const legacy = localStorage.getItem(LEGACY_CONTENT_KEY);
    const migrated = {
      version: 1,
      pads: [createPad("sample", legacy || "")],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    if (legacy !== null) {
      localStorage.removeItem(LEGACY_CONTENT_KEY);
    }
    return migrated;
  }

  function persistStore() {
    if (!canStore) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  function createPad(title, content) {
    return {
      id: generateId(),
      title: title,
      content: content || "",
      updatedAt: Date.now(),
    };
  }

  function generateId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "pad-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function nextUntitledTitle(pads) {
    const titles = new Set(pads.map(function (pad) {
      return String(pad.title).toLowerCase();
    }));
    let n = 1;
    while (titles.has("untitled" + n)) {
      n += 1;
    }
    return "untitled" + n;
  }

  function getPadById(id) {
    return store.pads.find(function (pad) {
      return pad.id === id;
    });
  }

  function normalizeTitle(value) {
    return String(value || "")
      .replace(/[\r\n\t]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, TITLE_MAX_LENGTH);
  }

  function isTitleTaken(title, excludeId) {
    const needle = title.toLowerCase();
    return store.pads.some(function (pad) {
      return pad.id !== excludeId && String(pad.title).toLowerCase() === needle;
    });
  }

  function setTitleDisplay(title) {
    padTitleEl.textContent = title;
  }

  function beginTitleEdit() {
    if (!activePadId || isEditingTitle || editorView.hidden) return;
    const pad = getPadById(activePadId);
    if (!pad) return;

    titleBeforeEdit = pad.title;
    isEditingTitle = true;
    padTitleInput.value = pad.title;
    padTitleEl.hidden = true;
    padTitleInput.hidden = false;
    padTitleInput.focus();
    padTitleInput.select();
  }

  function endTitleEditMode() {
    isEditingTitle = false;
    padTitleInput.hidden = true;
    padTitleEl.hidden = false;
  }

  function cancelTitleEdit() {
    if (!isEditingTitle) return;
    setTitleDisplay(titleBeforeEdit);
    endTitleEditMode();
  }

  function commitTitleEdit() {
    if (!isEditingTitle) return;

    const pad = getPadById(activePadId);
    if (!pad) {
      endTitleEditMode();
      return;
    }

    const nextTitle = normalizeTitle(padTitleInput.value);
    // Empty / whitespace-only names revert to the previous title.
    if (!nextTitle) {
      setTitleDisplay(pad.title);
      endTitleEditMode();
      return;
    }

    // Unchanged (including case-only) keeps the existing stored title.
    if (nextTitle.toLowerCase() === String(pad.title).toLowerCase()) {
      // Allow intentional case changes on the same name.
      if (nextTitle !== pad.title) {
        pad.title = nextTitle;
        pad.updatedAt = Date.now();
        persistStore();
      }
      setTitleDisplay(pad.title);
      endTitleEditMode();
      return;
    }

    // Duplicate names (case-insensitive) are rejected.
    if (isTitleTaken(nextTitle, pad.id)) {
      setTitleDisplay(pad.title);
      endTitleEditMode();
      return;
    }

    pad.title = nextTitle;
    pad.updatedAt = Date.now();
    persistStore();
    setTitleDisplay(pad.title);
    endTitleEditMode();
  }

  function persistActivePad() {
    if (!activePadId) return;
    if (isEditingTitle) {
      commitTitleEdit();
    }
    const pad = getPadById(activePadId);
    if (!pad) return;
    pad.content = editDiv.innerHTML;
    pad.updatedAt = Date.now();
    persistStore();
  }

  function previewText(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html || "";
    const text = (tmp.textContent || tmp.innerText || "").replace(/\s+/g, " ").trim();
    if (!text) return "Empty";
    return text.length > 140 ? text.slice(0, 140) + "…" : text;
  }

  function sortedPads() {
    return store.pads.slice().sort(function (a, b) {
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
  }

  function renderSurface() {
    padGrid.innerHTML = "";
    sortedPads().forEach(function (pad) {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "pad-tile";
      tile.setAttribute("aria-label", "Open " + pad.title);

      const title = document.createElement("h2");
      title.className = "pad-tile-title";
      title.textContent = pad.title;

      const preview = document.createElement("p");
      preview.className = "pad-tile-preview";
      preview.textContent = previewText(pad.content);

      tile.appendChild(title);
      tile.appendChild(preview);
      tile.addEventListener("click", function () {
        openPad(pad.id);
      });
      padGrid.appendChild(tile);
    });
  }

  function showSurface() {
    if (isEditingTitle) {
      cancelTitleEdit();
    }
    activePadId = null;
    titleBeforeEdit = "";
    setTitleDisplay("");
    editDiv.innerHTML = "";
    surfaceView.hidden = false;
    editorView.hidden = true;
    renderSurface();
  }

  function showEditor() {
    surfaceView.hidden = true;
    editorView.hidden = false;
  }

  function openPad(id) {
    const pad = getPadById(id);
    if (!pad) {
      persistActivePad();
      showSurface();
      setHashSurface();
      return;
    }
    if (activePadId === pad.id && !editorView.hidden) {
      setHashForPad(pad.id);
      return;
    }
    if (activePadId && activePadId !== pad.id) {
      persistActivePad();
    }
    if (isEditingTitle) {
      cancelTitleEdit();
    }
    activePadId = pad.id;
    setTitleDisplay(pad.title);
    editDiv.innerHTML = pad.content || "";
    showEditor();
    setHashForPad(pad.id);
    setEndOfContenteditable(editDiv);
    editDiv.focus();
  }

  function goToSurface() {
    persistActivePad();
    showSurface();
    setHashSurface();
  }

  function openConfirmDialog(message) {
    return new Promise(function (resolve) {
      if (confirmResolver) {
        confirmResolver(false);
      }
      confirmResolver = resolve;
      lastFocusBeforeConfirm = document.activeElement;
      confirmDialogMessage.textContent = message;
      confirmDialog.hidden = false;
      confirmDialogConfirm.focus();
    });
  }

  function closeConfirmDialog(confirmed) {
    if (confirmDialog.hidden) return;
    confirmDialog.hidden = true;
    const resolve = confirmResolver;
    confirmResolver = null;
    if (lastFocusBeforeConfirm && typeof lastFocusBeforeConfirm.focus === "function") {
      lastFocusBeforeConfirm.focus();
    }
    lastFocusBeforeConfirm = null;
    if (resolve) resolve(Boolean(confirmed));
  }

  function deleteActivePad() {
    if (!activePadId) return;
    if (isEditingTitle) {
      commitTitleEdit();
    }
    const pad = getPadById(activePadId);
    if (!pad) {
      showSurface();
      setHashSurface();
      return;
    }

    openConfirmDialog('Delete "' + pad.title + '"? This cannot be undone.').then(function (confirmed) {
      if (!confirmed) return;
      if (!getPadById(pad.id)) return;

      store.pads = store.pads.filter(function (item) {
        return item.id !== pad.id;
      });
      if (store.pads.length === 0) {
        store.pads.push(createPad("sample", ""));
      }
      activePadId = null;
      persistStore();
      showSurface();
      setHashSurface();
    });
  }

  function setHashForPad(id) {
    const next = "#/pad/" + encodeURIComponent(id);
    if (location.hash !== next) {
      history.replaceState(null, "", next);
    }
  }

  function setHashSurface() {
    if (location.hash && location.hash !== "#/" && location.hash !== "#") {
      history.replaceState(null, "", "#/");
    } else if (!location.hash) {
      history.replaceState(null, "", "#/");
    }
  }

  function padIdFromHash() {
    const match = location.hash.match(/^#\/pad\/(.+)$/);
    if (!match) return null;
    try {
      return decodeURIComponent(match[1]);
    } catch (e) {
      return match[1];
    }
  }

  function routeFromHash(options) {
    const replaceMissing = options && options.replaceMissing;
    const id = padIdFromHash();
    if (id) {
      if (getPadById(id)) {
        openPad(id);
        return;
      }
      persistActivePad();
      showSurface();
      if (replaceMissing) {
        setHashSurface();
      }
      return;
    }
    if (activePadId) {
      persistActivePad();
    }
    showSurface();
  }

  function insertTextAtCursor(text) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    selection.deleteFromDocument();
    selection.getRangeAt(0).insertNode(document.createTextNode(text));
    setEndOfContenteditable(editDiv);
  }

  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(function () {
        func.apply(null, args);
      }, wait);
    };
  }

  function syncThemeToggleIcon() {
    const themeIcon = document.getElementById("themeIcon");
    if (!themeIcon || !themeBtn) return;

    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    // Show the destination theme: moon in light mode, sun in dark mode.
    themeIcon.textContent = isDark ? "☀" : "☾";
    const label = isDark ? "Switch to light theme" : "Switch to dark theme";
    themeBtn.setAttribute("aria-label", label);
    themeBtn.setAttribute("uk-tooltip", "title: " + label + "; pos: left");
    if (window.UIkit && typeof UIkit.tooltip === "function") {
      const tip = UIkit.tooltip(themeBtn);
      if (tip) {
        tip.title = label;
      }
    }
  }

  function themeSwitch() {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const targetTheme = currentTheme === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", targetTheme);
    if (canStore) {
      localStorage.setItem(THEME_KEY, targetTheme);
    }
    syncThemeToggleIcon();
    if (activePadId) {
      setEndOfContenteditable(editDiv);
      editDiv.focus();
    }
  }
});

function setEndOfContenteditable(contentEditableElement) {
  const range = document.createRange();
  range.selectNodeContents(contentEditableElement);
  range.collapse(false);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function storageAvailable(type) {
  try {
    const storage = window[type];
    const x = "__storage_test__";
    storage.setItem(x, x);
    storage.removeItem(x);
    return true;
  } catch (e) {
    return (
      e instanceof DOMException &&
      (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED") &&
      storage &&
      storage.length !== 0
    );
  }
}
