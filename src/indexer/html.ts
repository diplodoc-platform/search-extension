// eslint-disable-next-line @typescript-eslint/no-redeclare
import type {HTMLElement, Node, TextNode} from 'node-html-parser';

import {NodeType, parse} from 'node-html-parser';

function isElementNode(node: Node): node is HTMLElement {
    return node.nodeType === NodeType.ELEMENT_NODE;
}

function isTextNode(node: Node): node is TextNode {
    return node.nodeType === NodeType.TEXT_NODE;
}

function isBlockTag(tag: string) {
    return 'div|p|li|td|section|br'.includes(tag);
}

export function html2text(html: string) {
    const node = parse(html, {
        lowerCaseTagName: true,
        blockTextElements: {
            script: false,
            noscript: false,
            style: false,
            pre: true,
        },
    });

    let currentBlock: string[] = [];
    let prependWhitespace = false;

    const blocks = [currentBlock];
    const work: (Node | null)[] = [node];

    while (work.length) {
        const node = work.shift();

        if (!node) {
            if (currentBlock.length) {
                blocks.push((currentBlock = []));
                prependWhitespace = false;
            }
            continue;
        }

        if (isElementNode(node)) {
            const tagName = (node.tagName || '').toLowerCase();

            if (node.attributes['data-no-index']) {
                continue;
            }

            if (tagName === 'pre') {
                currentBlock.push(html2text(node.rawText));
            } else if (isBlockTag(tagName)) {
                work.unshift(null, ...node.childNodes, null);
            } else {
                work.unshift(...node.childNodes);
            }
        }

        if (isTextNode(node)) {
            if (node.isWhitespace) {
                // Whitespace node, postponed output
                prependWhitespace = true;
            } else {
                let text = node.text;
                if (prependWhitespace) {
                    text = ' ' + text;
                    prependWhitespace = false;
                }
                currentBlock.push(text);
            }
        }
    }

    // Normalize each line's whitespace
    return blocks
        .map((block) =>
            block
                .join(' ')
                .trim()
                .replace(/\s{2,}/g, ' ')
                .replace(/\s([.,!?:;])/g, '$1'),
        )
        .join('\n')
        .trimEnd();
}
