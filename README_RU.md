# AI Clips - Транскрипция видео и генерация клипов

> 🌐 **Язык:** [English](README.md) | Русский

Полнофункциональное приложение для транскрипции видео, поиска интересных моментов с помощью ИИ и создания коротких клипов с синхронизированными субтитрами.

## Быстрые ссылки

| Руководство | Описание |
|-------------|----------|
| **[Локальная разработка](docs/LOCAL_DEVELOPMENT.md)** | Полное руководство по развёртыванию |
| [Local Development (EN)](docs/LOCAL_DEVELOPMENT_EN.md) | English deployment guide |
| [Руководство пользователя](docs/USAGE_GUIDE.md) | Как использовать приложение |
| [API Документация](http://localhost:8000/docs) | Swagger/OpenAPI (после запуска) |

---

## Обзор архитектуры

```
┌─────────────────────────────────────────────────────────────────┐
│                        AI CLIPS STACK                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │  Frontend   │───▶│   Backend   │───▶│   Whisper   │         │
│  │   (React)   │    │  (FastAPI)  │    │   (Local)   │         │
│  │  Port 5173  │    │  Port 8000  │    │  MPS/CUDA   │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│         │                  │                  │                 │
│         │                  ▼                  ▼                 │
│         │           ┌─────────────┐    ┌─────────────┐         │
│         │           │   FFmpeg    │    │  OpenRouter │         │
│         │           │  (Рендер)   │    │  (Gemini)   │         │
│         │           └─────────────┘    └─────────────┘         │
│         │                  │                                    │
│         ▼                  ▼                                    │
│  ┌──────────────────────────────────────────────────┐          │
│  │              /videos (Исходные файлы)            │          │
│  └──────────────────────────────────────────────────┘          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Основные технологии

| Компонент | Технология | Назначение |
|-----------|------------|------------|
| **Транскрипция** | OpenAI Whisper | Распознавание речи с пословными таймкодами |
| **ИИ анализ** | Gemini (через OpenRouter) | Поиск интересных моментов |
| **Обработка видео** | FFmpeg | Извлечение аудио, рендеринг клипов |
| **Backend** | FastAPI + Python | REST API, WebSocket прогресс |
| **Frontend** | React + Vite + TypeScript | Пользовательский интерфейс |

### Модели Whisper

Whisper работает **полностью локально** на вашем компьютере:

| Модель | Размер | Скорость* | Качество | Рекомендация |
|--------|--------|-----------|----------|--------------|
| `tiny` | 75 MB | 32x | ⭐⭐ | Быстрые тесты |
| **`base`** | 142 MB | 16x | ⭐⭐⭐ | **Рекомендуется** |
| `small` | 466 MB | 6x | ⭐⭐⭐⭐ | Лучше точность |
| `medium` | 1.5 GB | 2x | ⭐⭐⭐⭐⭐ | Высокое качество |
| `large` | 2.9 GB | 1x | ⭐⭐⭐⭐⭐ | Максимальное качество |

*Скорость относительно реального времени на Apple M1 с MPS ускорением

---

## Предварительные требования

### Необходимое ПО

| Софт | Минимальная версия | Скачать | Примечание |
|------|-------------------|---------|------------|
| **Node.js** | 20.x и выше | [nodejs.org](https://nodejs.org/) | Frontend |
| **Python** | 3.11 и выше | [python.org](https://www.python.org/) | Backend + Whisper |
| **FFmpeg** | 6.x и выше | `brew install ffmpeg` | Обработка аудио/видео |
| **Docker** | 24.x (опционально) | [docker.com](https://www.docker.com/) | Альтернативный способ запуска |

### Проверка установки

```bash
# Проверить Node.js
node --version  # Должно показать v20.x.x или выше

# Проверить Python
python3 --version  # Должно показать Python 3.11.x или выше

# Проверить FFmpeg (обязательно!)
ffmpeg -version  # Должно показать ffmpeg version 6.x или выше

# Проверить Docker (опционально - для контейнерного развёртывания)
docker --version  # Должно показать Docker version 24.x.x или выше
```

### Необходимые API ключи

- **OpenRouter API Key** - Для ИИ-анализа с использованием моделей Gemini
  - Получить ключ: [https://openrouter.ai/keys](https://openrouter.ai/keys)

---

## Установка

### 1. Клонирование репозитория

```bash
git clone https://github.com/Serg1kk/clipmaker.git
cd clipmaker
```

### 2. Создание файла конфигурации

Создайте файл `.env` в корне проекта:

```bash
# Скопировать пример (если доступен) или создать новый
cp video-transcription-app/.env.example .env

# Или создать вручную
touch .env
```

Добавьте в `.env` следующую конфигурацию:

```env
# ============================================================================
# ОБЯЗАТЕЛЬНО: API ключи
# ============================================================================

# OpenRouter API ключ для доступа к Gemini
# Получить здесь: https://openrouter.ai/keys
OPENROUTER_API_KEY=sk-or-v1-ваш-api-ключ

# ============================================================================
# ОБЯЗАТЕЛЬНО: Путь к видео
# ============================================================================

# Путь к папке с вашими видео файлами
# Backend будет иметь доступ ТОЛЬКО НА ЧТЕНИЕ к этой папке
# Примеры:
#   macOS: /Users/yourname/Videos
#   Linux: /home/yourname/Videos
VIDEO_SOURCE_PATH=~/Videos

# ============================================================================
# ОПЦИОНАЛЬНО: Настройки моделей
# ============================================================================

# Модель Gemini через OpenRouter
# Варианты: google/gemini-2.5-pro-preview, google/gemini-pro, google/gemini-1.5-pro
GEMINI_MODEL=google/gemini-2.5-pro-preview

# Размер модели Whisper для транскрипции
# Варианты: tiny, base, small, medium, large
# Рекомендуется для 16GB RAM: base или small
WHISPER_MODEL=base

# ============================================================================
# ОПЦИОНАЛЬНО: Настройки обработки
# ============================================================================

# Максимум параллельных задач
MAX_CONCURRENT_JOBS=2

# Ограничения длительности клипов (секунды)
CLIP_MIN_DURATION=13
CLIP_MAX_DURATION=60

# Пресет кодирования FFmpeg: ultrafast, superfast, fast, medium, slow
FFMPEG_PRESET=medium

# FFmpeg CRF (качество): 18-28 рекомендуется, меньше = лучше качество
FFMPEG_CRF=23
```

---

## Запуск с Docker

### Сборка и запуск всех сервисов

```bash
# Собрать Docker образы
docker compose build

# Запустить все сервисы в фоновом режиме
docker compose up -d

# Или собрать и запустить одной командой
docker compose up -d --build
```

### Просмотр логов

```bash
# Логи всех сервисов
docker compose logs -f

# Логи конкретного сервиса
docker compose logs -f backend
docker compose logs -f frontend
```

### Остановка сервисов

```bash
# Остановить все сервисы
docker compose down

# Остановить и удалить volumes (очистит данные)
docker compose down -v
```

---

## Доступ к приложению

После запуска сервисов, приложение доступно по адресам:

| Сервис | URL | Описание |
|--------|-----|----------|
| **Frontend** | [http://localhost:3000](http://localhost:3000) | React веб-интерфейс |
| **Backend API** | [http://localhost:8000](http://localhost:8000) | FastAPI REST endpoints |
| **API Docs** | [http://localhost:8000/docs](http://localhost:8000/docs) | Swagger/OpenAPI документация |

### Проверка работоспособности

```bash
# Проверить backend
curl http://localhost:8000/health

# Проверить frontend
curl -I http://localhost:3000
```

---

## Разработка (без Docker)

### Backend

```bash
cd backend

# Создать виртуальное окружение
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Установить зависимости
pip install -r requirements.txt

# Запустить сервер разработки
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend

# Установить зависимости
npm install

# Запустить сервер разработки
npm run dev
```

---

## Структура проекта

```
clipmaker/
├── backend/                    # FastAPI Backend
│   ├── main.py                 # Точка входа и API роуты
│   ├── Dockerfile              # Конфигурация контейнера
│   ├── requirements.txt        # Python зависимости
│   ├── models/                 # Pydantic модели данных
│   ├── routers/                # API роутеры
│   └── services/               # Бизнес-логика
│       ├── ffmpeg_service.py       # Обработка видео/аудио
│       ├── whisper_service.py      # Транскрипция речи
│       ├── render_service.py       # Рендеринг клипов
│       └── engaging_moments.py     # ИИ поиск моментов
│
├── frontend/                   # React Frontend (Vite + TypeScript)
│   ├── Dockerfile              # Конфигурация контейнера
│   ├── package.json            # Node.js зависимости
│   └── src/
│       ├── pages/              # Страницы
│       └── components/         # UI компоненты
│
├── docs/                       # Документация
│   ├── LOCAL_DEVELOPMENT.md    # Руководство (RU)
│   └── LOCAL_DEVELOPMENT_EN.md # Guide (EN)
│
├── videos/                     # Папка для исходных видео
├── output/                     # Готовые клипы
├── docker-compose.yml          # Оркестрация контейнеров
├── .env                        # Конфигурация (создать!)
├── README.md                   # Документация (EN)
└── README_RU.md                # Документация (RU) - этот файл
```

---

## Решение проблем

### Частые проблемы

**Docker не собирается на ARM64/M1 Mac:**
```bash
# Обновите Docker Desktop и пересоберите без кэша
docker compose build --no-cache
```

**Порт уже занят:**
```bash
# Проверить что использует порт
lsof -i :3000
lsof -i :8000

# Убить процесс или изменить порты в docker-compose.yml
```

**Ошибки OpenRouter API:**
- Проверьте правильность API ключа в `.env`
- Проверьте баланс на вашем аккаунте OpenRouter
- Убедитесь что название модели корректно (например, `google/gemini-2.5-pro-preview`)

**Нет доступа к видео файлам:**
- Убедитесь что `VIDEO_SOURCE_PATH` указывает на существующую папку
- Проверьте что Docker имеет права на монтирование этой директории

---

## Лицензия

MIT License - см. [LICENSE](LICENSE)
