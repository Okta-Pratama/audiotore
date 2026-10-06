export class AudioEngine {
  ctx: AudioContext;
  sources: Map<string, AudioBufferSourceNode> = new Map();
  gainNodes: Map<string, GainNode> = new Map();
  startTime: number = 0;
  pausedAt: number = 0;
  isPlaying: boolean = false;
  
  // Track master gains
  trackGains: Map<string, GainNode> = new Map();
  trackPanners: Map<string, StereoPannerNode> = new Map();
  
  // Analysers
  masterGain: GainNode;
  splitter: ChannelSplitterNode;
  analyserL: AnalyserNode;
  analyserR: AnalyserNode;

  constructor() {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    this.masterGain = this.ctx.createGain();
    this.splitter = this.ctx.createChannelSplitter(2);
    this.analyserL = this.ctx.createAnalyser();
    this.analyserR = this.ctx.createAnalyser();
    
    this.analyserL.fftSize = 256;
    this.analyserR.fftSize = 256;
    
    this.masterGain.connect(this.ctx.destination);
    this.masterGain.connect(this.splitter);
    this.splitter.connect(this.analyserL, 0, 0);
    
    // In case of mono audio or single channel routing
    try {
      this.splitter.connect(this.analyserR, 1, 0);
    } catch (e) {
      // Fallback
    }
  }

  getLevels(): { l: number, r: number } {
    if (!this.isPlaying) return { l: 0, r: 0 };
    
    const dataL = new Float32Array(this.analyserL.fftSize);
    const dataR = new Float32Array(this.analyserR.fftSize);
    this.analyserL.getFloatTimeDomainData(dataL);
    this.analyserR.getFloatTimeDomainData(dataR);
    
    let sumL = 0, sumR = 0;
    for (let i = 0; i < dataL.length; i++) {
      sumL += dataL[i] * dataL[i];
      sumR += dataR[i] * dataR[i];
    }
    
    const rmsL = Math.sqrt(sumL / dataL.length);
    const rmsR = Math.sqrt(sumR / dataR.length);
    
    return { l: Math.min(1, rmsL * 4), r: Math.min(1, rmsR * 4) };
  }

  play(
    clips: { id: string; buffer: AudioBuffer; start: number; offset: number; duration: number; trackId: string; fadeIn?: number; fadeOut?: number }[],
    tracks: { id: string; volume: number; pan: number; muted: boolean; solo: boolean; locked: boolean }[]
  ) {
    if (this.isPlaying) return;
    
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.startTime = this.ctx.currentTime - this.pausedAt;

    // Set up track gains and panners
    this.trackPanners.forEach(panner => panner.disconnect());
    this.trackPanners.clear();
    this.trackGains.forEach(gain => gain.disconnect());
    this.trackGains.clear();

    const isAnySolo = tracks.some(t => t.solo);

    tracks.forEach(track => {
      const gain = this.ctx.createGain();
      const shouldMute = track.muted || (isAnySolo && !track.solo);
      gain.gain.value = shouldMute ? 0 : track.volume;
      
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = track.pan;

      gain.connect(panner);
      panner.connect(this.masterGain);
      
      this.trackGains.set(track.id, gain);
      this.trackPanners.set(track.id, panner);
    });

    clips.forEach(clip => {
      let delay = clip.start - this.pausedAt;
      let offset = clip.offset;
      let duration = clip.duration;

      if (delay < 0) {
        offset += Math.abs(delay);
        duration -= Math.abs(delay);
        delay = 0;
      }

      if (duration > 0) {
        const source = this.ctx.createBufferSource();
        source.buffer = clip.buffer;
        
        const clipGain = this.ctx.createGain();
        clipGain.gain.value = 1;
        
        const absoluteStartTime = this.ctx.currentTime + delay;
        const clipAbsStart = this.ctx.currentTime + (clip.start - this.pausedAt);
        
        clipGain.gain.cancelScheduledValues(this.ctx.currentTime);
        
        const fadeIn = clip.fadeIn || 0;
        const fadeOut = clip.fadeOut || 0;
        
        if (fadeIn > 0) {
           const fadeEnd = clipAbsStart + fadeIn;
           if (absoluteStartTime < fadeEnd) {
             const ratio = absoluteStartTime > clipAbsStart ? (absoluteStartTime - clipAbsStart) / fadeIn : 0;
             clipGain.gain.setValueAtTime(ratio, absoluteStartTime);
             clipGain.gain.linearRampToValueAtTime(1, fadeEnd);
           } else {
             clipGain.gain.setValueAtTime(1, absoluteStartTime);
           }
        } else {
           clipGain.gain.setValueAtTime(1, absoluteStartTime);
        }
        
        if (fadeOut > 0) {
           const fadeStart = clipAbsStart + clip.duration - fadeOut;
           const fadeEnd = clipAbsStart + clip.duration;
           if (absoluteStartTime < fadeEnd) {
             if (absoluteStartTime >= fadeStart) {
                const ratio = Math.max(0, 1 - ((absoluteStartTime - fadeStart) / fadeOut));
                // if we are already in fade out, override the start
                if (fadeIn === 0 || absoluteStartTime >= clipAbsStart + fadeIn) {
                    clipGain.gain.setValueAtTime(ratio, absoluteStartTime);
                }
                clipGain.gain.linearRampToValueAtTime(0, Math.max(absoluteStartTime + 0.01, fadeEnd));
             } else {
                clipGain.gain.setValueAtTime(1, Math.max(absoluteStartTime, fadeStart));
                clipGain.gain.linearRampToValueAtTime(0, fadeEnd);
             }
           }
        }
        
        source.connect(clipGain);

        const trackGain = this.trackGains.get(clip.trackId);
        if (trackGain) {
          clipGain.connect(trackGain);
        } else {
          clipGain.connect(this.masterGain);
        }

        source.start(absoluteStartTime, offset, duration);
        this.sources.set(clip.id, source);
      }
    });

    this.isPlaying = true;
  }

  pause() {
    if (!this.isPlaying) return;
    this.sources.forEach(source => {
      try {
        source.stop();
      } catch (e) {
        // ignore if already stopped
      }
    });
    this.sources.clear();
    this.pausedAt = this.ctx.currentTime - this.startTime;
    this.isPlaying = false;
  }

  seek(
    time: number,
    clips: { id: string; buffer: AudioBuffer; start: number; offset: number; duration: number; trackId: string; fadeIn?: number; fadeOut?: number }[],
    tracks: { id: string; volume: number; pan: number; muted: boolean; solo: boolean; locked: boolean }[]
  ) {
    const wasPlaying = this.isPlaying;
    if (wasPlaying) this.pause();
    this.pausedAt = Math.max(0, time);
    if (wasPlaying) this.play(clips, tracks);
  }

  updateVolumes(tracks: { id: string; volume: number; pan: number; muted: boolean; solo: boolean; locked: boolean }[]) {
    const isAnySolo = tracks.some(t => t.solo);
    tracks.forEach(track => {
      const gain = this.trackGains.get(track.id);
      if (gain) {
        const shouldMute = track.muted || (isAnySolo && !track.solo);
        gain.gain.setTargetAtTime(shouldMute ? 0 : track.volume, this.ctx.currentTime, 0.05);
      }
      const panner = this.trackPanners.get(track.id);
      if (panner) {
        panner.pan.setTargetAtTime(track.pan, this.ctx.currentTime, 0.05);
      }
    });
  }

  getCurrentTime(): number {
    if (this.isPlaying) {
      return this.ctx.currentTime - this.startTime;
    }
    return this.pausedAt;
  }
}

export const engine = new AudioEngine();
