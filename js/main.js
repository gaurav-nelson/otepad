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
  const deleteAllPadsBtn = document.getElementById("deleteAllPads");
  const backBtn = document.getElementById("backToSurface");
  const deleteBtn = document.getElementById("deleteContent");
  const themeBtn = document.getElementById("toggleTheme");
  const confirmDialog = document.getElementById("confirmDialog");
  const confirmDialogTitle = document.getElementById("confirmDialogTitle");
  const confirmDialogMessage = document.getElementById("confirmDialogMessage");
  const confirmDialogCancel = document.getElementById("confirmDialogCancel");
  const confirmDialogConfirm = document.getElementById("confirmDialogConfirm");

  const THEME_ICON_MOON =
    '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M2.03009 12.42C2.39009 17.57 6.76009 21.76 11.9901 21.99C15.6801 22.15 18.9801 20.43 20.9601 17.72C21.7801 16.61 21.3401 15.87 19.9701 16.12C19.3001 16.24 18.6101 16.29 17.8901 16.26C13.0001 16.06 9.00009 11.97 8.98009 7.13996C8.97009 5.83996 9.24009 4.60996 9.73009 3.48996C10.2701 2.24996 9.62009 1.65996 8.37009 2.18996C4.41009 3.85996 1.70009 7.84996 2.03009 12.42Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    "</svg>";
  const THEME_ICON_SUN =
    '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M12 18.5C15.5899 18.5 18.5 15.5899 18.5 12C18.5 8.41015 15.5899 5.5 12 5.5C8.41015 5.5 5.5 8.41015 5.5 12C5.5 15.5899 8.41015 18.5 12 18.5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M19.14 19.14L19.01 19.01M19.01 4.99L19.14 4.86L19.01 4.99ZM4.86 19.14L4.99 19.01L4.86 19.14ZM12 2.08V2V2.08ZM12 22V21.92V22ZM2.08 12H2H2.08ZM22 12H21.92H22ZM4.99 4.99L4.86 4.86L4.99 4.99Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    "</svg>";

  let store = { version: 1, pads: [] };
  let activePadId = null;
  let selectedPadIds = new Set();
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

  if (deleteAllPadsBtn) {
    deleteAllPadsBtn.addEventListener("click", function () {
      deleteSurfacePads();
    });
  }

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
      return;
    }
    if (
      !surfaceView.hidden &&
      selectedPadIds.size > 0 &&
      e.key === "Escape" &&
      !e.target.closest("input, textarea, [contenteditable]")
    ) {
      e.preventDefault();
      clearPadSelection();
      syncSelectionUi();
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

  function clearPadSelection() {
    selectedPadIds.clear();
  }

  function syncDeleteSurfaceButton() {
    if (!deleteAllPadsBtn) return;
    const selectedCount = selectedPadIds.size;
    const hasPads = store.pads.length > 0;
    deleteAllPadsBtn.disabled = !hasPads;

    const label =
      selectedCount > 0
        ? selectedCount === 1
          ? "Delete selected pad"
          : "Delete selected pads"
        : "Delete all pads";
    deleteAllPadsBtn.setAttribute("aria-label", label);
    deleteAllPadsBtn.setAttribute("uk-tooltip", "title: " + label + "; pos: left");
    if (window.UIkit && typeof UIkit.tooltip === "function") {
      const tip = UIkit.tooltip(deleteAllPadsBtn);
      if (tip) {
        tip.title = label;
      }
    }
  }

  function togglePadSelection(id, selected) {
    if (selected) {
      selectedPadIds.add(id);
    } else {
      selectedPadIds.delete(id);
    }
    syncSelectionUi();
  }

  function syncSelectionUi() {
    const selecting = selectedPadIds.size > 0;
    padGrid.classList.toggle("is-selecting", selecting);

    padGrid.querySelectorAll(".pad-tile").forEach(function (tile) {
      const id = tile.getAttribute("data-pad-id");
      const isSelected = selectedPadIds.has(id);
      tile.classList.toggle("is-selected", isSelected);
      const checkbox = tile.querySelector(".pad-tile-select-input");
      if (checkbox) {
        checkbox.checked = isSelected;
      }
    });

    syncDeleteSurfaceButton();
  }

  function renderSurface() {
    // Drop selection ids that no longer exist.
    selectedPadIds.forEach(function (id) {
      if (!getPadById(id)) {
        selectedPadIds.delete(id);
      }
    });

    padGrid.innerHTML = "";
    sortedPads().forEach(function (pad) {
      const tile = document.createElement("div");
      tile.className = "pad-tile";
      tile.setAttribute("data-pad-id", pad.id);

      const selectLabel = document.createElement("label");
      selectLabel.className = "pad-tile-select";
      selectLabel.setAttribute("aria-label", "Select " + pad.title);

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "pad-tile-select-input";
      checkbox.checked = selectedPadIds.has(pad.id);

      const checkMark = document.createElement("span");
      checkMark.className = "pad-tile-check";
      checkMark.setAttribute("aria-hidden", "true");

      selectLabel.appendChild(checkbox);
      selectLabel.appendChild(checkMark);

      const openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.className = "pad-tile-open";
      openBtn.setAttribute("aria-label", "Open " + pad.title);

      const title = document.createElement("h2");
      title.className = "pad-tile-title";
      title.textContent = pad.title;

      const preview = document.createElement("p");
      preview.className = "pad-tile-preview";
      preview.textContent = previewText(pad.content);

      openBtn.appendChild(title);
      openBtn.appendChild(preview);

      checkbox.addEventListener("click", function (e) {
        e.stopPropagation();
      });

      checkbox.addEventListener("change", function () {
        togglePadSelection(pad.id, checkbox.checked);
      });

      openBtn.addEventListener("click", function () {
        if (selectedPadIds.size > 0) {
          togglePadSelection(pad.id, !selectedPadIds.has(pad.id));
          return;
        }
        openPad(pad.id);
      });

      tile.appendChild(selectLabel);
      tile.appendChild(openBtn);
      padGrid.appendChild(tile);
    });

    syncSelectionUi();
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
    clearPadSelection();
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

  function openConfirmDialog(title, message) {
    return new Promise(function (resolve) {
      if (confirmResolver) {
        confirmResolver(false);
      }
      confirmResolver = resolve;
      lastFocusBeforeConfirm = document.activeElement;
      if (confirmDialogTitle) {
        confirmDialogTitle.textContent = title;
      }
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

    openConfirmDialog(
      "Delete pad?",
      'Delete "' + pad.title + '"? This cannot be undone.'
    ).then(function (confirmed) {
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

  function deleteSurfacePads() {
    if (store.pads.length === 0) return;

    const selectedIds = Array.from(selectedPadIds).filter(function (id) {
      return Boolean(getPadById(id));
    });

    if (selectedIds.length > 0) {
      const count = selectedIds.length;
      const label = count === 1 ? "1 pad" : count + " pads";
      openConfirmDialog(
        "Delete selected pads?",
        "Delete " + label + "? This cannot be undone."
      ).then(function (confirmed) {
        if (!confirmed) return;

        const selected = new Set(selectedIds);
        store.pads = store.pads.filter(function (pad) {
          return !selected.has(pad.id);
        });
        if (store.pads.length === 0) {
          store.pads.push(createPad("sample", ""));
        }
        clearPadSelection();
        persistStore();
        renderSurface();
      });
      return;
    }

    const count = store.pads.length;
    const label = count === 1 ? "1 pad" : count + " pads";
    openConfirmDialog(
      "Delete all pads?",
      "Delete " + label + "? This cannot be undone."
    ).then(function (confirmed) {
      if (!confirmed) return;

      store.pads = [createPad("sample", "")];
      clearPadSelection();
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
    themeIcon.innerHTML = isDark ? THEME_ICON_SUN : THEME_ICON_MOON;
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
