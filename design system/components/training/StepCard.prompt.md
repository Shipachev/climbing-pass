Expanded current step: task, volume chip, instructions, last-session note, personal note, swipe right = done / left = skip.

```jsx
<StepCard index={5} total={9} title="Лазание на выносливость" meta="3 серии по 4 трассы"
  description="Выбирай трассы комфортной сложности…" prevNote={{date:'28 октября', text:'Третья серия далась тяжело.'}}
  note={note} onNoteChange={e=>setNote(e.target.value)} onSwipeDone={done} onSwipeSkip={skip} />
```

- Full-bleed on orange-50; black layer revealed behind while swiping.
- Gestures supplement — always pair with ActionBar buttons.
