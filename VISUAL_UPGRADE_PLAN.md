# Visual Upgrade Plan: Chess.com-Inspired Design

## Chess.com UI Analysis

Based on the screenshot, here are the key design elements:

### 1. Color Palette
| Element | Chess.com | Current App |
|---------|-----------|-------------|
| Background | Dark charcoal `#262421` | Light gray `bg-gray-50` |
| Sidebar | Near-black `#1D1C1A` | None |
| Cards | Dark `#302E2B` | White `bg-white` |
| Primary Accent | Green `#81B64C` | Mixed (blue, green, etc.) |
| Text Primary | White `#FFFFFF` | Dark gray |
| Text Secondary | Gray `#9E9E9E` | Gray-500 |
| Danger/Error | Red `#E5484D` | Red-500 |
| Warning | Orange `#F5A623` | Amber-500 |

### 2. Navigation Structure
**Chess.com has:**
- **Persistent left sidebar** (170px wide) with:
  - Logo at top
  - Icon + label nav items (Play, Puzzles, Learn, Train, Watch, Community)
  - Search at bottom
  - User profile at bottom

**Current app has:**
- No persistent navigation
- "Back to Dashboard" links scattered
- Quick Actions grid on home page

### 3. Layout Patterns
**Chess.com:**
- Three-column layout: Sidebar | Main Content | Right Panel
- Stats displayed as horizontal cards with icons
- Mini chess boards as clickable thumbnails
- Sections with clear headers

**Current app:**
- Single column with max-width container
- Cards in grids
- No consistent layout structure

### 4. Component Styles
**Chess.com:**
- Rounded corners (8-12px radius)
- Subtle borders/elevation
- Hover states with brightness/scale
- Green accent for primary actions
- Dark mode throughout

**Current app:**
- Uses Tailwind defaults
- Light theme only
- Basic shadows

---

## Implementation Plan

### Phase 1: Design System Foundation

#### 1.1 Create Theme Configuration
**File: `web/src/styles/theme.ts`**
```typescript
export const theme = {
  colors: {
    bg: {
      primary: '#262421',    // Main background
      secondary: '#1D1C1A',  // Sidebar
      card: '#302E2B',       // Card background
      cardHover: '#3D3A36',  // Card hover
    },
    accent: {
      primary: '#81B64C',    // Chess.com green
      primaryHover: '#9BC962',
      secondary: '#F5A623',  // Orange/warning
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#9E9E9E',
      muted: '#6B6B6B',
    },
    // Move classification colors
    classification: {
      good: '#81B64C',       // Green
      inaccuracy: '#F5A623', // Orange
      mistake: '#E5944D',    // Dark orange
      blunder: '#E5484D',    // Red
    },
    // Board colors
    board: {
      light: '#EEEED2',
      dark: '#769656',
    }
  },
  spacing: {
    sidebar: '200px',
    rightPanel: '280px',
  },
  radius: {
    sm: '6px',
    md: '10px',
    lg: '14px',
  }
}
```

#### 1.2 Update Global Styles
**File: `web/src/app/globals.css`**
- Add CSS variables from theme
- Dark mode as default
- Custom scrollbar styling
- Typography scale

### Phase 2: Layout Components

#### 2.1 Create Sidebar Component
**File: `web/src/components/layout/Sidebar.tsx`**

Structure:
```
┌─────────────────────┐
│  ♟ Chess Insights   │  <- Logo
├─────────────────────┤
│ 📊 Dashboard        │
│ 🎯 Missed Tactics   │
│ 🔄 Recurring        │
│ 🎓 Drill Mode       │
│ 📈 Insights         │
│ 🔍 Positions        │
├─────────────────────┤
│ ANALYSIS            │  <- Section header
│ ♟ By Piece          │
│ 📖 By Opening       │
│ 📋 All Mistakes     │
├─────────────────────┤
│ 🔎 Search Games     │
│ 👤 negrilmannings   │  <- User profile
└─────────────────────┘
```

Nav items with icons using chess pieces/emoji or custom icons.

#### 2.2 Create Main Layout Wrapper
**File: `web/src/components/layout/AppLayout.tsx`**

```tsx
<div className="flex min-h-screen bg-bg-primary">
  <Sidebar />
  <main className="flex-1 ml-[200px]">
    {children}
  </main>
  {rightPanel && <RightPanel />}
</div>
```

#### 2.3 Create Right Panel Component (optional)
**File: `web/src/components/layout/RightPanel.tsx`**

For showing:
- User stats summary
- Recent activity
- Quick actions

### Phase 3: Core UI Components

