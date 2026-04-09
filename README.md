# StudyFlow

A simple, offline-capable study organizer built with vanilla HTML, CSS, and JavaScript. All data is stored locally in your browser - no backend required.

## Features

- 📊 **Dashboard** - Overview of tasks, progress, and streaks
- ✅ **Task Manager** - Add, edit, delete, and filter tasks with priorities
- 📅 **Calendar** - Monthly view with task indicators
- ⏱️ **Pomodoro Timer** - Work/break cycles with session tracking
- 🎯 **Goals** - Weekly task and study hour targets
- ⚙️ **Settings** - Customize subjects, timer, and manage data

## Tech Stack

- **HTML5** - Semantic markup
- **CSS3** - Custom properties, dark mode, responsive design
- **JavaScript** - Vanilla ES6+, no frameworks
- **Storage** - localStorage API

## Getting Started

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/studyflow.git
   cd studyflow
   ```

2. Open in browser:
   - Simply open `index.html` in your browser, OR
   - Use a local server: `python3 -m http.server 8000`

### Deploy

Upload to any static hosting service:
- GitHub Pages
- Netlify
- Vercel
- Cloudflare Pages

No build step required!

## Screenshots

### Dashboard
The main dashboard shows your daily stats, weekly progress, streak, and upcoming deadlines.

### Task Manager
Manage all your tasks with filters, search, and priority badges.

### Pomodoro Timer
Stay focused with the built-in Pomodoro timer featuring work/break cycles.

## Data Structure

All data is stored in localStorage under these keys:

```javascript
'studyflow_user'      // Profile settings
'studyflow_tasks'     // Task list
'studyflow_subjects'  // Subject categories
'studyflow_sessions'  // Pomodoro sessions
'studyflow_goals'     // Weekly goals
'studyflow_settings'  // App settings
```

## Features in Detail

### Task Management
- Create tasks with title, due date, priority, and subject
- Filter by status (All/Pending/Completed)
- Filter by priority and subject
- Real-time search
- Mark complete/incomplete with one click

### Pomodoro Timer
- Default: 25min work / 5min short break / 15min long break
- Configurable durations
- Sound notifications
- Session counter
- Keyboard shortcuts (Space: Start/Pause, R: Reset, S: Skip)

### Calendar
- Monthly grid view
- Task indicators on dates
- Click date to view/add tasks
- Navigate between months

### Goals
- Set weekly task completion target
- Set weekly study hours target
- Daily progress breakdown
- Automatic weekly reset

## Customization

### Colors
Edit `css/style.css` to change the color scheme:

```css
:root {
  --bg-primary: #030712;      /* Background */
  --primary: #2563EB;         /* Accent color */
  --text-primary: #F9FAFB;    /* Text color */
}
```

### Timer Defaults
Adjust in Settings or modify `js/storage.js`:

```javascript
const DEFAULTS = {
  settings: {
    work_duration: 25,
    short_break: 5,
    long_break: 15,
    sessions_until_long_break: 4
  }
};
```

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge
- Any modern browser with ES6+ support

## License

MIT License - feel free to use and modify!

---

Built with ❤️ for students who want a simple, reliable study tracker.
