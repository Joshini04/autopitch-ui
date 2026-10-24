# AutoPitch AI: Frontend

React interface for AutoPitch AI, an AI-assisted outreach platform. It lets you review the leads the pipeline found, read the AI's company research and fit score, edit the drafted email, and approve it before anything is sent.

Backend (Node.js + Express API, RAG pipeline): https://github.com/Joshini04/autopitch-Updated

## Screens

- **Leads:** filterable table of contacts with score and status. Selecting a lead shows the AI research summary, the reasons behind its score, and an editable email with Approve and Reject buttons.
- **Run:** enter a seed domain and a description of your ideal lead to find new contacts.
- **Knowledge:** add notes about yourself or your offer. The AI retrieves the best-matching notes by meaning when it writes each email.

## Tech stack

React, Vite, plain CSS. The app talks to the backend over a REST API.

## Running locally

    git clone https://github.com/Joshini04/autopitch-ui.git
    cd autopitch-ui
    npm install
    npm run dev

By default the app calls the backend at http://localhost:3000. To use another backend, create a .env file with:

    VITE_API_URL=https://your-backend-address

Start the backend from the autopitch-Updated repo first.

## Notes

- Sending is controlled on the backend by a dry-run setting, so approving a draft does not send an email unless that is switched on.
- The backend runs on a free hosting plan that sleeps when idle, so the first request after a pause can take about a minute.