#### 3.1 StatCard Component
**File: `web/src/components/ui/StatCard.tsx`**

Chess.com style stat display:
```
┌─────────────────────────┐
│ 🔥 237 Days             │
│    Streak               │
└─────────────────────────┘
```

#### 3.2 ActionCard Component
**File: `web/src/components/ui/ActionCard.tsx`**

Cards with mini chess board preview:
```
┌─────────────────────────┐
│  ┌───────────────────┐  │
│  │   [Chess Board]   │  │
│  │     Preview       │  │
│  └───────────────────┘  │
│  Missed Fork            │
│  -245cp eval loss       │
└─────────────────────────┘
```

#### 3.3 Update ChessBoard Component
- Ensure consistent sizing
- Add subtle shadow/glow effect
- Support thumbnail mode (smaller, no coordinates)

#### 3.4 SectionHeader Component
Clean section dividers with optional "View All" link.

### Phase 4: Page Redesigns

#### 4.1 Dashboard (`page.tsx`)
New layout:
```
┌──────────────────────────────────────────────────┐
│  Welcome back, negrilmannings                    │
│  Your chess analysis at a glance                 │
├──────────────────────────────────────────────────┤
│ [Games]  [Accuracy]  [Mistakes]  [Blunders]      │  <- Stat cards
├────────────────────────────┬─────────────────────┤
│                            │                     │
│  Quick Actions             │  Recent Games       │
│  ┌────┐ ┌────┐ ┌────┐     │  - Game 1           │
│  │Play│ │Dril│ │Tact│     │  - Game 2           │
│  └────┘ └────┘ └────┘     │  - Game 3           │
│                            │                     │
├────────────────────────────┴─────────────────────┤
│  Mistakes by Phase        │  Mistakes by Time    │
│  [Chart]                  │  [Chart]             │
└──────────────────────────────────────────────────┘
```

#### 4.2 Tactics Page
- Summary cards as horizontal strip
- Grid of tactic cards with board previews
- Filter tabs by tactic type

#### 4.3 Game Analysis Page
- Board prominently displayed
- Move list with evaluation bars
- Collapsible analysis panels

### Phase 5: Micro-interactions & Polish

#### 5.1 Animations
- Card hover: subtle scale (1.02) + brightness
- Page transitions: fade in
- Loading states: skeleton screens
- Move highlighting on boards

#### 5.2 Icons
Create or source consistent icons:
- Chess pieces for navigation
- Classification icons (checkmark, warning, X)
- Tactic type icons

#### 5.3 Responsive Design
- Sidebar collapses to icons on medium screens
- Sidebar becomes bottom nav on mobile
- Cards stack vertically on small screens

---

## File Changes Summary

### New Files to Create:
```
web/src/
├── styles/
│   └── theme.ts              # Design tokens
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx       # Main navigation
│   │   ├── AppLayout.tsx     # Layout wrapper
│   │   └── RightPanel.tsx    # Optional right sidebar
│   └── ui/
│       ├── StatCard.tsx      # Stats display
│       ├── ActionCard.tsx    # Action buttons with preview
│       ├── SectionHeader.tsx # Section dividers
│       └── LoadingSkeleton.tsx
```

### Files to Modify:
```
web/src/app/
├── globals.css               # Dark theme variables
├── layout.tsx                # Wrap with AppLayout
├── page.tsx                  # Dashboard redesign
├── tactics/page.tsx          # Apply new components
├── insights/page.tsx         # Apply new components
├── drill/page.tsx            # Apply new components
└── games/[id]/page.tsx       # Game analysis redesign
```

---

## Implementation Order

1. **Theme & globals.css** (1 hour)
   - Set up CSS variables for dark theme
   - Update Tailwind config if needed

2. **Layout components** (2 hours)
   - Sidebar with navigation
   - AppLayout wrapper
   - Apply to root layout

3. **UI components** (2 hours)
   - StatCard, ActionCard, SectionHeader
   - Update ChessBoard for thumbnails

4. **Dashboard redesign** (2 hours)
   - Apply new layout
   - Use new components

5. **Other pages** (3 hours)
   - Tactics, Insights, Drill, Game Analysis
   - Consistent application of theme

6. **Polish & responsive** (2 hours)
   - Animations
   - Mobile layout
   - Testing

**Total estimated time: ~12 hours**

---

## Visual Reference

Chess.com key elements to replicate:
- ✅ Dark theme with green accents
- ✅ Left sidebar navigation with icons
- ✅ Horizontal stat cards at top
- ✅ Mini board previews on action cards
- ✅ Clean section headers
- ✅ Subtle hover effects
- ✅ Consistent spacing and typography
