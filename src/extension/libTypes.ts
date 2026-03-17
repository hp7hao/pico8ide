// Library types for the PICO-8 library/snippet plugin system

export interface Pico8Lib {
    id: string;
    name: string;
    description: string;
    author: string;
    version: string;
    tags: string[];
    depends?: string[];
    code: string;
    tokenCount: number;
    charCount: number;
}

export interface Pico8LibMeta {
    id: string;
    name: string;
    description: string;
    author: string;
    version: string;
    tags: string[];
    depends?: string[];
    tokenCount: number;
    charCount: number;
    source: 'bundled' | 'workspace';
}
