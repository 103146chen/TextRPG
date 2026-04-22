import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SceneParser } from './src/engine/SceneParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const scenesDir = path.join(__dirname, 'public', 'stories', 'cheng_zi', 'scenes');
const files = fs.readdirSync(scenesDir).filter(f => f.endsWith('.md'));

let hasError = false;

for (const file of files) {
  const filePath = path.join(scenesDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  try {
    const { meta, instructions } = SceneParser.parse(content);
    
    // Check for unclosed if/elif/else blocks
    const unclosedIfs = instructions.filter(ins => ins.type === 'if' && ins.endIndex === undefined);
    if (unclosedIfs.length > 0) {
      console.log(`[Error] ${file}: Unclosed ::if block found.`);
      hasError = true;
    }
    
    // Check for elif/else/endif without opening if (SceneParser sets openerIndex on endif if stack>0)
    const danglingEndif = instructions.filter(ins => ins.type === 'endif' && ins.openerIndex === undefined);
    if (danglingEndif.length > 0) {
      console.log(`[Error] ${file}: Dangling ::endif without opening ::if found.`);
      hasError = true;
    }

    // Add more validation if necessary
  } catch (err) {
    console.log(`[Exception] ${file}: ${err.message}`);
    hasError = true;
  }
}

if (!hasError) {
  console.log("No obvious format errors found.");
} else {
  console.log("Format validation finished with errors.");
}
