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

      // We need to find the StyleSheet.create block and remove appTheme references from it.
      // Usually StyleSheet.create is at the end of the file.
      const styleIndex = content.lastIndexOf('StyleSheet.create({');
      if (styleIndex !== -1) {
        let beforeStyle = content.substring(0, styleIndex);
        let styleBlock = content.substring(styleIndex);

        styleBlock = styleBlock.replace(/color:\s*appTheme\.colors\.[a-zA-Z]+,?\s*/g, '');
        styleBlock = styleBlock.replace(/backgroundColor:\s*appTheme\.colors\.[a-zA-Z]+,?\s*/g, '');
        styleBlock = styleBlock.replace(/borderColor:\s*appTheme\.colors\.[a-zA-Z]+,?\s*/g, '');
        styleBlock = styleBlock.replace(/shadowColor:\s*appTheme\.colors\.[a-zA-Z]+,?\s*/g, '');

        content = beforeStyle + styleBlock;
      }

      if (content !== original) {
        fs.writeFileSync(fullPath, content);
        console.log('Fixed styles in', fullPath);
      }
    }
  }
}

processDir(path.join(__dirname, 'src/app'));
