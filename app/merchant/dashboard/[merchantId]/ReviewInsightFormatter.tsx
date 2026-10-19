'use client';

import { useEffect } from 'react';

function appendInline(parent: HTMLElement, text: string) {
  const cleaned = text.replace(/`([^`]+)`/g, '$1');
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__)/g;
  let last = 0;

  for (const match of cleaned.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) parent.append(document.createTextNode(cleaned.slice(last, index)));

    const strong = document.createElement('strong');
    strong.textContent = match[0].replace(/^\*\*|\*\*$/g, '').replace(/^__|__$/g, '');
    parent.append(strong);
    last = index + match[0].length;
  }

  if (last < cleaned.length) parent.append(document.createTextNode(cleaned.slice(last)));
}

function buildInsight(raw: string) {
  const wrapper = document.createElement('div');
  wrapper.className = 'ai-review-insight-content';

  const lines = raw
    .replace(/```[\w-]*\n?/g, '')
    .replace(/```/g, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let list: HTMLUListElement | HTMLOListElement | null = null;
  let listType: 'ul' | 'ol' | null = null;

  const flushList = () => {
    if (list) wrapper.append(list);
    list = null;
    listType = null;
  };

  for (const line of lines) {
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    const bullet = line.match(/^[-*•]\s+(.+)$/);
    const numbered = line.match(/^\d+[.)]\s+(.+)$/);

    if (heading) {
      flushList();
      const h = document.createElement('h4');
      h.className = 'ai-review-insight-heading';
      appendInline(h, heading[1]);
      wrapper.append(h);
      continue;
    }

    if (bullet || numbered) {
      const type: 'ul' | 'ol' = bullet ? 'ul' : 'ol';
      if (!list || listType !== type) {
        flushList();
        list = document.createElement(type);
        list.className = 'ai-review-insight-list';
        listType = type;
      }
      const item = document.createElement('li');
      appendInline(item, (bullet || numbered)![1]);
      list.append(item);
      continue;
    }

    flushList();
    const paragraph = document.createElement('p');
    paragraph.className = 'ai-review-insight-paragraph';
    appendInline(paragraph, line.replace(/^#+\s*/, ''));
    wrapper.append(paragraph);
  }

  flushList();
  return wrapper;
}

function formatTarget(target: Element) {
  if (!(target instanceof HTMLElement)) return;
  if (target.querySelector(':scope > .ai-review-insight-content')) return;

  const raw = target.textContent?.trim();
  if (!raw) return;

  target.replaceChildren(buildInsight(raw));
}

export default function ReviewInsightFormatter() {
  useEffect(() => {
    const selector = '.merchant-review-analysis-text, .merchant-forecast-analysis p';
    const formatAll = () => document.querySelectorAll(selector).forEach(formatTarget);

    formatAll();
    const observer = new MutationObserver(() => formatAll());
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => observer.disconnect();
  }, []);

  return (
    <style jsx global>{`
      .merchant-review-analysis-text:has(.ai-review-insight-content),
      .merchant-forecast-analysis p:has(.ai-review-insight-content) {
        white-space: normal !important;
      }
      .ai-review-insight-content {
        display: grid;
        gap: 10px;
        margin-top: 4px;
        color: #45554a;
        line-height: 1.65;
      }
      .ai-review-insight-heading {
        margin: 8px 0 0;
        color: #203b2c;
        font-size: 14px;
        font-weight: 800;
        letter-spacing: -0.01em;
      }
      .ai-review-insight-paragraph {
        margin: 0 !important;
        color: #526158 !important;
        font-size: 12px !important;
        line-height: 1.7 !important;
      }
      .ai-review-insight-list {
        display: grid;
        gap: 8px;
        margin: 2px 0 2px 18px;
        padding: 0;
        color: #45554a;
        font-size: 12px;
      }
      .ai-review-insight-list li {
        padding-left: 3px;
        color: #45554a !important;
        line-height: 1.65;
      }
      .ai-review-insight-content strong {
        color: #1f4d38 !important;
        font-weight: 800;
      }
      @media (max-width: 680px) {
        .ai-review-insight-content { gap: 8px; }
        .ai-review-insight-heading { font-size: 13px; }
        .ai-review-insight-paragraph,
        .ai-review-insight-list { font-size: 11px !important; }
      }
    `}</style>
  );
}
