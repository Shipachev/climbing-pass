# ClimbPass — mobile PWA UI kit

Click-through recreation of the «Страва» direction (`ClimbPass Страва.dc.html`), composed from `components/`.

Flow: Главная → «Продолжить тренировку» → отметка этапов (кнопки или свайп) → «Завершить» → Главная в состоянии без тренировки → «Отметить посещение». Tab bar switches Программы (→ «Изменить» opens the editor), История (filter), Настройки (new membership sheet).

Files: `App.jsx` (state + routing), `Device.jsx` (390×844 frame + status bar, ScreenTitle), `HomeScreen.jsx`, `WorkoutScreen.jsx`, `ProgramsScreen.jsx` (+ EditorScreen), `HistoryScreen.jsx`, `SettingsScreen.jsx`, `data.js` (sample program & history).
