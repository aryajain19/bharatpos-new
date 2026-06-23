const fs = require('fs');
const path = require('path');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Add Theme hooks if not present
  if (!content.includes('useAppTheme')) {
    content = content.replace(
      "import { router", 
      "import { useAppTheme } from '../providers/ThemeProvider';\nimport { router"
    );
  }

  // Inject theme vars into component
  content = content.replace(/export default function ([A-Za-z0-9_]+)\(\) \{/, (match, p1) => {
    return `${match}\n  const { isDarkMode, toggleTheme } = useAppTheme();\n  const appTheme = useTheme();\n`;
  });

  // Strip paper props
  content = content.replace(/ buttonColor="[^"]+"/g, '');
  content = content.replace(/ textColor="[^"]+"/g, '');
  content = content.replace(/ rippleColor="[^"]+"/g, '');

  // Strip hex colors from inline styles
  content = content.replace(/color:\s*'#[0-9A-Fa-f]{3,6}'/g, 'color: appTheme.colors.onSurface');
  content = content.replace(/backgroundColor:\s*'#[0-9A-Fa-f]{3,6}'/g, 'backgroundColor: appTheme.colors.surface');
  content = content.replace(/borderColor:\s*'#[0-9A-Fa-f]{3,6}'/g, 'borderColor: appTheme.colors.outline');

  // Strip hex colors from StyleSheet.create
  // This is a bit tricky, let's just do a global replace for common colors if we want, but it's safer to just let the above inline replacements handle everything IF we move styles inline.
  // Actually, replacing inside StyleSheet.create with `appTheme.colors...` will throw ReferenceError!
  // So we must REPLACE hex colors in StyleSheet with nothing!
  content = content.replace(/color:\s*'#[0-9A-Fa-f]{3,6}',?\s*/g, '');
  content = content.replace(/backgroundColor:\s*'#[0-9A-Fa-f]{3,6}',?\s*/g, '');
  content = content.replace(/borderColor:\s*'#[0-9A-Fa-f]{3,6}',?\s*/g, '');

  fs.writeFileSync(filePath, content);
  console.log('Processed', filePath);
}

processFile('src/app/index.tsx');
