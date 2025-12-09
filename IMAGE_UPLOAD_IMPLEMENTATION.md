# Image Upload Implementation Guide

## Changes Made

### 1. Added State and Refs (Line ~48)
```tsx
const [uploadingImage, setUploadingImage] = useState(false);
const imageInputRef = useRef<HTMLInputElement>(null);
```

### 2. Modified Image Insertion Case (Line ~385)
Replace:
```tsx
case 'image':
  newText = `![${textToInsert || 'Alt Text'}](https://example.com/image.jpg)`;
  cursorOffset = selectedText ? textToInsert.length + 4 : 10;
  break;
```

With:
```tsx
case 'image':
  // Trigger file input instead of inserting placeholder
  imageInputRef.current?.click();
  return; // Don't insert text yet, wait for file upload
```

### 3. Added Image Upload Handler (Add before convertToMarkdownTable function)
```tsx
// Handle image file upload
const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;

  // Validate file type
  if (!file.type.startsWith('image/')) {
    alert('Please select an image file');
    return;
  }

  // Validate file size (max 5MB)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    alert('Image size must be less than 5MB');
    return;
  }

  setUploadingImage(true);

  try {
    // Convert image to base64 data URL
    // TODO: In production, upload to file storage (S3, Cloudinary, etc.)
    const reader = new FileReader();
    
    reader.onload = () => {
      const base64Image = reader.result as string;
      const altText = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
      
      // Insert markdown image syntax
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = lessonForm.content_data.substring(start, end);
      
      const imageMarkdown = `![${selectedText || altText}](${base64Image})`;
      const newContent = 
        lessonForm.content_data.substring(0, start) +
        imageMarkdown +
        lessonForm.content_data.substring(end);

      setLessonForm({ ...lessonForm, content_data: newContent });
      
      // Set cursor after inserted image
      setTimeout(() => {
        textarea.focus();
        const newPosition = start + imageMarkdown.length;
        textarea.setSelectionRange(newPosition, newPosition);
      }, 0);

      setUploadingImage(false);
      // Reset file input
      event.target.value = '';
    };

    reader.onerror = () => {
      alert('Failed to read image file');
      setUploadingImage(false);
    };

    reader.readAsDataURL(file);
  } catch (error) {
    console.error('Error uploading image:', error);
    alert('Failed to upload image');
    setUploadingImage(false);
  }
};
```

### 4. Update Image Buttons (Two Locations: ~Line 1170 and ~Line 1503)

Find this code (appears twice):
```tsx
<button type="button" onClick={() => insertMarkdown('image')} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors" title="Insert Image">
  <span className="text-sm">🖼️</span>
</button>
</div>

{/* Other */}
```

Replace BOTH occurrences with:
```tsx
<button 
  type="button" 
  onClick={() => insertMarkdown('image')} 
  className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
  title={uploadingImage ? "Uploading..." : "Upload Image"}
  disabled={uploadingImage}
>
  <span className="text-sm">{uploadingImage ? '⏳' : '🖼️'}</span>
</button>
</div>
{/* Hidden file input for image upload */}
<input
  ref={imageInputRef}
  type="file"
  accept="image/*"
  onChange={handleImageUpload}
  className="hidden"
  aria-label="Upload image"
/>

{/* Other */}
```

## Features

✅ **File Upload Dialog** - Click image button to open file picker
✅ **File Validation** - Only accepts image files (jpg, png, gif, etc.)
✅ **Size Validation** - Max 5MB file size
✅ **Base64 Encoding** - Embeds images directly in markdown
✅ **Loading State** - Shows ⏳ icon while uploading
✅ **Alt Text** - Uses filename (without extension) as alt text
✅ **Cursor Position** - Maintains cursor position after insertion

## Usage

1. Click the 🖼️ image button in the markdown toolbar
2. Select an image file from your computer
3. Image is automatically inserted as markdown: `![filename](data:image/...)`
4. Image appears in preview mode

## Future Improvements

### Production-Ready File Storage
Replace base64 encoding with proper file storage:

```tsx
// Upload to file storage service
const formData = new FormData();
formData.append('image', file);

const response = await fetch('/api/upload/image', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

const { url } = await response.json();
const imageMarkdown = `![${altText}](${url})`;
```

### Drag & Drop Support
Add drag-and-drop functionality to textarea:

```tsx
const handleDrop = (e: React.DragEvent) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    // Process file upload
  }
};

<textarea
  onDrop={handleDrop}
  onDragOver={(e) => e.preventDefault()}
  ...
/>
```

### Image Optimization
Add image compression before upload:

```tsx
import imageCompression from 'browser-image-compression';

const options = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true
};

const compressedFile = await imageCompression(file, options);
```

### Progress Bar
Show upload progress:

```tsx
const [uploadProgress, setUploadProgress] = useState(0);

// In upload function
xhr.upload.onprogress = (e) => {
  if (e.lengthComputable) {
    setUploadProgress((e.loaded / e.total) * 100);
  }
};
```

## Testing Checklist

- [ ] Click image button opens file dialog
- [ ] Only image files can be selected
- [ ] Files over 5MB are rejected with alert
- [ ] Image button shows loading state during upload
- [ ] Image markdown is inserted at cursor position
- [ ] Image appears correctly in preview
- [ ] Selected text becomes alt text if present
- [ ] File input resets after upload
- [ ] Works in both lesson create and edit modes
- [ ] Dark mode styling is correct

## Notes

**Current Implementation**: Uses base64 encoding for images, which stores the image directly in the markdown text. This is simple but:
- ❌ Increases database size significantly
- ❌ Can cause performance issues with large images
- ❌ Not suitable for production

**Recommended for Production**: Upload images to a file storage service (AWS S3, Cloudinary, etc.) and store only the URL in markdown.
