# EMP project workspace mobile adaptation

## Goal

At phone widths (767px and below), provide a compact project workspace that prioritizes file identification, review notes, and signing. Tablet and desktop layouts keep their current behaviour.

## Behaviour

- The mobile header is a 44px return-and-project-name bar. A fixed avatar opens a downward menu containing available navigation, account actions, and a file search mode.
- The mobile file index has Ref, Filename, Notes, and Sign-off columns only. Ref is 88px, notes 48px, sign-off 80px; Ref and Filename wrap instead of truncating, and the row expands to show their complete text. Status and Smart Form completion labels are not shown.
- The Sign-off column has direct vertical P and R buttons. Each button is followed by the existing signer avatar or count, with no bottom sheet or signoff history on phone. Existing roles, self-review safeguards, and backend mutations remain authoritative.
- The menu displays administrative shortcuts only to users who already have permission to use them.

## Verification

- Component tests cover the phone-only layout, floating menu search, signing sheet actions, and history states.
- Browser verification covers a 390px phone and a 768px tablet regression.
