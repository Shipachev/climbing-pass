Segmented progress bar — one segment per step; done orange, skipped grey, todo light.

```jsx
<ProgressSegments statuses={['done','done','skipped','todo']} />
```

- Skipped never counts as done.
- 8px tall on white, 10px on black.
