const fs = require("fs");
const path = require("path");

function getFiles(dir, filelist = []) {
  const files = fs.readdirSync(dir);
  files.forEach(function (file) {
    if (fs.statSync(path.join(dir, file)).isDirectory()) {
      filelist = getFiles(path.join(dir, file), filelist);
    } else {
      filelist.push(path.join(dir, file));
    }
  });
  return filelist;
}

function createJsonStructure(files) {
  const result = {};
  files.forEach((file) => {
    const parts = file.split(path.sep);
    let current = result;
    for (const part of parts) {
      current[part] = current[part] || {};
      current = current[part];
    }
  });
  return result;
}

const fileList = getFiles(".");
const jsonStructure = createJsonStructure(fileList);
