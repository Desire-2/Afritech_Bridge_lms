# Quiz UI/UX Quick Reference Card

## 🎨 Quick Color Reference

### Status Colors
| Status | Background | Text | Border |
|--------|-----------|------|--------|
| Published | `bg-green-500` | `text-white` | `border-green-300` |
| Draft | `bg-yellow-500` | `text-white` | `border-yellow-300` |
| Warning | `bg-orange-500` | `text-white` | `border-orange-300` |
| Danger | `bg-red-600` | `text-white` | `border-red-300` |
| Info | `bg-blue-600` | `text-white` | `border-blue-300` |
| Disabled | `bg-slate-200` | `text-slate-400` | `border-slate-300` |

### Gradient Patterns
```css
/* Headers */
from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20

/* Buttons */
from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700

/* Cards */
from-white to-slate-50 dark:from-slate-800 dark:to-slate-700/50

/* Stats */
from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20
```

---

## 🎯 Component Class Patterns

### Cards
```jsx
// Standard Card
<div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border-2 border-slate-200 dark:border-slate-700 hover:shadow-xl transition-all duration-300">

// Enhanced Card with Gradient
<div className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-700/50 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 p-5 border-2">

// Stat Card
<div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/10 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
```

### Buttons
```jsx
// Primary Action
<button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg transform hover:-translate-y-0.5">

// Secondary Action
<button className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 rounded-lg transition-colors">

// Danger Action
<button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 font-medium shadow-md">

// Success Action
<button className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all shadow-md">

// Gradient Button
<button className="px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-bold shadow-lg hover:shadow-xl transform hover:scale-[1.02]">
```

### Badges
```jsx
// Status Badge
<span className="px-3 py-1.5 rounded-full text-xs font-bold bg-green-500 text-white shadow-md">
  ✓ Published
</span>

// Count Badge
<span className="px-2 py-1 rounded-full text-xs font-bold bg-blue-200 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
  12
</span>

// Warning Badge
<span className="px-3 py-1.5 rounded-full text-xs font-bold bg-orange-500 text-white shadow-md animate-pulse">
  ⚠️ No Questions
</span>
```

### Input Fields
```jsx
// Search Input
<input 
  className="w-full pl-12 pr-4 py-3 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-white transition-all duration-200"
/>

// Form Input
<input 
  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
/>
```

---

## 📏 Spacing & Sizing

### Common Padding Values
| Use Case | Class |
|----------|-------|
| Button | `px-6 py-3` or `px-4 py-2` |
| Card | `p-5` or `p-6` or `p-8` |
| Container | `p-4` or `p-6` |
| Compact | `p-2` or `p-3` |

### Common Gaps
| Use Case | Class |
|----------|-------|
| Button Group | `gap-2` or `gap-3` |
| Grid | `gap-4` |
| Form Fields | `space-y-4` or `space-y-6` |
| Sections | `space-y-6` or `space-y-8` |

### Rounded Corners
| Size | Class |
|------|-------|
| Small | `rounded-lg` |
| Medium | `rounded-xl` |
| Large | `rounded-2xl` |
| Full | `rounded-full` |

---

## 🎭 Animation Classes

### Hover Effects
```css
hover:shadow-lg            /* Shadow increase */
hover:shadow-xl            /* Larger shadow */
hover:scale-105            /* Slight grow */
hover:scale-[1.02]         /* Subtle grow */
hover:-translate-y-0.5     /* Float up */
hover:bg-blue-700          /* Color darken */
```

### Active Animations
```css
animate-pulse              /* Pulse effect */
animate-spin               /* Spinning (loading) */
transition-all duration-200  /* Smooth transitions */
transition-colors          /* Color only */
transition-transform       /* Transform only */
```

### Transform Classes
```css
transform                  /* Enable transforms */
scale-105                  /* 5% larger */
rotate-180                 /* 180° rotation */
-translate-y-0.5          /* Move up slightly */
```

---

## 🎨 Icon Size Reference

| Context | Size | Class |
|---------|------|-------|
| Small Icon | 16px | `h-4 w-4` |
| Medium Icon | 20px | `h-5 w-5` |
| Large Icon | 24px | `h-6 w-6` |
| XL Icon | 32px | `h-8 w-8` |
| Button Icon | 48px | `h-12 w-12` |

---

## 📊 Grid Layouts

