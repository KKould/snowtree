export type DiffTarget =
  | { kind: 'working'; scope?: 'all' | 'staged' | 'unstaged' | 'untracked' }
  | { kind: 'commit'; hash: string };
