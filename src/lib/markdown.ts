import { Marked } from "marked";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const parser = new Marked({
  async: false,
  breaks: true,
  gfm: true,
  renderer: {
    html(token) {
      // Markdown's embedded HTML stays visible as text in notes.
      return escapeHtml(token.text);
    },
  },
});

const ALLOWED_TAGS = new Set([
  "A",
  "BLOCKQUOTE",
  "BR",
  "CODE",
  "DEL",
  "EM",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HR",
  "IMG",
  "INPUT",
  "LI",
  "OL",
  "P",
  "PRE",
  "STRONG",
  "TABLE",
  "TBODY",
  "TD",
  "TH",
  "THEAD",
  "TR",
  "UL",
]);

function safeHref(value: string): boolean {
  const href = value.trim();
  if (/[\u0000-\u0020]/.test(href)) return false;
  const scheme = href.match(/^([a-z][a-z\d+.-]*):/i)?.[1].toLowerCase();
  return !scheme || ["http", "https", "mailto", "tel"].includes(scheme);
}

function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const visit = (parent: ParentNode) => {
    for (const child of Array.from(parent.childNodes)) {
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const element = child as HTMLElement;
      visit(element);
      if (!ALLOWED_TAGS.has(element.tagName)) {
        element.replaceWith(...Array.from(element.childNodes));
        continue;
      }

      if (element.tagName === "IMG") {
        element.replaceWith(
          document.createTextNode((element as HTMLImageElement).alt || ""),
        );
        continue;
      }
      if (element.tagName === "INPUT") {
        if ((element as HTMLInputElement).type !== "checkbox") {
          element.remove();
          continue;
        }
        for (const attribute of Array.from(element.attributes)) {
          if (!["type", "checked", "disabled"].includes(attribute.name)) {
            element.removeAttribute(attribute.name);
          }
        }
        (element as HTMLInputElement).disabled = true;
        continue;
      }

      for (const attribute of Array.from(element.attributes)) {
        if (element.tagName === "A" && attribute.name === "href") {
          if (!safeHref(attribute.value)) element.removeAttribute(attribute.name);
        } else if (element.tagName === "A" && attribute.name === "title") {
          // Titles are plain text and safe to keep.
        } else {
          element.removeAttribute(attribute.name);
        }
      }
    }
  };
  visit(doc.body);
  return doc.body.innerHTML;
}

export function markdownToHtml(markdown: string): string {
  const html = parser.parse(markdown) as string;
  return sanitizeHtml(html);
}

function escapeMarkdownText(value: string): string {
  return value.replace(/([\\`*_{}\[\]()#+\-.!|>])/g, "\\$1");
}

function renderInline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeMarkdownText(node.nodeValue ?? "");
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const element = node as HTMLElement;
  const tag = element.tagName;
  const children = Array.from(element.childNodes).map(renderInline).join("");
  switch (tag) {
    case "BR": return "  \n";
    case "B":
    case "STRONG": return `**${children}**`;
    case "I":
    case "EM": return `*${children}*`;
    case "S":
    case "STRIKE":
    case "DEL": return `~~${children}~~`;
    case "CODE": return `\`${(element.textContent ?? "").replace(/`/g, "\\`")}\``;
    case "A": {
      const href = element.getAttribute("href") ?? "";
      return href && safeHref(href)
        ? `[${children}](${href.replace(/[()\\]/g, "\\$&")})`
        : children;
    }
    default: return children;
  }
}

function renderList(list: HTMLElement, depth = 0): string {
  const ordered = list.tagName === "OL";
  const items = Array.from(list.children).filter(
    (child) => child.tagName === "LI",
  ) as HTMLElement[];
  return items.map((item, index) => {
    const nestedLists = Array.from(item.children).filter(
      (child) => child.tagName === "UL" || child.tagName === "OL",
    ) as HTMLElement[];
    const content = Array.from(item.childNodes)
      .filter((child) => !nestedLists.includes(child as HTMLElement))
      .map(renderInline)
      .join("")
      .trim();
    const indent = "  ".repeat(depth);
    const marker = ordered ? `${index + 1}.` : "-";
    const nested = nestedLists
      .map((child) => renderList(child, depth + 1))
      .join("");
    return `${indent}${marker} ${content}\n${nested}`;
  }).join("");
}

export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html || "", "text/html");
  const renderBlock = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return escapeMarkdownText(node.nodeValue ?? "");
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const element = node as HTMLElement;
    const tag = element.tagName;
    if (tag === "UL" || tag === "OL") return `${renderList(element)}\n`;
    if (tag === "BR") return "  \n";
    if (/^H[1-6]$/.test(tag)) {
      return `${"#".repeat(Number(tag[1]))} ${Array.from(element.childNodes).map(renderInline).join("")}\n\n`;
    }
    if (tag === "PRE") {
      const code = element.textContent ?? "";
      const fence = "`".repeat(Math.max(3, ...Array.from(code.matchAll(/`+/g), (m) => m[0].length + 1)));
      return `${fence}\n${code.replace(/\n?$/, "\n")}${fence}\n\n`;
    }
    if (tag === "BLOCKQUOTE") {
      const text = Array.from(element.childNodes).map(renderBlock).join("").trim();
      return `${text.split("\n").map((line) => `> ${line}`).join("\n")}\n\n`;
    }
    if (tag === "P" || tag === "DIV") {
      const content = Array.from(element.childNodes).map(renderInline).join("").trim();
      return content ? `${content}\n\n` : "\n";
    }
    if (tag === "HR") return "---\n\n";
    return renderInline(element);
  };

  return Array.from(doc.body.childNodes)
    .map(renderBlock)
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/```[^\n]*\n([\s\S]*?)```/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+|\d+\.\s+)/gm, "")
    .replace(/[*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
