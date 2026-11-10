# StudyFlow

A simple, offline-capable study organizer built with vanilla HTML, CSS, and JavaScript. All data is stored locally in your browser - no backend required.

## Features

- 📊 **Dashboard** - Overview of tasks, progress, and streaks
- ✅ **Task Manager** - Add, edit, delete, and filter tasks with priorities
- 📅 **Calendar** - Monthly view with task indicators
- ⏱️ **Pomodoro Timer** - Work/break cycles with session tracking
- 🎯 **Goals** - Weekly task and study hour targets
- 🎓 **GPA Calculator** - Academic standing, semester & cumulative GPA, and what-if targets
- ⚙️ **Settings** - Customize courses, timer, and manage data

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
'studyflow_subjects'  // Subject / Course categories (synchronized)
'studyflow_sessions'  // Pomodoro sessions
'studyflow_goals'     // Weekly goals
'studyflow_settings'  // App settings
'studyflow_courses'   // Unified courses, credit hours, components, colors, and scores
```

## Features in Detail

### Task Management
- Create tasks with title, due date, priority, and course
- Filter by status (All/Pending/Completed)
- Filter by priority and course
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
- Target cumulative GPA setting
- Daily progress breakdown
- Automatic weekly reset

### GPA Calculator
- Semester and cumulative credit-weighted GPA calculation
- Track assessment components with live running weights totaling 100
- "What do I need?" target breakdown on remaining points for in-progress courses
- Toggle to include in-progress projected course grades
- Focus hours tracked per unified course and academic unit

## Grading Scale & Course Defaults

### University Grading Scale Table
The default grading scale is defined centrally inside `js/gpa-utils.js` within `GRADING_SCALE`:

```javascript
const GRADING_SCALE = [
  { min: 93, gp: 4.00, letter: 'A',  label: 'Excellent' },
  { min: 90, gp: 3.70, letter: 'A-', label: 'Excellent' },
  { min: 87, gp: 3.30, letter: 'B+', label: 'Very Good' },
  { min: 83, gp: 3.00, letter: 'B',  label: 'Good' },
  { min: 80, gp: 2.70, letter: 'B-', label: 'Good' },
  { min: 77, gp: 2.30, letter: 'C+', label: 'Satisfactory' },
  { min: 73, gp: 2.00, letter: 'C',  label: 'Satisfactory' },
  { min: 70, gp: 1.70, letter: 'C-', label: 'Fair' },
  { min: 67, gp: 1.30, letter: 'D+', label: 'Poor' },
  { min: 63, gp: 1.00, letter: 'D',  label: 'Poor' },
  { min: 60, gp: 0.70, letter: 'D-', label: 'Very Poor' },
  { min: 0,  gp: 0.00, letter: 'F',  label: 'Fail' }
];
```

To modify grade boundaries or letter mappings, update the `GRADING_SCALE` array in `js/gpa-utils.js`.

### Default Course Assessment Weights
Every newly created course initializes with standard default assessment components summing to 100:
- Mid Exam: 30 points
- Final Exam: 60 points
- Class Assessment: 10 points

Users can add, remove, rename, and adjust max point values inside the course modal editor at any time. Assessment weights must always sum to exactly 100 before saving. To change the default weights across new courses, adjust `addCourse` in `js/storage.js` and `openCourseModal` in `js/gpa.js`.

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
