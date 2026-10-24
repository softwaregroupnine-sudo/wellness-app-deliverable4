Features and what they do
Authentication:	Register, log in, log out, saved login on the phone, and "Forgot password" by email link
Mood check-in:	Mood, feelings, note and optional stress, sleep and main-concern questions (one check-in per day)
Written Assessment: (CRUD module 1)	Describe feelings in your own words, get an emotion label and guidance. Create, read, edit (AI re-runs) and delete
Gratitude Journal: (CRUD module 2)	Create, read, edit and delete journal entries by date
AI Analysis	Patterns: mood trend and personalised suggestions based on check-ins and written assessments
Guidance and Dashboard:	AI-recommended activities, daily quote and streak
Activities:	Breathing Exercise, Focus Timer, Sleep Better, Move Your Body, Gratitude Journal, AI Chat
Settings:	Profile, notifications, trusted contact, campus and emergency contacts, study toolkit

Tech stack
Frontend: React Native with Expo, React Navigation (stack and tabs)
Backend: Python, Flask, REST API
Database: SQLite
AI: Groq API (openai/gpt-oss-120b)

to run one does need a groq API 

this is the setup for the backend

1. backend
pip install -r requirements.txt
cp .env.example .env        # Windows: copy .env.example .env

Then you have to open the .env file and set at least groq_API_KEY and SECRET_KEY.

There might be an error on different devices, depending what you have installed

after that is saved:
python backend/app.py

then for the frontend:
cd frontend
npm install

Open frontend/services/api.js and set API_BASE_URL to the address of the running backend:

the same-Wi-Fi address of the computer, for example http://192.xxx.1.xx:5000, or
a tunnel such as ngrok: run ngrok http 5000 and paste the https address.

if you use your address from your pc then you have to make sure that whatever devices you are cnnected to your app must have the same network connected on your device and mobile device.

if you use a tunnel like ngrok" run ngrok http 5000 and paste the https adress there instead

With ngrok you will not need to be in the same network, but when u start expo u gonna have to start it in tunnel mode.

Start the app and scan the QR code with Expo Go:


npx expo start

