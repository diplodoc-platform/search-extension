import type {Index} from 'lunr';
import type {Registry, WorkerConfig} from '../src/types';
import type {SearchSuggestPageItem} from '@diplodoc/components';
import type {Score} from '../src/worker/score';

import {beforeEach, describe, expect, it} from 'vitest';

import {Indexer, ReleaseFormat} from '../src/indexer';
import {search} from '../src/worker/search';
import {format, long, short} from '../src/worker/format';

const Lorem = [
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    'Integer sit amet enim velit.',
    'Nam facilisis eget magna non blandit.',
    'Sed semper, dui ut suscipit semper, nibh justo tempor purus, quis placerat enim dolor vitae neque.',
    'Vivamus dignissim nunc et tortor vulputate maximus.',
    'Fusce lobortis pretium lectus, non pretium mi rhoncus quis.',
    'Curabitur blandit imperdiet metus id luctus.',
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    'Aenean lobortis ligula a mauris posuere, luctus pretium mauris ultrices.',
];

const LongLorem = 'Lorem ipsum dolor '.repeat(100);

const Code = 'crm.stagehistory.list';

const item = ({link, title, description}: SearchSuggestPageItem) => `
    <a href="${link}">
        <div>${title}</div>
        <div>${description}</div>
    </a>
`;

describe('suggest', () => {
    const lang = 'ru';
    let indexer: Indexer;
    let uid = 1;

    function suggest(query: string, config: Pick<WorkerConfig, 'confidence' | 'tolerance'>) {
        const {index, registry} = indexer.release(lang, ReleaseFormat.RAW);

        const results = search(config, index as Index, query, 10, false);

        return format({base: './', mark: 'mark'}, results, registry as Registry, short).map(item);
    }

    function add(html: string, title = '') {
        indexer.add(lang, String(uid++), {
            html,
            title,
            leading: false,
            meta: {},
        });
    }

    beforeEach(() => {
        indexer = new Indexer();
    });

    it('should match html content', () => {
        add(Lorem.slice(0, 2).join(' '));
        add(Lorem.slice(1, 3).join(' '));

        const config = {confidence: 'phrased', tolerance: 2} as const;

        expect(suggest('Lorem ipsum', config)).toMatchSnapshot();
    });

    it('should match title content', () => {
        add(Lorem.slice(1, 3).join(' '), 'Lorem ipsum 1');
        add(Lorem.slice(2, 4).join(' '), 'Lorem ipsum 2');

        const config = {confidence: 'phrased', tolerance: 2} as const;

        expect(suggest('Lorem ipsum', config)).toMatchSnapshot();
    });

    it('should score longest phrase', () => {
        add(Lorem.slice(0, 3).join(' '));
        add(Lorem.slice(1, 5).join(' '));

        const config = {confidence: 'phrased', tolerance: 2} as const;

        expect(suggest('enim dolor vitae', config)).toMatchSnapshot();
    });

    it('should match code', () => {
        add(Code);

        const config = {confidence: 'phrased', tolerance: 2} as const;

        expect(suggest('stagehistory', config)).toMatchSnapshot();
    });

    it('should format very long result', () => {
        add(LongLorem);

        const config = {confidence: 'phrased', tolerance: 0} as const;

        expect(suggest('Lorem ipsum', config)).toMatchSnapshot();
    });

    it('should escape HTML in suggest output from a markdown heading.', () => {
        add('', "### Test <img src=x onerror=alert('Alert')>");

        const config = {confidence: 'phrased', tolerance: 2} as const;
        const results = suggest('Test', config).join('');

        expect(results).not.toContain("<img src=x onerror=alert('Alert')>");
        expect(results).toContain("&lt;img src=x onerror=alert('Alert')&gt;");
    });
});

describe('long', () => {
    it('should correctly remap positions when text is trimmed', () => {
        const text =
            'Prefix text before the match. '.repeat(5) +
            'TARGET_WORD is here in the middle. ' +
            'Suffix text after the match. '.repeat(5);

        const targetStart = text.indexOf('TARGET_WORD');
        const targetEnd = targetStart + 'TARGET_WORD'.length;

        const score: Score = {
            positions: [[targetStart, targetEnd]],
            score: 10,
            position: [targetStart, targetEnd],
        };

        const [result, positions] = long(text, score);

        expect(result.length).toBeLessThanOrEqual(200);

        expect(positions.length).toBeGreaterThan(0);

        const [start, end] = positions[0];
        const highlighted = result.slice(start, end);

        expect(highlighted).toBe('TARGET_WORD');
    });

    it('should handle positions at the beginning of text', () => {
        const text = 'START_WORD ' + 'some filler text. '.repeat(20);

        const score: Score = {
            positions: [[0, 10]],
            score: 10,
            position: [0, 10],
        };

        const [result, positions] = long(text, score);

        expect(positions.length).toBeGreaterThan(0);
        const [start, end] = positions[0];
        expect(result.slice(start, end)).toBe('START_WORD');
    });

    it('should return original text and positions if text is shorter than MAX_LENGTH', () => {
        const text = 'Short text with KEYWORD inside';
        const keywordStart = text.indexOf('KEYWORD');
        const keywordEnd = keywordStart + 'KEYWORD'.length;

        const score: Score = {
            positions: [[keywordStart, keywordEnd]],
            score: 10,
            position: [keywordStart, keywordEnd],
        };

        const [result, positions] = long(text, score);

        expect(result).toBe(text);
        expect(positions).toEqual([[keywordStart, keywordEnd]]);
    });

    it('should correctly handle multiple positions', () => {
        const text =
            'First MATCH here. '.repeat(3) +
            'Second MATCH here. '.repeat(3) +
            'More text to make it long enough. '.repeat(5);

        const firstMatchStart = text.indexOf('MATCH');
        const firstMatchEnd = firstMatchStart + 'MATCH'.length;

        const score: Score = {
            positions: [
                [firstMatchStart, firstMatchEnd],
                [firstMatchStart + 18, firstMatchStart + 18 + 5], // Второй MATCH
            ],
            score: 10,
            position: [firstMatchStart, firstMatchEnd],
        };

        const [result, positions] = long(text, score);

        expect(positions.length).toBeGreaterThan(0);

        const [start, end] = positions[0];

        expect(result.slice(start, end)).toBe('MATCH');
    });
});
