export type ConsoleMode = 'play' | 'edit';

// Edit is a transient state entered via the "Edit layout" button and exited with
// Done/Discard, so it is intentionally not persisted — the console always loads in
// operate ('play') mode.
