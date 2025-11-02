# Code Changes - Exact Modifications

## File 1: LessonContent.tsx

### Location: Line 71 (Container div)

**BEFORE:**
```tsx
<div className="max-w-4xl mx-auto p-6">
```

**AFTER:**
```tsx
<div className="w-full px-4 md:px-6 lg:px-8 py-6 max-w-7xl mx-auto">
```

**What changed:**
- `max-w-4xl` → `max-w-7xl` (increased width from ~56rem to ~80rem)
- `p-6` → `px-4 md:px-6 lg:px-8 py-6` (responsive horizontal padding)
- Added `w-full` to ensure full width is used

---

## File 2: ContentRichPreview.tsx

### Change 1: Import Statement (Line 4)

**BEFORE:**
```tsx
import { 
  Play, 
  Pause, 
  FileText, 
  Video, 
  Download, 
  Maximize2,
  Clock,
  BookOpen,
  CheckCircle,
  Lock
} from 'lucide-react';
```

**AFTER:**
```tsx
import { 
  Play, 
  Pause, 
  FileText, 
  Video, 
  Download, 
  Maximize2,
  Minimize2,
  Clock,
  BookOpen,
  CheckCircle,
  Lock
} from 'lucide-react';
```

**What changed:** Added `Minimize2` to imports

---

### Change 2: State & Refs (Line 28)

**BEFORE:**
```tsx
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const youtubePlayerRef = useRef<any>(null);
  const vimeoPlayerRef = useRef<any>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
```

**AFTER:**
```tsx
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const youtubePlayerRef = useRef<any>(null);
  const vimeoPlayerRef = useRef<any>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
```

**What changed:** Added `videoContainerRef` for fullscreen target

---

### Change 3: Fullscreen Handler (After cleanup effect)

**ADDED NEW CODE:**
```tsx
  const handleFullscreenToggle = async (element: HTMLElement | null) => {
    if (!element) return;

    try {
      if (!fullscreen) {
        // Enter fullscreen
        if (element.requestFullscreen) {
          await element.requestFullscreen();
        } else if ((element as any).webkitRequestFullscreen) {
          await (element as any).webkitRequestFullscreen();
        } else if ((element as any).mozRequestFullScreen) {
          await (element as any).mozRequestFullScreen();
        } else if ((element as any).msRequestFullscreen) {
          await (element as any).msRequestFullscreen();
        }
        setFullscreen(true);
      } else {
        // Exit fullscreen
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else if ((document as any).webkitFullscreenElement) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).mozFullScreenElement) {
          await (document as any).mozCancelFullScreen();
        } else if ((document as any).msFullscreenElement) {
          await (document as any).msExitFullscreen();
        }
        setFullscreen(false);
      }
    } catch (error) {
      console.error('Error toggling fullscreen:', error);
    }
  };
```

**Purpose:** Handles fullscreen toggle with cross-browser support

---

### Change 4: Fullscreen Event Listeners (After cleanup effect)

**ADDED NEW CODE:**
```tsx
  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !((document as any).webkitFullscreenElement || (document as any).mozFullScreenElement || (document as any).msFullscreenElement)) {
        setFullscreen(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);
```

**Purpose:** Detects when fullscreen is exited and updates state accordingly

---

### Change 5: YouTube Video Container (Around Line 340)

**BEFORE:**
```tsx
        return (
          <div className="space-y-4">
            <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
              <div
                ref={iframeRef as any}
                id={`youtube-player-${videoId}`}
              />
            </div>
```

**AFTER:**
```tsx
        return (
          <div className="space-y-4">
            <div 
              ref={videoContainerRef}
              className="relative aspect-video rounded-lg overflow-hidden bg-black group"
            >
              <div
                ref={iframeRef as any}
                id={`youtube-player-${videoId}`}
                className="absolute inset-0 w-full h-full"
              />
              <button
                onClick={() => handleFullscreenToggle(videoContainerRef.current)}
                className="absolute bottom-4 right-4 bg-black/60 hover:bg-black/80 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                title={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {fullscreen ? (
                  <Minimize2 className="h-5 w-5" />
                ) : (
                  <Maximize2 className="h-5 w-5" />
                )}
              </button>
            </div>
```

