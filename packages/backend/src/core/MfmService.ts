/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { URL } from 'node:url';
import { Inject, Injectable } from '@nestjs/common';
import * as htmlParser from 'node-html-parser';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import { intersperse } from '@/misc/prelude/array.js';
import { normalizeForSearch } from '@/misc/normalize-for-search.js';
import type { IMentionedRemoteUsers } from '@/models/Note.js';
import { bindThis } from '@/decorators.js';
import type * as mfm from 'mfm-js';

const urlRegex = /^https?:\/\/[\w\/:%#@$&?!()\[\]~.,=+\-]+/;
const urlRegexFull = /^https?:\/\/[\w\/:%#@$&?!()\[\]~.,=+\-]+$/;

export type Appender = () => string;

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

@Injectable()
export class MfmService {
	constructor(
		@Inject(DI.config)
		private config: Config,
	) {
	}

	@bindThis
	public fromHtml(html: string, hashtagNames?: string[]): string {
		// some AP servers like Pixelfed use br tags as well as newlines
		html = html.replace(/<br\s?\/?>\r?\n/gi, '\n');

		const normalizedHashtagNames = hashtagNames == null ? undefined : new Set<string>(hashtagNames.map(x => normalizeForSearch(x)));

		const dom = htmlParser.parse(`<div>${html}</div>`);

		let text = '';

		for (const n of dom.childNodes) {
			analyze(n);
		}

		return text.trim();

		function getText(node: htmlParser.Node): string {
			if (node instanceof htmlParser.TextNode) return node.textContent;
			if (!(node instanceof htmlParser.HTMLElement)) return '';
			if (node.tagName === 'BR') return '\n';

			if (node.childNodes != null) {
				return node.childNodes.map(n => getText(n)).join('');
			}

			return '';
		}

		function appendChildren(childNodes: htmlParser.Node[] | null): void {
			if (childNodes != null) {
				for (const n of childNodes) {
					analyze(n);
				}
			}
		}

		function analyze(node: htmlParser.Node) {
			if (node instanceof htmlParser.TextNode) {
				text += node.textContent;
				return;
			}

			// Skip comment or document type node
			if (!(node instanceof htmlParser.HTMLElement)) {
				return;
			}

			switch (node.tagName) {
				case 'BR': {
					text += '\n';
					break;
				}

				case 'A': {
					const txt = getText(node);
					const rel = node.attributes.rel;
					const href = node.attributes.href;

					// ハッシュタグ
					if (normalizedHashtagNames && href != null && normalizedHashtagNames.has(normalizeForSearch(txt))) {
						text += txt;
						// メンション
					} else if (txt.startsWith('@') && !(rel != null && rel.startsWith('me '))) {
						const part = txt.split('@');

						if (part.length === 2 && href) {
							//#region ホスト名部分が省略されているので復元する
							const acct = `${txt}@${(new URL(href)).hostname}`;
							text += acct;
							//#endregion
						} else if (part.length === 3) {
							text += txt;
						}
						// その他
					} else {
						const generateLink = () => {
							if (!href && !txt) {
								return '';
							}
							if (!href) {
								return txt;
							}
							if (!txt || txt === href) {	// #6383: Missing text node
								if (href.match(urlRegexFull)) {
									return href;
								} else {
									return `<${href}>`;
								}
							}
							if (href.match(urlRegex) && !href.match(urlRegexFull)) {
								return `[${txt}](<${href}>)`;	// #6846
							} else {
								return `[${txt}](${href})`;
							}
						};

						text += generateLink();
					}
					break;
				}

				case 'H1': {
					text += '【';
					appendChildren(node.childNodes);
					text += '】\n';
					break;
				}

				case 'B':
				case 'STRONG': {
					text += '**';
					appendChildren(node.childNodes);
					text += '**';
					break;
				}

				case 'SMALL': {
					text += '<small>';
					appendChildren(node.childNodes);
					text += '</small>';
					break;
				}

				case 'S':
				case 'DEL': {
					text += '~~';
					appendChildren(node.childNodes);
					text += '~~';
					break;
				}

				case 'I':
				case 'EM': {
					text += '<i>';
					appendChildren(node.childNodes);
					text += '</i>';
					break;
				}

				case 'RUBY': {
					let ruby: [string, string][] = [];
					for (const child of node.childNodes) {
						if (child instanceof htmlParser.HTMLElement && child.tagName === 'RP') {
							continue;
						}
						if (child instanceof htmlParser.TextNode && !/\s|\[|\]/.test(child.textContent)) {
							ruby.push([child.textContent, '']);
							continue;
						}
						if (child instanceof htmlParser.HTMLElement && child.tagName === 'RT' && ruby.length > 0) {
							const rt = getText(child);
							if (/\s|\[|\]/.test(rt)) {
								// If any space is included in rt, it is treated as a normal text
								ruby = [];
								appendChildren(node.childNodes);
								break;
							} else {
								ruby.at(-1)![1] = rt;
								continue;
							}
						}
						// If any other element is included in ruby, it is treated as a normal text
						ruby = [];
						appendChildren(node.childNodes);
						break;
					}
					for (const [base, rt] of ruby) {
						text += `$[ruby ${base} ${rt}]`;
					}
					break;
				}

				// block code (<pre><code>)
				case 'PRE': {
					const parsedInner = htmlParser.parse(node.innerHTML);
					if (parsedInner.childNodes.length === 1 && parsedInner.childNodes[0] instanceof htmlParser.HTMLElement && parsedInner.childNodes[0].tagName === 'CODE') {
						text += '\n```\n';
						text += getText(parsedInner.childNodes[0]);
						text += '\n```\n';
					} else {
						appendChildren(node.childNodes);
					}
					break;
				}

				// inline code (<code>)
				case 'CODE': {
					text += '`';
					appendChildren(node.childNodes);
					text += '`';
					break;
				}

				case 'BLOCKQUOTE': {
					const t = getText(node);
					if (t) {
						text += '\n> ';
						text += t.split('\n').join('\n> ');
					}
					break;
				}

				case 'P':
				case 'H2':
				case 'H3':
				case 'H4':
				case 'H5':
				case 'H6': {
					text += '\n\n';
					appendChildren(node.childNodes);
					break;
				}

				// other block elements
				case 'DIV':
				case 'HEADER':
				case 'FOOTER':
				case 'ARTICLE':
				case 'LI':
				case 'DT':
				case 'DD': {
					text += '\n';
					appendChildren(node.childNodes);
					break;
				}

				default:	// includes inline elements
				{
					appendChildren(node.childNodes);
					break;
				}
			}
		}
	}

	@bindThis
	public toHtml(nodes: mfm.MfmNode[] | null, mentionedRemoteUsers: IMentionedRemoteUsers = [], additionalAppenders: Appender[] = []) {
		if (nodes == null) {
			return null;
		}

		function toHtml(children?: mfm.MfmNode[]): string {
			if (children == null) return '';
			return children.map(x => (handlers as any)[x.type](x)).join('');
		}

		function fnDefault(node: mfm.MfmFn) {
			return `<i>${toHtml(node.children)}</i>`;
		}

		const handlers = {
			bold: (node) => {
				return `<b>${toHtml(node.children)}</b>`;
			},

			small: (node) => {
				return `<small>${toHtml(node.children)}</small>`;
			},

			strike: (node) => {
				return `<del>${toHtml(node.children)}</del>`;
			},

			italic: (node) => {
				return `<i>${toHtml(node.children)}</i>`;
			},

			fn: (node) => {
				switch (node.props.name) {
					case 'unixtime': {
						const text = node.children[0].type === 'text' ? node.children[0].props.text : '';
						try {
							const date = new Date(parseInt(text, 10) * 1000);
							return `<time datetime="${escapeHtml(date.toISOString())}">${escapeHtml(date.toISOString())}</time>`;
						} catch (err) {
							return fnDefault(node);
						}
					}

					case 'ruby': {
						if (node.children.length === 1) {
							const child = node.children[0];
							const text = child.type === 'text' ? child.props.text : '';
							return `<ruby>${escapeHtml(text.split(' ')[0])}<rp>(</rp><rt>${escapeHtml(text.split(' ')[1])}</rt><rp>)</rp></ruby>`;
						} else {
							const rt = node.children.at(-1);

							if (!rt) {
								return fnDefault(node);
							}

							const text = rt.type === 'text' ? rt.props.text : '';
							return `<ruby>${toHtml(node.children.slice(0, node.children.length - 1))}<rp>(</rp><rt>${escapeHtml(text.trim())}</rt><rp>)</rp></ruby>`;
						}
					}

					default: {
						return fnDefault(node);
					}
				}
			},

			blockCode: (node) => {
				return `<pre><code>${escapeHtml(node.props.code)}</code></pre>`;
			},

			center: (node) => {
				return `<div>${toHtml(node.children)}</div>`;
			},

			emojiCode: (node) => {
				return `\u200B:${escapeHtml(node.props.name)}:\u200B`;
			},

			unicodeEmoji: (node) => {
				return node.props.emoji;
			},

			hashtag: (node) => {
				return `<a href="${escapeHtml(`${this.config.url}/tags/${encodeURIComponent(node.props.hashtag)}`)}" rel="tag">#${escapeHtml(node.props.hashtag)}</a>`;
			},

			inlineCode: (node) => {
				return `<code>${escapeHtml(node.props.code)}</code>`;
			},

			mathInline: (node) => {
				return `<code>${escapeHtml(node.props.formula)}</code>`;
			},

			mathBlock: (node) => {
				return `<code>${escapeHtml(node.props.formula)}</code>`;
			},

			link: (node) => {
				try {
					const url = new URL(node.props.url);
					return `<a href="${escapeHtml(url.href)}">${toHtml(node.children)}</a>`;
				} catch {
					return `[${toHtml(node.children)}](${escapeHtml(node.props.url)})`;
				}
			},

			mention: (node) => {
				const { username, host, acct } = node.props;
				const remoteUserInfo = mentionedRemoteUsers.find(remoteUser => remoteUser.username.toLowerCase() === username.toLowerCase() && remoteUser.host?.toLowerCase() === host?.toLowerCase());
				const href = remoteUserInfo
					? (remoteUserInfo.url ? remoteUserInfo.url : remoteUserInfo.uri)
					: `${this.config.url}/${acct.endsWith(`@${this.config.url}`) ? acct.substring(0, acct.length - this.config.url.length - 1) : acct}`;
				try {
					const url = new URL(href);
					return `<a href="${escapeHtml(url.href)}" class="u-url mention">${escapeHtml(acct)}</a>`;
				} catch {
					return escapeHtml(acct);
				}
			},

			quote: (node) => {
				return `<blockquote>${toHtml(node.children)}</blockquote>`;
			},

			text: (node) => {
				if (!node.props.text.match(/[\r\n]/)) {
					return escapeHtml(node.props.text);
				}

				let html = '';
				const lines = node.props.text.split(/\r\n|\r|\n/).map(x => escapeHtml(x));

				for (const x of intersperse<string | 'br'>('br', lines)) {
					html += x === 'br' ? '<br>' : x;
				}

				return `<span>${html}</span>`;
			},

			url: (node) => {
				try {
					const url = new URL(node.props.url);
					return `<a href="${escapeHtml(url.href)}">${escapeHtml(node.props.url)}</a>`;
				} catch {
					return escapeHtml(node.props.url);
				}
			},

			search: (node) => {
				return `<a href="${escapeHtml(`https://www.google.com/search?q=${encodeURIComponent(node.props.query)}`)}">${escapeHtml(node.props.content)}</a>`;
			},

			plain: (node) => {
				return `<span>${toHtml(node.children)}</span>`;
			},
		} satisfies { [K in mfm.MfmNode['type']]: (node: mfm.NodeType<K>) => string } as { [K in mfm.MfmNode['type']]: (node: mfm.MfmNode) => string };

		return `<p>${toHtml(nodes)}${additionalAppenders.map(appender => appender()).join('')}</p>`;
	}
}
