document.addEventListener("DOMContentLoaded", function () {
  const editDiv = document.getElementById("editable");
  editDiv.contentEditable = true;
  editDiv.focus();

  editDiv.addEventListener('paste', function (e) {
    if (e.shiftKey) {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      insertTextAtCursor(text);
    }
  });

  if (storageAvailable("localStorage")) {
    if (localStorage.getItem("content")) {
      loadContent();
    }
    const storedTheme = localStorage.getItem("theme") ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", storedTheme);
  } else {
    document.documentElement.setAttribute("data-theme", "light");
  }

  editDiv.addEventListener("blur", saveContent);
  editDiv.addEventListener("input", debounce(saveContent, 300));

  const deleteButton = document.getElementById("deleteContent");
  deleteButton.addEventListener("click", deleteContent);

  function loadContent() {
    editDiv.innerHTML = localStorage.getItem("content");
    setEndOfContenteditable(editDiv); // Set cursor at the end after loading content
  }

  function saveContent() {
    localStorage.setItem("content", editDiv.innerHTML);
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
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  function deleteContent() {
    editDiv.innerHTML = "";
    localStorage.removeItem("content");
    editDiv.focus();
  }
});

function themeSwitch() {
  const editDiv = document.getElementById("editable");
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const targetTheme = currentTheme === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", targetTheme);
  localStorage.setItem("theme", targetTheme);
  setEndOfContenteditable(editDiv);
  editDiv.focus();
}

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
    return e instanceof DOMException && (
      e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED"
    ) && storage && storage.length !== 0;
  }
}
