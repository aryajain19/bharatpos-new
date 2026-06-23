const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx') && fullPath !== path.join(__dirname, 'src/app/index.tsx') && !fullPath.includes('_layout.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let original = content;

      // Add Theme hooks if not present
      if (!content.includes('useAppTheme')) {
        content = content.replace(
          "import { router", 
          "import { useAppTheme } from '../../providers/ThemeProvider';\nimport { router"
        );
        // Fallback if router not found but react is found
        if (!content.includes('useAppTheme')) {
           content = content.replace(
             "import React", 
             "import { useAppTheme } from '../../providers/ThemeProvider';\nimport React"
           );
        }
      }

      // Ensure useTheme is imported from react-native-paper
      if (!content.includes('useTheme')) {
         content = content.replace(
             "import { Text", 
             "import { Text, useTheme"
         );
      }

      // Inject theme vars into component
      content = content.replace(/export default function ([A-Za-z0-9_]+)\(\) \{/, (match, p1) => {
        if (!content.includes('const { isDarkMode, toggleTheme } = useAppTheme();')) {
          return `${match}\n  const { isDarkMode, toggleTheme } = useAppTheme();\n  const appTheme = useTheme();\n`;
        }
        return match;
      });

      // Strip paper props
      content = content.replace(/ buttonColor="[^"]+"/g, '');
      content = content.replace(/ textColor="[^"]+"/g, '');
      content = content.replace(/ rippleColor="[^"]+"/g, '');

      // Replace common inline hex colors with appTheme vars
      content = content.replace(/color:\s*'#[0-9A-Fa-f]{3,6}'/g, 'color: appTheme.colors.onSurface');
      content = content.replace(/backgroundColor:\s*'#[0-9A-Fa-f]{3,6}'/g, 'backgroundColor: appTheme.colors.surface');
      content = content.replace(/borderColor:\s*'#[0-9A-Fa-f]{3,6}'/g, 'borderColor: appTheme.colors.outline');

      // Strip hex colors from StyleSheet.create
      content = content.replace(/color:\s*'#[0-9A-Fa-f]{3,6}',?\s*/g, '');
      content = content.replace(/backgroundColor:\s*'#[0-9A-Fa-f]{3,6}',?\s*/g, '');
      content = content.replace(/borderColor:\s*'#[0-9A-Fa-f]{3,6}',?\s*/g, '');

      if (content !== original) {
        fs.writeFileSync(fullPath, content);
        console.log('Processed', fullPath);
      }
    }
  }
}

processDir(path.join(__dirname, 'src/app'));
