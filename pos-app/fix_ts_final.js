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

      // Clean up react-native-paper imports
      content = content.replace(/import\s*\{([^}]*)\}\s*from\s*'react-native-paper'/g, (match, imports) => {
          let parts = imports.split(',').map(s => s.trim()).filter(s => s !== '' && s !== 'Input' && s !== 'useThemeInput');
          if (!parts.includes('TextInput')) parts.push('TextInput');
          if (!parts.includes('Text')) parts.push('Text');
          if (!parts.includes('useTheme')) parts.push('useTheme');
          return `import { ${Array.from(new Set(parts)).join(', ')} } from 'react-native-paper'`;
      });

      // Inject appTheme if missing
      if (content.includes('appTheme') && !content.includes('const appTheme = useTheme();')) {
          const exportMatch = content.match(/export default function ([A-Za-z0-9_]+)[^{]*\{/);
          if (exportMatch) {
              content = content.replace(exportMatch[0], `${exportMatch[0]}\n  const appTheme = useTheme();\n`);
          } else {
             // Maybe it's an arrow function
             const arrowMatch = content.match(/const ([A-Za-z0-9_]+) = \([^)]*\) => \{/);
             if (arrowMatch) {
                 content = content.replace(arrowMatch[0], `${arrowMatch[0]}\n  const appTheme = useTheme();\n`);
             }
          }
      }

      // Explore.tsx fix
      if (fullPath.includes('explore.tsx')) {
          content = content.replace('useAppTheme()', 'useTheme()');
      }

      // Fix `any` type on implicit any parameters `text` or `v`
      content = content.replace(/\(text\) =>/g, '(text: string) =>');
      content = content.replace(/\(v\) =>/g, '(v: string) =>');
      content = content.replace(/\(\s*text\s*=>/g, '(text: string) =>');
      content = content.replace(/\(\s*v\s*=>/g, '(v: string) =>');
      
      // Additional TS7006 implicit any for Journal/Ledgers
      content = content.replace(/onChangeText=\{v =>/g, 'onChangeText={(v: string) =>');
      content = content.replace(/onChangeText=\{text =>/g, 'onChangeText={(text: string) =>');


      if (content !== original) {
        fs.writeFileSync(fullPath, content);
        console.log('Fixed', fullPath);
      }
    }
  }
}

processDir(path.join(__dirname, 'src/app'));
