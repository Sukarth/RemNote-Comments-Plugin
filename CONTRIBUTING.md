# 🤝 Contributing to RemNote Comments Plugin

Thank you for your interest in contributing to the RemNote Comments Plugin! This document provides comprehensive guidelines for contributors to help maintain code quality and streamline the development process.

## 📋 Table of Contents

- [Code of Conduct](#-code-of-conduct)
- [Getting Started](#-getting-started)
- [Development Workflow](#-development-workflow)
- [Coding Standards](#-coding-standards)
- [Testing Guidelines](#-testing-guidelines)
- [Pull Request Process](#-pull-request-process)
- [Issue Guidelines](#-issue-guidelines)
- [Release Process](#-release-process)

## 🌟 Code of Conduct

We are committed to fostering a welcoming and inclusive community. Please read and follow our code of conduct:

### Our Pledge

- **Be Respectful**: Treat everyone with respect and kindness
- **Be Inclusive**: Welcome contributors of all backgrounds and skill levels
- **Be Constructive**: Focus on what is best for the community
- **Be Patient**: Help others learn and grow

### Unacceptable Behavior

- Harassment, discrimination, or personal attacks
- Trolling, insulting comments, or disruptive behavior  
- Publishing private information without consent
- Any conduct that would be inappropriate in a professional setting

## 🚀 Getting Started

### Prerequisites

Before contributing, ensure you have:

- **Node.js**: Version 16.15.1 or later (see `.nvmrc` for exact version)
- **npm**: Version 7+ or yarn alternative
- **Git**: For version control
- **RemNote Account**: For testing the plugin
- **Code Editor**: VS Code recommended with TypeScript support

### Initial Setup

1. **Fork the Repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/remnote-comments-plugin.git
   cd remnote-comments-plugin
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Verify Setup**
   ```bash
   npm run check-types  # Should pass without errors
   npm run dev         # Should start development server
   ```

4. **Connect to RemNote**
   - Open RemNote in your browser
   - Navigate to **Settings** → **Plugins**
   - Click **Build** → **Develop from localhost**
   - Enter `http://localhost:8080`
   - Verify the plugin loads correctly

## 🔄 Development Workflow

### Branch Strategy

We follow a simplified Git flow:

- **`main`**: Production-ready code
- **`feature/feature-name`**: New features
- **`fix/issue-description`**: Bug fixes
- **`docs/documentation-update`**: Documentation changes
- **`refactor/component-name`**: Code improvements

### Workflow Steps

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**
   - Follow coding standards (see below)
   - Write/update tests as needed
   - Update documentation if applicable

3. **Test Thoroughly**
   ```bash
   npm run check-types
   # Manual testing in RemNote
   ```

4. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: add new comment sorting feature"
   ```

5. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

### Commit Message Format (optional)

Follow [Conventional Commits](https://conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix  
- `docs`: Documentation changes
- `style`: Formatting/style changes
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Build/tool changes

**Examples:**
```bash
git commit -m "feat(sidebar): add comment sorting options"
git commit -m "fix(popup): resolve textarea auto-resize issue"
git commit -m "docs: update installation instructions"
```

## 📝 Coding Standards

### TypeScript Guidelines

#### File Structure
```typescript
// 1. Imports (external first, then internal)
import React from 'react';
import { usePlugin } from '@remnote/plugin-sdk';

import { addComment } from '../lib/comments';
import { createBus } from '../utils/bus';

// 2. Types and interfaces
interface CommentData {
  id: string;
  text: string;
  createdAt: string;
}

// 3. Component/function implementation
export function ComponentName() {
  // ...
}
```

#### Naming Conventions
- **Files**: `camelCase` for utilities, `PascalCase` for components
- **Variables/Functions**: `camelCase`
- **Types/Interfaces**: `PascalCase`
- **Constants**: `SCREAMING_SNAKE_CASE`

#### Type Safety
```typescript
// ✅ Good - Explicit types
interface CommentRow {
  id: string;
  parentId?: string;
  text?: string;
  createdAt?: string;
}

// ✅ Good - Proper async/await
async function loadComments(): Promise<CommentRow[]> {
  try {
    const comments = await plugin.powerup.getPowerupByCode('comment');
    return comments || [];
  } catch (error) {
    console.error('Failed to load comments:', error);
    return [];
  }
}

// ❌ Avoid - Using 'any'
function processData(data: any): any {
  return data.something;
}
```

### React Guidelines

#### Component Structure
```typescript
export function ComponentName() {
  // 1. Hooks (useState, useEffect, custom hooks)
  const [state, setState] = useState<Type>(initialValue);
  const plugin = usePlugin();
  
  // 2. Event handlers and utility functions
  const handleClick = useCallback(async () => {
    // Implementation
  }, [dependencies]);
  
  // 3. Effects
  useEffect(() => {
    // Side effects
    return () => {
      // Cleanup
    };
  }, [dependencies]);
  
  // 4. Render
  return (
    <div className="component-wrapper">
      {/* JSX */}
    </div>
  );
}
```

#### Performance Best Practices
```typescript
// ✅ Good - Memoized callbacks
const handleUpdate = useCallback(async (id: string) => {
  await updateComment(id);
}, [updateComment]);

// ✅ Good - Proper dependency arrays
useEffect(() => {
  loadComments();
}, [loadComments]);

// ✅ Good - Cleanup effects
useEffect(() => {
  const bus = createBus();
  bus.on('comments:updated', handleUpdate);
  
  return () => {
    bus.off('comments:updated', handleUpdate);
    bus.close();
  };
}, [handleUpdate]);
```

### CSS Guidelines

#### CSS Custom Properties
```css
:root {
  /* Use semantic naming */
  --cmt-primary-color: rgba(120, 180, 255, 0.15);
  --cmt-border-radius: 0.5rem;
  --cmt-animation-duration: 0.2s;
}

/* Support dark mode */
@media (prefers-color-scheme: dark) {
  :root {
    --cmt-primary-color: rgba(120, 180, 255, 0.25);
  }
}
```

#### Class Naming
```css
/* Use BEM-like conventions with cmt- prefix */
.cmt-card { }
.cmt-card__header { }
.cmt-card--highlighted { }
.cmt-btn--primary { }
```

## 🧪 Testing Guidelines

### Manual Testing Checklist

Before submitting a PR, verify:

#### Core Functionality
- [ ] Comment creation works from any focused Rem
- [ ] Comments appear in sidebar immediately
- [ ] Comment text updates reflect in sidebar within 2 seconds
- [ ] Navigation to parent Rem works correctly
- [ ] Comment deletion removes Rem completely

#### User Interface
- [ ] All buttons respond to clicks
- [ ] Hover effects work smoothly
- [ ] Animations don't cause performance issues
- [ ] Dark mode styling looks correct
- [ ] Mobile/responsive behavior is acceptable

#### Edge Cases
- [ ] Empty comments are handled gracefully
- [ ] Very long comments are truncated properly
- [ ] Plugin works with many comments (100+)
- [ ] Multiple widget instances coordinate correctly
- [ ] Browser refresh doesn't break functionality

#### Performance
- [ ] No console errors during normal operation
- [ ] Memory usage remains stable during extended use
- [ ] UI remains responsive with real-time updates

### Testing in Different Environments

Test your changes in:
- **Chrome/Chromium** (primary)
- **Firefox** (secondary)  
- **Safari** (if available)
- **RemNote Desktop App**
- **Different screen sizes**

## 📤 Pull Request Process

### Before Submitting

1. **Self-Review**
   - Read through your changes carefully
   - Check for console errors or warnings
   - Verify all new features work as expected
   - Ensure backwards compatibility

2. **Code Quality**
   ```bash
   npm run check-types  # Must pass
   ```

3. **Documentation**
   - Update README.md if adding new features
   - Add inline comments for complex logic
   - Update CHANGELOG.md following the existing format

### PR Template

When creating a PR, use this template:

```markdown
### Summary 🎯
Brief description of what this PR accomplishes

### Changes 🔁
- Detailed list of changes
- Include technical details where relevant
- Mention any breaking changes

### Testing ✅
- [ ] Manual testing completed
- [ ] All existing functionality verified
- [ ] New features tested in multiple scenarios
- [ ] Performance impact assessed

### Screenshots/GIFs 📸
Include visuals for UI changes

### Breaking Changes ⚠️
List any breaking changes and migration steps

### Additional Notes 📝
Any other relevant information
```

### Review Process

1. **Automated Checks**: Must pass TypeScript compilation
2. **Maintainer Review**: Code quality and architecture review
3. **Manual Testing**: Functionality verification
4. **Documentation Review**: Ensure docs are up to date

### Addressing Feedback

- Respond to all review comments
- Make requested changes in additional commits
- Don't force-push after review has started
- Ask questions if feedback is unclear

## 🐛 Issue Guidelines

### Reporting Bugs

Use the bug report template and include:

1. **Clear Description**: What went wrong?
2. **Reproduction Steps**: Detailed steps to reproduce
3. **Expected Behavior**: What should have happened?
4. **Environment**: Browser, OS, RemNote version
5. **Screenshots**: Visual evidence if applicable
6. **Console Logs**: Any error messages

### Feature Requests

Use the feature request template and include:

1. **Problem Description**: What problem does this solve?
2. **Proposed Solution**: How should it work?
3. **Alternatives Considered**: Other possible approaches
4. **Use Cases**: Specific examples of usage
5. **Mockups**: Visual designs if applicable

### Issue Labels

We use these labels to organize issues:

- **`bug`**: Something isn't working
- **`enhancement`**: New feature request
- **`documentation`**: Improvements to docs
- **`good first issue`**: Good for newcomers
- **`help wanted`**: Extra attention needed
- **`question`**: Further information requested

## 🚢 Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):

- **Major** (1.0.0): Breaking changes
- **Minor** (0.1.0): New features, backwards compatible  
- **Patch** (0.0.1): Bug fixes, backwards compatible

### Release Checklist

1. **Update Version**
   ```json
   // package.json
   {
     "version": "1.1.0"
   }
   ```

   ```json
   // public/manifest.json  
   {
     "version": {
       "major": 1,
       "minor": 1,
       "patch": 0
     }
   }
   ```

2. **Update CHANGELOG.md**
   ```markdown
   ## [1.1.0] - YYYY-MM-DD
   
   ### Added
   - New comment sorting feature
   
   ### Fixed
   - Sidebar refresh issue
   ```

3. **Create Release**
   - Tag the release: `git tag v1.1.0`
   - Build the package: `npm run build`
   - Create GitHub release with changelog
   - Upload the generated zip file

## 💡 Getting Help

### Resources

- **RemNote Plugin SDK**: [Documentation](https://github.com/remnote/remnote-plugin-sdk)
- **React Documentation**: [reactjs.org](https://reactjs.org/)
- **TypeScript Handbook**: [typescriptlang.org](https://www.typescriptlang.org/)

### Community Support

- **GitHub Discussions**: Ask questions and share ideas
- **Issues**: Report bugs and request features
- **Pull Requests**: Contribute code improvements

### Contact

For urgent issues or questions:
- Create a GitHub issue with the `question` label
- Tag @Sukarth in discussions for direct attention

---

Thank you for contributing to the RemNote Comments Plugin! Every contribution, no matter how small, helps make this tool better for everyone in the RemNote community. 🎉