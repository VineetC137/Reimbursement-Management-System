# UI and UX Guidelines

## 1. Design Goal
The UI should feel like a clean internal product that a real company could use. It should be modern and animated enough to feel alive, but not flashy. The visual language should look intentional and consistent, not like a dashboard template dropped into the project.

## 2. Color Direction
Use a controlled palette built around white and sky blue, with red used only where attention is needed.

### Primary Palette
- page background: `#F7FBFF`
- surface white: `#FFFFFF`
- primary sky blue: `#56B6F7`
- deeper blue for text accents and focused states: `#1787D4`
- soft border blue: `#CFEAFB`
- dark text: `#15324A`
- muted text: `#5E768A`

### Accent Palette
- action red: `#E45757`
- soft red background: `#FDE8E8`
- success green: `#1F9D6A`
- warning amber: `#D99A2B`

Red should not dominate the interface. It should be used for:

- rejection actions
- destructive confirmations
- validation states
- high-importance badges

## 3. Typography
Avoid default-looking UI typography.

Recommended pairing:

- headings: `Manrope`
- body: `DM Sans`

Fallback if needed:

- `Segoe UI`, `sans-serif`

The aim is to keep the interface clean and readable without making it look like a cloned template.

## 4. Layout Structure

### Desktop
- left sidebar for main navigation
- top bar for company name, logged-in user, notifications, and logout
- content area with maximum readable width and generous spacing

### Tablet
- collapsible sidebar
- sticky top bar
- cards and tables should reflow without horizontal crowding

### Mobile
- bottom or drawer-based navigation only if necessary
- tables should switch to stacked card format for approvals and expense history
- form fields should be full-width and grouped clearly

## 5. Navigation Rules
Main navigation should stay stable across roles. Only the available items change.

### Employee Navigation
- Dashboard
- My Expenses
- New Expense
- Notifications
- Profile

### Manager Navigation
- Dashboard
- Approvals
- Team Expenses
- Notifications
- Profile

### Admin Navigation
- Dashboard
- Users
- Approval Rules
- All Expenses
- Audit Logs
- Notifications
- Profile

Spacing matters:

- use enough padding around navigation groups
- never crowd icon, label, and badge together
- keep active item easy to spot with blue background tint and stronger text color

## 6. Core Screen Direction

### Signup and Login
- centered, clean card layout
- country selector clearly visible during signup
- validation messages directly under fields
- background can include a very soft blue gradient or pattern, but keep it subtle

### Dashboard
- avoid generic KPI overload
- show only useful summary cards:
  - pending approvals
  - submitted this month
  - approved this month
  - rejected this month
- use compact charts only if they add meaning

### Expense List
- mix of filters and table/cards
- status pill should be obvious
- primary action button for new expense should stay visible

### Approval Queue
- make it easy to scan who submitted the request, category, original amount, converted amount, and current step
- approve and reject actions should be visible but not oversized
- comment preview or last activity should be available in row or detail drawer

### Approval Rule Screen
- use progressive disclosure
- keep base rule details at top
- steps and conditions below
- if hybrid mode is selected, show explanation text for how the rule will behave

## 7. Component Guidelines

### Cards
- rounded corners between `14px` and `18px`
- soft border with subtle shadow
- avoid dark heavy shadows

### Tables
- use generous row height
- align numeric values to the right
- freeze header if table gets long
- use row hover state with very light blue tint

### Buttons
- primary actions: sky blue filled
- secondary actions: white with blue border
- reject or destructive actions: red filled or outlined depending on emphasis

### Inputs
- consistent height and padding
- clear focus ring in blue
- error ring and helper text in red
- disabled fields should still remain readable

### Status Pills
Recommended mapping:

- draft: neutral blue-gray
- submitted: sky blue
- in review: amber
- approved: green
- rejected: red

## 8. Animation Guidance
Animation should support clarity, not show off.

Recommended uses:

- sidebar expand and collapse
- card fade and slight rise on load
- button hover micro-motion
- status pill transition when expense state changes
- modal open and close

Avoid:

- bouncing elements
- overly dramatic page transitions
- multiple competing animated areas on the same screen

Recommended timing:

- `160ms` to `240ms` for hover and focus transitions
- `240ms` to `320ms` for card and modal entrances

## 9. Empty, Loading, and Error States
These screens matter because judges notice them.

### Empty States
- keep text simple and useful
- example: `No expenses submitted yet. Create your first claim to start the approval process.`

### Loading States
- prefer skeletons over spinners for tables and cards
- use subtle shimmer only

### Error States
- keep the message specific
- explain whether the user can retry
- use red carefully without turning the whole screen into an alert panel

## 10. Not-AI-Generic Rules
The UI must not feel like a random prompt-generated admin dashboard.

Do not do the following:

- do not use a dark neon dashboard style
- do not use purple-heavy default gradients
- do not fill the page with giant analytics cards that do not help the workflow
- do not rely on emoji-heavy actions or badges
- do not use random icon clutter
- do not use mixed spacing systems across screens
- do not use a component library theme without customizing it to the project

## 11. Practical Usability Rules
- every primary workflow should be reachable within two clicks from the sidebar
- important values like converted company amount should be visible without opening a modal
- comments and approval history should be easy to find
- forms should be broken into digestible groups, not one long wall of inputs
- the UI should work well on laptop screens because that is where most demos happen

## 12. Final Design Principle
This product should look calm, credible, and well-structured. White and sky blue should make it feel clean and open. Red should add urgency only where necessary. If a design choice feels trendy but does not improve clarity, skip it.
