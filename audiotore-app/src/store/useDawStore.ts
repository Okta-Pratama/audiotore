import { create } from 'zustand';

export interface AudioAsset {
  id: string;
  name: string;
  buffer: AudioBuffer;
}

export interface Clip {
  id: string;
  assetId: string;
  trackId: string;
  start: number; // Posisi di timeline (detik)
  offset: number; // Mulai memutar dari detik ke berapa di dalam file audio
  duration: number; // Durasi klip (detik)
  fadeIn?: number; // Durasi fade in (detik)
  fadeOut?: number; // Durasi fade out (detik)
  color?: string;
}

export interface Track {
  id: string;
  name: string;
  volume: number; // 0.0 to 1.0
  pan: number; // -1.0 (Left) to 1.0 (Right)
  muted: boolean;
  solo: boolean;
  locked: boolean;
}

interface DawState {
  assets: AudioAsset[];
  tracks: Track[];
  clips: Clip[];
  

  // UI State
  selectedClipIds: string[];
  currentTime: number;
  isPlaying: boolean;
  timelineMode: 'select' | 'split';
  pixelsPerSecond: number;
  isRecording: boolean;
  
  setSelectedClipIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setTimelineMode: (mode: 'select' | 'split') => void;
  setPixelsPerSecond: (pps: number) => void;
  setIsRecording: (recording: boolean) => void;
  // Actions
  addAsset: (asset: AudioAsset) => void;
  addTrack: (track: Track) => void;
  updateTrack: (id: string, updates: Partial<Track>) => void;
  deleteTrack: (id: string) => void;
  
  addClip: (clip: Clip) => void;
  updateClip: (id: string, updates: Partial<Clip>) => void;
  deleteClip: (id: string) => void;
  splitClip: (clipId: string, timeAtTimeline: number) => void;
}

export const useDawStore = create<DawState>()((set, get) => ({
  assets: [],
  tracks: [],
  clips: [],

  selectedClipIds: [],
  currentTime: 0,
  isPlaying: false,
  timelineMode: 'select',
  pixelsPerSecond: 50,
  isRecording: false,

  setSelectedClipIds: (updater) => set((state) => ({ 
    selectedClipIds: typeof updater === 'function' ? updater(state.selectedClipIds) : updater 
  })),
  setCurrentTime: (time) => set({ currentTime: time }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setTimelineMode: (mode) => set({ timelineMode: mode }),
  setPixelsPerSecond: (pps) => set({ pixelsPerSecond: pps }),
  setIsRecording: (recording) => set({ isRecording: recording }),

  addAsset: (asset) => set((state) => ({ assets: [...state.assets, asset] })),
  
  addTrack: (track) => set((state) => ({ tracks: [...state.tracks, track] })),
  
  updateTrack: (id, updates) => set((state) => ({
    tracks: state.tracks.map(t => t.id === id ? { ...t, ...updates } : t)
  })),
  
  deleteTrack: (id) => set((state) => ({
    tracks: state.tracks.filter(t => t.id !== id),
    clips: state.clips.filter(c => c.trackId !== id) // Hapus klip yang ada di track ini
  })),

  addClip: (clip) => set((state) => ({ clips: [...state.clips, clip] })),
  
  updateClip: (id, updates) => set((state) => ({
    clips: state.clips.map(c => c.id === id ? { ...c, ...updates } : c)
  })),
  
  deleteClip: (id) => set((state) => ({
    clips: state.clips.filter(c => c.id !== id)
  })),

  splitClip: (clipId, time) => {
    const state = get();
    const clip = state.clips.find(c => c.id === clipId);
    if (!clip) return;
    
    // Pastikan titik split berada di dalam klip
    if (time <= clip.start || time >= clip.start + clip.duration) return;

    const splitOffset = time - clip.start;
    
    const newClip: Clip = {
      ...clip,
      id: `clip-${Date.now()}`,
      start: time,
      offset: clip.offset + splitOffset,
      duration: clip.duration - splitOffset
    };

    set((state) => ({
      clips: state.clips.map(c => 
        c.id === clipId 
          ? { ...c, duration: splitOffset }
          : c
      ).concat(newClip)
    }));
  }
}));
