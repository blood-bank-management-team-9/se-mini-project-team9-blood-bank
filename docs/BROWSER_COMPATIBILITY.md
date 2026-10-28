# Browser Compatibility Verification Checklist (NFR-QUAL-05, STP TC-36)

**Project:** Blood Bank Management System (BBMS) - Team 9  
**Reference:** SAD 3.6 (Technology Stack & Client Design), SAD 4.5 (UX Design), STP TC-36  

---

## 1. Supported Browser Matrix (Latest 2 Versions)

| Browser | Supported Platforms | Verified Engine | Responsive Viewport | Status |
|---|---|---|---|---|
| **Google Chrome (v128+)** | Windows, macOS, Linux, Android | Blink / V8 | 360px, 768px, 1200px, 1920px | Verified |
| **Mozilla Firefox (v130+)** | Windows, macOS, Linux, Android | Gecko / SpiderMonkey | 360px, 768px, 1200px, 1920px | Verified |
| **Microsoft Edge (v128+)** | Windows, macOS | Blink / V8 | 360px, 768px, 1200px, 1920px | Verified |
| **Apple Safari (v17+)** | macOS, iOS / iPadOS | WebKit | 375px (iPhone), 768px (iPad), Desktop | Verified |

---

## 2. Responsive Design & CSS Standards
- **Minimum Supported Width:** 360px (mobile portrait, Samsung Galaxy / modern Android / iPhone SE).
- **Standards Used:** Standard CSS Grid, Flexbox, CSS Custom Properties (`--primary`, `--background`, `--card`, etc.).
- **No Vendor Prefixes / Proprietary Extensions:** No `-webkit-box` hacks or non-standard DOM properties.
- **Form Controls:** Native HTML5 validation with standard accessible input attributes (`required`, `type="date"`, `type="email"`).

---

## 3. Automated & Manual Verification
1. **Automated Unit Tests (`frontend/src/__tests__/browserCompatibility.test.jsx`)**:
   - Asserts rendering of semantic HTML5 landmark tags (`<nav>`, `<main>`, `<header>`).
   - Asserts responsive layout mounts cleanly at 360px width.
2. **Manual Cross-Browser Functional Checks**:
   - Navigation bar collapses/wraps cleanly without horizontal overflow at 360px.
   - Modals and forms fit within viewport boundaries.
   - Date picker inputs render cleanly across Chromium, Gecko, and WebKit.
   - SVG icons and badge colors maintain correct contrast ratios (WCAG AA).
