// Small DOM helpers. Text always goes in through text nodes: blocked URLs and config values come
// from the site being checked, so they must never be parsed as HTML.
type Child = Node | string;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.append(...children);
  return element;
}

export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`missing #${id}`);
  return element as T;
}

/** A key/value list; rows without a value are left out. */
export function detailList(rows: [string, Child | undefined][]): HTMLDListElement {
  const list = el("dl", "details");
  for (const [key, value] of rows) {
    if (value !== undefined) list.append(el("dt", "", key), el("dd", "", value));
  }
  return list;
}

/** Labels the page when it shows fixtures, so a mock can't be mistaken for a real verdict. */
export function showMockNotice(parent: HTMLElement): void {
  parent.prepend(el("p", "mock-notice", "Mock data, not a real check"));
}
