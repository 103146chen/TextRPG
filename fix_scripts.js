import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const scenesDir = path.join(__dirname, 'public', 'stories', 'cheng_zi', 'scenes');
const files = fs.readdirSync(scenesDir).filter(f => f.endsWith('.md'));

let totalFixed = 0;

for (const file of files) {
  const filePath = path.join(scenesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace patterns like: "some text :: endif" with "some text\n:: endif"
  // Make sure to match ":: endif", ":: elif", ":: else" preceded by non-whitespace (or just space but not beginning of line).
  // regex: /(.)\s*(::\s*(endif|elif|else))/g  (where $1 is not \n)
  
  const newContent = content.replace(/([^\n])\s*(::\s*(endif|elif|else))/g, '$1\n$2');
  
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    totalFixed++;
    console.log(`Fixed formatting in ${file}`);
  }
}

console.log(`Total files fixed: ${totalFixed}`);
