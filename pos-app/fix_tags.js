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

      let lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('</>') && lines[i].includes('<Text')) {
          // If it has <Text and </>, and doesn't have <>
          if (!lines[i].includes('<>')) {
             lines[i] = lines[i].replace(/<\/>/g, '</Text>');
          }
        }
      }
      content = lines.join('\n');

      if (content !== original) {
        fs.writeFileSync(fullPath, content);
        console.log('Fixed tags in', fullPath);
      }
    }
  }
}

processDir(path.join(__dirname, 'src/app'));
