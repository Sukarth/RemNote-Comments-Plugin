# 💬 RemNote Comments Plugin

<div align="center">

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/Sukarth/remnote-comments-plugin)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![RemNote Plugin](https://img.shields.io/badge/RemNote-Plugin-orange.svg)](https://www.remnote.com/)

**A powerful commenting system for RemNote that transforms your knowledge management workflow**

</div>

## ✨ Overview

The RemNote Comments Plugin adds a simple commenting system to your RemNote workspace. You can add comments to any Rem, view all comments in one sidebar, and easily jump between comments and the Rems they belong to.

### 🎯 Key Benefits

- **Enhanced Collaboration**: Add contextual comments to any Rem for better knowledge sharing
- **Centralized Review**: View all comments across your knowledge base in one organized sidebar
- **Seamless Navigation**: Click any comment to instantly jump to its source Rem
- **Real-time Sync**: Comments update automatically across all instances
- **Beautiful UI**: Modern, responsive interface with smooth animations and dark mode support
## 🚀 Features

### 🏷️ Smart Comment System
- **Comment-as-Rem Setup**: Each comment is a special Rem with a custom "Comment" tag.
- **Reliable Storage**: Comment info is saved as Rem details for safety.
- **Auto-Update**: Changes to comments sync instantly across all parts of the app.

### 🎨 User Interface
- **Popup Editor**: Add comments quickly with a text box that grows as you type.
- **Sidebar View**: See all comments in a side panel with ways to sort them.
- **Modern UI**: Clean, modern design with pleasant animations.
- **Interactive Cards**: Cards with hover effects and smooth movements.
- **Flexible Design**: Works well on different screens and with light or dark themes.

### ⚡ Performance
- **Fast Display**: Uses smart caching and delayed updates to load quickly.
- **Low Memory Use**: Handles events carefully to save resources.
- **Background Tasks**: Comment actions run without slowing down the app.

### 🛠️ Advanced Features
- **Sorting Choices**: Order comments by newest, oldest, or Rem name.
- **Smart Filtering**: Only checks changes to relevant Rems.
- **Group Actions**: Handles updates to many comments at once efficiently.
- **Error Handling**: Deals with problems and odd situations smoothly.

## 📥 Installation

### Option 1: From RemNote Plugin Store (Recommended)
1. Open RemNote
2. Go to **Settings** → **Plugins**
3. Search for "Comments Plugin"
4. Click **Install**

### Option 2: Manual Installation
1. Download the latest release from the [Releases Page](https://github.com/Sukarth/remnote-comments-plugin/releases)
2. In RemNote, go to **Settings** → **Plugins**
3. Click **Upload Plugin**
4. Select the downloaded `.zip` file

### Option 3: Development Installation
1. Clone this repository
2. Follow the [Development Setup](#-development-setup) instructions below

## 📖 Usage


### Keyboard Shortcuts

The following shortcuts are available by default:

- **Ctrl+Shift+G**: Add Comment to Focused Rem
- **Ctrl+Shift+H**: Open Comments pane/sidebar

You can also customize these shortcuts in RemNote settings if desired.

### Adding Comments

#### Method 1: Using the Command Palette
1. Focus on any Rem
2. Open Command Palette (`Ctrl/Cmd + K`)
3. Type "Add Comment to Focused Rem"
4. Enter your comment and press `Enter`

#### Method 2: Using Keyboard Shortcut
1. Focus on any Rem
2. Press **Ctrl+Shift+G** to add a comment instantly

### Managing Comments

#### Viewing All Comments
- Click the 'AI' icon at the top right corner of RemNote to open the left sidebar
- Click the 💬 icon in the left sidebar to open the Comments widget
- Comments are displayed with:
  - Comment text (truncated if long)
  - Creation/modification timestamp
  - Parent Rem name
  - Action buttons (Open, Delete)

#### Sorting Comments
Choose from three sorting options:
- **Newest**: Most recently created/modified comments first
- **Oldest**: Oldest comments first  
- **Parent Name**: Alphabetical by parent Rem name

#### Navigating to Comments
- Click **Open** on any comment to jump to its parent Rem
- The target Rem will be opened and focused automatically

#### Deleting Comments
- Click **Delete** on any comment to remove it permanently
- The comment Rem (**and its children**) will be completely removed from your knowledge base

### Advanced Usage

#### Real-time Editing
- Edit comment text directly in the original Rem
- Changes automatically sync to the sidebar within 2 seconds after you stop typing
- Timestamps update to reflect the latest modification

#### Keyboard Shortcuts in popup editor
- `Enter`: Submit comment (in popup editor)
- `Shift + Enter`: New line (in popup editor)
- `Escape`: Cancel/close popup editor

## 🛠️ Development Setup

### Prerequisites
- Node.js 16.15.1 or later (see `.nvmrc`)
- npm 7+ or yarn
- RemNote account for testing

### Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/Sukarth/remnote-comments-plugin.git
   cd remnote-comments-plugin
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Connect to RemNote**
   - Open RemNote
   - Go to **Settings** → **Plugins**
   - Click **Build** → **Develop from localhost**
   - Enter `http://localhost:8080`

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build production package and create zip file
- `npm run check-types` - Run TypeScript type checking

### Project Structure

```
src/
├── widgets/                 # Widget components
│   ├── index.tsx           # Main plugin entry point
│   ├── add_comment_popup.tsx # Comment creation popup
│   └── comments_sidebar_right.tsx # Comments sidebar widget
├── lib/
│   └── comments.ts         # Core comment functionality
├── utils/
│   └── bus.ts             # Event bus for real-time updates
├── style.css              # Global styles
└── index.css             # Widget-specific styles
public/                    # Static assets
└── manifest.json          # Plugin metadata
```

## 🏗️ Architecture

### Core Components

#### Comment System (`src/lib/comments.ts`)
- **`ensureCommentPowerup()`**: Registers the Comment powerup with hidden slots
- **`addComment()`**: Creates new comment Rems with proper tagging and properties
- **`listAllComments()`**: Retrieves and reconciles all comments across the knowledge base

#### Event Bus (`src/utils/bus.ts`)
- Cross-widget communication using BroadcastChannel API
- Fallback to localStorage events for older browsers
- Handles real-time comment updates and widget coordination

#### Main Plugin (`src/widgets/index.tsx`)
- Plugin registration and lifecycle management
- Command and sidebar button registration
- Widget opening coordination with deduplication

### Data Flow

1. **Comment Creation**:
   ```
   User Input → addComment() → Create Rem → Set Properties → Emit Event → Update UI
   ```

2. **Comment Display**:
   ```
   Load Comments → Cache IDs → Listen for Changes → Debounce Updates → Re-render
   ```

3. **Real-time Updates**:
   ```
   Rem Change Event → Check Cache → Debounce → Update Properties → Refresh UI
   ```

## 🎨 Customization

### Styling
The plugin uses CSS custom properties for theming:

```css
:root {
  --cmt-border: rgba(120,120,120,.35);
  --cmt-bg: rgba(255,255,255,0.04);
  --cmt-primary-bg: rgba(120,180,255,.15);
  /* ... more variables */
}
```

### Extending Functionality
The plugin architecture supports easy extension:

- Add new widget types in `src/widgets/`
- Extend comment properties in `ensureCommentPowerup()`
- Add new event types in the bus system
- Customize UI components with additional CSS classes

## 🧪 Testing

### Manual Testing Checklist

- [ ] Comment creation works from focused Rem
- [ ] Comments appear in sidebar immediately
- [ ] Sorting options work correctly
- [ ] Navigation to parent Rem functions
- [ ] Comment deletion removes Rem completely
- [ ] Real-time editing syncs properly
- [ ] Multiple widget instances coordinate correctly
- [ ] Performance remains smooth with many comments

## 🔧 Troubleshooting

### Common Issues

**Comments not appearing in sidebar**
- Try clicking the Refresh button in the sidebar
- Check if the Comment powerup was registered correctly
- Verify RemNote permissions are granted
- Try refreshing the RemNote page

**Performance issues with many comments**
- The plugin is optimized for many comments
- Clear browser cache if experiencing slowdowns
- Check for conflicting plugins
- Try refreshing the RemNote page

**Real-time sync not working**
- Check browser console for errors
- Try refreshing the RemNote page

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

### Quick Start for Contributors
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with the [RemNote Plugin SDK](https://github.com/remnote/remnote-plugin-sdk)
- Huge thanks to the RemNote team and developers for developing such an amazing tool!

## 📞 Support

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/Sukarth/remnote-comments-plugin/issues)
- 💡 **Feature Requests**: [GitHub Issues](https://github.com/Sukarth/remnote-comments-plugin/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/Sukarth/remnote-comments-plugin/discussions)

---

<div align="center">

**Made with ❤️ by [Sukarth](https://github.com/Sukarth)**

</div>
