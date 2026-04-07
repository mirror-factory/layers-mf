# Chat Media Types & File Support

## Accepted File Types

| Type | Extensions | Max Size | Notes |
|------|-----------|----------|-------|
| Images | `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp` | 10 MB | Displayed inline as previews |
| Documents | `.pdf` | 10 MB | Text extracted, visual layout not preserved |
| Text | `.txt`, `.md`, `.csv` | 10 MB | Sent as raw text content |

## Model Compatibility

Not all models support all file types. The table below shows what works:

### Image Support

| Model | Provider | Images | Notes |
|-------|----------|--------|-------|
| Claude Opus 4.6 | Anthropic | Yes | Full vision support |
| Claude Sonnet 4.6 | Anthropic | Yes | Full vision support |
| Claude Haiku 4.5 | Anthropic | Yes | Full vision support |
| GPT-5.4 | OpenAI | Yes | Full vision support |
| GPT-5.4 Mini | OpenAI | Yes | Full vision support |
| GPT-5 Nano | OpenAI | Yes | Full vision support |
| Gemini 3.1 Pro | Google | Yes | Full vision support, best for image understanding |
| Gemini 3 Flash | Google | Yes | Full vision support |
| Gemini 3.1 Flash Lite | Google | Yes | Full vision support |
| Qwen 3 8B | Ollama (local) | No | Text-only model, images ignored |
| Gemma 4 26B | Ollama (local) | No | Text-only model, images ignored |
| Qwen 3.5 27B | Ollama (local) | No | Text-only model, images ignored |
| Llama 3.2 Vision 11B | Ollama (local) | Yes | Only local model with vision support |

### PDF Support

| Model | How PDFs are processed |
|-------|----------------------|
| All Anthropic models | Text extracted server-side, sent as text content |
| All OpenAI models | Text extracted server-side, sent as text content |
| All Google models | Native PDF support (can read visual layout) |
| Ollama local models | Text extracted server-side, sent as text content |

### Text Files (TXT, MD, CSV)

All models support text files. Content is sent as raw text in the message.

## How Files Are Processed

1. **Upload**: User drags/drops or clicks attach button
2. **Validation**: File type and size checked client-side (max 10 MB)
3. **Preview**: Images show inline thumbnail, other files show icon + filename
4. **Encoding**: Images are base64-encoded and sent as `file` parts in the message
5. **Display**: In the message thread, images render inline; other files show as chips

## Adding New File Types

To support a new file type:

1. Add MIME type to `ACCEPTED_FILE_TYPES` in `src/components/chat-interface.tsx`
2. Add extension to `ACCEPTED_EXTENSIONS`
3. Add icon mapping in `getFileIcon()` if needed
4. Test with target models to verify they handle the content correctly

## Limitations

- **Local Ollama models** (except Llama 3.2 Vision) cannot process images. The image data is still sent but will be ignored by the model.
- **PDF visual layout** is only preserved by Google Gemini models. All other providers receive extracted text only.
- **GIF animations** are sent as static images to the model (first frame only for most providers).
- **No audio/video support** currently. These would need server-side transcription before sending to models.
