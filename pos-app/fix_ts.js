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
      let original = content;

      // Fix useThemeInput typo
      content = content.replace(/useThemeInput/g, 'TextInput, useTheme');
      content = content.replace(/import \{ Text, useTheme, TextInput/g, 'import { Text, useTheme, TextInput');
      content = content.replace(/import \{ Text, useTheme(,\s*|)Text/g, 'import { Text, useTheme');
      
      // Fix duplicate Text imports (e.g. `Text, useTheme, Button, Text`)
      content = content.replace(/Text, (.*?)Text/g, 'Text, $1');

      // Fix `useAppTheme` path for vendor tabs
      if (fullPath.includes('(vendor)') && fullPath.includes('(tabs)')) {
        content = content.replace(/from '\.\.\/\.\.\/providers\/ThemeProvider'/g, "from '../../../providers/ThemeProvider'");
      }

      // Add missing `const appTheme = useTheme();`
      // Check if `appTheme` is used but not defined.
      if (content.includes('appTheme.') && !content.includes('const appTheme = useTheme();')) {
         // Find the first default export function and inject it
         content = content.replace(/export default function ([A-Za-z0-9_]+)\([^)]*\) \{/, (match) => {
             return `${match}\n  const appTheme = useTheme();\n`;
         });
      }

      // Ensure useTheme is imported if appTheme is used
      if (content.includes('const appTheme = useTheme();') && !content.includes('useTheme')) {
         content = content.replace("from 'react-native-paper';", ", useTheme } from 'react-native-paper';");
      }

      if (content !== original) {
        fs.writeFileSync(fullPath, content);
        console.log('Fixed', fullPath);
      }
    }
  }
}

processDir(path.join(__dirname, 'src/app'));
