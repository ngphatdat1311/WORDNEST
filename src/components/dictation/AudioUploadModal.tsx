'use client';

import React, { useState } from 'react';
import { FileAudio, FileEdit, Upload, X } from 'lucide-react';
import { parseSrtOrLrc } from '@/lib/dictation-engine';
import { useWordNestStore } from '@/store/useWordNestStore';
import { DictationLesson } from '@/types/wordnest';

export function AudioUploadModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (lesson: DictationLesson) => void;
}) {
  const [title, setTitle] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transcriptText, setTranscriptText] = useState('');
  const showToast = useWordNestStore((s) => s.showToast);

  const handleSrtFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    setTranscriptText(text);
    if (!title) setTitle(f.name.replace(/\.(srt|vtt|lrc|txt)$/i, ''));
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!audioFile) {
      showToast('Hãy chọn 1 file âm thanh (.mp3, .wav, .m4a)', 'error');
      return;
    }
    const audioUrl = URL.createObjectURL(audioFile);
    const segments = parseSrtOrLrc(transcriptText, 120);
    if (!segments.length) {
      showToast('Hãy nạp file .srt/.lrc hoặc dán lời thoại tiếng Anh (mỗi dòng 1 câu)', 'error');
      return;
    }

    const lastEnd = segments[segments.length - 1]?.end || 120;
    const lesson: DictationLesson = {
      id: `audio_${Date.now().toString(36)}`,
      youtubeId: '',
      sourceType: 'audio',
      audioUrl,
      title: title.trim() || audioFile.name.replace(/\.[^.]+$/, ''),
      channel: 'Audio cá nhân (MP3)',
      category: 'ielts',
      level: 'medium',
      durationSec: Math.ceil(lastEnd),
      thumbnail: '',
      segments,
      isCustom: true,
      addedAt: new Date().toISOString().slice(0, 10),
    };
    onCreated(lesson);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleCreate}
        className="w-full max-w-lg rounded-2xl p-5 border shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-serif-display font-semibold text-lg flex items-center gap-2">
            <FileAudio className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            Nạp Audio MP3 + Phụ đề (IELTS / DOL)
          </h3>
          <button type="button" onClick={onClose} className="cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text3)' }}>
            Tên bài nghe
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="vd: Cambridge IELTS 18 - Test 1 Part 1"
            className="w-full rounded-xl px-3.5 py-2 text-sm border outline-none"
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label
            className="rounded-xl p-3 border-2 border-dashed flex flex-col items-center justify-center text-center gap-1.5 cursor-pointer"
            style={{
              backgroundColor: audioFile ? 'var(--green-soft)' : 'var(--bg)',
              borderColor: audioFile ? 'var(--green)' : 'var(--border2)',
            }}
          >
            <Upload className="w-5 h-5" style={{ color: audioFile ? 'var(--green)' : 'var(--accent)' }} />
            <span className="text-xs font-semibold">
              {audioFile ? audioFile.name : 'Chọn file MP3 / WAV / M4A *'}
            </span>
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setAudioFile(f);
                if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ''));
              }}
            />
          </label>

          <label
            className="rounded-xl p-3 border-2 border-dashed flex flex-col items-center justify-center text-center gap-1.5 cursor-pointer"
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border2)' }}
          >
            <FileEdit className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            <span className="text-xs font-semibold">Tải file .SRT / .VTT / .LRC</span>
            <input
              type="file"
              accept=".srt,.vtt,.lrc,.txt"
              className="hidden"
              onChange={handleSrtFile}
            />
          </label>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text3)' }}>
            Nội dung phụ đề (Hỗ trợ SRT, VTT, LRC hoặc văn bản mỗi dòng 1 câu)
          </label>
          <textarea
            rows={5}
            value={transcriptText}
            onChange={(e) => setTranscriptText(e.target.value)}
            placeholder={'1\n00:00:01,000 --> 00:00:04,500\nGood morning, how can I help you today?'}
            className="w-full rounded-xl p-3 text-xs font-mono border outline-none"
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs border cursor-pointer"
            style={{ borderColor: 'var(--border)' }}
          >
            Hủy
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            Tạo & Luyện ngay
          </button>
        </div>
      </form>
    </div>
  );
}
