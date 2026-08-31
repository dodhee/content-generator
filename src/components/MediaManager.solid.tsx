// src/components/MediaManager.tsx
// Media Manager UI: AI image generation, upload, gallery, insert to editor

import { createSignal, onMount } from 'solid-js';

interface GeneratedImage {
  url: string;
  alt: string;
  prompt: string;
  width: number;
  height: number;
  sizeBytes: number;
}

interface MediaManagerProps {
  articleId?: string;
  topic?: string;
  onInsertImage: (markdown: string) => void;
}

export function MediaManager({ articleId, topic: topicProp, onInsertImage }: MediaManagerProps) {
  const [tab, setTab] = createSignal<'generate' | 'upload' | 'gallery'>('generate');
  const [prompt, setPrompt] = createSignal('');
  const [generating, setGenerating] = createSignal(false);
  const [uploading, setUploading] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [images, setImages] = createSignal<GeneratedImage[]>([]);
  const [error, setError] = createSignal<string | null>(null);
  const [selectedImage, setSelectedImage] = createSignal<GeneratedImage | null>(null);
  const [topic, setTopic] = createSignal(topicProp || '');

  const fetchGallery = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/media?article_id=${articleId || ''}&limit=50`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch gallery');
      const data = await res.json();
      setImages(data.images || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt().trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/media/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt(),
          article_id: articleId,
          topic,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Generation failed' }));
        throw new Error(data.error || 'Generation failed');
      }
      const data = await res.json();
      setImages((prev) => [data.image, ...prev]);
      setSelectedImage(data.image);
      setPrompt('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setGenerating(false);
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (articleId) formData.append('article_id', articleId);

      const res = await fetch('/api/media/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(data.error || 'Upload failed');
      }
      const data = await res.json();
      setImages((prev) => [data.image, ...prev]);
      setSelectedImage(data.image);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      handleUpload(file);
      input.value = '';
    }
  };

  const handleInsert = (image: GeneratedImage) => {
    const markdown = `![${image.alt}](${image.url})`;
    onInsertImage(markdown);
    setSelectedImage(null);
  };

  const handleSelect = (image: GeneratedImage) => {
    setSelectedImage(image);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  onMount(() => {
    fetchGallery();
  });

  return (
    <div class="bg-white rounded-lg border border-slate-200 overflow-hidden">
      {/* Tabs */}
      <div class="flex border-b border-slate-200 bg-slate-50">
        <button
          type="button"
          class="px-4 py-2 text-sm font-medium transition-colors"
          classList={{
            'text-blue-600 border-b-2 border-blue-600 bg-white': tab() === 'generate',
            'text-slate-500 hover:text-slate-700': tab() !== 'generate',
          }}
          onClick={() => setTab('generate')}
        >
          Generate
        </button>
        <button
          type="button"
          class="px-4 py-2 text-sm font-medium transition-colors"
          classList={{
            'text-blue-600 border-b-2 border-blue-600 bg-white': tab() === 'upload',
            'text-slate-500 hover:text-slate-700': tab() !== 'upload',
          }}
          onClick={() => setTab('upload')}
        >
          Upload
        </button>
        <button
          type="button"
          class="px-4 py-2 text-sm font-medium transition-colors"
          classList={{
            'text-blue-600 border-b-2 border-blue-600 bg-white': tab() === 'gallery',
            'text-slate-500 hover:text-slate-700': tab() !== 'gallery',
          }}
          onClick={() => setTab('gallery')}
        >
          Gallery
        </button>
      </div>

      {/* Tab Panels */}
      <div class="p-4">
        {error() && (
          <div class="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
            {error()}
          </div>
        )}

        {tab() === 'generate' && (
          <div class="space-y-4">
            <div>
              <label htmlFor="media-prompt" class="block text-sm text-slate-700 mb-1">
                Image Prompt
              </label>
              <textarea
                id="media-prompt"
                value={prompt()}
                onInput={(e) => setPrompt(e.currentTarget.value)}
                rows={3}
                placeholder="Describe the image you want to generate... (e.g., 'modern office workspace with natural lighting, minimalist style')"
                class="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
              />
            </div>
            <div class="flex items-center gap-3">
              <input
                type="text"
                value={topic()}
                onInput={(e) => setTopic(e.currentTarget.value)}
                placeholder="Article topic (for alt text)"
                class="flex-1 px-3 py-2 border border-slate-300 rounded text-slate-900"
              />
            </div>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating() || !prompt().trim()}
              class="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {generating() ? (
                <span class="flex items-center justify-center gap-2">
                  <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating...
                </span>
              ) : (
                'Generate Image'
              )}
            </button>
          </div>
        )}

        {tab() === 'upload' && (
          <div class="space-y-4">
            <div class="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                class="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" class="cursor-pointer">
                <svg
                  class="mx-auto h-12 w-12 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-labelledby="upload-icon-title"
                >
                  <title id="upload-icon-title">Upload image icon</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <p class="mt-2 text-slate-600">Click to upload or drag and drop</p>
                <p class="text-sm text-slate-400">PNG, JPG, WebP up to 10MB</p>
              </label>
            </div>
            {uploading() && (
              <div class="text-center text-slate-600">
                <div class="w-6 h-6 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                <p>Uploading and compressing...</p>
              </div>
            )}
          </div>
        )}

        {tab() === 'gallery' && (
          <div>
            {loading() ? (
              <div class="text-center py-8 text-slate-500">
                <div class="w-6 h-6 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                <p>Loading gallery...</p>
              </div>
            ) : images().length === 0 ? (
              <div class="text-center py-8 text-slate-500">
                <p>No images yet.</p>
                <p class="text-sm">Generate or upload images to see them here.</p>
              </div>
            ) : (
              <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {images().map((img) => (
                  <button
                    key={img.url}
                    type="button"
                    class="relative group border border-slate-200 rounded overflow-hidden w-full h-40"
                    classList={{ 'ring-2 ring-blue-500': selectedImage()?.url === img.url }}
                    onClick={() => handleSelect(img)}
                  >
                    <img
                      src={img.url}
                      alt={img.alt}
                      class="w-full h-32 object-cover"
                      loading="lazy"
                    />
                    <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      {selectedImage()?.url === img.url ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInsert(img);
                          }}
                          class="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                        >
                          Insert
                        </button>
                      ) : (
                        <span class="px-3 py-1.5 bg-white text-slate-900 text-sm rounded">
                          Select
                        </span>
                      )}
                    </div>
                    <div class="absolute bottom-0 left-0 right-0 p-2 bg-black/60 text-white text-xs truncate">
                      {img.prompt || img.alt}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected Image Preview */}
      {selectedImage() && (
        <div class="border-t border-slate-200 p-4 bg-slate-50">
          <div class="flex items-start gap-4">
            <img
              src={selectedImage().url}
              alt={selectedImage().alt}
              class="w-24 h-24 object-cover rounded"
            />
            <div class="flex-1 min-w-0">
              <p class="font-medium text-slate-900 truncate">{selectedImage().alt}</p>
              <p class="text-sm text-slate-500">
                {selectedImage().width}×{selectedImage().height} •{' '}
                {formatSize(selectedImage().sizeBytes)}
              </p>
              <p class="text-xs text-slate-400 truncate mt-1">{selectedImage().prompt}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                const img = selectedImage();
                if (img) handleInsert(img);
              }}
              class="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              Insert to Article
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
