const major = Number(process.versions.node.split(".")[0]);
if (major !== 24) {
  console.error("ProjectX requires Node.js 24 LTS");
  process.exit(1);
}
console.log(
  `Node.js ${process.versions.node} meets the ProjectX major-version policy`,
);
