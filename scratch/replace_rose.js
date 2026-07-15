const fs = require('fs');
const path = require('path');

const walkSync = function(dir, filelist) {
  let files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function(file) {
    if (fs.statSync(path.join(dir, file)).isDirectory()) {
      filelist = walkSync(path.join(dir, file), filelist);
    }
    else {
      if (file.endsWith('.js') || file.endsWith('.jsx')) {
         filelist.push(path.join(dir, file));
      }
    }
  });
  return filelist;
};

let files = walkSync('/Users/anilacar/ai-project/frontend/components', []);
files = walkSync('/Users/anilacar/ai-project/frontend/pages', files);

let count = 0;
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // + button and other main UI elements might have been built with rose colors
    content = content.replace(/bg-rose-(500|600)\b/g, 'bg-primary');
    content = content.replace(/hover:bg-rose-(500|600)\b/g, 'hover:bg-primary/90');
    content = content.replace(/text-rose-(500|600)\b/g, 'text-primary');
    content = content.replace(/hover:text-rose-(500|600)\b/g, 'hover:text-primary');

    // also some elements might have been using purple-650 or similar custom classes that I missed
    content = content.replace(/bg-purple-(450|550|650)\b/g, 'bg-primary');
    content = content.replace(/hover:bg-purple-(450|550|650)\b/g, 'hover:bg-primary/90');
    content = content.replace(/bg-indigo-(450|550|650)\b/g, 'bg-primary');
    content = content.replace(/text-indigo-(450|550|650)\b/g, 'text-primary');
    content = content.replace(/text-purple-(450|550|650)\b/g, 'text-primary');

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log("Updated: " + file);
        count++;
    }
});
console.log("Successfully updated " + count + " files with rose/purple custom colors.");
