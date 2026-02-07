# Task Manager - პერსონალური ტასკების მენეჯერი

პერსონალური ტასკების მენეჯმენტის აპლიკაცია Offline-First არქიტექტურით.

## ფუნქციონალი

- **ტაბების სისტემა**: "დღეს", "ყველა" და მომხმარებლის შექმნილი ტაბები
- **იერარქიული ტასკები**: მაქსიმუმ 3 დონე სიღრმე (parent → child → grandchild)
- **ვადების მართვა**: ტასკებს შესაძლოა ქონდეთ due date
- **Offline-First**: მობილურზე მუშაობს ლოკალურად, სინქრონიზდება პერიოდულად
- **Google ავტორიზაცია**: უსაფრთხო შესვლა Google ანგარიშით

## არქიტექტურა

### Frontend (React Native + Expo)
- **მობილური**: ლოკალური SQLite + პერიოდული სინქრონიზაცია
- **ვები**: პირდაპირი კავშირი სერვერთან

### Backend (Python + FastAPI)
- REST API
- MSSQL მონაცემთა ბაზა Stored Procedures-ით

## პროექტის სტრუქტურა

```
.v1/
├── frontend/           # React Native (Expo)
│   ├── app/           # Expo Router screens
│   ├── src/
│   │   ├── components/  # UI კომპონენტები
│   │   ├── services/    # API, LocalDB, Sync
│   │   ├── store/       # Zustand state
│   │   └── types/       # TypeScript ტიპები
│   └── package.json
│
├── backend/            # Python FastAPI
│   ├── app/
│   │   ├── routers/     # API endpoints
│   │   ├── schemas/     # Pydantic models
│   │   └── database/    # DB connection
│   └── requirements.txt
│
└── database/           # SQL Scripts
    ├── schema.sql
    └── stored_procedures.sql
```

## გაშვება

### მოთხოვნები
- Node.js 18+
- Python 3.10+
- MSSQL Server
- ODBC Driver 17 for SQL Server

### მონაცემთა ბაზა

1. შექმენით ბაზა `TaskManager`
2. გაუშვით `database/schema.sql`
3. გაუშვით `database/stored_procedures.sql`

### Backend

```bash
cd backend

# ვირტუალური გარემო
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# დეპენდენციები
pip install -r requirements.txt

# .env ფაილი
copy .env.example .env
# შეავსეთ კონფიგურაცია

# გაშვება
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend

# დეპენდენციები
npm install

# გაშვება
npm start
# ან
npx expo start

# Web-ისთვის
npm run web

# Android-ისთვის
npm run android

# iOS-ისთვის
npm run ios
```

## კონფიგურაცია

### Backend (.env)

```env
DEBUG=true
DB_SERVER=localhost
DB_NAME=TaskManager
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-secret
JWT_SECRET_KEY=your-secret-key
```

### Frontend

შექმენით `.env` ფაილი frontend-ში:

```env
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB=your-web-client-id
EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS=your-ios-client-id
EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID=your-android-client-id
```

## API Endpoints

### Authentication
- `POST /auth/google` - Google OAuth
- `GET /auth/me` - მიმდინარე მომხმარებელი

### Tasks
- `GET /tasks/today` - დღევანდელი ტასკები
- `GET /tasks/all` - ყველა ტასკი
- `GET /tasks/tab/{tab_id}` - ტაბის ტასკები
- `POST /tasks` - ახალი ტასკი
- `PUT /tasks/{id}/complete` - ტასკის შესრულება
- `DELETE /tasks/{id}` - ტასკის წაშლა

### Tabs
- `GET /tabs` - ტაბების სია
- `POST /tabs` - ახალი ტაბი
- `PUT /tabs/{id}` - ტაბის რედაქტირება
- `DELETE /tabs/{id}` - ტაბის წაშლა

### Sync (მობილურისთვის)
- `POST /sync/pull` - სერვერიდან ცვლილებები
- `POST /sync/push` - ლოკალური ცვლილებების გაგზავნა
- `POST /sync/resolve` - კონფლიქტის გადაწყვეტა

## სინქრონიზაცია

მობილური აპლიკაცია იყენებს Offline-First მიდგომას:

1. **ლოკალური ბაზა**: SQLite expo-sqlite-ით
2. **პერიოდული სინქი**: ყოველ 5 წუთში
3. **Exit Sync**: აპლიკაციიდან გასვლისას
4. **კონფლიქტის გადაწყვეტა**: მომხმარებელს ვკითხავთ

## ლიცენზია

MIT
