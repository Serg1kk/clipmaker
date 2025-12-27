# Local Development Guide

Полное руководство по развёртыванию AI Clips на локальной машине (macOS/Linux).

---

## Содержание

1. [Предварительные требования](#1-предварительные-требования)
2. [Клонирование репозитория](#2-клонирование-репозитория)
3. [Установка FFmpeg](#3-установка-ffmpeg)
4. [Настройка Python и Whisper](#4-настройка-python-и-whisper)
5. [Настройка папки с видео](#5-настройка-папки-с-видео)
6. [Настройка Backend](#6-настройка-backend)
7. [Настройка Frontend](#7-настройка-frontend)
8. [Запуск приложения](#8-запуск-приложения)
9. [Проверка работоспособности](#9-проверка-работоспособности)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Предварительные требования

### Необходимое ПО

| Software | Версия | Проверка | Установка |
|----------|--------|----------|-----------|
| **Node.js** | 20+ | `node --version` | [nodejs.org](https://nodejs.org/) |
| **Python** | 3.11+ | `python3 --version` | [python.org](https://python.org/) |
| **FFmpeg** | 6+ | `ffmpeg -version` | См. раздел 3 |
| **Git** | любая | `git --version` | [git-scm.com](https://git-scm.com/) |

### API ключи

| Сервис | Назначение | Получить |
|--------|------------|----------|
| **OpenRouter** | AI анализ (Gemini) | [openrouter.ai/keys](https://openrouter.ai/keys) |

---

## 2. Клонирование репозитория

```bash
# Перейти в папку для проектов
cd ~/Projects  # или другая папка

# Клонировать репозиторий
git clone https://github.com/YOUR_USERNAME/ai-clips.git

# Перейти в папку проекта
cd ai-clips
```

### Структура проекта после клонирования

```
ai-clips/
├── backend/           # FastAPI сервер + Whisper
├── frontend/          # React приложение
├── docker/            # Docker конфигурации
├── docs/              # Документация
├── videos/            # Папка для исходных видео
├── output/            # Результаты рендеринга
├── uploads/           # Временные загрузки
├── docker-compose.yml
├── README.md
└── .env.example
```

---

## 3. Установка FFmpeg

FFmpeg используется для:
- Извлечения аудио из видео (для Whisper)
- Рендеринга финальных клипов с субтитрами
- Конвертации форматов

### macOS (через Homebrew)

```bash
# Установить Homebrew если нет
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Установить FFmpeg
brew install ffmpeg

# Проверить установку
ffmpeg -version
# Должно показать: ffmpeg version 7.x.x ...
```

### Ubuntu/Debian Linux

```bash
sudo apt update
sudo apt install ffmpeg

# Проверить
ffmpeg -version
```

### Windows (WSL2)

```bash
# В WSL2 терминале
sudo apt update
sudo apt install ffmpeg
```

---

## 4. Настройка Python и Whisper

### Whisper - Модели транскрипции

Whisper - это нейросеть от OpenAI для распознавания речи. Работает **полностью локально**.

| Модель | Размер | RAM | Скорость* | Качество | Рекомендация |
|--------|--------|-----|-----------|----------|--------------|
| `tiny` | 75 MB | 4 GB | 32x | ⭐⭐ | Быстрые тесты |
| **`base`** | 142 MB | 4 GB | 16x | ⭐⭐⭐ | **Рекомендуется** |
| `small` | 466 MB | 6 GB | 6x | ⭐⭐⭐⭐ | Лучше качество |
| `medium` | 1.5 GB | 10 GB | 2x | ⭐⭐⭐⭐⭐ | Высокое качество |
| `large` | 2.9 GB | 16 GB | 1x | ⭐⭐⭐⭐⭐ | Максимальное качество |

*Скорость относительно реального времени на Apple M1

### Ускорение на разных платформах

| Платформа | GPU ускорение | Как работает |
|-----------|---------------|--------------|
| **Mac M1/M2/M3** | ✅ MPS (Metal) | Автоматически |
| **NVIDIA GPU** | ✅ CUDA | Автоматически |
| **CPU only** | ❌ | Медленнее в 3-5x |

### Создание виртуального окружения

```bash
# Перейти в папку backend
cd backend

# Создать виртуальное окружение
python3 -m venv venv

# Активировать окружение
# macOS/Linux:
source venv/bin/activate
# Windows:
# .\venv\Scripts\activate

# Проверить что активировано
which python
# Должно показать: /path/to/ai-clips/backend/venv/bin/python
```

### Установка зависимостей

```bash
# Обновить pip
pip install --upgrade pip

# Установить зависимости
pip install -r requirements.txt
```

**Время установки:** ~5-10 минут (PyTorch большой)

### Первый запуск Whisper (скачивание модели)

При первом использовании Whisper автоматически скачает модель:

```bash
# Тестовый запуск для скачивания модели
python -c "import whisper; whisper.load_model('base')"
```

Модель сохраняется в `~/.cache/whisper/` (~150MB для base)

---

## 5. Настройка папки с видео

У вас есть **3 варианта** как организовать работу с видео:

### Вариант A: Папка в проекте (рекомендуется для начала)

```bash
# Создать папку videos в проекте
mkdir -p videos

# Скопировать тестовое видео
cp ~/Downloads/test-video.mp4 videos/
```

**Плюсы:** Всё в одном месте, легко бэкапить
**Минусы:** Видео занимают место в папке проекта

### Вариант B: Системная папка Videos

```bash
# Создать папку если нет
mkdir -p ~/Videos/ai-clips-source

# В .env указать путь
VIDEO_SOURCE_PATH=~/Videos/ai-clips-source
```

**Плюсы:** Видео отдельно от кода, не мешает git
**Минусы:** Нужно помнить где файлы

### Вариант C: Симлинк на любую папку

```bash
# Создать символическую ссылку на существующую папку с видео
ln -s /Volumes/ExternalDrive/MyVideos ./videos

# Или на папку в iCloud/Dropbox
ln -s ~/Library/Mobile\ Documents/com~apple~CloudDocs/Videos ./videos
```

**Плюсы:** Используете существующую структуру
**Минусы:** Нужно следить за доступностью диска

### Проверка доступа

```bash
# Проверить что папка существует и содержит видео
ls -la videos/

# Должно показать ваши видео файлы
# -rw-r--r--  1 user  staff  50000000 Dec 27 10:00 video.mp4
```

---

## 6. Настройка Backend

### Создание конфигурационного файла

```bash
# В корне проекта создать .env
cd ..  # выйти из backend в корень проекта

cat > .env << 'EOF'
# ============================================
# API Keys
# ============================================
OPENROUTER_API_KEY=sk-or-v1-ваш-ключ-здесь

# ============================================
# Video Source
# ============================================
# Вариант A: папка в проекте
VIDEO_SOURCE_PATH=./videos

# Вариант B: системная папка
# VIDEO_SOURCE_PATH=~/Videos/ai-clips-source

# ============================================
# Whisper Configuration
# ============================================
# Модели: tiny, base, small, medium, large
WHISPER_MODEL=base

# ============================================
# Processing Settings
# ============================================
MAX_CONCURRENT_JOBS=2
CLIP_MIN_DURATION=13
CLIP_MAX_DURATION=60

# ============================================
# FFmpeg Settings
# ============================================
# Presets: ultrafast, superfast, fast, medium, slow
FFMPEG_PRESET=medium
# CRF: 18 (лучшее качество) - 28 (меньше размер)
FFMPEG_CRF=23
EOF
```

### Получение OpenRouter API ключа

1. Зайти на [openrouter.ai](https://openrouter.ai/)
2. Зарегистрироваться/войти
3. Перейти в [API Keys](https://openrouter.ai/keys)
4. Нажать "Create Key"
5. Скопировать ключ (начинается с `sk-or-v1-`)
6. Вставить в `.env` файл

---

## 7. Настройка Frontend

```bash
# Перейти в папку frontend
cd frontend

# Установить зависимости
npm install
```

**Время установки:** ~2-3 минуты

---

## 8. Запуск приложения

### Запуск Backend (Терминал 1)

```bash
# Убедиться что в корне проекта
cd /path/to/ai-clips

# Активировать виртуальное окружение
source backend/venv/bin/activate

# Перейти в backend
cd backend

# Запустить сервер
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Вы увидите:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [12345]
INFO:     Started server process [12346]
INFO:     Application startup complete.
```

### Запуск Frontend (Терминал 2)

```bash
# В новом терминале
cd /path/to/ai-clips/frontend

# Запустить dev сервер
npm run dev
```

Вы увидите:
```
  VITE v5.x.x  ready in 500 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.1.100:5173/
```

---

## 9. Проверка работоспособности

### Проверить Backend API

```bash
# Health check
curl http://localhost:8000/health

# Ожидаемый ответ:
# {"status":"healthy","timestamp":"...","version":"1.0.0"}

# Проверить список видео
curl http://localhost:8000/files

# API документация
open http://localhost:8000/docs
```

### Проверить Frontend

1. Открыть в браузере: http://localhost:5173/
2. Должна загрузиться главная страница
3. Проверить что видео из папки отображаются

### Тест транскрипции

1. Выбрать видео в интерфейсе
2. Нажать "Transcribe"
3. Дождаться завершения (прогресс в реальном времени)
4. Проверить результат с таймстампами

---

## 10. Troubleshooting

### Whisper не находит GPU (Mac)

```bash
# Проверить доступность MPS
python -c "import torch; print(f'MPS available: {torch.backends.mps.is_available()}')"

# Если False - обновить PyTorch
pip install --upgrade torch torchvision torchaudio
```

### FFmpeg не найден

```bash
# Проверить установку
which ffmpeg
# Должен показать путь, например /opt/homebrew/bin/ffmpeg

# Если пусто - переустановить
brew reinstall ffmpeg
```

### Ошибка "Module not found"

```bash
# Убедиться что виртуальное окружение активно
which python
# Должно показать путь в venv, НЕ /usr/bin/python

# Если нет - активировать
source backend/venv/bin/activate
```

### Порт 8000 занят

```bash
# Найти процесс
lsof -i :8000

# Убить процесс
kill -9 <PID>

# Или использовать другой порт
uvicorn main:app --reload --port 8001
```

### Видео не отображаются

```bash
# Проверить папку videos
ls -la videos/

# Проверить права доступа
chmod 755 videos/
chmod 644 videos/*.mp4

# Проверить что формат поддерживается
# Поддерживаются: .mp4, .mov, .avi, .mkv, .webm, .m4v
```

### Ошибка OpenRouter API

```bash
# Проверить что ключ установлен
echo $OPENROUTER_API_KEY
# или
grep OPENROUTER .env

# Проверить баланс на openrouter.ai/credits
```

---

## Быстрый старт (TL;DR)

```bash
# 1. Клонировать
git clone https://github.com/YOUR_USERNAME/ai-clips.git && cd ai-clips

# 2. Установить FFmpeg (Mac)
brew install ffmpeg

# 3. Настроить backend
cd backend && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt

# 4. Создать .env (в корне проекта)
cd .. && cp video-transcription-app/.env.example .env
# Отредактировать .env - добавить OPENROUTER_API_KEY

# 5. Создать папку для видео и добавить тестовое видео
mkdir -p videos && cp ~/Downloads/test.mp4 videos/

# 6. Запустить backend (терминал 1)
cd backend && source venv/bin/activate && uvicorn main:app --reload

# 7. Запустить frontend (терминал 2)
cd frontend && npm install && npm run dev

# 8. Открыть http://localhost:5173/
```

---

## Полезные команды

```bash
# Перезапустить backend
# Ctrl+C в терминале backend, затем:
uvicorn main:app --reload

# Очистить кэш Whisper моделей
rm -rf ~/.cache/whisper/

# Посмотреть логи в реальном времени
tail -f backend/logs/app.log  # если настроено логирование

# Проверить использование памяти
top -pid $(pgrep -f uvicorn)
```
