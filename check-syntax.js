import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const getFiles = (dir) => {
    let files = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            files = files.concat(getFiles(file));
        } else if (file.endsWith('.js')) {
            files.push(file);
        }
    });
    return files;
};

const files = getFiles('backend');
files.forEach(file => {
    try {
        execSync(`node --check "${file}"`, { stdio: 'pipe' });
    } catch (e) {
        console.log(`❌ SYNTAX ERROR in ${file}:`);
        console.log(e.stderr.toString());
    }
});
console.log("Done checking files.");
