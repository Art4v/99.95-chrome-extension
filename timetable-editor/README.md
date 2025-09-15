# Timetable Editor - 99.95 Extension

The Timetable Editor is a new intermediate screen that allows users to visually edit their ICS timetable before proceeding to the main interface. It provides an intuitive grid-based interface for modifying class schedules.

## Features

### Visual Grid Interface
- **Weekly Schedule**: Shows a single week (Monday-Sunday)
- **Biweekly Schedule**: Shows two weeks (A/B) stacked vertically
- **Triweekly Schedule**: Shows three weeks (A/B/C) stacked vertically

### Class Management
- **Pre-compiled Class List**: Automatically extracts unique class names from uploaded ICS data
- **Add New Classes**: Users can add custom classes to the available list
- **Remove Classes**: Remove classes from the list (prevents removing the last class)

### Interactive Editing
- **Click to Edit**: Click on any grid cell to open the edit modal
- **Class Selection**: Choose from available classes or set to "No Class"
- **Teacher & Room**: Edit teacher names and room numbers for each class
- **Real-time Updates**: Changes are reflected immediately in the grid

### Schedule Type Detection
- Automatically detects if the uploaded timetable is weekly, biweekly, or triweekly
- Users can manually override the detected schedule type
- Visual indicators show week boundaries for multi-week schedules

## User Flow

1. **Upload ICS File** → Landing page processes the file
2. **Edit Timetable** → Timetable editor opens with parsed data
3. **Make Changes** → Click cells to edit classes, teachers, rooms
4. **Confirm Changes** → Save the edited timetable
5. **Main Interface** → Proceed to the main 99.95 interface

## Keyboard Shortcuts

- **Enter**: Confirm timetable (when not editing)
- **Escape**: Close edit modal
- **Ctrl/Cmd + N**: Focus on new class input field

## Technical Details

### File Structure
- `timetable-editor.html` - Main HTML structure
- `timetable-editor.css` - Styling following 99.95 design philosophy
- `timetable-editor.js` - Core functionality and grid management

### Data Flow
1. Parsed ICS data is loaded from Chrome storage
2. Grid is generated based on detected schedule type
3. User edits are stored in cell data attributes
4. On confirmation, updated data is saved back to storage
5. `timetableConfirmed` flag is set to prevent re-editing

### Schedule Type Logic
- **Weekly**: ≤7 days of data
- **Biweekly**: 8-14 days of data  
- **Triweekly**: 15+ days of data

### Grid Layout
- Uses CSS Grid for responsive layout
- Week indicators span multiple columns
- Separators provide visual week boundaries
- Responsive design adapts to different screen sizes

## Integration

The timetable editor integrates seamlessly with the existing 99.95 extension:

- Uses shared utilities (`utils.js`)
- Follows existing design patterns and themes
- Maintains data format compatibility
- Preserves all existing functionality

## Future Enhancements

Potential improvements could include:
- Drag and drop class reordering
- Bulk edit operations
- Import/export of custom class lists
- Schedule templates for common patterns
- Advanced validation and error checking

