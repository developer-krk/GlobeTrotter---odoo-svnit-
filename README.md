# 🌍 GlobeTrotter

GlobeTrotter is a personalized travel planning web application that helps users
create, organize, and share multi-city travel itineraries.

The application allows users to plan trips by adding cities, activities,
travel dates, and budgets while providing an interactive view of their complete
journey.

---

## 🚀 Features

- 🔐 User Registration & Login
- 👤 User Profile & Settings
- 🏠 Personalized Dashboard
- ✈️ Create and Manage Trips
- 🗺️ Multi-City Itinerary Builder
- 🏙️ City Search
- 🎯 Activity Search
- 📅 Trip Calendar & Timeline
- 💰 Trip Budget & Cost Breakdown
- 📊 Budget Visualization
- 🔗 Shareable Public Itineraries
- 📋 Copy Existing Trips
- 🔑 Forgot Password
- 👨‍💼 Admin Dashboard *(Optional)*

---

## 🛠️ Tech Stack

### Frontend

- React.js
- React Router DOM
- Tailwind CSS
- Axios
- React Hook Form
- Recharts
- FullCalendar
- @dnd-kit
- date-fns

### Backend

- Node.js
- Express.js
- Passport.js
- express-session
- bcrypt
- Sequelize
- Multer

### Database

- MySQL

### External APIs

- Google Places API
- Google Calendar API

### Other Services

- Nodemailer
- Cloudinary *(Optional)*

---

## 🏗️ Project Architecture

```text
GlobeTrotter
│
├── client/                     # React Frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── layouts/
│   │   ├── services/
│   │   ├── hooks/
│   │   └── App.jsx
│   │
│   └── package.json
│
├── server/                     # Node.js + Express Backend
│   ├── controllers/
│   ├── routes/
│   ├── models/
│   ├── middleware/
│   ├── services/
│   ├── config/
│   ├── utils/
│   └── server.js
│
├── .env
├── .gitignore
└── README.md