**What changed:**
- Added `ref={videoContainerRef}` to container div
- Added `group` class for hover effects
- Added inner div with `absolute inset-0` positioning
- Added fullscreen button with hover animation

---

### Change 6: Vimeo Video Container (Around Line 410)

**BEFORE:**
```tsx
        return (
          <div className="space-y-4">
            <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
              <iframe
                ref={iframeRef}
                src={`https://player.vimeo.com/video/${videoId}`}
                className="absolute inset-0 w-full h-full"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
              />
            </div>
```

**AFTER:**
```tsx
        return (
          <div className="space-y-4">
            <div 
              ref={videoContainerRef}
              className="relative aspect-video rounded-lg overflow-hidden bg-black group"
            >
              <iframe
                ref={iframeRef}
                src={`https://player.vimeo.com/video/${videoId}`}
                className="absolute inset-0 w-full h-full"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
              />
              <button
                onClick={() => handleFullscreenToggle(videoContainerRef.current)}
                className="absolute bottom-4 right-4 bg-black/60 hover:bg-black/80 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                title={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {fullscreen ? (
                  <Minimize2 className="h-5 w-5" />
                ) : (
                  <Maximize2 className="h-5 w-5" />
                )}
              </button>
            </div>
```

**What changed:** Same as YouTube - added container ref, group class, and fullscreen button

---

### Change 7: Native Video Player (Around Line 480)

**BEFORE:**
```tsx
    return (
      <div className="space-y-4">
        <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
          <video
            ref={videoRef}
            controls
            className="w-full h-full"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          >
            <source src={videoUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>
```

**AFTER:**
```tsx
    return (
      <div className="space-y-4">
        <div 
          ref={videoContainerRef}
          className="relative aspect-video rounded-lg overflow-hidden bg-black group"
        >
          <video
            ref={videoRef}
            controls
            controlsList="nodownload"
            className="w-full h-full"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          >
            <source src={videoUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          <button
            onClick={() => handleFullscreenToggle(videoContainerRef.current)}
            className="absolute bottom-4 right-4 bg-black/60 hover:bg-black/80 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
            title={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {fullscreen ? (
              <Minimize2 className="h-5 w-5" />
            ) : (
              <Maximize2 className="h-5 w-5" />
            )}
          </button>
        </div>
```

**What changed:**
- Added container ref and group class
- Added `controlsList="nodownload"` to hide download button
- Added fullscreen button with same styling

---

### Change 8: Main Return Wrapper (Around Line 640)

**BEFORE:**
```tsx
  return (
    <div className="space-y-6">
      {/* Content Header */}
      <div className="bg-gradient-to-r from-blue-900/30 to-indigo-900/30 rounded-lg p-6 border border-blue-800/50">
```

**AFTER:**
```tsx
  return (
    <div className="space-y-6 w-full">
      {/* Content Header */}
      <div className="bg-gradient-to-r from-blue-900/30 to-indigo-900/30 rounded-lg p-6 border border-blue-800/50 w-full">
```

**What changed:** Added explicit `w-full` classes to main wrapper and header

---

### Change 9: Content Display Section (Around Line 705)

**BEFORE:**
```tsx
      {/* Content Display based on type */}
      <div className="bg-gray-800/30 rounded-lg p-6 border border-gray-700">
```

**AFTER:**
```tsx
      {/* Content Display based on type */}
      <div className="bg-gray-800/30 rounded-lg p-6 border border-gray-700 w-full">
```

**What changed:** Added explicit `w-full` to content section

---

## Summary of Changes

### Files Modified: 2
- `LessonContent.tsx`
- `ContentRichPreview.tsx`

### Lines Added: ~50
### Lines Modified: ~9
### Breaking Changes: 0
### New Dependencies: 0

---

## Testing Commands

```bash
# Build the project
npm run build

# Run development server
npm run dev

# Check for TypeScript errors
npm run type-check

# Run linter
npm run lint
```

---

## Rollback Instructions

If needed, revert changes:

```bash
git diff frontend/src/app/(learn)/learn/[id]/components/LessonContent.tsx
git diff frontend/src/app/(learn)/learn/[id]/components/ContentRichPreview.tsx

# To rollback:
git checkout frontend/src/app/(learn)/learn/[id]/components/LessonContent.tsx
git checkout frontend/src/app/(learn)/learn/[id]/components/ContentRichPreview.tsx
```
