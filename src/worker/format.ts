import type {SearchSuggestPageItem} from '@diplodoc/components';
import type {Position, Registry, WorkerConfig} from '../types';
import type {SearchResult} from './search';
import type {Score} from './score';

const MAX_LENGTH = 200;
const SHORT_HEAD = 20;

type Trimmer = (text: string, score: Score) => [string, Position[]];

export function format(
    {base, mark}: WorkerConfig,
    result: SearchResult[],
    registry: Registry,
    trim: Trimmer,
): SearchSuggestPageItem[] {
    return result.map((entry) => {
        const doc = registry[entry.ref];
        const item = {
            type: 'page',
            link: `${base}/${entry.ref}`,
            title: doc.title,
            description: doc.content.slice(0, MAX_LENGTH),
        } as SearchSuggestPageItem;

        const fields = entry.scores;

        for (const [field, score] of Object.entries(fields)) {
            switch (field) {
                case 'title':
                    item.title = highlighte(mark, doc.title, score.positions);
                    break;
                case 'content':
                    item.description = highlighte(mark, ...trim(doc.content, score));
                    break;
            }
        }

        return item;
    });
}

export function short(text: string, score: Score): [string, Position[]] {
    const {positions, maxScorePosition: position} = score;
    const [before, content, after] = split(text, position);
    const head = before.length > SHORT_HEAD ? '...' + before.slice(-SHORT_HEAD) : before;
    const tail = after.slice(0, Math.max(0, MAX_LENGTH - head.length - content.length));

    return [head + content + tail, remap(position[0] - head.length, positions)];
}

export function long(text: string, score: Score): [string, Position[]] {
    const {positions} = score;

    if (text.length <= MAX_LENGTH) {
        return [text, positions];
    }

    const [before, content, after] = split(text, positions[0]);

    if (content.length >= MAX_LENGTH) {
        return [content.slice(0, MAX_LENGTH), [[0, MAX_LENGTH]]];
    }

    let head = 0;
    let result = content;

    const befores = before.split('\n');
    const afters = after.split('\n');

    let action = prepend;
    while (result.length < MAX_LENGTH) {
        action = action();
    }

    const length = result.length;
    result = result.trimStart();
    head -= length - result.length;

    return [result, remap(head, positions)];

    function prepend() {
        if (befores.length) {
            const part = befores.pop() as string;
            const overage = Math.max(part.length - MAX_LENGTH, 0);

            head += part.length - overage + 1;
            result = '\n' + part.slice(overage, part.length) + result;
        }

        return append;
    }

    function append() {
        if (afters.length) {
            const part = afters.shift() as string;
            const overage = Math.max(result.length + part.length - MAX_LENGTH, 0);

            result = result + part.slice(0, part.length - overage) + '\n';
        }

        return prepend;
    }
}

function highlighte(mark: string, text: string, positions: Position[]) {
    return positions.reduceRight((result, position) => {
        const [before, content, after] = split(result, position);

        return `${before}<span class="${mark}">${content}</span>${after}`;
    }, text);
}

function split(text: string, position: Position) {
    const before = text.slice(0, position[0]);
    const content = text.slice(position[0], position[1]);
    const after = text.slice(position[1]);

    return [before, content, after];
}

function remap(dl: number, positions: Position[]): Position[] {
    return positions
        .map(([start, end]) => [start - dl, end - dl])
        .filter(([start]) => start >= 0) as [number, number][];
}
