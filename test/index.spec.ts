import type {Index} from 'lunr';
import type {Registry, WorkerConfig} from '../src/types';
import type {SearchSuggestPageItem} from '@diplodoc/components';

import {Indexer, ReleaseFormat} from '../src/indexer';
import {search} from '../src/worker/search';
import {format, short} from '../src/worker/format';

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
});
