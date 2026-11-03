Multi-line note field — «Моя заметка» on main-part steps.

```jsx
<TextArea label="Моя заметка" value={note} onChange={e => setNote(e.target.value)} />
```

- On focus, scroll it above the keyboard and lift the ActionBar (keyboardOffset).
