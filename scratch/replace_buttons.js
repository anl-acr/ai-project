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

const directories = [
  '/Users/anilacar/ai-project/frontend/components', 
  '/Users/anilacar/ai-project/frontend/pages'
];

let files = [];
directories.forEach(dir => {
    if (fs.existsSync(dir)) files = walkSync(dir, files);
});

// Matches standard action button colors
const regexBg = /bg-(indigo|blue|purple|emerald|amber|slate)-(500|600|900)\b/g;
const regexHover = /hover:bg-(indigo|blue|purple|emerald|amber|slate)-(600|700|800)\b/g;

// Specifically exclude text colors or backgrounds used in specific layouts if possible,
// but since the user requested unifying action colors, we will replace the common button colors.
// WE EXCLUDE 'rose' to keep the "Unified Add Button Design Rule" intact.

let count = 0;
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Only replace inside className="..." or className={`...`} to avoid breaking logic if any
    // Wait, regex lookbehind for className is too complex and might miss.
    // Instead we will replace all occurrences of these utility classes. 
    // Tailwind utility classes are safe to replace globally since they are purely visual.
    
    // EXCEPTION: do not replace bg-slate-900 globally as it is the dark mode body/container background!
    // Let's remove slate from the general replace. We will only replace vibrant colors.
    const safeRegexBg = /bg-(indigo|blue|purple|emerald|amber)-(500|600)\b/g;
    const safeRegexHover = /hover:bg-(indigo|blue|purple|emerald|amber)-(600|700)\b/g;
    
    // For slate, we only replace it if it's explicitly styling a button? 
    // Actually, I'll just skip slate to be safe from breaking layout.

    content = content.replace(safeRegexBg, 'bg-primary');
    content = content.replace(safeRegexHover, 'hover:bg-primary/90');
    
    // text colors for hover
    const safeTextHover = /hover:text-(indigo|blue|purple|emerald|amber)-(600|700)\b/g;
    const safeText = /text-(indigo|blue|purple|emerald|amber)-(600|500)\b/g;
    
    content = content.replace(safeTextHover, 'hover:text-primary');
    content = content.replace(safeText, 'text-primary');

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log("Updated: " + file);
        count++;
    }
});

console.log(`Successfully updated ${count} files.`);