### Responsive Grids
```jsx
// 4 Columns Desktop, 2 Tablet, 1 Mobile
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

// 3 Columns Desktop, 2 Tablet, 1 Mobile
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

// 2 Columns All Sizes
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
```

### Flex Layouts
```jsx
// Space Between
<div className="flex items-center justify-between">

// Centered
<div className="flex items-center justify-center">

// Left Aligned with Gap
<div className="flex items-center space-x-3">
```

---

## 🌓 Dark Mode Support

### Always Include Dark Mode Variants
```jsx
// Background
bg-white dark:bg-slate-800

// Text
text-slate-900 dark:text-white
text-slate-600 dark:text-slate-400

// Border
border-slate-200 dark:border-slate-700

// Gradient
from-blue-50 dark:from-blue-900/20
```

---

## ✨ Common Patterns

### Stat Card Pattern
```jsx
<div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/10 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">Label</p>
      <p className="text-3xl font-bold text-blue-900 dark:text-blue-100 mt-1">Value</p>
    </div>
    <div className="w-12 h-12 bg-blue-200 dark:bg-blue-800 rounded-full flex items-center justify-center">
      <span className="text-2xl">Icon</span>
    </div>
  </div>
</div>
```

### Action Button Group
```jsx
<div className="flex items-center space-x-2">
  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium shadow-md">
    Primary
  </button>
  <button className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 rounded-lg transition-colors">
    Secondary
  </button>
  <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all font-medium shadow-md">
    Delete
  </button>
</div>
```

### Status Badge Pattern
```jsx
<span className={`px-3 py-1.5 rounded-full text-xs font-bold shadow-md ${
  status === 'published' 
    ? 'bg-green-500 text-white'
    : 'bg-yellow-500 text-white'
}`}>
  {status === 'published' ? '✅ Published' : '📝 Draft'}
</span>
```

---

## 🎯 Font Sizes

| Use | Class |
|-----|-------|
| Hero Title | `text-3xl` or `text-4xl` |
| Page Title | `text-2xl` or `text-3xl` |
| Section Title | `text-xl` or `text-2xl` |
| Card Title | `text-lg` or `text-xl` |
| Body Text | `text-base` or `text-sm` |
| Caption | `text-xs` |

---

## 📱 Responsive Breakpoints

| Breakpoint | Min Width | Class Prefix |
|------------|-----------|--------------|
| Mobile | 0px | (none) |
| Tablet | 768px | `md:` |
| Desktop | 1024px | `lg:` |
| Large | 1280px | `xl:` |
| XL | 1536px | `2xl:` |

---

## 🔍 Common Utilities

### Shadow
```css
shadow-sm      /* Subtle */
shadow-md      /* Medium */
shadow-lg      /* Large */
shadow-xl      /* Extra large */
```

### Border
```css
border         /* 1px all sides */
border-2       /* 2px all sides */
border-t-2     /* 2px top only */
border-dashed  /* Dashed style */
```

### Opacity
```css
opacity-50     /* 50% */
opacity-75     /* 75% */
opacity-100    /* 100% */
```

---

## 💡 Pro Tips

1. **Always include dark mode variants**
   - `dark:` prefix for dark mode
   - Test in both modes

2. **Use transitions for smooth effects**
   - `transition-all duration-200`
   - `transition-colors`

3. **Add hover states to interactive elements**
   - `hover:bg-color-700`
   - `hover:shadow-lg`

4. **Use semantic spacing**
   - Consistent gaps (2, 3, 4, 6)
   - Consistent padding (4, 5, 6, 8)

5. **Combine shadows with transforms**
   - `shadow-md hover:shadow-lg`
   - `transform hover:-translate-y-0.5`

6. **Use gradients sparingly**
   - Headers and accents
   - Not for body text

7. **Maintain visual hierarchy**
   - Size indicates importance
   - Color draws attention
   - Spacing creates groups

---

## 🎨 Copy-Paste Snippets

### Enhanced Card
```jsx
<div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border-2 border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-xl transition-all duration-300 hover:border-blue-300 dark:hover:border-blue-700">
  {/* Content */}
</div>
```

### Gradient Button
```jsx
<button className="px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-bold text-lg flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:scale-[1.02]">
  <span>Text</span>
</button>
```

### Stat Grid
```jsx
<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
  {stats.map(stat => (
    <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/10 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
      {/* Stat content */}
    </div>
  ))}
</div>
```

---

**Version:** 1.0  
**Last Updated:** November 2, 2025  
**Framework:** Tailwind CSS 3.x
