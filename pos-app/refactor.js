const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      let originalContent = content;

      // Ensure useTheme is imported and defined if we are injecting theme.colors
      const hasUseThemeImport = content.includes('useTheme');
      if (!hasUseThemeImport) {
        content = content.replace("import { ", "import { useTheme, ");
      }
      
      const componentMatch = content.match(/export default function ([A-Za-z0-9_]+)\s*\(/);
      if (componentMatch && !content.includes('const theme = useTheme()')) {
        content = content.replace(componentMatch[0], componentMatch[0] + ' {\n  const theme = useTheme();\n');
      }

      // 1. Remove Paper component hardcoded colors
      content = content.replace(/ buttonColor="[^"]+"/g, '');
      content = content.replace(/ textColor="[^"]+"/g, '');
      content = content.replace(/ iconColor="[^"]+"/g, '');
      content = content.replace(/ rippleColor="[^"]+"/g, '');

      // 2. Replace hardcoded inline color props
      content = content.replace(/color="[^"]+"/g, 'color={theme.colors.onSurface}');

      // 3. Replace StyleSheet colors roughly (for exact matches)
      content = content.replace(/backgroundColor:\s*'#[0-9A-Fa-f]{3,6}'/g, 'backgroundColor: theme.colors.surface');
      content = content.replace(/color:\s*'#[0-9A-Fa-f]{3,6}'/g, 'color: theme.colors.onSurface');
      content = content.replace(/borderColor:\s*'#[0-9A-Fa-f]{3,6}'/g, 'borderColor: theme.colors.outline');

      // We'll write the content back.
      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content);
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDir(path.join(__dirname, 'src/app'));
