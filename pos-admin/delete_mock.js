const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/index.tsx');
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

// We are deleting lines 1520 to 1578 (renderPayments)
// and lines 1808 to 2065 (renderDatabase through renderSecurity)
// Note: 1-indexed to 0-indexed means line N is index N-1

const newLines = lines.filter((line, index) => {
  const lineNum = index + 1;
  if (lineNum >= 1520 && lineNum <= 1578) return false;
  if (lineNum >= 1808 && lineNum <= 2065) return false;
  
  // also delete the switch cases
  if (line.includes("case 'payments': return renderPayments();")) return false;
  if (line.includes("case 'security': return renderSecurity();")) return false;
  if (line.includes("case 'database': return renderDatabase();")) return false;
  if (line.includes("case 'website': return renderWebsite();")) return false;
  if (line.includes("case 'marketing': return renderMarketing();")) return false;
  
  return true;
});

fs.writeFileSync(filePath, newLines.join('\n'));
console.log('Successfully removed mock modules.');
