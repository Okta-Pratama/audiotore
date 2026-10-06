import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Play, Pause, Square, MousePointer2, Download, Plus, Trash2, SplitSquareHorizontal, Scissors, Volume2, Headphones, Lock, Unlock, Settings, ZoomIn, ZoomOut, Mic, Music } from 'lucide-react';
import { useDawStore } from './store/useDawStore';
import { engine } from './engine/AudioEngine';
import { ClipView } from './components/ClipView';
import './App.css';
import { Layout, Model, TabNode, Actions, DockLocation } from 'flexlayout-react';
import 'flexlayout-react/style/dark.css';

let internalDragData: { type: 'asset', id: string } | { type: 'asset-list', ids: string[], assetIds?: string[] } | null = null;


const MasterMeter = ({ levels }: { levels: { l: number, r: number } }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVertical, setIsVertical] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        setIsVertical(entry.contentRect.height > entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', backgroundColor: '#0a0a0a', display: 'flex', flexDirection: 'column', position: 'relative' }}>


      {isVertical ? (
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', padding: '40px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', height: '100%' }}>
            <div style={{ flex: 1, width: '16px', backgroundColor: '#18181b', borderRadius: '3px', overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <div style={{ width: '100%', height: `${levels.l * 100}%`, backgroundColor: levels.l > 0.9 ? '#ef4444' : levels.l > 0.7 ? '#eab308' : '#10b981', transition: 'height 0.05s linear, background-color 0.1s' }} />
            </div>
            <span style={{ color: '#52525b', fontSize: '10px', fontWeight: 'bold' }}>L</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', height: '100%' }}>
            <div style={{ flex: 1, width: '16px', backgroundColor: '#18181b', borderRadius: '3px', overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <div style={{ width: '100%', height: `${levels.r * 100}%`, backgroundColor: levels.r > 0.9 ? '#ef4444' : levels.r > 0.7 ? '#eab308' : '#10b981', transition: 'height 0.05s linear, background-color 0.1s' }} />
            </div>
            <span style={{ color: '#52525b', fontSize: '10px', fontWeight: 'bold' }}>R</span>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '12px', padding: '0 40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: '#52525b', fontSize: '10px', fontWeight: 'bold', width: '10px' }}>L</span>
            <div style={{ flex: 1, height: '16px', backgroundColor: '#18181b', borderRadius: '3px', overflow: 'hidden', position: 'relative' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${levels.l * 100}%`, backgroundColor: levels.l > 0.9 ? '#ef4444' : levels.l > 0.7 ? '#eab308' : '#10b981', transition: 'width 0.05s linear, background-color 0.1s' }} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: '#52525b', fontSize: '10px', fontWeight: 'bold', width: '10px' }}>R</span>
            <div style={{ flex: 1, height: '16px', backgroundColor: '#18181b', borderRadius: '3px', overflow: 'hidden', position: 'relative' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${levels.r * 100}%`, backgroundColor: levels.r > 0.9 ? '#ef4444' : levels.r > 0.7 ? '#eab308' : '#10b981', transition: 'width 0.05s linear, background-color 0.1s' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function App() {
  const store = useDawStore((state) => state);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [selectionBox, setSelectionBox] = useState<{ startX: number, startY: number, endX: number, endY: number } | null>(null);
  const [timelineMode, setTimelineMode] = useState<'select' | 'split'>('select');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [mediaSelectionBox, setMediaSelectionBox] = useState<{ startX: number, startY: number, endX: number, endY: number } | null>(null);
  const mediaBinRef = useRef<HTMLDivElement>(null);

  const [dragOverTrackId, setDragOverTrackId] = useState<string | null>(null);
  const [isDragOverNewTrack, setIsDragOverNewTrack] = useState(false);

  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const viewMenuRef = useRef<HTMLDivElement>(null);

  const [model] = useState(() => Model.fromJson({
    global: { tabEnableClose: false, tabEnableFloat: true, rootOrientationVertical: true, tabSetEnableDrag: true, tabEnableDrag: true },
    layout: {
      type: "row",
      weight: 100,
      children: [
        {
          type: "row",
          weight: 30,
          children: [
            { type: "tabset", weight: 20, children: [{ type: "tab", name: "Media Bin", component: "mediaBin", id: "mediaBin" }] },
            { type: "tabset", weight: 60, children: [{ type: "tab", name: "Master Meter", component: "masterMeter", id: "masterMeter" }] },
            {
              type: "row", weight: 20, children: [
                { type: "tabset", weight: 50, children: [{ type: "tab", name: "Effects", component: "effects", id: "effects" }] },
                { type: "tabset", weight: 50, children: [{ type: "tab", name: "Details", component: "details", id: "details" }] }
              ]
            }
          ]
        },
        { type: "tabset", weight: 70, children: [{ type: "tab", name: "Timeline", component: "timeline", id: "timeline", enableClose: false }] }
      ]
    }
  }));
  const [levels, setLevels] = useState({ l: 0, r: 0 });

  const [pixelsPerSecond, setPixelsPerSecond] = useState(50);
  const [trackHeight, setTrackHeight] = useState(80); // vertical zoom: height per track in px
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  // const [rightPanelTab, setRightPanelTab] = useState<'details' | 'effects'>('effects');
  const [isRecording, setIsRecording] = useState(false);
  const [clipboard, setClipboard] = useState<any[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  // Custom drag state for clips
  const [clipDrag, setClipDrag] = useState<{
    clipId: string,
    startX: number,
    startY: number,
    currentX: number,
    currentY: number,
    initialStart: number,
    initialTrackId: string
  } | null>(null);

  const animationRef = useRef<number>(0);
  const timelineRef = useRef<HTMLDivElement>(null);
  const trackHeadersRef = useRef<HTMLDivElement>(null);

  const latestData = useRef({ clips: store.clips, pixelsPerSecond });
  useEffect(() => {
    latestData.current = { clips: store.clips, pixelsPerSecond };
  }, [store.clips, pixelsPerSecond]);

  useEffect(() => {
    const loop = () => {
      const newTime = engine.getCurrentTime();
      setCurrentTime(newTime);
      setLevels(engine.getLevels());


      const { clips, pixelsPerSecond: pps } = latestData.current;

      if (engine.isPlaying) {
        // Auto-stop at the end of the last clip
        let maxEndTime = 0;
        clips.forEach(c => {
          const end = c.start + c.duration;
          if (end > maxEndTime) maxEndTime = end;
        });

        if (maxEndTime > 0 && newTime >= maxEndTime) {
          engine.pause();
          setIsPlaying(false);
          engine.seek(maxEndTime, [], []);
          setCurrentTime(maxEndTime);
        } else if (timelineScrollRef.current) {
          // Auto-scroll timeline to follow playhead
          const el = timelineScrollRef.current;
          const playheadX = newTime * pps;
          const visibleLeft = el.scrollLeft;
          const visibleRight = el.scrollLeft + el.clientWidth;

          if (playheadX > visibleRight - 50) {
            el.scrollLeft = playheadX - el.clientWidth + 50;
          } else if (playheadX < visibleLeft) {
            el.scrollLeft = playheadX - 50;
          }
        }
      }

      animationRef.current = requestAnimationFrame(loop);
    };
    animationRef.current = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(animationRef.current!);
  }, []);

  // Auto-delete empty tracks
  useEffect(() => {
    const emptyTrackIds = store.tracks
      .filter(t => !store.clips.some(c => c.trackId === t.id))
      .map(t => t.id);

    if (emptyTrackIds.length > 0) {
      emptyTrackIds.forEach(id => store.deleteTrack(id));
    }
  }, [store.clips, store.tracks, store.deleteTrack]);

  // Non-passive wheel listener — needed so e.preventDefault() works in handleWheelReact
  useEffect(() => {
    const el = timelineScrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // Prevent browser from zooming/scrolling only when modifiers are used
      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
          if (e.shiftKey) {
            // Ctrl+Shift → vertical zoom
            const factor = e.deltaY > 0 ? 0.85 : 1.18;
            setTrackHeight(prev => Math.max(40, Math.min(200, Math.round(prev * factor))));
          } else {
            // Ctrl → horizontal zoom
            const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
            const zoomFactor = delta > 0 ? 0.9 : 1.1;
            setPixelsPerSecond(prev => {
              const newPps = Math.max(5, Math.min(prev * zoomFactor, 400));
              if (newPps !== prev) {
                const rect = el.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                // Offset by 160px because track content starts after the sticky track headers
                const timeAtMouse = (mouseX - 160 + el.scrollLeft) / prev;
                requestAnimationFrame(() => { el.scrollLeft = timeAtMouse * newPps - (mouseX - 160); });
              }
              return newPps;
            });
          }
        } else if (e.shiftKey && e.deltaY !== 0) {
          el.scrollLeft += e.deltaY;
        }
      }
      // If no modifiers, let the browser handle natural horizontal/vertical scrolling.
      // Pure vertical scroll (deltaX=0, no modifiers) → let browser handle naturally
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync vertical scroll of the fixed track-header panel with the scrollable right panel
  useEffect(() => {
    const scrollEl = timelineScrollRef.current;
    const headerEl = trackHeadersRef.current;
    if (!scrollEl || !headerEl) return;
    const onScroll = () => { headerEl.scrollTop = scrollEl.scrollTop; };
    scrollEl.addEventListener('scroll', onScroll);
    return () => scrollEl.removeEventListener('scroll', onScroll);
  }, []);

  const playPause = useCallback(() => {
    if (store.clips.length === 0) return; // Prevent playback if timeline is empty

    if (engine.isPlaying) {
      engine.pause();
      setIsPlaying(false);
    } else {
      let maxEndTime = 0;
      store.clips.forEach(c => {
        const end = c.start + c.duration;
        if (end > maxEndTime) maxEndTime = end;
      });

      if (engine.getCurrentTime() >= maxEndTime) {
        engine.seek(0, [], []);
        setCurrentTime(0);
      }

      const playClips = store.clips.map(c => {
        const asset = store.assets.find(a => a.id === c.assetId);
        return {
          id: c.id,
          buffer: asset!.buffer,
          start: c.start,
          offset: c.offset,
          duration: c.duration,
          trackId: c.trackId,
          fadeIn: c.fadeIn,
          fadeOut: c.fadeOut
        };
      });
      engine.play(playClips, store.tracks);
      setIsPlaying(true);
    }
  }, [store.clips, store.assets, store.tracks]);

  const stop = useCallback(() => {
    engine.pause();
    setIsPlaying(false);
    engine.seek(0, [], []);
    setCurrentTime(0);

    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
  }, [isRecording]);

  const toggleRecord = useCallback(async () => {
    if (isRecording) {
      stop();
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        const recordStartTime = currentTime;

        mediaRecorder.onstop = async () => {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          chunksRef.current = [];
          setIsRecording(false);
          stream.getTracks().forEach(track => track.stop());

          const arrayBuffer = await blob.arrayBuffer();
          const audioBuffer = await engine.ctx.decodeAudioData(arrayBuffer);

          const assetId = Math.random().toString(36).substring(7);
          store.addAsset({
            id: assetId,
            name: `Recording ${new Date().toLocaleTimeString()}`,
            buffer: audioBuffer
          });

          // Buat track baru khusus untuk hasil rekaman
          const newTrackId = `track-rec-${Math.random().toString(36).substring(7)}`;
          store.addTrack({
            id: newTrackId,
            name: `Mic Record ${store.tracks.length + 1}`,
            volume: 1,
            pan: 0,
            muted: false,
            solo: false,
            locked: false
          });

          store.addClip({
            id: Math.random().toString(36).substring(7),
            assetId,
            trackId: newTrackId,
            start: recordStartTime,
            offset: 0,
            duration: audioBuffer.duration
          });
        };

        mediaRecorder.start();
        setIsRecording(true);
        if (!isPlaying) playPause(); // Start playback while recording
      } catch (err) {
        alert("Gagal mengakses mikrofon: " + err);
      }
    }
  }, [isRecording, currentTime, isPlaying, playPause, stop, store]);


  const handleCut = useCallback(() => {
    if (isPlaying) stop();
    if (selectedClipIds.length > 0) {
      selectedClipIds.forEach(id => store.deleteClip(id));
      setSelectedClipIds([]);
    }
  }, [selectedClipIds, store, isPlaying, stop]);

  const handleSplit = useCallback(() => {
    if (isPlaying) stop();
    if (selectedClipIds.length > 0) {
      selectedClipIds.forEach(id => store.splitClip(id, currentTime));
    } else {
      // Split all clips intersecting playhead
      store.clips.forEach(c => {
        if (currentTime > c.start && currentTime < c.start + c.duration) {
          store.splitClip(c.id, currentTime);
        }
      });
    }
  }, [selectedClipIds, currentTime, store, isPlaying, stop]);
  // Media Bin Lasso Effect
  useEffect(() => {
    if (!mediaSelectionBox) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!mediaBinRef.current) return;
      const rect = mediaBinRef.current.getBoundingClientRect();
      const endX = Math.max(0, e.clientX - rect.left);
      const endY = Math.max(0, e.clientY - rect.top);
      setMediaSelectionBox(prev => prev ? { ...prev, endX, endY } : null);
    };

    const handleMouseUp = () => {
      if (!mediaBinRef.current || !mediaSelectionBox) {
        setMediaSelectionBox(null);
        return;
      }

      const boxLeft = Math.min(mediaSelectionBox.startX, mediaSelectionBox.endX);
      const boxRight = Math.max(mediaSelectionBox.startX, mediaSelectionBox.endX);
      const boxTop = Math.min(mediaSelectionBox.startY, mediaSelectionBox.endY);
      const boxBottom = Math.max(mediaSelectionBox.startY, mediaSelectionBox.endY);

      const newSelected: string[] = [];
      const children = Array.from(mediaBinRef.current.children) as HTMLElement[];

      // Calculate scroll offset of media bin container
      const scrollTop = mediaBinRef.current.scrollTop;

      children.forEach(child => {
        const assetId = child.getAttribute('data-asset-id');
        if (assetId) {
          // Child position relative to the container
          const childTop = child.offsetTop - scrollTop;
          const childBottom = childTop + child.offsetHeight;
          const childLeft = child.offsetLeft;
          const childRight = childLeft + child.offsetWidth;

          if (childRight > boxLeft && childLeft < boxRight && childBottom > boxTop && childTop < boxBottom) {
            newSelected.push(assetId);
          }
        }
      });

      if (newSelected.length > 0) {
        setSelectedAssetIds(newSelected);
      }
      setMediaSelectionBox(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [mediaSelectionBox]);



  // Media Bin Lasso Effect
  useEffect(() => {
    if (!mediaSelectionBox) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!mediaBinRef.current) return;
      const rect = mediaBinRef.current.getBoundingClientRect();
      const endX = Math.max(0, e.clientX - rect.left);
      const endY = Math.max(0, e.clientY - rect.top);
      setMediaSelectionBox(prev => prev ? { ...prev, endX, endY } : null);
    };

    const handleMouseUp = () => {
      if (!mediaBinRef.current || !mediaSelectionBox) {
        setMediaSelectionBox(null);
        return;
      }

      const boxLeft = Math.min(mediaSelectionBox.startX, mediaSelectionBox.endX);
      const boxRight = Math.max(mediaSelectionBox.startX, mediaSelectionBox.endX);
      const boxTop = Math.min(mediaSelectionBox.startY, mediaSelectionBox.endY);
      const boxBottom = Math.max(mediaSelectionBox.startY, mediaSelectionBox.endY);

      const newSelected: string[] = [];
      const children = Array.from(mediaBinRef.current.children) as HTMLElement[];

      // Calculate scroll offset of media bin container
      const scrollTop = mediaBinRef.current.scrollTop;

      children.forEach(child => {
        const assetId = child.getAttribute('data-asset-id');
        if (assetId) {
          // Child position relative to the container
          const childTop = child.offsetTop - scrollTop;
          const childBottom = childTop + child.offsetHeight;
          const childLeft = child.offsetLeft;
          const childRight = childLeft + child.offsetWidth;

          if (childRight > boxLeft && childLeft < boxRight && childBottom > boxTop && childTop < boxBottom) {
            newSelected.push(assetId);
          }
        }
      });

      if (newSelected.length > 0) {
        setSelectedAssetIds(newSelected);
      }
      setMediaSelectionBox(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [mediaSelectionBox]);



  // Media Bin Lasso Effect
  useEffect(() => {
    if (!mediaSelectionBox) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!mediaBinRef.current) return;
      const rect = mediaBinRef.current.getBoundingClientRect();
      const endX = Math.max(0, e.clientX - rect.left);
      const endY = Math.max(0, e.clientY - rect.top);
      setMediaSelectionBox(prev => prev ? { ...prev, endX, endY } : null);
    };

    const handleMouseUp = () => {
      if (!mediaBinRef.current || !mediaSelectionBox) {
        setMediaSelectionBox(null);
        return;
      }

      const boxLeft = Math.min(mediaSelectionBox.startX, mediaSelectionBox.endX);
      const boxRight = Math.max(mediaSelectionBox.startX, mediaSelectionBox.endX);
      const boxTop = Math.min(mediaSelectionBox.startY, mediaSelectionBox.endY);
      const boxBottom = Math.max(mediaSelectionBox.startY, mediaSelectionBox.endY);

      const newSelected: string[] = [];
      const children = Array.from(mediaBinRef.current.children) as HTMLElement[];

      // Calculate scroll offset of media bin container
      const scrollTop = mediaBinRef.current.scrollTop;

      children.forEach(child => {
        const assetId = child.getAttribute('data-asset-id');
        if (assetId) {
          // Child position relative to the container
          const childTop = child.offsetTop - scrollTop;
          const childBottom = childTop + child.offsetHeight;
          const childLeft = child.offsetLeft;
          const childRight = childLeft + child.offsetWidth;

          if (childRight > boxLeft && childLeft < boxRight && childBottom > boxTop && childTop < boxBottom) {
            newSelected.push(assetId);
          }
        }
      });

      if (newSelected.length > 0) {
        setSelectedAssetIds(newSelected);
      }
      setMediaSelectionBox(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [mediaSelectionBox]);


  // Media Bin Lasso Effect
  useEffect(() => {
    if (!mediaSelectionBox) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!mediaBinRef.current) return;
      const rect = mediaBinRef.current.getBoundingClientRect();
      const endX = Math.max(0, e.clientX - rect.left);
      const endY = Math.max(0, e.clientY - rect.top);
      setMediaSelectionBox(prev => prev ? { ...prev, endX, endY } : null);
    };

    const handleMouseUp = () => {
      if (!mediaBinRef.current || !mediaSelectionBox) {
        setMediaSelectionBox(null);
        return;
      }

      const boxLeft = Math.min(mediaSelectionBox.startX, mediaSelectionBox.endX);
      const boxRight = Math.max(mediaSelectionBox.startX, mediaSelectionBox.endX);
      const boxTop = Math.min(mediaSelectionBox.startY, mediaSelectionBox.endY);
      const boxBottom = Math.max(mediaSelectionBox.startY, mediaSelectionBox.endY);

      const newSelected: string[] = [];
      const children = Array.from(mediaBinRef.current.children) as HTMLElement[];

      // Calculate scroll offset of media bin container
      const scrollTop = mediaBinRef.current.scrollTop;

      children.forEach(child => {
        const assetId = child.getAttribute('data-asset-id');
        if (assetId) {
          // Child position relative to the container
          const childTop = child.offsetTop - scrollTop;
          const childBottom = childTop + child.offsetHeight;
          const childLeft = child.offsetLeft;
          const childRight = childLeft + child.offsetWidth;

          if (childRight > boxLeft && childLeft < boxRight && childBottom > boxTop && childTop < boxBottom) {
            newSelected.push(assetId);
          }
        }
      });

      if (newSelected.length > 0) {
        setSelectedAssetIds(newSelected);
      }
      setMediaSelectionBox(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [mediaSelectionBox]);


  // Media Bin Lasso Effect
  useEffect(() => {
    if (!mediaSelectionBox) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!mediaBinRef.current) return;
      const rect = mediaBinRef.current.getBoundingClientRect();
      const endX = Math.max(0, e.clientX - rect.left);
      const endY = Math.max(0, e.clientY - rect.top);
      setMediaSelectionBox(prev => prev ? { ...prev, endX, endY } : null);
    };

    const handleMouseUp = () => {
      if (!mediaBinRef.current || !mediaSelectionBox) {
        setMediaSelectionBox(null);
        return;
      }

      const boxLeft = Math.min(mediaSelectionBox.startX, mediaSelectionBox.endX);
      const boxRight = Math.max(mediaSelectionBox.startX, mediaSelectionBox.endX);
      const boxTop = Math.min(mediaSelectionBox.startY, mediaSelectionBox.endY);
      const boxBottom = Math.max(mediaSelectionBox.startY, mediaSelectionBox.endY);

      const newSelected: string[] = [];
      const children = Array.from(mediaBinRef.current.children) as HTMLElement[];

      // Calculate scroll offset of media bin container
      const scrollTop = mediaBinRef.current.scrollTop;

      children.forEach(child => {
        const assetId = child.getAttribute('data-asset-id');
        if (assetId) {
          // Child position relative to the container
          const childTop = child.offsetTop - scrollTop;
          const childBottom = childTop + child.offsetHeight;
          const childLeft = child.offsetLeft;
          const childRight = childLeft + child.offsetWidth;

          if (childRight > boxLeft && childLeft < boxRight && childBottom > boxTop && childTop < boxBottom) {
            newSelected.push(assetId);
          }
        }
      });

      if (newSelected.length > 0) {
        setSelectedAssetIds(newSelected);
      }
      setMediaSelectionBox(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [mediaSelectionBox]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.ctrlKey || e.metaKey)) {
        if (e.key.toLowerCase() === 'c') {
          e.preventDefault();
          if (selectedClipIds.length > 0) {
            setClipboard(store.clips.filter(c => selectedClipIds.includes(c.id)));
          }
          return;
        }
        if (e.key.toLowerCase() === 'a') {
          e.preventDefault();
          // Select all clips
          setSelectedClipIds(store.clips.map(c => c.id));
          // Also select all assets in media bin if user wants
          setSelectedAssetIds(store.assets.map(a => a.id));
          return;
        }

        if (e.key.toLowerCase() === 'v') {
          e.preventDefault();
          if (clipboard.length > 0) {
            const minStart = Math.min(...clipboard.map(c => c.start));
            const newIds: string[] = [];
            clipboard.forEach(c => {
              const newId = Math.random().toString(36).substring(7);
              newIds.push(newId);
              const requestedStart = currentTime + (c.start - minStart);
              const { trackId: safeTrackId, start: safeStart } = getSafeTrackAndStart(c.trackId, requestedStart, c.duration);
              store.addClip({
                ...c,
                id: newId,
                trackId: safeTrackId,
                start: safeStart,
              });
            });
            setSelectedClipIds(newIds);
          }
          return;
        }

        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          setPixelsPerSecond(prev => {
            const newPps = Math.max(5, Math.min(prev * 1.2, 400));
            if (newPps !== prev && timelineScrollRef.current) {
              const el = timelineScrollRef.current;
              const centerTime = (el.clientWidth / 2 + el.scrollLeft) / prev;
              requestAnimationFrame(() => {
                el.scrollLeft = centerTime * newPps - el.clientWidth / 2;
              });
            }
            return newPps;
          });
          return;
        }
        if (e.key === '-') {
          e.preventDefault();
          setPixelsPerSecond(prev => {
            const newPps = Math.max(5, Math.min(prev * 0.8, 400));
            if (newPps !== prev && timelineScrollRef.current) {
              const el = timelineScrollRef.current;
              const centerTime = (el.clientWidth / 2 + el.scrollLeft) / prev;
              requestAnimationFrame(() => {
                el.scrollLeft = centerTime * newPps - el.clientWidth / 2;
              });
            }
            return newPps;
          });
          return;
        }
      }

      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          playPause();
          break;
        case 'v':
          setTimelineMode('select');
          break;
        case 'c':
          setTimelineMode('split');
          break;
        case 'b':
          handleSplit();
          break;
        case 'backspace':
        case 'delete':
          handleCut();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playPause, handleCut, handleSplit, selectedClipIds, store, clipboard, currentTime]);

  // Auto-close View dropdown when clicking outside
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (viewMenuRef.current && !viewMenuRef.current.contains(e.target as Node)) {
        setViewMenuOpen(false);
      }
    };
    if (viewMenuOpen) {
      window.addEventListener('mousedown', handleMouseDown);
    }
    return () => window.removeEventListener('mousedown', handleMouseDown);
  }, [viewMenuOpen]);

  const getSafeTrackAndStart = (requestedTrackId: string, requestedStart: number, duration: number, ignoreClipId?: string) => {
    let currentTrackId = requestedTrackId;
    let trackIndex = store.tracks.findIndex(t => t.id === currentTrackId);
    if (trackIndex === -1) trackIndex = 0;

    // Find a track without collision
    while (true) {
      const clipsInTrack = store.clips.filter(c => c.trackId === currentTrackId && c.id !== ignoreClipId);
      const collision = clipsInTrack.some(c => {
        const cEnd = c.start + c.duration;
        const requestedEnd = requestedStart + duration;
        return (requestedStart < cEnd && requestedEnd > c.start);
      });

      if (!collision) {
        return { trackId: currentTrackId, start: requestedStart };
      }

      trackIndex++;
      if (trackIndex < store.tracks.length) {
        currentTrackId = store.tracks[trackIndex].id;
      } else {
        const newTrackId = `track-${Date.now()}`;
        store.addTrack({ id: newTrackId, name: `Track ${store.tracks.length + 1}`, volume: 1, pan: 0, muted: false, solo: false, locked: false });
        return { trackId: newTrackId, start: requestedStart };
      }
    }
  };

  // OS File Drop Handler
  const handleOSFileDrop = async (files: FileList | File[], dropTime?: number, targetTrackId?: string) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const validExt = file.name.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/i);
      if (!file.type.startsWith('audio/') && !validExt) continue;

      let newAsset = store.assets.find(a => a.name === file.name);

      if (!newAsset) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const audioBuffer = await engine.ctx.decodeAudioData(arrayBuffer);

          newAsset = {
            id: `asset-${Date.now()}-${i}`,
            name: file.name,
            buffer: audioBuffer,
          };

          store.addAsset(newAsset);
        } catch (err) {
          console.error("Failed to decode audio file:", file.name, err);
          alert(`Gagal memuat file audio: ${file.name}\nFormat mungkin tidak didukung oleh browser Anda.`);
          continue;
        }
      }

      if (dropTime !== undefined) {
        let tId = targetTrackId;
        if (!tId) {
          tId = `track-${Date.now()}-${i}`;
          store.addTrack({ id: tId, name: `Track ${store.tracks.length + 1}`, volume: 1, pan: 0, muted: false, solo: false, locked: false });
        }

        const { trackId, start } = getSafeTrackAndStart(tId, dropTime, newAsset.buffer.duration);

        store.addClip({
          id: `clip-${Date.now()}-${i}`,
          assetId: newAsset.id,
          trackId: trackId,
          start: start,
          offset: 0,
          duration: newAsset.buffer.duration
        });
      }
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      await handleOSFileDrop(event.target.files);
    }
  };

  const handleMediaBinDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleOSFileDrop(e.dataTransfer.files);
    }
  };

  // Timeline Interactions
  const handleRulerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (store.tracks.length === 0) return;
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = Math.max(0, x / pixelsPerSecond);

    engine.seek(time, store.clips.map(c => {
      const asset = store.assets.find(a => a.id === c.assetId);
      return { ...c, buffer: asset!.buffer };
    }), store.tracks);
    setCurrentTime(time);
    setIsScrubbing(true);
  };
  const handleMediaBinMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    setSelectedAssetIds([]);
    if (mediaBinRef.current) {
      const rect = mediaBinRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setMediaSelectionBox({ startX: x, startY: y, endX: x, endY: y });
    }
  };


  const handleTrackMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Allow lasso from any empty space in timeline — only block if the click
    // landed directly on a ClipView (which has its own onMouseDown + stopPropagation),
    // on the ruler, or on an interactive element like a button/input.
    const tag = (e.target as HTMLElement).tagName.toLowerCase();
    if (tag === 'button' || tag === 'input' || tag === 'canvas') return;

    setSelectedClipIds([]); // Click empty space clears selection

    if (timelineMode === 'select' && timelineRef.current) {
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setSelectionBox({ startX: x, startY: y, endX: x, endY: y });
    }
  };

  // Lasso Selection Effect
  useEffect(() => {
    if (!selectionBox) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const endX = Math.max(0, e.clientX - rect.left);
      const endY = Math.max(0, e.clientY - rect.top);

      setSelectionBox(prev => prev ? { ...prev, endX, endY } : null);
    };

    const handleMouseUp = () => {
      if (!timelineRef.current || !selectionBox) {
        setSelectionBox(null);
        return;
      }

      const boxLeft = Math.min(selectionBox.startX, selectionBox.endX);
      const boxRight = Math.max(selectionBox.startX, selectionBox.endX);
      const boxTop = Math.min(selectionBox.startY, selectionBox.endY);
      const boxBottom = Math.max(selectionBox.startY, selectionBox.endY);

      // Calculate selected clips
      const newSelectedIds: string[] = [];
      store.tracks.forEach((track, index) => {
        // Ruler = 30px, then tracks stacked by trackHeight
        const trackTop = 30 + (index * trackHeight);
        const trackBottom = trackTop + trackHeight;

        // If track overlaps vertically with the selection box
        if (trackBottom > boxTop && trackTop < boxBottom) {
          const trackClips = store.clips.filter(c => c.trackId === track.id);
          trackClips.forEach(c => {
            const clipLeft = c.start * pixelsPerSecond;
            const clipRight = (c.start + c.duration) * pixelsPerSecond;

            if (clipRight > boxLeft && clipLeft < boxRight) {
              newSelectedIds.push(c.id);
            }
          });
        }
      });

      if (newSelectedIds.length > 0) {
        setSelectedClipIds(newSelectedIds);
      }
      setSelectionBox(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [selectionBox, store.clips, store.tracks, pixelsPerSecond]);

  useEffect(() => {
    if (!isScrubbing) return;
      const handleMouseMove = (e: MouseEvent) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const time = Math.max(0, x / pixelsPerSecond);
      engine.seek(time, store.clips.map(c => {
        const asset = store.assets.find(a => a.id === c.assetId);
        return { ...c, buffer: asset!.buffer };
      }), store.tracks);
      setCurrentTime(time);
    };
    const handleMouseUp = () => setIsScrubbing(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isScrubbing, store, pixelsPerSecond]);

  const handleWheelReact = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (e.shiftKey) {
        // Ctrl+Shift+Wheel → vertical zoom (track height)
        const factor = e.deltaY > 0 ? 0.85 : 1.18;
        setTrackHeight(prev => Math.max(40, Math.min(200, Math.round(prev * factor))));
      } else {
        // Ctrl+Wheel → horizontal zoom
        const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
        const zoomFactor = delta > 0 ? 0.9 : 1.1;
        setPixelsPerSecond(prev => {
          const newPps = Math.max(5, Math.min(prev * zoomFactor, 400));
          if (newPps !== prev && timelineScrollRef.current) {
            const el = timelineScrollRef.current;
            const rect = el.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const timeAtMouse = (mouseX + el.scrollLeft) / prev;
            const newScrollLeft = timeAtMouse * newPps - mouseX;
            requestAnimationFrame(() => {
              el.scrollLeft = newScrollLeft;
            });
          }
          return newPps;
        });
      }
      return;
    }

    // Trackpad: handle both deltaX (horizontal) and deltaY (vertical) simultaneously
    const el = timelineScrollRef.current;
    if (!el) return;

    // If there's significant horizontal movement (trackpad swipe), scroll horizontally
    if (Math.abs(e.deltaX) > 0) {
      e.preventDefault();
      el.scrollLeft += e.deltaX;
    }

    // Shift+Wheel (mouse) → force horizontal scroll
    if (e.shiftKey && e.deltaY !== 0) {
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    }
    // Plain vertical (deltaY, no deltaX, no shift) → vertical scroll (browser handles naturally)
  };

  const handleDragStartAsset = (e: React.DragEvent, assetId: string) => {
    let idsToDrag = [assetId];
    if (selectedAssetIds.includes(assetId) && selectedAssetIds.length > 1) {
      idsToDrag = selectedAssetIds;
    }
    internalDragData = { type: 'asset-list', ids: idsToDrag } as any;
    e.dataTransfer.setData('text/plain', assetId);
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'asset-list', assetIds: idsToDrag }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleAddAssetManual = (assetId: string) => {
    const asset = store.assets.find(a => a.id === assetId);
    if (!asset) return;

    let targetTrackId = store.tracks.length > 0 ? store.tracks[0].id : null;
    if (!targetTrackId) {
      targetTrackId = `track-${Date.now()}`;
      store.addTrack({ id: targetTrackId, name: `Track 1`, volume: 1, pan: 0, muted: false, solo: false, locked: false });
    }

    const { trackId, start } = getSafeTrackAndStart(targetTrackId, currentTime, asset.buffer.duration);

    store.addClip({
      id: `clip-${Date.now()}`,
      assetId: asset.id,
      trackId: trackId,
      start: start,
      offset: 0,
      duration: asset.buffer.duration
    });
  };

  const handleDrop = async (e: React.DragEvent, trackId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (isPlaying) stop();
    setDragOverTrackId(null);
    setIsDragOverNewTrack(false);

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const dropTime = Math.max(0, x / pixelsPerSecond);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleOSFileDrop(e.dataTransfer.files, dropTime, trackId);
      return;
    }

    let dragData = internalDragData;
    try {
      const jsonStr = e.dataTransfer.getData('application/json');
      if (jsonStr) dragData = JSON.parse(jsonStr);
    } catch (err) { }

    if (dragData?.type === 'asset' || dragData?.type === 'asset-list') {
      let targetTrackId = trackId;

      if (!targetTrackId) {
        targetTrackId = `track-${Date.now()}`;
        store.addTrack({ id: targetTrackId, name: `Track ${store.tracks.length + 1}`, volume: 1, pan: 0, muted: false, solo: false, locked: false });
      }

      const dataAny = dragData as any;
      const assetIds: string[] = dataAny.type === 'asset-list' ? dataAny.ids || dataAny.assetIds : [dataAny.id];
      let currentDropTime = dropTime;

      assetIds.forEach((id: string) => {
        const asset = store.assets.find(a => a.id === id);
        if (asset) {
          const { trackId: safeTrackId, start } = getSafeTrackAndStart(targetTrackId!, currentDropTime, asset.buffer.duration);
          store.addClip({
            id: `clip-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            assetId: asset.id,
            trackId: safeTrackId,
            start: start,
            offset: 0,
            duration: asset.buffer.duration
          });
          currentDropTime = start + asset.buffer.duration + 0.1; // Space out sequential clips
        }
      });
      internalDragData = null;
      setSelectedAssetIds([]);
    }
  };

  const handleTrackDragEnter = (e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    setDragOverTrackId(trackId);
  };

  const handleTrackDragLeave = (e: React.DragEvent, trackId: string) => {
    // Only clear if leaving to outside the track row (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverTrackId(prev => prev === trackId ? null : prev);
    }
  };

  // Check if a drag event carries an asset from the media bin
  const hasDragAsset = (e: React.DragEvent) => {
    try {
      const types = Array.from(e.dataTransfer.types);
      if (types.includes('application/json')) return true;
    } catch {}
    return !!internalDragData && (internalDragData.type === 'asset' || (internalDragData as any).type === 'asset-list');
  };

  const handleNewTrackDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isPlaying) stop();
    setIsDragOverNewTrack(false);

    // Calculate drop time from X relative to timeline scroll container
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const dropTime = Math.max(0, x / pixelsPerSecond);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleOSFileDrop(e.dataTransfer.files, dropTime);
      return;
    }

    let dragData = internalDragData;
    try {
      const jsonStr = e.dataTransfer.getData('application/json');
      if (jsonStr) dragData = JSON.parse(jsonStr);
    } catch (err) {}

    if (dragData?.type === 'asset' || dragData?.type === 'asset-list') {
      const dataAny = dragData as any;
      const assetIds: string[] = dataAny.type === 'asset-list' ? dataAny.ids || dataAny.assetIds : [dataAny.id];
      let currentDropTime = dropTime;

      assetIds.forEach((id: string) => {
        const asset = store.assets.find(a => a.id === id);
        if (asset) {
          const newTrackId = `track-${Date.now()}-${Math.random().toString(36).substring(7)}`;
          store.addTrack({ id: newTrackId, name: `Track ${store.tracks.length + 1}`, volume: 1, pan: 0, muted: false, solo: false, locked: false });
          store.addClip({
            id: `clip-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            assetId: asset.id,
            trackId: newTrackId,
            start: currentDropTime,
            offset: 0,
            duration: asset.buffer.duration,
          });
          currentDropTime += asset.buffer.duration + 0.1;
        }
      });
      internalDragData = null;
      setSelectedAssetIds([]);
    }
  };

  const getSnappedStart = (requestedStart: number, duration: number, ignoreClipId: string) => {
    const SNAP_THRESHOLD = 15 / pixelsPerSecond; // 15 pixels magnet distance
    const snapPoints = new Set([0, currentTime]);
    store.clips.forEach(c => {
      if (c.id !== ignoreClipId) {
        snapPoints.add(c.start);
        snapPoints.add(c.start + c.duration);
      }
    });

    let bestStart = requestedStart;
    let minDiff = SNAP_THRESHOLD;
    let snappedPoint: number | null = null;

    snapPoints.forEach(p => {
      if (Math.abs(requestedStart - p) < minDiff) {
        bestStart = p;
        minDiff = Math.abs(requestedStart - p);
        snappedPoint = p;
      }
      if (Math.abs((requestedStart + duration) - p) < minDiff) {
        bestStart = p - duration;
        minDiff = Math.abs((requestedStart + duration) - p);
        snappedPoint = p;
      }
    });

    // Ensure start doesn't go below 0
    if (bestStart < 0) {
      bestStart = 0;
      snappedPoint = 0;
    }

    return { start: bestStart, point: snappedPoint };
  };

  // Custom Mouse Drag logic for Clips
  useEffect(() => {
    if (!clipDrag) return;

    const handleMouseMove = (e: MouseEvent) => {
      setClipDrag(prev => prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null);
    };

    const handleMouseUp = () => {
      if (isPlaying) stop();
      const draggedClip = store.clips.find(c => c.id === clipDrag.clipId);
      if (draggedClip) {
        const dx = clipDrag.currentX - clipDrag.startX;
        const dy = clipDrag.currentY - clipDrag.startY;

        let rawNewStart = Math.max(0, clipDrag.initialStart + dx / pixelsPerSecond);
        const newStart = getSnappedStart(rawNewStart, draggedClip.duration, draggedClip.id).start;
        const timeDelta = newStart - clipDrag.initialStart;

        const trackOffset = Math.round(dy / trackHeight);

        const isDraggedSelected = selectedClipIds.includes(draggedClip.id);
        const clipsToMove = isDraggedSelected && selectedClipIds.length > 1
          ? store.clips.filter(c => selectedClipIds.includes(c.id))
          : [draggedClip];

        const movedClipsData = clipsToMove.map(c => {
          let currentTrackIndex = store.tracks.findIndex(t => t.id === c.trackId);
          if (currentTrackIndex === -1) currentTrackIndex = 0;

          const targetTrackIndex = currentTrackIndex + trackOffset;

          // If dragged below all tracks → create a new track
          if (targetTrackIndex >= store.tracks.length) {
            const newTrackId = `track-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            store.addTrack({ id: newTrackId, name: `Track ${store.tracks.length + 1}`, volume: 1, pan: 0, muted: false, solo: false, locked: false });
            return {
              id: c.id,
              newStart: Math.max(0, c.start + timeDelta),
              targetTrackId: newTrackId,
              isNewTrack: true,
            };
          }

          const clampedIndex = Math.max(0, Math.min(targetTrackIndex, store.tracks.length - 1));
          return {
            id: c.id,
            newStart: Math.max(0, c.start + timeDelta),
            targetTrackId: store.tracks[clampedIndex].id,
            isNewTrack: false,
          };
        });

        movedClipsData.forEach(data => {
          store.updateClip(data.id, { start: data.newStart, trackId: data.targetTrackId });
        });

        if (clipsToMove.length === 1) {
          const data = movedClipsData[0];
          if (!data.isNewTrack) {
            const otherClips = store.clips.filter(c => c.trackId === data.targetTrackId && c.id !== data.id);
            const overlaps = otherClips.filter(c => data.newStart < c.start + c.duration && data.newStart + draggedClip.duration > c.start);
            if (overlaps.length > 0) {
              overlaps.forEach(c => {
                const newStartForOverlapped = data.newStart + draggedClip.duration;
                const shiftAmount = newStartForOverlapped - c.start;
                store.updateClip(c.id, { start: newStartForOverlapped });
                otherClips.forEach(laterClip => {
                  if (laterClip.start >= c.start && laterClip.id !== c.id) {
                    store.updateClip(laterClip.id, { start: laterClip.start + shiftAmount });
                  }
                });
              });
            }
          }
        }
      }
      setClipDrag(null);
      (window as any).activeSnapPoint = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [clipDrag, store, pixelsPerSecond, isPlaying, stop]);

  useEffect(() => {
    engine.updateVolumes(store.tracks);
  }, [store.tracks]);

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  // Pre-calculate visual shifts for clips being pushed by a dragged clip
  const previewShifts: Record<string, number> = {};
  let dragSnappedDx = 0;
  let dragSnappedDy = 0;

  if (clipDrag) {
    const dragClip = store.clips.find(c => c.id === clipDrag.clipId);
    if (dragClip) {
      const dx = clipDrag.currentX - clipDrag.startX;
      const dy = clipDrag.currentY - clipDrag.startY;
      const rawNewStart = Math.max(0, clipDrag.initialStart + dx / pixelsPerSecond);
      const snapResult = getSnappedStart(rawNewStart, dragClip.duration, dragClip.id);
      const dragNewStart = snapResult.start;

      // We can export activeSnapPoint to draw a vertical line!
      if (snapResult.point !== null) {
        (window as any).activeSnapPoint = snapResult.point;
      } else {
        (window as any).activeSnapPoint = null;
      }

      dragSnappedDx = (dragNewStart - clipDrag.initialStart) * pixelsPerSecond;
      dragSnappedDy = dy; // Keep Y as is for visual movement
      let currentTrackIndex = store.tracks.findIndex(t => t.id === clipDrag.initialTrackId);
      if (currentTrackIndex === -1) currentTrackIndex = 0;
      const trackOffset = Math.round(dy / trackHeight);
      const targetTrackIndex = Math.max(0, currentTrackIndex + trackOffset);

      const dragTargetTrackId = targetTrackIndex >= store.tracks.length
        ? 'new-track'
        : store.tracks[targetTrackIndex].id;

      const otherClips = store.clips.filter(c => c.trackId === dragTargetTrackId && c.id !== dragClip.id);
      const overlaps = otherClips.filter(c => dragNewStart < c.start + c.duration && dragNewStart + dragClip.duration > c.start);

      if (overlaps.length > 0) {
        overlaps.forEach(c => {
          const newStartForOverlapped = dragNewStart + dragClip.duration;
          const shiftAmount = newStartForOverlapped - c.start;

          previewShifts[c.id] = Math.max(previewShifts[c.id] || 0, shiftAmount);

          otherClips.forEach(laterClip => {
            if (laterClip.start >= c.start && laterClip.id !== c.id) {
              previewShifts[laterClip.id] = Math.max(previewShifts[laterClip.id] || 0, shiftAmount);
            }
          });
        });
      }
    }
  } else {
    (window as any).activeSnapPoint = null;
  }

  // True when clip drag is past the last track (will create a new track on drop)
  let isClipDragBelowAll = false;
  if (clipDrag) {
    const dy = clipDrag.currentY - clipDrag.startY;
    const trackOffset = Math.round(dy / trackHeight);
    const currentTrackIndex = store.tracks.findIndex(t => t.id === clipDrag.initialTrackId);
    if (currentTrackIndex !== -1 && currentTrackIndex + trackOffset >= store.tracks.length) {
      isClipDragBelowAll = true;
    }
  }

  const maxEndTime = store.clips.reduce((max, clip) => Math.max(max, clip.start + clip.duration), 0);
  const toggleTab = (id: string, name: string, component: string) => {
    if (model.getNodeById(id)) {
      model.doAction(Actions.deleteTab(id));
    } else {
      // Must target a TabSetNode, not a TabNode.
      // getFirstTabSet() walks the tree and returns the first available tabset.
      const targetTabset = model.getActiveTabset() || model.getFirstTabSet();
      if (targetTabset) {
        model.doAction(
          Actions.addNode(
            { type: 'tab', component, name, id },
            targetTabset.getId(),
            DockLocation.CENTER,
            -1
          )
        );
      }
    }
  };
  const timelineWidthStr = maxEndTime === 0 ? '100%' : `${maxEndTime * pixelsPerSecond + 800}px`;
  const rulerTicksCount = Math.max(100, Math.ceil((maxEndTime + 120) / 5));

  const factory = (node: TabNode) => {
    const component = node.getComponent();
    switch (component) {
      case "mediaBin":
        return (
          <div
            style={{ width: '100%', height: '100%', backgroundColor: '#18181b', display: 'flex', flexDirection: 'column' }}
            onDragEnter={(e) => { e.preventDefault(); }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
            onDrop={handleMediaBinDrop}
          >
            <div style={{ padding: '8px 10px 0 10px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', backgroundColor: '#27272a', padding: '4px', borderRadius: '4px' }} title="Import Media">
                <Plus size={14} />
                <input type="file" accept="audio/*" multiple hidden onChange={handleFileUpload} />
              </label>
            </div>
            <div
              ref={mediaBinRef}
              style={{ flex: 1, overflowY: 'auto', padding: '4px 6px', position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '4px', alignContent: 'start' }}
              onMouseDown={handleMediaBinMouseDown}
            >
              {store.assets.length === 0 && <div style={{ color: '#a1a1aa', fontSize: '12px', textAlign: 'center', marginTop: '20px', pointerEvents: 'none', gridColumn: '1 / -1' }}>Belum ada media.</div>}
              {store.assets.map(asset => (
                <div
                  key={asset.id}
                  data-asset-id={asset.id}
                  draggable
                  onDragStart={(e) => handleDragStartAsset(e, asset.id)}
                  onDragEnd={() => { internalDragData = null; }}
                  onClick={(e) => {
                    if (e.ctrlKey || e.metaKey) {
                      setSelectedAssetIds(prev => prev.includes(asset.id) ? prev.filter(id => id !== asset.id) : [...prev, asset.id]);
                    } else {
                      setSelectedAssetIds([asset.id]);
                    }
                  }}
                  style={{
                    backgroundColor: selectedAssetIds.includes(asset.id) ? '#2563eb' : 'transparent',
                    padding: '2px 4px', borderRadius: '2px', marginBottom: '0', cursor: 'grab', fontSize: '11px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    color: selectedAssetIds.includes(asset.id) ? '#fff' : '#d4d4d8',
                    transition: 'background-color 0.05s'
                  }}
                  onMouseEnter={(e) => { if (!selectedAssetIds.includes(asset.id)) e.currentTarget.style.backgroundColor = '#1f1f23'; }}
                  onMouseLeave={(e) => { if (!selectedAssetIds.includes(asset.id)) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, overflow: 'hidden' }}>
                    <Music size={10} color={selectedAssetIds.includes(asset.id) ? '#93c5fd' : '#71717a'} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: '14px' }} title={asset.name}>{asset.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '9px', color: selectedAssetIds.includes(asset.id) ? '#93c5fd' : '#71717a' }}>
                      {Math.floor(asset.buffer.duration / 60)}:{(Math.floor(asset.buffer.duration % 60)).toString().padStart(2, '0')}
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); handleAddAssetManual(asset.id); }} style={{ background: 'transparent', border: 'none', color: selectedAssetIds.includes(asset.id) ? '#fff' : '#71717a', cursor: 'pointer', padding: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '2px' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'} title="Tambah ke Timeline">
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              ))}

              {mediaSelectionBox && (
                <div
                  style={{ position: 'absolute', border: '1px solid rgba(59, 130, 246, 0.5)', backgroundColor: 'rgba(59, 130, 246, 0.1)', left: Math.min(mediaSelectionBox.startX, mediaSelectionBox.endX), top: Math.min(mediaSelectionBox.startY, mediaSelectionBox.endY), width: Math.abs(mediaSelectionBox.endX - mediaSelectionBox.startX), height: Math.abs(mediaSelectionBox.endY - mediaSelectionBox.startY), pointerEvents: 'none', zIndex: 50 }}
                />
              )}
            </div>
          </div>
        );
      case "masterMeter":
        return <MasterMeter levels={levels} />;
      case "effects":
      case "details":
        return (() => {
          const selectedClips = store.clips.filter(c => selectedClipIds.includes(c.id));
          const isMulti = selectedClips.length > 1;
          return (
            <div style={{ padding: '15px', flex: 1, overflowY: 'auto', backgroundColor: '#18181b', height: '100%' }}>
              {selectedClipIds.length >= 1 ? (() => {
                if (component === 'details') {
                  if (isMulti) {
                    return <div style={{ color: '#71717a', fontSize: '12px', textAlign: 'center', marginTop: '20px' }}>{selectedClips.length} klip dipilih</div>;
                  }
                  const clip = selectedClips[0];
                  const asset = store.assets.find(a => a.id === clip.assetId);
                  return (
                    <div style={{ fontSize: '12px', color: '#d4d4d8', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div><span style={{ color: '#71717a' }}>Name:</span> {asset?.name}</div>
                      <div><span style={{ color: '#71717a' }}>Start:</span> {clip?.start.toFixed(2)}s</div>
                      <div><span style={{ color: '#71717a' }}>Duration:</span> {clip?.duration.toFixed(2)}s</div>
                    </div>
                  );
                } else {
                  const commonFadeIn = selectedClips.every(c => c.fadeIn === selectedClips[0].fadeIn) ? selectedClips[0].fadeIn || 0 : 0;
                  const commonFadeOut = selectedClips.every(c => c.fadeOut === selectedClips[0].fadeOut) ? selectedClips[0].fadeOut || 0 : 0;
                  const minDuration = Math.min(...selectedClips.map(c => c.duration));
                  return (
                    <div style={{ fontSize: '12px', color: '#d4d4d8', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      <div style={{ fontWeight: 'bold', borderBottom: '1px solid #27272a', paddingBottom: '5px', marginBottom: '5px' }}>Fades {isMulti ? `(${selectedClips.length} klip)` : ''}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Fade In</span>
                          <span style={{ color: '#3b82f6' }}>{commonFadeIn.toFixed(2)}s</span>
                        </div>
                        <input type="range" className="daw-slider vol-slider" min="0" max={minDuration} step="0.01" value={commonFadeIn} onChange={(e) => { const val = parseFloat(e.target.value); selectedClipIds.forEach(id => store.updateClip(id, { fadeIn: val })); }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Fade Out</span>
                          <span style={{ color: '#3b82f6' }}>{commonFadeOut.toFixed(2)}s</span>
                        </div>
                        <input type="range" className="daw-slider vol-slider" min="0" max={minDuration} step="0.01" value={commonFadeOut} onChange={(e) => { const val = parseFloat(e.target.value); selectedClipIds.forEach(id => store.updateClip(id, { fadeOut: val })); }} />
                      </div>
                    </div>
                  );
                }
              })() : (
                <div style={{ color: '#71717a', fontSize: '12px', textAlign: 'center', marginTop: '20px' }}>Pilih klip untuk melihat pengaturan</div>
              )}
            </div>
          );
        })();
      case "timeline":
        return (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#1e1e1e', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 15px', backgroundColor: '#18181b', borderBottom: '1px solid #27272a', zIndex: 30 }}>
              <div style={{ display: 'flex', gap: '5px' }}>
                <button onClick={() => setTimelineMode('select')} style={{ background: timelineMode === 'select' ? '#3f3f46' : 'transparent', border: 'none', color: timelineMode === 'select' ? '#3b82f6' : '#a1a1aa', cursor: 'pointer', padding: '6px', borderRadius: '4px' }} title="Pilih (V)"><MousePointer2 size={16} /></button>
                <button onClick={() => setTimelineMode('split')} style={{ background: timelineMode === 'split' ? '#3f3f46' : 'transparent', border: 'none', color: timelineMode === 'split' ? '#3b82f6' : '#a1a1aa', cursor: 'pointer', padding: '6px', borderRadius: '4px' }} title="Alat Silet / Razor (C)"><Scissors size={16} /></button>
                <div style={{ width: '1px', backgroundColor: '#3f3f46', margin: '0 5px' }} />
                <button onClick={handleSplit} style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer', padding: '6px', borderRadius: '4px' }} title="Split Instan di Playhead (B)"><SplitSquareHorizontal size={16} /></button>
                <button onClick={handleCut} disabled={selectedClipIds.length === 0} style={{ background: 'transparent', border: 'none', color: selectedClipIds.length > 0 ? '#ef4444' : '#52525b', cursor: selectedClipIds.length > 0 ? 'pointer' : 'not-allowed', padding: '6px' }} title="Hapus Klip (Del)"><Trash2 size={16} /></button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
                <div style={{ fontSize: '18px', fontFamily: 'monospace', color: '#fff', width: '100px', textAlign: 'center' }}>{formatTime(currentTime)}</div>
                <button onClick={toggleRecord} style={{ background: 'transparent', border: 'none', color: isRecording ? '#ef4444' : '#a1a1aa', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Record (Microphone)">
                  <Mic size={16} fill={isRecording ? '#ef4444' : 'none'} className={isRecording ? 'pulse-anim' : ''} />
                </button>
                <button onClick={stop} style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer', padding: '6px' }} title="Stop"><Square size={16} fill="currentColor" /></button>
                <button onClick={playPause} style={{ background: 'transparent', border: 'none', color: isPlaying ? '#3b82f6' : '#fff', cursor: 'pointer', padding: '6px' }} title="Play/Pause">
                  {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                </button>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '12px', color: '#a1a1aa' }}>
                <span title="Zoom Out Horizontal"><ZoomOut size={16} onClick={() => setPixelsPerSecond(prev => Math.max(5, prev * 0.8))} style={{ cursor: 'pointer' }} /></span>
                <input type="range" className="daw-slider" min="10" max="400" value={pixelsPerSecond} onChange={(e) => setPixelsPerSecond(Number(e.target.value))} style={{ width: '70px' }} title="Zoom Horizontal" />
                <span title="Zoom In Horizontal"><ZoomIn size={16} onClick={() => setPixelsPerSecond(prev => Math.min(400, prev * 1.2))} style={{ cursor: 'pointer' }} /></span>
                <div style={{ width: '1px', height: '16px', backgroundColor: '#3f3f46', margin: '0 2px' }} />
                <span title="Zoom Out Vertikal"><ZoomOut size={14} onClick={() => setTrackHeight(prev => Math.max(40, Math.round(prev * 0.8)))} style={{ cursor: 'pointer', opacity: 0.7 }} /></span>
                <input type="range" className="daw-slider" min="40" max="200" value={trackHeight} onChange={(e) => setTrackHeight(Number(e.target.value))} style={{ width: '60px' }} title="Zoom Vertikal (Tinggi Track)" />
                <span title="Zoom In Vertikal"><ZoomIn size={14} onClick={() => setTrackHeight(prev => Math.min(200, Math.round(prev * 1.2)))} style={{ cursor: 'pointer', opacity: 0.7 }} /></span>
              </div>
            </div>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', backgroundColor: '#121212' }}>

              {/* LEFT: Fixed track header panel — has its own area, never scrolls horizontally */}
              <div style={{ width: '160px', flexShrink: 0, display: 'flex', flexDirection: 'column', backgroundColor: '#1a1a1e', borderRight: '1px solid #2e2e36', zIndex: 10, position: 'relative' }}>
                {/* Corner cell — height matches ruler */}
                <div style={{ height: '30px', flexShrink: 0, borderBottom: '1px solid #27272a' }} />
                {/* Track headers — vertical scroll synced with right panel via JS */}
                <div ref={trackHeadersRef} style={{ flex: 1, overflowY: 'hidden' }}>
                  {store.tracks.length === 0 && <div style={{ minHeight: '300px' }} />}
                  {store.tracks.map(track => (
                    <div key={track.id} style={{ height: `${trackHeight}px`, flexShrink: 0, borderBottom: '1px solid #27272a', padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: '4px', boxSizing: 'border-box', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '600', color: '#d4d4d8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{track.name}</span>
                        <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                          <button onClick={() => store.updateTrack(track.id, { muted: !track.muted })} title="Mute" style={{ background: track.muted ? '#ef4444' : '#3f3f46', border: 'none', color: track.muted ? '#fff' : '#a1a1aa', fontSize: '10px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '3px', cursor: 'pointer', lineHeight: '14px' }}>M</button>
                          <button onClick={() => store.updateTrack(track.id, { solo: !track.solo })} title="Solo" style={{ background: track.solo ? '#eab308' : '#3f3f46', border: 'none', color: track.solo ? '#000' : '#a1a1aa', fontSize: '10px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '3px', cursor: 'pointer', lineHeight: '14px' }}>S</button>
                        </div>
                      </div>
                      {trackHeight >= 60 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Volume2 size={11} color="#71717a" />
                          <input type="range" min="0" max="2" step="0.01" value={track.volume} onChange={(e) => store.updateTrack(track.id, { volume: parseFloat(e.target.value) })} className="daw-slider" title="Volume" />
                        </div>
                      )}
                      {trackHeight >= 80 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Headphones size={11} color="#71717a" />
                          <input type="range" min="-1" max="1" step="0.01" value={track.pan} onChange={(e) => store.updateTrack(track.id, { pan: parseFloat(e.target.value) })} className="daw-slider pan-slider" title="Pan (L/R)" />
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                        <button onClick={() => store.updateTrack(track.id, { locked: !track.locked })} style={{ background: 'transparent', border: 'none', color: track.locked ? '#ef4444' : '#52525b', cursor: 'pointer', padding: 0 }} title="Kunci Track">
                          {track.locked ? <Lock size={12} /> : <Unlock size={12} />}
                        </button>
                        <button onClick={() => { if (isPlaying) stop(); store.deleteTrack(track.id); }} disabled={track.locked} style={{ background: 'transparent', border: 'none', color: track.locked ? '#3f3f46' : '#52525b', cursor: track.locked ? 'not-allowed' : 'pointer', padding: 0 }} title="Hapus Track">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {store.tracks.length > 0 && <div style={{ minHeight: '60px', flex: 1 }} />}
                </div>
              </div>

              {/* RIGHT: Scrollable timeline — ruler + track content + playhead, all in one scroll zone */}
              <div
                ref={timelineScrollRef}
                style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', position: 'relative', display: 'flex', flexDirection: 'column' }}
                onWheel={handleWheelReact}
                onDragEnter={(e) => { e.preventDefault(); }}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                onDrop={(e) => handleDrop(e)}
              >
                {/* Ruler — sticky to top of scroll area */}
                <div style={{ position: 'sticky', top: 0, zIndex: 60, backgroundColor: '#18181b' }}>
                  <div
                    style={{ width: timelineWidthStr, height: '30px', borderBottom: '1px solid #27272a', position: 'relative', overflow: 'hidden', cursor: 'pointer', backgroundColor: '#18181b' }}
                    onMouseDown={handleRulerMouseDown}
                  >
                    {Array.from({ length: rulerTicksCount }).map((_, i) => {
                      const s = i * 5;
                      const min = Math.floor(s / 60);
                      const sec = s % 60;
                      const timeLabel = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
                      return (
                        <React.Fragment key={i}>
                          <div style={{ position: 'absolute', left: s * pixelsPerSecond + 4, top: 10, color: '#71717a', fontSize: '10px', pointerEvents: 'none', fontFamily: 'monospace' }}>
                            {timeLabel}
                          </div>
                          <div style={{ position: 'absolute', left: s * pixelsPerSecond, bottom: 0, width: '1px', height: '10px', backgroundColor: '#3f3f46', pointerEvents: 'none' }} />
                          {Array.from({ length: 4 }).map((_, j) => {
                            const minorS = s + j + 1;
                            return (
                              <div key={`minor-${i}-${j}`} style={{ position: 'absolute', left: minorS * pixelsPerSecond, bottom: 0, width: '1px', height: '5px', backgroundColor: '#27272a', pointerEvents: 'none' }} />
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                    {/* Playhead on ruler */}
                    <div style={{ position: 'absolute', left: currentTime * pixelsPerSecond, top: 0, bottom: 0, width: '1px', backgroundColor: '#ef4444', zIndex: 5, pointerEvents: 'none' }} />
                  </div>
                </div>

                {/* Track content area — no headers here */}
                <div
                  ref={timelineRef}
                  style={{ display: 'flex', flexDirection: 'column', flex: 1, position: 'relative', width: timelineWidthStr }}
                  onMouseDown={handleTrackMouseDown}
                >
                  {store.tracks.length === 0 && (
                    <div
                      style={{ flex: 1, minHeight: '300px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#52525b', pointerEvents: 'auto' }}
                      onDragEnter={(e) => { e.preventDefault(); }}
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                      onDrop={(e) => handleDrop(e)}
                    >
                      Tarik Media dari panel kiri ke area ini untuk membuat Track baru
                    </div>
                  )}

                  {store.tracks.map(track => (
                    <div
                      key={track.id}
                      style={{
                        height: `${trackHeight}px`, flexShrink: 0, position: 'relative',
                        borderBottom: '1px solid #27272a', boxSizing: 'border-box',
                        overflow: clipDrag ? 'visible' : 'hidden',
                        outline: dragOverTrackId === track.id ? '2px solid rgba(59,130,246,0.7)' : 'none',
                        backgroundColor: dragOverTrackId === track.id ? 'rgba(59,130,246,0.06)' : 'transparent',
                        transition: 'background-color 0.1s, outline 0.1s',
                      }}
                      onDragEnter={(e) => handleTrackDragEnter(e, track.id)}
                      onDragLeave={(e) => handleTrackDragLeave(e, track.id)}
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                      onDrop={(e) => handleDrop(e, track.id)}
                    >
                    {store.clips.filter(c => c.trackId === track.id).map(clip => (
                      <ClipView
                        key={clip.id}
                        clip={clip}
                        asset={store.assets.find(a => a.id === clip.assetId)!}
                        pixelsPerSecond={pixelsPerSecond}
                        isSelected={selectedClipIds.includes(clip.id)}
                        isDragging={clipDrag?.clipId === clip.id || (!!clipDrag && selectedClipIds.includes(clipDrag.clipId) && selectedClipIds.includes(clip.id))}
                        dragDx={clipDrag && (clipDrag.clipId === clip.id || (selectedClipIds.includes(clipDrag.clipId) && selectedClipIds.includes(clip.id))) ? dragSnappedDx : 0}
                        dragDy={clipDrag && (clipDrag.clipId === clip.id || (selectedClipIds.includes(clipDrag.clipId) && selectedClipIds.includes(clip.id))) ? dragSnappedDy : 0}
                        previewShift={previewShifts[clip.id] || 0}
                        cursor={timelineMode === 'split' ? 'crosshair' : 'grab'}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (e.shiftKey) {
                            setSelectedClipIds(prev => prev.includes(clip.id) ? prev.filter(id => id !== clip.id) : [...prev, clip.id]);
                          } else {
                            setSelectedClipIds([clip.id]);
                          }
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          if (timelineMode === 'split') {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const clickX = e.clientX - rect.left;
                            let splitTime = clip.start + (clickX / pixelsPerSecond);

                            const clickAbsoluteX = e.clientX - timelineScrollRef.current!.getBoundingClientRect().left + timelineScrollRef.current!.scrollLeft;
                            const playheadAbsoluteX = currentTime * pixelsPerSecond;
                            if (Math.abs(clickAbsoluteX - playheadAbsoluteX) < 15) {
                              splitTime = currentTime;
                            }
                            store.splitClip(clip.id, splitTime);
                            setTimelineMode('select');
                          } else {
                            setClipDrag({
                              clipId: clip.id,
                              startX: e.clientX,
                              startY: e.clientY,
                              currentX: e.clientX,
                              currentY: e.clientY,
                              initialStart: clip.start,
                              initialTrackId: clip.trackId
                            });
                          }
                        }}
                      />
                    ))}
                    </div>
                  ))}

                  {/* Drop zone for adding a new track */}
                  {store.tracks.length > 0 && (
                    <div
                      style={{
                        minHeight: '60px',
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderTop: (isDragOverNewTrack || isClipDragBelowAll) ? '2px dashed rgba(59,130,246,0.8)' : '2px dashed transparent',
                        backgroundColor: (isDragOverNewTrack || isClipDragBelowAll) ? 'rgba(59,130,246,0.08)' : 'transparent',
                        transition: 'background-color 0.15s, border-color 0.15s',
                        cursor: 'default',
                      }}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        if (hasDragAsset(e) || e.dataTransfer.files.length > 0) setIsDragOverNewTrack(true);
                      }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOverNewTrack(false);
                      }}
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                      onDrop={handleNewTrackDrop}
                    >
                      {(isDragOverNewTrack || isClipDragBelowAll) && (
                        <span style={{ color: 'rgba(59,130,246,0.9)', fontSize: '12px', pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                          Tambahkan sebagai Track Baru
                        </span>
                      )}
                    </div>
                  )}

                  {selectionBox && (
                    <div
                      style={{ position: 'absolute', border: '1px solid rgba(59, 130, 246, 0.5)', backgroundColor: 'rgba(59, 130, 246, 0.1)', left: Math.min(selectionBox.startX, selectionBox.endX), top: Math.min(selectionBox.startY, selectionBox.endY), width: Math.abs(selectionBox.endX - selectionBox.startX), height: Math.abs(selectionBox.endY - selectionBox.startY), pointerEvents: 'none', zIndex: 50 }}
                    />
                  )}

                  {/* Playhead — lives entirely in the right panel, never behind the header panel */}
                  <div
                    style={{ position: 'absolute', left: currentTime * pixelsPerSecond, top: 0, bottom: 0, width: '1px', backgroundColor: '#ef4444', zIndex: 40, pointerEvents: 'none' }}
                  >
                    <div
                      style={{ position: 'absolute', top: 0, left: -4, width: 9, height: 12, backgroundColor: '#18181b', border: `2px solid ${store.tracks.length === 0 ? '#52525b' : '#e4e4e7'}`, borderRadius: '3px', pointerEvents: 'auto', cursor: store.tracks.length === 0 ? 'not-allowed' : (timelineMode === 'split' ? 'crosshair' : 'ew-resize') }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
    }
    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#121212', color: '#fff', userSelect: 'none' }}>

      {/* 1. TOP NAVBAR */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 20px', backgroundColor: '#16161a', borderBottom: '1px solid #1e1e24' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>

            <div style={{ fontWeight: '600', fontSize: '16px', color: '#b8b8bc', letterSpacing: '0.3px' }}>Audiotore Pro</div>
          </div>

          <div style={{ display: 'flex', gap: '15px', color: '#505058', fontSize: '12px', marginLeft: '20px' }}>
            <span style={{ cursor: 'pointer' }}>File</span>
            <span style={{ cursor: 'pointer' }}>Edit</span>

            <div ref={viewMenuRef} style={{ position: 'relative' }}>
              <span
                style={{ cursor: 'pointer', color: viewMenuOpen ? '#b8b8bc' : '#505058', fontSize: '12px' }}
                onClick={() => setViewMenuOpen(!viewMenuOpen)}
              >View</span>
              {viewMenuOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', left: '-8px',
                  backgroundColor: '#18181b',
                  border: '1px solid #252528',
                  borderRadius: '6px',
                  padding: '4px',
                  zIndex: 200,
                  minWidth: '180px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                }}>
                  {([
                    ['mediaBin', 'Media Bin'],
                    ['masterMeter', 'Master Meter'],
                    ['effects', 'Effects'],
                    ['details', 'Details'],
                    ['timeline', 'Timeline'],
                  ] as [string, string][]).map(([id, label]) => {
                    const isVisible = !!model.getNodeById(id);
                    return (
                      <div
                        key={id}
                        onClick={() => toggleTab(id, label, id)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '7px 10px', borderRadius: '4px', cursor: 'pointer',
                          color: isVisible ? '#a8a8b0' : '#42424a',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#222226')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span style={{ fontSize: '12px' }}>{label}</span>
                        {/* Custom dot indicator */}
                        <span style={{
                          width: '6px', height: '6px', borderRadius: '50%',
                          backgroundColor: isVisible ? '#5a5a6a' : 'transparent',
                          border: `1px solid ${isVisible ? '#5a5a6a' : '#32323a'}`,
                          flexShrink: 0,
                          transition: 'all 0.15s',
                        }} />
                      </div>
                    );
                  })}
                  <div style={{ borderTop: '1px solid #222226', margin: '4px 0' }} />
                  <div
                    onClick={() => { setViewMenuOpen(false); window.location.reload(); }}
                    style={{
                      padding: '7px 10px', borderRadius: '4px', cursor: 'pointer',
                      color: '#6a3030', fontSize: '12px', transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#221a1a')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    Reset Workspace
                  </div>
                </div>
              )}
            </div>

            <span style={{ cursor: 'pointer' }}>Help</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <button style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Settings (Audio Output, Buffer Size)">
            <Settings size={18} />
          </button>
          <button style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '14px' }}>
            <Download size={16} /> Export
          </button>
        </div>
      </header>
      <div style={{ flex: 1, position: 'relative' }}>
        <Layout model={model} factory={factory} />
      </div>

    </div>
  );
}

export default App;