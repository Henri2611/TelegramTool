# 📄 implementation.md

## 1. Project Overview

**Project Name:** Telegram Bulk Group Manager

This is a web-based tool that allows users to log into their Telegram account and manage their groups/channels efficiently, with a primary focus on bulk leaving groups.

The system acts as a Telegram client interface, not a bot, leveraging Telegram’s client APIs to perform authenticated user actions.

---

## 2. Objectives

- Allow secure Telegram authentication via phone number (OTP + optional 2FA)
- Fetch and display all user groups/channels
- Enable multi-selection of groups
- Allow bulk leaving of selected groups
- Ensure safe interaction with Telegram API (rate limiting, delays)

---

## 3. High-Level Architecture

```
Frontend (React)
    ↓
Backend API (FastAPI)
    ↓
Telegram Client Layer (Telethon)
    ↓
Telegram Servers
```

---

## 4. Tech Stack

### Frontend
- React (Vite)
- Tailwind CSS
- Zustand (state management)
- Axios (API calls)

### Backend
- Python
- FastAPI
- Telethon

### Storage
- **MVP:** Local `.session` files (Telethon)
- **Future:** PostgreSQL / Redis (for session storage)

---

## 5. Core Features

### Authentication
- Phone number input
- OTP verification
- Optional 2FA password
- Persistent session storage

### Group Management
- Fetch all groups and channels
- Display metadata:
  - Title
  - Type
  - Last activity
  - Muted status

### Bulk Actions
- Multi-select groups
- Leave selected groups
- Progress tracking

### UX Enhancements
- Search groups
- Filters (inactive, muted, type)
- Progress indicator during operations

---

## 6. Database / Storage Design

### MVP Approach
No traditional database required initially.

Use:
- Telethon `.session` files per user

### Future Design (Optional)

#### Users Table
- `id`
- `phone_number`
- `session_data` (encrypted)

#### Groups Cache Table (optional)
- `id`
- `user_id`
- `group_id`
- `title`
- `last_activity`

---

## 7. API Design

### Auth Endpoints

#### `POST /auth/send-code`
**Body:**
```json
{ "phone": "+254..." }
```

#### `POST /auth/verify-code`
**Body:**
```json
{ "phone": "+254...", "code": "12345" }
```

#### `POST /auth/2fa`
**Body:**
```json
{ "password": "your_2fa_password" }
```

---

### Groups Endpoint

#### `GET /groups`

**Response:**
```json
[
  {
    "id": "12345",
    "title": "Crypto Signals",
    "type": "channel",
    "lastMessageDate": "...",
    "isMuted": true
  }
]
```

---

### Bulk Action Endpoint

#### `POST /leave-groups`

**Body:**
```json
{
  "groupIds": ["123", "456"]
}
```

---

## 8. Telegram Service Layer (Telethon)

### Initialization
- Use `api_id` and `api_hash`
- Create session per user

### Authentication Flow
- Send OTP
- Verify OTP
- Handle 2FA if required
- Save session

### Fetch Groups
- Use `client.get_dialogs()`
- Filter:
  - Groups
  - Channels

### Leave Groups
- Iterate through selected group IDs
- Call:
  ```python
  client.delete_dialog(group_id)
  ```
- Apply delay between actions

---

## 9. Rate Limiting Strategy

To prevent Telegram bans:

- Delay: **2 seconds** between leave actions
- Max throughput: **~20–30 groups per minute**

Failure to respect this may result in:
- Temporary restrictions
- Account flags

---

## 10. Frontend Design

### Pages

#### Auth Page
- Phone input
- OTP input
- 2FA input (conditional)

#### Dashboard Page

**Components:**
- Group List
- Checkbox per item
- Group metadata display

**Filters:**
- Search bar
- Type filter (group/channel)
- Muted filter
- Activity filter

**Bulk Action Panel:**
- Select All
- Leave Selected
- Progress indicator

---

## 11. Application Flow

1. User enters phone number  
2. Backend sends OTP via Telegram  
3. User submits OTP  
4. Session is created and stored  
5. User fetches groups  
6. Groups displayed in UI  
7. User selects multiple groups  
8. User triggers “Leave Selected”  
9. Backend processes requests sequentially with delay  
10. UI shows progress updates  

---

## 12. Project Structure

### Frontend
```
/src
  /components
  /pages
  /store
  /api
```

### Backend
```
/server
  app.py
  /routes
    auth.py
    groups.py
  /services
    telegram_service.py
```

---

## 13. Implementation Plan

### Phase 1 – Setup
- Initialize frontend (React + Vite)
- Initialize backend (FastAPI)
- Install Telethon

### Phase 2 – Authentication
- Implement send code
- Implement verify code
- Handle session storage

### Phase 3 – Group Fetching
- Fetch dialogs
- Filter groups/channels
- Expose API endpoint

### Phase 4 – UI Integration
- Build dashboard
- Display groups
- Add selection logic

### Phase 5 – Bulk Leave Feature
- Implement backend loop with delay
- Connect frontend action
- Add progress indicator

### Phase 6 – UX Improvements
- Filters
- Search
- Feedback states

---

## 14. Risks & Constraints

- Telegram does not officially support bulk operations
- Aggressive usage may result in temporary bans
- Requires careful rate limiting and responsible usage

---

## 15. Future Improvements

- Undo queue (delayed execution)
- Advanced filters (inactive groups detection)
- Session persistence in database
- Migration to TDLib for production