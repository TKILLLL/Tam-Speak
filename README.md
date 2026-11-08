# TamSpeak

TamSpeak là ứng dụng luyện nói tiếng Anh tương tác với AI, tập trung vào hội thoại bằng giọng nói, phát âm IPA, luyện IELTS và nhận diện các tên riêng/địa danh đa ngôn ngữ.

## Tính năng

- Speaking AI với nhân vật hội thoại tự nhiên.
- Conversation Practice và IELTS Mock Test.
- Thu âm microphone bằng `MediaRecorder`, hỗ trợ desktop và mobile.
- Gửi audio trực tiếp tới Gemini để nhận diện lời nói, kể cả khi trình duyệt nhận diện sai.
- Phát hiện tiếng ồn/im lặng trước khi gọi AI.
- Điều chỉnh tốc độ giọng AI từ `0.5x` đến `1.5x` và lưu theo từng người dùng.
- Hỗ trợ touch recording trên iOS Safari và Android Chrome.
- Nhận diện, chuẩn hóa tên riêng và địa danh như `Bánh mì`, `Đồng Nai`, `Bình Dương`, `Phở`, `Xiemeng`.
- Pronunciation & IPA Lab để lưu và ôn lại lỗi phát âm.
- Vocabulary Bank, Quick Start, Q&A, Scoring và Vocab Hints.
- Đăng nhập Supabase, lưu phiên luyện tập và dữ liệu theo user.
- Lưu audio cục bộ bằng IndexedDB/Dexie.

## Công nghệ

- React 18 + TypeScript
- Vite
- Tailwind CSS
- Zustand
- Google Gemini REST API
- Supabase Auth/Postgres
- Dexie/IndexedDB
- Web Speech API và MediaRecorder API

## Yêu cầu

- Node.js 20 trở lên
- npm
- Trình duyệt hiện đại có microphone và Web Audio API
- HTTPS khi chạy production để trình duyệt cho phép truy cập microphone

## Cài đặt

```bash
git clone <repository-url>
cd tamspeak
npm install
cp .env.example .env
```

Điền các biến môi trường cần thiết trong `.env`:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_GEMINI_API_KEY=your-gemini-api-key
```

Gemini API Key cũng có thể được nhập trong mục **AI & Voice Settings**. Key cá nhân được lưu trong vùng Local Vault theo user.

## Chạy development

```bash
npm run dev
```

Mở URL Vite hiển thị trong terminal, thường là `http://localhost:5173`.

## Kiểm tra và build

```bash
# Kiểm tra TypeScript
npm run typecheck

# Chạy test domain, security và audio
npm test

# Build production
npm run build

# Preview build production
npm run preview
```

## Cấu trúc thư mục

```text
src/
├── application/       # Use cases và DTO
├── domain/            # Entity, value object, interface, domain error
├── infrastructure/
│   ├── ai/            # Gemini gateway, AI service và provider strategy
│   ├── audio/         # Recorder, STT/TTS, audio analyzer, phonetic normalizer
│   ├── database/      # Supabase và Dexie
│   ├── repositories/  # Repository implementations
│   └── security/      # Settings, vault, prompt guard, rate limiter
├── presentation/
│   ├── components/    # Layout, views, voice stage và right panels
│   └── store/         # Zustand application store
└── test/              # Automated tests
```

## Luồng xử lý giọng nói

1. Người dùng nhấn giữ hoặc chạm nút `Hold to Talk`.
2. TamSpeak mở khóa AudioContext trên thiết bị mobile.
3. Microphone stream được phân tích và ghi bằng MediaRecorder.
4. Audio quá ngắn hoặc không có tín hiệu giọng nói sẽ bị loại bỏ.
5. Blob audio được gửi dưới dạng Base64 `inlineData` tới Gemini transcription.
6. Transcript được chuẩn hóa tên riêng và đưa vào luồng hội thoại.
7. AI phản hồi bằng text và phát lại qua TTS theo tốc độ đã chọn.

## Cấu hình tên riêng

Vào **AI & Voice Settings → Từ vựng / tên riêng của tôi** và nhập các từ phân cách bằng dấu phẩy, ví dụ:

```text
Xiemeng, tên công ty, Đồng Nai, Bánh mì
```

> Các từ này được đưa vào ngữ cảnh nhận diện audio để hạn chế việc Gemini hoặc browser STT chuyển đổi thành từ tiếng Anh không liên quan.

## Lưu ý bảo mật

- Không commit file `.env` hoặc API key vào Git.
- Supabase cần bật Row Level Security cho các bảng dữ liệu người dùng.
- API key cá nhân được namespace theo user trong local storage.
- Prompt người dùng được xử lý qua lớp bảo vệ prompt trước khi gửi tới AI.
- Audio local có cơ chế TTL và chỉ được giữ lâu hơn khi người dùng bookmark.

## Các file quan trọng

- `src/infrastructure/ai/AIService.ts` — Gemini content generation và examiner flow.
- `src/infrastructure/ai/ResilientAIGateway.ts` — fallback provider và audio transcription.
- `src/infrastructure/audio/AudioRecorderEngine.ts` — ghi âm đa trình duyệt.
- `src/infrastructure/audio/WebSpeechTTSEngine.ts` — phát giọng AI và tốc độ nói.
- `src/infrastructure/audio/VietnameseEntityPhoneticNormalizer.ts` — chuẩn hóa tên riêng Việt Nam.
- `src/infrastructure/security/SettingsStore.ts` — cài đặt theo user.
- `src/presentation/components/voice-stage/HoldSpaceToTalk.tsx` — điều khiển thu âm.
- `src/presentation/components/views/SettingsView.tsx` — cấu hình API, giọng nói và từ riêng.

## Trạng thái xác minh hiện tại

Các lệnh sau đã được chạy thành công trong môi trường phát triển:

```text
npm run typecheck
npm test
npm run build
```
