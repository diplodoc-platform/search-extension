import {Builder} from 'lunr';

type Langs = Record<string, (lunr: any) => Builder.Plugin>;

export const langs: Langs;
