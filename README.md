# NavoPath

NavoPath is a personal project and calendar planner for students and anyone who wants to turn long-term goals into a daily schedule.

## What you can do

- Break projects into tasks and subtasks in a project tree.
- Pick what to work on today and drag tasks into open slots on your timeline.
- Review your schedule by day, week, or month and reschedule unfinished work.
- Ask the AI assistant to break down a task or suggest a schedule.
- Sign in to sync your projects and schedule across devices.

## Installation and requirements

| Option | Installation and startup | Requirements |
| --- | --- | --- |
| Web app | Open the [NavoPath web app](https://navopath.com/app) and sign in or create an account. | A modern browser and an internet connection. |
| Windows desktop | Download `NavoPath-Setup.exe` from the [latest stable release](https://github.com/shawn89890916/NavoPath-planner/releases/latest) and run it. For a portable copy, download and open `NavoPath-Portable.exe` from the same page. | Windows. |
| Run from source | Clone this repository and open its folder. Run `npm ci`, then `npx vite` and open [the local app](http://127.0.0.1:5173/app). On Windows, use `npm run dev` after installing dependencies to start Vite and Electron together. | Git, Node.js 24, and npm. Browser preview stores data locally and works without cloud configuration. |
| Self-host with cloud sync | Follow the [web deployment guide](docs/dayflow-web-deploy.md) to set up the backend and deploy the web app. | Node.js 24, npm, and a Supabase project for accounts and sync. |
