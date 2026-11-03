Bottom bar holding the current step’s actions; follows the keyboard.

```jsx
<ActionBar>
  <Button variant="secondary" size="lg" icon="skip_next" fullWidth>Пропустить</Button>
  <Button size="lg" icon="check" fullWidth>Выполнено</Button>
</ActionBar>
```

- Prevents textarea blur on button press so taps never miss.
- Never put «Завершить тренировку» here while a step is open.
